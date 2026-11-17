// RNF-F2-01 — M1.1 (memory increase per service during an upload) and the
// control measures C1.1 to C1.7. See requisitos-nf.md, section 2 and 4.1.
//
//   node rnf1/medir-memoria.mjs [--reps 5] [--sizes 10,100,500,1000] [--only m11,c13,c14,c15,c16,c17]
import fs from "node:fs";
import path from "node:path";
import {
  API, DADOS, register, createProject, getProject, uploadFile, addMedia, sha256File, sha256Url,
  startMemorySampler, compose, container, docker, containerState, stats, save, gitCommit, sleep, now, log, request,
  REPO,
} from "../lib/comum.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const REPS = Number(args.reps ?? 5);
const SIZES = (args.sizes ?? "10,100,500,1000").split(",").map(Number);
const SAIDA = args.saida ?? "rnf1-memoria.json";
const ONLY = args.only ? args.only.split(",") : ["m11", "c13", "c14", "c15", "c16", "c17"];

const NODE_SERVICES = ["api_gateway", "projects", "img_storage"];
const SAMPLED = ["nginx", ...NODE_SERVICES, "seaweedfs"];
const CRITERION = ["nginx", ...NODE_SERVICES];
const REST_MS = 15000;
const IDLE_WINDOW_MS = 3000;

const file = (mib) => path.join(DADOS, `upload-${mib}MiB.mp4`);
for (const mib of SIZES) if (!fs.existsSync(file(mib))) throw new Error(`falta ${file(mib)}; corra gerar-dados.mjs`);

async function waitApiReady(user) {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await request("GET", `${API}/projects/${user.id}`, { token: user.token, timeoutMs: 5000 });
      if (r.status === 200) return;
    } catch { /* restarting */ }
    await sleep(1000);
  }
  throw new Error("API nao ficou pronta");
}

async function restartNodeServices(user) {
  compose(["restart", ...NODE_SERVICES]);
  compose(["restart", "nginx"]); // nginx caches the upstream IPs; without this it answers 502
  await waitApiReady(user);
  await sleep(REST_MS);
}

// One upload while sampling memory. Returns per-service idle, peak and increase.
async function measuredUpload(sampler, uploadFn) {
  await sleep(IDLE_WINDOW_MS);
  const t0 = now();
  const res = await uploadFn();
  const t1 = now();
  await sleep(1500); // one more sample after the response
  const perService = {};
  for (const svc of SAMPLED) {
    const idle = sampler.window(svc, t0 - IDLE_WINDOW_MS, t0).map((s) => s.mib);
    const during = sampler.window(svc, t0, t1 + 1000).map((s) => s.mib);
    const idleMiB = idle.length ? Math.min(...idle) : null;
    const peakMiB = during.length ? Math.max(...during) : null;
    perService[svc] = {
      idleMiB: idleMiB && +idleMiB.toFixed(1),
      peakMiB: peakMiB && +peakMiB.toFixed(1),
      increaseMiB: idleMiB !== null && peakMiB !== null ? +(peakMiB - idleMiB).toFixed(1) : null,
      samples: during.length,
    };
  }
  return { response: res, perService };
}

// C1.7: objects stored under a project's src/ prefix and multipart uploads still
// open, read from the SeaweedFS filer (published on localhost:9090 in the base).
const FILER = process.env.SEAWEEDFS_FILER || "http://localhost:9090";
const BUCKET_PATH = "/buckets/picturas";
async function filerCount(dir) {
  const res = await fetch(`${FILER}${dir}/?limit=10000`, { headers: { Accept: "application/json" } });
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`filer ${res.status} ${dir}`);
  return ((await res.json()).Entries ?? []).length;
}
const srcObjects = (user, pid) => filerCount(`${BUCKET_PATH}/users/${user.id}/projects/${pid}/src`);
const openMultipartUploads = () => filerCount(`${BUCKET_PATH}/.uploads`);

// C1.5 cases (free account, so the 60 s / 100 MB limits apply). C1.7 reuses them.
function validationCases() {
  const samples = path.join(REPO, "samples", "video");
  return [
    ["sample_10s_720p.mp4", path.join(samples, "sample_10s_720p.mp4")],
    ["sample_6s.mov", path.join(samples, "sample_6s.mov")],
    ["speech_mandela_177s_1080p.webm", path.join(samples, "speech_mandela_177s_1080p.webm")],
    ["too_long_90s.mp4 (acima do limite do perfil gratuito)", path.join(samples, "too_long_90s.mp4")],
    ["corrupted.mp4", path.join(samples, "corrupted.mp4")],
    ["imagem enviada como video", path.join(DADOS, "imagem-q.png")],
    ["upload-100MiB.mp4 (tamanho no limite gratuito)", file(100)],
  ];
}
const mimeOf = (f) => f.endsWith(".png") ? "image/png" : f.endsWith(".mov") ? "video/quicktime" : f.endsWith(".webm") ? "video/webm" : "video/mp4";
const uploadVideoAs = (u, pid, f, version = "0", extra = {}) => uploadFile(`${API}/projects/${u.id}/${pid}/video`, {
  field: "video", file: f, mime: mimeOf(f), token: u.token, headers: { "X-Project-Version": version }, ...extra,
});

