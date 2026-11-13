#!/usr/bin/env python3
"""Screenshot every slide, and optionally export a PDF, with headless Chrome.

    python3 scripts/shots.py path/to/deck.html                 # shots/01.png, 02.png … next to the deck
    python3 scripts/shots.py path/to/deck.html --only 3,7-9
    python3 scripts/shots.py path/to/deck.html --pdf deck.pdf  # one page per slide, all reveals shown
    python3 scripts/shots.py path/to/deck.html --first         # slides as they first appear (before any click)

The deck is opened straight from disk, so live slides show the kit's sample
results rather than real answers. Look at every image before you call a deck
done: overflow, collisions and empty space only show up here.

Python 3.8+, standard library only. Needs Chrome, Chromium or Edge installed.
"""
import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time

CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def find_chrome():
    for c in CANDIDATES:
        if not c:
            continue
        if os.path.isfile(c):
            return c
        w = shutil.which(c)
        if w:
            return w
    sys.exit("Could not find Chrome, Chromium or Edge. Install one, or set CHROME=/path/to/browser.")


def run(chrome, args, url, profile, out, wait=45):
    """Start Chrome, wait for the output file to appear and stop growing, then stop Chrome.
    Some Chrome builds never exit by themselves in headless mode, so do not wait for that."""
    cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
           "--allow-file-access-from-files", "--user-data-dir=" + profile] + args + [url]
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0, last, same = time.time(), -1, 0
    while time.time() - t0 < wait and same < 3:
        if p.poll() is not None:
            break
        time.sleep(0.25)
        size = out.stat().st_size if out.exists() else -1
        same = same + 1 if size > 0 and size == last else 0
        last = size
    if p.poll() is None:
        p.terminate()
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()


def parse_only(s, n):
    want = set()
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        a, _, b = part.partition("-")
        for k in range(int(a), int(b or a) + 1):
            if 1 <= k <= n:
                want.add(k)
    return sorted(want)


def main():
    ap = argparse.ArgumentParser(description="Screenshot the slides of a deck, or export it as a PDF.")
    ap.add_argument("deck")
    ap.add_argument("--out", help="folder for the PNGs (default: shots/ next to the deck)")
    ap.add_argument("--only", help="slide numbers, e.g. 3,7-9")
    ap.add_argument("--first", action="store_true", help="show each slide before its click-reveals")
    ap.add_argument("--pdf", help="write a PDF here instead of PNGs")
    ap.add_argument("--scale", type=float, default=1, help="2 for sharper images")
    a = ap.parse_args()

    deck = pathlib.Path(a.deck).expanduser().resolve()
    if not deck.is_file():
        sys.exit("No such deck: %s" % deck)
    n = len(re.findall(r'<section[^>]*\bclass="[^"]*\bslide\b', deck.read_text(encoding="utf-8")))
    if not n:
        sys.exit('No <section class="slide"> found in %s' % deck)
    chrome = find_chrome()
    base = deck.as_uri()

    with tempfile.TemporaryDirectory() as profile:
        if a.pdf:
            out = pathlib.Path(a.pdf).expanduser().resolve()
            run(chrome, ["--print-to-pdf=" + str(out), "--no-pdf-header-footer", "--virtual-time-budget=9000"], base + "?print=1", profile, out)
            if not out.exists() or out.stat().st_size < 2000:
                sys.exit("Chrome did not write the PDF. Open %s?print=1 in a browser and print to PDF at 1280×720 instead." % base)
            print("%s (%d slides)" % (out, n))
            return
        outdir = pathlib.Path(a.out).expanduser().resolve() if a.out else deck.parent / "shots"
        outdir.mkdir(parents=True, exist_ok=True)
        todo = parse_only(a.only, n) if a.only else list(range(1, n + 1))
        missing = []
        for k in todo:
            png = outdir / ("%02d.png" % k)
            if png.exists():
                png.unlink()
            url = "%s?demo=1%s#%d" % (base, "" if a.first else "&all=1", k)
            run(chrome, ["--screenshot=" + str(png), "--window-size=1280,720", "--force-device-scale-factor=%g" % a.scale,
                         "--virtual-time-budget=6000"], url, profile, png)
            if png.exists():
                print(png)
            else:
                missing.append(k)
        if missing:
            sys.exit("No screenshot for slide(s) %s. Try again, or open the deck in a browser." % ", ".join(map(str, missing)))


if __name__ == "__main__":
    main()
