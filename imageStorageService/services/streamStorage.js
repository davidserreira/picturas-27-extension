const path = require("path");

// Multer storage engine that hands each uploaded file to `upload` as a stream,
// so the file goes to S3 while it is still arriving and is never held whole in
// memory (Phase 2, ADR-01, Docs/fase2/adr/ADR-01-carregamento-em-fluxo.md).
//
// `upload(userId, projectId, file, stage, { onStart })` reads `file.stream` and
// resolves to { imageKey, location }; it calls onStart with an object that has
// abort(). `remove(userId, projectId, stage, fileName)` deletes a stored file.
// Both are injected so the engine can be tested without S3.
//
// If the client goes away before the end of the body, the file stream is
// destroyed and the S3 upload aborted, so no incomplete object or open
// multipart upload is left behind.
//
// Written with AI assistance (Claude Code) and validated by tests; see Docs/fase2/ia.md.
function createStreamStorage({ upload, remove }) {
  return {
    _handleFile(req, file, cb) {
      const { userId, projectId, stage } = req.params;
      let current = null;
      let settled = false;

      const finish = (err, info) => {
        if (settled) return;
        settled = true;
        req.removeListener("close", onClose);
        cb(err, info);
      };
      const fail = (err) => {
        if (current) current.abort();
        finish(err);
      };
      function onClose() {
        if (!req.complete) file.stream.destroy(new Error("Upload aborted by the client"));
      }

      file.stream.once("error", fail);
      req.once("close", onClose);

      upload(userId, projectId, file, stage, {
        onStart: (u) => {
          current = u;
          if (settled) u.abort();
        },
      }).then((info) => finish(null, info), fail);
    },

    // Called by multer when the request fails after this file was stored.
    _removeFile(req, file, cb) {
      const { userId, projectId, stage } = req.params;
      remove(userId, projectId, stage, path.basename(file.imageKey)).then(() => cb(null), cb);
    },
  };
}

module.exports = { createStreamStorage };
