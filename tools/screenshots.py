"""Erzeugt die Screenshots für das README (docs/img/) mit Demo-Fortschritt.

Aufruf (aus dem Projektordner):  python tools/screenshots.py
"""
import datetime
import functools
import http.server
import json
import pathlib
import random
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img"
OUT.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding="utf-8")
random.seed(7)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"


def demo_progress():
    """Zwei Wochen plausibler Übung: steigende Quoten, typische Schwachstellen."""
    blocks = ["anfrage", "termin", "reklamation", "stoerung", "rechnung"]
    sentences = []
    for b in blocks:
        sentences += json.loads((ROOT / "data" / f"saetze-{b}.json").read_text(encoding="utf-8"))
    weak = {"g-konzessiv", "g-passiv", "g-rektion"}
    items, tage = {}, {}
    today = datetime.date.today()
    for s in random.sample(sentences, 140):
        for typ in ("satzbau", "konnektor", "luecke"):
            if typ == "satzbau" and "loesungen" not in s or typ != "satzbau" and typ not in s:
                continue
            n = random.randint(1, 4)
            p = 0.5 if weak & set(s.get("gram", [])) else 0.82
            ok = sum(random.random() < p for _ in range(n))
            items[f"{s['id']}:{typ}"] = {"box": ok, "n": n, "ok": ok, "last": str(today - datetime.timedelta(days=random.randint(0, 13)))}
    for i, d in enumerate(range(13, -1, -1)):
        if d in (3, 8, 11):
            continue
        day = str(today - datetime.timedelta(days=d))
        lvl = 0.55 + i * 0.025
        tage[day] = {t: [n, round(n * min(0.95, lvl + off + random.uniform(-0.06, 0.06)))]
                     for t, n, off in (("satzbau", random.randint(8, 16), 0), ("konnektor", random.randint(5, 10), 0.08),
                                       ("luecke", random.randint(4, 9), -0.05))}
    anrufe = {}
    for a, turns in (("a-01", [1, 3, 5, 7, 9, 11]), ("a-02", [1, 3, 5, 7, 9]), ("a-04", [1, 3, 5, 7, 9, 11]), ("a-06", [1, 3, 5])):
        for t in turns:
            anrufe[f"{a}:{t}"] = {"n": random.randint(1, 3), "last": random.choice([2, 2, 2, 1, 1, 0]), "d": str(today)}
    return {"v": 1, "settings": {"spanisch": 2, "stimme": "", "tempo": 1, "theme": "dark", "runde": 10, "nurHoeren": False},
            "items": items, "anrufe": anrufe, "tage": tage}


SOLUTION = """(cue) => import('/js/content.js').then(({ C }) => {
    const s = C.saetze.find(x => x.es === cue);
    return [...s.loesungen[0]].map(d => s.chunks[+d]);
})"""

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=True,
                                               viewport={"width": 1180, "height": 820}, device_scale_factor=1)
    page = ctx.pages[0]
    page.goto(base + "README.md")
    page.evaluate("t => localStorage.setItem('deutschb2:progress', t)", json.dumps(demo_progress()))

    def shot(name, full=False):
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUT / name), full_page=full)
        print("docs/img/" + name)

    page.goto(base + "#/")
    page.wait_for_selector(".card")
    shot("start.png")

    # Satzbau: halb gebaut, dann gelöst
    page.goto(base + "#/ueben?typ=satzbau")
    page.wait_for_selector(".bank button")
    sol = page.evaluate(SOLUTION, page.locator(".cue").inner_text())
    for c in sol[:3]:
        page.locator(".bank button", has_text=c).first.click()
    shot("satzbau.png")
    for c in sol[3:]:
        page.locator(".bank button").filter(has_text=c).first.click()
    page.locator(".ex .btn.primary").click()
    shot("satzbau-richtig.png")

    # Konnektor: falsch beantwortet → Erklärung und Regel
    page.goto(base + "#/ueben?typ=konnektor")
    page.wait_for_selector(".opts button")
    right = page.evaluate("""(cue) => import('/js/content.js').then(({ C }) => {
        const s = C.saetze.find(x => x.es === cue); return s.chunks[s.konnektor.i].toLowerCase(); })""",
                          page.locator(".cue").inner_text())
    page.locator(".opts button").filter(has_not_text=right).first.click()
    shot("konnektor.png")

    # Anruf: eigene Antwort und Modell
    page.goto(base + "#/anruf/a-04")
    page.wait_for_selector("textarea")
    page.locator("textarea").fill("Guten Tag, Herr Vogt, hier ist Martínez von der Firma Kessler. Ich rufe wegen unserer Bestellung 4500123 an.")
    page.locator("button", has_text="Mit Modell vergleichen").click()
    shot("anruf.png")

    page.goto(base + "#/fortschritt")
    page.wait_for_selector(".chart svg")
    shot("fortschritt.png", full=True)

    page.goto(base + "#/nachschlagen/grammatik")
    page.wait_for_selector("details")
    page.locator("details").nth(3).locator("summary").click()
    shot("grammatik.png")

    page.set_viewport_size({"width": 800, "height": 1280})
    page.goto(base + "#/")
    page.wait_for_selector(".card")
    shot("tablet.png")
    ctx.close()
srv.shutdown()
