#!/usr/bin/env python3
"""
Testes automáticos dos requisitos do UC-VID-001 (Recortar um vídeo).

Corre contra o PictuRAS a funcionar em Docker, na pasta do repositório:

    python3 tests/uc-vid-001/test_trim_requirements.py

Pré-requisitos:
  - `docker compose up -d` com os serviços a correr;
  - um utilizador REGISTADO (gratuito) com um vídeo MP4 de pelo menos 40 s importado
    num projeto (por exemplo Docs/video_teste.mp4).
O script encontra esse vídeo sozinho; para escolher outro use
`--user U --project P --video V`.

Os vídeos e registos de teste criados são removidos no fim. O resultado é
escrito também em tests/uc-vid-001/resultados.md.
"""

import argparse
import datetime
import hashlib
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

PROJECTS = "https://localhost:9002"
USERS = "https://localhost:10001"
SSL = ssl._create_unverified_context()  # certificados self-signed do ambiente de dev

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

results = []  # (requisito, descrição, passou, detalhe)


# ----------------------------------------------------------------- utilitários

def http(method, url, body=None, caller=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if caller:
        req.add_header("X-Caller-Id", caller)
    try:
        with urllib.request.urlopen(req, context=SSL, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw.decode(errors="replace")


def mongo(db, port, js):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", db, "mongo", "--port", str(port),
         "project" if db == "projects_mongoDB" else "user", "--quiet", "--eval", js],
        cwd=REPO, capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr or out.stdout)
    return out.stdout.strip()


def projects_db(js):
    return mongo("projects_mongoDB", 27018, js)


def record(req, desc, ok, detail=""):
    results.append((req, desc, ok, detail))
    print(("  PASSOU " if ok else "  FALHOU ") + f"{req}: {desc}" + (f" — {detail}" if detail else ""))


