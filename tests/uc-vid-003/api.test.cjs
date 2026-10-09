// HTTP and lifecycle tests with in-memory service adapters (no live containers).
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const requireProjects = createRequire(path.join(root, "projects/package.json"));
const express = requireProjects("express");
const axios = requireProjects("axios");
const Video = requireProjects("./controllers/video");
const Job = requireProjects("./controllers/videoJob");
const Project = requireProjects("./controllers/project");
const storage = requireProjects("./utils/imageStorage");
const broker = requireProjects("./utils/videoBroker");
const { applyLimitsFor, validateTools } = requireProjects("./utils/videoApply");
const { withUserLock } = requireProjects("./utils/videoLocks");
const USER = "100000000000000000000001";
const PROJECT = "200000000000000000000001";
const SOURCE = "300000000000000000000001";
let profile, videos, jobs, operations, publications, deletes, refunds, publishFailed, createFailed, hasProject, refundFailed;
let server, base;

function reset() {
  profile = "free"; operations = 0; jobs = []; publications = []; deletes = []; refunds = new Set();
  publishFailed = createFailed = refundFailed = false; hasProject = true;
  videos = [{ _id: SOURCE, user_id: USER, project_id: PROJECT, name: "praia.mp4", state: "available",
    format: "mp4", codec: "h264", width: 96, height: 64, duration: 120, size: 10, video_key: "source.mp4" }];
}

Project.getOne = async () => hasProject ? { _id: PROJECT, user_id: USER } : null;
Video.getAll = async () => videos;
Video.getOne = async (user, project, id) => videos.find((video) => String(video._id) === id);
Video.getByFingerprint = async (_, __, key) => videos.find((video) => video.fingerprint === key);
Video.usedStorage = async () => videos.reduce((total, video) => total + video.size, 0);
Video.create = async (video) => { const result = { ...video, _id: `40000000000000000000000${videos.length}` }; videos.push(result); return result; };
Video.delete = async (id) => { videos = videos.filter((video) => String(video._id) !== String(id)); };
Job.getById = async (id) => jobs.find((job) => String(job._id) === String(id));
Job.getOne = async (user, project, id) => jobs.find((job) => String(job._id) === String(id) && job.user_id === user && job.project_id === project);
Job.getAll = async () => [...jobs].reverse();
Job.countActive = async () => jobs.filter((job) => Job.ACTIVE_STATES.includes(job.state)).length;
Job.getActiveByProject = async () => jobs.filter((job) => Job.ACTIVE_STATES.includes(job.state));
Job.findStale = async () => [];
Job.findRefundPending = async () => jobs.filter((job) => ["cancelled", "failed"].includes(job.state) && job.quota_reserved && !job.quota_refunded);
Job.create = async (fields) => {
  if (createFailed) throw new Error("Injected database failure");
  const job = { state: "queued", progress: 0, frames_processed: 0, frame_count: null,
    quota_refunded: false, save: async () => {}, ...fields };
  jobs.push(job); return job;
};
Job.updateIfState = async (id, states, update) => {
  const job = await Job.getById(id);
  if (!job || !states.includes(job.state)) return null;
  if (update.$set) Object.assign(job, update.$set);
  if (update.$max) for (const [key, value] of Object.entries(update.$max)) job[key] = Math.max(job[key] || 0, value);
  if (!Object.keys(update).some((key) => key.startsWith("$"))) Object.assign(job, update);
  return job;
};
axios.get = async (url) => {
  if (url.endsWith("/type")) return { data: { type: profile } };
  if (url.endsWith("/process/1")) {
    if (operations >= 5) throw { response: { data: "No more daily_operations available" } };
    operations++; return { data: true };
  }
  throw new Error(`Unexpected request ${url}`);
};
axios.post = async (_, body) => {
  if (refundFailed) throw new Error("Injected users outage");
  assert.match(body.jobId, /^[a-f0-9]{24}$/);
  assert.match(body.day, /^\d{4}-\d{2}-\d{2}$/);
  if (!refunds.has(body.jobId)) { refunds.add(body.jobId); operations--; }
  return { data: true };
};
storage.get_image_internal_url = async () => ({ data: { url: "http://storage/source.mp4" } });
storage.delete_image = async (...args) => deletes.push(args);
broker.publish = async (queue, message) => {
  if (publishFailed && queue !== "ws_queue") throw new Error("Injected broker outage");
  publications.push({ queue, message });
};
const lifecycle = requireProjects("./utils/videoJobs");
const router = requireProjects("./routes/videoJobs");

