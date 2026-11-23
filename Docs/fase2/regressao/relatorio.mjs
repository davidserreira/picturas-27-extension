// Builds $REGRESSAO.md from the raw results in resultados/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.REGRESSAO || "baseline";
const R = (f) => path.join(HERE, "resultados", f);
const readJson = (f) => fs.existsSync(R(f)) ? JSON.parse(fs.readFileSync(R(f), "utf8")) : null;
const readText = (f) => fs.existsSync(R(f)) ? fs.readFileSync(R(f), "utf8") : "";

const py = readText(`${MODE}-pytest.txt`);
const pyLine = (py.match(/=+ (.* in [\d.]+s) =+/) || py.match(/(\d+ passed.*in [\d.]+s)/) || [])[1] ?? "sem resultado";
const pyCases = [...py.matchAll(/^(PASSED|FAILED|ERROR) (\S+)/gm)].map((m) => [m[1], m[2]]);
const node = readText(`${MODE}-node.txt`);
const nodeNum = (k) => Number((node.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1] ?? NaN);
const nodeCases = [...node.matchAll(/^([✔✖]) (.+?) \([\d.]+ms\)$/gm)].map((m) => [m[1] === "✔" ? "passou" : "falhou", m[2]]);
const e2e = readJson(`${MODE}-e2e.json`);
const ui = readJson(`${MODE}-ui.json`);
// The machine of this run, not the baseline's: reproductions run on other machines.
const dockerInfo = (() => {
  try { return JSON.parse(execFileSync("docker", ["info", "--format", "{{json .}}"], { encoding: "utf8" })); } catch { return null; }
})();

const icon = { passou: "passou", falhou: "**falhou**", erro: "**erro**", diferente: "**diferente da referência**" };
const L = [];
const commit = e2e?.commit?.hash?.slice(0, 7) ?? "?";
L.push(`# Regressão — ${MODE === "baseline" ? "solução de base" : MODE}`, "");
L.push(`Corrida a ${(e2e?.quando ?? new Date().toISOString()).slice(0, 16).replace("T", " ")} UTC sobre o commit \`${commit}\`` +
  (e2e?.commit?.codeChanges?.length ? `, com alterações por versionar: ${e2e.commit.codeChanges.join("; ")}` : ", sem alterações ao código") + ".");
L.push(`Máquina: ${os.cpus()[0]?.model?.trim() ?? "?"} (${os.cpus().length} processadores lógicos), ${os.type()} ${os.release()}` +
  (dockerInfo ? `; Docker ${dockerInfo.ServerVersion} com ${dockerInfo.NCPU} CPUs e ${(dockerInfo.MemTotal / 1073741824).toFixed(2)} GiB` : "") + ".");
L.push("", "## Resumo", "", "| Suite | O que cobre | Resultado |", "| --- | --- | --- |");
const pyPass = pyCases.filter((c) => c[0] === "PASSED").length;
L.push(`| Worker de vídeo (pytest, existente) | \`Tools/video/tests\`: processamento, corte, velocidade, legendas e extração, com FFmpeg real e reconhecimento de fala simulado | ${pyPass}/${pyCases.length} (${pyLine}) |`);
L.push(`| Orquestrador (node --test, existente) | \`projects/tests\`: lote, cancelamento, pipeline de vídeo e extração | ${nodeNum("pass")}/${nodeNum("tests")} |`);
const n = (s, x) => (s?.testes ?? []).filter((t) => t.estado === x).length;
if (e2e) L.push(`| Ponta a ponta (nova) | \`e2e.mjs\`: a stack completa através do nginx, da API e do WebSocket | ${n(e2e, "passou")}/${e2e.testes.length}${n(e2e, "diferente") ? `, ${n(e2e, "diferente")} diferentes da referência` : ""} |`);
if (ui) L.push(`| Interface (nova) | \`ui.mjs\`: importar, aplicar e cancelar no browser | ${n(ui, "passou")}/${ui.testes.length} |`);

if (e2e) {
  L.push("", "## Ponta a ponta", "", "| ID | Área | Teste | Resultado | Tempo |", "| --- | --- | --- | --- | --- |");
  for (const t of e2e.testes) L.push(`| ${t.id} | ${t.area} | ${t.nome} | ${icon[t.estado]}${t.mensagem ? `: ${t.mensagem.replace(/\|/g, "/")}` : ""} | ${t.segundos} s |`);
}
if (ui) {
  L.push("", "## Interface", "", "| ID | Teste | Resultado | Tempo |", "| --- | --- | --- | --- |");
  for (const t of ui.testes) L.push(`| ${t.id} | ${t.nome} | ${icon[t.estado]}${t.mensagem ? `: ${t.mensagem.replace(/\|/g, "/")}` : ""} | ${t.segundos} s |`);
}
L.push("", "## Testes unitários existentes", "", "### Orquestrador", "");
for (const [s, name] of nodeCases) L.push(`- ${s}: ${name}`);
L.push("", "### Worker de vídeo", "");
const byFile = {};
for (const [s, id] of pyCases) { const [file] = id.split("::"); (byFile[file] ??= []).push(s); }
for (const [file, ss] of Object.entries(byFile)) L.push(`- \`${file}\`: ${ss.filter((s) => s === "PASSED").length}/${ss.length} passaram`);
if (MODE === "baseline") {
  L.push("", "## Referência para a comparação final", "",
    "Cada teste ponta a ponta guarda uma impressão do que produziu (SHA-256 das imagens, duração, resolução, codec e som dos vídeos, número e tipo dos fotogramas, códigos e mensagens de recusa). Ficam em `referencia.json`. Na corrida final (`REGRESSAO=final`), um teste que passe mas produza uma impressão diferente fica marcado como \"diferente da referência\" e tem de ser analisado.");
}
fs.writeFileSync(path.join(HERE, `${MODE}.md`), L.join("\n") + "\n");
console.log(`escrito ${MODE}.md`);
