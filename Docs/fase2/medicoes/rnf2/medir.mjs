// RNF-F2-02 — background work during processing. Browser measurements with
// Playwright (Chromium) against https://localhost:8080. See requisitos-nf.md,
// section 3 and 4.2.
//
//   node rnf2/medir.mjs calibrar [--video 120]   time of one run of P (target 150-300 s)
//   node rnf2/medir.mjs m21  [--execucoes 3]     M2.1 actions during a run
//   node rnf2/medir.mjs m22  [--execucoes 3]     M2.2 time to reflect state (reload, end)
//   node rnf2/medir.mjs m23  [--tentativas 5]    M2.3 cancel after losing the page (A and B)
//   node rnf2/medir.mjs controlos [--execucoes 3] C2.1, C2.2 (UI), C2.3, C2.4, C2.5 (API)
//                                 [--so c21]     only C2.1 and C2.2
//
// The P video is chosen with --video <seconds> or the PICTURAS_P_VIDEO env var
// (file dados/p-video-<s>s.mp4, made by gerar-dados.mjs --video <s>).
// Criteria are written in terms of what the user sees (roles, names, text),
// not element ids. If the refactored UI changes, adapt the locators in the
// UI section below and record the change in the README; never the criteria.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  BASE, API, DADOS, register, createProject, getProject, addMedia, addTool, startProcess, cancelProcess,
  results, waitForResults, waitVideoWorkerIdle, sha256Url, request, stats, save, gitCommit, sleep, now, log,
} from "../lib/comum.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const VIDEO_S = Number(args.video ?? process.env.PICTURAS_P_VIDEO ?? 120);
const P_VIDEO = path.join(DADOS, `p-video-${VIDEO_S}s.mp4`);
const IMG_P = [path.join(DADOS, "imagem-p1.png"), path.join(DADOS, "imagem-p2.png")];
const IMG_Q = path.join(DADOS, "imagem-q.png");
const IMG_NOVA = path.join(DADOS, "imagem-nova.png");
for (const f of [P_VIDEO, ...IMG_P, IMG_Q, IMG_NOVA]) {
  if (!fs.existsSync(f)) throw new Error(`falta ${f}; corra gerar-dados.mjs (e --video ${VIDEO_S})`);
}
const ACTION_LIMIT_MS = 10000;
const RECOVER_LIMIT_MS = 60000;
const HEADLESS = process.env.HEADED ? false : true;
const VIDEO_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", process.env.MEDICAO || "baseline", "videos");

// ---------- fixtures (through the API) ----------

async function setupP(user, label) {
  const p = await createProject(user, `P-${label}-${Date.now() % 100000}`);
  for (const f of [P_VIDEO, ...IMG_P]) {
    const r = await addMedia(user, p.id, f);
    if (r.status !== 204) throw new Error(`upload ${path.basename(f)} -> ${r.status} ${r.body}`);
  }
  await addTool(user, p.id, "brightness", { brightness: 1.2 });
  await addTool(user, p.id, "contrast", { contrastFactor: 1.2 });
  return p;
}

async function setupQ(user, { tool } = {}) {
  const q = await createProject(user, `Q-${Date.now() % 100000}`);
  const r = await addMedia(user, q.id, IMG_Q);
  if (r.status !== 204) throw new Error(`upload Q -> ${r.status}`);
  if (tool) await addTool(user, q.id, "brightness", { brightness: 1.2 });
  return q;
}

// ---------- UI ----------

async function newContext(browser, label) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
}

async function login(page, user) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: /login|sign in|entrar/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

async function openProject(page, p) {
  // Opening a project fires POST .../dirty, which bumps the project version.
  // Wait for it and for the page to settle, or Apply goes out with the old
  // version and gets 409 (a race in the base, also reachable by a fast user).
  const dirty = page.waitForResponse((r) => /\/dirty/.test(r.url()) && r.request().method() === "POST", { timeout: 15000 }).catch(() => null);
  await page.goto(`${BASE}/dashboard/${p.id}`);
  await applyButton(page).waitFor({ state: "visible", timeout: 30000 });
  await dirty;
  await sleep(3000);
}

const applyButton = (page) => page.getByRole("button", { name: /^\s*apply\s*$/i });

