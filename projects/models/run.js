const mongoose = require("mongoose");

// State of one processing run of a project (ADR-02, Docs/fase2/adr/). The
// orchestrator owns it: it is created when the run opens, updated as image
// steps and video progress arrive, and closed on commit, error or cancel. The
// UI rebuilds the run from here after a reload or in another session.
const runMediaSchema = new mongoose.Schema(
  {
    img_id: { type: String, required: true },
    kind: { type: String, enum: ["image", "video"], required: true },
    units: { type: Number, required: true }, // total work, in processed frames
    done: { type: Number, default: 0 }, // images: image steps finished
    percent: { type: Number, default: 0 }, // videos: last percentage reported by the worker
  },
  { _id: false },
);

const runSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // project owner
    project_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    project_name: { type: String, default: "" },
    runner_id: { type: String, default: null }, // who started it (owner or shared editor)
    token: { type: Number, required: true }, // the project's activeToken for this run
    status: {
      type: String,
      enum: ["running", "done", "failed", "cancelled"],
      default: "running",
    },
    media: { type: [runMediaSchema], default: [] },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
    started_at: { type: Date, default: Date.now },
    finished_at: { type: Date, default: null },
  },
  { timestamps: true },
);

runSchema.index({ project_id: 1, token: 1 }, { unique: true });
runSchema.index({ user_id: 1, status: 1 });
runSchema.index({ runner_id: 1, status: 1 });

module.exports = mongoose.model("run", runSchema);
