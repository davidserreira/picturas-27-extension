// Shared helpers for the Phase 2 measurement scripts.
// Talks to the running stack only through its public interface (nginx on
// https://localhost:8080) and the Docker CLI, so the same scripts measure the
// base and the refactored version.
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const BASE = process.env.PICTURAS_URL || "https://localhost:8080";
export const API = `${BASE}/api-gateway`;
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MEDICOES = path.resolve(HERE, "..");
export const REPO = path.resolve(MEDICOES, "..", "..", "..");
export const DADOS = path.join(MEDICOES, "dados");
export const COMPOSE_PROJECT = "picturas";

// The stack uses a self-signed certificate.
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const now = () => performance.now();

// Minimal JSON request over https, without external dependencies.
// A GET whose connection is reset before any answer is repeated once: Docker
// Desktop's port forwarding on Windows occasionally resets a connection before
// it reaches nginx (regression of the RNF-F2-01 final series; M2.1 of ADR-02
// step 4, where nginx logged no request). Other methods are never repeated.
export async function request(method, url, opts = {}) {
  try {
    return await requestOnce(method, url, opts);
  } catch (e) {
    if (method !== "GET" || !["ECONNRESET", "EPIPE"].includes(e.code)) throw e;
    console.log(`[medicao] GET repetido depois de ${e.code}: ${new URL(url).pathname}`);
    await sleep(250);
    return requestOnce(method, url, opts);
  }
}

function requestOnce(method, url, { token, body, headers = {}, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const h = { ...headers };
    let payload;
    if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body));
      h["Content-Type"] = "application/json";
      h["Content-Length"] = payload.length;
    }
    if (token) h.Authorization = `Bearer ${token}`;
    const req = https.request(u, { method, agent, headers: h, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("error", reject);
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let data = text;
        try { data = JSON.parse(text); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Multipart upload streamed from disk. Reports when the last byte left the
// client and when the response arrived, so acceptance latency can be split
// from transfer time. `abortAt` (0..1) destroys the request midway.
export function uploadFile(url, { field, file, mime, token, headers = {}, abortAt } = {}) {
  return new Promise((resolve, reject) => {
    const boundary = `----picturasMedicao${crypto.randomBytes(8).toString("hex")}`;
    const name = path.basename(file);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${name}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const size = fs.statSync(file).size;
    const h = {
      ...headers,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": head.length + size + tail.length,
    };
    if (token) h.Authorization = `Bearer ${token}`;
    const t = { start: now(), lastByte: null, response: null };
    const req = https.request(new URL(url), { method: "POST", agent, headers: h, timeout: 30 * 60000 }, (res) => {
      t.response = now();
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({
          status: res.statusCode,
          body: text.slice(0, 500),
          headers: res.headers,
          bytes: size,
          transferS: ((t.lastByte ?? t.response) - t.start) / 1000,
          acceptS: t.lastByte ? Math.max(0, (t.response - t.lastByte) / 1000) : null,
          totalS: (t.response - t.start) / 1000,
          aborted: false,
        });
      });
    });
    req.on("finish", () => { t.lastByte = now(); });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => {
      if (abortAt !== undefined) resolve({ status: null, aborted: true, bytes: size, totalS: (now() - t.start) / 1000 });
      else reject(e);
    });
    req.write(head);
    const stream = fs.createReadStream(file, { highWaterMark: 1 << 20 });
    let sent = 0;
    stream.on("data", (chunk) => {
      sent += chunk.length;
      if (abortAt !== undefined && sent >= size * abortAt) {
        stream.destroy();
        req.destroy(new Error("aborted by measurement"));
        return;
      }
      if (!req.write(chunk)) {
        stream.pause();
        req.once("drain", () => stream.resume());
      }
    });
    stream.on("end", () => { req.write(tail); req.end(); });
    stream.on("error", reject);
  });
}

export async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    fs.createReadStream(file).on("data", (c) => hash.update(c)).on("end", resolve).on("error", reject);
  });
  return hash.digest("hex");
}

export function sha256Url(url) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    https.get(new URL(url), { agent }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`GET ${res.statusCode}`));
      res.on("data", (c) => { hash.update(c); bytes += c.length; });
      res.on("end", () => resolve({ sha256: hash.digest("hex"), bytes }));
    }).on("error", reject);
  });
}

// ---------- accounts and projects ----------

