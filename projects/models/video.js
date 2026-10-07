const mongoose = require("mongoose");

// A video of a project's library. The same document tracks the import request
// (uploading -> validating -> available) and, once available, the stored video.
const videoSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    project_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true }, // bytes, as declared when the import was created
    received: { type: Number, default: 0 }, // bytes already stored in the partial file
    fingerprint: { type: String, required: true }, // identifies the file when resuming
    state: {
      type: String,
      enum: ["uploading", "validating", "available", "interrupted", "failed", "cancelled"],
      default: "uploading",
      index: true,
    },
    reason: { type: String, default: null }, // why it failed, shown to the user
    max_duration: { type: Number, required: true }, // seconds, profile limit at import time

    last_chunk_at: { type: Date, default: Date.now },
    interrupted_at: { type: Date, default: null },

    // filled in once the video is validated and stored
    video_key: { type: String, default: null },
    format: { type: String, default: null },
    codec: { type: String, default: null },
    duration: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    sha256: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("video", videoSchema);
