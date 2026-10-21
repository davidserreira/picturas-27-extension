// Unique video names inside a project (UC-VID-002/RN12, UC-VID-001/RN7, v1.5):
// "praia.mp4" stays "praia.mp4" if no other video of the project has that
// name; otherwise it becomes "praia (2).mp4", "praia (3).mp4", ...

const path = require("path");
const Video = require("../controllers/video");
const VideoJob = require("../controllers/videoJob");

function uniqueName(name, usedNames) {
  const used = new Set([...usedNames].map((n) => String(n).toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  const ext = path.extname(name);
  // "praia (2).mp4" taken again -> continue from "praia", not "praia (2) (2)"
  const stem = path.basename(name, ext).replace(/ \(\d+\)$/, "");
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

// Names already taken in a project: its videos (in any state, as they are all
// shown in the library) and the copies that running requests will create.
async function namesInUse(userId, projectId) {
  const videos = await Video.getAll(userId, projectId);
  const running = await VideoJob.getActiveByProject(userId, projectId);
  return [
    ...videos.map((v) => v.name),
    ...running.filter((j) => j.params?.keep_original).map((j) => j.result_name),
  ];
}

module.exports = { uniqueName, namesInUse };
