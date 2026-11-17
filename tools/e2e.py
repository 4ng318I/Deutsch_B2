"""End-to-End-Test in Chromium (Playwright): Installierbarkeit, Offline, alle Übungen.

Aufruf (aus dem Projektordner):  python tools/e2e.py [Ordner für Screenshots]
"""
import functools
import http.server
import pathlib
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
sys.stdout.reconfigure(encoding="utf-8")
fails = []


def _watchdog():
    print("FEHLER Zeitüberschreitung: Test hängt (über 7 Minuten)", flush=True)
    import os
    os._exit(2)


_wd = threading.Timer(420, _watchdog)
_wd.daemon = True
_wd.start()


def check(cond, msg):
    print(("OK    " if cond else "FEHLER"), msg)
    if not cond:
        fails.append(msg)


class Quiet(http.server.SimpleHTTPRequestHandler):
    bump = False  # True: sw.js wird verändert ausgeliefert → simuliert eine neue Version

    def log_message(self, *a):
        pass

    def do_GET(self):
        if Quiet.bump and self.path.split("?")[0].endswith("/sw.js"):
            body = (ROOT / "sw.js").read_bytes() + b"\n// neue Version (Test)\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# Prüft im Browser jede Aufgabe direkt über die Module der App.
IN_PAGE = r"""
async () => {
  const { C } = await import('/js/content.js');
  const sb = await import('/js/exercises/satzbau.js');
  const ko = await import('/js/exercises/konnektor.js');
  const lu = await import('/js/exercises/luecke.js');
  const out = { satzbau: 0, falschAkzeptiert: [], richtigAbgelehnt: [], choice: 0, choiceErr: [] };
  const click = (box, sel, text) => {
    const b = [...box.querySelectorAll(sel)].find(x => x.textContent === text);
    if (!b) throw new Error('Knopf fehlt: ' + text);
    b.click();
  };
  for (const it of C.items) {
    const s = it.s;
    if (it.typ === 'satzbau') {
      const orders = [...s.loesungen, [...s.loesungen[0]].reverse().join('')];
      orders.forEach((ord, k) => {
        const box = document.createElement('div');
        let res = null;
        sb.render(box, it, ok => { res = ok; });
        for (const d of ord) click(box.querySelector('.bank'), 'button', s.chunks[+d]);
        box.querySelector('.btn.primary').click();
        const soll = k < s.loesungen.length || s.loesungen.includes(ord);
        if (res !== soll) (soll ? out.richtigAbgelehnt : out.falschAkzeptiert).push(s.id + ' ' + ord);
        out.satzbau++;
      });
    } else {
      const mod = it.typ === 'konnektor' ? ko : lu;
      for (const pickRight of [true, false]) {
        const box = document.createElement('div');
        let res = null;
        mod.render(box, it, ok => { res = ok; });
        const opts = [...box.querySelectorAll('.opts button')].map(b => b.textContent);
        if (opts.length !== 4 || new Set(opts.map(o => o.toLowerCase())).size !== 4) out.choiceErr.push(it.key + ' Optionen: ' + opts.join('|'));
        const satz = box.querySelector('.satz').textContent;
        const right = it.typ === 'konnektor' ? s.chunks[s.konnektor.i] : s.luecke.wort;
        const rightOpt = opts.find(o => o.toLowerCase() === right.toLowerCase());
        if (!rightOpt) { out.choiceErr.push(it.key + ' richtige Option fehlt'); continue; }
        click(box, '.opts button', pickRight ? rightOpt : opts.find(o => o !== rightOpt));
        if (res !== pickRight) out.choiceErr.push(it.key + ' Bewertung falsch');
        const full = box.querySelector('.satz').textContent.replace(/\s+/g, ' ');
        if (full !== s.de.replace(/\s+/g, ' ') && pickRight) out.choiceErr.push(it.key + ' Satz nach Lösung: "' + full + '" statt "' + s.de + '"');
        if (satz.includes('  ')) out.choiceErr.push(it.key + ' doppelte Leerzeichen');
        out.choice++;
      }
    }
  }
  return out;
}
"""

