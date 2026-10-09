// Shared lifecycle for UC-VID-001 (trim) and UC-VID-003 (apply).
const axios = require("axios");
const VideoJob = require("../controllers/videoJob");
const Video = require("../controllers/video");
const Project = require("../controllers/project");
const broker = require("./videoBroker");
const { withUserLock } = require("./videoLocks");
const { limitsFor } = require("./videoLimits");
const { httpsAgent } = require("./httpsAgent");
const { get_image_internal_url, delete_image } = require("./imageStorage");

const USERS = "https://users:10001/";
const QUEUES = { trim: "video_trim_queue", apply: "video_apply_queue" };
const STALE_AFTER_MS = 20 * 60 * 1000;
const failedMessage = (tool) => tool === "apply"
  ? "Não foi possível aplicar as ferramentas ao vídeo. Tente novamente."
  : "Não foi possível recortar o vídeo. Tente novamente.";

function serializeJob(job) {
  return {
    _id: job._id, project_id: job.project_id, video_id: job.video_id,
    tool: job.tool, params: job.params, state: job.state, progress: job.progress,
    frames_processed: job.frames_processed || 0, frame_count: job.frame_count ?? null,
    error: job.error?.message ? job.error : null, result_name: job.result_name,
    result_video_id: job.result_video_id, createdAt: job.createdAt,
    updatedAt: job.updatedAt, finished_at: job.finished_at,
  };
}

function notify(job) {
  void broker.publish("ws_queue", {
    type: "video-job-update", user: String(job.user_id), job: serializeJob(job),
  }).catch((err) => console.error("[video-jobs] notify failed:", err.message));
}

async function reserveOperation(userId) {
  try {
    await axios.get(USERS + `${userId}/process/1`, { httpsAgent, timeout: 1500 });
    return true;
  } catch (err) {
    if (err.response && /No more daily_operations/.test(String(err.response.data))) return false;
    throw err;
  }
}

async function refundOperation(job) {
  if (!job.quota_reserved || job.quota_refunded) return;
  try {
    await axios.post(USERS + `${job.user_id}/process/refund/1`, {
      jobId: String(job._id), day: new Date(job.createdAt).toISOString().slice(0, 10),
    }, { httpsAgent, timeout: 1500 });
    await VideoJob.updateIfState(job._id, ["failed", "cancelled"], { quota_refunded: true });
  } catch (err) {
    // Persisted failed/cancelled jobs are retried by maintenance. The users
    // endpoint handles lost HTTP replies without refunding the same job twice.
    console.error(`[video-jobs] refund pending for ${job._id}:`, err.message);
  }
}

async function publishJob(job, video) {
  const resp = await get_image_internal_url(job.user_id, job.project_id, "video", video.video_key);
  const parameters = {
    inputVideoURL: resp.data.url,
    userId: String(job.user_id), projectId: String(job.project_id),
    outputFileName: `${job._id}.${video.format}`, format: video.format, codec: video.codec,
  };
  if (job.tool === "trim") {
    parameters.start = job.params.start;
    parameters.end = Math.min(job.params.end, video.duration);
  } else {
    parameters.tools = job.params.tools;
    parameters.maxDuration = job.max_duration;
    parameters.maxOutputBytes = job.max_storage;
    parameters.width = job.params.width;
    parameters.height = job.params.height;
  }
  await broker.publish(QUEUES[job.tool], {
    messageId: String(job._id), timestamp: new Date().toISOString(),
    procedure: `video_${job.tool}`, parameters,
  });
}
const publishTrim = publishJob;
const publishApply = publishJob;

async function failJob(jobId, error) {
  const job = await VideoJob.updateIfState(jobId, VideoJob.ACTIVE_STATES, {
    state: "failed", error: { code: error.code, message: error.message }, finished_at: new Date(),
  });
  if (!job) return null;
  await refundOperation(job);
  notify(job);
  return job;
}

async function cancelJob(jobId) {
  const job = await VideoJob.updateIfState(jobId, VideoJob.ACTIVE_STATES, {
    state: "cancelled", finished_at: new Date(),
  });
  if (!job) return null;
  await refundOperation(job);
  notify(job);
  return job;
}

async function onProgress(msg) {
  const update = {
    $set: { state: "processing" },
    $max: { progress: Math.max(0, Math.min(99, Number(msg.progress) || 0)) },
  };
  if (Number.isInteger(msg.framesProcessed) && msg.framesProcessed >= 0) {
    update.$max.frames_processed = msg.framesProcessed;
  }
  if (Number.isInteger(msg.frameCount) && msg.frameCount > 0) {
    update.$set.frame_count = msg.frameCount;
  }
  const job = await VideoJob.updateIfState(msg.jobId, VideoJob.ACTIVE_STATES, update);
  if (!job) return;
  if (!job.started_at) {
    job.started_at = new Date();
    await job.save();
  }
  notify(job);
}

