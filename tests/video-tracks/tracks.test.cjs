// Audio and video tracks of a library video (REQ-VID-LIB-003 to 008), with
// ffprobe, ffmpeg, storage and database replaced in memory (no live containers).
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const childProcess = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const requireProjects = createRequire(path.join(root, "projects/package.json"));
const express = requireProjects("express");
const Video = requireProjects("./controllers/video");
const storage = requireProjects("./utils/imageStorage");
const probe = requireProjects("./utils/videoProbe");
const USER = "100000000000000000000001";
const PROJECT = "200000000000000000000001";
const VIDEO = "300000000000000000000001";
let videos, probes, streams, pcm, ffmpegFails, probeFails, server, base;

const VIDEO_STREAM = { index: 0, codec_type: "video", codec_name: "h264", width: 1280, height: 720,
  avg_frame_rate: "30000/1001", duration: "60.000000", bit_rate: "5000000" };
const AUDIO_STREAM = { index: 1, codec_type: "audio", codec_name: "aac", channels: 2,
  channel_layout: "stereo", sample_rate: "48000", duration: "60.000000", tags: { language: "und" } };

function reset() {
  probes = 0; ffmpegFails = probeFails = false;
  streams = [VIDEO_STREAM, AUDIO_STREAM];
  // 1 s of mono samples at 4 kHz: quiet, then a loud peak in the middle
  pcm = Buffer.alloc(4000 * 2);
  for (let i = 0; i < 4000; i++) pcm.writeInt16LE(i === 2000 ? -32768 : 1000, i * 2);
  videos = [{ _id: VIDEO, user_id: USER, project_id: PROJECT, name: "praia.mp4", state: "available",
    duration: 60, video_key: "praia.mp4", tracks: null, waveform_state: null }];
}

// Replaced before videoTracks.js is loaded, which keeps references to them.
probe.ffprobe = async () => {
  if (probeFails) throw new Error("unreadable");
  probes++; return { streams };
};
storage.get_image_internal_url = async () => ({ data: { url: "http://storage/praia.mp4" } });
childProcess.spawn = () => {
  const ffmpeg = new EventEmitter();
  ffmpeg.stdout = new PassThrough(); ffmpeg.stderr = new PassThrough(); ffmpeg.kill = () => {};
  setImmediate(() => {
    if (ffmpegFails) return ffmpeg.emit("close", 1);
    // odd-sized chunks: a sample split between two chunks must still be read
    ffmpeg.stdout.write(pcm.subarray(0, 4001)); ffmpeg.stdout.write(pcm.subarray(4001));
    ffmpeg.stdout.end(); ffmpeg.stdout.on("end", () => ffmpeg.emit("close", 0)); ffmpeg.stdout.resume();
  });
  return ffmpeg;
};
Video.getOne = async (user, project, id) => videos.find((v) => String(v._id) === id && v.user_id === user);
Video.updateIfState = async (id, states, update) => {
  const video = videos.find((v) => String(v._id) === String(id));
  if (!video || !states.includes(video.state)) return null;
  return Object.assign(video, update);
};
const { toTracks, toPeaks } = requireProjects("./utils/videoTracks");
const router = requireProjects("./routes/videos");