// The progress of P as the user sees it: a visible progress bar, on P's page
// or next to P's name elsewhere in the app. Returns the value (0-100) or null.
async function progressOfP(page, p) {
  const bars = page.getByRole("progressbar");
  const n = await bars.count();
  const onP = page.url().includes(p.id);
  for (let i = 0; i < n; i++) {
    const bar = bars.nth(i);
    if (!(await bar.isVisible().catch(() => false))) continue;
    if (!onP) {
      const near = await bar.evaluate((el, name) => {
        for (let e = el, k = 0; e && k < 6; e = e.parentElement, k++) if ((e.textContent || "").includes(name)) return true;
        return false;
      }, p.name).catch(() => false);
      if (!near) continue;
    }
    // aria-valuenow when the bar exposes it; otherwise the position of the
    // indicator (the base Progress component draws it with translateX(-N%)
    // and does not forward the value to the accessible element).
    const v = await bar.getAttribute("aria-valuenow");
    if (v !== null) return Number(v);
    const drawn = await bar.evaluate((el) => {
      const ind = el.firstElementChild;
      const m = ind && /translateX\(-?([\d.]+)%\)/.exec(ind.style.transform || "");
      return m ? 100 - parseFloat(m[1]) : null;
    }).catch(() => null);
    return drawn === null ? 0 : Math.round(drawn);
  }
  return null;
}

async function waitProgress(page, p, predicate, limitMs) {
  const t0 = now();
  while (now() - t0 < limitMs) {
    const v = await progressOfP(page, p);
    if (v !== null && predicate(v)) return { ms: now() - t0, value: v };
    await sleep(100);
  }
  return null;
}

// A notification that names P (toast, status or alert region).
async function notificationOfP(page, p) {
  return page.locator("[role=status], [role=alert], [aria-live]").filter({ hasText: p.name }).first()
    .isVisible().catch(() => false);
}

// Clicks Apply and checks that the run really started (201). A 409 is retried
// once after 3 s; every attempt is counted in applyStats for the report.
const applyStats = { cliques: 0, conflitos409: 0, falhas: 0 };
async function clickApply(page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = page.waitForResponse((r) => /\/process(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 20000 }).catch(() => null);
    await applyButton(page).click({ timeout: ACTION_LIMIT_MS });
    const t = now();
    applyStats.cliques++;
    const r = await resp;
    if (r && r.status() < 300) return t;
    if (r && r.status() === 409) { applyStats.conflitos409++; await sleep(3000); continue; }
    break;
  }
  applyStats.falhas++;
  throw new Error("Apply nao iniciou a execucao");
}

async function attempt(fn) {
  const t0 = now();
  try {
    const note = await fn();
    return { a: true, ms: Math.round(now() - t0), note: note ?? null };
  } catch (e) {
    return { a: false, ms: Math.round(now() - t0), note: String(e.message).split("\n")[0].slice(0, 200) };
  }
}

async function pollApi(check, limitMs = ACTION_LIMIT_MS) {
  const t0 = now();
  while (now() - t0 < limitMs) { if (await check()) return true; await sleep(250); }
  throw new Error("resultado esperado nao apareceu na API em 10 s");
}

// ---------- M2.1 ----------

