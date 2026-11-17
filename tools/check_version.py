"""Verlangt eine höhere VERSION in sw.js, sobald sich eine ausgelieferte Datei geändert hat.

Vergleichsbasis ist der zuletzt veröffentlichte Stand: origin/main (das, was GitHub Pages
ausliefert). Mehrere Commits für eine Veröffentlichung brauchen also nur EINE Erhöhung.

Ausgeliefert = alle Dateien aus ASSETS in sw.js plus sw.js selbst. Eine Änderung, die in
sw.js nur die VERSION-Zeile betrifft, zählt nicht als Änderung.

Aufruf:
  python tools/check_version.py            # Arbeitsverzeichnis gegen origin/main (für validate.py)
  python tools/check_version.py --staged   # Index gegen origin/main (pre-commit-Hook)
  Optionen: --repo PFAD, --base REF (Standard origin/main)
Ende mit Code 1, wenn die Version erhöht werden muss.
"""
import argparse
import pathlib
import re
import subprocess
import sys

VERSION_RE = re.compile(r"^const VERSION = (\d+);\s*$", re.M)
ASSETS_RE = re.compile(r"const ASSETS = \[(.*?)\];", re.S)


def git(repo, *args, ok_fail=False):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True)
    if r.returncode and not ok_fail:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout if r.returncode == 0 else None


def norm(b):
    return b.replace(b"\r\n", b"\n") if b is not None else None


def version_of(text):
    m = VERSION_RE.search(text)
    return int(m.group(1)) if m else 1  # die erste Veröffentlichung hatte noch keine VERSION


def assets_of(text):
    m = ASSETS_RE.search(text)
    return set(re.findall(r"'([^']+)'", m.group(1))) if m else set()


def served(path):
    return "index.html" if path == "./" else path


def check(repo=None, staged=False, base="origin/main"):
    """Gibt (ok, meldung) zurück."""
    repo = pathlib.Path(repo or pathlib.Path(__file__).resolve().parent.parent)
    if git(repo, "rev-parse", "--verify", "--quiet", base, ok_fail=True) is None:
        return True, f"Hinweis: {base} fehlt – Versionsprüfung übersprungen."

    def now(path):  # aktueller Inhalt: Index oder Arbeitsverzeichnis
        if staged:
            return norm(git(repo, "show", f":{path}", ok_fail=True))
        f = repo / path
        return norm(f.read_bytes()) if f.exists() else None

    def then(path):
        return norm(git(repo, "show", f"{base}:{path}", ok_fail=True))

    sw_now, sw_then = (now("sw.js") or b"").decode(), (then("sw.js") or b"").decode()
    v_now, v_then = version_of(sw_now), version_of(sw_then)
    files = sorted({served(p) for p in assets_of(sw_now) | assets_of(sw_then)})

    changed = [p for p in files if now(p) != then(p)]
    if VERSION_RE.sub("", sw_now) != VERSION_RE.sub("", sw_then):
        changed.append("sw.js")

    if not changed:
        return True, f"Keine ausgelieferte Datei geändert (VERSION {v_now})."
    if v_now > v_then:
        return True, f"{len(changed)} ausgelieferte Datei(en) geändert, VERSION {v_then} → {v_now}: in Ordnung."
    liste = "\n".join("  - " + p for p in changed[:20]) + ("\n  …" if len(changed) > 20 else "")
    return False, (f"Ausgelieferte Dateien haben sich gegenüber {base} geändert, aber VERSION in sw.js "
                   f"ist {v_now} (veröffentlicht: {v_then}).\n{liste}\n"
                   f"→ In sw.js „const VERSION = {v_then + 1};“ setzen"
                   + (" und sw.js mit „git add sw.js“ vormerken." if staged else "."))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--staged", action="store_true")
    ap.add_argument("--repo")
    ap.add_argument("--base", default="origin/main")
    a = ap.parse_args()
    ok, msg = check(a.repo, a.staged, a.base)
    print(("" if ok else "FEHLER: ") + msg)
    sys.exit(0 if ok else 1)
