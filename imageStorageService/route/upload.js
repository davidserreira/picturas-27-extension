const express = require("express");
const multer = require("multer");
const uploadImage = require("../services/uploadImage");
const deleteFile = require("../services/deleteFile");
const { createStreamStorage } = require("../services/streamStorage");
const allowedStages = require("../utils/stages");

const router = express.Router();
// The file is streamed to S3 while it arrives, instead of being read into
// memory first (multer.memoryStorage). See services/streamStorage.js.
const upload = multer({ storage: createStreamStorage({ upload: uploadImage, remove: deleteFile }) });

// The stage is checked before the body is read, so nothing is stored for an
// invalid stage.
function checkStage(req, res, next) {
  if (!allowedStages.includes(req.params.stage)) {
    return res.status(400).json({
      error: "O estágio deve ser src, preview, preview_cache ou out.",
    });
  }
  next();
}

// Storage errors now happen while multer reads the body. They get the same
// 500 { error } answer that the route gave when the upload ran after multer.
function receiveFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (error) return res.status(500).json({ error: error.message });
    next();
  });
}

router.post(
  "/:userId/:projectId/:stage",
  checkStage,
  receiveFile,
  (req, res) => {
    if (!req.file) {
      return res.status(500).json({ error: "No file found" });
    }
    const { imageKey, location } = req.file;
    res
      .status(201)
      .json({ message: "Imagem enviada com sucesso!", data: { imageKey, location } });
  },
);

module.exports = router;
