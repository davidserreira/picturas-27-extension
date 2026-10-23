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

Como um recorte substitui o vídeo recortado, os testes trabalham sobre cópias
desse vídeo (com ficheiro próprio no armazenamento): o vídeo do utilizador nunca
é alterado. As cópias e os registos de teste são removidos no fim. O resultado
é escrito também em tests/uc-vid-001/resultados.md.
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


def users_db(js):
    return mongo("users_mongoDB", 27019, js)


def processed_today(user_id):
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    out = users_db(
        f"var u = db.users.findOne({{_id: ObjectId('{user_id}')}});"
        f"var op = (u.operations || []).filter(function(o){{ return o.day.toISOString().slice(0,10) == '{today}' }})[0];"
        "print(op ? op.processed : 0)")
    return int(out or 0)


def set_user_type(user_id, user_type):
    users_db(f"db.users.updateOne({{_id: ObjectId('{user_id}')}}, {{$set: {{type: '{user_type}'}}}})")


class Ctx:
    def __init__(self, user, project, video):
        self.u, self.p, self.v = user, project, video

    def trim(self, start, end, video=None, **extra):
        t0 = time.monotonic()
        status, body = http("POST", f"{PROJECTS}/{self.u}/{self.p}/videos/{video or self.v}/trim",
                            {"start": start, "end": end, **extra}, self.u)
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

    def copy_video(self, tag):
        """Cópia do vídeo com um ficheiro próprio no armazenamento: um recorte
        substitui-a sem tocar no ficheiro do vídeo copiado."""
        info = json.loads(projects_db(
            f"var v = db.videos.findOne({{_id: ObjectId('{self.v}')}});"
            "print(JSON.stringify({key: v.video_key, format: v.format}))"))
        key = f"__teste_{tag}_{int(time.time() * 1000)}.{info['format']}"
        js = (
            "const s = require('./utils/imageStorage'); const axios = require('axios');"
            "(async () => {"
            f" const url = (await s.get_image_internal_url('{self.u}', '{self.p}', 'video', '{info['key']}')).data.url;"
            " const r = await axios.get(url, {responseType: 'stream'});"
            f" await s.post_video('{self.u}', '{self.p}', '{key}', r.data,"
            " Number(r.headers['content-length']), r.headers['content-type'] || 'video/mp4');"
            "})().catch((e) => { console.error(e.message); process.exit(1); });"
        )
        out = subprocess.run(["docker", "compose", "exec", "-T", "projects", "node", "-e", js],
                             cwd=REPO, capture_output=True, text=True, timeout=300)
        if out.returncode != 0:
            raise RuntimeError("não foi possível copiar o vídeo de teste: " + (out.stderr or out.stdout))
        return self.fake_video(tag, {"video_key": key})


def find_test_video():
    js = (
        "var vs = db.videos.find({state: 'available', format: 'mp4', duration: {$gte: 40},"
        " name: {$not: /_recorte|^__teste_/}}).sort({_id: 1}).limit(50).toArray();"
        "print(JSON.stringify(vs.map(function (v) {"
        " return {u: v.user_id.str, p: v.project_id.str, v: v._id.str}; })));"
    )
    out = projects_db(js)
    # o primeiro vídeo de um utilizador registado que ainda existe (a base de dados
    # de projetos pode ter vídeos de contas entretanto apagadas)
    for ids in json.loads(out or "[]"):
        status, user = http("GET", f"{USERS}/{ids['u']}")
        if status == 200 and isinstance(user, dict) and user.get("type") == "free":
            return ids
    return None


# ----------------------------------------------------------------------- testes

def test_interval(c):
    print("\n[1] Intervalos inválidos (E4)")
    for (s, e, why) in [(50, 70, "fim acima da duração"), (20, 10, "início depois do fim"),
                        (5, 5, "intervalo de 0 s"), (-1, 5, "início negativo"),
                        (10, 10.5, "fração de segundo")]:
        status, body, _ = c.trim(s, e)
        ok = status == 400 and body.get("code") == "INVALID_INTERVAL"
        record("REQ-003", f"rejeita {s}–{e} s ({why})", ok, body.get("message", "") if isinstance(body, dict) else str(body))


