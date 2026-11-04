#!/usr/bin/env python3
"""Build map.json: a simplified map of Europe plus the trip's cities and routes.

- Source: Natural Earth country polygons (public domain) via the `world-atlas`
  TopoJSON on jsDelivr. Downloaded once into .cache/ (gitignored).
- Projection: Lambert azimuthal equal-area centred on Europe, in SVG units.
- Output (committed): map.json with a viewBox, one SVG path per country, the
  cities, and one smooth SVG path per leg of the trip.
Standard library only; works on any OS.
"""
import json
import math
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "countries-10m.json"
OUT = ROOT / "map.json"
URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json"

WIDTH = 3000          # SVG units across the map
TOLERANCE = 0.5       # Douglas-Peucker tolerance, SVG units
MARGIN = 20           # clip a bit beyond the viewBox so no border line shows at the edge
LON0, LAT0 = math.radians(10), math.radians(52)
R_KM = 6371.0088
LON_RANGE, LAT_RANGE = (-11.0, 32.0), (34.5, 60.5)  # visible area

# name -> (lat, lon); coordinates from OpenStreetMap
CITIES = {
    "Paris": (48.8535, 2.3484),
    "Lausanne": (46.5218, 6.6327),
    "Weisendorf": (49.6272, 10.8116),
    "Prague": (50.0875, 14.4213),
}

# Waypoints (lat, lon) that bend each route along the real road/rail corridor.
ROUTES = [
    {"id": "paris-lausanne", "mode": "bus", "from": "Paris", "to": "Lausanne",
     "via": [(47.0958, 5.4900), (46.7100, 6.3700)]},
    {"id": "lausanne-weisendorf", "mode": "train", "from": "Lausanne", "to": "Weisendorf",
     "via": [(46.9930, 6.9310), (47.5596, 7.5886), (47.9990, 7.8421), (49.0069, 8.4037),
             (50.1109, 8.6821), (49.7913, 9.9534)]},
    {"id": "weisendorf-prague", "mode": "bus", "from": "Weisendorf", "to": "Prague",
     "via": [(49.4521, 11.0767), (49.4430, 11.8600), (49.6500, 12.4900), (49.7475, 13.3776)]},
]

# Cartoon landmarks (assets/landmarks/*.svg). x, y = bottom-centre of the drawing, as an
# offset in SVG units from the city; w, h = drawn size in SVG units.
LANDMARKS = [
    {"id": "eiffel", "city": "Paris", "file": "assets/landmarks/eiffel.svg",
     "dx": -48, "dy": 6, "w": 56, "h": 90},
    {"id": "lake", "city": "Lausanne", "file": "assets/landmarks/lake.svg",
     "dx": 100, "dy": 60, "w": 112, "h": 70},
    {"id": "church", "city": "Weisendorf", "file": "assets/landmarks/church.svg",
     "dx": 46, "dy": -6, "w": 54, "h": 72},
    {"id": "prague-clock", "city": "Prague", "file": "assets/landmarks/prague-clock.svg",
     "dx": 52, "dy": 6, "w": 56, "h": 56},
]


def project(lat, lon):
    """Lambert azimuthal equal-area; returns km, y pointing up."""
    phi, lam = math.radians(lat), math.radians(lon)
    k = math.sqrt(2 / (1 + math.sin(LAT0) * math.sin(phi) +
                       math.cos(LAT0) * math.cos(phi) * math.cos(lam - LON0)))
    x = R_KM * k * math.cos(phi) * math.sin(lam - LON0)
    y = R_KM * k * (math.cos(LAT0) * math.sin(phi) -
                    math.sin(LAT0) * math.cos(phi) * math.cos(lam - LON0))
    return x, y


def frame():
    """Bounding rectangle (km) of the visible lon/lat box, plus the km -> unit scale."""
    pts = []
    for t in range(0, 101):
        a = t / 100
        lon = LON_RANGE[0] + a * (LON_RANGE[1] - LON_RANGE[0])
        lat = LAT_RANGE[0] + a * (LAT_RANGE[1] - LAT_RANGE[0])
        pts += [project(LAT_RANGE[0], lon), project(LAT_RANGE[1], lon),
                project(lat, LON_RANGE[0]), project(lat, LON_RANGE[1])]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys), WIDTH / (max(xs) - min(xs))


X0, X1, Y0, Y1, SCALE = frame()
HEIGHT = round((Y1 - Y0) * SCALE)


def to_svg(lat, lon):
    x, y = project(lat, lon)
    return (x - X0) * SCALE, (Y1 - y) * SCALE


