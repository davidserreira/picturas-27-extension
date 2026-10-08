var express = require("express");
var router = express.Router();
const axios = require("axios");

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");

const Project = require("../controllers/project");
const Video = require("../controllers/video");
const { getCallerId } = require("../utils/caller");
const { httpsAgent } = require("../utils/httpsAgent");
const { get_image_public_url } = require("../utils/imageStorage");
const { limits, limitsFor, formatBytes } = require("../utils/videoLimits");
const {
  CHUNK_SIZE,
  RETENTION_MS,
  messages,
  writing,
  partPath,
  removePart,
  validateImport,
  removeVideo,
} = require("../utils/videoImport");

const users_ms = "https://users:10001/";

const allowed_extensions = [".mp4", ".mov"];

/*
Video structure (as sent to the client)
{
    "_id": Mongoose.type.id,
    "name": String,
    "size": Number (bytes),
    "received": Number (bytes),
    "state": "uploading" | "validating" | "available" | "interrupted" | "failed" | "cancelled",
    "reason": String | null,
    "format": "mp4" | "mov" | null,
    "codec": String | null,
    "duration": Number (seconds) | null,
    "width": Number | null,
    "height": Number | null,
    "createdAt": Date,
    "expiresAt": Date | null (until when an interrupted import can be resumed)
}

Error structure
{
    "code": String,
    "message": String (to be shown to the user)
}
*/

function serialize(video) {
  return {
    _id: video._id,
    name: video.name,
    size: video.size,
    received: video.received,
    state: video.state,
    reason: video.reason,
    format: video.format,
    codec: video.codec,
    duration: video.duration,
    width: video.width,
    height: video.height,
    createdAt: video.createdAt,
    expiresAt:
      video.state === "interrupted" && video.interrupted_at
        ? new Date(video.interrupted_at.getTime() + RETENTION_MS)
        : null,
  };
}

function fail(res, status, code, message, extra = {}) {
  return res.status(status).jsonp({ code, message, ...extra });
}

function wrap(handler) {
  return (req, res, next) =>
    handler(req, res, next).catch((err) => {
      if (res.headersSent) return;
      if (err.name === "CastError") {
        return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");
      }
      console.error("[videos]", req.method, req.originalUrl, err.message);
      return fail(res, 500, "INTERNAL_ERROR", "Ocorreu um erro. Tente novamente.");
    });
}

// The video library is private: only the owner of the project may use it.
function requireOwner(req, res, next) {
  const caller = getCallerId(req);
  if (!caller || String(caller) !== String(req.params.user)) {
    return fail(res, 403, "NOT_ALLOWED", "Sem permissão para aceder a estes vídeos.");
  }
  next();
}

// Loads the project and the video limits of the user's profile.
const loadProfile = wrap(async (req, res, next) => {
  const project = await Project.getOne(req.params.user, req.params.project);
  if (!project) return fail(res, 404, "NOT_FOUND", "Projeto não encontrado.");

  const resp = await axios.get(users_ms + `${req.params.user}/type`, { httpsAgent });
  const userType = resp.data.type;
  const profileLimits = limitsFor(userType);

  if (!profileLimits) {
    return fail(
      res,
      403,
      "VIDEO_NOT_AVAILABLE",
      "O perfil anónimo não tem acesso a funcionalidades de vídeo. Crie uma conta para importar vídeos.",
    );
  }

  req.userType = userType;
  req.videoLimits = profileLimits;
  next();
});

// Runs `fn` after any other pending call for the same user, so that the space
// and active-import checks of two simultaneous requests cannot both pass.
const userLocks = new Map();
function withUserLock(userId, fn) {
  const previous = userLocks.get(userId) || Promise.resolve();
  const result = previous.then(fn);
  const tail = result.catch(() => {});
  userLocks.set(userId, tail);
  tail.then(() => {
    if (userLocks.get(userId) === tail) userLocks.delete(userId);
  });
  return result;
}

function premiumHint(userType, premiumLimit) {
  return userType === "free"
    ? ` Com o plano Premium pode importar vídeos até ${premiumLimit}.`
    : "";
}

// Get the videos of a project, plus the user's storage usage and limits
router.get("/:user/:project/videos", requireOwner, loadProfile, wrap(async (req, res) => {
  const videos = await Video.getAll(req.params.user, req.params.project);
  const used = await Video.usedStorage(req.params.user);

  res.status(200).jsonp({
    videos: videos.map(serialize),
    usage: { used, limit: req.videoLimits.storage },
    limits: req.videoLimits,
    profile: req.userType,
  });
}));

// Get a specific video
router.get("/:user/:project/videos/:video", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");

  res.status(200).jsonp(serialize(video));
}));

// Get the url of an available video
router.get("/:user/:project/videos/:video/url", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");
  if (video.state !== "available") {
    return fail(res, 409, "NOT_AVAILABLE", "Este vídeo ainda não está disponível.");
  }

  const resp = await get_image_public_url(
    req.params.user,
    req.params.project,
    "video",
    video.video_key,
  );

  res.status(200).jsonp({ url: resp.data.url });
}));

