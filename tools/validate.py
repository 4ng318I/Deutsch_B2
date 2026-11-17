"""Prüft die Datenbank in /data: IDs, Verweise, Lösungslisten und Zählung.

Aufruf (aus dem Projektordner):  python tools/validate.py
Ende mit Code 1, wenn Fehler gefunden wurden. Warnungen sind nur Hinweise.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KONNEKTOREN = {
    "weil", "da", "zumal", "obwohl", "trotzdem", "dennoch", "damit", "um", "sodass", "deshalb",
    "daher", "deswegen", "falls", "wenn", "sofern", "sobald", "nachdem", "bevor", "während",
    "bis", "solange", "allerdings", "jedoch", "aber", "dass", "ob", "sonst", "andernfalls",
}
errors, warnings = [], []
sys.stdout.reconfigure(encoding="utf-8")


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def bare(word):
    return re.sub(r"[.,;:!?]", "", word)


def unique(items, label):
    seen = set()
    for it in items:
        if it["id"] in seen:
            errors.append(f"{label}: doppelte ID {it['id']}")
        seen.add(it["id"])


index = load("index")
gram = load("grammatik")
gram_ids = {g["id"] for g in gram} | {"g-rektion"}
blocks = [b["id"] for b in index["bloecke"]]
count = {"saetze": 0, "satzbau": 0, "konnektor": 0, "luecke": 0, "revisar": 0}
all_s = []

for b in blocks:
    for s in load(f"saetze-{b}"):
        all_s.append(s)
        sid, n = s["id"], len(s["chunks"])
        count["saetze"] += 1
        count["revisar"] += bool(s.get("revisar"))
        if n > 10:
            errors.append(f"{sid}: mehr als 10 Satzteile")
        if not s.get("es"):
            errors.append(f"{sid}: Übersetzung fehlt")
        for g in s.get("gram", []):
            if g not in gram_ids:
                errors.append(f"{sid}: unbekannte Regel {g}")
        if "loesungen" in s:
            count["satzbau"] += 1
            want = sorted(str(i) for i in range(n))
            if s["loesungen"][0] != "".join(want):
                errors.append(f"{sid}: erste Lösung muss die Grundreihenfolge sein")
            if len(set(s["loesungen"])) != len(s["loesungen"]):
                errors.append(f"{sid}: doppelte Lösung")
            for sol in s["loesungen"]:
                if sorted(sol) != want:
                    errors.append(f"{sid}: Lösung {sol} ist keine Permutation von {n} Teilen")
        if "konnektor" in s:
            count["konnektor"] += 1
            k = s["konnektor"]
            if not 0 <= k["i"] < n:
                errors.append(f"{sid}: konnektor.i außerhalb")
            else:
                word = s["chunks"][k["i"]].lower()
                if word not in KONNEKTOREN:
                    warnings.append(f"{sid}: Satzteil {k['i']} („{word}“) ist kein bekannter Konnektor")
                if word in [f.lower() for f in k["falsch"]]:
                    errors.append(f"{sid}: richtige Antwort steht unter den falschen")
            if len(k["falsch"]) != 3 or len(set(k["falsch"])) != 3:
                errors.append(f"{sid}: konnektor.falsch braucht 3 verschiedene Einträge")
            if not k.get("warum"):
                errors.append(f"{sid}: konnektor.warum fehlt")
        if "luecke" in s:
            count["luecke"] += 1
            lu = s["luecke"]
            if not 0 <= lu["i"] < n:
                errors.append(f"{sid}: luecke.i außerhalb")
            elif lu["wort"] not in [bare(w) for w in s["chunks"][lu["i"]].split(" ")]:
                errors.append(f"{sid}: Wort „{lu['wort']}“ steht nicht in Satzteil {lu['i']}")
            if "falsch" in lu and (len(lu["falsch"]) != 3 or lu["wort"] in lu["falsch"]):
                errors.append(f"{sid}: luecke.falsch braucht 3 falsche Einträge")
            if not (lu.get("lemma") or lu.get("hinweis")):
                errors.append(f"{sid}: luecke braucht lemma oder hinweis")
unique(all_s, "saetze")

wort = load("wortschatz")
unique(wort, "wortschatz")
for w in wort:
    if w["block"] not in blocks:
        errors.append(f"{w['id']}: unbekannter Block {w['block']}")
    for f in ("de", "es", "abt", "bsp"):
        if not w.get(f):
            errors.append(f"{w['id']}: Feld {f} fehlt")
    count["revisar"] += bool(w.get("revisar"))

rede = load("redemittel")
unique(rede, "redemittel")
funktionen = {f["id"] for f in index["funktionen"]}
for r in rede:
    if r["f"] not in funktionen:
        errors.append(f"{r['id']}: unbekannte Funktion {r['f']}")
    count["revisar"] += bool(r.get("revisar"))

anrufe = load("anrufe")
unique(anrufe, "anrufe")
zuege = 0
for a in anrufe:
    if a["block"] not in blocks:
        errors.append(f"{a['id']}: unbekannter Block")
    prev = None
    for i, t in enumerate(a["turns"]):
        if t["wer"] == prev:
            errors.append(f"{a['id']}: Zug {i} – zweimal hintereinander {t['wer']}")
        prev = t["wer"]
        if t["wer"] == "ich":
            zuege += 1
            count["revisar"] += bool(t.get("revisar"))
            if not t.get("aufgabe") or not t.get("modelle"):
                errors.append(f"{a['id']}: Zug {i} unvollständig")
        elif not t.get("de"):
            errors.append(f"{a['id']}: Zug {i} ohne Text")

unique(gram, "grammatik")
used = {g for s in all_s for g in s.get("gram", [])} | {"g-rektion"}
for g in gram:
    if g["id"] not in used:
        warnings.append(f"{g['id']}: keine Sätze zu dieser Regel")

ui = load("ui")
for path in (ROOT / "js").rglob("*.js"):
    for key in re.findall(r"\b[TGL]\('([a-z_]+)'\)", path.read_text(encoding="utf-8")):
        if key not in ui:
            errors.append(f"ui.json: Schlüssel {key} fehlt ({path.name})")

sw = (ROOT / "sw.js").read_text(encoding="utf-8")
cached = set(re.findall(r"'([\w./-]+\.(?:js|json|css|png|html|webmanifest))'", sw))
for path in list(ROOT.glob("js/**/*.js")) + list(DATA.glob("*.json")) + list(ROOT.glob("css/*.css")) + list(ROOT.glob("icons/*.png")):
    rel = path.relative_to(ROOT).as_posix()
    if rel not in cached:
        errors.append(f"sw.js: {rel} fehlt in der Cache-Liste")
for rel in cached:
    if not (ROOT / rel).exists():
        errors.append(f"sw.js: {rel} existiert nicht")

print(f"Sätze: {count['saetze']}  →  Satzbau {count['satzbau']}, Konnektor {count['konnektor']}, Lückentext {count['luecke']}")
print(f"Wortschatz: {len(wort)}   Redemittel: {len(rede)}   Regeln: {len(gram)}")
print(f"Anrufe: {len(anrufe)} mit {zuege} eigenen Gesprächszügen")
print(f"Mit „revisar“ markiert: {count['revisar']}")
for w in warnings:
    print("WARNUNG:", w)
for e in errors:
    print("FEHLER:", e)
print("OK" if not errors else f"{len(errors)} Fehler")
sys.exit(1 if errors else 0)