def test_success(c):
    print("\n[2] Recorte 10–40 s do início ao fim")
    original = projects_db(
        f"var v = db.videos.findOne({{_id: ObjectId('{c.v}')}});"
        "print(JSON.stringify({name: v.name, format: v.format, codec: v.codec}))")
    original = json.loads(original)
    hash_before = sha256_url(c.video_url(c.v))
    remaining_before = c.remaining()
    ids_before = {v["_id"] for v in c.videos()}

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

    video = next((v for v in c.videos() if v["_id"] == c.v), None)
    ok = bool(video) and abs(video["duration"] - 30) <= 1 and video["format"] == original["format"] \
        and video["codec"] == original["codec"]
    record("REQ-015", "resultado com 30 s ± 1 s, mesmo formato e codec",
           ok, f"{video['duration']:.2f} s, {video['format']}/{video['codec']}" if video else "sem vídeo")

    hash_after = sha256_url(c.video_url(c.v))
    record("REQ-016", "o resultado substitui o vídeo recortado (mesmo vídeo e nome, sem vídeo novo)",
           job.get("result_video_id") == c.v and bool(video) and video["name"] == original["name"]
           and {v["_id"] for v in c.videos()} == ids_before and hash_after != hash_before,
           video["name"] if video else "")

    remaining_after = c.remaining()
    record("REQ-018", "desconta 1 operação quando o pedido termina 'Concluído'",
           remaining_before is not None and remaining_after == remaining_before - 1,
           f"{remaining_before} → {remaining_after}")


def test_active_and_cancel(c):
    print("\n[3] Pedidos ativos e cancelamento (E6, FA2)")
    remaining_before = c.remaining()
    videos_before = {v["_id"] for v in c.videos()}
    hash_before = sha256_url(c.video_url(c.v))

    status, body, _ = c.trim(0, 20)
    first = body["job"]
    status2, body2, _ = c.trim(0, 10)
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
    hash_after = sha256_url(c.video_url(c.v))
    record("REQ-017", "cancelado: o vídeo fica inalterado (SHA-256 igual antes e depois)",
           hash_after == hash_before, hash_after[:16] + "…")


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


def test_premium(c, copies):
    print("\n[7] Utilizador premium (FA1)")
    # um pedido de cada vez por vídeo: os 3 pedidos simultâneos são em cópias diferentes
    targets = [c.copy_video(f"premium{n}") for n in range(3)]
    copies.extend(targets)
    set_user_type(c.u, "premium")
    jobs = []
    try:
        processed_before = processed_today(c.u)

        # 3 pedidos ativos em simultâneo são aceites; o 4.º é rejeitado (RN5)
        for target in targets:
            status, body, _ = c.trim(0, 10, video=target)
            if status == 202:
                jobs.append(body["job"]["_id"])
        status4, body4, _ = c.trim(0, 10)
        record("REQ-008", "premium: aceita 3 pedidos ativos e rejeita o 4.º",
               len(jobs) == 3 and status4 == 429 and body4.get("code") == "TOO_MANY_JOBS",
               f"{len(jobs)} aceites; 4.º: {body4.get('message', '') if isinstance(body4, dict) else body4}")

        finished = [c.wait(j)[0] for j in jobs]
        record("REQ-018", "premium: recortes concluídos não gastam quota diária",
               all(j["state"] == "completed" for j in finished) and processed_today(c.u) == processed_before,
               f"{sum(j['state'] == 'completed' for j in finished)}/3 concluídos; "
               f"operações hoje {processed_before} → {processed_today(c.u)}")

        # limites do premium: 6 min aceite (acima do limite do registado), 31 min rejeitado
        fake = c.fake_video("premium6min", {"video_key": "nao-existe.mp4", "duration": 360})
        try:
            status, body, _ = c.trim(0, 10, video=fake)
            ok = status == 202
            if ok:
                c.cancel(body["job"]["_id"])
            record("REQ-005", "premium: aceita vídeo de 6 min (limite 30 min)", ok, f"HTTP {status}")
        finally:
            time.sleep(3)
            c.remove_fake(fake)

        fake = c.fake_video("premium31min", {"duration": 31 * 60})
        try:
            status, body, _ = c.trim(0, 10, video=fake)
            record("REQ-005", "premium: rejeita vídeo de 31 min, sem sugerir o Premium",
                   status == 413 and body.get("code") == "DURATION_LIMIT" and "Premium" not in body.get("message", ""),
                   body.get("message", "") if isinstance(body, dict) else str(body))
        finally:
            c.remove_fake(fake)

        fake = c.fake_video("premium250mb", {"video_key": "nao-existe.mp4", "size": 250 * 1024 * 1024})
        try:
            status, body, _ = c.trim(0, 10, video=fake)
            ok = status == 202
            if ok:
                c.cancel(body["job"]["_id"])
            record("REQ-006", "premium: aceita vídeo de 250 MB (limite 2 GB)", ok, f"HTTP {status}")
        finally:
            time.sleep(3)
            c.remove_fake(fake)
    finally:
        for j in jobs:
            c.cancel(j)
        set_user_type(c.u, "free")


