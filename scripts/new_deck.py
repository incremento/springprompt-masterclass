#!/usr/bin/env python3
"""Start a talk folder: the kit, a starter deck and the files a host needs.

    python3 scripts/new_deck.py ~/talks/my-talk --title "My talk"
    python3 scripts/new_deck.py ~/talks/my-talk --update-kit     # refresh kit/ in an existing talk

The folder is self-contained: copy it, zip it or deploy it and it still works.
Python 3.8+, standard library only.
"""
import argparse
import html
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
KIT = os.path.join(SKILL, "kit")
TPL = os.path.join(HERE, "templates")


def copy_kit(dest):
    out = os.path.join(dest, "kit")
    os.makedirs(out, exist_ok=True)
    for name in sorted(os.listdir(KIT)):
        if name.startswith(".") or name == "__pycache__":
            continue
        shutil.copy2(os.path.join(KIT, name), os.path.join(out, name))
    return out


def main():
    ap = argparse.ArgumentParser(description="Create a talk folder with the presentation kit in it.")
    ap.add_argument("folder")
    ap.add_argument("--title", default="Untitled talk")
    ap.add_argument("--update-kit", action="store_true", help="only refresh kit/ in an existing talk folder")
    a = ap.parse_args()
    dest = os.path.abspath(os.path.expanduser(a.folder))
    deck = os.path.join(dest, "deck.html")

    if a.update_kit:
        if not os.path.exists(deck):
            sys.exit("No deck.html in %s. Leave out --update-kit to start a new talk." % dest)
        copy_kit(dest)
        print("kit/ refreshed in %s (deck.html untouched)" % dest)
        return
    if os.path.exists(deck):
        sys.exit("%s already exists. Use --update-kit to refresh the kit, or pick another folder." % deck)

    os.makedirs(os.path.join(dest, "assets"), exist_ok=True)
    copy_kit(dest)
    with open(os.path.join(TPL, "deck.html"), encoding="utf-8") as f:
        text = f.read().replace("{{TITLE}}", html.escape(a.title, quote=True))
    with open(deck, "w", encoding="utf-8") as f:
        f.write(text)
    for src, name in (("Dockerfile", "Dockerfile"), ("dockerignore", ".dockerignore"), ("gitignore", ".gitignore")):
        if not os.path.exists(os.path.join(dest, name)):
            shutil.copy2(os.path.join(TPL, src), os.path.join(dest, name))

    print("Created %s" % dest)
    print("  deck.html    the slides and the room block (edit this)")
    print("  assets/      images, served at assets/<name>")
    print("  kit/         styles, scripts and the room server (leave as is)")
    print("  Dockerfile   for Railway or any other host")
    print("\nPreview with fake audience data:  open %s" % deck)
    print("Run the room:                     cd %s && python3 kit/server.py" % dest)


if __name__ == "__main__":
    main()
