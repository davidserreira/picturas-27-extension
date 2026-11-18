const Run = require("../models/run");

module.exports.create = async (run) => Run.create(run);

// Latest run of a project (the current one, or the last that ended).
module.exports.getLatest = async (user_id, project_id) =>
  Run.findOne({ user_id, project_id }).sort({ token: -1 }).exec();

// Runs of a user still being processed, plus the ones that ended in the
// last `recentMs` (so a page opened just after the end can still say so).
module.exports.getActiveByUser = async (user_id, recentMs = 0) => {
  const or = [{ state: "running" }];
  if (recentMs > 0) or.push({ finished_at: { $gte: new Date(Date.now() - recentMs) } });
  return Run.find({ user_id, $or: or }).sort({ createdAt: -1 }).exec();
};

// One more image step of a running run.
module.exports.addImageStep = async (project_id, token) =>
  Run.findOneAndUpdate(
    { project_id, token, state: "running" },
    { $inc: { units_done: 1 } },
    { new: true },
  ).exec();

// Percentage of one video of a running run (never goes back).
module.exports.setVideoPercent = async (project_id, token, img_id, percent) =>
  Run.findOneAndUpdate(
    { project_id, token, state: "running" },
    { $max: { [`video_percent.${img_id}`]: Number(percent) || 0 } },
    { new: true },
  ).exec();

// Ends a running run; a run that already ended keeps its state.
module.exports.finish = async (project_id, token, state, error = null) =>
  Run.findOneAndUpdate(
    { project_id, token, state: "running" },
    { $set: { state, error, finished_at: new Date() } },
    { new: true },
  ).exec();

module.exports.deleteByProject = async (project_id) => Run.deleteMany({ project_id }).exec();
