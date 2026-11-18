// Run state of a project processing (ADR-02, Docs/fase2/adr/).
// Every update only touches a run that is still "running" with the same token,
// so a late message (a worker reply after a cancel, a progress report after the
// commit) can never move a run backwards or reopen it.
var Run = require("../models/run");

module.exports.create = async (run) => {
  return await Run.create(run);
};

// The latest run of a project (the one with the highest token)
module.exports.latest = async (user_id, project_id) => {
  return await Run.findOne({ user_id, project_id }).sort({ token: -1 }).exec();
};

// Runs in progress on the user's projects, or started by the user on a shared one
module.exports.active = async (user_id) => {
  return await Run.find({ status: "running", $or: [{ user_id }, { runner_id: String(user_id) }] })
    .sort({ started_at: 1 })
    .exec();
};

// One image step finished
module.exports.imageStep = async (project_id, token, img_id) => {
  return await Run.findOneAndUpdate(
    { project_id, token, status: "running", "media.img_id": String(img_id) },
    { $inc: { "media.$.done": 1 } },
    { new: true },
  ).exec();
};

// Progress of a video, as reported by the worker (never goes back)
module.exports.videoPercent = async (project_id, token, img_id, percent) => {
  return await Run.findOneAndUpdate(
    { project_id, token, status: "running", "media.img_id": String(img_id) },
    { $max: { "media.$.percent": Math.min(100, Math.max(0, Number(percent) || 0)) } },
    { new: true },
  ).exec();
};

// Closes a run as done or failed
module.exports.finish = async (project_id, token, status, error = null) => {
  return await Run.findOneAndUpdate(
    { project_id, token, status: "running" },
    { $set: { status, error, finished_at: new Date() } },
    { new: true },
  ).exec();
};

// Cancel closes every run of the project that is still open and returns them
module.exports.cancelOpen = async (project_id) => {
  const open = await Run.find({ project_id, status: "running" }).exec();
  const finished = [];
  for (const run of open) {
    const closed = await module.exports.finish(project_id, run.token, "cancelled");
    if (closed) finished.push(closed);
  }
  return finished;
};

module.exports.deleteProject = async (project_id) => {
  return await Run.deleteMany({ project_id }).exec();
};
