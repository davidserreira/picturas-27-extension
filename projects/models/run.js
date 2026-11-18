const mongoose = require("mongoose");

// One processing run of a project (RNF-F2-02). The orchestrator owns this
// state, so any page or session of the user can ask how a run is going.
const runSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // project owner
    project_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    project_name: { type: String, default: "" },
    runner_id: { type: String, default: null }, // who pressed Apply (owner or share editor)
    token: { type: Number, required: true }, // the project's activeToken for this run
    state: {
      type: String,
      enum: ["running", "completed", "cancelled", "failed"],
      default: "running",
    },
    // Work units: one per (image, image tool) step, and per video a weight
    // proportional to its duration, scaled by the worker's percentage.
    units_total: { type: Number, default: 1 },
    units_done: { type: Number, default: 0 },
    video_weights: { type: mongoose.Schema.Types.Mixed, default: {} },
    video_percent: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    finished_at: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

runSchema.index({ project_id: 1, token: 1 }, { unique: true });
runSchema.index({ user_id: 1, state: 1 });

module.exports = mongoose.model("run", runSchema);
