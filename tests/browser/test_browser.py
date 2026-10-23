"""Testes no browser (Playwright) dos testes manuais do capítulo 10 que precisam da interface.

Correm contra o sistema completo (`docker compose up -d`), com contas de teste próprias,
num Google Chrome real (e, no TST-QUAL-M01, também no Microsoft Edge e no Firefox):
TST-LIB-M01 a M04, TST-TRIM-M04 e M15 a M17, TST-APPLY-M01 e M02, TST-JOB-M03,
TST-IMPORT-M12 e M13 e TST-QUAL-M01.

Uso (requer `pip install playwright` e `python -m playwright install firefox`):
    python3 tests/browser/test_browser.py [faixas recorte aplicar importar compatibilidade]
Escreve o resultado em tests/browser/resultados.md e as capturas em tests/browser/capturas/.
"""

import os
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

from browser_common import (BASE, User, login, new_user, open_video, player_time, prepare_media,
                            record, reset_quota, results, SHOTS, shot, wait_until, write_results)

CONTENT = "Posição de reprodução: clique, arraste o marcador ou use as setas"


def new_page(browser):
    return browser.new_context(ignore_https_errors=True, viewport={"width": 1600, "height": 1000}).new_page()


def timeline(page):
    return page.get_by_label(CONTENT)


def x_at(page, t, duration):
    box = timeline(page).bounding_box()
    return box["x"] + box["width"] * t / duration, box


def playhead_pct(page):
    return page.evaluate(
        """() => { const c = document.querySelector('[aria-label^="Posição de reprodução"]');
                   const p = c && c.querySelector(':scope > div.z-10');
                   return p ? parseFloat(p.style.left) : null }""")


def frames_drawn(page):
    """Fração das posições da faixa V1 que já têm um fotograma desenhado."""
    return page.evaluate(
        """() => { const c = document.querySelector('[aria-label^="Posição de reprodução"] canvas');
                   if (!c || !c.width) return 0;
                   const g = c.getContext('2d'); const h = c.height;
                   const n = Math.max(1, Math.round(c.width / (h * 16 / 9)));
                   let drawn = 0;
                   for (let i = 0; i < n; i++) {
                     const x = Math.min(c.width - 1, Math.floor((i + 0.5) * c.width / n));
                     if (g.getImageData(x, Math.floor(h / 2), 1, 1).data[3] > 0) drawn++;
                   }
                   return drawn / n }""")


def scroll_widths(page):
    return page.evaluate(
        "() => { const s = document.querySelector('[aria-label^=\"Posição de reprodução\"]').parentElement;"
        " return [s.scrollWidth, s.clientWidth] }")


def open_from_grid(page, u, name, details):
    """Abre um vídeo a partir da grelha; devolve os tempos (lista de faixas, forma de onda) desde o clique."""
    page.goto(f"{BASE}/dashboard/{u.project}?mode=edit&view=grid")
    tile = page.locator(f'[role=button][title="{name}"]')
    tile.wait_for(timeout=30000)
    page.wait_for_timeout(1500)
    t0 = time.monotonic()
    tile.click()
    page.get_by_text(details).wait_for(timeout=30000)
    t_list = time.monotonic() - t0
    page.locator(f'[aria-label="{CONTENT}"] svg').first.wait_for(timeout=60000)
    return t_list, time.monotonic() - t0


# ------------------------------------------------------------------ faixas (UC-VID-002/FA4)