/**
 * Start importing a video: creates the import request, in state "uploading"
 * @body { "name": String, "size": Number, "fingerprint": String }
 * @returns { "video": Video structure, "chunkSize": Number }
 */
router.post("/:user/:project/videos", requireOwner, loadProfile, wrap(async (req, res) => {
  const name = typeof req.body.name === "string" ? path.basename(req.body.name.trim()) : "";
  const size = req.body.size;
  const fingerprint = req.body.fingerprint;

  if (
    !name ||
    name.length > 255 ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !/^[a-f0-9]{64}$/.test(fingerprint || "")
  ) {
    return fail(res, 400, "INVALID_REQUEST", "Pedido de importação inválido.");
  }

  if (!allowed_extensions.includes(path.extname(name).toLowerCase())) {
    return fail(res, 415, "UNSUPPORTED_FORMAT", messages.unsupported);
  }

  const { maxSize, maxDuration, storage, maxActiveImports } = req.videoLimits;

  if (size > maxSize) {
    return fail(
      res,
      413,
      "FILE_TOO_LARGE",
      `O ficheiro excede o tamanho máximo de ${formatBytes(maxSize)} do seu perfil.` +
        premiumHint(req.userType, formatBytes(limits.premium.maxSize)),
      { limit: maxSize },
    );
  }

  const video = await withUserLock(req.params.user, async () => {
    const free = storage - (await Video.usedStorage(req.params.user));
    if (size > free) {
      fail(
        res,
        409,
        "STORAGE_FULL",
        `Não há espaço suficiente na biblioteca de vídeo. Espaço livre: ${formatBytes(free)} de ${formatBytes(storage)}.`,
        { free: Math.max(0, free) },
      );
      return null;
    }

    if ((await Video.countActive(req.params.user)) >= maxActiveImports) {
      fail(
        res,
        409,
        "TOO_MANY_IMPORTS",
        `Atingiu o número máximo de importações ativas (${maxActiveImports}). Aguarde ou cancele uma importação ativa.`,
      );
      return null;
    }

    return await Video.create({
      user_id: req.params.user,
      project_id: req.params.project,
      name,
      size,
      fingerprint,
      max_duration: maxDuration,
    });
  });

  if (!video) return;

  await fsp.mkdir(path.dirname(partPath(video._id)), { recursive: true });
  await fsp.writeFile(partPath(video._id), "");

  res.status(201).jsonp({ video: serialize(video), chunkSize: CHUNK_SIZE });
}));

/**
 * Send the next part of the file
 * @query offset: number of bytes already sent, must match what the server has
 * @body Raw bytes (application/octet-stream)
 * @returns { "received": Number }
 */
router.put("/:user/:project/videos/:video/chunk", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Importação não encontrada.");

  if (!["uploading", "interrupted"].includes(video.state)) {
    return fail(res, 409, "NOT_UPLOADING", "Esta importação já não está a receber dados.", {
      state: video.state,
    });
  }

  if (Number(req.query.offset) !== video.received) {
    return fail(res, 409, "OFFSET_MISMATCH", "Posição de envio inesperada.", {
      received: video.received,
    });
  }

  const id = String(video._id);
  if (writing.has(id)) {
    return fail(res, 409, "CHUNK_IN_PROGRESS", "Já existe um envio em curso para esta importação.");
  }

  writing.add(id);
  try {
    const file = partPath(id);

    // drop whatever an aborted chunk may have left behind
    try {
      await fsp.truncate(file, video.received);
    } catch (err) {
      if (err.code !== "ENOENT" || video.received > 0) throw err;
    }

    const remaining = video.size - video.received;
    let written = 0;
    const counter = new Transform({
      transform(chunk, _, done) {
        written += chunk.length;
        if (written > remaining) return done(new Error("CHUNK_TOO_LARGE"));
        done(null, chunk);
      },
    });

    try {
      await pipeline(req, counter, fs.createWriteStream(file, { flags: "a" }));
    } catch (err) {
      await fsp.truncate(file, video.received).catch(() => {});
      if (err.message === "CHUNK_TOO_LARGE") {
        return fail(res, 413, "CHUNK_TOO_LARGE", "Foram enviados mais dados do que o tamanho do ficheiro.");
      }
      return fail(res, 400, "CHUNK_ABORTED", "O envio foi interrompido.");
    }

    if (written === 0) {
      return fail(res, 400, "EMPTY_CHUNK", "Não foram recebidos dados.");
    }

    // a chunk arriving for an interrupted import resumes it
    const updated = await Video.updateIfState(
      id,
      ["uploading", "interrupted"],
      {
        state: "uploading",
        received: video.received + written,
        last_chunk_at: new Date(),
        interrupted_at: null,
      },
      { received: video.received },
    );

    if (!updated) {
      // cancelled (or removed) while this chunk was being written
      const current = await Video.getById(id);
      if (!current || !["uploading", "interrupted"].includes(current.state)) {
        await removePart(id);
      }
      return fail(res, 409, "NOT_UPLOADING", "Esta importação já não está a receber dados.", {
        state: current?.state ?? null,
      });
    }

    res.status(200).jsonp({ received: updated.received });
  } finally {
    writing.delete(id);
  }
}));

