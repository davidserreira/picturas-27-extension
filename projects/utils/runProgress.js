// Pure helpers for the progress of a processing run (RNF-F2-02).

// Work units of a run, from the jobs that were actually dispatched:
// - an image counts one unit per image tool it goes through;
// - a video counts its duration in seconds (at least 1), because the video
//   worker takes roughly that long and reports its own percentage.
function runUnits(jobs, imageToolCount) {
  let imageUnits = 0;
  const videoWeights = {};
  for (const job of jobs) {
    if (job.isVideo) {
      videoWeights[String(job.imgId)] = Math.max(1, Math.round(Number(job.duration) || 0));
    } else {
      imageUnits += imageToolCount;
    }
  }
  const videoUnits = Object.values(videoWeights).reduce((a, b) => a + b, 0);
  return { units_total: Math.max(1, imageUnits + videoUnits), video_weights: videoWeights };
}

// Overall percentage (0-100, one decimal place) of a run. The decimal place
// lets every 1 % reported by the video worker change the value shown, even
// when the video is only part of the run (C2.2).
function runPercent(run) {
  if (!run) return 0;
  if (run.state === "completed") return 100;
  const weights = run.video_weights || {};
  const percents = run.video_percent || {};
  let done = Number(run.units_done) || 0;
  for (const [imgId, weight] of Object.entries(weights)) {
    const pct = Math.min(100, Math.max(0, Number(percents[imgId]) || 0));
    done += (weight * pct) / 100;
  }
  const total = Math.max(1, Number(run.units_total) || 1);
  return Math.min(99.9, Math.floor((done * 1000) / total) / 10);
}

// What the API and the WebSocket send to the browser.
function serializeRun(run) {
  if (!run) return null;
  return {
    projectId: String(run.project_id),
    projectName: run.project_name || "",
    ownerId: String(run.user_id),
    runnerId: run.runner_id ? String(run.runner_id) : null,
    token: run.token,
    state: run.state,
    percent: runPercent(run),
    error: run.error || null,
    startedAt: run.createdAt || null,
    updatedAt: run.updatedAt || null,
    finishedAt: run.finished_at || null,
  };
}

module.exports = { runUnits, runPercent, serializeRun };