async function findMediaUrl(user, pid, originalName) {
  const r = await request("GET", `${API}/projects/${user.id}/${pid}/imgs`, { token: user.token });
  const list = Array.isArray(r.data) ? r.data : [];
  const hit = list.find((m) => (m.name || "").includes(originalName.replace(/\.[^.]+$/, ""))) ?? list[0];
  return hit?.url ?? null;
}

const out = {
  medida: "RNF-F2-01 M1.1 e controlos C1.1-C1.7",
  quando: new Date().toISOString(),
  commit: gitCommit(),
  repeticoes: REPS,
  tamanhosMiB: SIZES,
  servicosAmostrados: SAMPLED,
  servicosNoCriterio: CRITERION,
  m11: {}, c11: {}, c12: {}, c13: null, c14: {}, c15: null, c16: null,
};

const user = await register("premium", "rnf1");
await waitApiReady(user);
const sampler = startMemorySampler(SAMPLED);
await sleep(3000);

try {
  if (ONLY.includes("m11")) {
    for (const mib of SIZES) {
      out.m11[mib] = [];
      for (let rep = 1; rep <= REPS; rep++) {
        await restartNodeServices(user);
        const project = await createProject(user, `m11-${mib}-${rep}`);
        const before = Object.fromEntries(CRITERION.map((s) => [s, containerState(s)]));
        log(`M1.1 ${mib} MiB rep ${rep}/${REPS}`);
        // If the upload takes the Docker engine down, record that instead of aborting.
        const r = await measuredUpload(sampler, () => addMedia(user, project.id, file(mib), { video: true })
          .catch((e) => ({ status: null, body: e.message })));
        let after;
        try { after = Object.fromEntries(CRITERION.map((s) => [s, containerState(s)])); }
        catch (e) {
          out.m11[mib].push({ rep, project: project.id, valid: false, dockerEngineDown: true, status: r.response.status, body: r.response.body, erro: String(e.message).split(String.fromCharCode(10))[0].slice(0, 300), perService: r.perService });
          log(`  -> o motor do Docker deixou de responder durante o envio`);
          save(SAIDA, out);
          process.exit(2);
        }
        const crashed = CRITERION.filter((s) => after[s].restarts > before[s].restarts || after[s].oomKilled || after[s].startedAt !== before[s].startedAt);
        const valid = r.response.status === 204 && crashed.length === 0;
        out.m11[mib].push({ rep, project: project.id, valid, crashed, status: r.response.status, body: r.response.body,
          transferS: r.response.transferS, acceptS: r.response.acceptS, totalS: r.response.totalS, perService: r.perService });
        log(`  -> ${r.response.status} ${valid ? "valida" : "INVALIDA"}`, Object.fromEntries(SAMPLED.map((s) => [s, r.perService[s].increaseMiB])));
        // C1.4: integrity, once per size (first valid repetition).
        if (valid && ONLY.includes("c14") && !out.c14[mib]) {
          const url = await findMediaUrl(user, project.id, path.basename(file(mib)));
          const [sent, got] = await Promise.all([sha256File(file(mib)), url ? sha256Url(url) : null]);
          out.c14[mib] = { sent, stored: got?.sha256 ?? null, storedBytes: got?.bytes ?? null, equal: !!got && got.sha256 === sent };
          log(`  C1.4 ${mib} MiB sha igual=${out.c14[mib].equal}`);
        }
      }
      // C1.1 / C1.2 come from the same uploads.
      const ok = out.m11[mib].filter((x) => x.valid);
      out.c11[mib] = stats(ok.map((x) => x.acceptS));
      out.c12[mib] = stats(ok.map((x) => x.totalS));
      save(SAIDA, out);
    }
    // Summary: worst increase per service and per size, over valid repetitions.
    out.resumo = {};
    for (const mib of SIZES) {
      out.resumo[mib] = {};
      for (const svc of SAMPLED) {
        out.resumo[mib][svc] = stats(out.m11[mib].filter((x) => x.valid).map((x) => x.perService[svc].increaseMiB));
      }
      const worst = CRITERION.map((s) => [s, out.resumo[mib][s].max ?? null]).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))[0];
      out.resumo[mib].piorServicoNoCriterio = { servico: worst[0], maxIncreaseMiB: worst[1] };
      out.resumo[mib].repeticoesValidas = out.m11[mib].filter((x) => x.valid).length;
    }
  }

  if (ONLY.includes("c13")) {
    // C1.3: 500 MiB without JWT. Expected 401; how much memory the gateway used first.
    await restartNodeServices(user);
    const project = await createProject(user, "c13");
    log("C1.3 envio de 500 MiB sem JWT");
    const r = await measuredUpload(sampler, () => uploadFile(`${API}/projects/${user.id}/${project.id}/video`, {
      field: "video", file: file(500), mime: "video/mp4", headers: { "X-Project-Version": "0" },
    }).catch((e) => ({ status: null, error: e.message })));
    out.c13 = { status: r.response.status, body: r.response.body, transferS: r.response.transferS, apiGatewayIncreaseMiB: r.perService.api_gateway.increaseMiB, perService: r.perService };
    log(`  -> ${out.c13.status}, api_gateway +${out.c13.apiGatewayIncreaseMiB} MiB`);
    save(SAIDA, out);
  }

  if (ONLY.includes("c15")) {
    // C1.5: validation decisions (free account, so the 60 s / 100 MB limits apply).
    const free = await register("free", "rnf1-c15");
    out.c15 = [];
    for (const [label, f] of validationCases()) {
      const project = await createProject(free, `c15-${out.c15.length}`);
      const r = await uploadVideoAs(free, project.id, f);
      out.c15.push({ caso: label, status: r.status, resposta: r.body });
      log(`C1.5 ${label}: ${r.status} ${r.body}`);
    }
    save(SAIDA, out);
  }

  if (ONLY.includes("c16")) {
    // C1.6: temporary files left in the upload path after a complete and an interrupted upload.
    const tmpCount = () => Object.fromEntries(NODE_SERVICES.map((s) => {
      try { return [s, Number(docker(["exec", container(s), "sh", "-c", "find /tmp -type f 2>/dev/null | wc -l"]))]; }
      catch { return [s, null]; }
    }));
    await restartNodeServices(user);
    const before = tmpCount();
    const p1 = await createProject(user, "c16-completo");
    const complete = await addMedia(user, p1.id, file(100), { video: true });
    await sleep(3000);
    const afterComplete = tmpCount();
    const p2 = await createProject(user, "c16-interrompido");
    const interrupted = await uploadFile(`${API}/projects/${user.id}/${p2.id}/video`, {
      field: "video", file: file(500), mime: "video/mp4", token: user.token, headers: { "X-Project-Version": "0" }, abortAt: 0.5,
    });
    await sleep(10000);
    const afterInterrupted = tmpCount();
    out.c16 = { before, complete: { status: complete.status, tmpFiles: afterComplete }, interrupted: { aborted: interrupted.aborted, tmpFiles: afterInterrupted } };
    log("C1.6", JSON.stringify(out.c16));
    save(SAIDA, out);
  }

  if (ONLY.includes("c17")) {
    // C1.7: objects left in storage. An accepted upload leaves exactly one object
    // in the project's src/; a rejected, conflicting or interrupted one leaves none,
    // and no multipart upload stays open.
    const free = await register("free", "rnf1-c17");
    const uploadsBefore = await openMultipartUploads();
    const casos = [];
    for (const [label, f] of validationCases()) {
      const project = await createProject(free, `c17-${casos.length}`);
      const r = await uploadVideoAs(free, project.id, f);
      await sleep(1000);
      casos.push({ caso: label, status: r.status, objetosSrc: await srcObjects(free, project.id), esperado: r.status === 204 ? 1 : 0 });
    }
    // Version conflict: the second upload carries a stale X-Project-Version.
    {
      const project = await createProject(user, "c17-conflito");
      const first = await addMedia(user, project.id, path.join(REPO, "samples", "video", "sample_6s.mov"));
      const stale = await uploadVideoAs(user, project.id, path.join(REPO, "samples", "video", "sample_10s_720p.mp4"), "0");
      await sleep(1000);
      casos.push({ caso: "conflito de versão (segundo envio com versão antiga)", status: `${first.status}, ${stale.status}`,
        objetosSrc: await srcObjects(user, project.id), esperado: first.status === 204 ? 1 : 0 });
    }
    // Upload interrupted halfway through.
    {
      const project = await createProject(user, "c17-interrompido");
      const r = await uploadVideoAs(user, project.id, file(100), "0", { abortAt: 0.5 });
      await sleep(10000);
      casos.push({ caso: "envio de 100 MiB interrompido a meio", status: r.aborted ? "interrompido" : r.status,
        objetosSrc: await srcObjects(user, project.id), esperado: 0 });
    }
    await sleep(5000);
    const uploadsAfter = await openMultipartUploads();
    out.c17 = {
      casos,
      envioEmPartesAbertos: { antes: uploadsBefore, depois: uploadsAfter },
      semOrfaos: casos.every((c) => c.objetosSrc === c.esperado) && uploadsAfter <= uploadsBefore,
    };
    for (const c of casos) log(`C1.7 ${c.caso}: ${c.status}, ${c.objetosSrc} objeto(s) em src/ (esperado ${c.esperado})`);
    log(`C1.7 envios em partes abertos: ${uploadsBefore} -> ${uploadsAfter}; sem órfãos: ${out.c17.semOrfaos}`);
    save(SAIDA, out);
  }
} finally {
  sampler.stop();
}
save(SAIDA, out);
process.exit(0);