function actions(ctx) {
  const { page, user, P, Q } = ctx;
  const L = { timeout: ACTION_LIMIT_MS };
  return [
    { n: 1, g: "G2", desc: "Em P, alternar para o carrossel", run: async () => {
      await page.getByRole("button", { name: "Carousel view" }).click(L);
      await page.getByRole("button", { name: "Carousel view", pressed: true }).waitFor(L);
    } },
    { n: 2, g: "G2", desc: "Em P, voltar a grelha e ver os tres media", run: async () => {
      await page.getByRole("button", { name: "Grid view" }).click(L);
      await page.getByRole("button", { name: "Grid view", pressed: true }).waitFor(L);
      await pollApi(async () => (await page.locator("main img, main video").count()) >= 3);
    } },
    { n: 3, g: "G2", desc: "Em P, descarregar os media originais", run: async () => {
      await page.locator('button[title="Download project"]').click(L);
      const dl = page.waitForEvent("download", L);
      await page.getByRole("menuitem", { name: /download media \(zip\)/i }).click(L);
      return (await dl).suggestedFilename();
    } },
    { n: 4, g: "G2", desc: "Em P, abrir o dialogo de partilha", run: async () => {
      await page.getByRole("button", { name: /^share/i }).click(L);
      await page.getByRole("dialog").getByText("Share project").waitFor(L);
      await page.keyboard.press("Escape");
    } },
    { n: 5, g: "G1", desc: "Abrir a pagina da conta", run: async () => {
      await page.getByRole("button", { name: new RegExp(user.name) }).click(L);
      await page.getByRole("menuitem", { name: /^account$/i }).click(L);
      await page.waitForURL(/\/dashboard\/account/, L);
      await page.getByText("Personal Information").waitFor(L);
    } },
    { n: 6, g: "G1", desc: "Abrir o projeto Q pela barra lateral", run: async () => {
      // The account page has its own sidebar without the project list: go
      // back through its "Go Back" button first, as a user would.
      const qLink = page.getByRole("link", { name: Q.name });
      if (!(await qLink.isVisible().catch(() => false))) {
        const back = page.getByRole("button", { name: /go back/i });
        if (await back.isVisible().catch(() => false)) await back.click(L);
      }
      await qLink.click(L);
      await page.waitForURL(new RegExp(Q.id), L);
      await pollApi(async () => (await page.locator("main img").count()) >= 1);
    } },
    { n: 7, g: "G1", desc: "Carregar uma imagem para Q", run: async () => {
      await page.getByRole("button", { name: /import/i }).click(L);
      await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(IMG_NOVA, L);
      await page.getByRole("dialog").getByRole("button", { name: /^add$/i }).click(L);
      await pollApi(async () => (await getProject(user, Q.id)).imgs.length >= 2);
    } },
    { n: 8, g: "G1", desc: "Acrescentar brilho ao pipeline de Q e guardar", run: async () => {
      await page.getByRole("button", { name: "Carousel view" }).click(L);
      await page.getByRole("button", { name: "Brightness" }).click(L);
      await page.getByRole("slider").first().focus(L);
      await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: /^save$/i }).click(L);
      await pollApi(async () => (await getProject(user, Q.id)).tools.some((t) => t.procedure === "brightness"));
    } },
    { n: 9, g: "G1", desc: "Criar um projeto novo pela barra lateral", run: async () => {
      const before = page.url();
      await page.getByRole("button", { name: /new project/i }).click(L);
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("Enter project name").fill(`Novo-${Date.now() % 100000}`, L);
      await dialog.locator('input[type="file"]').setInputFiles(IMG_NOVA, L);
      await dialog.getByRole("button", { name: /^create$/i }).click(L);
      await page.waitForURL((u) => u.href !== before && /\/dashboard\/[0-9a-f]{24}/.test(u.href) && !u.href.includes(P.id) && !u.href.includes(Q.id), L);
    } },
    { n: 10, g: "G1", desc: "Voltar a P", run: async () => {
      await page.getByRole("link", { name: P.name }).click(L);
      await page.waitForURL(new RegExp(P.id), L);
      if ((await waitProgress(page, P, () => true, ACTION_LIMIT_MS)) === null) throw new Error("P nao mostra o progresso");
    } },
  ];
}

