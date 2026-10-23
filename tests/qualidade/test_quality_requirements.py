"""Testes de aceitação pela API dos requisitos transversais e de qualidade.

Cobrem, contra o sistema completo, os testes manuais que não dependem do browser:
TST-SEC-M01 a M03 (acesso, endereços assinados, cifra em repouso), TST-JOB-M01 e
M02 (reentrega após falha do processador, 20 pedidos em fila), TST-APPLY-M02 e M03
(tempos da aplicação de ferramentas), TST-LIB-M04 (tempos das faixas) e TST-QUAL-M04
(processadores a funcionar só com o motor de contentores).

Atenção: o TST-JOB-M01 termina o contentor video_trim_tool a meio de um pedido e
volta a arrancá-lo. Uso (com `docker compose up -d` a correr):
    python3 tests/qualidade/test_quality_requirements.py [--media PASTA]
Escreve o resultado em tests/qualidade/resultados.md.
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from apiclient import (MB, REPO, User, max_gap, make_media, plain_get, record,  # noqa: E402
                       request, results, write_results)


def ffprobe_url(url):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "video_trim_tool", "ffprobe", "-v", "error",
         "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames",
         "-of", "compact", url.replace("https://localhost:8080/s3", "http://seaweedfs:9000")],
        cwd=REPO, capture_output=True, text=True, timeout=120)
    return out.stdout.strip()


def test_access(m):
    a, b = User(), User()
    video, _, _ = a.import_video(m["video_teste.mp4"])
    vid = video["_id"]
    status, body = a.trim(vid, 0, 5)
    job = body["job"]["_id"]
    a.wait_job(job)
    probes = {
        "biblioteca": ("GET", "/videos", None), "vídeo": ("GET", f"/videos/{vid}", None),
        "endereço": ("GET", f"/videos/{vid}/url", None), "faixas": ("GET", f"/videos/{vid}/tracks", None),
        "pedido": ("GET", f"/video-jobs/{job}", None), "recorte": ("POST", f"/videos/{vid}/trim", {"start": 0, "end": 2}),
        "remover": ("DELETE", f"/videos/{vid}", None)}
    other = {k: request(meth, a.path(rest), body, b.token)[0] for k, (meth, rest, body) in probes.items()}
    anon = {k: request(meth, a.path(rest), body)[0] for k, (meth, rest, body) in probes.items()}
    still = a.video(vid)["state"] == "available"
    record("TST-SEC-M01", "ACCESS-001", "outro utilizador e pedidos sem sessão são recusados",
           all(s in (401, 403, 404) for s in list(other.values()) + list(anon.values())) and still,
           "outro utilizador: " + ", ".join(f"{k} {s}" for k, s in other.items())
           + "; sem sessão: " + ", ".join(sorted(set(str(s) for s in anon.values()))))
    return a, vid


def test_signed_urls(a, vid, m):
    url = a.call("GET", f"/videos/{vid}/url")[1]["url"]
    # assinatura S3 v2: Expires é o instante (epoch) até ao qual o endereço vale
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    until = int(q["Expires"][0])
    expires = round(until - time.time())
    ok_fetch = plain_get(url) == 200
    tampered = url.replace(f"Expires={until}", f"Expires={until + 86400}")
    signature = urllib.parse.quote(q["Signature"][0], safe="")
    forged = url.replace(f"Signature={signature}", "Signature=" + "A" * 27 + "%3D")
    plain = url.split("?")[0]
    refused = [plain_get(u) for u in (tampered, forged, plain)]
    record("TST-SEC-M02", "ACCESS-002",
           "endereço assinado válido até 1 h; alterado, forjado ou sem assinatura é recusado",
           ok_fetch and 0 < expires <= 3600 and all(s >= 400 for s in refused),
           f"validade {expires} s; original {'aceite' if ok_fetch else 'recusado'}; validade alterada, "
           f"assinatura forjada e sem assinatura: {refused}. Não se esperou 1 h para ver a expiração")

    # cifra em repouso: um excerto do ficheiro não aparece nos volumes do SeaweedFS
    with open(m["video_teste.mp4"], "rb") as f:
        f.seek(20 * MB)
        sample = f.read(64).hex()
    volume = subprocess.run(["docker", "compose", "ps", "-q", "seaweedfs"], cwd=REPO,
                            capture_output=True, text=True).stdout.strip()
    mount = subprocess.run(["docker", "inspect", "-f",
                            "{{range .Mounts}}{{if eq .Destination \"/data\"}}{{.Name}}{{end}}{{end}}", volume],
                           capture_output=True, text=True).stdout.strip()
    scan = ("import glob,sys\n"
            f"s=bytes.fromhex('{sample}'); n=0; t=0\n"
            "for p in glob.glob('/d/**/*.dat', recursive=True):\n"
            "  t+=1; d=open(p,'rb').read(); n+=d.count(s)\n"
            "print(t, n)")
    out = subprocess.run(["docker", "run", "--rm", "-v", f"{mount}:/d:ro", "picturas-video_trim_tool",
                          "python3", "-c", scan], capture_output=True, text=True, timeout=600).stdout.split()
    files, found = int(out[0]), int(out[1])
    record("TST-SEC-M03", "ACCESS-003", "o conteúdo do vídeo não aparece em claro nos volumes",
           files > 0 and found == 0,
           f"excerto de 64 bytes do vídeo procurado em {files} ficheiros de volume: {found} ocorrências")


def test_processor_crash(m):
    u = User()
    video, _, _ = u.import_video(m["cinco_min_1080p.mp4"])
    status, body = u.trim(video["_id"], 0, 300)
    job = body["job"]["_id"]
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        j = u.job(job)
        if j["state"] == "processing" and j["progress"] >= 10:
            break
        time.sleep(0.5)
    at = j["progress"]
    subprocess.run(["docker", "compose", "kill", "video_trim_tool"], cwd=REPO, capture_output=True)
    time.sleep(3)
    subprocess.run(["docker", "compose", "start", "video_trim_tool"], cwd=REPO, capture_output=True)
    final, states, _ = u.wait_job(job, timeout=900)
    # os ficheiros parciais do processamento interrompido não podem ficar no processador
    left = subprocess.run(["docker", "compose", "exec", "-T", "video_trim_tool", "sh", "-c",
                           "ls -d /tmp/trim-* 2>/dev/null | wc -l"],
                          cwd=REPO, capture_output=True, text=True).stdout.strip()
    record("TST-JOB-M01", "PROCESS-003",
           "processador terminado a meio: o pedido volta a ser processado e termina, sem deixar temporários",
           final["state"] in ("completed", "failed") and left == "0",
           f"terminado a {at} %; estados vistos depois: {' → '.join(states)}; temporários no processador: "
           f"{left}. A deteção de pedidos parados (20 min) é testada em test_stalled_job.py")
    return final["state"] == "completed"


def test_queue(m, n=20):
    users = [User("premium") for _ in range(n)]
    videos = [u.import_video(m["video_teste.mp4"])[0]["_id"] for u in users]
    replies, threads = [None] * n, []

    def submit(i):
        replies[i] = users[i].trim(videos[i], 0, 10)

    for i in range(n):
        threads.append(threading.Thread(target=submit, args=(i,)))
    t0 = time.monotonic()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    accepted = [r[1]["job"]["_id"] for r in replies if r[0] == 202]
    finals = [users[i].wait_job(accepted[i], timeout=1200)[0]["state"] for i in range(len(accepted))]
    record("TST-JOB-M02", "PROCESS-004", f"{n} pedidos simultâneos de contas premium ficam em fila e terminam",
           len(accepted) == n and all(s in ("completed", "failed", "cancelled") for s in finals),
           f"aceites {len(accepted)}/{n}; concluídos {finals.count('completed')}; "
           f"todos terminaram em {time.monotonic() - t0:.0f} s com 1 processador")


def test_apply_times(m):
    u = User()
    video, _, _ = u.import_video(m["dois_min_1080p.mp4"])
    tools = [{"type": "resize", "width": 1280, "height": 720},
             {"type": "binarization", "threshold": 128},
             {"type": "rotate", "degrees": 180}]
    t0 = time.monotonic()
    status, body = u.apply(video["_id"], tools)
    confirm = time.monotonic() - t0
    job = body["job"]["_id"]
    started = {}

    def progress(j):
        if j["state"] == "processing" and "t" not in started:
            started["t"] = time.monotonic()

    final, states, updates = u.wait_job(job, timeout=1200, on_progress=progress)
    took = time.monotonic() - started.get("t", t0)
    processing_updates = [t for t in updates if t >= started.get("t", t0)]
    after = u.video(video["_id"])
    probe = ffprobe_url(u.call("GET", f"/videos/{video['_id']}/url")[1]["url"])
    record("TST-APPLY-M02", "APPLY-017; JOB-012",
           "confirmação em ≤ 2 s e progresso e fotogramas atualizados a cada ≤ 5 s",
           status == 202 and confirm <= 2 and max_gap(processing_updates) <= 5,
           f"confirmação {confirm:.2f} s; maior intervalo entre atualizações {max_gap(processing_updates):.1f} s; "
           f"fotogramas {final.get('frames_processed')}")
    record("TST-APPLY-M03", "APPLY-035",
           "2 min, 1920 × 1080, 30 fps, cadeia de 3 ferramentas em ≤ 10 min",
           final["state"] == "completed" and took <= 600,
           f"{took:.0f} s ({took / 60:.1f} min); resultado {after['width']} × {after['height']}, "
           f"{after.get('frame_count')} fotogramas; {probe.replace(chr(10), '; ')}")
    return final["state"] == "completed"


def test_tracks_times(m):
    u = User()
    video, _, _ = u.import_video(m["cinco_min_1080p.mp4"])
    path = f"/videos/{video['_id']}/tracks"
    t0 = time.monotonic()
    status, body = u.call("GET", path)
    first = time.monotonic() - t0
    deadline = time.monotonic() + 120
    while body.get("state") not in ("ready", "failed") and time.monotonic() < deadline:
        time.sleep(0.5)
        status, body = u.call("GET", path)
    waveform = time.monotonic() - t0
    t1 = time.monotonic()
    status, body = u.call("GET", path)
    again = time.monotonic() - t1
    record("TST-LIB-M04", "LIB-009",
           "5 min: faixas em ≤ 2 s, forma de onda em ≤ 30 s e reabertura em ≤ 2 s",
           first <= 2 and waveform <= 30 and again <= 2 and body.get("state") == "ready",
           f"faixas {first:.2f} s; forma de onda {waveform:.1f} s; reabertura {again:.2f} s "
           "(medido na API; o desenho no browser não está incluído)")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--media", default=os.path.join(HERE, "..", "uc-vid-002", ".media"))
    parser.add_argument("--fila", action="store_true",
                        help="corre também o TST-JOB-M02 (20 contas com ficheiros; ver T-04 no relatório)")
    args = parser.parse_args()
    m = make_media(args.media)

    print("Requisitos transversais e de qualidade")
    a, vid = test_access(m)
    test_signed_urls(a, vid, m)
    test_tracks_times(m)
    apply_ok = test_apply_times(m)
    crash_ok = test_processor_crash(m)
    if args.fila:
        test_queue(m)
    host_ffmpeg = shutil.which("ffmpeg") is not None
    engine = subprocess.run(["docker", "info", "--format", "{{.OperatingSystem}} {{.ServerVersion}}"],
                            capture_output=True, text=True).stdout.strip()
    record("TST-QUAL-M04", "PORT-001",
           "processadores de vídeo concluem pedidos sem dependências no anfitrião",
           apply_ok and crash_ok and not host_ffmpeg,
           f"{platform.system()} com {engine}; FFmpeg no anfitrião: {'sim' if host_ffmpeg else 'não'}; "
           "recorte e aplicação de ferramentas concluídos")

    passed = write_results(os.path.join(HERE, "resultados.md"), "Resultados — requisitos de qualidade (API)")
    print(f"\n{passed}/{len(results)} passaram")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
