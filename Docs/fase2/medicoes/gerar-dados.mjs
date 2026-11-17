// Generates the synthetic test data used by every measurement, deterministically.
// ffmpeg runs inside the `projects` image of the stack (it already ships ffmpeg),
// so the host needs nothing besides Docker and Node.
//
//   node gerar-dados.mjs              upload files + images + calibration videos
//   node gerar-dados.mjs --video 300  only the RNF-F2-02 video with 300 s
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DADOS, log } from "./lib/comum.mjs";

const IMAGE = process.env.FFMPEG_IMAGE || "picturas-projects";
fs.mkdirSync(DADOS, { recursive: true });

function ffmpeg(args) {
  execFileSync("docker", ["run", "--rm", "-v", `${DADOS}:/out`, "-w", "/out", IMAGE, "ffmpeg", "-y", "-v", "error", ...args],
    { stdio: "inherit" });
}

function ffprobeDuration(file) {
  const out = execFileSync("docker", ["run", "--rm", "-v", `${DADOS}:/out`, "-w", "/out", IMAGE,
    "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return parseFloat(out);
}

const MiB = 1024 * 1024;
const exists = (f) => fs.existsSync(path.join(DADOS, f));

// RNF-F2-02: video for project P (720p30, with audio), duration in seconds.
function pVideo(seconds) {
  const name = `p-video-${seconds}s.mp4`;
  if (exists(name)) return log(`${name} ja existe`);
  log(`a gerar ${name}`);
  ffmpeg([
    "-f", "lavfi", "-i", `testsrc2=size=1280x720:rate=30:duration=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=44100:duration=${seconds}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-shortest", name,
  ]);
}

const argv = process.argv.slice(2);
if (argv[0] === "--video") {
  pVideo(Number(argv[1]));
  process.exit(0);
}

// Images: two for P, one for Q, one for new projects.
for (const [name, src] of [
  ["imagem-p1.png", "testsrc2=size=1280x720:rate=1"],
  ["imagem-p2.png", "smptehdbars=size=1280x720:rate=1"],
  ["imagem-q.png", "mandelbrot=size=1280x720:rate=1"],
  ["imagem-nova.png", "rgbtestsrc=size=1280x720:rate=1"],
]) {
  if (!exists(name)) { log(`a gerar ${name}`); ffmpeg(["-f", "lavfi", "-i", src, "-frames:v", "1", name]); }
}

// RNF-F2-01: one ~1000 MiB constant-bitrate source (720p30, noise so the encoder
// cannot compress it below the target), then exact-length stream copies for the
// smaller sizes. Copies keep the bitrate, so their size is proportional to length.
const SOURCE = "upload-1000MiB.mp4";
const SOURCE_SECONDS = 500;
if (!exists(SOURCE)) {
  const kbps = Math.round((1000 * MiB * 8) / SOURCE_SECONDS / 1000 * 0.985); // container overhead
  log(`a gerar ${SOURCE} (${SOURCE_SECONDS} s a ${kbps} kbit/s; demora alguns minutos)`);
  ffmpeg([
    "-f", "lavfi", "-i", `testsrc2=size=1280x720:rate=30:duration=${SOURCE_SECONDS},noise=alls=60:allf=t`,
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-b:v", `${kbps}k`, "-minrate", `${kbps}k`, "-maxrate", `${kbps}k`, "-bufsize", `${kbps}k`,
    "-x264-params", "nal-hrd=cbr", "-movflags", "+faststart", SOURCE,
  ]);
}
const sourceBytes = fs.statSync(path.join(DADOS, SOURCE)).size;
const sourceSeconds = ffprobeDuration(SOURCE);
for (const mib of [10, 100, 500]) {
  const name = `upload-${mib}MiB.mp4`;
  if (exists(name)) continue;
  const seconds = (mib * MiB) / sourceBytes * sourceSeconds;
  log(`a gerar ${name} (${seconds.toFixed(2)} s copiados de ${SOURCE})`);
  ffmpeg(["-i", SOURCE, "-t", seconds.toFixed(3), "-c", "copy", "-movflags", "+faststart", name]);
}

const manifest = {};
for (const f of fs.readdirSync(DADOS).filter((f) => /\.(mp4|png)$/.test(f)).sort()) {
  manifest[f] = { bytes: fs.statSync(path.join(DADOS, f)).size, MiB: +(fs.statSync(path.join(DADOS, f)).size / MiB).toFixed(1) };
}
fs.writeFileSync(path.join(DADOS, "manifesto.json"), JSON.stringify(manifest, null, 2));
console.table(manifest);
