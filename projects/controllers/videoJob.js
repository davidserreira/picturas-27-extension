const VideoJob = require("../models/videoJob");

const ACTIVE_STATES = ["queued", "processing"];
const FINAL_STATES = ["completed", "failed", "cancelled"];

module.exports.ACTIVE_STATES = ACTIVE_STATES;
module.exports.FINAL_STATES = FINAL_STATES;

module.exports.create = async (job) => VideoJob.create(job);

module.exports.getById = async (job_id) => VideoJob.findById(job_id).exec();

module.exports.getOne = async (user_id, project_id, job_id) =>
  VideoJob.findOne({ _id: job_id, user_id, project_id }).exec();

module.exports.getAll = async (user_id, project_id) =>
  VideoJob.find({ user_id, project_id }).sort({ _id: -1 }).limit(50).exec();

// Active jobs of a user across all projects and video tools (RN5)
module.exports.countActive = async (user_id) =>
  VideoJob.countDocuments({ user_id, state: { $in: ACTIVE_STATES } }).exec();

// Applies `update` only while the job is in one of `states`, so concurrent
// transitions (e.g. cancel vs. completion) never overwrite each other.
module.exports.updateIfState = async (job_id, states, update) =>
  VideoJob.findOneAndUpdate(
    { _id: job_id, state: { $in: states } },
    update,
    { new: true },
  ).exec();

// Active jobs of a project: their results will soon be videos of the library
module.exports.getActiveByProject = async (user_id, project_id) =>
  VideoJob.find({ user_id, project_id, state: { $in: ACTIVE_STATES } }).exec();

module.exports.findStale = async (olderThan) =>
  VideoJob.find({ state: { $in: ACTIVE_STATES }, updatedAt: { $lt: olderThan } }).exec();

module.exports.findRefundPending = async () =>
  VideoJob.find({ state: { $in: ["failed", "cancelled"] }, quota_reserved: true,
    quota_refunded: { $ne: true } }).exec();

module.exports.deleteByProject = async (user_id, project_id) =>
  VideoJob.deleteMany({ user_id, project_id }).exec();
