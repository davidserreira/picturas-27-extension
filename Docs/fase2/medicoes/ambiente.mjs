// Records the measurement environment (hardware, OS, versions, running
// services, code version) in $MEDICAO/ambiente.json.
import os from "node:os";
import { execFileSync } from "node:child_process";
import { compose, docker, gitCommit, save } from "./lib/comum.mjs";

const tryRun = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: "utf8" }).trim(); } catch { return null; } };
const winInfo = process.platform === "win32"
  ? tryRun("powershell.exe", ["-NoProfile", "-Command",
    "$c=Get-CimInstance Win32_ComputerSystem; $p=Get-CimInstance Win32_Processor | Select-Object -First 1; $o=Get-CimInstance Win32_OperatingSystem; " +
    "'{0}|{1}|{2}|{3}|{4}|{5}' -f $c.Manufacturer,$c.Model,$p.Name,$p.NumberOfCores,$o.Caption,$o.Version"])
  : null;
const [manufacturer, model, cpuName, cores, osCaption, osVersion] = (winInfo ?? "").split("|");

const info = JSON.parse(docker(["info", "--format", "{{json .}}"]));
const services = compose(["ps", "--format", "{{.Service}}"]).split(/\r?\n/).filter(Boolean).sort();

save("ambiente.json", {
  quando: new Date().toISOString(),
  codigo: gitCommit(),
  maquina: { fabricante: manufacturer || null, modelo: model || null },
  cpu: { nome: cpuName || os.cpus()[0]?.model, nucleosFisicos: cores ? Number(cores) : null, processadoresLogicos: os.cpus().length },
  ramTotalGiB: +(os.totalmem() / 2 ** 30).toFixed(1),
  so: { nome: osCaption || os.type(), versao: osVersion || os.release() },
  docker: {
    engine: info.ServerVersion,
    sistema: info.OperatingSystem,
    kernel: info.KernelVersion,
    cpusAtribuidos: info.NCPU,
    memoriaAtribuidaGiB: +(info.MemTotal / 2 ** 30).toFixed(2),
    compose: tryRun("docker", ["compose", "version", "--short"]),
  },
  node: process.version,
  browser: "Chromium (Playwright 1.55.0), sem interface, janela 1440x900",
  servicosLancados: services,
});