def load_topology():
    if not CACHE.exists():
        CACHE.parent.mkdir(exist_ok=True)
        print(f"downloading {URL}", file=sys.stderr)
        with urllib.request.urlopen(URL, timeout=60) as r:
            CACHE.write_bytes(r.read())
    return json.loads(CACHE.read_text())


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x, y = x + dx, y + dy
            pts.append((x * sx + tx, y * sy + ty))  # (lon, lat)
        arcs.append(pts)
    return arcs


def ring_points(ring, arcs):
    pts = []
    for idx in ring:
        seg = arcs[idx] if idx >= 0 else arcs[~idx][::-1]
        pts.extend(seg if not pts else seg[1:])
    return pts


def clip_ring(pts, xmin, xmax, ymin, ymax):
    """Sutherland-Hodgman clip of a closed ring against an axis-aligned rectangle."""
    def edge(points, inside, cross):
        out = []
        for i, cur in enumerate(points):
            prev = points[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
        return out

    def at_x(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))

    def at_y(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)

    for inside, cross in (
        (lambda p: p[0] >= xmin, at_x(xmin)), (lambda p: p[0] <= xmax, at_x(xmax)),
        (lambda p: p[1] >= ymin, at_y(ymin)), (lambda p: p[1] <= ymax, at_y(ymax)),
    ):
        if not pts:
            break
        pts = edge(pts, inside, cross)
    return pts


def simplify(pts, tol):
    """Iterative Douglas-Peucker on an open polyline."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        far, far_d = -1, tol
        for i in range(a + 1, b):
            px, py = pts[i]
            d = (math.hypot(px - ax, py - ay) if norm == 0
                 else abs(dy * (px - ax) - dx * (py - ay)) / norm)
            if d > far_d:
                far, far_d = i, d
        if far >= 0:
            keep[far] = True
            stack += [(a, far), (far, b)]
    return [p for p, k in zip(pts, keep) if k]


def num(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def ring_path(pts):
    return "M" + "L".join(f"{num(x)} {num(y)}" for x, y in pts) + "Z"


def country_path(geom, arcs):
    polygons = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
    parts = []
    for polygon in polygons:
        for ring in polygon:
            ll = ring_points(ring, arcs)
            lons = [p[0] for p in ll]
            lats = [p[1] for p in ll]
            if max(lons) < -40 or min(lons) > 60 or max(lats) < 20 or min(lats) > 75:
                continue  # far from Europe: skip before projecting
            pts = [to_svg(lat, lon) for lon, lat in ll]
            pts = clip_ring(pts, -MARGIN, WIDTH + MARGIN, -MARGIN, HEIGHT + MARGIN)
            if len(pts) < 3:
                continue
            pts = simplify(pts + [pts[0]], TOLERANCE)[:-1]
            if len(pts) >= 3:
                parts.append(ring_path(pts))
    return "".join(parts)


def smooth_path(pts):
    """Catmull-Rom spline through pts, written as cubic Bezier segments."""
    p = [pts[0]] + pts + [pts[-1]]
    d = f"M{num(pts[0][0])} {num(pts[0][1])}"
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += (f"C{num(c1[0])} {num(c1[1])} {num(c2[0])} {num(c2[1])} "
              f"{num(p2[0])} {num(p2[1])}")
    return d


def main():
    topo = load_topology()
    arcs = decode_arcs(topo)
    countries = []
    for geom in topo["objects"]["countries"]["geometries"]:
        d = country_path(geom, arcs)
        if d:
            name = geom["properties"]["name"]
            countries.append({"id": geom.get("id", name), "name": name, "d": d})

    cities = {}
    for name, (lat, lon) in CITIES.items():
        x, y = to_svg(lat, lon)
        cities[name] = {"name": name, "lat": lat, "lon": lon, "x": round(x, 1), "y": round(y, 1)}

    routes = []
    for r in ROUTES:
        pts = [to_svg(*CITIES[r["from"]])] + [to_svg(*v) for v in r["via"]] + [to_svg(*CITIES[r["to"]])]
        routes.append({"id": r["id"], "mode": r["mode"], "from": r["from"], "to": r["to"],
                       "d": smooth_path(pts)})

    landmarks = [{"id": m["id"], "city": m["city"], "file": m["file"], "w": m["w"], "h": m["h"],
                  "x": round(cities[m["city"]]["x"] + m["dx"], 1),
                  "y": round(cities[m["city"]]["y"] + m["dy"], 1)} for m in LANDMARKS]

    data = {"width": WIDTH, "height": HEIGHT, "km_per_unit": round(1 / SCALE, 3),
            "source": "Natural Earth (public domain), via world-atlas",
            "countries": countries, "cities": cities, "routes": routes, "landmarks": landmarks}
    OUT.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {OUT.name}: {WIDTH}x{HEIGHT}, {len(countries)} countries, "
          f"{OUT.stat().st_size // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