def test_tracks(p, m):
    print("\nFaixas de um vídeo")
    u, ids = new_user(m, "free", ("video_teste.mp4", "sem_audio.mp4", "cinco_min_1080p.mp4"))
    b = p.chromium.launch(channel="chrome")
    page = new_page(b)
    login(page, u)

    t_list, t_wave = open_from_grid(page, u, "video_teste.mp4", "H.264 · 1280 × 720 · 30 fps")
    page.get_by_text("AAC · mono · 44,1 kHz").wait_for(timeout=10000)
    full = wait_until(lambda: frames_drawn(page) >= 0.999, timeout=60)
    ruler = [s for s in timeline(page).locator("div.h-5 span").all_inner_texts() if s.strip()]
    img = shot(page, "lib-m01")
    record("TST-LIB-M01", "faixas V1 e A1 do video_teste.mp4", full and ruler[0] == "0:00",
           f"V1 'H.264 · 1280 × 720 · 30 fps' com fotogramas ao longo de toda a faixa e A1 'AAC · mono · "
           f"44,1 kHz' com a forma de onda, numa régua de {ruler[0]} a 1:00 (marcas de 10 em 10 s); depois do "
           f"clique na grelha, faixas em {t_list:.1f} s e forma de onda em {t_wave:.1f} s [{img}]")

    f_list, f_wave = open_from_grid(page, u, "cinco_min_1080p.mp4", "H.264 · 1920 × 1080 · 30 fps")
    img = shot(page, "lib-m04-5min")
    r_list, r_wave = open_from_grid(page, u, "cinco_min_1080p.mp4", "H.264 · 1920 × 1080 · 30 fps")
    record("TST-LIB-M04", "tempos das faixas de um vídeo de 5 min no browser",
           f_list <= 2 and f_wave <= 30 and r_wave <= 2,
           f"vídeo sintético de 5 min a 1080p aberto na grelha pela primeira vez: faixas em {f_list:.1f} s e "
           f"forma de onda desenhada em {f_wave:.1f} s; reaberto: faixas em {r_list:.1f} s e forma de onda em "
           f"{r_wave:.1f} s [{img}]")

    open_video(page, u, ids["video_teste.mp4"])
    page.get_by_text("H.264 · 1280 × 720 · 30 fps").wait_for(timeout=10000)
    page.locator(f'[aria-label="{CONTENT}"] svg').first.wait_for(timeout=30000)
    duration = 60.0
    page.evaluate("() => { const v=[...document.querySelectorAll('video')].find(v=>v.getBoundingClientRect().width>0);"
                  " v.muted=true; v.currentTime=0; return v.play() }")
    page.wait_for_timeout(3000)
    pct1 = playhead_pct(page)
    page.wait_for_timeout(2000)
    pct2, t2 = playhead_pct(page), player_time(page)
    page.evaluate("() => [...document.querySelectorAll('video')].forEach(v => v.pause())")
    x, box = x_at(page, 30, duration)
    y = box["y"] + box["height"] * 0.6
    page.mouse.click(x, y)
    page.wait_for_timeout(700)
    clicked = player_time(page)
    page.mouse.move(box["x"] + box["width"] * clicked / duration + 8, y)  # 8 px ao lado do marcador
    page.mouse.down()
    page.wait_for_timeout(300)
    grabbed = player_time(page)
    x45, _ = x_at(page, 45, duration)
    page.mouse.move(x45 + 8, y, steps=10)
    page.mouse.up()
    page.wait_for_timeout(500)
    dragged = player_time(page)
    w0 = scroll_widths(page)
    page.get_by_label("Aumentar a escala").click()
    page.get_by_label("Aumentar a escala").click()
    page.wait_for_timeout(500)
    w1 = scroll_widths(page)
    page.get_by_label("Diminuir a escala").click()
    page.get_by_label("Diminuir a escala").click()
    page.wait_for_timeout(300)
    page.mouse.move(x, y)
    page.keyboard.down("Control")
    page.mouse.wheel(0, -400)
    page.keyboard.up("Control")
    page.wait_for_timeout(500)
    w2 = scroll_widths(page)
    img = shot(page, "lib-m03-escala")
    checks = {"acompanha": pct2 > pct1 and abs(pct2 - t2 / duration * 100) < 1.5,
              "clique": abs(clicked - 30) <= 1, "agarrar": abs(grabbed - clicked) < 0.5,
              "arrastar": abs(dragged - 45) <= 1, "escala": w1[0] > w1[1] * 1.5, "ctrl+roda": w2[0] > w2[1] * 1.05}
    record("TST-LIB-M03", "marcador, clique, arrastar e escala das faixas", all(checks.values()),
           f"o marcador acompanha a reprodução ({pct1:.1f} % → {pct2:.1f} % com o vídeo em {t2:.1f} s); clique a "
           f"meio → {clicked:.1f} s; agarrado a 8 px sem saltar ({grabbed:.1f} s) e arrastado até {dragged:.1f} s; "
           f"largura das faixas {w0[0]} px → {w1[0]} px (2 × +) e {w2[0]} px (Ctrl + roda), com deslocação "
           f"horizontal{'' if all(checks.values()) else ' — falhou: ' + str([k for k, v in checks.items() if not v])} [{img}]")

    open_video(page, u, ids["sem_audio.mp4"])
    page.get_by_text("H.264 · 640 × 360 · 30 fps").wait_for(timeout=10000)
    no_audio = page.get_by_text("Sem faixa de áudio").is_visible()
    a1 = page.get_by_label("Faixas do vídeo").get_by_text("A1", exact=True).count()
    img = shot(page, "lib-m02")
    record("TST-LIB-M02", "MP4 sem áudio", no_audio and a1 == 0,
           f"V1 'H.264 · 640 × 360 · 30 fps' e, na linha do áudio, 'Sem faixa de áudio' [{img}]")
    b.close()


# ------------------------------------------------------------------ recorte (UC-VID-001)