before(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/${USER}/${PROJECT}/videos`;
});
beforeEach(reset);
after(async () => { await new Promise((resolve) => server.close(resolve)); });

async function getTracks(owner = USER, id = VIDEO) {
  const response = await fetch(`${base}/${id}/tracks`, { headers: { "X-Caller-Id": owner } });
  return { status: response.status, body: await response.json() };
}
async function waitForWaveform() {
  for (let i = 0; i < 50 && videos[0].waveform_state === "analyzing"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("tracks are numbered by type; cover images, subtitles and unknown languages are left out", () => {
  const tracks = toTracks([VIDEO_STREAM,
    { index: 1, codec_type: "video", codec_name: "mjpeg", disposition: { attached_pic: 1 } },
    { ...AUDIO_STREAM, index: 2 },
    { index: 3, codec_type: "audio", codec_name: "mp3", channels: 1, sample_rate: "44100", tags: { language: "por" } },
    { index: 4, codec_type: "subtitle", codec_name: "mov_text" }]);
  assert.deepEqual(tracks.map((t) => `${t.type}:${t.number}:${t.index}`), ["video:1:0", "audio:1:2", "audio:2:3"]);
  assert.equal(tracks[0].fps, 29.97);
  assert.equal(tracks[0].width, 1280);
  assert.equal(tracks[1].language, null);
  assert.equal(tracks[1].sample_rate, 48000);
  assert.equal(tracks[2].language, "por");
  assert.equal(tracks[2].peaks, null);
});

test("the waveform has 50 points per second (1000 to 20000), between 0 and 1, keeping the loudest sample", () => {
  // windows of 10 ms: 30 s, 5 s and 10 min of audio
  const long = toPeaks(Array.from({ length: 3000 }, (_, i) => (i === 1500 ? 32768 : 3277)));
  assert.equal(long.length, 1500);
  assert.equal(Math.max(...long), 1);
  assert.equal(long[750], 1);
  assert.equal(long[0], 0.1);
  assert.equal(toPeaks(new Array(500).fill(0)).length, 500);
  assert.equal(toPeaks(new Array(60000).fill(0)).length, 20000);
  assert.deepEqual(toPeaks([16384, 0]), [0.5, 0]);
  assert.deepEqual(toPeaks([]), []);
});

test("the first call reads the tracks; the waveform follows and later calls do not read the file again", async () => {
  const first = await getTracks();
  assert.equal(first.status, 200);
  assert.equal(first.body.state, "analyzing");
  assert.equal(first.body.duration, 60);
  assert.deepEqual(first.body.tracks.map((t) => t.type), ["video", "audio"]);
  assert.equal(first.body.tracks[1].peaks, null);

  await waitForWaveform();
  const second = await getTracks();
  assert.equal(second.body.state, "ready");
  const audio = second.body.tracks[1];
  assert.equal(audio.peaks.length, 100); // 1 s = 100 windows of 10 ms
  assert.equal(Math.max(...audio.peaks), 1);
  assert.equal(audio.peaks[50], 1);
  assert.equal(audio.peaks[0], 0.031);
  assert.equal(audio.peaks_duration, 1);
  assert.equal(probes, 1);
});

test("a video without audio is ready at once, with no audio track", async () => {
  streams = [VIDEO_STREAM];
  const result = await getTracks();
  assert.equal(result.status, 200);
  assert.equal(result.body.state, "ready");
  assert.deepEqual(result.body.tracks.map((t) => t.type), ["video"]);
});

test("a waveform that cannot be computed is marked failed, keeping the tracks", async () => {
  ffmpegFails = true;
  await getTracks();
  await waitForWaveform();
  const result = await getTracks();
  assert.equal(result.body.state, "failed");
  assert.equal(result.body.tracks.length, 2);
});

test("only the owner gets the tracks, and only of an available video", async () => {
  assert.equal((await getTracks("100000000000000000000002")).status, 403);
  assert.equal((await getTracks(USER, "300000000000000000000009")).status, 404);
  videos[0].state = "validating";
  const pending = await getTracks();
  assert.equal(pending.status, 409);
  assert.equal(pending.body.code, "NOT_AVAILABLE");
  assert.equal(probes, 0);
});

test("a file whose tracks cannot be read gets a message for the user", async () => {
  probeFails = true;
  const result = await getTracks();
  assert.equal(result.status, 500);
  assert.equal(result.body.code, "TRACKS_UNREADABLE");
  assert.equal(result.body.message, "Não foi possível ler as faixas deste vídeo.");
  assert.equal(videos[0].tracks, null);
});

test("a waveform computed by an older version is computed again, without reading the tracks again", async () => {
  const tracks = [
    { index: 0, type: "video", number: 1, codec: "h264" },
    { index: 1, type: "audio", number: 1, codec: "aac", peaks: [0.5], peaks_duration: 1 },
  ];
  Object.assign(videos[0], { tracks, waveform_state: "ready", waveform_version: 1 });
  const first = await getTracks();
  assert.equal(first.body.state, "analyzing");
  assert.deepEqual(first.body.tracks[1].peaks, [0.5]); // the old one, meanwhile
  await waitForWaveform();
  const second = await getTracks();
  assert.equal(second.body.state, "ready");
  assert.equal(second.body.tracks[1].peaks.length, 100);
  assert.equal(probes, 0);
});
