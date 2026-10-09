var Video = require("../models/video");

// States in which an import still holds (or is about to hold) a partial file.
const ACTIVE_STATES = ["uploading", "validating", "interrupted"];
// States that take up space in the user's video library.
const STORED_STATES = [...ACTIVE_STATES, "available"];

module.exports.ACTIVE_STATES = ACTIVE_STATES;

module.exports.getAll = async (user_id, project_id) => {
  return await Video.find({ user_id: user_id, project_id: project_id })
    .sort({ _id: 1 })
    .exec();
};

module.exports.getOne = async (user_id, project_id, video_id) => {
  return await Video.findOne({
    user_id: user_id,
    project_id: project_id,
    _id: video_id,
  }).exec();
};

module.exports.getById = async (video_id) => {
  return await Video.findById(video_id).exec();
};

module.exports.getByState = async (state, filter = {}) => {
  return await Video.find({ ...filter, state: state }).exec();
};

module.exports.create = async (video) => {
  return await Video.create(video);
};

module.exports.getByFingerprint = async (user_id, project_id, fingerprint) =>
  Video.findOne({ user_id, project_id, fingerprint }).exec();

module.exports.delete = (video_id) => {
  return Video.deleteOne({ _id: video_id });
};

// Applies `update` only while the video is still in one of `states`, so a
// concurrent cancel/expiry is never overwritten. Returns the updated document or null.
module.exports.updateIfState = async (video_id, states, update, filter = {}) => {
  return await Video.findOneAndUpdate(
    { ...filter, _id: video_id, state: { $in: states } },
    update,
    { new: true },
  ).exec();
};

module.exports.updateManyByState = async (state, filter, update) => {
  return await Video.updateMany({ ...filter, state: state }, update).exec();
};

module.exports.countActive = async (user_id) => {
  return await Video.countDocuments({
    user_id: user_id,
    state: { $in: ACTIVE_STATES },
  }).exec();
};

// Bytes of the user's video library in use, across all projects. Imports in
// progress count with their full size, so the space is reserved for them.
module.exports.usedStorage = async (user_id) => {
  const videos = await Video.find(
    { user_id: user_id, state: { $in: STORED_STATES } },
    { size: 1 },
  ).exec();

  return videos.reduce((total, v) => total + v.size, 0);
};