def test_trim(p, m):
    print("\nRecorte")
    u, ids = new_user(m, "free", ("video_teste.mp4",))
    vid = ids["video_teste.mp4"]
    b = p.chromium.launch(channel="chrome")
    page = new_page(b)
    login(page, u)
    open_video(page, u, vid)
    page.get_by_text("H.264 · 1280 × 720 · 30 fps").wait_for(timeout=10000)
    duration = 60.0

    page.get_by_role("button", name="Recortar").click()
    page.locator("#trim-start").wait_for(timeout=10000)
    start_h = page.get_by_role("slider", name="Início da seleção")
    end_h = page.get_by_role("slider", name="Fim da seleção")
    initial = (start_h.get_attribute("aria-valuenow"), end_h.get_attribute("aria-valuenow"))

    def drag(handle, t):
        hb = handle.bounding_box()
        # o puxador do fim, a 100 %, fica meio escondido na margem das faixas: agarra-se a parte visível
        right = timeline(page).bounding_box()
        grab = min(hb["x"] + hb["width"] / 2, right["x"] + right["width"] - 3)
        page.mouse.move(grab, hb["y"] + hb["height"] / 2)
        page.mouse.down()
        x, _ = x_at(page, t, duration)
        page.mouse.move(x, hb["y"] + hb["height"] / 2, steps=12)
        page.wait_for_timeout(400)
        during = player_time(page)
        page.mouse.up()
        page.wait_for_timeout(300)
        return during

    seen_start = drag(start_h, 10)
    seen_end = drag(end_h, 40)
    fields = (page.locator("#trim-start").input_value(), page.locator("#trim-end").input_value())
    overlay = page.locator(f'[aria-label="{CONTENT}"] > div.z-20').bounding_box()
    rows = timeline(page).locator("div.h-12").all()
    v_box, a_box = rows[0].bounding_box(), rows[-1].bounding_box()
    covers = overlay["y"] <= v_box["y"] + 1 and overlay["y"] + overlay["height"] >= a_box["y"] + a_box["height"] - 6
    img = shot(page, "trim-m15")
    drag(start_h, 45)  # para lá do fim: tem de parar 1 s antes
    s_now, e_now = int(start_h.get_attribute("aria-valuenow")), int(end_h.get_attribute("aria-valuenow"))
    record("TST-TRIM-M15", "seleção do recorte arrastada sobre as faixas",
           initial == ("0", "60") and fields == ("0:10", "0:40") and abs(seen_start - 10) <= 1
           and abs(seen_end - 40) <= 1 and covers and e_now - s_now >= 1,
           f"seleção inicial {initial[0]}–{initial[1]} s; extremidades arrastadas para 0:10 e 0:40: campos "
           f"{fields[0]} e {fields[1]}, leitor em {seen_start:.1f} s e {seen_end:.1f} s; a seleção cobre V1 e A1; "
           f"o início arrastado para lá do fim fica em {s_now} s com o fim em {e_now} s [{img}]")

    page.locator("#trim-start").fill("0:10")
    page.locator("#trim-start").press("Tab")
    page.locator("#trim-end").fill("0:20")
    page.locator("#trim-end").press("Tab")
    page.get_by_role("radio", name="Remover seleção").click()
    page.wait_for_timeout(500)
    striped = page.evaluate(
        "() => [...document.querySelectorAll('[aria-label^=\"Posição de reprodução\"] div')]"
        ".some(d => (d.style.backgroundImage || '').includes('repeating-linear-gradient'))")
    panel = page.locator("aside").filter(has=page.locator("#trim-start"))
    img_remove = shot(page, "trim-m16-remover")
    page.get_by_role("button", name="Pré-visualizar").click()
    samples = []
    for _ in range(140):
        samples.append(player_time(page))
        page.wait_for_timeout(100)
    page.evaluate("() => [...document.querySelectorAll('video')].forEach(v => v.pause())")
    inside = [s for s in samples if s is not None and 10.4 < s < 19.6]
    before = [s for s in samples if s is not None and s < 10]
    after = [s for s in samples if s is not None and s >= 20]

    reset_quota(u)
    page.get_by_role("button", name="Aplicar recorte").click()
    job_box = panel.locator("section[aria-live=polite]")
    job_box.wait_for(timeout=10000)
    track_buttons = page.get_by_label("Faixas do vídeo").locator("button").evaluate_all(
        "els => els.map(e => e.getAttribute('aria-label') || e.innerText)")
    observed = [job_box.inner_text().replace("\n", " ")]
    cancel_visible = job_box.get_by_role("button", name="Cancelar").is_visible()
    img_job = shot(page, "trim-m17-pedido")
    page.goto(f"{BASE}/dashboard/account")  # sai do vídeo enquanto o pedido corre
    page.wait_for_timeout(2500)
    open_video(page, u, vid)
    reopened = wait_until(lambda: job_box.count() > 0 and job_box.is_visible(), timeout=8)
    img_back = shot(page, "trim-m04-regresso")
    for _ in range(240):
        if job_box.count() and job_box.is_visible():
            observed.append(job_box.inner_text().replace("\n", " "))
        if page.get_by_text("Vídeo recortado").count():
            break
        page.wait_for_timeout(500)
    toast = page.get_by_text("foi substituído pelo resultado").count() > 0
    img_done = shot(page, "trim-m16-concluido")
    lib = u.library()["videos"]
    result = u.video(vid)
    record("TST-TRIM-M16", "remover a seleção 0:10–0:20",
           striped and before and after and not inside and abs(result["duration"] - 50) <= 1 and len(lib) == 1,
           f"seleção riscada nas faixas; a pré-visualização reproduz de {min(before):.1f} s a {max(before):.1f} s e "
           f"salta para {min(after):.1f} s, sem nenhum instante dentro do intervalo; resultado '{result['name']}' "
           f"com {result['duration']:.2f} s e um único vídeo na biblioteca [{img_remove}, {img_done}]")
    record("TST-TRIM-M04", "pedido em curso no painel, saindo e voltando ao vídeo",
           bool(reopened) and len(observed) >= 2,
           f"painel: '{observed[0][:70]}' … '{observed[-1][:70]}'; ao sair (página da conta) e voltar ao vídeo, "
           f"o painel Recortar reabriu com o pedido em curso [{img_back}]")
    record("TST-TRIM-M17", "controlos só no painel e pedido em curso",
           not any(w in " ".join(map(str, track_buttons)) for w in ("Aplicar", "Recortar", "Manter", "Remover", "Cancelar"))
           and cancel_visible and bool(reopened) and toast,
           f"nas faixas só há os botões {track_buttons}; os controlos e o pedido em curso (estado, %, Cancelar) "
           f"estão no painel à esquerda; ao voltar ao vídeo o painel reabriu; no fim, aviso 'Vídeo recortado … "
           f"foi substituído pelo resultado' [{img_job}, {img_done}]")
    b.close()
    return u, vid


