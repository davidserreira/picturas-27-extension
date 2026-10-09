// UC-VID-001 (trim) and UC-VID-003 (apply). Requests run asynchronously
// in their workers and share the lifecycle in utils/videoJobs.js.

const express = require("express");
const path = require("path");
const { Types } = require("mongoose");
const { applyLimitsFor, validateTools } = require("../utils/videoApply");

const router = express.Router();

const Video = require("../controllers/video");
const VideoJob = require("../controllers/videoJob");
const { formatBytes, formatMinutes } = require("../utils/videoLimits");
const {
  serializeJob,
  reserveOperation,
  publishTrim,
  publishApply,
  refundOperation,
  failedMessage,
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

// "praia.mp4" -> "praia_recorte.mp4" (RN7, REQ-016). If that name is already
// used in the project (by a video or by a request still running), a number is
// added: "praia_recorte_2.mp4", "praia_recorte_3.mp4", ...
function resultName(name, suffix, usedNames = new Set()) {
  const ext = path.extname(name);
  const base = `${path.basename(name, ext)}_${suffix}`;
  let candidate = `${base}${ext}`;
  for (let n = 2; usedNames.has(candidate.toLowerCase()); n++) {
    candidate = `${base}_${n}${ext}`;
  }
  return candidate;
}

const trimmedName = (name, used) => resultName(name, "recorte", used);
const editedName = (name, used) => resultName(name, "editado", used);

async function namesInUse(user, project) {
  const videos = await Video.getAll(user, project);
  const running = await VideoJob.getActiveByProject(user, project);
  return new Set(
    [...videos.map((v) => v.name), ...running.map((j) => j.result_name)].map((n) =>
      n.toLowerCase(),
    ),
  );
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
 * Submit a video tool: trim {start, end}, or apply {tools}.
 * @returns 202 { "job": Job }
 */
function submitTool(tool) {
  return wrap(async (req, res) => {
    const { user, project } = req.params;
    const video = await Video.getOne(user, project, req.params.video);
    if (!video) return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");
    if (video.state !== "available") {
      return fail(res, 409, "NOT_AVAILABLE", "Este vídeo ainda não está disponível.");
    }
    if (!isSupported(video)) {
      return fail(res, 415, "UNSUPPORTED_FORMAT",
        "Formato não suportado. Formatos aceites: MP4 (H.264) e MOV");
    }
    const lim = tool === "apply" ? applyLimitsFor(req.userType) : req.videoLimits;
    const verb = tool === "apply" ? "editar" : "recortar";
    const hint = req.userType === "free" ? UPGRADE_HINT : "";
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > lim.maxDuration) {
      return fail(res, 413, "DURATION_LIMIT",
        `O seu perfil só permite ${verb} vídeos até ${formatMinutes(lim.maxDuration)}.${hint}`);
    }
    if (video.size > lim.maxSize) {
      return fail(res, 413, "SIZE_LIMIT",
        `O seu perfil só permite ${verb} vídeos até ${formatBytes(lim.maxSize)}.${hint}`);
    }

    let params;
    if (tool === "apply") {
      const validated = validateTools(req.body?.tools, video.width, video.height, lim);
      if (validated.error) return fail(res, 400, "INVALID_TOOLS", validated.error);
      params = { tools: validated.tools, width: validated.width, height: validated.height };
    } else {
      const start = Number(req.body?.start);
      const end = Number(req.body?.end);
      const invalid = checkInterval(start, end, video.duration);
      if (invalid) return fail(res, 400, "INVALID_INTERVAL", invalid);
      params = { start, end };
    }

    const outcome = await withUserLock(user, async () => {
      if ((await VideoJob.countActive(user)) >= lim.maxActiveJobs) {
        return { error: [429, "TOO_MANY_JOBS",
          `Já tem ${lim.maxActiveJobs} pedido(s) de vídeo em curso. ` +
          "Aguarde que termine ou cancele-o antes de fazer outro."] };
      }
      const used = await Video.usedStorage(user);
      // Encoding may enlarge a file. Check actual output size again at completion.
      if (used >= lim.storage) {
        return { error: [413, "STORAGE_FULL",
          `Não há espaço na sua biblioteca de vídeos (${formatBytes(used)} de ${formatBytes(lim.storage)}).${hint}`] };
      }
      const id = new Types.ObjectId();
      const createdAt = new Date();
      let reserved = false;
      if (req.userType === "free") {
        reserved = await reserveOperation(user);
        if (!reserved) {
          return { error: [429, "QUOTA_EXCEEDED",
            `Atingiu o limite de ${process.env.FREE_DAILY_OP || 5} operações diárias.` +
            " Com o plano Premium não tem limite diário."] };
        }
      }
      try {
        const job = await VideoJob.create({
          _id: id, user_id: user, project_id: project, video_id: video._id,
          tool, params,
          result_name: resultName(video.name, tool === "apply" ? "editado" : "recorte", await namesInUse(user, project)),
          max_duration: lim.maxDuration, max_storage: lim.storage,
          quota_reserved: reserved, createdAt,
        });
        return { job };
      } catch (err) {
        // Creating a request can fail after quota was reserved.
        await refundOperation({ _id: id, user_id: user, createdAt, quota_reserved: reserved });
        throw err;
      }
    });
    if (outcome.error) return fail(res, ...outcome.error);
    const { job } = outcome;
    try {
      await (tool === "apply" ? publishApply : publishTrim)(job, video);
    } catch (err) {
      console.error("[video-jobs] could not publish:", err.message);
      await failJob(job._id, { code: "PUBLISH_FAILED", message: failedMessage(tool) });
      return fail(res, 503, "SERVICE_UNAVAILABLE",
        "O serviço de vídeo não está disponível. Tente novamente.");
    }
    res.status(202).jsonp({ job: serializeJob(job) });
  });
}

router.post("/:user/:project/videos/:video/trim", requireOwner, loadProfile, submitTool("trim"));
router.post("/:user/:project/videos/:video/apply", requireOwner, loadProfile, submitTool("apply"));

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
module.exports._test = { checkInterval, trimmedName, editedName, isSupported };
