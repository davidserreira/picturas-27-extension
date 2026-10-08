// Lifecycle of video processing jobs (UC-VID-001): publishing requests to the
// workers, consuming their replies, notifying the browser and keeping the
// daily quota consistent.

const axios = require("axios");

const VideoJob = require("../controllers/videoJob");
const Video = require("../controllers/video");
const { send_rabbit_msg, read_rabbit_msg } = require("./rabbit_mq");
const { httpsAgent } = require("./httpsAgent");
const { get_image_internal_url, delete_image } = require("./imageStorage");

const users_ms = "https://users:10001/";

const QUEUES = { trim: "video_trim_queue" };
const REPLY_QUEUE = "video_job_queue";
const WS_QUEUE = "ws_queue";

// Worker gives up after 15 min (D9); a job with no news for longer than this
// is considered lost (e.g. worker container removed) and marked failed.
const STALE_AFTER_MS = 20 * 60 * 1000;

const FAILED_MESSAGE = "Não foi possível recortar o vídeo. Tente novamente.";

function serializeJob(job) {
  return {
    _id: job._id,
    project_id: job.project_id,
    video_id: job.video_id,
    tool: job.tool,
    params: job.params,
    state: job.state,
    progress: job.progress,
    error: job.error?.message ? job.error : null,
    result_name: job.result_name,
    result_video_id: job.result_video_id,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finished_at: job.finished_at,
  };
}

// Real-time update to the owner's browser, through wsGateway (REQ-011/012)
function notify(job) {
  try {
    send_rabbit_msg(
      { type: "video-job-update", user: String(job.user_id), job: serializeJob(job) },
      WS_QUEUE,
    );
  } catch (err) {
    console.error("[video-jobs] notify failed:", err.message);
  }
}

// --------------------------------------------------------------------- quota

// Reserves 1 daily operation in users-ms. Returns true if reserved,
// false if the daily limit is reached. Premium users are never limited there.
async function reserveOperation(userId) {
  try {
    await axios.get(users_ms + `${userId}/process/1`, { httpsAgent });
    return true;
  } catch (err) {
    if (err.response && /No more daily_operations/.test(String(err.response.data))) {
      return false;
    }
    throw err;
  }
}

async function refundOperation(job) {
  if (!job.quota_reserved) return;
  try {
    await axios.post(users_ms + `${job.user_id}/process/refund/1`, {}, { httpsAgent });
  } catch (err) {
    console.error(`[video-jobs] refund failed for job ${job._id}:`, err.message);
  }
}

// ------------------------------------------------------------------ requests

async function publishTrim(job, video) {
  const resp = await get_image_internal_url(job.user_id, job.project_id, "video", video.video_key);

  send_rabbit_msg(
    {
      messageId: String(job._id),
      timestamp: new Date().toISOString(),
      procedure: "video_trim",
      parameters: {
        inputVideoURL: resp.data.url,
        start: job.params.start,
        // RN2 uses whole seconds; never ask for more than the real duration
        end: Math.min(job.params.end, video.duration),
        userId: String(job.user_id),
        projectId: String(job.project_id),
        outputFileName: `${job._id}.${video.format}`,
        format: video.format,
        codec: video.codec,
      },
    },
    QUEUES.trim,
  );
}

// Marks a job failed (if still active), refunds and notifies.
async function failJob(jobId, error) {
  const job = await VideoJob.updateIfState(jobId, VideoJob.ACTIVE_STATES, {
    state: "failed",
    error: { code: error.code, message: error.message },
    finished_at: new Date(),
  });
  if (!job) return null;
  await refundOperation(job);
  notify(job);
  return job;
}

// Cancels a job (FA2). The worker notices it and stops (decision D7).
async function cancelJob(jobId) {
  const job = await VideoJob.updateIfState(jobId, VideoJob.ACTIVE_STATES, {
    state: "cancelled",
    finished_at: new Date(),
  });
  if (!job) return null;
  await refundOperation(job);
  notify(job);
  return job;
}

// ------------------------------------------------------------------- replies

async function onProgress(msg) {
  const job = await VideoJob.updateIfState(msg.jobId, VideoJob.ACTIVE_STATES, {
    state: "processing",
    progress: Math.max(0, Math.min(100, Number(msg.progress) || 0)),
  });
  if (!job) return;
  if (!job.started_at) {
    job.started_at = new Date();
    await job.save();
  }
  notify(job);
}

async function onSuccess(msg) {
  const current = await VideoJob.getById(msg.jobId);
  if (!current) return;
  const out = msg.output;

  if (!VideoJob.ACTIVE_STATES.includes(current.state)) {
    // cancelled while the result was being stored: remove the orphan file
    await delete_image(current.user_id, current.project_id, "video", out.fileName).catch(() => {});
    return;
  }

  // REQ-016: the result is a new video of the library; the original is untouched
  const video = await Video.create({
    user_id: current.user_id,
    project_id: current.project_id,
    name: current.result_name,
    size: out.size,
    received: out.size,
    fingerprint: `trim:${current._id}`,
    state: "available",
    max_duration: current.max_duration,
    video_key: out.fileName,
    format: out.format,
    codec: out.codec,
    duration: out.duration,
    width: out.width,
    height: out.height,
  });

  const job = await VideoJob.updateIfState(current._id, VideoJob.ACTIVE_STATES, {
    state: "completed",
    progress: 100,
    result_video_id: video._id,
    finished_at: new Date(),
  });

  if (!job) {
    // cancelled at the very last moment: undo
    await Video.delete(video._id);
    await delete_image(current.user_id, current.project_id, "video", out.fileName).catch(() => {});
    return;
  }
  // the operation reserved at submission is now definitively used (REQ-018)
  notify(job);
}

async function onReply(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.content.toString());
  } catch (_) {
    return console.error("[video-jobs] malformed reply discarded");
  }

  try {
    switch (msg.type) {
      case "progress":
        return await onProgress(msg);
      case "success":
        return await onSuccess(msg);
      case "error":
        console.error(`[video-jobs] job ${msg.jobId} failed:`, msg.error?.code);
        return await failJob(msg.jobId, {
          code: String(msg.error?.code || "PROCESSING_FAILED"),
          message: msg.error?.message || FAILED_MESSAGE,
        });
      case "cancelled":
        return await cancelJob(msg.jobId); // normally already cancelled: no-op
      default:
        console.error("[video-jobs] unknown reply type:", msg.type);
    }
  } catch (err) {
    console.error(`[video-jobs] error handling ${msg.type} of ${msg.jobId}:`, err.message);
  }
}

// ------------------------------------------------------------- maintenance

async function failStaleJobs() {
  const stale = await VideoJob.findStale(new Date(Date.now() - STALE_AFTER_MS));
  for (const job of stale) {
    await failJob(job._id, { code: "TIMEOUT", message: FAILED_MESSAGE });
  }
}

function startVideoJobs() {
  read_rabbit_msg(REPLY_QUEUE, (msg) => {
    onReply(msg);
  });
  setInterval(() => failStaleJobs().catch((e) => console.error(e.message)), 60 * 1000);
}

module.exports = {
  serializeJob,
  reserveOperation,
  refundOperation,
  publishTrim,
  failJob,
  cancelJob,
  startVideoJobs,
};
