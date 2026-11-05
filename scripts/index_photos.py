#!/usr/bin/env python3
"""Index the curated photos in photos-local/ and write photos.local.json.

photos-local/ is the source of truth: add, remove or rename files there, then run this.
Unlike build_photos.py it never deletes or reconverts anything.

- <city>-<anything>.jpg    -> a photo in that city's chapter, e.g. lausanne-IMG_6321.jpg
- <from>-to-<to>.jpg       -> the photo shown midway on that road, e.g. paris-to-lausanne.jpg

City names come from map.json (case-insensitive). Photos are ordered by filename within
each chapter; chapters and roads follow the trip order. Files are rotated upright and
stripped of EXIF/XMP (incl. GPS) in place. Ends by regenerating the public placeholders.
"""
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

import make_placeholders
from build_photos import ROTATIONS, jpeg_size, read_exif, sips, strip_metadata

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "photos-local"
MANIFEST = ROOT / "photos.local.json"
EXTS = {".jpg", ".jpeg"}


def prepare(path):
    """Rotate upright and strip metadata in place; return the manifest entry."""
    orientation, taken = read_exif(path.read_bytes())
    if orientation in ROTATIONS:
        sips(*ROTATIONS[orientation], str(path))
    data = path.read_bytes()
    clean = strip_metadata(data)
    if clean != data:
        path.write_bytes(clean)
    w, h = jpeg_size(clean)
    when = datetime.strptime(taken, "%Y:%m:%d %H:%M:%S").isoformat() if taken else None
    # ?v=<content hash>: a file replaced under the same name gets a new URL, so the browser
    # can't keep showing its cached old picture.
    version = hashlib.md5(clean).hexdigest()[:8]
    return {"src": f"{SRC.name}/{path.name}?v={version}", "w": w, "h": h,
            "taken": when, "exact": bool(taken)}


def main():
    trip = json.loads((ROOT / "map.json").read_text())["routes"]
    order = [trip[0]["from"]] + [r["to"] for r in trip]
    city_of = {c.lower(): c for c in order}

    chapters = {c: [] for c in order}
    roads = {(r["from"], r["to"]): None for r in trip}
    for path in sorted(SRC.iterdir()):
        if path.suffix.lower() not in EXTS:
            continue
        parts = path.stem.lower().split("-")
        if len(parts) == 3 and parts[1] == "to" and parts[0] in city_of and parts[2] in city_of:
            key = (city_of[parts[0]], city_of[parts[2]])
            if key not in roads:
                sys.exit(f"{path.name}: no such road in map.json")
            roads[key] = prepare(path)
        elif parts[0] in city_of:
            chapters[city_of[parts[0]]].append(prepare(path))
        else:
            print(f"  skipped {path.name}: no city prefix", file=sys.stderr)

    out = {
        "chapters": [{"city": c, "photos": p} for c, p in chapters.items() if p],
        "roads": [{"from": a, "to": b, "photo": p} for (a, b), p in roads.items() if p],
    }
    MANIFEST.write_text(json.dumps(out, indent=1))
    print(f"wrote {[(c['city'], len(c['photos'])) for c in out['chapters']]} and "
          f"{len(out['roads'])} road photos", file=sys.stderr)
    for (a, b), p in roads.items():
        if not p:
            print(f"  no road photo for {a} -> {b}", file=sys.stderr)
    make_placeholders.main()


if __name__ == "__main__":
    main()
