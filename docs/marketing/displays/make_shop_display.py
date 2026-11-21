"""Make a multi-color 3D-printable shop display for one Setups.Bike QR short code.

Usage (from the setups.bike folder):
    python docs/marketing/displays/make_shop_display.py shop-trailworks
    python docs/marketing/displays/make_shop_display.py shop-tw --module 3.2 --error q

Writes docs/marketing/displays/out/<code>/:
    <code>-display.3mf    plaque + stand, parts pre-assigned to AMS slots (Bambu Studio)
    <code>-*.stl          one STL per color, as a fallback
    <code>-qr.svg         the QR code on its own, for checking with a phone

AMS slots:  1 = white   2 = black (QR)   3 = gold (frame, band, stand)   4 = red (add text)
The plaque prints flat, QR face up. The top 0.6 mm is the color layer (QR modules inlaid, so
the face is flat). Text ("Setups.Bike", "Dialed it in? Save it.") goes on the gold band with
Bambu Studio's Text tool. See README.md.

Needs: Python 3 and segno (pip install --user segno). Nothing else.
"""
import argparse, math, os, re, struct, sys, urllib.request, urllib.error, zipfile

import segno

BASE_URL = "https://setups.bike/q/"
WHITE, BLACK, GOLD, RED = 1, 2, 3, 4


# ---------- geometry: a mesh is a list of triangles ((x,y,z),(x,y,z),(x,y,z)) ----------

def box(x0, y0, z0, x1, y1, z1):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
         (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    return [(v[a], v[b], v[c]) for a, b, c in f]


def tilted_box(x0, x1, depth, height, y_front, z_bottom, lean_deg):
    """Box leaning back by lean_deg from vertical; its bottom-front edge sits at (y_front, z_bottom)."""
    t = math.radians(lean_deg)
    up = (math.sin(t), math.cos(t))       # along the lean (y, z)
    back = (math.cos(t), -math.sin(t))    # thickness direction
    def p(x, a, b):  # a along `back`, b along `up`
        return (x, y_front + a * back[0] + b * up[0], z_bottom + a * back[1] + b * up[1])
    v = [p(x0, 0, 0), p(x1, 0, 0), p(x1, depth, 0), p(x0, depth, 0),
         p(x0, 0, height), p(x1, 0, height), p(x1, depth, height), p(x0, depth, height)]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
         (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    return [(v[a], v[b], v[c]) for a, b, c in f]


def runs(row, value):
    """Yield (start, end) column runs where row[c] == value."""
    c, n = 0, len(row)
    while c < n:
        if row[c] == value:
            s = c
            while c < n and row[c] == value:
                c += 1
            yield s, c
        else:
            c += 1


# ---------- the display ----------

def build(code, module, error, thickness=4.0, color_layer=0.6, border=6.0, band=46.0,
          lean=15.0):
    url = BASE_URL + code
    qr = segno.make(url, error=error, micro=False)
    matrix = [list(r) for r in qr.matrix]
    n = len(matrix)
    quiet = 4
    cells = n + 2 * quiet
    panel = cells * module
    W = panel + 2 * border
    H = border + panel + band
    zc = thickness - color_layer

    white = box(0, 0, 0, W, H, zc)               # body under the color layer
    black, gold = [], []
    # QR panel: row 0 of the matrix is the top of the code, so flip to plaque y (up = back).
    for r in range(cells):
        mr = r - quiet
        row = [bool(matrix[mr][c - quiet]) if 0 <= mr < n and 0 <= c - quiet < n else False
               for c in range(cells)]
        y1 = border + panel - r * module
        y0 = y1 - module
        for s, e in runs(row, True):
            black += box(border + s * module, y0, zc, border + e * module, y1, thickness)
        for s, e in runs(row, False):
            white += box(border + s * module, y0, zc, border + e * module, y1, thickness)
    # Gold frame and top band (text goes on the band).
    gold += box(0, 0, zc, W, border, thickness)
    gold += box(0, border, zc, border, border + panel, thickness)
    gold += box(W - border, border, zc, W, border + panel, thickness)
    gold += box(0, border + panel, zc, W, H, thickness)

    # Stand: base slab, front lip, and a back support leaning `lean` degrees.
    slab_d, slab_t, lip_d, lip_h, gap = 55.0, 5.0, 6.0, 9.0, 0.6
    t = math.radians(lean)
    rest_y = lip_d + thickness / math.cos(t) + gap      # where the support's front face meets the slab
    stand = box(0, 0, 0, W, slab_d, slab_t)
    stand += box(0, 0, slab_t - 0.01, W, lip_d, slab_t + lip_h)
    support_h = min(0.45 * H, 80.0)
    # Two side posts instead of a full wall, so the QR's back doesn't need support and
    # less filament is used. Each post sinks 1 mm into the slab so the parts fuse.
    post_w = 14.0
    for x0 in (0.0, W - post_w):
        stand += tilted_box(x0, x0 + post_w, 6.0, support_h, rest_y, slab_t - 1.0, lean)
    # A short brace between the posts at the bottom, leaning with them so it never
    # pokes into the plaque.
    stand += tilted_box(0.0, W, 6.0, 10.0, rest_y, slab_t - 1.0, lean)

    info = dict(url=url, version=qr.version, error=qr.error, modules=n, width=W, height=H,
                panel=panel, stand_depth=slab_d)
    parts = {"plaque": [("white", white, WHITE), ("qr-black", black, BLACK), ("gold", gold, GOLD)],
             "stand": [("stand-gold", stand, GOLD)]}
    return qr, parts, info


# ---------- writers ----------

def write_stl(path, tris):
    with open(path, "wb") as f:
        f.write(b"Setups.Bike display".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            f.write(struct.pack("<12fH", 0, 0, 0, *a, *b, *c, 0))


def mesh_xml(tris):
    idx, verts, out = {}, [], []
    for tri in tris:
        ids = []
        for p in tri:
            key = (round(p[0], 4), round(p[1], 4), round(p[2], 4))
            if key not in idx:
                idx[key] = len(verts)
                verts.append(key)
            ids.append(idx[key])
        out.append(ids)
    v = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in verts)
    t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in out)
    return f"<mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh>"


def write_3mf(path, code, parts, info):
    res, build_items, config = [], [], []
    oid = 0
    x_off = 0.0
    for obj_name, plist in parts.items():
        comp_ids = []
        for pname, tris, slot in plist:
            oid += 1
            res.append(f'<object id="{oid}" type="model">{mesh_xml(tris)}</object>')
            comp_ids.append((oid, pname, slot))
        oid += 1
        comps = "".join(f'<component objectid="{c}"/>' for c, _, _ in comp_ids)
        res.append(f'<object id="{oid}" type="model"><components>{comps}</components></object>')
        build_items.append(f'<item objectid="{oid}" transform="1 0 0 0 1 0 0 0 1 {x_off:.2f} 0 0"/>')
        x_off += info["width"] + 10
        p = "".join(f'<part id="{c}" subtype="normal_part"><metadata key="name" value="{pn}"/>'
                    f'<metadata key="extruder" value="{s}"/></part>' for c, pn, s in comp_ids)
        config.append(f'<object id="{oid}"><metadata key="name" value="{code}-{obj_name}"/>'
                      f'<metadata key="extruder" value="{comp_ids[0][2]}"/>{p}</object>')
    model = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<model unit="millimeter" xml:lang="en-US" '
             'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
             f'<metadata name="Title">Setups.Bike display {code}</metadata>'
             f'<resources>{"".join(res)}</resources><build>{"".join(build_items)}</build></model>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
                   '<Default Extension="config" ContentType="text/xml"/></Types>')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr("3D/3dmodel.model", model)
        z.writestr("Metadata/model_settings.config",
                   f'<?xml version="1.0" encoding="UTF-8"?><config>{"".join(config)}</config>')