def unique_name(name, used):
    """O mesmo algoritmo do backend (projects/utils/videoNames.js)."""
    import re
    used = {n.lower() for n in used}
    if name.lower() not in used:
        return name
    stem, ext = os.path.splitext(name)
    stem = re.sub(r" \(\d+\)$", "", stem)
    n = 2
    while f"{stem} ({n}){ext}".lower() in used:
        n += 1
    return f"{stem} ({n}){ext}"


def test_v15(c, copies):
    print("\n[9] Remover um intervalo e nomes únicos (v1.5)")
    video = next(v for v in c.videos() if v["_id"] == c.v)
    duration = video["duration"]

    # validações do modo remover
    status, body, _ = c.trim(0, 10, mode="cortar")
    record("TRIM-032", "rejeita um modo desconhecido", status == 400 and body.get("code") == "INVALID_MODE",
           body.get("message", "") if isinstance(body, dict) else str(body))
    status, body, _ = c.trim(0, int(-(-duration // 1)), mode="remove")
    record("TRIM-032", "remover o vídeo todo é rejeitado (tem de ficar ≥ 1 s)",
           status == 400 and body.get("code") == "INVALID_INTERVAL",
           body.get("message", "") if isinstance(body, dict) else str(body))
    fake = c.fake_video("hevc", {"format": "mov", "codec": "hevc"})
    try:
        status, body, _ = c.trim(5, 10, video=fake, mode="remove")
        record("TRIM-032", "remover um intervalo de um vídeo que não é H.264 é rejeitado",
               status == 415 and body.get("code") == "UNSUPPORTED_FORMAT",
               body.get("message", "") if isinstance(body, dict) else str(body))
    finally:
        c.remove_fake(fake)
    # FA4: remover 5–10 s junta o que fica antes e depois
    status, body, _ = c.trim(5, 10, mode="remove")
    desc = f"remover 0:05–0:10 de um vídeo de {duration:.0f} s deixa {duration - 5:.0f} s ± 1 s, no mesmo vídeo"
    if status == 202:
        job, _, _ = c.wait(body["job"]["_id"])
        after = next((v for v in c.videos() if v["_id"] == c.v), None)
        record("TRIM-032", desc,
               job["state"] == "completed" and job["result_video_id"] == c.v and after
               and abs(after["duration"] - (duration - 5)) <= 1,
               f"{job['state']}; {after['duration']:.2f} s" if after else job["state"])
    else:
        record("TRIM-032", desc, False, f"HTTP {status}: {body}")

    # UC-VID-002/RN12: importar um ficheiro com um nome que já existe numera-o
    video = next(v for v in c.videos() if v["_id"] == c.v)
    expected = unique_name(video["name"], [v["name"] for v in c.videos()])
    status, body = http("POST", f"{PROJECTS}/{c.u}/{c.p}/videos",
                        {"name": video["name"], "size": 1000, "fingerprint": "0" * 64}, c.u)
    imported = body.get("video", {}) if isinstance(body, dict) else {}
    record("IMPORT-032", f"importar outra vez \"{video['name']}\" dá o nome \"{expected}\"",
           status == 201 and imported.get("name") == expected, f"HTTP {status}: {imported.get('name')}")
    if imported.get("_id"):
        http("POST", f"{PROJECTS}/{c.u}/{c.p}/videos/{imported['_id']}/cancel", {}, c.u)
        c.delete_video(imported["_id"])


def library_usage(c):
    return http("GET", f"{PROJECTS}/{c.u}/{c.p}/videos", caller=c.u)[1]["usage"]["used"]


def test_library_and_performance(c):
    print("\n[8] Biblioteca e desempenho (E7, LIB-002, TRIM-031)")

    # TST-TRIM-M14 / LIB-002: a ocupação passa a contar o tamanho do resultado
    used_before = library_usage(c)
    size_before = next(v["size"] for v in c.videos() if v["_id"] == c.v)
    status, body, _ = c.trim(0, 10)
    desc = "a ocupação da biblioteca passa a contar o tamanho do resultado em vez do anterior"
    if status == 202:
        c.wait(body["job"]["_id"])
        size_after = next(v["size"] for v in c.videos() if v["_id"] == c.v)
        used_after = library_usage(c)
        record("LIB-002", desc, used_after - used_before == size_after - size_before,
               f"{used_before} → {used_after} bytes (vídeo: {size_before} → {size_after} bytes)")
    else:
        record("LIB-002", desc, False, f"HTTP {status}: {body}")

    # TST-TRIM-M12 / TRIM-027: biblioteca cheia (1 GB no registado)
    filler = c.fake_video("biblioteca-cheia", {"size": 1024 * 1024 * 1024})
    try:
        status, body, _ = c.trim(0, 10)
        msg = body.get("message", "") if isinstance(body, dict) else str(body)
        record("TRIM-027", "biblioteca cheia: rejeita o recorte com a ocupação e o limite",
               status == 413 and body.get("code") == "STORAGE_FULL" and "1 GB" in msg, msg)
    finally:
        c.remove_fake(filler)

    # TST-TRIM-M13 / TRIM-031: vídeo de 5 min a 1080p recortado em <= 5 min
    print("  (a gerar um vídeo de teste de 5 min a 1080p; pode demorar 1-3 min)")
    gen = subprocess.run(
        ["docker", "compose", "exec", "-T", "video_trim_tool", "python", "-c",
         "import subprocess, requests, json, os\n"
         "p='/tmp/perf_5min.mp4'\n"
         "subprocess.run(['ffmpeg','-y','-loglevel','error','-f','lavfi','-i',"
         "'testsrc2=size=1920x1080:rate=30:duration=300','-f','lavfi','-i','sine=frequency=440:duration=300',"
         "'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',p],check=True)\n"
         f"r=requests.put('http://img_storage:11000/video/{c.u}/{c.p}/perf_5min.mp4',data=open(p,'rb'),"
         "headers={'Content-Type':'video/mp4','Content-Length':str(os.path.getsize(p))},timeout=600)\n"
         "r.raise_for_status()\n"
         "o=json.loads(subprocess.run(['ffprobe','-v','error','-print_format','json','-show_format',p],"
         "capture_output=True,text=True).stdout)\n"
         "print(json.dumps({'size':os.path.getsize(p),'duration':float(o['format']['duration'])}))\n"
         "os.remove(p)\n"],
        cwd=REPO, capture_output=True, text=True, timeout=900)
    if gen.returncode != 0:
        record("TRIM-031", "recorte de 5 min a 1080p concluído em ≤ 5 min", False,
               "não foi possível gerar o vídeo de teste: " + (gen.stderr or gen.stdout)[-200:])
        return
    info = json.loads(gen.stdout.strip().splitlines()[-1])
    perf = c.fake_video("desempenho-5min", {
        "video_key": "perf_5min.mp4", "size": info["size"], "duration": min(info["duration"], 300),
        "width": 1920, "height": 1080, "format": "mp4", "codec": "h264", "sha256": None})
    # corre como premium: o ficheiro gerado pode ultrapassar os 200 MB do registado,
    # e o requisito mede só o tempo de processamento
    set_user_type(c.u, "premium")
    try:
        status, body, _ = c.trim(0, 300, video=perf)
        if status != 202:
            record("TRIM-031", "recorte de 5 min a 1080p concluído em ≤ 5 min", False, f"HTTP {status}: {body}")
            return
        t0 = time.monotonic()
        job, _, _ = c.wait(body["job"]["_id"], timeout=600)
        elapsed = time.monotonic() - t0
        record("TRIM-031", "recorte de 5 min a 1080p concluído em ≤ 5 min",
               job["state"] == "completed" and elapsed <= 300,
               f"{job['state']} em {elapsed:.0f} s ({elapsed / 60:.1f} min)")
    finally:
        set_user_type(c.u, "free")
        c.delete_video(perf)  # remove o documento e o ficheiro do armazenamento


# ------------------------------------------------------------------------ main

def write_report(c):
    lines = [
        "# Resultados dos testes automáticos — UC-VID-001",
        "",
        f"Executado em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} com "
        "`tests/uc-vid-001/test_trim_requirements.py` (perfil registado; o bloco [7] "
        "passa o utilizador temporariamente a premium para testar o FA1).",
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
    if (c.remaining() or 0) < 3:
        sys.exit("O utilizador precisa de pelo menos 3 operações diárias disponíveis. "
                 "Volte a correr com --reset-quota para as repor (ambiente de testes).")
    active = [j for j in http("GET", f"{PROJECTS}/{c.u}/{c.p}/video-jobs", caller=c.u)[1]["jobs"]
              if j["state"] in ("queued", "processing")]
    if active:
        sys.exit("Há um pedido de vídeo em curso. Espere que termine ou cancele-o.")

    original = c.v
    c.v = c.copy_video("trabalho")
    print(f"Utilizador {c.u} · projeto {c.p} · vídeo {original} (testes sobre a cópia {c.v})")
    copies = [c.v]
    try:
        test_interval(c)
        test_success(c)
        test_active_and_cancel(c)
        test_quota(c)
        test_failure(c)
        test_limits(c)
        test_v15(c, copies)
        test_premium(c, copies)
        test_library_and_performance(c)
    finally:
        for video_id in copies:
            c.delete_video(video_id)
        write_report(c)

    passed = sum(1 for r in results if r[2])
    print(f"\n{passed} de {len(results)} testes passaram. Relatório: tests/uc-vid-001/resultados.md")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
