"""TST-JOB-M01, 2.ª parte (REQ-VID-PROCESS-002): um processador que deixa de dar notícias
(contentor suspenso) faz o pedido passar a "Falhado" ao fim de 20 min sem progresso; a
operação é devolvida e, quando o processador retoma, o resultado tardio não altera o vídeo.

Atenção: suspende o contentor video_trim_tool durante cerca de 21 min (os recortes de
outros utilizadores ficam em fila até ao fim). Uso (com `docker compose up -d` a correr):
    python3 tests/qualidade/test_stalled_job.py [--media PASTA]
Escreve o resultado em tests/qualidade/resultados-pedido-parado.md.
"""

import argparse
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from apiclient import REPO, User, make_media, record, sha256_url, write_results  # noqa: E402


def compose(*args):
    return subprocess.run(["docker", "compose", *args], cwd=REPO, capture_output=True, text=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--media", default=os.path.join(HERE, "..", "uc-vid-002", ".media"))
    m = make_media(parser.parse_args().media)

    u = User()
    video, _, _ = u.import_video(m["cinco_min_1080p.mp4"])
    vid = video["_id"]
    url = lambda: u.call("GET", f"/videos/{vid}/url")[1]["url"]  # noqa: E731
    sha_before = sha256_url(url())
    ops_before = u.processed_today()

    # remover um intervalo recodifica o vídeo todo: dura o suficiente para o apanhar a meio
    status, body = u.call("POST", f"/videos/{vid}/trim", {"start": 10, "end": 20, "mode": "remove"})
    assert status == 202, (status, body)
    job_id = body["job"]["_id"]
    ops_reserved = u.processed_today()
    while True:
        job = u.job(job_id)
        if job["state"] == "processing" and (job.get("progress") or 0) >= 5:
            break
        assert job["state"] in ("queued", "processing"), job["state"]
        time.sleep(0.5)
    at = job["progress"]
    compose("pause", "video_trim_tool")
    paused = time.monotonic()
    print(f"video_trim_tool suspenso a {at} %; à espera da deteção do pedido parado (20 min)…", flush=True)
    try:
        final = None
        while time.monotonic() - paused < 27 * 60:
            job = u.job(job_id)
            if job["state"] != "processing":
                final = job
                break
            time.sleep(10)
        waited = time.monotonic() - paused
        ops_after = u.processed_today()
    finally:
        compose("unpause", "video_trim_tool")
    time.sleep(150)  # deixa o processador retomar e terminar (ou largar) o pedido
    after = u.video(vid)
    sha_after = sha256_url(url())
    videos = u.library()["videos"]
    job_end = u.job(job_id)

    state = final["state"] if final else "processing"
    message = ((final or {}).get("error") or {}).get("message")
    record("TST-JOB-M01", "PROCESS-002",
           "processador parado: o pedido fica Falhado ao fim de 20 min, a operação é devolvida e o vídeo não muda",
           state == "failed" and 19.5 * 60 <= waited <= 23 * 60 and ops_reserved == ops_before + 1
           and ops_after == ops_before and sha_after == sha_before and len(videos) == 1
           and job_end["state"] == "failed",
           f"recorte (remover 0:10–0:20) de um vídeo de 5 min a 1080p; video_trim_tool suspenso a {at} %; "
           f"'{state}' ({message}) {waited / 60:.1f} min depois; operações usadas {ops_before} → {ops_reserved} "
           f"(reserva) → {ops_after} (devolvida); depois de o processador retomar, o pedido continua "
           f"'{job_end['state']}', o vídeo tem o mesmo SHA-256 e {after['duration']:.0f} s e a biblioteca tem "
           f"{len(videos)} vídeo")
    passed = write_results(os.path.join(HERE, "resultados-pedido-parado.md"),
                           "Resultados — pedido parado (TST-JOB-M01, 2.ª parte)")
    sys.exit(0 if passed == 1 else 1)


if __name__ == "__main__":
    main()
