"""Testet tools/check_version.py und den pre-commit-Hook in einem temporären Git-Repo.

Aufruf: python tools/test_check_version.py
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from check_version import check  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
fails = []


def ok(cond, msg):
    print(("OK    " if cond else "FEHLER"), msg)
    if not cond:
        fails.append(msg)


SW = """const VERSION = {v};
const ASSETS = [
  './', 'index.html', 'js/app.js', 'data/a.json', 'icons/i.png'
];
self.addEventListener('fetch', e => {{}});
"""

tmp = pathlib.Path(tempfile.mkdtemp(prefix="checkver-"))
try:
    def git(*a, check_rc=True):
        r = subprocess.run(["git", "-C", str(tmp), *a], capture_output=True, text=True)
        if check_rc and r.returncode:
            raise RuntimeError(r.stderr)
        return r

    def write(path, text, binary=False):
        f = tmp / path
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(text) if binary else f.write_text(text, encoding="utf-8")

    def commit(msg):
        git("add", "-A")
        return git("commit", "-q", "-m", msg, check_rc=False)

    def publish():  # simuliert git push: origin/main = HEAD
        git("update-ref", "refs/remotes/origin/main", "HEAD")

    git("init", "-q", "-b", "main")
    git("config", "user.email", "test@example.invalid")
    git("config", "user.name", "Test")
    git("config", "core.autocrlf", "false")
    write("sw.js", SW.format(v=2))
    write("index.html", "<!doctype html>\n<p>Satzbau</p>\n")
    write("js/app.js", "console.log(1)")
    write("data/a.json", "[]")
    write("icons/i.png", b"\x89PNG1", binary=True)
    write("README.md", "Doku")
    shutil.copytree(ROOT / ".githooks", tmp / ".githooks")
    shutil.copytree(ROOT / "tools", tmp / "tools", ignore=shutil.ignore_patterns("__pycache__"))
    commit("erste Version")
    ok(check(tmp)[0], "Ohne origin/main: Prüfung wird übersprungen")
    publish()
    git("config", "core.hooksPath", ".githooks")

    ok(check(tmp)[0], "Unverändert: in Ordnung")

    write("js/app.js", "console.log(2)")
    ok(not check(tmp)[0], "Arbeitsverzeichnis: JS geändert ohne VERSION → Fehler")
    r = commit("JS ohne Version")
    ok(r.returncode != 0 and "VERSION" in (r.stdout + r.stderr), "Hook: Commit mit geändertem JS ohne VERSION wird abgelehnt")

    write("sw.js", SW.format(v=3))
    ok(check(tmp)[0], "Arbeitsverzeichnis: VERSION erhöht → in Ordnung")
    ok(commit("JS mit Version 3").returncode == 0, "Hook: mit erhöhter VERSION geht der Commit durch")

    write("data/a.json", "[1]")
    ok(commit("weitere Änderung vor dem Push").returncode == 0,
       "Mehrere Commits vor dem Push brauchen nur eine Erhöhung")
    publish()

    write("README.md", "mehr Doku")
    write("tools/neu.py", "print()")
    ok(commit("nur Doku und Werkzeuge").returncode == 0, "Nicht ausgelieferte Dateien (README, tools) brauchen keine VERSION")

    write("icons/i.png", b"\x89PNG2", binary=True)
    ok(commit("Icon").returncode != 0, "Binärdatei (Icon) geändert ohne VERSION → abgelehnt")
    git("checkout", "--", "icons/i.png")
    git("reset", "-q")

    write("sw.js", SW.format(v=3).replace("{}", "{ console.log('neu'); }"))
    ok(commit("sw.js-Logik").returncode != 0, "Logik in sw.js geändert ohne VERSION → abgelehnt")
    write("sw.js", SW.format(v=4).replace("{}", "{ console.log('neu'); }"))
    ok(commit("sw.js-Logik mit Version").returncode == 0, "… mit erhöhter VERSION → erlaubt")
    publish()

    write("sw.js", SW.format(v=4).replace("'icons/i.png'", "'icons/i.png', 'js/neu.js'"))
    write("js/neu.js", "x")
    ok(not check(tmp)[0], "Neue Datei in ASSETS ohne VERSION → Fehler")

    # Nur gestaged zählt im Hook: unvorgemerkte Änderungen bremsen den Commit nicht
    git("checkout", "--", "sw.js")
    (tmp / "js/neu.js").unlink()
    write("js/app.js", "console.log(99)")
    write("README.md", "noch mehr Doku")
    git("add", "README.md")
    r = git("commit", "-q", "-m", "nur README vorgemerkt", check_rc=False)
    ok(r.returncode == 0, "Hook prüft nur Vorgemerktes (README gestaged, JS nicht)")

    # Zeilenenden: CRLF im Arbeitsverzeichnis ist keine inhaltliche Änderung
    git("checkout", "--", "js/app.js")
    (tmp / "index.html").write_bytes(b"<!doctype html>\r\n<p>Satzbau</p>\r\n")
    ok(check(tmp)[0], "Nur CRLF statt LF (Windows) → keine Änderung")
    (tmp / "index.html").write_bytes(b"<!doctype html>\r\n<p>Satzbau B2</p>\r\n")
    ok(not check(tmp)[0], "… aber echter Inhaltsunterschied mit CRLF → Fehler")
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\nALLES OK" if not fails else f"\n{len(fails)} FEHLER")
sys.exit(1 if fails else 0)
