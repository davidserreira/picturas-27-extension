// Reads the raw results in $MEDICAO/ and writes resumo.md with the value of
// each measure next to the target and the minimum of requisitos-nf.md.
import fs from "node:fs";
import path from "node:path";
import { outDir } from "./lib/comum.mjs";

const dir = outDir();
const read = (f) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };
const amb = read("ambiente.json");
const mem = read("rnf1-memoria.json");
const lim = read("rnf1-limite.json");
const mem1000 = read("rnf1-memoria-1000.json");
const m21 = read("rnf2-m21.json");
const m22 = read("rnf2-m22.json");
const m23 = read("rnf2-m23.json");
const ctl = read("rnf2-controlos.json");

const fmt = (s, unit = "") => s && s.n ? `${s.mean}${unit} ± ${s.sd} (mín. ${s.min}, máx. ${s.max}, n=${s.n})` : "—";
const L = [];
L.push(`# Resultados — ${process.env.MEDICAO || "baseline"}`, "");
if (amb) {
  L.push(`Commit ${amb.codigo?.hash?.slice(0, 7)} · ${amb.cpu.nome} (${amb.cpu.processadoresLogicos} lógicos) · ${amb.ramTotalGiB} GiB · ${amb.so.nome} ${amb.so.versao} · Docker ${amb.docker.engine} (${amb.docker.cpusAtribuidos} CPU, ${amb.docker.memoriaAtribuidaGiB} GiB) · Compose ${amb.docker.compose}`, "");
}

if (mem?.resumo) {
  L.push("## RNF-F2-01", "", "### M1.1 — acréscimo de memória por serviço (MiB), média ± desvio-padrão (repetições válidas)", "");
  const svcs = mem.servicosAmostrados;
  L.push(`| Ficheiro | ${svcs.join(" | ")} | Pior no critério (máx.) | Válidas |`, `| --- | ${svcs.map(() => "---").join(" | ")} | --- | --- |`);
  for (const [mib, r] of Object.entries(mem.resumo)) {
    L.push(`| ${mib} MiB | ${svcs.map((s) => r[s]?.n ? `${r[s].mean} ± ${r[s].sd}` : "—").join(" | ")} | ${r.piorServicoNoCriterio.servico}: ${r.piorServicoNoCriterio.maxIncreaseMiB ?? "—"} | ${r.repeticoesValidas}/${mem.repeticoes} |`);
  }
  if (mem1000) {
    const reps = mem1000.m11?.["1000"] ?? [];
    const down = reps.filter((r) => r.dockerEngineDown).length;
    const ok = reps.filter((r) => r.valid);
    L.push("", `**1000 MiB, sem limites de memória** (série separada, \`rnf1-memoria-1000.json\`): ${reps.length} tentativa(s), ${ok.length} válida(s), ${down} com o motor do Docker a deixar de responder.`);
    for (const r of reps) L.push(`- rep ${r.rep}: resposta ${r.status ?? "nenhuma"}${r.dockerEngineDown ? ", motor do Docker em baixo" : ""}; acréscimos ${mem.servicosAmostrados.map((s) => `${s} ${r.perService?.[s]?.increaseMiB ?? "—"}`).join(", ")}`);
  }
  L.push("", "### C1.1 / C1.2 — tempos do envio (s)", "", "| Ficheiro | Aceitação (C1.1) | Envio completo (C1.2) |", "| --- | --- | --- |");
  for (const mib of Object.keys(mem.c11 ?? {})) L.push(`| ${mib} MiB | ${fmt(mem.c11[mib])} | ${fmt(mem.c12[mib])} |`);
  if (mem.c13) L.push("", `**C1.3** envio de 500 MiB sem JWT: resposta ${mem.c13.status}, acréscimo do api_gateway ${mem.c13.apiGatewayIncreaseMiB} MiB.`);
  if (mem.c14) L.push("", `**C1.4** SHA-256 igual: ${Object.entries(mem.c14).map(([k, v]) => `${k} MiB ${v.equal ? "sim" : "não"}`).join(", ")}.`);
  if (mem.c15) { L.push("", "**C1.5** decisões de validação:", ""); for (const c of mem.c15) L.push(`- ${c.caso}: ${c.status} ${String(c.resposta).slice(0, 120)}`); }
  if (mem.c16) L.push("", `**C1.6** ficheiros em /tmp: antes ${JSON.stringify(mem.c16.before)}, após envio completo ${JSON.stringify(mem.c16.complete.tmpFiles)}, após envio interrompido ${JSON.stringify(mem.c16.interrupted.tmpFiles)}.`);
  if (mem.c17) {
    L.push("", `**C1.7** objetos no armazenamento (sem órfãos: ${mem.c17.semOrfaos ? "sim" : "**não**"}; envios em partes abertos ${mem.c17.envioEmPartesAbertos.antes} → ${mem.c17.envioEmPartesAbertos.depois}):`, "");
    for (const c of mem.c17.casos) L.push(`- ${c.caso}: ${c.status}, ${c.objetosSrc} objeto(s) em src/ (esperado ${c.esperado})`);
  }
}
if (lim) {
  L.push("", "### M1.2 — maior ficheiro aceite com 512 MiB por contentor", "", `**${lim.maiorFicheiroAceiteMiB ?? "—"} MiB**`, "", "| Ficheiro | Repetição | Resposta | Reiniciados / sem memória | Sucesso |", "| --- | --- | --- | --- | --- |");
  for (const [mib, reps] of Object.entries(lim.resultados)) for (const r of reps) L.push(`| ${mib} MiB | ${r.rep} | ${r.status ?? "sem resposta"} | ${r.crashed.join(", ") || "—"} ${r.oom.length ? `(OOM: ${r.oom.join(", ")})` : ""} | ${r.success ? "sim" : "não"} |`);
}

