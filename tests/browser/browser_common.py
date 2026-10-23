"""Utilitários dos testes no browser (Playwright) das funcionalidades de vídeo.

As contas e os vídeos de partida são criados pela API (tests/qualidade/apiclient.py,
contas "__teste_...@teste.local"); tudo o resto passa pela interface, num browser real.
"""

import datetime
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "qualidade"))
from apiclient import REPO, User, make_media, users_db  # noqa: E402,F401

MEDIA = os.path.join(HERE, ".media")
SHOTS = os.path.join(HERE, "capturas")
BASE = os.environ.get("PICTURAS_URL", "https://localhost:8080")

results = []  # (teste, descrição, passou, detalhe)


def record(test, desc, ok, detail):
    results.append((test, desc, bool(ok), detail))
    print(("  PASSOU " if ok else "  FALHOU ") + f"{test}: {desc} — {detail}", flush=True)


def write_results(title):
    """Escreve resultados.md; quando só correram alguns grupos, substitui apenas as linhas desses testes."""
    path = os.path.join(HERE, "resultados.md")
    today = datetime.date.today().isoformat()
    rows = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.startswith("| TST-") or line.startswith("| ("):
                    rows[line.split("|")[1].strip()] = line.rstrip("\n")
    for test, desc, ok, detail in results:
        rows[test] = f"| {test} | {desc} | {'Passa' if ok else 'Falha'} | {detail.replace('|', '/')} ({today}) |"
    passed = sum(1 for line in rows.values() if "| Passa |" in line)
    lines = [f"# {title}", "", f"Última execução em {today}: **{passed}/{len(rows)}** passaram.", "",
             "| Teste | Descrição | Resultado | Detalhe |", "|---|---|---|---|", *rows.values()]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return sum(1 for r in results if r[2])


def prepare_media():
    """Vídeos de teste: os da importação (tests/uc-vid-002/.media) e três pequenos, gerados aqui."""
    big = make_media(os.path.join(REPO, "tests", "uc-vid-002", ".media"))
    os.makedirs(MEDIA, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    script = """
cd /m; F="-f lavfi -i"
[ -f sem_audio.mp4 ] || ffmpeg -v error -y $F testsrc2=size=640x360:rate=30 -t 30 -c:v libx264 -pix_fmt yuv420p -an sem_audio.mp4
[ -f outro.mp4 ] || ffmpeg -v error -y $F testsrc2=size=640x360:rate=30 $F sine=frequency=440 -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest outro.mp4
[ -f imagem.png ] || ffmpeg -v error -y $F testsrc2=size=320x240 -frames:v 1 imagem.png
"""
    subprocess.run(["docker", "run", "--rm", "-v", f"{MEDIA}:/m", "picturas-video_trim_tool", "sh", "-c", script],
                   check=True, timeout=300)
    media = {name: os.path.join(MEDIA, name) for name in os.listdir(MEDIA)}
    media.update(big)
    return media


def new_user(media, kind="free", videos=("video_teste.mp4",)):
    u = User(kind)
    ids = {}
    for name in videos:
        video, _, _ = u.import_video(media[name])
        assert video["state"] == "available", video
        ids[name] = video["_id"]
    return u, ids


def reset_quota(u):
    users_db(f"db.users.updateOne({{_id: ObjectId('{u.id}')}}, {{$set: {{operations: []}}}})")


def login(page, u):
    page.goto(f"{BASE}/login")
    page.fill("#email", u.email)
    page.fill("#password", "Passw0rd!")
    page.locator("button[type=submit]").click()
    page.wait_for_url("**/dashboard**", timeout=30000)


def open_video(page, u, vid):
    page.goto(f"{BASE}/dashboard/{u.project}?mode=edit&view=carousel&video={vid}")
    page.get_by_label("Faixas do vídeo").wait_for(timeout=30000)


def player_time(page):
    return page.evaluate(
        "() => { const v = [...document.querySelectorAll('video')].find(v => v.getBoundingClientRect().width > 0);"
        " return v ? v.currentTime : null }")


def shot(page, name):
    path = os.path.join(SHOTS, f"{name}.png")
    page.screenshot(path=path)
    return os.path.basename(path)


def wait_until(fn, timeout=60, step=0.5):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = fn()
        if value:
            return value
        time.sleep(step)
    return None
