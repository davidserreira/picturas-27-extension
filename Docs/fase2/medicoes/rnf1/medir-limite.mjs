// RNF-F2-01 — M1.2: largest file uploaded successfully with nginx, api_gateway,
// projects and img_storage capped at 512 MiB each (compose.limites.yaml).
//
//   node rnf1/medir-limite.mjs [--reps 3] [--sizes 10,100,500,1000]
// The stack is put back without the caps at the end, also on failure.
import fs from "node:fs";
import path from "node:path";
import {
  API, DADOS, REPO, register, createProject, addMedia, sha256File, sha256Url, compose, containerState,
  save, gitCommit, sleep, log, request,
} from "../lib/comum.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const REPS = Number(args.reps ?? 3);
const SIZES = (args.sizes ?? "10,100,500,1000").split(",").map(Number);
const CAPPED = ["nginx", "api_gateway", "projects", "img_storage"];
const NODE_SERVICES = ["api_gateway", "projects", "img_storage"];
const OVERRIDE = "Docs/fase2/medicoes/rnf1/compose.limites.yaml";
const file = (mib) => path.join(DADOS, `upload-${mib}MiB.mp4`);

async function waitApiReady(user) {
  for (let i = 0; i < 180; i++) {
    try {
      const r = await request("GET", `${API}/projects/${user.id}`, { token: user.token, timeoutMs: 5000 });
      if (r.status === 200) return true;
    } catch { /* restarting */ }
    await sleep(1000);
  }
  return false;
}

const out = {
  medida: "RNF-F2-01 M1.2",
  quando: new Date().toISOString(),
  commit: gitCommit(),
  override: OVERRIDE,
  limiteMiB: 512,
  repeticoes: REPS,
  resultados: {},
};

log(`a aplicar ${OVERRIDE}`);
compose(["-f", "docker-compose.yaml", "-f", OVERRIDE, "up", "-d", ...CAPPED]);
compose(["restart", "nginx"]); // recreated containers get new IPs; nginx keeps the old ones
try {
  let user = null;
  for (let i = 0; i < 60 && !user; i++) {
    try { user = await register("premium", "rnf1-m12"); } catch { await sleep(2000); }
  }
  if (!user) throw new Error("registo falhou depois de aplicar os limites");
  if (!(await waitApiReady(user))) throw new Error("API nao ficou pronta com os limites");
  let largest = 0;
  for (const mib of SIZES) {
    out.resultados[mib] = [];
    let allOk = true;
    const sent = await sha256File(file(mib));
    for (let rep = 1; rep <= REPS; rep++) {
      compose(["restart", ...NODE_SERVICES]);
      compose(["restart", "nginx"]); // nginx caches the upstream IPs
      await waitApiReady(user);
      await sleep(15000);
      const before = Object.fromEntries(CAPPED.map((s) => [s, containerState(s)]));
      const project = await createProject(user, `m12-${mib}-${rep}`);
      log(`M1.2 ${mib} MiB rep ${rep}/${REPS}`);
      let res;
      try { res = await addMedia(user, project.id, file(mib), { video: true }); }
      catch (e) { res = { status: null, body: e.message }; }
      await sleep(3000);
      const after = Object.fromEntries(CAPPED.map((s) => [s, containerState(s)]));
      const crashed = CAPPED.filter((s) => after[s].oomKilled || after[s].restarts > before[s].restarts || after[s].startedAt !== before[s].startedAt);
      let integrity = null;
      if (res.status === 204 && crashed.length === 0) {
        await waitApiReady(user);
        const r = await request("GET", `${API}/projects/${user.id}/${project.id}/imgs`, { token: user.token });
        const url = Array.isArray(r.data) && r.data[0]?.url;
        const got = url ? await sha256Url(url).catch(() => null) : null;
        integrity = { inProject: Array.isArray(r.data) && r.data.length === 1, equal: !!got && got.sha256 === sent };
      }
      const success = res.status === 204 && crashed.length === 0 && integrity?.inProject && integrity?.equal;
      out.resultados[mib].push({ rep, status: res.status, body: res.body, crashed, oom: CAPPED.filter((s) => after[s].oomKilled), integrity, success, totalS: res.totalS });
      log(`  -> ${res.status} sucesso=${success} reiniciados=${crashed.join(",") || "-"}`);
      if (!success) allOk = false;
      if (crashed.length) await waitApiReady(user);
      save("rnf1-limite.json", out);
    }
    if (!allOk) { log(`serie parada em ${mib} MiB`); break; }
    largest = mib;
  }
  out.maiorFicheiroAceiteMiB = largest;
  log(`maior ficheiro aceite: ${largest} MiB`);
} finally {
  log("a repor a stack sem limites");
  compose(["up", "-d", ...CAPPED]);
  compose(["restart", "nginx"]);
  save("rnf1-limite.json", out);
}
process.exit(0);
