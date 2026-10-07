const express = require("express");
const uploadVideo = require("../services/uploadVideo");

const router = express.Router();

/**
 * PUT /video/:userId/:projectId/:fileName
 * The request body is the raw file. Stored under the "video" stage, so the
 * /image and /delete routes work on it like on any other stage.
 */
router.put("/:userId/:projectId/:fileName", async (req, res) => {
  const { userId, projectId, fileName } = req.params;

  try {
    const result = await uploadVideo(
      userId,
      projectId,
      fileName,
      req,
      req.headers["content-type"],
    );
    res.status(201).json({ message: "Vídeo enviado com sucesso!", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