async function m21(browser, user) {
  const execs = Number(args.execucoes ?? 3);
  const out = { medida: "RNF-F2-02 M2.1", quando: new Date().toISOString(), commit: gitCommit(), video: path.basename(P_VIDEO), execucoes: [] };
  for (let e = 1; e <= execs; e++) {
    await waitVideoWorkerIdle();
    const P = await setupP(user, `m21-${e}`);
    const Q = await setupQ(user);
    const context = await newContext(browser);
    const page = await context.newPage();
    await login(page, user);
    await openProject(page, P);
    log(`M2.1 execucao ${e}: Apply em ${P.name}`);
    const tApply = await clickApply(page);
    const ten = await waitProgress(page, P, (v) => v >= 10, 15 * 60000);
    const rec = { execucao: e, P: P.id, Q: Q.id, inicio10pctS: ten ? +((now() - tApply) / 1000).toFixed(1) : null, acoes: [] };
    for (const act of actions({ page, user, P, Q })) {
      const r = await attempt(act.run);
      await sleep(500);
      const prog = await progressOfP(page, P);
      const b = prog !== null;
      rec.acoes.push({ n: act.n, grupo: act.g, acao: act.desc, a: r.a, b, concluida: r.a && b, ms: r.ms, progressoVisivel: prog, url: page.url().replace(BASE, ""), nota: r.note });
      log(`  ${act.n} ${act.desc}: a=${r.a} b=${b} ${r.ms}ms ${r.note ?? ""}`);
    }
    const res = await results(user, P.id);
    rec.valida = (res.imgs?.length ?? 0) === 0;
    rec.concluidas = rec.acoes.filter((x) => x.concluida).length;
    rec.percentagem = rec.concluidas * 10;
    rec.g1Completo = rec.acoes.filter((x) => x.grupo === "G1").every((x) => x.concluida);
    out.execucoes.push(rec);
    await context.close();
    save("rnf2-m21.json", out);
    await waitForResults(user, P.id);
  }
  const valid = out.execucoes.filter((x) => x.valida);
  out.resumo = {
    execucoesValidas: valid.length,
    percentagem: stats(valid.map((x) => x.percentagem)),
    pior: valid.length ? Math.min(...valid.map((x) => x.percentagem)) : null,
    g1CompletoEmTodas: valid.every((x) => x.g1Completo),
    porAcao: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1,
      { a: valid.filter((x) => x.acoes[i].a).length, b: valid.filter((x) => x.acoes[i].b).length, concluida: valid.filter((x) => x.acoes[i].concluida).length }])),
  };
  save("rnf2-m21.json", out);
}

// ---------- M2.2 ----------

async function reloadAndTime(page, P) {
  const before = await progressOfP(page, P);
  await page.reload({ waitUntil: "load" });
  const t0 = now();
  const floor = before === null ? -Infinity : before - 5;
  const got = await waitProgress(page, P, (v) => v >= floor, RECOVER_LIMIT_MS);
  return { progressoAntes: before, recuperaS: got ? +(got.ms / 1000).toFixed(2) : null, valorDepois: got?.value ?? null, naoRecupera: !got, aposLoadS: +((now() - t0) / 1000).toFixed(1) };
}

async function m22(browser, user, T) {
  const execs = Number(args.execucoes ?? 3);
  const out = { medida: "RNF-F2-02 M2.2", quando: new Date().toISOString(), commit: gitCommit(), video: path.basename(P_VIDEO), duracaoReferenciaS: T, execucoes: [] };
  for (let e = 1; e <= execs; e++) {
    await waitVideoWorkerIdle();
    const P = await setupP(user, `m22-${e}`);
    const Q = await setupQ(user);
    const context = await newContext(browser);
    const page = await context.newPage();
    await login(page, user);
    await openProject(page, P);
    log(`M2.2 execucao ${e}`);
    const tApply = await clickApply(page);
    const rec = { execucao: e, P: P.id, R: [], F: null };
    for (const frac of [0.25, 0.6]) {
      const wait = tApply + frac * T * 1000 - now();
      if (wait > 0) await sleep(wait);
      const r = await reloadAndTime(page, P);
      rec.R.push({ momento: frac, ...r });
      log(`  R@${frac * 100}%: ${r.naoRecupera ? "nao recupera" : r.recuperaS + " s"} (antes ${r.progressoAntes})`);
    }
    // F: wait for the end on another page (Q).
    try { await page.getByRole("link", { name: Q.name }).click({ timeout: ACTION_LIMIT_MS }); }
    catch { await page.goto(`${BASE}/dashboard/${Q.id}`); }
    await page.waitForURL(new RegExp(Q.id));
    let tSeen = null; let tDone = null;
    const t0 = now();
    while (now() - t0 < 20 * 60000) {
      if (tSeen === null && (await notificationOfP(page, P))) tSeen = now();
      if (tDone === null) {
        const r = await results(user, P.id);
        if ((r.imgs?.length ?? 0) > 0) tDone = now();
      }
      if (tDone !== null && (tSeen !== null || now() - tDone > RECOVER_LIMIT_MS)) break;
      await sleep(100);
    }
    rec.F = tDone === null ? { erro: "execucao nao terminou" }
      : { notificaS: tSeen === null ? null : +Math.max(0, (tSeen - tDone) / 1000).toFixed(2), naoRecupera: tSeen === null };
    log(`  F: ${rec.F.naoRecupera ? "nao recupera" : rec.F.notificaS + " s"}`);
    out.execucoes.push(rec);
    await context.close();
    save("rnf2-m22.json", out);
  }
  const R = out.execucoes.flatMap((x) => x.R);
  const F = out.execucoes.map((x) => x.F);
  out.resumo = {
    R: { valores: R.length, naoRecupera: R.filter((x) => x.naoRecupera).length, tempos: stats(R.filter((x) => !x.naoRecupera).map((x) => x.recuperaS)) },
    F: { valores: F.length, naoRecupera: F.filter((x) => x.naoRecupera).length, tempos: stats(F.filter((x) => !x.naoRecupera).map((x) => x.notificaS)) },
  };
  save("rnf2-m22.json", out);
}

