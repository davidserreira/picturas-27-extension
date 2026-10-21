const { spawn } = require("child_process");

const Video = require("../controllers/video");
const { get_image_internal_url } = require("./imageStorage");
const { ffprobe } = require("./videoProbe");

// Points of each audio waveform: 50 per second (enough to zoom in on the
// timeline), at least 1000 and at most 20000.
const MIN_PEAKS = 1000;
const MAX_PEAKS = 20000;
const WINDOWS_PER_PEAK = 2;
// Waveforms computed with an older version are computed again.
const WAVEFORM_VERSION = 2;
// The audio is decoded to mono at this rate: enough for the shape of the waveform.
const SAMPLE_RATE = 4000;
// Samples per window (10 ms); the waveform is the loudest sample of each window.
const WINDOW = 40;
const WAVEFORM_TIMEOUT_MS = 10 * 60 * 1000;

// Videos whose waveforms are being computed by this process (ids as strings).
const running = new Set();

function frameRate(stream) {
  const [num, den] = String(stream.avg_frame_rate || stream.r_frame_rate || "")
    .split("/")
    .map(Number);
  return num > 0 && den > 0 ? Math.round((num / den) * 100) / 100 : null;
}

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The audio and video tracks of a file, from the streams ffprobe reports.
 * Cover images (attached pictures), subtitles and data streams are left out.
 * Tracks are numbered by type (V1, V2, A1, ...), in the order of the file.
 */
function toTracks(streams) {
  const count = { video: 0, audio: 0 };
  const tracks = [];

  for (const stream of streams || []) {
    const type = stream.codec_type;
    if (type !== "video" && type !== "audio") continue;
    if (type === "video" && stream.disposition?.attached_pic) continue;

    const language = stream.tags?.language;
    const track = {
      index: stream.index,
      type,
      number: ++count[type],
      codec: stream.codec_name ?? null,
      language: language && language !== "und" ? language : null,
      duration: positive(stream.duration),
      bitrate: positive(stream.bit_rate),
    };

    if (type === "video") {
      track.width = stream.width ?? null;
      track.height = stream.height ?? null;
      track.fps = frameRate(stream);
    } else {
      track.channels = stream.channels ?? null;
      track.channel_layout = stream.channel_layout ?? null;
      track.sample_rate = positive(stream.sample_rate);
      track.peaks = null;
      track.peaks_duration = null;
    }

    tracks.push(track);
  }

  return tracks;
}

/**
 * Reduces the loudest sample of each window (0..32768) to values between
 * 0 and 1, keeping the loudest of the windows merged into each value.
 */
function toPeaks(windows) {
  const n = Math.min(
    windows.length,
    Math.max(MIN_PEAKS, Math.min(MAX_PEAKS, Math.ceil(windows.length / WINDOWS_PER_PEAK))),
  );
  const peaks = new Array(n).fill(0);
  windows.forEach((value, i) => {
    const bucket = Math.floor((i * n) / windows.length);
    if (value > peaks[bucket]) peaks[bucket] = value;
  });
  return peaks.map((v) => Math.round((v / 32768) * 1000) / 1000);
}

// Decodes one audio stream of the video, as mono 16-bit samples, and keeps its waveform.
function audioWaveform(url, streamIndex) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      ["-v", "error", "-i", url, "-map", `0:${streamIndex}`, "-ac", "1",
        "-ar", String(SAMPLE_RATE), "-f", "s16le", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const windows = [];
    let loudest = 0;
    let inWindow = 0;
    let samples = 0;
    let leftover = null;

    const timer = setTimeout(() => ffmpeg.kill("SIGKILL"), WAVEFORM_TIMEOUT_MS);

    ffmpeg.stdout.on("data", (data) => {
      const chunk = leftover ? Buffer.concat([leftover, data]) : data;
      const usable = chunk.length - (chunk.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const value = Math.abs(chunk.readInt16LE(i));
        if (value > loudest) loudest = value;
        if (++inWindow === WINDOW) {
          windows.push(loudest);
          loudest = 0;
          inWindow = 0;
        }
      }
      samples += usable / 2;
      leftover = usable < chunk.length ? chunk.subarray(usable) : null;
    });
    ffmpeg.stderr.resume();

    ffmpeg.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}`));
      if (inWindow > 0) windows.push(loudest);
      resolve({ peaks: toPeaks(windows), duration: samples / SAMPLE_RATE });
    });
  });
}

async function internalUrl(video) {
  const resp = await get_image_internal_url(video.user_id, video.project_id, "video", video.video_key);
  return resp.data.url;
}

async function computeWaveforms(video) {
  try {
    const url = await internalUrl(video);
    const tracks = [];
    for (const track of video.tracks) {
      if (track.type !== "audio") {
        tracks.push(track);
        continue;
      }
      const { peaks, duration } = await audioWaveform(url, track.index);
      tracks.push({ ...track, peaks, peaks_duration: duration });
    }
    await Video.updateIfState(video._id, ["available"], {
      tracks,
      waveform_state: "ready",
      waveform_version: WAVEFORM_VERSION,
    });
  } catch (err) {
    console.error("Error computing the waveform of video", String(video._id), err.message);
    await Video.updateIfState(video._id, ["available"], { waveform_state: "failed" });
  }
}

// Starts computing the waveforms in the background, unless it is already going on.
function startWaveforms(video) {
  const id = String(video._id);
  if (running.has(id)) return;
  running.add(id);
  computeWaveforms(video).finally(() => running.delete(id));
}

/**
 * Returns the video with its tracks. They are read with ffprobe the first
 * time and kept with the video; the audio waveforms are computed afterwards,
 * in the background, and `waveform_state` says when they are ready. A
 * computation cut short by a restart is started again on the next call.
 * Returns null if the video was removed in the meantime.
 */
async function loadTracks(video) {
  let current = video;

  if (!current.tracks) {
    const info = await ffprobe(await internalUrl(current));
    const tracks = toTracks(info.streams);
    const hasAudio = tracks.some((t) => t.type === "audio");
    current = await Video.updateIfState(current._id, ["available"], {
      tracks,
      waveform_state: hasAudio ? "analyzing" : "ready",
      waveform_version: WAVEFORM_VERSION,
    });
    if (!current) return null;
  } else if (
    current.waveform_state === "ready" &&
    current.waveform_version !== WAVEFORM_VERSION &&
    current.tracks.some((t) => t.type === "audio")
  ) {
    // computed by an older version: computed again, the tracks stay as they are
    current = await Video.updateIfState(current._id, ["available"], {
      waveform_state: "analyzing",
      waveform_version: WAVEFORM_VERSION,
    });
    if (!current) return null;
  }

  if (current.waveform_state === "analyzing") startWaveforms(current);
  return current;
}

module.exports = { loadTracks, toTracks, toPeaks, audioWaveform };
