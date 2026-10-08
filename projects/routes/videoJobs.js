// Video tools (UC-VID-001: Recortar um vídeo). Requests are processed
// asynchronously by the video_trim worker; see utils/videoJobs.js.

const express = require("express");
const path = require("path");

const router = express.Router();

const Video = require("../controllers/video");
const VideoJob = require("../controllers/videoJob");
const { formatBytes, formatMinutes } = require("../utils/videoLimits");
const {
  serializeJob,
  reserveOperation,
  publishTrim,
  failJob,
  cancelJob,
} = require("../utils/videoJobs");
const { helpers } = require("./videos");

const { fail, wrap, requireOwner, loadProfile, withUserLock } = helpers;

const MIN_TRIM_SECONDS = 1; // RN2

const UPGRADE_HINT = " Com o plano Premium tem limites maiores.";

function isSupported(video) {
  // RN1: MP4 (H.264) or MOV
  return (video.format === "mp4" && video.codec === "h264") || video.format === "mov";
}

// "praia.mp4" -> "praia_recorte.mp4" (RN7, REQ-016)
function trimmedName(name) {
  const ext = path.extname(name);
  return `${path.basename(name, ext)}_recorte${ext}`;
}

// RN2 / REQ-002 / REQ-003: whole seconds, 0 <= start < end <= duration, >= 1 s.
// The duration is rounded up so the last fraction of a second can be included.
function checkInterval(start, end, duration) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return "O início e o fim têm de ser indicados em segundos inteiros.";
  }
  if (start < 0) return "O início não pode ser negativo.";
  if (start >= end) return "O instante de fim tem de ser posterior ao de início.";
  if (end > Math.ceil(duration)) return "O instante de fim não pode exceder a duração do vídeo.";
  if (end - start < MIN_TRIM_SECONDS) return "O recorte tem de ter pelo menos 1 segundo.";
  return null;
}

/**
 * Internal (Docker network only, not exposed by the API gateway):
 * lets the worker know whether a job was cancelled (decision D7).
 */
router.get("/internal/video-jobs/:job/state", wrap(async (req, res) => {
  const job = await VideoJob.getById(req.params.job);
  if (!job) return fail(res, 404, "NOT_FOUND", "Pedido não encontrado.");
  res.status(200).jsonp({ state: job.state });
}));

/**
 * Trim a video of the library (UC-VID-001, passo 4)
 * @body { "start": Number (s), "end": Number (s) }
 * @returns 202 { "job": Job }
 */