// ---------- M2.3 ----------

async function m23(browser, user) {
  const perForm = Number(args.tentativas ?? 5);
  const out = { medida: "RNF-F2-02 M2.3", quando: new Date().toISOString(), commit: gitCommit(), video: path.basename(P_VIDEO), tentativas: [] };
  for (const form of ["A", "B"]) {
    for (let i = 1; i <= perForm; i++) {
      await waitVideoWorkerIdle();
      const P = await setupP(user, `m23-${form}${i}`);
      const context = await newContext(browser);
      let page = await context.newPage();
      await login(page, user);
      await openProject(page, P);
      const tApply = await clickApply(page);
      await waitProgress(page, P, (v) => v >= 10, 15 * 60000);
      const before = await results(user, P.id);
      let other = null;
      if (form === "A") {
        await page.reload({ waitUntil: "load" });
      } else {
        other = await newContext(browser);
        page = await other.newPage();
        await login(page, user);
        await page.goto(`${BASE}/dashboard/${P.id}`, { waitUntil: "load" });
      }
      const rec = { forma: form, tentativa: i, P: P.id, oferecido: false, oferecidoS: null, parou: false, parouS: null, resultadosIguais: null };
      const t0 = now();
      const cancel = page.getByRole("button", { name: /cancel/i }).first();
      try {
        await cancel.waitFor({ state: "visible", timeout: ACTION_LIMIT_MS });
        rec.oferecido = true;
        rec.oferecidoS = +((now() - t0) / 1000).toFixed(2);
        await cancel.click({ timeout: ACTION_LIMIT_MS });
        const t1 = now();
        while (now() - t1 < 5000) {
          if ((await progressOfP(page, P)) === null && (await applyButton(page).isEnabled().catch(() => false))) {
            rec.parou = true; rec.parouS = +((now() - t1) / 1000).toFixed(2); break;
          }
          await sleep(100);
        }
        await sleep(30000);
        const after = await results(user, P.id);
        rec.resultadosIguais = JSON.stringify((after.imgs ?? []).map((x) => x.name).sort()) === JSON.stringify((before.imgs ?? []).map((x) => x.name).sort());
      } catch (e) {
        rec.nota = String(e.message).split("\n")[0].slice(0, 200);
      }
      rec.sucesso = rec.oferecido && rec.parou && rec.resultadosIguais === true;
      if (!rec.sucesso) {
        const c = await cancelProcess(user, P.id);
        rec.canceladoPelaApi = c.status;
      }
      log(`M2.3 ${form}${i}: oferecido=${rec.oferecido} parou=${rec.parou} sucesso=${rec.sucesso}`);
      out.tentativas.push(rec);
      if (other) await other.close();
      await context.close();
      save("rnf2-m23.json", out);
    }
  }
  const by = (f) => out.tentativas.filter((x) => x.forma === f);
  out.resumo = {
    A: { sucessos: by("A").filter((x) => x.sucesso).length, tentativas: by("A").length },
    B: { sucessos: by("B").filter((x) => x.sucesso).length, tentativas: by("B").length },
  };
  out.resumo.total = { sucessos: out.resumo.A.sucessos + out.resumo.B.sucessos, tentativas: out.tentativas.length };
  save("rnf2-m23.json", out);
}

// ---------- calibration ----------

