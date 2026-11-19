// Multer storage engine for project media (Phase 2, ADR-01,
// Docs/fase2/adr/ADR-01-carregamento-em-fluxo.md).
//
// The uploaded file is passed on to img_storage while it arrives, instead of
// being read whole into memory first (multer.memoryStorage). On the way its
// bytes are counted and hashed, so the route gets the same size and SHA-256 it
// used to compute from the buffer. req.file carries:
//   size, sha256  - of the bytes received
//   imageKey      - key returned by img_storage (null if the file was not stored)
//
// `store(user, project, stage, form, { signal })` posts a FormData to
// img_storage (utils/imageStorage.post_image); `remove(user, project, stage,
// fileName)` deletes a stored file (delete_image). `accept(file)` decides from
// the name and type whether the file is worth storing: a file the route will
// refuse anyway (wrong media type) is read and dropped instead.
//
// Written with AI assistance (Claude Code) and validated by tests; see Docs/fase2/ia.md.
const crypto = require("crypto");
const path = require("path");
const { Transform } = require("stream");
const FormData = require("form-data");

function createMediaStorage({ store, remove, accept = () => true, stage = "src" }) {
  return {
    _handleFile(req, file, cb) {
      const { user, project } = req.params;
      const hash = crypto.createHash("sha256");
      let size = 0;
      const meter = new Transform({
        transform(chunk, _encoding, next) {
          size += chunk.length;
          hash.update(chunk);
          next(null, chunk);
        },
      });

      let settled = false;
      const controller = new AbortController();
      const finish = (err, info) => {
        if (settled) return;
        settled = true;
        req.removeListener("close", onClose);
        cb(err, info);
      };
      const fail = (err) => {
        controller.abort();
        meter.destroy();
        finish(err);
      };
      function onClose() {
        if (!req.complete) file.stream.destroy(new Error("Upload aborted by the client"));
      }
      file.stream.once("error", fail);
      req.once("close", onClose);

      if (!accept(file)) {
        meter.on("finish", () => finish(null, { size, sha256: hash.digest("hex"), imageKey: null }));
        meter.resume();
        file.stream.pipe(meter);
        return;
      }

      const form = new FormData();
      form.append("file", meter, { filename: file.originalname, contentType: file.mimetype });
      file.stream.pipe(meter);
      store(user, project, stage, form, { signal: controller.signal }).then(
        (resp) => finish(null, { size, sha256: hash.digest("hex"), imageKey: resp.data.data.imageKey }),
        (err) => {
          // Marked so the route can answer as it did when storing failed after the upload.
          err.storageError = true;
          fail(err);
        },
      );
    },

    // Called by multer when the request fails after this file was stored.
    _removeFile(req, file, cb) {
      if (!file.imageKey) return cb(null);
      remove(req.params.user, req.params.project, stage, path.basename(file.imageKey)).then(() => cb(null), cb);
    },
  };
}

module.exports = { createMediaStorage };
