"""Trace public/logo512.png (white mark on red) into a BIMI-ready SVG Tiny P/S logo.

Usage (from the setups.bike folder):
    python docs/marketing/email/bimi/make_bimi_svg.py

Writes docs/marketing/email/bimi/setups-bike-bimi.svg: square viewBox, solid red background,
the white mark as one even-odd path, scaled to 90% so it stays inside a circular crop.
If an original vector file of the logo turns up, prefer it over this trace.
Needs: pillow (pip install --user pillow).
"""
import math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
SRC = os.path.join(REPO, "public", "logo512.png")
OUT = os.path.join(HERE, "setups-bike-bimi.svg")
RED, WHITE = "#ff0000", "#ffffff"
SCALE = 0.90        # mark size inside the square (circle-crop safe)
TOL = 0.75          # simplification tolerance, in source pixels


def trace(mask, n):
    """Pixel-edge outlines of the True region, white kept on the left (y down image coords)."""
    def on(r, c):
        return 0 <= r < n and 0 <= c < n and mask[r][c]
    out = {}
    for r in range(n):
        for c in range(n):
            if not mask[r][c]:
                continue
            if not on(r - 1, c): out.setdefault((c, r), []).append((c + 1, r))
            if not on(r, c + 1): out.setdefault((c + 1, r), []).append((c + 1, r + 1))
            if not on(r + 1, c): out.setdefault((c + 1, r + 1), []).append((c, r + 1))
            if not on(r, c - 1): out.setdefault((c, r + 1), []).append((c, r))
    rings = []
    while out:
        start = next(iter(out))
        ring, prev, cur = [start], None, start
        while True:
            nxts = out[cur]
            if len(nxts) > 1 and prev is not None:
                d = (cur[0] - prev[0], cur[1] - prev[1])
                right = (-d[1], d[0])          # in y-down coords this keeps each pixel island separate
                nxts.sort(key=lambda p: 0 if (p[0] - cur[0], p[1] - cur[1]) == right else 1)
            nxt = nxts.pop(0)
            if not nxts:
                del out[cur]
            prev, cur = cur, nxt
            if cur == start:
                break
            ring.append(cur)
        rings.append(ring)
    return rings


def rdp(pts, tol):
    """Ramer-Douglas-Peucker on an open polyline."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    best, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return rdp(pts[:idx + 1], tol)[:-1] + rdp(pts[idx:], tol)


def simplify_ring(ring, tol):
    # split the closed ring at its two farthest-apart points, simplify both halves
    i0 = 0
    i1 = max(range(len(ring)), key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    a = ring[i0:i1 + 1]
    b = ring[i1:] + ring[:1]
    s = rdp(a, tol)[:-1] + rdp(b, tol)[:-1]
    return s if len(s) >= 3 else ring


def main():
    im = Image.open(SRC).convert("L")
    n = im.size[0]
    px = im.load()
    mask = [[px[c, r] > 128 for c in range(n)] for r in range(n)]
    rings = [simplify_ring(r, TOL) for r in trace(mask, n)]
    rings = [r for r in rings if len(r) >= 3]
    k = SCALE
    off = n * (1 - SCALE) / 2
    def fmt(v):
        return f"{v:.1f}".rstrip("0").rstrip(".")
    d = "".join("M" + "L".join(f"{fmt(off + x * k)} {fmt(off + y * k)}" for x, y in r) + "Z" for r in rings)
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 {n} {n}">\n'
        '<title>Setups.Bike</title>\n'
        f'<rect width="{n}" height="{n}" fill="{RED}"/>\n'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{d}"/>\n'
        '</svg>\n')
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)
    print(f"{len(rings)} outlines, {sum(len(r) for r in rings)} points, {len(svg.encode())} bytes -> {OUT}")


if __name__ == "__main__":
    main()
