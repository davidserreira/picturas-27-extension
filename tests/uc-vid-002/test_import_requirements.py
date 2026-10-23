"""Testes de aceitação (caixa negra) do UC-VID-002 — Importar um vídeo para a biblioteca.

Executam pela API, contra o sistema completo, os testes TST-IMPORT-M01 a M12 que não
dependem do browser: o mesmo protocolo do frontend (início, blocos de 5 MB, conclusão),
com contas de teste próprias. As verificações só de interface (botão "Add Video",
indicador visível noutras páginas, validação no browser antes do envio) ficam para
o teste manual.

Uso (com `docker compose up -d` a correr):
    python3 tests/uc-vid-002/test_import_requirements.py [--media PASTA]
Escreve o resultado em tests/uc-vid-002/resultados.md.
"""

import argparse
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "qualidade"))

from apiclient import (MB, REPO, User, projects_db, record, sha256_file,  # noqa: E402
                       sha256_url, make_media, write_results)


def part_exists(video_id):
    out = subprocess.run(["docker", "compose", "exec", "-T", "projects", "test", "-e",
                          f"images/video_uploads/{video_id}.part"], cwd=REPO)
    return out.returncode == 0


def test_success(m):
    u = User()
    before = u.processed_today()
    video, states, times = u.import_video(m["video_teste.mp4"])
    lib = u.library()
    listed = next(v for v in lib["videos"] if v["_id"] == video["_id"])
    stored = sha256_url(u.call("GET", f"/videos/{video['_id']}/url")[1]["url"])
    record("TST-IMPORT-M01", "IMPORT-002, 007, 013, 014, 015, 029",
           "importação válida: estados, biblioteca e ficheiro idêntico",
           states == ["uploading", "validating", "available"]
           and listed["name"] == "video_teste.mp4" and round(listed["duration"]) == 60
           and listed["size"] == os.path.getsize(m["video_teste.mp4"])
           and stored == sha256_file(m["video_teste.mp4"]),
           f"estados {' → '.join(states)}; {listed['name']}, {listed['duration']:.0f} s, "
           f"{listed['size']} bytes; SHA-256 igual: {stored == sha256_file(m['video_teste.mp4'])}")
    record("TST-IMPORT-M11", "IMPORT-021", "importar não gasta operações do dia",
           u.processed_today() == before, f"operações usadas {before} → {u.processed_today()}")

    used = lib["usage"]["used"]
    status, _ = u.call("DELETE", f"/videos/{video['_id']}")
    after = u.library()
    record("TST-IMPORT-M10", "IMPORT-025, 026", "remover um vídeo liberta o espaço",
           status in (200, 204) and all(v["_id"] != video["_id"] for v in after["videos"])
           and used - after["usage"]["used"] == video["size"],
           f"ocupação {used} → {after['usage']['used']} bytes (−{used - after['usage']['used']})")
    return u


def test_rejections_before_upload(m, u):
    status, body = u.start_import(m["formato.avi"])
    record("TST-IMPORT-M02", "IMPORT-003", "extensão .avi recusada antes do envio",
           status == 415 and "Formato não suportado" in body.get("message", ""),
           f"{status}: {body.get('message')}")

    status, body = u.start_import(m["video_teste.mp4"], name="grande.mp4", size=250 * MB)
    record("TST-IMPORT-M03", "IMPORT-004", "250 MB recusado no registado com o limite",
           status >= 400 and "200 MB" in body.get("message", ""), f"{status}: {body.get('message')}")

    fake = projects_db(
        "var p = db.projects.findOne({_id: ObjectId('%s')});"
        "var r = db.videos.insertOne({user_id: p.user_id, project_id: p._id, name: '__teste_ocupacao.mp4',"
        " file_name: '__teste_ocupacao.mp4', fingerprint: 'teste', state: 'available', size: %d,"
        " received: %d, format: 'mp4', codec: 'h264', duration: 60, createdAt: new Date(), updatedAt: new Date()});"
        "print(r.insertedId.str)" % (u.project, 900 * MB, 900 * MB))
    try:
        status, body = u.start_import(m["video_teste.mp4"], name="cento_cinquenta.mp4", size=150 * MB)
        usage = u.library()["usage"]
        record("TST-IMPORT-M04", "IMPORT-005, 027", "sem espaço livre: não começa e indica o espaço",
               status >= 400 and "livre" in body.get("message", "").lower()
               and usage["limit"] == 1024 * MB,
               f"{status}: {body.get('message')} (ocupação {usage['used'] // MB} MB de {usage['limit'] // MB} MB)")
    finally:
        projects_db(f"db.videos.deleteOne({{_id: ObjectId('{fake}')}})")

    status, first = u.start_import(m["video_teste.mp4"])
    status2, body = u.start_import(m["video_teste.mp4"], name="outro.mp4")
    record("TST-IMPORT-M05", "IMPORT-006", "segunda importação ativa recusada no registado",
           status == 201 and status2 >= 400, f"{status2}: {body.get('message')}")
    u.call("POST", f"/videos/{first['video']['_id']}/cancel", {})