# ------------------------------------------------------------------ recorte: testes manuais anteriores

def test_trim_regression(p, m):
    """TST-TRIM-M01 a M03, M05, M07 a M09 e M11, repetidos na interface final (painel Recortar)."""
    print("\nRecorte: testes manuais anteriores, na interface final")
    u, ids = new_user(m, "free", ("video_teste.mp4",))
    vid = ids["video_teste.mp4"]
    reset_quota(u)
    b = p.chromium.launch(channel="chrome")
    context = b.new_context(ignore_https_errors=True, viewport={"width": 1600, "height": 1000}, accept_downloads=True)
    page = context.new_page()
    login(page, u)
    open_video(page, u, vid)
    page.get_by_text("H.264 · 1280 × 720 · 30 fps").wait_for(timeout=10000)

    trim_btn = page.get_by_role("button", name="Recortar")
    record("TST-TRIM-M01", "ferramenta Recortar disponível", trim_btn.is_visible() and trim_btn.is_enabled(),
           "registado com um vídeo aberto: Recortar, Aplicar ferramentas e Exportar na barra Tools")
    trim_btn.click()
    panel = page.locator("aside").filter(has=page.locator("#trim-start"))
    panel.wait_for(timeout=10000)

    def set_fields(start, end):
        for key, value in (("start", start), ("end", end)):
            page.locator(f"#trim-{key}").fill(value)
            page.locator(f"#trim-{key}").press("Tab")
        page.wait_for_timeout(300)

    set_fields("0:10", "0:40")
    keeps = panel.get_by_text("Fica com:").inner_text()
    thumbs = [panel.get_by_role("slider", name=n).get_attribute("aria-valuenow") for n in ("Início", "Fim")]
    page.evaluate("() => { const v=[...document.querySelectorAll('video')].find(v=>v.getBoundingClientRect().width>0); v.currentTime = 12 }")
    page.wait_for_timeout(500)
    panel.get_by_role("button", name="Posição atual").first.click()
    page.wait_for_timeout(300)
    from_player = page.locator("#trim-start").input_value()
    record("TST-TRIM-M02", "início e fim pelos campos, pelo slider e por Posição atual",
           keeps.endswith("0:30") and thumbs == ["10", "40"] and from_player == "0:12",
           f"campos 0:10 e 0:40 → '{keeps}' e slider em {thumbs[0]}–{thumbs[1]} s; com o vídeo em 0:12, "
           f"'Posição atual' põe o início em {from_player}")

    set_fields("0:50", "0:20")
    error = panel.locator("p.text-destructive").all_inner_texts()
    disabled = panel.get_by_role("button", name="Aplicar recorte").is_disabled()
    img = shot(page, "trim-m03")
    record("TST-TRIM-M03", "intervalo inválido", bool(error) and disabled,
           f"0:50–0:20 → {error} e Aplicar recorte desativado [{img}]")

    set_fields("0:10", "0:40")
    jobs_before = len(u.call("GET", "/video-jobs")[1]["jobs"])
    page.get_by_role("button", name="Pré-visualizar").click()
    samples = []
    for _ in range(40):
        samples.append(player_time(page))
        page.wait_for_timeout(100)
    page.evaluate("() => [...document.querySelectorAll('video')].forEach(v => v.pause())")
    jobs_after = len(u.call("GET", "/video-jobs")[1]["jobs"])
    seen = [s for s in samples if s is not None]
    record("TST-TRIM-M11", "pré-visualizar sem criar pedido",
           seen and 9.5 <= min(seen) and max(seen) <= 40.5 and max(seen) > min(seen) + 1 and jobs_after == jobs_before
           and u.processed_today() == 0,
           f"a reprodução começa em {min(seen):.1f} s e avança até {max(seen):.1f} s, dentro de 0:10–0:40; pedidos "
           f"{jobs_before} → {jobs_after}; operações usadas 0")

    # TST-TRIM-M05: cancelar um recorte de 0:00–1:00 em processamento
    set_fields("0:00", "1:00")
    page.get_by_role("radio", name="Remover seleção").click()
    page.get_by_role("radio", name="Manter seleção").click()
    page.get_by_role("button", name="Aplicar recorte").click()
    job_box = panel.locator("section[aria-live=polite]")
    job_box.wait_for(timeout=10000)
    job_box.get_by_role("button", name="Cancelar").click()
    page.get_by_text("Pedido cancelado").first.wait_for(timeout=15000)
    job = u.call("GET", "/video-jobs")[1]["jobs"][0]
    video = u.video(vid)
    record("TST-TRIM-M05", "cancelar um recorte em curso",
           job["state"] == "cancelled" and abs(video["duration"] - 60) < 1 and u.processed_today() == 0,
           f"Cancelar no painel → aviso 'Pedido cancelado — O vídeo não foi alterado.'; pedido '{job['state']}', "
           f"vídeo com {video['duration']:.0f} s; operações usadas {u.processed_today()}")

    # TST-TRIM-M07: operações restantes descem 1 com um recorte concluído (e não com o cancelado)
    before = panel.get_by_text("Operações diárias restantes").inner_text()
    set_fields("0:00", "0:50")
    page.get_by_role("button", name="Aplicar recorte").click()
    page.get_by_text("Vídeo recortado").first.wait_for(timeout=120000)
    page.wait_for_timeout(1500)
    after = panel.get_by_text("Operações diárias restantes").inner_text()
    sidebar = page.locator("span", has_text="Operações diárias restantes").first.locator("xpath=..").inner_text()
    record("TST-TRIM-M07", "operações diárias restantes", "5" in before and "4" in after and u.processed_today() == 1,
           f"antes: '{before.strip()}' (o recorte cancelado não contou); depois de um recorte concluído: "
           f"'{after.strip()}'; barra lateral: '{sidebar.strip().replace(chr(10), ' ')}'")

    # TST-TRIM-M08: exportar o vídeo recortado
    with page.expect_download(timeout=60000) as info:
        page.get_by_role("button", name="Exportar").click()
    download = info.value
    target = os.path.join(SHOTS, "exportado_" + download.suggested_filename)
    download.save_as(target)
    video = u.video(vid)
    size = os.path.getsize(target)
    probe = subprocess.run(["docker", "run", "--rm", "-v", f"{SHOTS}:/m", "picturas-video_trim_tool", "ffprobe",
                            "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            "/m/" + os.path.basename(target)], capture_output=True, text=True).stdout.strip()
    os.remove(target)
    record("TST-TRIM-M08", "exportar o vídeo recortado",
           download.suggested_filename == video["name"] and size == video["size"] and abs(float(probe or 0) - 50) <= 1,
           f"Exportar na barra Tools descarrega '{download.suggested_filename}' ({size} bytes, igual ao vídeo), "
           f"que o ffprobe lê com {float(probe or 0):.1f} s")

    # TST-TRIM-M09: anónimo
    anon = new_page(b)
    anon.goto(f"{BASE}/dashboard")
    anon.get_by_role("button", name="New Project").click()
    adlg = anon.get_by_role("dialog")
    adlg.locator("#project-name").fill("Anónimo")
    adlg.locator("input[type=file]").set_input_files([m["imagem.png"]])
    adlg.get_by_role("button", name="Create").click()
    anon.wait_for_url("**/dashboard/*", timeout=30000)
    anon.get_by_role("button", name="Add Video").wait_for(timeout=30000)
    tools = anon.get_by_role("button", name="Recortar").count() + anon.get_by_role("button", name="Aplicar ferramentas").count()
    anon.get_by_role("button", name="Add Video").click()
    message = anon.get_by_text("Crie uma conta para importar vídeos").inner_text()
    link = anon.get_by_role("link", name="Criar conta").is_visible()
    img = shot(anon, "trim-m09-anonimo")
    session = anon.evaluate("() => JSON.parse(localStorage.getItem('session'))")
    pid = anon.url.split("/dashboard/")[1].split("?")[0]
    from apiclient import GATEWAY, request
    status, _ = request("GET", f"{GATEWAY}/projects/{session['user']['_id']}/{pid}/videos", None, session["token"])
    record("TST-TRIM-M09", "anónimo sem vídeo", tools == 0 and link and status in (401, 403),
           f"projeto de um anónimo sem vídeos nem ferramentas de vídeo; 'Add Video' mostra '{message.strip()}' "
           f"com 'Criar conta'; pedido direto à biblioteca de vídeo recusado ({status}) [{img}]")
    b.close()


# ------------------------------------------------------------------ aplicar ferramentas (UC-VID-003)

def test_apply(p, m):
    print("\nAplicar ferramentas")
    u, ids = new_user(m, "free", ("video_teste.mp4",))
    vid = ids["video_teste.mp4"]
    b = p.chromium.launch(channel="chrome")
    page = new_page(b)
    login(page, u)
    open_video(page, u, vid)
    page.get_by_text("H.264 · 1280 × 720 · 30 fps").wait_for(timeout=10000)
    page.get_by_role("button", name="Aplicar ferramentas").first.click()
    sect = page.get_by_label("Aplicar ferramentas a todos os fotogramas")
    sect.wait_for(timeout=10000)
    adds = [t.strip() for t in sect.locator("button").all_inner_texts() if t.strip().startswith("+")]
    for label in ("+ Redimensionar", "+ Binarizar", "+ Rodar"):
        sect.get_by_role("button", name=label).click()
    disabled4 = all(sect.get_by_role("button", name=label).is_disabled() for label in adds)
    chain = sect.get_by_label("Cadeia de ferramentas").locator("h4").all_inner_texts()
    final = sect.locator("p").filter(has_text=re.compile(r"^Resolução final:")).inner_text()
    msg_e5 = sect.locator("p.text-destructive").all_inner_texts()
    apply_btn = sect.get_by_role("button", name="Aplicar ferramentas")
    e5_disabled = apply_btn.is_disabled()
    img_e5 = shot(page, "apply-m01-e5")
    threshold = sect.get_by_label("Limiar (0–255)")
    threshold.fill("300")
    page.wait_for_timeout(300)
    msg_e4 = sect.locator("p.text-destructive").all_inner_texts()
    e4_disabled = apply_btn.is_disabled()
    threshold.fill("128")
    sect.get_by_label("Mover ferramenta 1 para baixo").click()
    reordered = sect.get_by_label("Cadeia de ferramentas").locator("h4").all_inner_texts()
    sect.get_by_label("Remover ferramenta 3").click()
    after_remove = sect.get_by_label("Cadeia de ferramentas").locator("h4").all_inner_texts()
    record("TST-APPLY-M01", "ferramentas, cadeia de 1 a 3, ordem e resolução final",
           adds == ["+ Redimensionar", "+ Binarizar", "+ Rodar"] and disabled4 and len(chain) == 3
           and reordered[0].endswith("Binarizar") and len(after_remove) == 2 and e5_disabled and e4_disabled,
           f"ferramentas {adds}; com 3 na cadeia não é possível adicionar uma 4.ª; '{final}' com Rodar 90° → "
           f"{msg_e5[:1]} e Aplicar desativado (E5); limiar 300 → {msg_e4[:1]} e Aplicar desativado (E4); "
           f"reordenar → {reordered}; retirar → {after_remove} [{img_e5}]")

    # cadeia válida: Redimensionar 640 × 360 → Binarizar 128 → Rodar 180°
    sect.get_by_label("Remover ferramenta 2").click()
    sect.get_by_label("Remover ferramenta 1").click()
    for label in ("+ Redimensionar", "+ Binarizar", "+ Rodar"):
        sect.get_by_role("button", name=label).click()
    sect.get_by_label("Largura (16–3840 px)").first.fill("640")
    sect.get_by_label("Altura (16–3840 px)").first.fill("360")
    sect.locator("button[role=combobox]").first.click()
    page.get_by_role("option", name="180°").click()
    page.wait_for_timeout(300)
    final2 = sect.locator("p").filter(has_text=re.compile(r"^Resolução final:")).inner_text()
    reset_quota(u)
    apply_btn.click()
    panel = page.locator("aside").filter(has=sect)
    job_box = panel.locator("section[aria-live=polite]")
    job_box.wait_for(timeout=10000)
    first = ""
    for _ in range(30):
        first = job_box.inner_text().replace("\n", " ") if job_box.count() else first
        if "Fotogramas processados" in first:
            break
        page.wait_for_timeout(500)
    img_job = shot(page, "apply-pedido")
    page.goto(f"{BASE}/dashboard")  # outra página da aplicação
    page.wait_for_timeout(4000)
    open_video(page, u, vid)
    back = wait_until(lambda: job_box.count() > 0 and job_box.is_visible() and job_box.inner_text(), timeout=10)
    back_txt = job_box.inner_text().replace("\n", " ") if back else "—"
    img_back = shot(page, "job-m03-regresso")
    for _ in range(480):
        if page.get_by_text("Ferramentas aplicadas").count():
            break
        page.wait_for_timeout(500)
    done = page.get_by_text("Ferramentas aplicadas").count() > 0
    page.get_by_text("H.264 · 640 × 360 · 30 fps").wait_for(timeout=30000)
    audio_kept = page.get_by_text("AAC · mono · 44,1 kHz").is_visible()
    played = page.evaluate("""async () => {
        const v = [...document.querySelectorAll('video')].find(v => v.getBoundingClientRect().width > 0);
        v.muted = true; v.currentTime = 0; await v.play();
        await new Promise(r => setTimeout(r, 1500)); const early = v.currentTime;
        v.currentTime = v.duration - 1.5;
        await new Promise((res, rej) => { v.onended = res; v.onerror = rej; setTimeout(rej, 10000) });
        return [early, v.duration, v.videoWidth, v.videoHeight, v.ended] }""")
    img_done = shot(page, "apply-concluido")
    record("TST-JOB-M03", "pedido continua quando o utilizador navega", bool(back) and "Em processamento" in back_txt,
           f"pedido de Aplicar ferramentas '{first[:70]}'; depois de ir ao painel de projetos e voltar ao vídeo, o "
           f"pedido continuou: '{back_txt[:90]}' [{img_job}, {img_back}]")
    record("TST-APPLY-M02", "vídeo substituído pelo resultado e reproduzido no browser",
           done and audio_kept and played[4] and played[0] > 0.5,
           f"'{final2}'; aviso 'Ferramentas aplicadas'; o vídeo passou a V1 'H.264 · 640 × 360 · 30 fps' e manteve "
           f"A1 'AAC · mono · 44,1 kHz'; reproduzido no Chrome até ao fim ({played[2]} × {played[3]}, "
           f"{played[1]:.1f} s) [{img_done}]")
    b.close()
    return u, vid


# ------------------------------------------------------------------ importar (UC-VID-002)

def test_import(p, m):
    from apiclient import GATEWAY, request
    print("\nImportação")
    u = User("free")
    b = p.chromium.launch(channel="chrome")
    page = new_page(b)
    login(page, u)

    page.get_by_role("button", name="New Project").click()
    dlg = page.get_by_role("dialog")
    dlg.locator("#project-name").fill("Projeto com vídeo")
    dlg.locator("input[type=file]").set_input_files([m["imagem.png"], m["outro.mp4"], m["sem_audio.mp4"]])
    page.wait_for_timeout(800)
    two_msg = dlg.locator("p.text-destructive").all_inner_texts()
    two_disabled = dlg.get_by_role("button", name="Create").is_disabled()
    img_two = shot(page, "import-m13-dois-videos")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    page.get_by_role("button", name="New Project").click()
    dlg = page.get_by_role("dialog")
    dlg.locator("#project-name").fill("Projeto com vídeo")
    dlg.locator("input[type=file]").set_input_files([m["imagem.png"], m["outro.mp4"]])
    page.wait_for_timeout(800)
    dlg.get_by_role("button", name="Create").click()
    states, proj = [], {}

    def poll():
        _, projects = request("GET", f"{GATEWAY}/projects/{u.id}", None, u.token)
        mine = [x for x in (projects or []) if isinstance(x, dict) and x.get("name") == "Projeto com vídeo"]
        if not mine:
            return False
        proj["id"] = mine[0]["_id"]
        _, lib = request("GET", f"{GATEWAY}/projects/{u.id}/{proj['id']}/videos", None, u.token)
        videos = (lib or {}).get("videos", [])
        if videos and (not states or states[-1] != videos[0]["state"]):
            states.append(videos[0]["state"])
        return bool(videos) and videos[0]["state"] in ("available", "failed")

    wait_until(poll, timeout=120, step=0.3)
    _, project = request("GET", f"{GATEWAY}/projects/{u.id}/{proj.get('id')}", None, u.token)
    images = len(project.get("imgs", [])) if isinstance(project, dict) else 0

    anon = new_page(b)
    anon.goto(f"{BASE}/dashboard")
    anon.get_by_role("button", name="New Project").click()
    adlg = anon.get_by_role("dialog")
    adlg.locator("#project-name").fill("Anónimo")
    adlg.locator("input[type=file]").set_input_files([m["imagem.png"], m["outro.mp4"]])
    anon.wait_for_timeout(800)
    anon_msg = adlg.locator("p.text-destructive").all_inner_texts()
    anon_disabled = adlg.get_by_role("button", name="Create").is_disabled()
    img_anon = shot(anon, "import-m13-anonimo")
    record("TST-IMPORT-M13", "importar um vídeo ao criar o projeto",
           states[-1:] == ["available"] and images == 1 and two_disabled and anon_disabled and two_msg and anon_msg,
           f"projeto criado com {images} imagem e o vídeo importado em segundo plano "
           f"({' → '.join(states)}); com dois vídeos, {two_msg} e Create desativado; como anónimo, {anon_msg} e "
           f"Create desativado [{img_two}, {img_anon}]")

    page.goto(f"{BASE}/dashboard/{proj['id']}")
    page.get_by_role("button", name="Add Video").click()
    vdlg = page.get_by_role("dialog")
    vdlg.locator("input[type=file]").set_input_files(m["grande_190mb.mp4"])
    page.wait_for_timeout(500)
    # envio limitado a 2,5 MB/s, para haver tempo de navegar durante o envio (em local, 190 MB
    # demoram poucos segundos)
    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 0, "downloadThroughput": -1,
                                                  "uploadThroughput": 2.5 * 1024 * 1024})
    vdlg.get_by_role("button", name="Add", exact=True).click()
    page.wait_for_timeout(3000)

    def progress_seen(where, pattern=r"A carregar · \d+%"):
        texts = []
        for _ in range(5):
            texts += page.get_by_text(re.compile(pattern)).all_inner_texts()
            page.wait_for_timeout(600)
        return [(where, t) for t in texts]

    # no próprio projeto o progresso aparece na lista de vídeos; o indicador é para as outras páginas
    in_project = progress_seen("projeto", r"A carregar")
    seen = []
    # navegação dentro da aplicação: outro projeto pela barra lateral e a conta pelo menu do utilizador
    page.locator(f'a[href="/dashboard/{u.project}"]').first.click()
    page.wait_for_url(f"**/dashboard/{u.project}", timeout=15000)
    seen += progress_seen("outro projeto")
    page.get_by_text(u.email).first.click()
    page.get_by_role("menuitem", name="Account").click()
    page.wait_for_url("**/dashboard/account**", timeout=15000)
    seen += progress_seen("conta")
    img = shot(page, "import-m12-indicador")
    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 0, "downloadThroughput": -1,
                                                  "uploadThroughput": -1})
    done = wait_until(lambda: page.get_by_text("Disponível").count() > 0, timeout=120)
    pages = [w for w in ("outro projeto", "conta") if any(s[0] == w for s in seen)]
    record("TST-IMPORT-M12", "progresso da importação visível noutras páginas",
           bool(in_project) and len(pages) == 2 and seen[0][1] != seen[-1][1] and bool(done),
           f"importação de 190 MB pelo diálogo Add Video, com o envio limitado a 2,5 MB/s: no projeto, o progresso "
           f"aparece na lista de vídeos ('{in_project[0][1] if in_project else '—'}'); noutro projeto aberto pela "
           f"barra lateral e na página da conta aberta pelo menu do utilizador, o indicador mostra o progresso "
           f"('{seen[0][1] if seen else '—'}' … '{seen[-1][1] if seen else '—'}') e, no fim, 'Disponível' [{img}]")
    b.close()


