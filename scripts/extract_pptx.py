#!/usr/bin/env python3
"""Read an existing PowerPoint deck into something an agent can rebuild from.

    uv run --with python-pptx python3 scripts/extract_pptx.py talk.pptx --out import/
    (or: pip install python-pptx, then python3 scripts/extract_pptx.py talk.pptx --out import/)

Writes, in the --out folder:
    outline.md     every slide in order: title, text with bullet levels, tables, chart data, notes
    outline.json   the same, structured
    media/         each picture, named s<slide>-<n>.<ext>

Google Slides: File → Download → Microsoft PowerPoint (.pptx), then run this.
Keynote: File → Export To → PowerPoint. A PDF has no notes or chart data; export a .pptx if you can.
"""
import argparse
import json
import os
import sys

try:
    from pptx import Presentation
    from pptx.util import Emu
except ImportError:
    sys.exit("This script needs python-pptx.\n  uv run --with python-pptx python3 scripts/extract_pptx.py <file.pptx> --out import/\n  or: pip install python-pptx")


def text_of(shape):
    out = []
    for p in shape.text_frame.paragraphs:
        t = "".join(r.text for r in p.runs).strip()
        if t:
            out.append({"level": p.level or 0, "text": t})
    return out


def chart_of(shape):
    try:
        ch = shape.chart
        plot = ch.plots[0]
        cats = [str(c) for c in plot.categories]
        series = [{"name": s.name, "values": [None if v is None else float(v) for v in s.values]} for s in plot.series]
        title = ch.chart_title.text_frame.text if ch.has_title else ""
        return {"kind": str(ch.chart_type).split(".")[-1].split(" ")[0], "title": title, "categories": cats, "series": series}
    except Exception as e:  # charts come in many shapes; never fail the whole import on one
        return {"kind": "unknown", "error": str(e)}


def walk(shapes):
    for sh in shapes:
        if sh.shape_type == 6:  # group
            for inner in walk(sh.shapes):
                yield inner
        else:
            yield sh


def main():
    ap = argparse.ArgumentParser(description="Extract text, notes, tables, chart data and pictures from a .pptx")
    ap.add_argument("pptx")
    ap.add_argument("--out", default="import")
    a = ap.parse_args()
    prs = Presentation(a.pptx)
    media = os.path.join(a.out, "media")
    os.makedirs(media, exist_ok=True)
    W, H = prs.slide_width or 1, prs.slide_height or 1
    slides = []
    for n, slide in enumerate(prs.slides, 1):
        item = {"n": n, "layout": slide.slide_layout.name, "title": "", "text": [], "tables": [], "charts": [], "images": [], "notes": "",
                "hidden": slide._element.get("show") == "0"}
        title = slide.shapes.title
        if title is not None and title.has_text_frame:
            item["title"] = title.text_frame.text.strip()
        k = 0
        for sh in sorted(walk(slide.shapes), key=lambda s: ((s.top or 0), (s.left or 0))):
            if title is not None and sh.shape_id == title.shape_id:
                continue
            if getattr(sh, "has_chart", False) and sh.has_chart:
                item["charts"].append(chart_of(sh))
            elif getattr(sh, "has_table", False) and sh.has_table:
                item["tables"].append([[c.text.strip() for c in row.cells] for row in sh.table.rows])
            elif sh.shape_type == 13:  # picture
                try:
                    k += 1
                    name = "s%02d-%d.%s" % (n, k, sh.image.ext)
                    with open(os.path.join(media, name), "wb") as f:
                        f.write(sh.image.blob)
                    item["images"].append({"file": "media/" + name, "alt": sh.name,
                                           "box": [round((sh.left or 0) / W, 3), round((sh.top or 0) / H, 3), round((sh.width or 0) / W, 3), round((sh.height or 0) / H, 3)]})
                except Exception:
                    pass
            elif sh.has_text_frame:
                item["text"].extend(text_of(sh))
        if slide.has_notes_slide:
            item["notes"] = slide.notes_slide.notes_text_frame.text.strip()
        slides.append(item)

    with open(os.path.join(a.out, "outline.json"), "w", encoding="utf-8") as f:
        json.dump({"source": os.path.basename(a.pptx), "slides": slides}, f, indent=1, ensure_ascii=False)

    md = ["# %s — %d slides\n" % (os.path.basename(a.pptx), len(slides))]
    for s in slides:
        md.append("## %d. %s%s" % (s["n"], s["title"] or "(no title)", "  (hidden)" if s["hidden"] else ""))
        md.append("_layout: %s_\n" % s["layout"])
        for t in s["text"]:
            md.append("%s- %s" % ("  " * t["level"], t["text"]))
        for tb in s["tables"]:
            md.append("")
            for r, row in enumerate(tb):
                md.append("| " + " | ".join(c.replace("\n", " ") for c in row) + " |")
                if r == 0:
                    md.append("|" + "---|" * len(row))
        for c in s["charts"]:
            md.append("\nChart (%s) %s" % (c.get("kind"), c.get("title", "")))
            if c.get("categories") is not None:
                md.append("  categories: " + ", ".join(c["categories"]))
                for se in c.get("series", []):
                    md.append("  %s: %s" % (se["name"], ", ".join("" if v is None else ("%g" % v) for v in se["values"])))
        for im in s["images"]:
            md.append("\nImage: %s (left %.0f%%, top %.0f%%, width %.0f%%)" % (im["file"], im["box"][0] * 100, im["box"][1] * 100, im["box"][2] * 100))
        if s["notes"]:
            md.append("\nNotes: " + s["notes"].replace("\n", "\n  "))
        md.append("")
    with open(os.path.join(a.out, "outline.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    n_img = sum(len(s["images"]) for s in slides)
    n_ch = sum(len(s["charts"]) for s in slides)
    n_notes = sum(1 for s in slides if s["notes"])
    print("%d slides · %d with notes · %d charts with data · %d pictures → %s" % (len(slides), n_notes, n_ch, n_img, a.out))
    print("Read %s first." % os.path.join(a.out, "outline.md"))


if __name__ == "__main__":
    main()
