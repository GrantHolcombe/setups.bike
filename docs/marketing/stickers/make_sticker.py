"""Build the trailhead sticker (gold layout) as a fully vector SVG.

Usage (from the setups.bike folder):
    python docs/marketing/stickers/make_sticker.py

Writes docs/marketing/stickers/sticker-a-gold-DRAFT.svg (4 x 4 in, 100 units = 1 in).
- The logo tile and the "Setups.Bike / We remember the clicks" lettering come from the app's
  public/img/logos/setups-logo.svg (Grant's own traced lettering, tagline 1.4x), not from a font,
  so the brand looks the same everywhere. The mark is white on the red tile; the lettering is
  recoloured dark for the gold background.
- The QR code encodes the permanent short link https://setups.bike/q/trailhead.
- The dashed line is the 0.125 in safe margin: a guide only, removed in the print file.
- Headline and body copy are still Segoe UI text (export text to outlines for the printer).
Needs: segno (pip install --user segno).
"""
import os, re
import segno

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
LOGO_SVG = os.path.join(REPO, "public", "img", "logos", "setups-logo.svg")
OUT = os.path.join(HERE, "sticker-a-gold-DRAFT.svg")
QR_URL = "https://setups.bike/q/trailhead"
FONT = "'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif"
DARK, GOLD, RED, WHITE = "#1c1c1c", "#daa520", "#ff0000", "#ffffff"


def logo_parts():
    """Split the app logo into (mark subpaths, name subpaths, tagline d, tagline transform)."""
    s = open(LOGO_SVG, encoding="utf-8").read()
    paths = re.findall(r'<path([^>]*)\sd="([^"]+)"', s)
    nums = lambda sp: [float(v) for v in re.findall(r"-?\d+\.?\d*", sp)]
    subs0 = re.findall(r"M[^M]*", paths[0][1])
    mark = [sp for sp in subs0 if max(nums(sp)[1::2]) < 220]     # artwork sits above y=220
    name = [sp for sp in subs0 if sp not in mark]                # "Setups.Bike" below it
    tag_d = paths[1][1]
    tf = re.search(r'transform="([^"]+)"', paths[1][0])
    return mark, name, tag_d, (tf.group(1) if tf else "")


def bbox(subs, xform=lambda x, y: (x, y)):
    xs, ys = [], []
    for sp in subs:
        n = [float(v) for v in re.findall(r"-?\d+\.?\d*", sp)]
        for x, y in zip(n[0::2], n[1::2]):
            a, b = xform(x, y)
            xs.append(a); ys.append(b)
    return min(xs), min(ys), max(xs), max(ys)


def fit(box, x, y, w, h, align="center"):
    """Transform that scales box (x0,y0,x1,y1) to fit inside (x,y,w,h), centred vertically."""
    x0, y0, x1, y1 = box
    k = min(w / (x1 - x0), h / (y1 - y0))
    tx = x + (w - (x1 - x0) * k) / 2 if align == "center" else x
    ty = y + (h - (y1 - y0) * k) / 2
    return f"translate({tx:.2f} {ty:.2f}) scale({k:.4f}) translate({-x0:.2f} {-y0:.2f})", k


def real_qr(x, y, panel):
    q = segno.make(QR_URL, error="q", micro=False)
    rows = [list(r) for r in q.matrix]
    n = len(rows); m = panel / (n + 8)
    d = "".join(f"M{x+(c+4)*m:.3f} {y+(r+4)*m:.3f}h{m:.3f}v{m:.3f}h-{m:.3f}z"
                for r, row in enumerate(rows) for c, v in enumerate(row) if v)
    return (f'<rect x="{x}" y="{y}" width="{panel}" height="{panel}" rx="12" fill="#fff"/>'
            f'<path d="{d}" fill="{DARK}" shape-rendering="crispEdges"/>')


def main():
    mark, name, tag_d, tag_tf = logo_parts()
    # tagline transform in the logo is translate(175 288.6) scale(1.4) translate(-175 -285)
    m = re.findall(r"-?\d+\.?\d*", tag_tf)
    tx1, ty1, ks, tx2, ty2 = map(float, m) if len(m) == 5 else (0, 0, 1, 0, 0)
    tag_xy = lambda x, y: (tx1 + ks * (x + tx2), ty1 + ks * (y + ty2))
    text_box = [min(a, b) if i < 2 else max(a, b) for i, (a, b) in
                enumerate(zip(bbox(name), bbox(re.findall(r"M[^M]*", tag_d), tag_xy)))]

    tile_x, tile_y, tile = 28, 28, 86
    mark_tf, _ = fit(bbox(mark), tile_x + 11, tile_y + 11, tile - 22, tile - 22)
    text_tf, _ = fit(text_box, 130, tile_y, 372 - 130, tile)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="4in" viewBox="0 0 400 400">
<!-- 100 units = 1 inch. Dashed line = 0.125in safe margin (guide only; remove for print). -->
<rect width="400" height="400" rx="24" fill="{GOLD}"/>
<rect x="12.5" y="12.5" width="375" height="375" rx="14" fill="none" stroke="#000" stroke-opacity=".25" stroke-dasharray="4 4"/>
<rect x="{tile_x}" y="{tile_y}" width="{tile}" height="{tile}" rx="14" fill="{RED}"/>
<path fill="{WHITE}" fill-rule="evenodd" transform="{mark_tf}" d="{''.join(mark)}"/>
<g transform="{text_tf}" fill="{DARK}">
<path fill-rule="evenodd" d="{''.join(name)}"/>
<path fill-rule="evenodd" transform="{tag_tf}" d="{tag_d}"/>
</g>
<text x="28" y="168" font-family="{FONT}" font-size="37" font-weight="800" fill="{DARK}">Dialed it in?</text>
<text x="28" y="210" font-family="{FONT}" font-size="37" font-weight="800" fill="{DARK}">Save it.</text>
<text font-family="{FONT}" font-size="16" fill="{DARK}"><tspan x="28" y="248">Tire pressure, fork +</tspan><tspan x="28" y="268">shock psi, rebound +</tspan><tspan x="28" y="288">compression clicks,</tspan><tspan x="28" y="308">tokens. Every bike.</tspan></text>
<text x="28" y="338" font-family="{FONT}" font-size="18" font-weight="700" fill="{DARK}">Free. No card.</text>
<text x="28" y="370" font-family="{FONT}" font-size="25" font-weight="700" fill="{DARK}">setups.bike</text>
{real_qr(216, 216, 156)}
</svg>
'''
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)
    print(f"{len(svg.encode())} bytes -> {OUT}")


if __name__ == "__main__":
    main()