if (m21?.resumo) {
  L.push("", "## RNF-F2-02", "", "### M2.1 — ações concluídas durante uma execução", "",
    `Pior execução: **${m21.resumo.pior}%** · média ${fmt(m21.resumo.percentagem, "%")} · G1 completo em todas: ${m21.resumo.g1CompletoEmTodas ? "sim" : "não"} · execuções válidas ${m21.resumo.execucoesValidas}`, "",
    "| # | Ação | Resultado obtido (a) | Progresso visível (b) | Concluída |", "| --- | --- | --- | --- | --- |");
  const first = m21.execucoes[0];
  for (const a of first.acoes) { const s = m21.resumo.porAcao[a.n]; L.push(`| ${a.n} | ${a.acao} | ${s.a}/${m21.resumo.execucoesValidas} | ${s.b}/${m21.resumo.execucoesValidas} | ${s.concluida}/${m21.resumo.execucoesValidas} |`); }
}
if (m22?.resumo) {
  L.push("", "### M2.2 — tempo até a interface refletir o estado", "",
    `- R (recarregar): ${m22.resumo.R.naoRecupera} de ${m22.resumo.R.valores} não recuperam em 60 s; tempos dos que recuperam ${fmt(m22.resumo.R.tempos, " s")}`,
    `- F (fim noutra página): ${m22.resumo.F.naoRecupera} de ${m22.resumo.F.valores} sem indicação em 60 s; tempos ${fmt(m22.resumo.F.tempos, " s")}`);
}
if (m23?.resumo) {
  L.push("", "### M2.3 — cancelamento depois de perder a página", "",
    `- Forma A (recarregar): ${m23.resumo.A.sucessos}/${m23.resumo.A.tentativas}`,
    `- Forma B (sessão nova): ${m23.resumo.B.sucessos}/${m23.resumo.B.tentativas}`,
    `- Total: ${m23.resumo.total.sucessos}/${m23.resumo.total.tentativas}`);
}
if (ctl) {
  L.push("", "### Controlos", "",
    `- C2.1 duração de uma execução de P sem interação: ${fmt(ctl.resumoC21, " s")}`,
    `- C2.2 maior intervalo entre mudanças do progresso: ${fmt(ctl.resumoC22, " s")}`,
    `- C2.3 estado da execução a terceiros: ${ctl.c23?.aplicavel ? `outro utilizador ${ctl.c23.outroUtilizador}, sem JWT ${ctl.c23.semJwt}` : ctl.c23?.nota ?? "—"}`,
    `- C2.4 execuções sobrepostas iguais às separadas: P ${ctl.c24?.iguais?.P ? "sim" : "não"}, Q ${ctl.c24?.iguais?.Q ? "sim" : "não"}`,
    `- C2.5 ferramenta acrescentada a meio: resposta ${ctl.c25?.adicionarFerramenta?.status}, resultados iguais à execução sem alteração: ${ctl.c25?.iguaisAExecucaoSemAlteracao ? "sim" : "não"}`);
}
fs.writeFileSync(path.join(dir, "resumo.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