async function calibrar(user) {
  await waitVideoWorkerIdle();
  const P = await setupP(user, "calibrar");
  const t0 = now();
  const r = await startProcess(user, P.id);
  if (r.status !== 201) throw new Error(`process ${r.status} ${JSON.stringify(r.data)}`);
  const done = await waitForResults(user, P.id, { timeoutMs: 30 * 60000 });
  const s = done ? (done.at - t0) / 1000 : null;
  const out = { medida: "calibracao RNF-F2-02", quando: new Date().toISOString(), video: path.basename(P_VIDEO), videoS: VIDEO_S, execucaoS: s && +s.toFixed(1) };
  log(`execucao de P com ${VIDEO_S} s de video: ${out.execucaoS} s`);
  if (s) out.videoSugeridoS = Math.min(600, Math.round(VIDEO_S * 225 / s));
  log(`video sugerido para ~225 s de execucao: ${out.videoSugeridoS} s`);
  save(`rnf2-calibracao-${VIDEO_S}s.json`, out);
  return out;
}

// ---------- controls ----------

async function imageShas(res) {
  const out = {};
  for (const img of res.imgs ?? []) {
    try { out[img.name] = { type: img.type, ...(await sha256Url(img.url)) }; }
    catch (e) { out[img.name] = { type: img.type, erro: e.message }; }
  }
  return out;
}

