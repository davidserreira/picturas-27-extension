const { execFile } = require("child_process");

// Demuxer name ffprobe reports for both MP4 and QuickTime (MOV) files.
const ISO_MEDIA_FORMAT = "mov,mp4,m4a,3gp,3g2,mj2";

function ffprobe(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { timeout: 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(error);
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

// Packets that can actually be read from the first video stream, against the
// number the header declares. A file cut short keeps a complete header (moov at
// the start, as in phones and "faststart" files) but loses the frames after
// the cut, so fewer packets are read than declared (D-01, UC-VID-002/E3).
// Only the container is read, nothing is decoded: well under 1 s for 200 MB.
function countVideoPackets(filePath) {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-count_packets",
        "-show_entries", "stream=nb_read_packets,nb_frames", "-print_format", "json", filePath],
      { timeout: 60 * 1000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        try {
          const stream = JSON.parse(stdout).streams?.[0] || {};
          resolve({ read: Number(stream.nb_read_packets), declared: Number(stream.nb_frames) });
        } catch (_) {
          resolve(error ? null : {});
        }
      },
    );
  });
}

/**
 * Inspects the real content of a file, ignoring its extension.
 * Returns { ok: true, format, codec, duration, width, height } or
 * { ok: false, error: "unreadable" | "unsupported" }.
 */
async function probeVideo(filePath) {
  let info;
  try {
    info = await ffprobe(filePath);
  } catch (_) {
    return { ok: false, error: "unreadable" };
  }

  const container = info.format?.format_name;
  if (!container) return { ok: false, error: "unreadable" };
  if (container !== ISO_MEDIA_FORMAT) return { ok: false, error: "unsupported" };

  const video = (info.streams || []).find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  if (!video) return { ok: false, error: "unsupported" };

  // QuickTime files carry the "qt  " brand; everything else in this family is MP4.
  const brand = String(info.format.tags?.major_brand || "").trim();
  const format = brand === "qt" ? "mov" : "mp4";

  // MOV is accepted with any codec, MP4 only with H.264.
  if (format === "mp4" && video.codec_name !== "h264") {
    return { ok: false, error: "unsupported" };
  }

  const duration = parseFloat(info.format.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { ok: false, error: "unreadable" };
  }

  // D-01: a truncated file is unreadable even if its header is intact
  const packets = await countVideoPackets(filePath);
  if (!packets) return { ok: false, error: "unreadable" };
  if (Number.isFinite(packets.declared) && packets.declared > 0 &&
      Number.isFinite(packets.read) && packets.read < packets.declared) {
    return { ok: false, error: "unreadable" };
  }

  return {
    ok: true,
    format,
    codec: video.codec_name,
    duration,
    width: video.width ?? null,
    height: video.height ?? null,
  };
}

module.exports = { probeVideo, ffprobe };
