"""TST-QUAL-M02 (parte de interface): com as 5 operações do dia gastas, os painéis Recortar e
Aplicar ferramentas apresentam o limite e não deixam submeter (UC-VID-001/E3, UC-VID-003/E3).

Uso: python3 tests/browser/check_quota_message.py
"""

from playwright.sync_api import sync_playwright

from browser_common import login, new_user, open_video, prepare_media, users_db

media = prepare_media()
u, ids = new_user(media, "free", ("video_teste.mp4",))
users_db(f"db.users.updateOne({{_id: ObjectId('{u.id}')}}, {{$set: {{operations: [{{day: "
         "new Date(new Date().toISOString().slice(0, 10)), processed: 5}]}})")
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    page = b.new_context(ignore_https_errors=True, viewport={"width": 1600, "height": 1000}).new_page()
    login(page, u)
    open_video(page, u, ids["video_teste.mp4"])
    found = {}
    for tool, button in (("Recortar", "Aplicar recorte"), ("Aplicar ferramentas", "Aplicar ferramentas")):
        page.get_by_role("button", name=tool).first.click()
        aside = page.locator("aside").last
        if tool == "Aplicar ferramentas":
            aside.get_by_role("button", name="+ Rodar").click()
        message = aside.get_by_text("Atingiu o limite").first
        message.wait_for(timeout=10000)
        found[tool] = (message.inner_text(), aside.get_by_role("button", name=button).last.is_disabled())
        page.get_by_role("button", name=tool).first.click()
    b.close()
ok = all("5 operações diárias" in text and disabled for text, disabled in found.values())
print(("PASSOU" if ok else "FALHOU"), found)