async function controlos(browser, user) {
  const execs = Number(args.execucoes ?? 3);
  const out = { medida: "RNF-F2-02 controlos C2.1-C2.5", quando: new Date().toISOString(), commit: gitCommit(), video: path.basename(P_VIDEO), c21c22: [], c23: null, c24: null, c25: null };

  // C2.1 + C2.2: watch a run without interacting.
  for (let e = 1; e <= execs; e++) {
    await waitVideoWorkerIdle();
    const P = await setupP(user, `c21-${e}`);
    const context = await newContext(browser);
    const page = await context.newPage();
    await login(page, user);
    await openProject(page, P);
    const tApply = await clickApply(page);
    let last = null; let lastChange = null; let maxGap = 0; let changes = 0; let tDone = null; let lastApi = 0;
    while (now() - tApply < 30 * 60000) {
      const v = await progressOfP(page, P);
      const t = now();
      if (v !== null && v !== last) {
        if (lastChange !== null) maxGap = Math.max(maxGap, t - lastChange);
        lastChange = t; last = v; changes++;
      }
      if (t - lastApi > 500) {
        lastApi = t;
        const r = await results(user, P.id);
        if ((r.imgs?.length ?? 0) > 0) { tDone = t; break; }
      }
      await sleep(100);
    }
    const rec = { execucao: e, P: P.id, duracaoS: tDone ? +((tDone - tApply) / 1000).toFixed(1) : null, maiorIntervaloProgressoS: +(maxGap / 1000).toFixed(2), mudancasDeProgresso: changes, ultimoValor: last };
    out.c21c22.push(rec);
    log(`C2.1/C2.2 ${e}: ${rec.duracaoS} s, maior intervalo ${rec.maiorIntervaloProgressoS} s`);
    await context.close();
    save("rnf2-controlos.json", out);
  }
  out.resumoC21 = stats(out.c21c22.map((x) => x.duracaoS));
  out.resumoC22 = stats(out.c21c22.map((x) => x.maiorIntervaloProgressoS));
  // --so c21: stop here (A/B check of C2.1 between two versions, see final/rnf-f2-01/ab/).
  if (args.so === "c21") { save("rnf2-controlos.json", out); return; }

  // C2.3: the base has no endpoint for the state of a run. The final measurement
  // passes it as PICTURAS_STATE_PATH (e.g. "/projects/{user}/{project}/process/status").
  const statePath = process.env.PICTURAS_STATE_PATH;
  if (!statePath) out.c23 = { aplicavel: false, nota: "a base nao expoe o estado de uma execucao; nao ha nada a pedir" };
  else {
    const P = await setupP(user, "c23");
    const intruder = await register("premium", "rnf2-intruso");
    const url = `${API}${statePath.replace("{user}", user.id).replace("{project}", P.id)}`;
    const own = await request("GET", url, { token: user.token });
    const other = await request("GET", url, { token: intruder.token });
    const none = await request("GET", url, {});
    out.c23 = { aplicavel: true, url: statePath, dono: own.status, outroUtilizador: other.status, semJwt: none.status, recusadoNosDois: other.status >= 400 && none.status >= 400 };
  }

  // C2.4: P and Q overlapped vs. separately (API).
  await waitVideoWorkerIdle();
  const P1 = await setupP(user, "c24-sep"); const Q1 = await setupQ(user, { tool: true });
  await startProcess(user, Q1.id); const rQ1 = await waitForResults(user, Q1.id);
  await startProcess(user, P1.id); const rP1 = await waitForResults(user, P1.id);
  await waitVideoWorkerIdle();
  const P2 = await setupP(user, "c24-sob"); const Q2 = await setupQ(user, { tool: true });
  const s1 = await startProcess(user, P2.id);
  await sleep(5000);
  const s2 = await startProcess(user, Q2.id);
  const [rP2, rQ2] = await Promise.all([waitForResults(user, P2.id), waitForResults(user, Q2.id)]);
  const summary = async (r) => r ? { n: r.results.imgs.length, tipos: r.results.imgs.map((x) => x.type).sort(), sha: await imageShas(r.results) } : null;
  out.c24 = {
    arranque: { P: s1.status, Q: s2.status },
    separado: { P: await summary(rP1), Q: await summary(rQ1) },
    sobreposto: { P: await summary(rP2), Q: await summary(rQ2) },
  };
  const eqImgs = (a, b) => a && b && a.n === b.n && JSON.stringify(a.tipos) === JSON.stringify(b.tipos) &&
    Object.entries(a.sha).filter(([, v]) => v.type !== "video").every(([k, v]) => b.sha[k]?.sha256 === v.sha256);
  out.c24.iguais = { P: !!eqImgs(out.c24.separado.P, out.c24.sobreposto.P), Q: !!eqImgs(out.c24.separado.Q, out.c24.sobreposto.Q) };
  log(`C2.4 iguais: ${JSON.stringify(out.c24.iguais)}`);
  save("rnf2-controlos.json", out);

  // C2.5: add a tool to P midway (about 30% of the reference run).
  await waitVideoWorkerIdle();
  const P3 = await setupP(user, "c25");
  const T = out.resumoC21.median ?? 200;
  const t0 = now();
  await startProcess(user, P3.id);
  await sleep(Math.max(5000, 0.3 * T * 1000 - (now() - t0)));
  const pv = await getProject(user, P3.id);
  const add = await request("POST", `${API}/projects/${user.id}/${P3.id}/tool`, {
    token: user.token, body: { procedure: "saturation", params: { saturationFactor: 1.5 } }, headers: { "X-Project-Version": String(pv.version) },
  });
  const rP3 = await waitForResults(user, P3.id);
  const sP3 = await summary(rP3);
  out.c25 = { adicionarFerramenta: { status: add.status, resposta: add.data }, resultados: sP3, iguaisAExecucaoSemAlteracao: !!eqImgs(out.c24.separado.P, sP3) };
  log(`C2.5 status=${add.status} iguais=${out.c25.iguaisAExecucaoSemAlteracao}`);
  save("rnf2-controlos.json", out);
}

// ---------- main ----------

const browser = cmd === "calibrar" ? null : await chromium.launch({ headless: HEADLESS });
try {
  const user = await register("premium", `rnf2-${cmd}`);
  if (cmd === "calibrar") await calibrar(user);
  else if (cmd === "m21") await m21(browser, user);
  else if (cmd === "m22") {
    const cal = path.join(path.dirname(VIDEO_DIR), `rnf2-calibracao-${VIDEO_S}s.json`);
    const T = Number(args.T ?? (fs.existsSync(cal) ? JSON.parse(fs.readFileSync(cal)).execucaoS : 200));
    await m22(browser, user, T);
  } else if (cmd === "m23") await m23(browser, user);
  else if (cmd === "controlos") await controlos(browser, user);
  else throw new Error("comando: calibrar | m21 | m22 | m23 | controlos");
} finally {
  if (browser) await browser.close();
  if (applyStats.cliques) save(`rnf2-${cmd}-apply.json`, { comando: cmd, ...applyStats });
}
process.exit(0);