/**
 * Finish the upload: the import moves to "validating" and the file is checked in the background
 * @body Empty
 * @returns { "video": Video structure }
 */
router.post("/:user/:project/videos/:video/complete", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Importação não encontrada.");

  if (["validating", "available"].includes(video.state)) {
    return res.status(200).jsonp({ video: serialize(video) });
  }

  if (!["uploading", "interrupted"].includes(video.state)) {
    return fail(res, 409, "NOT_UPLOADING", "Esta importação já terminou.", { state: video.state });
  }

  if (video.received !== video.size || writing.has(String(video._id))) {
    return fail(res, 409, "INCOMPLETE", "O ficheiro ainda não foi enviado por completo.", {
      received: video.received,
    });
  }

  const updated = await Video.updateIfState(
    video._id,
    ["uploading", "interrupted"],
    { state: "validating", interrupted_at: null },
    { received: video.size },
  );
  if (!updated) {
    return fail(res, 409, "NOT_UPLOADING", "Esta importação já terminou.");
  }

  validateImport(updated._id).catch((err) =>
    console.error("Error validating video import:", err.message),
  );

  res.status(202).jsonp({ video: serialize(updated) });
}));

/**
 * Resume an interrupted import, when the user picks the same file again
 * @body { "name": String, "size": Number, "fingerprint": String }
 * @returns { "video": Video structure (received = where to continue from), "chunkSize": Number }
 */
router.post("/:user/:project/videos/:video/resume", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Importação não encontrada.");

  if (!["uploading", "interrupted"].includes(video.state)) {
    return fail(res, 410, "NOT_RESUMABLE", "Esta importação já não pode ser retomada.", {
      state: video.state,
    });
  }

  if (
    req.body.name !== video.name ||
    req.body.size !== video.size ||
    req.body.fingerprint !== video.fingerprint
  ) {
    return fail(
      res,
      409,
      "FILE_MISMATCH",
      "O ficheiro selecionado não corresponde ao da importação interrompida. Selecione o mesmo ficheiro.",
    );
  }

  if (writing.has(String(video._id))) {
    return fail(res, 409, "CHUNK_IN_PROGRESS", "Já existe um envio em curso para esta importação.");
  }

  const updated = await Video.updateIfState(video._id, ["uploading", "interrupted"], {
    state: "uploading",
    interrupted_at: null,
    last_chunk_at: new Date(),
  });
  if (!updated) {
    return fail(res, 410, "NOT_RESUMABLE", "Esta importação já não pode ser retomada.");
  }

  res.status(200).jsonp({ video: serialize(updated), chunkSize: CHUNK_SIZE });
}));

/**
 * Tell the server the upload stopped (the client lost the connection and gave up retrying)
 * @body Empty
 * @returns { "video": Video structure }
 */
router.post("/:user/:project/videos/:video/interrupt", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Importação não encontrada.");

  let current = video;
  if (video.state === "uploading" && !writing.has(String(video._id))) {
    current =
      (await Video.updateIfState(video._id, ["uploading"], {
        state: "interrupted",
        interrupted_at: new Date(),
      })) || video;
  }

  res.status(200).jsonp({ video: serialize(current) });
}));

/**
 * Cancel an import that has not finished yet: nothing is kept
 * @body Empty
 * @returns { "video": Video structure }
 */
router.post("/:user/:project/videos/:video/cancel", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Importação não encontrada.");

  const cancelled = await Video.updateIfState(video._id, Video.ACTIVE_STATES, {
    state: "cancelled",
    reason: null,
    interrupted_at: null,
  });
  if (!cancelled) {
    return fail(res, 409, "NOT_ACTIVE", "Esta importação já terminou.", { state: video.state });
  }

  // a validation in progress notices the new state and undoes its own work
  await removePart(video._id);

  res.status(200).jsonp({ video: serialize(cancelled) });
}));

// Delete a video (or the record of an import that failed or was cancelled)
router.delete("/:user/:project/videos/:video", requireOwner, wrap(async (req, res) => {
  const video = await Video.getOne(req.params.user, req.params.project, req.params.video);
  if (!video) return fail(res, 404, "NOT_FOUND", "Vídeo não encontrado.");

  if (Video.ACTIVE_STATES.includes(video.state)) {
    return fail(res, 409, "IMPORT_ACTIVE", "A importação ainda está em curso. Cancele-a primeiro.");
  }

  await removeVideo(video);
  res.sendStatus(204);
}));

module.exports = router;

// Shared with the video tools routes (routes/videoJobs.js, UC-VID-001)
module.exports.helpers = { fail, wrap, requireOwner, loadProfile, withUserLock, premiumHint };