def sha256_url(url):
    h = hashlib.sha256()
    with urllib.request.urlopen(url, context=SSL, timeout=120) as resp:
        for chunk in iter(lambda: resp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


class Ctx:
    def __init__(self, user, project, video):
        self.u, self.p, self.v = user, project, video

    def trim(self, start, end, video=None):
        t0 = time.monotonic()
        status, body = http("POST", f"{PROJECTS}/{self.u}/{self.p}/videos/{video or self.v}/trim",
                            {"start": start, "end": end}, self.u)
        return status, body, time.monotonic() - t0

    def job(self, job_id):
        return http("GET", f"{PROJECTS}/{self.u}/{self.p}/video-jobs/{job_id}", caller=self.u)[1]["job"]

    def cancel(self, job_id):
        return http("POST", f"{PROJECTS}/{self.u}/{self.p}/video-jobs/{job_id}/cancel", {}, self.u)

    def videos(self):
        return http("GET", f"{PROJECTS}/{self.u}/{self.p}/videos", caller=self.u)[1]["videos"]

    def delete_video(self, video_id):
        http("DELETE", f"{PROJECTS}/{self.u}/{self.p}/videos/{video_id}", caller=self.u)

    def video_url(self, video_id):
        return http("GET", f"{PROJECTS}/{self.u}/{self.p}/videos/{video_id}/url", caller=self.u)[1]["url"]

    def remaining(self):
        return http("GET", f"{USERS}/{self.u}")[1].get("remaining_operations")

    def user_type(self):
        return http("GET", f"{USERS}/{self.u}")[1].get("type")

    def wait(self, job_id, timeout=180):
        """Segue o pedido até terminar; devolve (pedido, estados vistos, instantes das atualizações)."""
        states, updates, last = [], [], None
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            job = self.job(job_id)
            if not states or states[-1] != job["state"]:
                states.append(job["state"])
            key = (job["state"], job["progress"], job["updatedAt"])
            if key != last:
                updates.append(time.monotonic())
                last = key
            if job["state"] in ("completed", "failed", "cancelled"):
                return job, states, updates
            time.sleep(0.5)
        raise TimeoutError(f"o pedido {job_id} não terminou em {timeout} s")

    def fake_video(self, tag, overrides):
        """Cópia do vídeo de teste na base de dados, com alguns campos alterados."""
        js = (
            f"var v = db.videos.findOne({{_id: ObjectId('{self.v}')}});"
            "v._id = ObjectId();"
            f"v.name = '__teste_{tag}.mp4'; v.fingerprint = 'teste';"
            f"Object.assign(v, {json.dumps(overrides)});"
            "db.videos.insertOne(v); print(v._id.str);"
        )
        return projects_db(js)

    def remove_fake(self, video_id):
        projects_db(f"db.videos.deleteOne({{_id: ObjectId('{video_id}')}})")


def find_test_video():
    js = (
        "var v = db.videos.find({state: 'available', format: 'mp4', duration: {$gte: 40},"
        " name: {$not: /_recorte/}}).sort({_id: 1}).limit(1).toArray()[0];"
        "if (v) print(JSON.stringify({u: v.user_id.str, p: v.project_id.str, v: v._id.str}));"
    )
    out = projects_db(js)
    return json.loads(out) if out else None


# ----------------------------------------------------------------------- testes

def test_interval(c):
    print("\n[1] Intervalos inválidos (E4)")
    for (s, e, why) in [(50, 70, "fim acima da duração"), (20, 10, "início depois do fim"),
                        (5, 5, "intervalo de 0 s"), (-1, 5, "início negativo"),
                        (10, 10.5, "fração de segundo")]:
        status, body, _ = c.trim(s, e)
        ok = status == 400 and body.get("code") == "INVALID_INTERVAL"
        record("REQ-003", f"rejeita {s}–{e} s ({why})", ok, body.get("message", "") if isinstance(body, dict) else str(body))


def test_success(c, created):
    print("\n[2] Recorte 10–40 s do início ao fim")
    original = projects_db(
        f"var v = db.videos.findOne({{_id: ObjectId('{c.v}')}});"
        "print(JSON.stringify({name: v.name, format: v.format, codec: v.codec, sha256: v.sha256}))")
    original = json.loads(original)
    hash_before = sha256_url(c.video_url(c.v))
    remaining_before = c.remaining()
    names_before = {v["name"] for v in c.videos()}

    status, body, elapsed = c.trim(10, 40)
    if status != 202:
        record("REQ-009", "cria o pedido", False, f"HTTP {status}: {body}")
        return
    job = body["job"]
    record("REQ-009", "pedido criado no estado 'Em fila' (queued)", job["state"] == "queued", job["state"])
    record("REQ-010", "receção confirmada em ≤ 2 s", elapsed <= 2, f"{elapsed:.2f} s")

    job, states, updates = c.wait(job["_id"])
    record("REQ-011", "estados seguem Em fila → Em processamento → Concluído",
           states[-1] == "completed" and states[0] in ("queued", "processing"), " → ".join(states))
    gaps = [b - a for a, b in zip(updates, updates[1:])]
    record("REQ-012", "progresso atualizado em intervalos ≤ 5 s",
           all(g <= 5.5 for g in gaps), f"maior intervalo {max(gaps or [0]):.1f} s")

    new = next((v for v in c.videos() if v["_id"] == job["result_video_id"]), None)
    if new:
        created.append(new["_id"])
    ok = bool(new) and abs(new["duration"] - 30) <= 1 and new["format"] == original["format"] \
        and new["codec"] == original["codec"]
    record("REQ-015", "resultado com 30 s ± 1 s, mesmo formato e codec",
           ok, f"{new['duration']:.2f} s, {new['format']}/{new['codec']}" if new else "sem vídeo")

    base = original["name"].rsplit(".", 1)[0] + "_recorte"
    record("REQ-016", "resultado guardado como novo vídeo '{nome}_recorte[_n]'",
           bool(new) and new["name"].startswith(base) and new["name"] not in names_before,
           new["name"] if new else "")

    hash_after = sha256_url(c.video_url(c.v))
    same = hash_before == hash_after and (not original.get("sha256") or original["sha256"] == hash_after)
    record("REQ-017", "ficheiro original inalterado (SHA-256 igual antes e depois)", same, hash_after[:16] + "…")

    remaining_after = c.remaining()
    record("REQ-018", "desconta 1 operação quando o pedido termina 'Concluído'",
           remaining_before is not None and remaining_after == remaining_before - 1,
           f"{remaining_before} → {remaining_after}")

    return new


def test_active_and_cancel(c):
    print("\n[3] Pedidos ativos e cancelamento (E6, FA2)")
    remaining_before = c.remaining()
    videos_before = {v["_id"] for v in c.videos()}

    status, body, _ = c.trim(0, 40)
    first = body["job"]
    status2, body2, _ = c.trim(0, 20)
    record("REQ-008", "rejeita um 2.º pedido com 1 pedido ativo (registado)",
           status2 == 429 and body2.get("code") == "TOO_MANY_JOBS", body2.get("message", "") if isinstance(body2, dict) else "")

    # espera que comece a processar, para cancelar a meio
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline and c.job(first["_id"])["state"] == "queued":
        time.sleep(0.3)
    status, body = c.cancel(first["_id"])
    record("REQ-013", "cancela um pedido em curso",
           status == 200 and body["job"]["state"] == "cancelled", f"HTTP {status}")

    time.sleep(6)  # o worker verifica o cancelamento a cada 2 s
    job = c.job(first["_id"])
    no_video = {v["_id"] for v in c.videos()} == videos_before and not job["result_video_id"]
    tmp = subprocess.run(["docker", "compose", "exec", "-T", "video_trim_tool", "sh", "-c",
                          "ls -d /tmp/trim-* 2>/dev/null | wc -l"],
                         cwd=REPO, capture_output=True, text=True).stdout.strip()
    record("REQ-014", "cancelado: sem vídeo novo nem ficheiros temporários",
           no_video and tmp == "0" and job["state"] == "cancelled", f"temporários no worker: {tmp}")
    record("REQ-018", "cancelado: a quota não muda", c.remaining() == remaining_before,
           f"{remaining_before} → {c.remaining()}")


def test_quota(c):
    print("\n[4] Quota diária esgotada (E3)")
    reserved = 0
    try:
        while reserved < 10:  # gasta as operações que restam, diretamente no users
            status, _ = http("GET", f"{USERS}/{c.u}/process/1")
            if status != 200:
                break
            reserved += 1
        status, body, _ = c.trim(0, 10)
        record("REQ-007", "com 5 operações usadas rejeita e sugere o Premium",
               status == 429 and body.get("code") == "QUOTA_EXCEEDED" and "Premium" in body.get("message", ""),
               body.get("message", "") if isinstance(body, dict) else str(body))
    finally:
        if reserved:
            http("POST", f"{USERS}/{c.u}/process/refund/{reserved}", {})


def test_failure(c):
    print("\n[5] Falha a meio do processamento (E5)")
    fake = c.fake_video("falha", {"video_key": "nao-existe.mp4"})
    try:
        remaining_before = c.remaining()
        videos_before = {v["_id"] for v in c.videos()}
        status, body, _ = c.trim(0, 10, video=fake)
        job, states, _ = c.wait(body["job"]["_id"], timeout=60)
        record("REQ-019", "marca 'Falhado' com a mensagem prevista",
               job["state"] == "failed" and job["error"]["message"] ==
               "Não foi possível recortar o vídeo. Tente novamente.",
               f"{job['state']}: {(job.get('error') or {}).get('message')}")
        record("REQ-020", "falhado: sem vídeo novo e quota inalterada",
               {v["_id"] for v in c.videos()} == videos_before and c.remaining() == remaining_before,
               f"quota {remaining_before} → {c.remaining()}")
    finally:
        c.remove_fake(fake)


def test_limits(c):
    print("\n[6] Formato e limites do perfil (E1, E2)")
    cases = [
        ("REQ-004", "rejeita formato não suportado", {"format": "avi", "codec": "mpeg4"}, 415, "UNSUPPORTED_FORMAT"),
        ("REQ-005", "rejeita duração acima de 5 min (registado)", {"duration": 360}, 413, "DURATION_LIMIT"),
        ("REQ-006", "rejeita tamanho acima de 200 MB (registado)", {"size": 250 * 1024 * 1024}, 413, "SIZE_LIMIT"),
    ]
    for req, desc, overrides, code_http, code in cases:
        fake = c.fake_video(req.lower(), overrides)
        try:
            status, body, _ = c.trim(0, 10, video=fake)
            record(req, desc, status == code_http and body.get("code") == code,
                   body.get("message", "") if isinstance(body, dict) else str(body))
        finally:
            c.remove_fake(fake)


# ------------------------------------------------------------------------ main

def write_report(c):
    lines = [
        "# Resultados dos testes automáticos — UC-VID-001",
        "",
        f"Executado em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} com "
        "`tests/uc-vid-001/test_trim_requirements.py` (perfil registado).",
        "",
        "| Requisito | Teste | Resultado | Detalhe |",
        "|-----------|-------|-----------|---------|",
    ]
    for req, desc, ok, detail in results:
        lines.append(f"| {req} | {desc} | {'✅ Passou' if ok else '❌ Falhou'} | {detail.replace('|', '/')} |")
    passed = sum(1 for r in results if r[2])
    lines += ["", f"**{passed} de {len(results)} testes passaram.**", ""]
    with open(os.path.join(HERE, "resultados.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user")
    parser.add_argument("--project")
    parser.add_argument("--video")
    parser.add_argument("--reset-quota", action="store_true",
                        help="repõe as operações diárias de hoje do utilizador (só ambiente de testes)")
    args = parser.parse_args()

    if args.user and args.project and args.video:
        ids = {"u": args.user, "p": args.project, "v": args.video}
    else:
        ids = find_test_video()
        if not ids:
            sys.exit("Não encontrei nenhum vídeo MP4 disponível com ≥ 40 s. Importe Docs/video_teste.mp4 primeiro.")
    c = Ctx(ids["u"], ids["p"], ids["v"])

    if args.reset_quota:
        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        mongo("users_mongoDB", 27019,
              f"db.users.updateOne({{_id: ObjectId('{c.u}')}},"
              f" {{$pull: {{operations: {{day: ISODate('{today}T00:00:00Z')}}}}}})")
        print("Operações diárias de hoje repostas.")

    if c.user_type() != "free":
        sys.exit("Estes testes são para um utilizador registado (gratuito).")
    if (c.remaining() or 0) < 2:
        sys.exit("O utilizador precisa de pelo menos 2 operações diárias disponíveis. "
                 "Volte a correr com --reset-quota para as repor (ambiente de testes).")
    active = [j for j in http("GET", f"{PROJECTS}/{c.u}/{c.p}/video-jobs", caller=c.u)[1]["jobs"]
              if j["state"] in ("queued", "processing")]
    if active:
        sys.exit("Há um pedido de vídeo em curso. Espere que termine ou cancele-o.")

    print(f"Utilizador {c.u} · projeto {c.p} · vídeo {c.v}")
    created = []
    try:
        test_interval(c)
        test_success(c, created)
        test_active_and_cancel(c)
        test_quota(c)
        test_failure(c)
        test_limits(c)
    finally:
        for video_id in created:
            c.delete_video(video_id)
        write_report(c)

    passed = sum(1 for r in results if r[2])
    print(f"\n{passed} de {len(results)} testes passaram. Relatório: tests/uc-vid-001/resultados.md")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