# ------------------------------------------------------------------ compatibilidade (TST-QUAL-M01)

def test_compat(p, produced):
    print("\nCompatibilidade")
    rows = []
    for name, (u, vid) in produced.items():
        url = u.call("GET", f"/videos/{vid}/url")[1]["url"]
        for label, launch in (("Chrome", lambda: p.chromium.launch(channel="chrome")),
                              ("Edge", lambda: p.chromium.launch(channel="msedge")),
                              ("Firefox", lambda: p.firefox.launch())):
            b = launch()
            page = new_page(b)
            page.goto(f"{BASE}/login")
            try:
                res = page.evaluate("""async (url) => {
                    const v = document.createElement('video'); v.muted = true; v.src = url; document.body.appendChild(v);
                    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej('erro ' + (v.error && v.error.code)); setTimeout(() => rej('tempo'), 20000) });
                    const d = v.duration; v.playbackRate = 8; await v.play();
                    await new Promise((res, rej) => { v.onended = res; v.onerror = () => rej('erro'); setTimeout(() => rej('tempo'), 60000) });
                    return [d, v.videoWidth, v.videoHeight, v.ended] }""", url)
            except Exception as err:  # noqa: BLE001
                res = [0, 0, 0, False, str(err)[:80]]
            rows.append((name, label, b.version.split(".")[0], res))
            b.close()
    record("TST-QUAL-M01", "resultados MP4 (H.264) reproduzidos em Chrome, Edge e Firefox",
           all(r[3][3] for r in rows),
           "; ".join(f"{n} em {lbl} {ver}: {r[1]} × {r[2]}, {r[0]:.1f} s, "
                     f"{'reproduzido até ao fim' if r[3] else 'falhou ' + str(r[4:])}" for n, lbl, ver, r in rows))


