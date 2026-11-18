// Run state of a project processing (ADR-02, Docs/fase2/adr/). Pure helpers,
// no database access, covered by tests/run-state.test.js.
//
// Progress is measured in processed frames, so that it follows the real work:
// an image counts one frame per image tool of the pipeline, and a video counts
// its own frames (duration x fps, read on upload), processed in a single pass.
// In an image-only project this is the base's "steps done / total steps".
const { imageTools, isVideoMedia } = require("./video");

function videoUnits(img) {
  const v = img.video || {};
  const frames = Math.round((Number(v.duration) || 0) * (Number(v.fps) || 0));
  return Math.max(1, frames);
}

// The media that a run will process, with the work of each one. Images are
// left out when the pipeline has no image tool (the orchestrator skips them).
function runMedia(project) {
  const steps = imageTools(project).length;
  const media = [];
  for (const img of project.imgs || []) {
    if (isVideoMedia(img)) {
      media.push({ img_id: String(img._id), kind: "video", units: videoUnits(img), done: 0, percent: 0 });
    } else if (steps > 0) {
      media.push({ img_id: String(img._id), kind: "image", units: steps, done: 0, percent: 0 });
    }
  }
  return media;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));

// Percentage of the run, with one decimal, rounded down so that it only shows
// 100 when the run is done.
function runProgress(run) {
  if (!run) return 0;
  if (run.status === "done") return 100;
  let total = 0;
  let done = 0;
  for (const m of run.media || []) {
    const units = Math.max(0, Number(m.units) || 0);
    total += units;
    done += m.kind === "video"
      ? (units * clamp(m.percent, 0, 100)) / 100
      : clamp(m.done, 0, units);
  }
  if (total === 0) return 0;
  return Math.min(99.9, Math.floor((done * 1000) / total) / 10);
}

// What the API and the WebSocket event expose about a run.
function runView(run) {
  if (!run) return { status: "idle" };
  return {
    projectId: String(run.project_id),
    projectName: run.project_name || "",
    ownerId: String(run.user_id),
    runnerId: run.runner_id ? String(run.runner_id) : null,
    token: run.token,
    status: run.status,
    progress: runProgress(run),
    startedAt: run.started_at || null,
    finishedAt: run.finished_at || null,
    error: run.error || null,
  };
}

module.exports = { videoUnits, runMedia, runProgress, runView };