before(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/${USER}/${PROJECT}`;
});
beforeEach(reset);
after(async () => { await new Promise((resolve) => server.close(resolve)); });

async function post(suffix, body = {}, owner = USER) {
  const response = await fetch(base + suffix, { method: "POST", headers: { "Content-Type": "application/json", "X-Caller-Id": owner }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const tools = [{ type: "resize", width: 80, height: 48 }, { type: "binarization", threshold: 128 }, { type: "rotate", degrees: 90 }];
const apply = (chain = tools) => post(`/videos/${SOURCE}/apply`, { tools: chain });
const success = (job, extra = {}) => lifecycle._test.onSuccess({ jobId: job._id, output: {
  fileName: `${job._id}.mp4`, format: "mp4", codec: "h264", size: 20, duration: 120,
  width: job.params.width, height: job.params.height, frame_count: 3600, fps: 30, ...extra,
} });

test("a three-tool chain queues one operation and preserves order in the worker request", async () => {
  const result = await apply();
  assert.equal(result.status, 202);
  assert.equal(result.body.job.state, "queued");
  assert.equal(result.body.job.result_name, "praia_editado.mp4");
  assert.equal(operations, 1);
  const request = publications.find((item) => item.queue === "video_apply_queue").message;
  assert.deepEqual(request.parameters.tools, tools);
  assert.equal(request.parameters.maxDuration, 120);
  assert.equal(request.parameters.width, 48);
  assert.equal(request.parameters.height, 80);
});

test("parameter boundaries, unsupported tools and the fourth tool are rejected before quota", async (t) => {
  for (const chain of [[], tools.concat({ type: "rotate", degrees: 90 }), [{ type: "ocr" }],
    [{ type: "resize", width: 15, height: 16 }], [{ type: "resize", width: 3841, height: 16 }],
    [{ type: "resize", width: "80", height: 16 }], [{ type: "resize", width: 16.5, height: 16 }],
    [{ type: "binarization", threshold: -1 }], [{ type: "binarization", threshold: 256 }],
    [{ type: "binarization", threshold: null }], [{ type: "rotate", degrees: 45 }]]) {
    await t.test(JSON.stringify(chain), async () => {
      const response = await apply(chain); assert.equal(response.status, 400); assert.equal(operations, 0);
    });
  }
});

test("zero and 255 thresholds, and 16 px dimensions, are accepted", async () => {
  for (const threshold of [0, 255]) {
    reset();
    assert.equal((await apply([{ type: "binarization", threshold }, { type: "resize", width: 16, height: 16 }])).status, 202);
  }
});

test("final resolution uses chain order and the current profile", async () => {
  assert.equal((await apply([{ type: "resize", width: 2560, height: 1440 }])).status, 400);
  profile = "premium";
  assert.equal((await apply([{ type: "resize", width: 3840, height: 2160 }])).status, 202);
  reset();
  const ordered = [{ type: "resize", width: 1080, height: 1920 }, { type: "rotate", degrees: 90 }];
  assert.equal((await apply(ordered)).status, 202);
  await post(`/video-jobs/${jobs[0]._id}/cancel`);
  assert.equal((await apply([...ordered].reverse())).status, 400);
});

test("APPLY duration and file-size limits are exact for free and premium", async () => {
  for (const type of ["free", "premium"]) {
    for (const field of ["duration", "size"]) {
      reset(); profile = type;
      const limit = applyLimitsFor(type)[field === "duration" ? "maxDuration" : "maxSize"];
      videos[0][field] = limit + (field === "duration" ? 0.01 : 1);
      assert.equal((await apply()).status, 413);
      assert.equal(operations, 0);
      videos[0][field] = limit;
      assert.equal((await apply()).status, 202);
    }
  }
});

test("the anonymous profile and another owner cannot create jobs", async () => {
  profile = "anonymous";
  assert.equal((await apply()).status, 403);
  profile = "free";
  assert.equal((await post(`/videos/${SOURCE}/apply`, { tools }, "another-user")).status, 403);
  assert.equal(jobs.length, 0); assert.equal(operations, 0);
});

test("only available MP4 H.264 or MOV videos can be processed", async () => {
  videos[0].format = "avi"; assert.equal((await apply()).status, 415);
  videos[0].format = "mp4"; videos[0].codec = "mpeg4"; assert.equal((await apply()).status, 415);
  videos[0].format = "mov"; assert.equal((await apply()).status, 202);
  reset(); videos[0].state = "validating"; assert.equal((await apply()).status, 409);
});

test("TRIM and APPLY share the active-job limit", async () => {
  assert.equal((await post(`/videos/${SOURCE}/trim`, { start: 0, end: 10 })).status, 202);
  assert.equal((await apply()).body.code, "TOO_MANY_JOBS");
  reset(); profile = "premium";
  assert.equal((await apply()).status, 202); assert.equal((await apply()).status, 202);
  assert.equal((await post(`/videos/${SOURCE}/trim`, { start: 0, end: 10 })).status, 202);
  assert.equal((await apply()).status, 429);
  assert.equal(operations, 0);
});

test("parallel submissions cannot both pass the free active-job check", async () => {
  const responses = await Promise.all([apply(), apply()]);
  assert.deepEqual(responses.map((result) => result.status).sort(), [202, 429]);
  assert.equal(operations, 1);
});

test("the fifth used daily operation blocks a new APPLY job", async () => {
  operations = 5;
  const result = await apply();
  assert.equal(result.status, 429); assert.equal(result.body.code, "QUOTA_EXCEEDED");
  assert.match(result.body.message, /Premium/); assert.equal(jobs.length, 0);
});

test("collision-free edited names also consider queued result names", async () => {
  profile = "premium";
  videos.push({ ...videos[0], _id: "another", name: "PRAIA_EDITADO.MP4" });
  assert.equal((await apply()).body.job.result_name, "praia_editado_2.mp4");
  assert.equal((await apply()).body.job.result_name, "praia_editado_3.mp4");
});

test("progress and frame counts are monotonic; completion publishes one new video", async () => {
  await apply(); const job = jobs[0];
  await lifecycle._test.onProgress({ jobId: job._id, progress: 50, framesProcessed: 1800, frameCount: 3600 });
  await lifecycle._test.onProgress({ jobId: job._id, progress: 20, framesProcessed: 720, frameCount: 3600 });
  assert.equal(job.progress, 50); assert.equal(job.frames_processed, 1800);
  await success(job);
  assert.equal(job.state, "completed"); assert.equal(job.progress, 100);
  assert.equal(job.frames_processed, 3600); assert.equal(videos.length, 2);
  assert.equal(videos[0].name, "praia.mp4"); assert.equal(videos[1].name, "praia_editado.mp4");
  assert.equal(operations, 1);
});

test("a repeated success neither duplicates nor deletes a completed result", async () => {
  await apply(); const job = jobs[0]; await success(job); await success(job);
  assert.equal(videos.length, 2); assert.equal(deletes.length, 0); assert.equal(operations, 1);
});

test("cancel queued/processing jobs, refund once, and remove a late result", async () => {
  for (const state of ["queued", "processing"]) {
    reset(); await apply(); const job = jobs[0]; job.state = state;
    assert.equal((await post(`/video-jobs/${job._id}/cancel`)).status, 200);
    assert.equal(job.state, "cancelled"); assert.equal(operations, 0);
    assert.equal((await post(`/video-jobs/${job._id}/cancel`)).status, 409);
    await success(job); assert.equal(videos.length, 1); assert.equal(deletes.length, 1);
  }
});

test("a worker failure uses the required message and refunds the entire chain", async () => {
  await apply(); const job = jobs[0];
  await lifecycle._test.onReply({ content: Buffer.from(JSON.stringify({ jobId: String(job._id), type: "error", error: { code: "FRAME_FAILED", message: "internal path" } })) });
  assert.equal(job.state, "failed"); assert.equal(job.error.message, lifecycle.failedMessage("apply"));
  assert.equal(operations, 0); assert.equal(videos.length, 1);
});

test("actual encoded size is checked again before publication", async () => {
  await apply(); const job = jobs[0]; await success(job, { size: job.max_storage });
  assert.equal(job.state, "failed"); assert.equal(job.error.code, "STORAGE_FULL");
  assert.equal(videos.length, 1); assert.equal(deletes.length, 1); assert.equal(operations, 0);
});

test("a deleted project cannot receive an orphan result", async () => {
  await apply(); const job = jobs[0]; hasProject = false; await success(job);
  assert.equal(job.state, "failed"); assert.equal(videos.length, 1); assert.equal(operations, 0);
});

test("broker publication failure refunds quota and returns a service error", async () => {
  publishFailed = true; const result = await apply();
  assert.equal(result.status, 503); assert.equal(jobs[0].state, "failed"); assert.equal(operations, 0);
});

test("job creation failure compensates the quota reservation", async () => {
  createFailed = true; assert.equal((await apply()).status, 500);
  assert.equal(operations, 0); assert.equal(jobs.length, 0);
});

test("a temporary refund outage is retried without consuming a cancelled operation", async () => {
  await apply(); const job = jobs[0]; refundFailed = true;
  await post(`/video-jobs/${job._id}/cancel`); assert.equal(job.quota_refunded, false);
  refundFailed = false; await lifecycle._test.maintainJobs(); await lifecycle._test.maintainJobs();
  assert.equal(operations, 0); assert.equal(job.quota_refunded, true); assert.equal(refunds.size, 1);
});

test("a crash between video insertion and job completion recovers the same result", async () => {
  await apply(); const job = jobs[0];
  videos.push({ _id: "recovered", fingerprint: `apply:${job._id}`, name: job.result_name, size: 20 });
  await success(job); assert.equal(videos.length, 2); assert.equal(job.result_video_id, "recovered");
});

test("the shared user lock keeps independent users concurrent and releases after failure", async () => {
  let release;
  const first = withUserLock("a", () => new Promise((resolve) => { release = resolve; }));
  await withUserLock("b", async () => {});
  release(); await first;
  await assert.rejects(withUserLock("a", async () => { throw Error("test"); }));
  await withUserLock("a", async () => {});
});

test("frontend and API agree on parameter boundaries and final resolution", () => {
  const requireFrontend = createRequire(path.join(root, "frontend/package.json"));
  const ts = requireFrontend("typescript");
  const text = fs.readFileSync(path.join(root, "frontend/lib/video-apply.ts"), "utf8");
  const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const frontend = {}; new Function("exports", output)(frontend);
  for (const type of ["free", "premium"]) {
    for (const chain of [tools, [{ type: "resize", width: 2560, height: 1440 }],
      [{ type: "resize", width: 16, height: 16 }], [{ type: "resize", width: 3841, height: 16 }],
      [{ type: "binarization", threshold: 0 }], [{ type: "binarization", threshold: 256 }],
      [{ type: "rotate", degrees: 45 }], []]) {
      const api = validateTools(chain, 96, 64, applyLimitsFor(type));
      assert.equal(!!frontend.applyToolsError(videos[0], chain, type), !!api.error);
    }
  }
});
