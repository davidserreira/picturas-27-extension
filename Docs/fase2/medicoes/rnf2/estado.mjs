// RNF-F2-02 — intermediate checks of the ADR-02 steps, on the server side (no
// browser). Starts P through the API and follows its run through the state
// route (polled every 250 ms) and the WebSocket events.
//
//   MEDICAO=passos-rnf2/passo-N node rnf2/estado.mjs [--video 120] [--cancelar 20]
//
// Records the run duration (until the results are in the API), the largest
// interval between progress changes seen through the route and through the
// run-status events, the final state, the active-runs route mid-run and C2.3
// (state route with another user's JWT and without JWT; events received by
// another user's socket). With --cancelar N the run is cancelled through the
// API at N% and the state must turn to "cancelled".
import path from "node:path";
import { io } from "socket.io-client";
import {
  BASE, API, DADOS, register, createProject, addMedia, addTool, startProcess, cancelProcess,
  results, waitVideoWorkerIdle, request, save, gitCommit, sleep, now, log,
} from "../lib/comum.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const VIDEO_S = Number(args.video ?? 120);
const CANCEL_AT = args.cancelar === undefined ? null : Number(args.cancelar);
const P_VIDEO = path.join(DADOS, `p-video-${VIDEO_S}s.mp4`);
const IMG_P = [path.join(DADOS, "imagem-p1.png"), path.join(DADOS, "imagem-p2.png")];

function connect(user) {
  const socket = io(BASE, { transports: ["websocket"], rejectUnauthorized: false, auth: { token: user.token } });
  const events = [];
  for (const name of ["run-status", "video-progress", "process-update", "process-error"]) {
    socket.on(name, (payload) => events.push({ name, t: now(), payload }));
  }
  return new Promise((resolve) => {
    socket.on("connect", () => resolve({ socket, events }));
    setTimeout(() => resolve({ socket, events }), 5000);
  });
}

// Largest interval between two consecutive changes of a value, in seconds.
function maxGap(samples) {
  let last = null; let lastT = null; let gap = 0; let changes = 0;
  for (const { t, v } of samples) {
    if (v === null || v === undefined || v === last) continue;
    if (lastT !== null) gap = Math.max(gap, t - lastT);
    last = v; lastT = t; changes++;
  }
  return { maiorIntervaloS: +(gap / 1000).toFixed(2), mudancas: changes };
}

const user = await register("premium", "rnf2-estado");
const intruder = await register("premium", "rnf2-estado-intruso");
const own = await connect(user);
const other = await connect(intruder);

await waitVideoWorkerIdle();
const P = await createProject(user, `P-estado-${Date.now() % 100000}`);
for (const f of [P_VIDEO, ...IMG_P]) {
  const r = await addMedia(user, P.id, f);
  if (r.status !== 204) throw new Error(`upload ${path.basename(f)} -> ${r.status}`);
}
await addTool(user, P.id, "brightness", { brightness: 1.2 });
await addTool(user, P.id, "contrast", { contrastFactor: 1.2 });

const statusUrl = `${API}/projects/${user.id}/${P.id}/process/status`;
const activeUrl = `${API}/projects/${user.id}/process/active`;
const out = {
  medida: "RNF-F2-02 verificação intermédia do ADR-02 (servidor)", quando: new Date().toISOString(),
  commit: gitCommit(), video: path.basename(P_VIDEO), P: P.id,
  antes: (await request("GET", statusUrl, { token: user.token })).data,
};

log(`Apply em ${P.name}`);
const t0 = now();
const start = await startProcess(user, P.id);
out.arranque = start.status;
const route = [];
let tDone = null; let lastApi = 0; let final = null; let cancelled = null; let mid = null;
while (now() - t0 < 30 * 60000) {
  const r = await request("GET", statusUrl, { token: user.token });
  const t = now();
  route.push({ t, v: r.data?.progress ?? null, status: r.data?.status ?? `http ${r.status}` });
  if (!mid && r.data?.status === "running" && ((r.data.progress ?? 0) >= 30 || now() - t0 > 20000)) {
    const a = await request("GET", activeUrl, { token: user.token });
    const c23Outro = await request("GET", statusUrl, { token: intruder.token });
    const c23Sem = await request("GET", statusUrl, {});
    mid = {
      progresso: r.data.progress,
      ativas: { status: a.status, incluiP: Array.isArray(a.data) && a.data.some((x) => x.projectId === P.id && x.status === "running") },
      c23: { outroUtilizador: c23Outro.status, semJwt: c23Sem.status, recusadoNosDois: c23Outro.status >= 400 && c23Sem.status >= 400 },
    };
    log(`a meio: ${JSON.stringify(mid)}`);
  }
  if (CANCEL_AT !== null && !cancelled && (r.data?.progress ?? 0) >= CANCEL_AT) {
    const c = await cancelProcess(user, P.id);
    cancelled = { em: r.data.progress, status: c.status, t: now() };
    log(`cancelado a ${r.data.progress}%: ${c.status}`);
  }
  if (["done", "failed", "cancelled"].includes(r.data?.status) && r.data?.token) {
    final = r.data;
    if (final.status !== "done") break;
  }
  if (t - lastApi > 500 && tDone === null) {
    lastApi = t;
    if (((await results(user, P.id)).imgs?.length ?? 0) > 0) tDone = now();
  }
  if (final && tDone !== null) break;
  await sleep(250);
}
if (cancelled) {
  await sleep(10000);
  const firstCancelled = route.find((x) => x.status === "cancelled");
  out.cancelamento = {
    em: cancelled.em, status: cancelled.status,
    estadoCanceladoAposS: firstCancelled ? +((firstCancelled.t - cancelled.t) / 1000).toFixed(2) : null,
    resultadosDepois: (await results(user, P.id)).imgs?.length ?? 0,
  };
}
await sleep(2000);
own.socket.close(); other.socket.close();

const runEvents = own.events.filter((e) => e.name === "run-status" && e.payload?.projectId === P.id);
const videoEvents = own.events.filter((e) => e.name === "video-progress" && e.payload?.projectId === P.id);
out.duracaoS = tDone ? +((tDone - t0) / 1000).toFixed(1) : null;
out.estadoFinal = final;
out.aMeio = mid;
out.rota = { amostras: route.length, ...maxGap(route.filter((x) => x.status === "running")) };
out.eventosRunStatus = { n: runEvents.length, ...maxGap(runEvents.filter((e) => e.payload.status === "running").map((e) => ({ t: e.t, v: e.payload.progress }))), estados: [...new Set(runEvents.map((e) => e.payload.status))] };
out.eventosVideoProgress = { n: videoEvents.length, ...maxGap(videoEvents.map((e) => ({ t: e.t, v: e.payload.percent }))), inteiros: videoEvents.every((e) => Number.isInteger(e.payload.percent)) };
out.eventosNoutroUtilizador = other.events.length;
out.primeiroProgressoS = (() => { const f = route.find((x) => x.status === "running" && x.v > 0); return f ? +((f.t - t0) / 1000).toFixed(2) : null; })();
log(`duracao ${out.duracaoS} s; rota: ${JSON.stringify(out.rota)}; run-status: ${JSON.stringify(out.eventosRunStatus)}; video-progress: ${JSON.stringify(out.eventosVideoProgress)}; noutro utilizador: ${out.eventosNoutroUtilizador}`);
save(`rnf2-estado${CANCEL_AT !== null ? "-cancelar" : ""}.json`, out);
process.exit(0);
