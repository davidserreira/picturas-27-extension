const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const Video = require("../controllers/video");
const { post_video, delete_image } = require("./imageStorage");
const { probeVideo } = require("./videoProbe");
const { limits, formatMinutes } = require("./videoLimits");

// Partial files live on the image_data volume, so they survive a restart of the service.
const UPLOAD_DIR = path.join(__dirname, "..", "images", "video_uploads");

const CHUNK_SIZE = 5 * 1024 * 1024;
// An upload with no chunk for this long is considered interrupted.
const STALL_MS = (Number(process.env.VIDEO_STALL_SECONDS) || 60) * 1000;
// How long the partial file of an interrupted import is kept.
const RETENTION_MS =
  (Number(process.env.VIDEO_PARTIAL_RETENTION_SECONDS) || 60 * 60) * 1000;
const SWEEP_MS = 15 * 1000;

const messages = {
  unsupported: "Formato não suportado. Formatos aceites: MP4 (H.264) e MOV",
  unreadable: "Não foi possível ler este vídeo",
  storeFailed: "Não foi possível guardar o vídeo. Tente novamente.",
  expired: "A importação foi interrompida e não foi retomada no prazo de 1 hora.",
};

const contentTypes = { mp4: "video/mp4", mov: "video/quicktime" };

// Imports with a chunk being written right now (ids as strings).
const writing = new Set();

function partPath(videoId) {
  return path.join(UPLOAD_DIR, `${videoId}.part`);
}

async function removePart(videoId) {
  await fsp.rm(partPath(videoId), { force: true });
}

function durationMessage(maxDuration) {
  let msg = `O vídeo excede a duração máxima de ${formatMinutes(maxDuration)} do seu perfil.`;
  if (maxDuration < limits.premium.maxDuration) {
    msg += ` Com o plano Premium pode importar vídeos até ${formatMinutes(limits.premium.maxDuration)}.`;
  }
  return msg;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function failValidation(videoId, reason) {
  await Video.updateIfState(videoId, ["validating"], { state: "failed", reason });
}

/**
 * Checks the real format and codec, the readability and the duration of a fully
 * received file, then moves it to storage. Runs in the background; the outcome
 * is the video's state. The partial file is always removed at the end.
 */
async function validateImport(videoId) {
  const video = await Video.getById(videoId);
  if (!video || video.state !== "validating") return;

  const file = partPath(videoId);

  try {
    const info = await probeVideo(file);
    if (!info.ok) {
      return await failValidation(videoId, messages[info.error]);
    }

    if (Math.floor(info.duration) > video.max_duration) {
      return await failValidation(videoId, durationMessage(video.max_duration));
    }

    const sha256 = await sha256File(file);

    // cancelled while validating: nothing to store
    const current = await Video.getById(videoId);
    if (!current || current.state !== "validating") return;

    const key = `${uuidv4()}.${info.format}`;
    await post_video(
      video.user_id,
      video.project_id,
      key,
      fs.createReadStream(file),
      video.size,
      contentTypes[info.format],
    );

    const stored = await Video.updateIfState(videoId, ["validating"], {
      state: "available",
      reason: null,
      video_key: key,
      format: info.format,
      codec: info.codec,
      duration: info.duration,
      width: info.width,
      height: info.height,
      sha256,
    });

    // cancelled while it was being stored: undo
    if (!stored) {
      await delete_image(video.user_id, video.project_id, "video", key);
    }
  } catch (err) {
    console.error("Error validating video import", String(videoId), err.message);
    await failValidation(videoId, messages.storeFailed);
  } finally {
    await removePart(videoId).catch(() => {});
  }
}

// Marks stalled uploads as interrupted and expires interrupted imports past retention.
async function sweepImports() {
  const now = Date.now();

  const stalled = await Video.getByState("uploading", {
    last_chunk_at: { $lt: new Date(now - STALL_MS) },
  });
  for (const video of stalled) {
    if (writing.has(String(video._id))) continue;
    await Video.updateIfState(
      video._id,
      ["uploading"],
      { state: "interrupted", interrupted_at: new Date(now) },
      { last_chunk_at: video.last_chunk_at },
    );
  }

  const expired = await Video.getByState("interrupted", {
    interrupted_at: { $lt: new Date(now - RETENTION_MS) },
  });
  for (const video of expired) {
    if (writing.has(String(video._id))) continue;
    const failed = await Video.updateIfState(video._id, ["interrupted"], {
      state: "failed",
      reason: messages.expired,
    });
    if (failed) await removePart(video._id);
  }
}

// Called once at startup.
async function startImportMaintenance() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });

  // validations cut short by a restart are run again
  const pending = await Video.getByState("validating");
  for (const video of pending) {
    validateImport(video._id).catch((err) =>
      console.error("Error resuming video validation:", err.message),
    );
  }

  setInterval(() => {
    sweepImports().catch((err) =>
      console.error("Error sweeping video imports:", err.message),
    );
  }, SWEEP_MS);
}

// Removes a video's files (partial and stored) and its record.
async function removeVideo(video) {
  await removePart(video._id);
  if (video.video_key) {
    await delete_image(video.user_id, video.project_id, "video", video.video_key);
  }
  await Video.delete(video._id);
}

async function deleteProjectVideos(userId, projectId) {
  const videos = await Video.getAll(userId, projectId);
  for (const video of videos) {
    await removeVideo(video);
  }
}

module.exports = {
  CHUNK_SIZE,
  RETENTION_MS,
  messages,
  writing,
  partPath,
  removePart,
  validateImport,
  startImportMaintenance,
  removeVideo,
  deleteProjectVideos,
};
