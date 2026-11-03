#!/usr/bin/env python3
"""Write the public placeholder album: photos/*.svg + photos.json.

Reads the real manifest (photos.local.json, produced by build_photos.py) and
emits one coloured rectangle per photo with the same size, order and date,
so the published site has the real layout but none of the real pictures.
Standard library only; works on any OS.
"""
import colorsys
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "photos.local.json"
OUT = ROOT / "photos"
MANIFEST = ROOT / "photos.json"
SIZE_DIV = 4  # placeholders are small; the page scales them to the real w/h


def color(n):
    """Distinct, pleasant colours: golden-angle hue steps with varied lightness."""
    h = (n * 0.61803398875) % 1.0
    l = (0.55, 0.65, 0.45)[n % 3]
    r, g, b = colorsys.hls_to_rgb(h, l, 0.45)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def svg(w, h, fill, label):
    font = min(w, h) // 8
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">\n'
            f'<rect width="{w}" height="{h}" fill="{fill}"/>\n'
            f'<text x="50%" y="50%" fill="#ffffff" fill-opacity="0.75" font-family="sans-serif" '
            f'font-size="{font}" text-anchor="middle" dominant-baseline="middle">{label}</text>\n'
            f'</svg>\n')


def main():
    if not SOURCE.exists():
        sys.exit(f"{SOURCE.name} not found: run scripts/build_photos.py first.")
    chapters = json.loads(SOURCE.read_text())["chapters"]

    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.svg"):
        old.unlink()

    n = 0
    out_chapters = []
    for ch in chapters:
        photos = []
        for i, p in enumerate(ch["photos"], 1):
            name = f"{ch['city'].lower()}-{i:02d}.svg"
            w, h = p["w"] // SIZE_DIV, p["h"] // SIZE_DIV
            (OUT / name).write_text(svg(w, h, color(n), f"{ch['city']} {i}"))
            photos.append({"src": f"photos/{name}", "w": w, "h": h,
                           "taken": p["taken"], "exact": p["exact"]})
            n += 1
        out_chapters.append({"city": ch["city"], "photos": photos})

    MANIFEST.write_text(json.dumps({"chapters": out_chapters}, indent=1))
    print(f"wrote {n} placeholders in {len(out_chapters)} chapters", file=sys.stderr)


if __name__ == "__main__":
    main()
