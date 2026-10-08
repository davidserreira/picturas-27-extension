const mongoose = require("mongoose");

// A processing request on a video of the library (UC-VID-001: trim).
// Generic on purpose: other video tools (e.g. UC-VID-003) can reuse it with
// another `tool` and their own `params`.
const videoJobSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    project_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    video_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // source video
    tool: { type: String, enum: ["trim"], required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} }, // trim: { start, end } (s)

    // Em fila -> Em processamento -> Concluído | Falhado | Cancelado
    state: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    progress: { type: Number, default: 0 }, // 0-100
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },

    // name the result will get in the library ("{nome}_recorte.ext")
    result_name: { type: String, required: true },
    result_video_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    // profile duration limit, copied to the resulting video
    max_duration: { type: Number, required: true },

    // 1 daily operation reserved at submission (registered profile only);
    // refunded if the job does not end "completed" (RN4, REQ-018/020)
    quota_reserved: { type: Boolean, default: false },

    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("videoJob", videoJobSchema);
