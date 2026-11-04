#!/usr/bin/env python3
"""Prepare the local-only head images: pics/avatars/<name>_av.png -> avatars-local/<name>.png

- Downsizes with macOS `sips` (max side MAX_SIDE), then crops away the transparent
  margin with a small stdlib PNG reader/writer, so every head fills its image box.
- avatars-local/ is gitignored. The public site uses the cartoon heads in avatars/*.svg.
"""
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pics" / "avatars"
OUT = ROOT / "avatars-local"
MAX_SIDE = 400
ALPHA_MIN = 40  # ignore faint cut-out fringe when finding the head's bounding box
SIGNATURE = b"\x89PNG\r\n\x1a\n"


def unfilter(ftype, line, prev, bpp):
    for i in range(len(line)):
        a = line[i - bpp] if i >= bpp else 0
        b = prev[i]
        c = prev[i - bpp] if i >= bpp else 0
        if ftype == 1:
            line[i] = (line[i] + a) & 255
        elif ftype == 2:
            line[i] = (line[i] + b) & 255
        elif ftype == 3:
            line[i] = (line[i] + (a + b) // 2) & 255
        elif ftype == 4:
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
            line[i] = (line[i] + pred) & 255


def read_png(path):
    data = path.read_bytes()
    if not data.startswith(SIGNATURE):
        raise SystemExit(f"{path.name}: not a PNG")
    pos, idat = 8, b""
    while pos < len(data):
        size, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + size]
        pos += 12 + size
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
    if depth != 8 or interlace or ctype not in (2, 6):
        raise SystemExit(f"{path.name}: need a non-interlaced 8-bit RGB/RGBA PNG")
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        line = bytearray(raw[i + 1:i + 1 + stride])
        unfilter(raw[i], line, prev, bpp)
        rows.append(line)
        prev = line
        i += 1 + stride
    return w, h, bpp, rows


def write_png(path, w, h, bpp, rows):
    def chunk(kind, body):
        crc = zlib.crc32(kind + body) & 0xFFFFFFFF
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6 if bpp == 4 else 2, 0, 0, 0)
    path.write_bytes(SIGNATURE + chunk(b"IHDR", ihdr) +
                     chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def crop_to_alpha(w, h, bpp, rows):
    if bpp != 4:
        return w, h, rows
    xs, ys = [], []
    for y, row in enumerate(rows):
        solid = [x for x in range(w) if row[4 * x + 3] >= ALPHA_MIN]
        if solid:
            xs += [solid[0], solid[-1]]
            ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), ys[0], ys[-1]
    return x1 - x0 + 1, y1 - y0 + 1, [r[4 * x0:4 * (x1 + 1)] for r in rows[y0:y1 + 1]]


def main():
    sources = sorted(SRC.glob("*_av.png"))
    if not sources:
        sys.exit(f"no *_av.png files in {SRC}")
    OUT.mkdir(exist_ok=True)
    for src in sources:
        name = src.stem[:-3]
        with tempfile.TemporaryDirectory() as tmp:
            small = Path(tmp) / "small.png"
            subprocess.run(["sips", "-Z", str(MAX_SIDE), str(src), "--out", str(small)],
                           check=True, capture_output=True)
            w, h, bpp, rows = read_png(small)
        if bpp != 4:
            print(f"warning: {src.name} has no alpha channel, so the background stays",
                  file=sys.stderr)
        w, h, rows = crop_to_alpha(w, h, bpp, rows)
        write_png(OUT / f"{name}.png", w, h, bpp, rows)
        print(f"{src.name} -> avatars-local/{name}.png {w}x{h}", file=sys.stderr)


if __name__ == "__main__":
    main()
