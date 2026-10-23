"""Cliente mínimo da API do PictuRAS (pelo apiGateway, com JWT), partilhado pelos
testes de aceitação de tests/uc-vid-002 e tests/qualidade.

Os testes correm contra o sistema completo (`docker compose up -d`), criam contas
próprias (`__teste_...@teste.local`) e geram os vídeos de que precisam com o FFmpeg
do contentor video_trim_tool. Só usam a biblioteca padrão do Python.
"""

import datetime
import hashlib
import json
import os
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import uuid

GATEWAY = os.environ.get("PICTURAS_GATEWAY", "https://localhost:8080/api-gateway")
USERS = "https://localhost:10001"
SSL = ssl._create_unverified_context()  # certificados self-signed do ambiente de dev

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MB = 1024 * 1024

results = []  # (teste, requisitos, descrição, passou, detalhe)


def record(test, reqs, desc, ok, detail=""):
    results.append((test, reqs, desc, ok, detail))
    print(("  PASSOU " if ok else "  FALHOU ") + f"{test} ({reqs}): {desc}" + (f" — {detail}" if detail else ""))


def write_results(path, title):
    today = datetime.date.today().isoformat()
    passed = sum(1 for r in results if r[3])
    lines = [f"# {title}", "", f"Executado em {today}: **{passed}/{len(results)}** passaram.", "",
             "| Teste | Requisitos | Descrição | Resultado | Detalhe |", "|---|---|---|---|---|"]
    for test, reqs, desc, ok, detail in results:
        lines.append(f"| {test} | {reqs} | {desc} | {'Passa' if ok else 'Falha'} | {detail} |")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return passed


def request(method, url, body=None, token=None, raw=None, headers=None, timeout=120):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/octet-stream" if raw is not None else "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, context=SSL, timeout=timeout) as resp:
            content = resp.read()
            return resp.status, _parse(content)
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read())


def plain_get(url):
    """GET sem cabeçalhos: o Content-Type faz parte do que a assinatura S3 v2 assina."""
    try:
        with urllib.request.urlopen(url, context=SSL, timeout=120) as resp:
            resp.read(1024)
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def _parse(content):
    if not content:
        return None
    try:
        return json.loads(content)
    except ValueError:
        return content.decode(errors="replace")


def mongo(db, port, js):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", db, "mongo", "--port", str(port),
         "project" if db == "projects_mongoDB" else "user", "--quiet", "--eval", js],
        cwd=REPO, capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(out.stderr or out.stdout)
    return out.stdout.strip()


def projects_db(js):
    return mongo("projects_mongoDB", 27018, js)


def users_db(js):
    return mongo("users_mongoDB", 27019, js)


def fingerprint(path):
    """Igual a fingerprintFile do frontend: SHA-256 do primeiro e do último MB."""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        head = f.read(MB)
        f.seek(max(0, size - MB))
        tail = f.read(MB)
    return hashlib.sha256(head + tail).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(MB), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_url(url):
    h = hashlib.sha256()
    with urllib.request.urlopen(url, context=SSL, timeout=300) as resp:
        for chunk in iter(lambda: resp.read(MB), b""):
            h.update(chunk)
    return h.hexdigest()


def make_media(folder):
    """Gera os vídeos de teste (sintéticos) com o FFmpeg do contentor video_trim_tool."""
    os.makedirs(folder, exist_ok=True)
    teste = os.path.join(REPO, "Docs", "testes", "video_teste.mp4")
    if not os.path.exists(os.path.join(folder, "video_teste.mp4")):
        with open(teste, "rb") as src, open(os.path.join(folder, "video_teste.mp4"), "wb") as dst:
            dst.write(src.read())
    script = """
cd /m; F="-f lavfi -i"
[ -f formato.avi ] || ffmpeg -v error -y $F testsrc2=size=640x360:rate=30 -t 3 -c:v mpeg4 formato.avi
[ -f renomeado.mp4 ] || cp formato.avi renomeado.mp4
[ -f truncado.mp4 ] || head -c 2000000 video_teste.mp4 > truncado.mp4
[ -f seis_min.mp4 ] || ffmpeg -v error -y $F testsrc2=size=320x240:rate=15 $F sine=frequency=440 -t 360 -c:v libx264 -b:v 150k -c:a aac -shortest seis_min.mp4
[ -f grande_190mb.mp4 ] || ffmpeg -v error -y $F testsrc2=size=1920x1080:rate=30 $F sine=frequency=440 -t 60 -c:v libx264 -preset ultrafast -b:v 25M -maxrate 25M -bufsize 50M -c:a aac -shortest grande_190mb.mp4
[ -f dois_min_1080p.mp4 ] || ffmpeg -v error -y $F testsrc2=size=1920x1080:rate=30 $F sine=frequency=440 -t 120 -c:v libx264 -preset veryfast -b:v 6M -c:a aac -shortest dois_min_1080p.mp4
[ -f cinco_min_1080p.mp4 ] || ffmpeg -v error -y $F testsrc2=size=1920x1080:rate=30 $F sine=frequency=440 -t 300 -c:v libx264 -preset veryfast -b:v 3M -c:a aac -shortest cinco_min_1080p.mp4
"""
    subprocess.run(["docker", "run", "--rm", "-v", f"{os.path.abspath(folder)}:/m",
                    "picturas-video_trim_tool", "sh", "-c", script], check=True, timeout=1200)
    return {name: os.path.join(folder, name) for name in os.listdir(folder)}