def test_invalid_content(m, u):
    for key, test, expected in (("renomeado.mp4", "formato", "Formato não suportado"),
                                ("truncado.mp4", "ilegível", "Não foi possível ler este vídeo"),
                                ("seis_min.mp4", "duração", "5 min")):
        video, states, _ = u.import_video(m[key])
        visible = [v for v in u.library()["videos"] if v["_id"] == video["_id"] and v["state"] == "available"]
        ok = video["state"] == "failed" and expected in (video.get("reason") or "") and not visible
        if key == "seis_min.mp4":
            record("TST-IMPORT-M07", "IMPORT-012", "6 min recusado depois do envio e removido",
                   ok and not part_exists(video["_id"]), f"{video['state']}: {video.get('reason')}")
        else:
            results_m06.append((ok, f"{key}: {video['state']} — {video.get('reason')}"))
    record("TST-IMPORT-M06", "IMPORT-010, 011, 023",
           "AVI renomeado e MP4 truncado recusados e fora da biblioteca",
           all(ok for ok, _ in results_m06), "; ".join(d for _, d in results_m06))


results_m06 = []


def test_cancel_and_resume(m):
    big = m["grande_190mb.mp4"]
    size = os.path.getsize(big)

    u = User()
    status, body = u.start_import(big)
    vid, chunk = body["video"]["_id"], body["chunkSize"]
    sent, _ = u.send(vid, big, 0, chunk, stop_at=size // 2)
    had_part = part_exists(vid)
    status, body = u.call("POST", f"/videos/{vid}/cancel", {})
    time.sleep(1)
    record("TST-IMPORT-M08", "IMPORT-016, 017, 023", "cancelar a meio: Cancelado, sem parcial nem vídeo",
           status == 200 and body["video"]["state"] == "cancelled" and had_part and not part_exists(vid)
           and all(v["state"] != "available" for v in u.library()["videos"] if v["_id"] == vid),
           f"cancelado a {100 * sent // size} %; parcial antes {had_part}, depois {part_exists(vid)}")

    # interrupção por falha de ligação: deixa de enviar; o servidor marca "Interrompido" ao fim de 60 s
    status, body = u.start_import(big)
    vid = body["video"]["_id"]
    sent, _ = u.send(vid, big, 0, chunk, stop_at=int(size * 0.6))
    deadline = time.monotonic() + 120
    while u.video(vid)["state"] != "interrupted" and time.monotonic() < deadline:
        time.sleep(3)
    interrupted = u.video(vid)
    status, body = u.call("POST", f"/videos/{vid}/resume", {
        "name": os.path.basename(big), "size": size, "fingerprint": __import__("apiclient").fingerprint(big)})
    resumed_at = body["video"]["received"] if status == 200 else None
    u.send(vid, big, resumed_at or 0, chunk)
    u.call("POST", f"/videos/{vid}/complete", {})
    final, _, _ = u.wait_import(vid)
    stored = sha256_url(u.call("GET", f"/videos/{vid}/url")[1]["url"])
    resume_ok = (interrupted["state"] == "interrupted" and interrupted.get("expiresAt")
                 and resumed_at == sent and final["state"] == "available" and stored == sha256_file(big))

    # expiração: sem retoma, o parcial é removido e a importação falha (o relógio da
    # interrupção é recuado 61 min na base de dados para não esperar 1 h)
    status, body = u.start_import(big, name="expira.mp4")
    vid2 = body["video"]["_id"]
    u.send(vid2, big, 0, chunk, stop_at=3 * chunk)
    u.call("POST", f"/videos/{vid2}/interrupt", {})
    projects_db(f"db.videos.updateOne({{_id: ObjectId('{vid2}')}}, "
                "{$set: {interrupted_at: new Date(Date.now() - 61 * 60 * 1000)}})")
    deadline = time.monotonic() + 60
    while u.video(vid2)["state"] == "interrupted" and time.monotonic() < deadline:
        time.sleep(3)
    expired = u.video(vid2)
    expire_ok = expired["state"] == "failed" and not part_exists(vid2)
    record("TST-IMPORT-M09", "IMPORT-018, 019, 020",
           "falha de ligação: Interrompido, retoma sem reenviar e expiração ao fim de 1 h",
           bool(resume_ok and expire_ok),
           f"interrompido a {100 * sent // size} % (expira {interrupted.get('expiresAt')}); retoma em "
           f"{resumed_at} de {sent} bytes; SHA-256 igual: {stored == sha256_file(big)}; "
           f"expirado: {expired['state']} — {expired.get('reason')}")
    return u, vid


def test_times(m, u, vid):
    u.call("DELETE", f"/videos/{vid}")
    video, states, t = u.import_video(m["grande_190mb.mp4"], name="tempos.mp4")
    record("TST-IMPORT-M12", "IMPORT-008, 009, 030",
           "190 MB: envio começa em ≤ 2 s, progresso a cada ≤ 5 s, validação em ≤ 30 s",
           video["state"] == "available" and t["start"] <= 2 and t["max_chunk"] <= 5 and t["validation"] <= 30,
           f"início {t['start']:.2f} s; maior intervalo entre blocos de 5 MB {t['max_chunk']:.2f} s; "
           f"validação {t['validation']:.1f} s")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--media", default=os.path.join(HERE, ".media"),
                        help="pasta para os vídeos de teste gerados (não versionada)")
    args = parser.parse_args()

    print("A preparar os vídeos de teste…")
    m = make_media(args.media)
    print("UC-VID-002 — importação")
    u = test_success(m)
    test_rejections_before_upload(m, u)
    test_invalid_content(m, u)
    u2, vid = test_cancel_and_resume(m)
    test_times(m, u2, vid)

    passed = write_results(os.path.join(HERE, "resultados.md"), "Resultados — UC-VID-002 (importação)")
    from apiclient import results
    print(f"\n{passed}/{len(results)} passaram")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