def run(name, fn, *args):
    """Corre um grupo; um erro inesperado fica registado como falha e os outros grupos continuam."""
    try:
        return fn(*args)
    except Exception as err:  # noqa: BLE001
        record(f"({name})", "erro inesperado no grupo", False, f"{type(err).__name__}: {str(err).splitlines()[0][:200]}")
        return None


if __name__ == "__main__":
    groups = sys.argv[1:] or ["faixas", "recorte", "regressao", "aplicar", "importar", "compatibilidade"]
    media = prepare_media()
    produced = {}
    with sync_playwright() as pw:
        if "faixas" in groups:
            run("faixas", test_tracks, pw, media)
        if "recorte" in groups:
            produced["recorte (remover)"] = run("recorte", test_trim, pw, media)
        if "regressao" in groups:
            run("regressao", test_trim_regression, pw, media)
        if "aplicar" in groups:
            produced["aplicar ferramentas"] = run("aplicar", test_apply, pw, media)
        if "importar" in groups:
            run("importar", test_import, pw, media)
        produced = {k: v for k, v in produced.items() if v}
        if "compatibilidade" in groups and produced:
            run("compatibilidade", test_compat, pw, produced)
    passed = write_results("Resultados — testes no browser (Playwright)")
    print(f"\n{passed}/{len(results)} passaram")
    sys.exit(0 if passed == len(results) else 1)
