// End-to-end regression suite for Phase 2. Exercises the running stack through
// its public interface (REST via nginx, Socket.IO) and records a fingerprint of
// every output, so the refactored version can be compared with the base.
//
//   REGRESSAO=baseline node e2e.mjs          run and write the reference
//   REGRESSAO=final    node e2e.mjs          run and compare with the reference
//   node e2e.mjs --only T06,T07              run a subset
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import {
  BASE, API, DADOS as DADOS_MEDICOES, REPO, register, createProject, getProject, addMedia, addTool,
  startProcess, cancelProcess, results, request, uploadFile, sha256File, sha256Url, waitVideoWorkerIdle,
  sleep, now, log, gitCommit,
} from "../medicoes/lib/comum.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.REGRESSAO || "baseline";
const DADOS = path.join(HERE, "dados");
const TMP = path.join(HERE, "tmp");
const OUT = path.join(HERE, "resultados");
const REF = path.join(HERE, "referencia.json");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1].split(",") : null; })();
const SAMPLES = path.join(REPO, "samples", "video");
const IMG1 = path.join(DADOS_MEDICOES, "imagem-p1.png");
const IMG2 = path.join(DADOS_MEDICOES, "imagem-p2.png");
fs.mkdirSync(DADOS, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const agent = new https.Agent({ rejectUnauthorized: false });

// ---------- test data ----------

function ffmpeg(args) {
  execFileSync("docker", ["run", "--rm", "-v", `${DADOS}:/out`, "-v", `${SAMPLES}:/samples:ro`, "-w", "/out",
    "picturas-projects", "ffmpeg", "-y", "-v", "error", ...args], { stdio: "inherit" });
}
function prepareData() {
  if (!fs.existsSync(IMG1)) throw new Error("faltam as imagens de medicoes/dados; corra medicoes/gerar-dados.mjs");
  const make = (name, args) => { if (!fs.existsSync(path.join(DADOS, name))) { log(`a gerar ${name}`); ffmpeg([...args, name]); } };
  // 25 s of real speech (no re-encode of the picture would change the content).
  make("fala-25s.mp4", ["-i", "/samples/speech_mandela_177s_1080p.webm", "-t", "25", "-vf", "scale=1280:-2",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-pix_fmt", "yuv420p"]);
  make("sem-som-8s.mp4", ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=8",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p"]);
  make("video-60s.mp4", ["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=60",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=60",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"]);
}

// ---------- helpers ----------

class Falha extends Error {}
function check(cond, msg) { if (!cond) throw new Falha(msg); }

function rawGet(url, token) {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), { agent, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

function connectSocket(user) {
  const socket = io(BASE, { transports: ["websocket"], rejectUnauthorized: false, auth: { token: user.token } });
  const events = [];
  for (const name of ["process-update", "process-error", "preview-ready", "preview-error", "video-progress"]) {
    socket.on(name, (payload) => events.push({ name, payload, t: now() }));
  }
  return new Promise((resolve) => {
    socket.on("connect", () => resolve({ socket, events }));
    setTimeout(() => resolve({ socket, events }), 5000);
  });
}

// Starts a run and waits for committed results, failing fast on process-error.
async function runAndWait(ctx, pid, { expectStart = true, timeoutMs = 15 * 60000 } = {}) {
  const t0 = now();
  const mark = ctx.ws.events.length;
  const r = await startProcess(ctx.user, pid);
  if (!expectStart) return { start: r };
  check(r.status === 201, `process devolveu ${r.status} ${JSON.stringify(r.data)}`);
  while (now() - t0 < timeoutMs) {
    const err = ctx.ws.events.slice(mark).find((e) => e.name === "process-error");
    if (err) throw new Falha(`process-error ${JSON.stringify(err.payload)}`);
    const res = await results(ctx.user, pid);
    if ((res.imgs?.length ?? 0) + (res.texts?.length ?? 0) > 0) {
      await sleep(1500); // the last result of a batch may land a moment later
      return { start: r, results: await results(ctx.user, pid), seconds: +((now() - t0) / 1000).toFixed(1) };
    }
    await sleep(500);
  }
  throw new Falha("a execucao nao terminou");
}

async function download(url, name) {
  const r = await rawGet(url);
  check(r.status === 200, `download ${r.status}`);
  const file = path.join(TMP, name);
  fs.writeFileSync(file, r.body);
  return file;
}

function probe(file) {
  const out = execFileSync("docker", ["run", "--rm", "-v", `${TMP}:/tmp/x:ro`, "picturas-projects", "ffprobe", "-v", "error",
    "-print_format", "json", "-show_format", "-show_streams", `/tmp/x/${path.basename(file)}`], { encoding: "utf8" });
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return {
    duracaoS: Math.round(parseFloat(j.format.duration) * 10) / 10,
    largura: v?.width, altura: v?.height, codec: v?.codec_name, audio: a ? a.codec_name : null,
  };
}

function probeImage(file) {
  const out = execFileSync("docker", ["run", "--rm", "-v", `${TMP}:/tmp/x:ro`, "picturas-projects", "ffprobe", "-v", "error",
    "-print_format", "json", "-show_streams", `/tmp/x/${path.basename(file)}`], { encoding: "utf8" });
  const v = JSON.parse(out).streams[0];
  return { formato: v.codec_name, largura: v.width, altura: v.height };
}

// Key-order independent JSON, so result order from the API does not matter.
function canonical(x) {
  if (Array.isArray(x)) return `[${x.map(canonical).join(",")}]`;
  if (x && typeof x === "object") return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonical(x[k])}`).join(",")}}`;
  return JSON.stringify(x);
}

async function videoFingerprint(result, label) {
  const f = await download(result.url, `${label}.mp4`);
  return probe(f);
}

async function imageFingerprint(result) {
  return (await sha256Url(result.url)).sha256;
}

async function project(ctx, name, media = [], tools = []) {
  const p = await createProject(ctx.user, `${name}-${Date.now() % 100000}`);
  for (const m of media) {
    const r = await addMedia(ctx.user, p.id, m);
    check(r.status === 204, `carregar ${path.basename(m)} devolveu ${r.status} ${r.body}`);
  }
  for (const [procedure, params] of tools) await addTool(ctx.user, p.id, procedure, params);
  return p;
}

const mediaId = async (ctx, pid, nameIncludes) => (await getProject(ctx.user, pid)).imgs.find((i) => (i.og_uri || i.name || "").includes(nameIncludes))?._id;

// ---------- tests ----------

const IMAGE_TOOLS = [
  ["brightness", { brightness: 1.3 }],
  ["contrast", { contrastFactor: 1.4 }],
  ["saturation", { saturationFactor: 1.6 }],
  ["binarization", { threshold: 128 }],
  ["rotate", { degrees: 90 }],
  ["resize", { width: 640, height: 360 }],
  ["cut", { left: 100, top: 50, right: 900, bottom: 550 }],
  ["border", { borderWidth: 20, r: 255, g: 0, b: 0 }],
  ["watermark", {}],
];

const TESTS = [
  { id: "T01", area: "Contas", nome: "Registo e início de sessão devolvem um JWT válido", run: async (ctx) => {
    const u = await register("free", "reg-t01");
    const r = await request("POST", `${API}/users/${encodeURIComponent(u.email)}/login`, { body: { password: u.password } });
    check(r.status >= 200 && r.status < 300 && r.data.jwt, `login devolveu ${r.status}`);
    const v = await request("GET", `${API}/users/validate/${u.id}`, { token: r.data.jwt });
    check(v.status === 200, `validate devolveu ${v.status}`);
    return { impressao: { login: r.status, validate: v.status } };
  } },

  { id: "T02", area: "Carregamento", nome: "Carregar imagem PNG: aceite, listada e guardada sem alteração", run: async (ctx) => {
    const p = await project(ctx, "t02", [IMG1]);
    const r = await request("GET", `${API}/projects/${ctx.user.id}/${p.id}/imgs`, { token: ctx.user.token });
    check(Array.isArray(r.data) && r.data.length === 1, "a imagem nao aparece no projeto");
    check(r.data[0].media_type === "image", `media_type ${r.data[0].media_type}`);
    const sha = (await sha256Url(r.data[0].url)).sha256;
    check(sha === await sha256File(IMG1), "o ficheiro guardado difere do enviado");
    return { impressao: { media_type: r.data[0].media_type, igual: true } };
  } },

  { id: "T03", area: "Carregamento", nome: "Carregar vídeos MP4 e MOV: aceites, com metadados lidos por ffprobe", run: async (ctx) => {
    const p = await project(ctx, "t03", [path.join(SAMPLES, "sample_10s_720p.mp4"), path.join(SAMPLES, "sample_6s.mov")]);
    const r = await request("GET", `${API}/projects/${ctx.user.id}/${p.id}/imgs`, { token: ctx.user.token });
    check(r.data.length === 2 && r.data.every((m) => m.media_type === "video"), "videos nao listados como video");
    const meta = Object.fromEntries(r.data.map((m) => [m.name, { duracao: Math.round(m.video.duration), w: m.video.width, h: m.video.height, codec: m.video.video_codec }]));
    for (const m of r.data) check((await sha256Url(m.url)).sha256 === await sha256File(path.join(SAMPLES, m.name)), `${m.name} guardado com alteracoes`);
    return { impressao: meta };
  } },

  { id: "T04", area: "Carregamento", nome: "Recusas: vídeo no endpoint de imagem, imagem no de vídeo, ficheiro corrompido, nome repetido, limites do perfil gratuito, anónimo", run: async (ctx) => {
    const free = await register("free", "reg-t04");
    const anon = await request("POST", `${API}/users/`, { body: { type: "anonymous", name: "anon" } });
    const anonUser = { id: anon.data.user._id, token: anon.data.jwt };
    const p = await project(ctx, "t04", [IMG1]);
    const pf = await createProject(free, "t04-free");
    const pa = await createProject(anonUser, "t04-anon");
    const up = (u, pid, kind, file, mime) => uploadFile(`${API}/projects/${u.id}/${pid}/${kind}`, {
      field: kind === "video" ? "video" : "image", file, mime, token: u.token, headers: { "X-Project-Version": "0" } });
    const v = async (u, pid) => String((await getProject(u, pid)).version);
    const cases = {
      videoNoEndpointDeImagem: await uploadFile(`${API}/projects/${ctx.user.id}/${p.id}/img`, { field: "image", file: path.join(SAMPLES, "sample_10s_720p.mp4"), mime: "video/mp4", token: ctx.user.token, headers: { "X-Project-Version": await v(ctx.user, p.id) } }),
      imagemNoEndpointDeVideo: await uploadFile(`${API}/projects/${ctx.user.id}/${p.id}/video`, { field: "video", file: IMG2, mime: "image/png", token: ctx.user.token, headers: { "X-Project-Version": await v(ctx.user, p.id) } }),
      corrompido: await uploadFile(`${API}/projects/${ctx.user.id}/${p.id}/video`, { field: "video", file: path.join(SAMPLES, "corrupted.mp4"), mime: "video/mp4", token: ctx.user.token, headers: { "X-Project-Version": await v(ctx.user, p.id) } }),
      nomeRepetido: await uploadFile(`${API}/projects/${ctx.user.id}/${p.id}/img`, { field: "image", file: IMG1, mime: "image/png", token: ctx.user.token, headers: { "X-Project-Version": await v(ctx.user, p.id) } }),
      gratuito90s: await up(free, pf.id, "video", path.join(SAMPLES, "too_long_90s.mp4"), "video/mp4"),
      anonimoVideo: await up(anonUser, pa.id, "video", path.join(SAMPLES, "sample_10s_720p.mp4"), "video/mp4"),
    };
    const out = Object.fromEntries(Object.entries(cases).map(([k, r]) => [k, { status: r.status, mensagem: r.body.replace(/"/g, "") }]));
    for (const [k, r] of Object.entries(out)) check(r.status >= 400 && r.status < 500, `${k} devolveu ${r.status}`);
    return { impressao: out };
  } },

  { id: "T05", area: "Pipeline de imagem", nome: "Cada ferramenta de imagem (8 + watermark) aplicada sozinha produz o resultado de referência", run: async (ctx) => {
    const out = {};
    for (const [tool, params] of IMAGE_TOOLS) {
      const p = await project(ctx, `t05-${tool}`, [IMG1], [[tool, params]]);
      const r = await runAndWait(ctx, p.id);
      check(r.results.imgs.length === 1, `${tool}: ${r.results.imgs.length} resultados`);
      // watermark is a third-party image whose output bytes vary between runs:
      // compare its format and size instead of its hash.
      out[tool] = tool === "watermark"
        ? probeImage(await download(r.results.imgs[0].url, `t05-watermark${path.extname(r.results.imgs[0].name) || ".png"}`))
        : await imageFingerprint(r.results.imgs[0]);
    }
    return { impressao: out };
  } },

  { id: "T06", area: "Pipeline de imagem", nome: "Pipeline encadeado em lote (brilho, contraste, rotação, redimensionamento) em duas imagens", run: async (ctx) => {
    const p = await project(ctx, "t06", [IMG1, IMG2], [["brightness", { brightness: 1.2 }], ["contrast", { contrastFactor: 1.3 }], ["rotate", { degrees: 45 }], ["resize", { width: 800, height: 600 }]]);
    const r = await runAndWait(ctx, p.id);
    check(r.results.imgs.length === 2, `${r.results.imgs.length} resultados em vez de 2`);
    const out = {};
    for (const img of r.results.imgs) out[img.name] = await imageFingerprint(img);
    ctx.t06 = p;
    return { impressao: out };
  } },

  { id: "T07", area: "Pipeline de imagem", nome: "Transferência dos resultados em ZIP", run: async (ctx) => {
    const p = ctx.t06 ?? await project(ctx, "t07", [IMG1, IMG2], [["brightness", { brightness: 1.2 }]]);
    if (!ctx.t06) await runAndWait(ctx, p.id);
    const r = await rawGet(`${API}/projects/${ctx.user.id}/${p.id}/process`, ctx.user.token);
    check(r.status === 200, `ZIP devolveu ${r.status}`);
    const entries = r.body.toString("latin1").split("PK\u0003\u0004").length - 1;
    check(r.body.subarray(0, 2).toString() === "PK" && entries === 2, `ZIP com ${entries} ficheiros`);
    return { impressao: { ficheiros: entries } };
  } },

  { id: "T08", area: "Pré-visualização", nome: "Pré-visualização de imagem e de vídeo chega pelo WebSocket", run: async (ctx) => {
    const p = await project(ctx, "t08", [IMG1, path.join(SAMPLES, "sample_10s_720p.mp4")], [["brightness", { brightness: 1.3 }]]);
    const pr = await getProject(ctx.user, p.id);
    const out = {};
    for (const m of pr.imgs) {
      const mark = ctx.ws.events.length;
      const r = await request("POST", `${API}/projects/${ctx.user.id}/${p.id}/preview/${m._id}`, { token: ctx.user.token, body: {} });
      check(r.status < 300, `preview devolveu ${r.status}`);
      const t0 = now();
      let ev = null;
      while (!ev && now() - t0 < 120000) { ev = ctx.ws.events.slice(mark).find((e) => /preview-(ready|error)/.test(e.name)); await sleep(200); }
      check(ev && ev.name === "preview-ready", `sem preview-ready (${ev?.name ?? "nada"})`);
      const urls = JSON.parse(ev.payload);
      check(urls.imageUrl, "preview sem URL");
      out[m.media_type] = { mediaType: urls.mediaType ?? "image" };
    }
    return { impressao: out };
  } },

  { id: "T09", area: "Vídeo", nome: "Efeitos de fotograma em vídeo: cor (brilho, contraste, saturação, binarização) e geometria (rotação, recorte, redimensionamento, moldura)", run: async (ctx) => {
    const src = path.join(SAMPLES, "sample_10s_720p.mp4");
    const out = {};
    for (const [label, tools] of [
      ["cor", [["brightness", { brightness: 1.3 }], ["contrast", { contrastFactor: 1.2 }], ["saturation", { saturationFactor: 1.5 }], ["binarization", { threshold: 100 }]]],
      ["geometria", [["rotate", { degrees: 90 }], ["cut", { left: 0, top: 0, right: 600, bottom: 1000 }], ["resize", { width: 300, height: 500 }], ["border", { borderWidth: 10, r: 0, g: 0, b: 255 }]]],
    ]) {
      await waitVideoWorkerIdle();
      const p = await project(ctx, `t09-${label}`, [src], tools);
      const r = await runAndWait(ctx, p.id);
      check(r.results.imgs.length === 1 && r.results.imgs[0].type === "video", "resultado nao e um video");
      out[label] = await videoFingerprint(r.results.imgs[0], `t09-${label}`);
    }
    check(out.geometria.largura === 320 && out.geometria.altura === 520, `geometria ${out.geometria.largura}x${out.geometria.altura}`);
    return { impressao: out };
  } },

  { id: "T10", area: "Vídeo", nome: "Corte no tempo e velocidade: duração e som do resultado", run: async (ctx) => {
    await waitVideoWorkerIdle();
    const p = await project(ctx, "t10", [path.join(SAMPLES, "sample_10s_720p.mp4")]);
    const vid = (await getProject(ctx.user, p.id)).imgs[0]._id;
    await addTool(ctx.user, p.id, "trim", { start: 2, end: 8, imgId: vid });
    await addTool(ctx.user, p.id, "speed", { factor: 2, imgId: vid });
    const r = await runAndWait(ctx, p.id);
    const fp = await videoFingerprint(r.results.imgs[0], "t10");
    check(Math.abs(fp.duracaoS - 3) <= 0.2, `duracao ${fp.duracaoS} s em vez de 3 s`);
    check(fp.audio === "aac", "o som perdeu-se");
    return { impressao: fp };
  } },

  { id: "T11", area: "Vídeo", nome: "Legendagem automática: vídeo com fala legendado; vídeo sem som inalterado na duração", run: async (ctx) => {
    await waitVideoWorkerIdle();
    const p = await project(ctx, "t11", [path.join(DADOS, "fala-25s.mp4"), path.join(DADOS, "sem-som-8s.mp4")], [["subtitles", {}]]);
    const r = await runAndWait(ctx, p.id, { timeoutMs: 30 * 60000 });
    check(r.results.imgs.length === 2 && r.results.imgs.every((x) => x.type === "video"), "esperados 2 videos");
    const out = {};
    for (const img of r.results.imgs) out[img.name] = await videoFingerprint(img, `t11-${img.name.replace(/\W/g, "")}`);
    const fala = Object.entries(out).find(([n]) => n.includes("fala"))[1];
    // Captions are burned in: the captioned picture must differ from the source.
    const srcSha = await sha256File(path.join(DADOS, "fala-25s.mp4"));
    const outSha = await sha256File(path.join(TMP, `t11-${r.results.imgs.find((x) => x.name.includes("fala")).name.replace(/\W/g, "")}.mp4`));
    check(srcSha !== outSha, "o video legendado e igual ao original");
    check(Math.abs(fala.duracaoS - 25) <= 0.3, `duracao ${fala.duracaoS}`);
    return { impressao: out, detalhes: { segundos: r.seconds } };
  } },

  { id: "T12", area: "Vídeo", nome: "Extração de fotogramas: por número (PNG) e por intervalo (JPEG), cada fotograma como resultado", run: async (ctx) => {
    const out = {};
    for (const [label, params, expected] of [
      ["contagem", { mode: "count", count: 5, format: "png" }, 5],
      ["intervalo", { mode: "interval", interval: 2, format: "jpeg" }, 5],
    ]) {
      await waitVideoWorkerIdle();
      const p = await project(ctx, `t12-${label}`, [path.join(SAMPLES, "sample_10s_720p.mp4")], [["brightness", { brightness: 1.1 }], ["extract_frames", params]]);
      const r = await runAndWait(ctx, p.id);
      const imgs = r.results.imgs;
      check(imgs.length === expected, `${label}: ${imgs.length} fotogramas em vez de ${expected}`);
      check(new Set(imgs.map((i) => i.name)).size === imgs.length, "nomes repetidos");
      out[label] = { fotogramas: imgs.length, tipos: [...new Set(imgs.map((i) => i.type))], extensao: [...new Set(imgs.map((i) => path.extname(i.name)))] };
    }
    return { impressao: out };
  } },

  { id: "T13", area: "Vídeo", nome: "Regras do pipeline: extração só no fim e uma vez; acrescentar efeito vai para antes da extração", run: async (ctx) => {
    const p = await project(ctx, "t13", [path.join(SAMPLES, "sample_10s_720p.mp4")], [["extract_frames", { mode: "count", count: 3, format: "png" }]]);
    await addTool(ctx.user, p.id, "brightness", { brightness: 1.1 });
    const pr = await getProject(ctx.user, p.id);
    const order = [...pr.tools].sort((a, b) => a.position - b.position).map((t) => t.procedure);
    check(order.at(-1) === "extract_frames", `ordem ${order}`);
    const reorder = await request("POST", `${API}/projects/${ctx.user.id}/${p.id}/reorder`, {
      token: ctx.user.token, headers: { "X-Project-Version": String(pr.version) },
      body: [...pr.tools].sort((a, b) => b.position - a.position).map(({ _id, procedure, params }) => ({ _id, procedure, params })) });
    const second = await request("POST", `${API}/projects/${ctx.user.id}/${p.id}/tool`, {
      token: ctx.user.token, headers: { "X-Project-Version": String((await getProject(ctx.user, p.id)).version) },
      body: { procedure: "extract_frames", params: { mode: "count", count: 2, format: "png" } } });
    check(reorder.status === 400, `reordenar com extracao a meio devolveu ${reorder.status}`);
    check(second.status === 400, `segunda extracao devolveu ${second.status}`);
    return { impressao: { ordem: order, reordenarInvalido: reorder.status, segundaExtracao: second.status } };
  } },

  { id: "T14", area: "Projetos mistos", nome: "Projeto com imagem e vídeo: o mesmo efeito aplica-se aos dois; o corte de vídeo não toca na imagem", run: async (ctx) => {
    await waitVideoWorkerIdle();
    const ref = await project(ctx, "t14-ref", [IMG1], [["brightness", { brightness: 1.3 }]]);
    const refImg = (await runAndWait(ctx, ref.id)).results.imgs[0];
    const p = await project(ctx, "t14", [IMG1, path.join(SAMPLES, "sample_10s_720p.mp4")], [["brightness", { brightness: 1.3 }]]);
    const vid = (await getProject(ctx.user, p.id)).imgs.find((i) => i.media_type === "video")._id;
    await addTool(ctx.user, p.id, "trim", { start: 0, end: 4, imgId: vid });
    const r = await runAndWait(ctx, p.id);
    check(r.results.imgs.length === 2, `${r.results.imgs.length} resultados`);
    const img = r.results.imgs.find((x) => x.type !== "video");
    const video = r.results.imgs.find((x) => x.type === "video");
    check(img && video, "falta a imagem ou o video");
    const sameImage = (await imageFingerprint(img)) === (await imageFingerprint(refImg));
    check(sameImage, "a imagem do projeto misto difere da do projeto so com imagem");
    const fp = await videoFingerprint(video, "t14");
    check(Math.abs(fp.duracaoS - 4) <= 0.2, `video com ${fp.duracaoS} s`);
    return { impressao: { imagemIgualAoProjetoSoImagem: sameImage, video: fp } };
  } },

  { id: "T15", area: "Projetos mistos", nome: "Ferramentas incompatíveis: só-imagem num projeto com vídeo e só-vídeo num projeto só com imagens são recusadas", run: async (ctx) => {
    const misto = await project(ctx, "t15-misto", [IMG1, path.join(SAMPLES, "sample_6s.mov")], [["watermark", {}]]);
    const a = await startProcess(ctx.user, misto.id);
    const soImg = await project(ctx, "t15-img", [IMG1], [["subtitles", {}]]);
    const b = await startProcess(ctx.user, soImg.id);
    check(a.status === 400 && /not available for video/i.test(JSON.stringify(a.data)), `misto devolveu ${a.status} ${JSON.stringify(a.data)}`);
    check(b.status === 400, `so imagens devolveu ${b.status}`);
    return { impressao: { misto: [a.status, a.data], soImagens: [b.status, b.data] } };
  } },

  { id: "T16", area: "Cancelamento", nome: "Cancelar uma execução: sem resultados, operações não ficam comprometidas e o projeto volta a processar", run: async (ctx) => {
    await waitVideoWorkerIdle();
    const p = await project(ctx, "t16", [path.join(DADOS, "video-60s.mp4"), IMG1], [["brightness", { brightness: 1.2 }]]);
    const s = await startProcess(ctx.user, p.id);
    check(s.status === 201, `process ${s.status}`);
    await sleep(8000);
    const c = await cancelProcess(ctx.user, p.id);
    check(c.status === 204, `cancel devolveu ${c.status}`);
    await sleep(30000);
    const after = await results(ctx.user, p.id);
    check((after.imgs?.length ?? 0) === 0, `${after.imgs.length} resultados depois de cancelar`);
    await waitVideoWorkerIdle();
    const again = await runAndWait(ctx, p.id);
    check(again.results.imgs.length === 2, `${again.results.imgs.length} resultados na execucao seguinte`);
    return { impressao: { cancelar: c.status, resultadosDepois: 0, novaExecucao: again.results.imgs.length } };
  } },

  { id: "T17", area: "Quotas", nome: "Perfil gratuito: cada efeito em cada vídeo conta uma operação e o limite diário de 5 recusa a execução seguinte", run: async (ctx) => {
    const free = await register("free", "reg-t17");
    const fctx = { user: free, ws: await connectSocket(free) };
    try {
      await waitVideoWorkerIdle();
      const p = await project(fctx, "t17", [path.join(SAMPLES, "sample_6s.mov")], [["brightness", { brightness: 1.1 }], ["contrast", { contrastFactor: 1.1 }], ["saturation", { saturationFactor: 1.1 }]]);
      const r1 = await runAndWait(fctx, p.id);
      const u1 = await request("GET", `${API}/users/${free.id}`, { token: free.token });
      await addTool(free, p.id, "rotate", { degrees: 90 });
      const r2 = await startProcess(free, p.id);
      check(r1.results.imgs.length === 1, "primeira execucao sem resultado");
      check(u1.data.remaining_operations === 2, `operacoes restantes ${u1.data.remaining_operations}`);
      check(r2.status === 403, `segunda execucao devolveu ${r2.status}`);
      return { impressao: { restantesDepoisDe3: u1.data.remaining_operations, segunda: r2.status } };
    } finally { fctx.ws.socket.close(); }
  } },

  { id: "T18", area: "Acesso", nome: "Um utilizador não acede aos projetos nem aos media de outro", run: async (ctx) => {
    const other = await register("premium", "reg-t18");
    const p = await project(ctx, "t18", [IMG1]);
    const a = await request("GET", `${API}/projects/${ctx.user.id}/${p.id}`, { token: other.token });
    const b = await request("GET", `${API}/projects/${ctx.user.id}/${p.id}/imgs`, { token: other.token });
    const c = await request("GET", `${API}/projects/${ctx.user.id}/${p.id}`);
    check([a, b, c].every((r) => r.status === 401 || r.status === 403), `estados ${a.status} ${b.status} ${c.status}`);
    return { impressao: { projeto: a.status, media: b.status, semJwt: c.status } };
  } },
];

// ---------- runner ----------

prepareData();
const user = await register("premium", "regressao");
const ctx = { user, ws: await connectSocket(user) };
const report = { suite: "e2e", modo: MODE, quando: new Date().toISOString(), commit: gitCommit(), testes: [] };
const reference = MODE !== "baseline" && fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, "utf8")) : null;
const newRef = {};

for (const t of TESTS) {
  if (ONLY && !ONLY.includes(t.id)) continue;
  const t0 = now();
  const rec = { id: t.id, area: t.area, nome: t.nome };
  try {
    const r = await t.run(ctx);
    rec.estado = "passou";
    rec.impressao = r?.impressao ?? null;
    rec.detalhes = r?.detalhes ?? null;
    newRef[t.id] = rec.impressao;
    if (reference && reference[t.id] !== undefined && canonical(reference[t.id]) !== canonical(rec.impressao)) {
      rec.estado = "diferente";
      rec.referencia = reference[t.id];
    }
  } catch (e) {
    rec.estado = e instanceof Falha ? "falhou" : "erro";
    rec.mensagem = String(e.message).slice(0, 500);
  }
  rec.segundos = +((now() - t0) / 1000).toFixed(1);
  report.testes.push(rec);
  log(`${t.id} ${rec.estado.toUpperCase()} (${rec.segundos} s) ${t.nome}${rec.mensagem ? " - " + rec.mensagem : ""}`);
  fs.writeFileSync(path.join(OUT, `${MODE}-e2e.json`), JSON.stringify(report, null, 2));
}
ctx.ws.socket.close();
if (MODE === "baseline") {
  const merged = fs.existsSync(REF) && ONLY ? { ...JSON.parse(fs.readFileSync(REF, "utf8")), ...newRef } : newRef;
  fs.writeFileSync(REF, JSON.stringify(merged, null, 2));
}
const count = (s) => report.testes.filter((t) => t.estado === s).length;
log(`e2e: ${count("passou")} passaram, ${count("diferente")} diferentes, ${count("falhou")} falharam, ${count("erro")} com erro`);
process.exit(count("falhou") + count("erro") + count("diferente") ? 1 : 0);