srv = serve()
base = f"http://127.0.0.1:{srv.server_address[1]}/"
profile = tempfile.mkdtemp(prefix="satzbau-e2e-")
errors = []

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1280, "height": 860})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))

    # Gemeinsamer Ursprung simulieren: Daten einer fremden App + Fortschritt unter dem alten Schlüssel
    page.goto(base + "README.md")
    page.evaluate("""async () => {
        localStorage.setItem('progress', 'DATEN-VON-ANA');
        localStorage.setItem('ana:settings', '{"x":1}');
        localStorage.setItem('satzbau-b2', JSON.stringify({ v: 1, settings: { runde: 10 },
            items: { 'anf-01:satzbau': { box: 2, n: 3, ok: 2, last: '2026-11-01' } }, anrufe: {}, tage: {} }));
        await (await caches.open('ana-english-v1')).put('/ana.txt', new Response('ana'));
    }""")

    page.goto(base)
    page.wait_for_selector("text=Was möchtest du üben?")
    page.evaluate("navigator.serviceWorker.ready")
    page.reload()
    page.wait_for_selector("text=Was möchtest du üben?")
    check(page.evaluate("!!navigator.serviceWorker.controller"), "Service Worker kontrolliert die Seite")
    st = page.evaluate("""async () => ({
        neu: JSON.parse(localStorage.getItem('deutschb2:progress') || 'null'),
        alt: localStorage.getItem('satzbau-b2'),
        backup: localStorage.getItem('deutschb2:backup-schema-1') !== null,
        ana: [localStorage.getItem('progress'), localStorage.getItem('ana:settings')],
        caches: await caches.keys() })""")
    check(st["neu"] and "anf-01:satzbau" in st["neu"]["items"] and st["alt"] is None and st["backup"],
          "Alter Schlüssel 'satzbau-b2' → 'deutschb2:progress' übernommen, Sicherung angelegt")
    check(st["ana"] == ["DATEN-VON-ANA", '{"x":1}'], "Daten der anderen App im selben Ursprung unberührt")
    check("ana-english-v1" in st["caches"] and any(c.startswith("deutschb2-") for c in st["caches"]),
          f"Fremder Cache bleibt erhalten, eigener Cache mit Präfix {st['caches']}")

    mig = page.evaluate("""async () => {
        const m = await import('/js/store.js');
        const out = {};
        // Migrationskette mit erfundenen Schritten 0→1 testen
        const s = m.migrate({ v: 0, punkte: { 'anf-01:satzbau': 5 } }, {
            0: s => ({ v: 1, items: { 'anf-01:satzbau': { box: 0, n: s.punkte['anf-01:satzbau'], ok: 0, last: '' } } }) });
        out.kette = s.v === 1 && s.items['anf-01:satzbau'].n === 5 && s.settings.runde === 10 && typeof s.tage === 'object';
        try { m.migrate({ v: 99, items: {} }); out.zukunft = false; } catch (e) { out.zukunft = !!e.zukunft; }
        try { m.unwrap({ app: 'ana-english', progress: {} }); out.fremd = false; } catch { out.fremd = true; }
        const env = JSON.parse(m.exportJSON());
        out.huelle = env.app === 'deutschb2' && env.schema === m.SCHEMA && env.progress.v === m.SCHEMA;
        // Export der ersten Version: nur das progress-Objekt, ohne Hülle
        m.importJSON(JSON.stringify({ v: 1, items: { 'ter-05:luecke': { box: 1, n: 1, ok: 1, last: '2026-11-02' } }, anrufe: {}, tage: {} }), 'zusammenfuehren');
        out.altImport = !!m.S.items['ter-05:luecke'] && !!m.S.items['anf-01:satzbau'];
        return out; }""")
    check(mig["kette"], "Migration: Schritte werden der Reihe nach angewandt, fehlende Felder ergänzt")
    check(mig["zukunft"], "Migration: Stand aus neuerer Version wird erkannt")
    check(mig["fremd"], "Import: Datei einer anderen App wird abgelehnt")
    check(mig["huelle"], "Export enthält App-Name und Schema-Version")
    check(mig["altImport"], "Import: Export der ersten Version (ohne Hülle) wird angenommen")
    page.evaluate("import('/js/store.js').then(m => m.resetAll())")
    check(page.evaluate("document.documentElement.dataset.theme") == "dark", "Dunkles Design als Standard")

    cdp = ctx.new_cdp_session(page)
    inst = cdp.send("Page.getInstallabilityErrors")["installabilityErrors"]
    check(not inst, f"Installierbar (Chromium meldet keine Hindernisse) {inst or ''}")
    man = cdp.send("Page.getAppManifest")
    check(not man.get("errors"), f"Manifest ohne Fehler {man.get('errors') or ''}")

    r = page.evaluate(IN_PAGE)
    check(not r["richtigAbgelehnt"], f"Satzbau: alle {r['satzbau']} Reihenfolgen korrekt bewertet; abgelehnt: {r['richtigAbgelehnt'][:5]}")
    check(not r["falschAkzeptiert"], f"Satzbau: umgekehrte Reihenfolge wird abgelehnt {r['falschAkzeptiert'][:5]}")
    check(not r["choiceErr"], f"Konnektor/Lückentext: {r['choice']} Durchläufe; Probleme: {r['choiceErr'][:8]}")

    # Echte Runde über die Oberfläche, gemischt
    page.goto(base + "#/ueben")
    for _ in range(10):
        page.wait_for_selector(".ex")
        if page.locator(".bank").count():
            while page.locator(".bank button").count():
                page.locator(".bank button").first.click()
            page.locator(".ex .btn.primary").click()
        else:
            page.locator(".opts button").first.click()
        if SHOTS and not (SHOTS / "uebung.png").exists():
            page.screenshot(path=str(SHOTS / "uebung.png"), full_page=True)
        page.locator("button.next").click()
    check(page.locator("h1", has_text="richtig").count() == 1, "Runde über die Oberfläche bis zur Auswertung")

    # Anruf durchspielen
    page.goto(base + "#/anruf/a-01")
    for _ in range(6):
        page.locator("textarea").last.fill("Testantwort")
        page.locator("button", has_text="Mit Modell vergleichen").click()
        page.locator(".rate button").first.click()
    check(page.locator("text=Gespräch beendet.").count() == 1, "Anruf a-01 vollständig durchgespielt")
    if SHOTS:
        page.screenshot(path=str(SHOTS / "anruf.png"), full_page=True)

    page.goto(base + "#/fortschritt")
    page.wait_for_selector("text=Selbst eingeschätzt")
    check(page.locator(".chart svg").count() == 0, "Fortschritt: mit nur einem Übungstag noch kein Diagramm")
    # zwei frühere Tage einfügen, damit ein Verlauf entsteht
    page.evaluate("""import('/js/store.js').then(m => {
        m.S.tage['2026-01-05'] = { satzbau: [10, 6], konnektor: [8, 7] };
        m.S.tage['2026-01-06'] = { satzbau: [12, 9], luecke: [5, 3] }; m.save(); })""")
    page.reload()
    page.wait_for_selector("text=Selbst eingeschätzt")
    check(page.locator(".chart svg").count() == 1, "Fortschritt: Liniendiagramm ab zwei Übungstagen")
    tiles = page.locator(".tile .big").all_inner_texts()
    check(len(tiles) == 3 and all(t.endswith("%") or t == "–" for t in tiles) and any(t.endswith("%") for t in tiles),
          f"Fortschritt: drei gemessene Quoten (– = Typ noch nicht geübt) {tiles}")
    check(page.locator(".tile", has_text="Anruf").count() == 0, "Anrufe erscheinen in keiner gemessenen Quote")
    if SHOTS:
        page.screenshot(path=str(SHOTS / "fortschritt.png"), full_page=True)

    # Export → löschen → Import
    exp = page.evaluate("import('/js/store.js').then(m => m.exportJSON())")
    page.evaluate("import('/js/store.js').then(m => m.resetAll())")
    empty = page.evaluate("import('/js/store.js').then(m => Object.keys(m.S.items).length)")
    page.evaluate("t => import('/js/store.js').then(m => m.importJSON(t, 'zusammenfuehren'))", exp)
    back = page.evaluate("import('/js/store.js').then(m => [Object.keys(m.S.items).length, Object.keys(m.S.anrufe).length])")
    check(empty == 0 and back[0] >= 10 and back[1] == 6, f"Export/Import stellt den Fortschritt wieder her {back}")

    # Kein "null" / "[object …]" als Text – auf allen Spanisch-Stufen
    junk = []
    for level in (2, 1, 0):
        page.evaluate(f"import('/js/store.js').then(m => {{ m.S.settings.spanisch = {level}; m.save(); }})")
        for route in ["#/", "#/ueben", "#/anrufe", "#/anruf/a-04", "#/nachschlagen/wortschatz", "#/nachschlagen/redemittel",
                      "#/nachschlagen/grammatik", "#/fortschritt", "#/einstellungen"]:
            page.goto(base + route)
            page.wait_for_selector("main h1, main h2")
            if route == "#/anruf/a-04":
                page.locator("button", has_text="Mit Modell vergleichen").click()
            if route == "#/ueben":
                for _ in range(10):
                    if page.locator(".bank").count():
                        while page.locator(".bank button").count():
                            page.locator(".bank button").last.click()
                        page.locator(".ex .btn.primary").click()
                    else:
                        page.locator(".opts button").first.click()
                    page.locator("button.next").click()
            txt = page.locator("main").inner_text()
            if "[object" in txt or __import__("re").search(r"(^|\s)null(\s|$)", txt):
                junk.append(f"{route} (Stufe {level})")
    check(not junk, f"Keine Platzhalter wie null/[object] im Text {junk}")
    page.evaluate("import('/js/store.js').then(m => { m.S.settings.spanisch = 2; m.save(); })")

    # Tablet-Format
    page.set_viewport_size({"width": 800, "height": 1280})
    page.goto(base + "#/")
    page.wait_for_selector(".card")
    sw = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    check(sw, "Tablet hochkant: kein horizontales Scrollen")
    if SHOTS:
        page.screenshot(path=str(SHOTS / "tablet-start.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 860})

    # Stand aus einer neueren App-Version: Hinweis zeigen, nichts überschreiben
    saved = page.evaluate("localStorage.getItem('deutschb2:progress')")
    zukunft = '{"v":99,"items":{},"irgendwas":"neu"}'
    page.evaluate(f"localStorage.setItem('deutschb2:progress', {zukunft!r})")
    page.goto(base + "#/ueben?typ=konnektor")
    page.reload()
    page.wait_for_selector(".opts button")
    page.locator(".opts button").first.click()
    check(page.locator("#notice", has_text="neueren Version").is_visible(), "Neuere Version: Hinweis wird angezeigt")
    check(page.evaluate("localStorage.getItem('deutschb2:progress')") == zukunft, "Neuere Version: gespeicherter Stand bleibt unverändert")
    page.evaluate(f"localStorage.setItem('deutschb2:progress', {saved!r})")
    page.goto(base + "#/")
    page.reload()
    page.wait_for_selector(".card")

    # Neue Version: Hinweis erscheint, Knopf aktiviert sie und lädt neu
    Quiet.bump = True
    page.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
    page.wait_for_selector(".toast", timeout=15000)
    check(page.locator(".toast", has_text="Neue Version verfügbar").count() == 1, "Update: Hinweis „Neue Version verfügbar“")
    page.evaluate("window.__vorher = 1")
    with page.expect_navigation():
        page.locator(".toast button", has_text="Neu laden").click()
    page.wait_for_selector(".card")
    check(page.evaluate("window.__vorher === undefined && !!navigator.serviceWorker.controller"),
          "Update: Knopf aktiviert die neue Version und lädt neu")
    check(page.locator(".toast").count() == 0, "Update: nach dem Neuladen kein Hinweis mehr")

    keys = page.evaluate("Object.keys(localStorage)")
    fremd = {"progress", "ana:settings"}
    check(all(k.startswith("deutschb2:") for k in keys if k not in fremd) and fremd <= set(keys),
          f"Alle eigenen localStorage-Schlüssel mit Präfix deutschb2: {sorted(keys)}")

    # Offline: Server stoppen, neu laden
    srv.shutdown()
    srv.server_close()
    ctx.set_offline(True)
    page.goto(base + "#/")
    page.reload()
    page.wait_for_selector("text=Was möchtest du üben?", timeout=8000)
    page.goto(base + "#/ueben?typ=satzbau")
    page.wait_for_selector(".bank button")
    page.goto(base + "#/nachschlagen/grammatik")
    page.wait_for_selector("details")
    check(True, "Offline (Server gestoppt): Start, Übung und Nachschlagen laden aus dem Cache")
    ctx.close()

check(not errors, f"Keine JavaScript-Fehler in der Konsole {errors[:5]}")
print("\nALLES OK" if not fails else f"\n{len(fails)} FEHLER")
sys.exit(1 if fails else 0)