async function onSuccess(msg) {
  const first = await VideoJob.getById(msg.jobId);
  if (!first) return;
  return withUserLock(first.user_id, async () => {
    const current = await VideoJob.getById(msg.jobId);
    if (!current) return;
    // A replay after completion must never delete the published result.
    if (current.state === "completed") return;
    const out = msg.output;
    if (!out || !["mp4", "mov"].includes(out.format) ||
        out.fileName !== `${current._id}.${out.format}`) {
      return failJob(current._id, { code: "INVALID_RESULT", message: failedMessage(current.tool) });
    }
    const cleanup = () => delete_image(current.user_id, current.project_id, "video", out.fileName);
    if (!VideoJob.ACTIVE_STATES.includes(current.state)) {
      await cleanup();
      return;
    }
    const fingerprint = `${current.tool}:${current._id}`;
    // Recover a result inserted just before a projects process crashed.
    let video = await Video.getByFingerprint(current.user_id, current.project_id, fingerprint);
    const rejectResult = async (code) => {
      if (video) await Video.delete(video._id);
      await cleanup();
      return failJob(current._id, { code, message: failedMessage(current.tool) });
    };
    if (!Number.isFinite(out.size) || out.size <= 0 || !Number.isFinite(out.duration) ||
        out.duration <= 0 || !Number.isInteger(out.width) || !Number.isInteger(out.height) ||
        (current.tool === "apply" && (out.width !== current.params.width || out.height !== current.params.height ||
          !Number.isInteger(out.frame_count) || out.frame_count <= 0))) {
      return rejectResult("INVALID_RESULT");
    }
    if (!(await Project.getOne(current.user_id, current.project_id))) return rejectResult("PROJECT_REMOVED");
    const maximum = current.max_storage || limitsFor("free").storage;
    const used = await Video.usedStorage(current.user_id);
    if (used - (video?.size || 0) + out.size > maximum) return rejectResult("STORAGE_FULL");
    if (!video) {
      video = await Video.create({
        user_id: current.user_id, project_id: current.project_id,
        name: current.result_name, size: out.size, received: out.size,
        fingerprint, state: "available", max_duration: current.max_duration,
        video_key: out.fileName, format: out.format, codec: out.codec,
        duration: out.duration, width: out.width, height: out.height,
        frame_count: out.frame_count ?? null, fps: out.fps ?? null,
      });
    }
    const job = await VideoJob.updateIfState(current._id, VideoJob.ACTIVE_STATES, {
      state: "completed", progress: 100, result_video_id: video._id,
      frames_processed: out.frame_count || current.frames_processed || 0,
      frame_count: out.frame_count ?? current.frame_count, finished_at: new Date(),
    });
    if (!job) {
      await Video.delete(video._id);
      await cleanup();
      return;
    }
    notify(job);
  });
}

async function onReply(raw) {
  let msg;
  try { msg = JSON.parse(raw.content.toString()); }
  catch (_) { return console.error("[video-jobs] malformed reply discarded"); }
  if (!msg || typeof msg !== "object" || !/^[a-f0-9]{24}$/i.test(msg.jobId)) return;
  switch (msg.type) {
    case "progress": return onProgress(msg);
    case "success": return onSuccess(msg);
    case "error": {
      const job = await VideoJob.getById(msg.jobId);
      if (!job) return;
      return failJob(msg.jobId, {
        code: String(msg.error?.code || "PROCESSING_FAILED"), message: failedMessage(job.tool),
      });
    }
    case "cancelled": return cancelJob(msg.jobId);
    default: console.error("[video-jobs] unknown reply type:", msg.type);
  }
  // Database/storage errors propagate: the broker retries the unacknowledged reply.
}

async function maintainJobs() {
  const stale = await VideoJob.findStale(new Date(Date.now() - STALE_AFTER_MS));
  for (const job of stale) await failJob(job._id, { code: "TIMEOUT", message: failedMessage(job.tool) });
  for (const job of await VideoJob.findRefundPending()) await refundOperation(job);
}

function startVideoJobs() {
  broker.consume("video_job_queue", onReply);
  setInterval(() => maintainJobs().catch((err) => console.error(err.message)), 60 * 1000);
}

module.exports = {
  serializeJob, reserveOperation, refundOperation, publishTrim, publishApply,
  failJob, cancelJob, startVideoJobs, failedMessage,
  _test: { onProgress, onSuccess, onReply, maintainJobs },
};
