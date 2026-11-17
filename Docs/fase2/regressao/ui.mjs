// UI smoke tests for Phase 2 (Playwright, Chromium). They check the user-visible
// flows that the RNF-F2-02 refactoring will touch, in terms of what the user
// sees, so they run unchanged on the base and on the final version.
//
//   REGRESSAO=baseline node ui.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  BASE, DADOS, register, createProject, addMedia, addTool, results, getProject, waitVideoWorkerIdle,
  sleep, now, log, gitCommit,
} from "../medicoes/lib/comum.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.REGRESSAO || "baseline";
const OUT = path.join(HERE, "resultados");
fs.mkdirSync(OUT, { recursive: true });
const IMG1 = path.join(DADOS, "imagem-p1.png");
const VIDEO60 = path.join(HERE, "dados", "video-60s.mp4");

class Falha extends Error {}
const check = (c, m) => { if (!c) throw new Falha(m); };

async function login(page, user) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: /login|sign in/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

// Opening a project bumps its version (POST /dirty); wait for it before Apply.
async function open(page, pid) {
  const dirty = page.waitForResponse((r) => /\/dirty/.test(r.url()) && r.request().method() === "POST", { timeout: 15000 }).catch(() => null);
  await page.goto(`${BASE}/dashboard/${pid}`);
  await page.getByRole("button", { name: /^\s*apply\s*$/i }).waitFor({ timeout: 30000 });
  await dirty;
  await sleep(3000);
}

async function apply(page) {
  const resp = page.waitForResponse((r) => /\/process(\?|$)/.test(r.url()) && r.request().method() === "POST", { timeout: 20000 });
  await page.getByRole("button", { name: /^\s*apply\s*$/i }).click();
  const r = await resp;
  check(r.status() < 300, `Apply devolveu ${r.status()}`);
}

const TESTS = [
  { id: "U01", nome: "Importar uma imagem pela interface", run: async ({ page, user }) => {
    const p = await createProject(user, `u01-${Date.now() % 100000}`);
    await open(page, p.id);
    await page.getByRole("button", { name: /import/i }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles(IMG1);
    await page.getByRole("dialog").getByRole("button", { name: /^add$/i }).click();
    const t0 = now();
    while ((await getProject(user, p.id)).imgs.length < 1 && now() - t0 < 30000) await sleep(500);
    check((await getProject(user, p.id)).imgs.length === 1, "a imagem nao ficou no projeto");
    await page.locator("main img").first().waitFor({ timeout: 15000 });
  } },
  { id: "U02", nome: "Aplicar um pipeline pela interface e ver os resultados", run: async ({ page, user }) => {
    const p = await createProject(user, `u02-${Date.now() % 100000}`);
    await addMedia(user, p.id, IMG1);
    await addTool(user, p.id, "brightness", { brightness: 1.3 });
    await open(page, p.id);
    await apply(page);
    await page.waitForURL(/mode=results/, { timeout: 120000 });
    await page.locator("main img").first().waitFor({ timeout: 30000 });
    check((await results(user, p.id)).imgs.length === 1, "sem resultado na API");
  } },
  { id: "U03", nome: "Cancelar pela interface uma execução em curso", run: async ({ page, user }) => {
    await waitVideoWorkerIdle();
    const p = await createProject(user, `u03-${Date.now() % 100000}`);
    await addMedia(user, p.id, VIDEO60);
    await addTool(user, p.id, "brightness", { brightness: 1.2 });
    await open(page, p.id);
    await apply(page);
    const cancel = page.getByRole("button", { name: /cancel/i }).first();
    await cancel.waitFor({ timeout: 15000 });
    await sleep(3000);
    await cancel.click();
    await page.getByRole("button", { name: /^\s*apply\s*$/i }).waitFor({ timeout: 15000 });
    await sleep(30000);
    check((await results(user, p.id)).imgs.length === 0, "ha resultados depois de cancelar");
  } },
];

const user = await register("premium", "regressao-ui");
const browser = await chromium.launch();
const report = { suite: "ui", modo: MODE, quando: new Date().toISOString(), commit: gitCommit(), testes: [] };
try {
  for (const t of TESTS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const t0 = now();
    const rec = { id: t.id, nome: t.nome };
    try {
      await login(page, user);
      await t.run({ page, user });
      rec.estado = "passou";
    } catch (e) {
      rec.estado = e instanceof Falha ? "falhou" : "erro";
      rec.mensagem = String(e.message).split("\n")[0].slice(0, 300);
      await page.screenshot({ path: path.join(OUT, `${MODE}-${t.id}.png`) }).catch(() => {});
    }
    rec.segundos = +((now() - t0) / 1000).toFixed(1);
    report.testes.push(rec);
    log(`${t.id} ${rec.estado.toUpperCase()} (${rec.segundos} s) ${t.nome}${rec.mensagem ? " - " + rec.mensagem : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, `${MODE}-ui.json`), JSON.stringify(report, null, 2));
}
process.exit(report.testes.every((t) => t.estado === "passou") ? 0 : 1);