export async function register(type = "premium", label = "medicao") {
  const id = `${label}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const email = `${id}@medicao.test`;
  const password = "Medicao-2026!";
  // In the base the users service accepts the profile type in the
  // registration body; that shortcut is what creates the premium test account.
  const r = await request("POST", `${API}/users/`, { body: { name: id, email, password, type } });
  if (r.status !== 201) throw new Error(`register ${r.status} ${JSON.stringify(r.data)}`);
  return { id: r.data.user._id, email, password, token: r.data.jwt, type: r.data.user.type, name: id };
}

export async function createProject(user, name) {
  const r = await request("POST", `${API}/projects/${user.id}`, { token: user.token, body: { name } });
  if (r.status !== 201) throw new Error(`create project ${r.status} ${JSON.stringify(r.data)}`);
  return { id: r.data._id, name };
}

export async function getProject(user, pid) {
  const r = await request("GET", `${API}/projects/${user.id}/${pid}`, { token: user.token });
  if (r.status !== 200) throw new Error(`get project ${r.status}`);
  return r.data;
}

export async function projectVersion(user, pid) {
  return (await getProject(user, pid)).version ?? 0;
}

export async function addMedia(user, pid, file, { video } = {}) {
  const isVideo = video ?? /\.(mp4|mov|webm)$/i.test(file);
  const mime = isVideo
    ? (file.endsWith(".mov") ? "video/quicktime" : file.endsWith(".webm") ? "video/webm" : "video/mp4")
    : (file.endsWith(".png") ? "image/png" : "image/jpeg");
  return uploadFile(`${API}/projects/${user.id}/${pid}/${isVideo ? "video" : "img"}`, {
    field: isVideo ? "video" : "image",
    file, mime, token: user.token,
    headers: { "X-Project-Version": String(await projectVersion(user, pid)) },
  });
}

export async function addTool(user, pid, procedure, params) {
  const r = await request("POST", `${API}/projects/${user.id}/${pid}/tool`, {
    token: user.token, body: { procedure, params },
    headers: { "X-Project-Version": String(await projectVersion(user, pid)) },
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`add tool ${r.status} ${JSON.stringify(r.data)}`);
  return r;
}

export async function startProcess(user, pid) {
  return request("POST", `${API}/projects/${user.id}/${pid}/process`, {
    token: user.token, body: {},
    headers: { "X-Project-Version": String(await projectVersion(user, pid)) },
  });
}

export async function cancelProcess(user, pid) {
  return request("DELETE", `${API}/projects/${user.id}/${pid}/process`, {
    token: user.token,
    headers: { "X-Project-Version": String(await projectVersion(user, pid)) },
  });
}

export async function results(user, pid) {
  const r = await request("GET", `${API}/projects/${user.id}/${pid}/process/url`, { token: user.token });
  return r.status === 200 ? r.data : { imgs: [], texts: [] };
}

export async function waitForResults(user, pid, { timeoutMs = 20 * 60000, intervalMs = 500 } = {}) {
  const t0 = now();
  while (now() - t0 < timeoutMs) {
    const r = await results(user, pid);
    if ((r.imgs?.length ?? 0) + (r.texts?.length ?? 0) > 0) return { at: now(), results: r };
    await sleep(intervalMs);
  }
  return null;
}

// RabbitMQ management API (published on 15672 in the base) tells whether the
// single video worker is idle: video_queue empty and nothing unacknowledged.
export async function videoWorkerIdle() {
  try {
    const res = await fetch("http://localhost:15672/api/queues/%2F/video_queue", {
      headers: { Authorization: "Basic " + Buffer.from("user:password").toString("base64") },
    });
    const q = await res.json();
    return (q.messages ?? 0) === 0 && (q.messages_unacknowledged ?? 0) === 0;
  } catch {
    return null; // management API not reachable: caller falls back to waiting
  }
}

export async function waitVideoWorkerIdle(timeoutMs = 20 * 60000) {
  const t0 = now();
  while (now() - t0 < timeoutMs) {
    const idle = await videoWorkerIdle();
    if (idle === null) return false;
    if (idle) return true;
    await sleep(2000);
  }
  return false;
}

// ---------- docker ----------

export function docker(args, opts = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

export function compose(args, opts = {}) {
  return execFileSync("docker", ["compose", ...args], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

export const container = (service) => `${COMPOSE_PROJECT}-${service}-1`;

export function containerState(service) {
  const out = docker(["inspect", "-f", "{{.State.OOMKilled}} {{.RestartCount}} {{.State.Status}} {{.State.StartedAt}}", container(service)]);
  const [oom, restarts, status, startedAt] = out.split(" ");
  return { oomKilled: oom === "true", restarts: Number(restarts), status, startedAt };
}

function toMiB(s) {
  const m = /([\d.]+)\s*([KMGT]?i?B)/i.exec(s);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const f = { B: 1 / 1048576, KB: 1 / 1024, KIB: 1 / 1024, MB: 1, MIB: 1, GB: 1024, GIB: 1024, TB: 1048576, TIB: 1048576 }[unit];
  return v * f;
}

// Streams `docker stats` and keeps every memory sample per container.
export function startMemorySampler(services) {
  const names = services.map(container);
  const samples = Object.fromEntries(services.map((s) => [s, []]));
  const byName = Object.fromEntries(services.map((s) => [container(s), s]));
  const proc = spawn("docker", ["stats", "--format", "{{json .}}", ...names], { stdio: ["ignore", "pipe", "ignore"] });
  let buf = "";
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const raw of lines) {
      const start = raw.indexOf("{");
      if (start < 0) continue;
      try {
        const end = raw.lastIndexOf("}");
        const j = JSON.parse(raw.slice(start, end + 1)); // stream lines carry ANSI codes around the JSON
        const svc = byName[j.Name] ?? byName[j.Container];
        if (!svc) continue;
        const mib = toMiB(String(j.MemUsage).split("/")[0]);
        if (mib !== null) samples[svc].push({ t: now(), mib });
      } catch { /* partial line */ }
    }
  });
  return {
    samples,
    stop: () => { proc.stdout.destroy(); proc.kill("SIGKILL"); },
    window(svc, t0, t1) { return samples[svc].filter((s) => s.t >= t0 && s.t <= t1); },
  };
}

// ---------- statistics and output ----------

export function stats(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x));
  if (!v.length) return { n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)) : 0;
  const sorted = [...v].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const r = (x) => Math.round(x * 100) / 100;
  return { n: v.length, mean: r(mean), sd: r(sd), median: r(median), min: r(sorted[0]), max: r(sorted.at(-1)) };
}

export function outDir() {
  const dir = path.join(MEDICOES, process.env.MEDICAO || "baseline");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function save(name, data) {
  const file = path.join(outDir(), name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`[medicao] gravado ${path.relative(REPO, file)}`);
  return file;
}

export function gitCommit() {
  try {
    const hash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", ".", ":!Docs"], { cwd: REPO, encoding: "utf8" }).trim();
    return { hash, codeChanges: dirty ? dirty.split("\n") : [] };
  } catch { return null; }
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