# ---------- safety check: is the code live? ----------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def check_live(url):
    """Unknown codes redirect to the bare home page, so a live code's Location has utm tags."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "setups-bike-display-script/1.0"})
        urllib.request.build_opener(_NoRedirect).open(req, timeout=10)
        return False, "no redirect"
    except urllib.error.HTTPError as e:
        if 300 <= e.code < 400:
            loc = e.headers.get("Location", "")
            return ("utm_" in loc), loc
        return None, f"HTTP {e.code}; open the link on your phone to check"
    except Exception as e:  # offline etc.
        return None, str(e)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("code", help="QR short code, e.g. shop-trailworks (lowercase, digits, hyphens)")
    ap.add_argument("--module", type=float, default=3.0, help="QR module size in mm (default 3.0; keep >= 3 for a 0.4 mm nozzle)")
    ap.add_argument("--error", default="m", choices="lmqh", help="QR error correction (default m; fine indoors)")
    ap.add_argument("--skip-live-check", action="store_true", help="don't check that the code redirects with tags")
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.code):
        sys.exit("Code must be lowercase letters, digits and single hyphens, e.g. shop-trailworks")

    url = BASE_URL + a.code
    if not a.skip_live_check:
        live, detail = check_live(url)
        if live is False:
            print(f"WARNING: {url} is not a live code yet ({detail}).\n"
                  "Scans would land on the home page with no tags. Ask the dev session to add it\n"
                  "(Dev card 'Add a shop QR code (per shop, on request)') before printing.\n")
        elif live is None:
            print(f"Note: couldn't check {url} ({detail}). Make sure it's live before printing.\n")
        else:
            print(f"Live: {url} -> {detail}")

    qr, parts, info = build(a.code, a.module, a.error)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", a.code)
    os.makedirs(out, exist_ok=True)
    write_3mf(os.path.join(out, f"{a.code}-display.3mf"), a.code, parts, info)
    for obj in parts.values():
        for pname, tris, _ in obj:
            write_stl(os.path.join(out, f"{a.code}-{pname}.stl"), tris)
    qr.save(os.path.join(out, f"{a.code}-qr.svg"), scale=10, border=4)
    print(f"QR version {info['version']}-{info['error']} ({info['modules']}x{info['modules']} modules, "
          f"{a.module} mm each). Plaque {info['width']:.0f} x {info['height']:.0f} mm, "
          f"stand {info['width']:.0f} x {info['stand_depth']:.0f} mm.")
    print(f"Files in {out}")


if __name__ == "__main__":
    main()