router.post(
  "/:user/:project/videos/:video/trim",
  requireOwner,
  loadProfile, // also rejects the anonymous profile (REQ-022)
  wrap(async (req, res) => {
    const { user, project } = req.params;
    const video = await Video.getOne(user, project, req.params.video);
    if (!video) return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");
    if (video.state !== "available") {
      return fail(res, 409, "NOT_AVAILABLE", "Este vídeo ainda não está disponível.");
    }

    // E1 / REQ-004
    if (!isSupported(video)) {
      return fail(res, 415, "UNSUPPORTED_FORMAT",
        "Formato não suportado. Formatos aceites: MP4 (H.264) e MOV");
    }

    // E2 / REQ-005 / REQ-006: limits of the user's current profile
    const lim = req.videoLimits;
    const hint = req.userType === "free" ? UPGRADE_HINT : "";
    if (Math.floor(video.duration) > lim.maxDuration) {
      return fail(res, 413, "DURATION_LIMIT",
        `O seu perfil só permite recortar vídeos até ${formatMinutes(lim.maxDuration)}.${hint}`);
    }
    if (video.size > lim.maxSize) {
      return fail(res, 413, "SIZE_LIMIT",
        `O seu perfil só permite recortar vídeos até ${formatBytes(lim.maxSize)}.${hint}`);
    }

    // E4 / REQ-003
    const start = Number(req.body?.start);
    const end = Number(req.body?.end);
    const invalid = checkInterval(start, end, video.duration);
    if (invalid) return fail(res, 400, "INVALID_INTERVAL", invalid);

    // Checks and reservation run one at a time per user, so two simultaneous
    // requests cannot both pass the active-jobs or quota checks.
    const outcome = await withUserLock(user, async () => {
      // E6 / REQ-008
      if ((await VideoJob.countActive(user)) >= lim.maxActiveJobs) {
        return { error: [429, "TOO_MANY_JOBS",
          `Já tem ${lim.maxActiveJobs} pedido(s) de vídeo em curso. ` +
          "Aguarde que termine ou cancele-o antes de fazer outro."] };
      }

      // Library space: the result can be at most as big as the original
      const used = await Video.usedStorage(user);
      if (used + video.size > lim.storage) {
        return { error: [413, "STORAGE_FULL",
          `Não há espaço na sua biblioteca de vídeos (${formatBytes(used)} de ${formatBytes(lim.storage)}).${hint}`] };
      }

      // E3 / REQ-007: 1 operation is reserved now and refunded if the job
      // does not end "completed" -> it only counts when completed (REQ-018)
      let reserved = false;
      if (req.userType === "free") {
        reserved = await reserveOperation(user);
        if (!reserved) {
          return { error: [429, "QUOTA_EXCEEDED",
            `Atingiu o limite de ${process.env.FREE_DAILY_OP || 5} operações diárias.` +
            " Com o plano Premium não tem limite diário."] };
        }
      }

      // REQ-009: request created "Em fila"
      const job = await VideoJob.create({
        user_id: user,
        project_id: project,
        video_id: video._id,
        tool: "trim",
        params: { start, end },
        result_name: trimmedName(video.name),
        max_duration: lim.maxDuration,
        quota_reserved: reserved,
      });
      return { job };
    });

    if (outcome.error) return fail(res, ...outcome.error);
    const { job } = outcome;

    try {
      await publishTrim(job, video);
    } catch (err) {
      console.error("[video-jobs] could not publish trim:", err.message);
      await failJob(job._id, {
        code: "PUBLISH_FAILED",
        message: "Não foi possível recortar o vídeo. Tente novamente.",
      });
      return fail(res, 503, "SERVICE_UNAVAILABLE",
        "O serviço de vídeo não está disponível. Tente novamente.");
    }

    // REQ-010: answered right away, the processing happens in the worker
    res.status(202).jsonp({ job: serializeJob(job) });
  }),
);

// List the video jobs of a project (most recent first)
router.get("/:user/:project/video-jobs", requireOwner, wrap(async (req, res) => {
  const jobs = await VideoJob.getAll(req.params.user, req.params.project);
  res.status(200).jsonp({ jobs: jobs.map(serializeJob) });
}));

// Get a video job
router.get("/:user/:project/video-jobs/:job", requireOwner, wrap(async (req, res) => {
  const job = await VideoJob.getOne(req.params.user, req.params.project, req.params.job);
  if (!job) return fail(res, 404, "NOT_FOUND", "Pedido não encontrado.");
  res.status(200).jsonp({ job: serializeJob(job) });
}));

// Cancel a job "Em fila" or "Em processamento" (FA2, REQ-013)
router.post("/:user/:project/video-jobs/:job/cancel", requireOwner, wrap(async (req, res) => {
  const job = await VideoJob.getOne(req.params.user, req.params.project, req.params.job);
  if (!job) return fail(res, 404, "NOT_FOUND", "Pedido não encontrado.");

  const cancelled = await cancelJob(job._id);
  if (!cancelled) {
    return fail(res, 409, "NOT_ACTIVE", "Este pedido já terminou e não pode ser cancelado.");
  }
  res.status(200).jsonp({ job: serializeJob(cancelled) });
}));

module.exports = router;
module.exports._test = { checkInterval, trimmedName, isSupported };