class User:
    """Uma conta de teste, com um projeto."""

    def __init__(self, user_type="free"):
        tag = uuid.uuid4().hex[:10]
        self.email = f"__teste_{tag}@teste.local"
        status, body = request("POST", f"{GATEWAY}/users/", {
            "name": f"Teste {tag}", "email": self.email, "password": "Passw0rd!", "type": "free"})
        assert status in (200, 201), (status, body)
        self.id, self.token = body["user"]["_id"], body["jwt"]
        if user_type != "free":
            users_db(f"db.users.updateOne({{_id: ObjectId('{self.id}')}}, {{$set: {{type: '{user_type}'}}}})")
            # o tipo vem no JWT: um novo login traz o tipo atualizado
            status, body = request("POST", f"{GATEWAY}/users/{self.email}/login", {"password": "Passw0rd!"})
            self.token = body["jwt"]
        status, body = request("POST", f"{GATEWAY}/projects/{self.id}", {"name": f"Teste {tag}"}, self.token)
        assert status == 201, (status, body)
        self.project = body["_id"]

    # --- caminhos e chamadas
    def path(self, rest=""):
        return f"{GATEWAY}/projects/{self.id}/{self.project}{rest}"

    def call(self, method, rest, body=None, **kw):
        return request(method, self.path(rest), body, self.token, **kw)

    def processed_today(self):
        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        out = users_db(
            f"var u = db.users.findOne({{_id: ObjectId('{self.id}')}});"
            f"var op = (u.operations || []).filter(function(o){{ return o.day.toISOString().slice(0,10) == '{today}' }})[0];"
            "print(op ? op.processed : 0)")
        return int(out or 0)

    def library(self):
        return self.call("GET", "/videos")[1]

    def video(self, vid):
        return self.call("GET", f"/videos/{vid}")[1]

    # --- importação (o mesmo protocolo do frontend: início, blocos, conclusão)
    def start_import(self, path, name=None, size=None):
        return self.call("POST", "/videos", {
            "name": name or os.path.basename(path),
            "size": size if size is not None else os.path.getsize(path),
            "fingerprint": fingerprint(path)})

    def send(self, vid, path, offset, chunk_size, stop_at=None):
        """Envia blocos a partir de offset; pára antes de stop_at bytes (para simular falhas)."""
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            while offset < size and (stop_at is None or offset < stop_at):
                f.seek(offset)
                status, body = self.call("PUT", f"/videos/{vid}/chunk?offset={offset}", raw=f.read(chunk_size))
                if status != 200:
                    return offset, (status, body)
                offset = body["received"]
        return offset, None

    def wait_import(self, vid, timeout=180):
        """Segue a importação até um estado final; devolve (vídeo, estados vistos, instante do fim)."""
        states, end = [], time.monotonic() + timeout
        while time.monotonic() < end:
            video = self.video(vid)
            if not states or states[-1] != video["state"]:
                states.append(video["state"])
            if video["state"] in ("available", "failed", "cancelled"):
                return video, states, time.monotonic()
            time.sleep(0.3)
        raise TimeoutError(f"a importação {vid} não terminou em {timeout} s")

    def import_video(self, path, name=None):
        """Importação completa; devolve (vídeo final, estados, tempos)."""
        t0 = time.monotonic()
        status, body = self.start_import(path, name)
        assert status == 201, (status, body)
        vid, chunk = body["video"]["_id"], body["chunkSize"]
        states = [body["video"]["state"]]
        t_first = None
        size, offset, chunk_times = os.path.getsize(path), 0, []
        with open(path, "rb") as f:
            while offset < size:
                f.seek(offset)
                c0 = time.monotonic()
                status, r = self.call("PUT", f"/videos/{vid}/chunk?offset={offset}", raw=f.read(chunk))
                assert status == 200, (status, r)
                t_first = t_first or c0
                chunk_times.append(time.monotonic() - c0)
                offset = r["received"]
        t_sent = time.monotonic()
        status, body = self.call("POST", f"/videos/{vid}/complete", {})
        assert status in (200, 202), (status, body)
        video, seen, t_end = self.wait_import(vid)
        for s in seen:
            if states[-1] != s:
                states.append(s)
        return video, states, {"start": t_first - t0, "max_chunk": max(chunk_times or [0]),
                               "validation": t_end - t_sent}

    # --- pedidos de processamento
    def trim(self, vid, start, end):
        return self.call("POST", f"/videos/{vid}/trim", {"start": start, "end": end})

    def apply(self, vid, tools):
        return self.call("POST", f"/videos/{vid}/apply", {"tools": tools})

    def job(self, job_id):
        return self.call("GET", f"/video-jobs/{job_id}")[1]["job"]

    def wait_job(self, job_id, timeout=900, on_progress=None):
        states, updates, last, end = [], [], None, time.monotonic() + timeout
        while time.monotonic() < end:
            job = self.job(job_id)
            if not states or states[-1] != job["state"]:
                states.append(job["state"])
            key = (job["state"], job.get("progress"), job.get("frames_processed"))
            if key != last:
                updates.append(time.monotonic())
                last = key
                if on_progress:
                    on_progress(job)
            if job["state"] in ("completed", "failed", "cancelled"):
                return job, states, updates
            time.sleep(0.5)
        raise TimeoutError(f"o pedido {job_id} não terminou em {timeout} s")


def max_gap(instants):
    return max((b - a for a, b in zip(instants, instants[1:])), default=0.0)
