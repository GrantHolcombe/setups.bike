"""Make a multi-color 3D-printable shop display for one Setups.Bike QR short code.

Usage (from the setups.bike folder):
    python docs/marketing/displays/make_shop_display.py shop-trailworks
    python docs/marketing/displays/make_shop_display.py shop-tw --module 3.2 --error q

Writes docs/marketing/displays/out/<code>/:
    <code>-display.3mf    Bambu Studio project (P1S by default): 4 filaments, colors and AMS slots set
    <code>-parts.3mf      plain 3MF with painted colors (fallback, and the input for the project)
    <code>-*.stl          one STL per color, as a fallback
    <code>-qr.svg         the QR code on its own, for checking with a phone
    <code>-preview.png    top view of the plaque's colors

AMS slots:  1 = white   2 = black   3 = gold   4 = red
The plaque prints flat, face up. The top 0.6 mm is the color layer: QR modules and the logo are
inlaid (flat), and the text is raised 0.6 mm on the gold band. See README.md.

Needs Python 3 plus: pip install --user segno fonttools mapbox-earcut pillow
"""
import argparse, math, os, re, struct, sys, urllib.request, urllib.error, uuid, zipfile

import segno
import numpy as np
import mapbox_earcut as earcut
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
LOGO_PNG = os.path.join(REPO, "public", "logo512.png")      # white mark on red
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"                  # matches the app's system font on Windows
BASE_URL = "https://setups.bike/q/"
BRAND, HEADLINE = "Setups.Bike", "Dialed it in? Save it."
WHITE, BLACK, GOLD, RED = 1, 2, 3, 4
COLORS = {WHITE: "#f4f4f4", BLACK: "#1c1c1c", GOLD: "#daa520", RED: "#ff0000"}


# ---------- geometry: a mesh is a list of triangles ((x,y,z),(x,y,z),(x,y,z)) ----------

_BOX_FACES = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
              (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]


def box(x0, y0, z0, x1, y1, z1):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    return [(v[a], v[b], v[c]) for a, b, c in _BOX_FACES]


def tilted_box(x0, x1, depth, height, y_front, z_bottom, lean_deg):
    """Box leaning back by lean_deg from vertical; its bottom-front edge sits at (y_front, z_bottom)."""
    t = math.radians(lean_deg)
    up, back = (math.sin(t), math.cos(t)), (math.cos(t), -math.sin(t))
    def p(x, a, b):
        return (x, y_front + a * back[0] + b * up[0], z_bottom + a * back[1] + b * up[1])
    v = [p(x0, 0, 0), p(x1, 0, 0), p(x1, depth, 0), p(x0, depth, 0),
         p(x0, 0, height), p(x1, 0, height), p(x1, depth, height), p(x0, depth, height)]
    return [(v[a], v[b], v[c]) for a, b, c in _BOX_FACES]


def runs(row, value):
    c, n = 0, len(row)
    while c < n:
        if row[c] == value:
            s = c
            while c < n and row[c] == value:
                c += 1
            yield s, c
        else:
            c += 1


# ---------- text: font outlines -> extruded meshes ----------

class _FlatPen(BasePen):
    """Collects glyph contours as flat polygons (curves split into short lines)."""
    def __init__(self, glyphset, steps=8):
        super().__init__(glyphset)
        self.contours, self.cur, self.steps = [], [], steps
    def _moveTo(self, p):
        self.cur = [p]
    def _lineTo(self, p):
        self.cur.append(p)
    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            self.cur.append(((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0],
                             (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1]))
    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a, b, c, d = (1-t)**3, 3*(1-t)**2*t, 3*(1-t)*t*t, t**3
            self.cur.append((a*p0[0] + b*p1[0] + c*p2[0] + d*p3[0], a*p0[1] + b*p1[1] + c*p2[1] + d*p3[1]))
    def _closePath(self):
        if len(self.cur) > 2:
            if self.cur[0] == self.cur[-1]:
                self.cur.pop()
            self.contours.append(self.cur)
        self.cur = []
    _endPath = _closePath


def _area(poly):
    return 0.5 * sum(poly[i][0]*poly[(i+1) % len(poly)][1] - poly[(i+1) % len(poly)][0]*poly[i][1]
                     for i in range(len(poly)))


def _inside(pt, poly):
    x, y, inside = pt[0], pt[1], False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i+1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1:
            inside = not inside
    return inside


class Font:
    def __init__(self, path):
        self.f = TTFont(path)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.cap = getattr(self.f["OS/2"], "sCapHeight", 0) or 0.7 * self.upm

    def width(self, text, size):
        return sum(self.gs[self.cmap[ord(ch)]].width for ch in text) * size / self.upm

    def polygons(self, text, size, x, y):
        """Polygons (outer CCW, holes CW) grouped as [(outer, [holes])] in mm, baseline at y."""
        s, groups, pen_x = size / self.upm, [], 0
        for ch in text:
            g = self.gs[self.cmap[ord(ch)]]
            pen = _FlatPen(self.gs)
            g.draw(pen)
            contours = [[(x + (pen_x + px) * s, y + py * s) for px, py in c] for c in pen.contours]
            pen_x += g.width
            outers, holes = [], []
            # Classify by nesting depth, not winding, so any font direction works.
            for c in contours:
                depth = sum(_inside(c[0], o) for o in contours if o is not c)
                (outers if depth % 2 == 0 else holes).append(c)
            for o in outers:
                if _area(o) < 0:
                    o.reverse()
                mine = [h for h in holes if _inside(h[0], o)]
                for h in mine:
                    if _area(h) > 0:
                        h.reverse()
                groups.append((o, mine))
        return groups


def extrude(groups, z0, z1):
    tris = []
    for outer, holes in groups:
        rings = [outer] + holes
        verts = np.array([p for r in rings for p in r], dtype=np.float64)
        ends = np.array(np.cumsum([len(r) for r in rings]), dtype=np.uint32)
        idx = earcut.triangulate_float64(verts, ends).reshape(-1, 3)
        for a, b, c in idx:
            pa, pb, pc = verts[a], verts[b], verts[c]
            if (pb[0]-pa[0])*(pc[1]-pa[1]) - (pb[1]-pa[1])*(pc[0]-pa[0]) < 0:
                pb, pc = pc, pb
            tris.append(((pa[0], pa[1], z1), (pb[0], pb[1], z1), (pc[0], pc[1], z1)))   # top, normal +z
            tris.append(((pa[0], pa[1], z0), (pc[0], pc[1], z0), (pb[0], pb[1], z0)))   # bottom, normal -z
        for r in rings:  # outer CCW and holes CW -> walls face outward
            for i in range(len(r)):
                (ax, ay), (bx, by) = r[i], r[(i+1) % len(r)]
                tris.append(((ax, ay, z0), (bx, by, z0), (bx, by, z1)))
                tris.append(((ax, ay, z0), (bx, by, z1), (ax, ay, z1)))
    return [tuple(tuple(float(v) for v in p) for p in t) for t in tris]


# ---------- logo: the PNG sampled to a grid of inlaid cells ----------

def logo_cells(grid):
    """grid x grid booleans, True = white stroke. Row 0 is the top of the image."""
    from PIL import ImageFilter
    # Thicken the strokes first so none is thinner than about two nozzle widths once printed.
    im = Image.open(LOGO_PNG).convert("L").filter(ImageFilter.MaxFilter(5))
    im = im.resize((grid, grid), Image.LANCZOS)
    px = im.load()
    return [[px[c, r] > 100 for c in range(grid)] for r in range(grid)]


# ---------- the display ----------

def build(code, module, error, thickness=4.0, color_layer=0.6, text_height=0.6, border=6.0,
          lean=15.0, tile=24.0, logo_grid=44):
    url = BASE_URL + code
    qr = segno.make(url, error=error, micro=False)
    matrix = [list(r) for r in qr.matrix]
    n, quiet = len(matrix), 4
    cells = n + 2 * quiet
    panel = cells * module
    W = panel + 2 * border
    zc, ztop = thickness - color_layer, thickness

    # Band layout (y up): headline row near the QR, logo tile + brand row above it.
    font = Font(FONT_BOLD)
    inner = W - 2 * border
    head_size = min(9.0, inner / font.width(HEADLINE, 1.0))
    head_cap = font.cap * head_size / font.upm
    gap = 5.0
    y_band = border + panel
    head_base = y_band + gap
    tile_y0 = head_base + head_cap + gap
    tile_y1 = tile_y0 + tile
    H = tile_y1 + border
    brand_room = inner - tile - 4.0
    brand_size = min(14.0, brand_room / font.width(BRAND, 1.0))
    brand_cap = font.cap * brand_size / font.upm
    brand_base = (tile_y0 + tile_y1) / 2 - brand_cap / 2
    brand_x = border + tile + 4.0

    white = box(0, 0, 0, W, H, zc)                       # body under the color layer
    black, gold, red = [], [], []

    # QR panel (matrix row 0 = top of the code).
    for r in range(cells):
        mr = r - quiet
        row = [bool(matrix[mr][c - quiet]) if 0 <= mr < n and 0 <= c - quiet < n else False
               for c in range(cells)]
        y1 = border + panel - r * module
        for s, e in runs(row, True):
            black += box(border + s * module, y1 - module, zc, border + e * module, y1, ztop)
        for s, e in runs(row, False):
            white += box(border + s * module, y1 - module, zc, border + e * module, y1, ztop)

    # Gold frame and band, leaving a hole for the logo tile.
    tx0, tx1 = border, border + tile
    gold += box(0, 0, zc, W, border, ztop)
    gold += box(0, border, zc, border, y_band, ztop)
    gold += box(W - border, border, zc, W, y_band, ztop)
    gold += box(0, y_band, zc, tx0, H, ztop)
    gold += box(tx1, y_band, zc, W, H, ztop)
    gold += box(tx0, y_band, zc, tx1, tile_y0, ztop)
    gold += box(tx0, tile_y1, zc, tx1, H, ztop)

    # Logo tile: red with the white mark, rounded corners (corner cells left gold).
    cell = tile / logo_grid
    rad = 4.0 / cell
    lc = logo_cells(logo_grid)
    for r in range(logo_grid):
        y1 = tile_y1 - r * cell
        kinds = []
        for c in range(logo_grid):
            cx, cy = c + 0.5, r + 0.5
            dx = max(rad - cx, cx - (logo_grid - rad), 0)
            dy = max(rad - cy, cy - (logo_grid - rad), 0)
            kinds.append("g" if dx * dx + dy * dy > rad * rad else ("w" if lc[r][c] else "r"))
        for kind, mesh in (("g", gold), ("w", white), ("r", red)):
            for s, e in runs(kinds, kind):
                mesh += box(tx0 + s * cell, y1 - cell, zc, tx0 + e * cell, y1, ztop)

    # Raised text in black on the band.
    text = extrude(font.polygons(BRAND, brand_size, brand_x, brand_base), ztop, ztop + text_height)
    text += extrude(font.polygons(HEADLINE, head_size, border, head_base), ztop, ztop + text_height)
    black += text

    # Stand: base slab, front lip, two posts and a brace leaning `lean` degrees.
    slab_d, slab_t, lip_d, lip_h, clearance = 55.0, 5.0, 6.0, 9.0, 0.6
    t = math.radians(lean)
    rest_y = lip_d + thickness / math.cos(t) + clearance
    stand = box(0, 0, 0, W, slab_d, slab_t)
    stand += box(0, 0, slab_t - 0.01, W, lip_d, slab_t + lip_h)
    support_h, post_w = min(0.45 * H, 80.0), 14.0
    for x0 in (0.0, W - post_w):
        stand += tilted_box(x0, x0 + post_w, 6.0, support_h, rest_y, slab_t - 1.0, lean)
    stand += tilted_box(0.0, W, 6.0, 10.0, rest_y, slab_t - 1.0, lean)

    info = dict(url=url, version=qr.version, error=qr.error, modules=n, width=W, height=H,
                stand_depth=slab_d, brand_size=brand_size, head_size=head_size)
    parts = {"plaque": [("white", white, WHITE), ("black", black, BLACK),
                        ("gold", gold, GOLD), ("red", red, RED)],
             "stand": [("stand", stand, GOLD)]}
    return qr, parts, info


# ---------- writers ----------

def write_stl(path, tris):
    with open(path, "wb") as f:
        f.write(b"Setups.Bike display".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            f.write(struct.pack("<12fH", 0, 0, 0, *a, *b, *c, 0))


PAINT = {1: "4", 2: "8", 3: "0C", 4: "1C"}   # Bambu paint_color codes for AMS slots 1-4


def mesh_xml(tris, slot=None):
    idx, verts, out = {}, [], []
    for tri in tris:
        ids = []
        for p in tri:
            key = (round(p[0], 4), round(p[1], 4), round(p[2], 4))
            if key not in idx:
                idx[key] = len(verts)
                verts.append(key)
            ids.append(idx[key])
        if len(set(ids)) == 3:
            out.append(ids)
    v = "".join(f'<vertex x="{x}" y="{y}" z="{z}"/>' for x, y, z in verts)
    paint = f' paint_color="{PAINT[slot]}"' if slot in PAINT else ""
    t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"{paint}/>' for a, b, c in out)
    return f"<mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh>", len(out)


NS = ('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
      'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
      'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"')
IDENTITY = "1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"


def write_3mf(path, code, parts, info):
    """Bambu Studio layout (as in the 3MFs Bambu Studio ships): each object's meshes live in
    3D/Objects/object_N.model, the main model holds component objects, and
    Metadata/model_settings.config assigns each part an extruder (AMS slot). Triangles also carry
    paint_color. No "Application: BambuStudio" tag: with it, Bambu Studio expects full printer
    settings in the file and crashes without them. Checked with a load-and-save round trip
    through bambu-studio.exe --export-3mf (2026-11-21): all parts and slots survived."""
    files, rels, res, items, config = {}, [], [], [], []
    oid, y_off = 0, 10.0
    pid = 0   # mesh ids must be unique across the whole file: Bambu resolves components by id alone
    for k, (obj_name, plist) in enumerate(parts.items(), start=1):
        sub, comps, cparts = [], [], []
        for pname, tris, slot in plist:
            if not tris:
                continue
            pid += 1
            mxml, faces = mesh_xml(tris, slot)
            sub.append(f'<object id="{pid}" p:UUID="{uuid.uuid4()}" type="model">{mxml}</object>')
            comps.append(f'<component p:path="/3D/Objects/object_{k}.model" objectid="{pid}" '
                         f'p:UUID="{uuid.uuid4()}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>')
            cparts.append(f'<part id="{pid}" subtype="normal_part"><metadata key="name" value="{pname}"/>'
                          f'<metadata key="matrix" value="{IDENTITY}"/><metadata key="extruder" value="{slot}"/>'
                          f'<mesh_stat face_count="{faces}" edges_fixed="0" degenerate_facets="0" '
                          f'facets_removed="0" facets_reversed="0" backwards_edges="0"/></part>')
        files[f"3D/Objects/object_{k}.model"] = (
            f'<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" {NS}>'
            f'<metadata name="BambuStudio:3mfVersion">1</metadata><resources>{"".join(sub)}</resources><build/></model>')
        rels.append(f'<Relationship Target="/3D/Objects/object_{k}.model" Id="rel-{k}" '
                    'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>')
        oid = 100 + k
        res.append(f'<object id="{oid}" p:UUID="{uuid.uuid4()}" type="model"><components>{"".join(comps)}</components></object>')
        items.append(f'<item objectid="{oid}" p:UUID="{uuid.uuid4()}" '
                     f'transform="1 0 0 0 1 0 0 0 1 10 {y_off:.3f} 0" printable="1"/>')
        y_off += info["height"] + 10
        config.append(f'<object id="{oid}"><metadata key="name" value="{code}-{obj_name}"/>'
                      f'<metadata key="extruder" value="{plist[0][2]}"/>{"".join(cparts)}</object>')
    files["3D/3dmodel.model"] = (
        f'<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" {NS}>'
        '<metadata name="BambuStudio:3mfVersion">1</metadata>'
        f'<metadata name="Title">Setups.Bike display {code}</metadata>'
        f'<resources>{"".join(res)}</resources><build p:UUID="{uuid.uuid4()}">{"".join(items)}</build></model>')
    files["3D/_rels/3dmodel.model.rels"] = (
        '<?xml version="1.0" encoding="UTF-8"?><Relationships '
        f'xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{"".join(rels)}</Relationships>')
    files["Metadata/model_settings.config"] = f'<?xml version="1.0" encoding="UTF-8"?><config>{"".join(config)}</config>'
    files["[Content_Types].xml"] = (
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '<Default Extension="png" ContentType="image/png"/></Types>')
    files["_rels/.rels"] = (
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        '</Relationships>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)


def write_preview(path, parts, info, scale=4):
    """Top view of the plaque as a PNG: upward-facing top triangles in each part's color."""
    from PIL import ImageDraw
    W, H = info["width"], info["height"]
    im = Image.new("RGB", (int((W + 10) * scale), int((H + 10) * scale)), "#888888")
    d = ImageDraw.Draw(im)
    for _, tris, slot in sorted(parts["plaque"], key=lambda p: p[0] == "black"):  # raised text last
        for a, b, c in tris:
            if min(a[2], b[2], c[2]) >= 3.99 and a[2] == b[2] == c[2]:
                d.polygon([((q[0] + 5) * scale, (H - q[1] + 5) * scale) for q in (a, b, c)], fill=COLORS[slot])
    im.save(path)


# ---------- Bambu Studio project (opens with the printer, 4 filaments and colors set) ----------

BAMBU_EXE = os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "Bambu Studio", "bambu-studio.exe")
BAMBU_PROFILES = os.path.join(os.path.dirname(BAMBU_EXE), "resources", "profiles", "BBL")
PROCESS_FOR = {"P1S": "0.20mm Standard @BBL X1C", "P1P": "0.20mm Standard @BBL X1C",
               "X1C": "0.20mm Standard @BBL X1C", "X1E": "0.20mm Standard @BBL X1C",
               "A1": "0.20mm Standard @BBL A1", "A1M": "0.20mm Standard @BBL A1M"}


def make_bambu_project(parts_3mf, out_path, printer):
    """Let Bambu Studio's own command line turn the parts file into a real project for `printer`
    (e.g. P1S) with four filaments, then set the filament colors. A plain 3MF opened in the app is
    "not from Bambu Lab": only geometry and painted colors load, and painted slots beyond the
    project's filament count all fall back to filament 1. Returns an error string, or None."""
    import json, subprocess, tempfile
    if not os.path.exists(BAMBU_EXE):
        return "Bambu Studio not found"
    machine = os.path.join(BAMBU_PROFILES, "machine", f"Bambu Lab {printer} 0.4 nozzle.json")
    process = os.path.join(BAMBU_PROFILES, "process", PROCESS_FOR.get(printer, "0.20mm Standard @BBL X1C") + ".json")
    fil = os.path.join(BAMBU_PROFILES, "filament", f"Bambu PLA Basic @BBL {printer} 0.4 nozzle.json")
    if not os.path.exists(fil):
        fil = os.path.join(BAMBU_PROFILES, "filament", f"Bambu PLA Basic @BBL {printer}.json")
    missing = [x for x in (machine, process, fil) if not os.path.exists(x)]
    if missing:
        return "no bundled profile: " + ", ".join(os.path.basename(x) for x in missing)
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.3mf")
        r = subprocess.run([BAMBU_EXE, "--load-settings", f"{machine};{process}",
                            "--load-filaments", ";".join([fil] * 4),
                            "--export-3mf", "raw.3mf", "--outputdir", tmp, parts_3mf],
                           cwd=tmp, capture_output=True, timeout=600)
        if not os.path.exists(raw):
            return f"bambu-studio exited {r.returncode}"
        with zipfile.ZipFile(raw) as z:
            files = {n: z.read(n) for n in z.namelist()}
    ps = json.loads(files["Metadata/project_settings.config"])
    ps["filament_colour"] = [COLORS[i].upper() for i in (WHITE, BLACK, GOLD, RED)]
    if isinstance(ps.get("default_filament_colour"), list):
        ps["default_filament_colour"] = [""] * 4
    files["Metadata/project_settings.config"] = json.dumps(ps, indent=4).encode()
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            z.writestr(n, data)
    return None


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
    except Exception as e:
        return None, str(e)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("code", help="QR short code, e.g. shop-trailworks (lowercase, digits, hyphens)")
    ap.add_argument("--module", type=float, default=3.0, help="QR module size in mm (default 3.0; keep >= 3 for a 0.4 mm nozzle)")
    ap.add_argument("--error", default="m", choices="lmqh", help="QR error correction (default m; fine indoors)")
    ap.add_argument("--skip-live-check", action="store_true", help="don't check that the code redirects with tags")
    ap.add_argument("--printer", default="P1S", help="Bambu printer model for the project file (default P1S; also X1C, P1P, A1, A1M)")
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
    out = os.path.join(HERE, "out", a.code)
    os.makedirs(out, exist_ok=True)
    parts_file = os.path.join(out, f"{a.code}-parts.3mf")
    write_3mf(parts_file, a.code, parts, info)
    err = make_bambu_project(parts_file, os.path.join(out, f"{a.code}-display.3mf"), a.printer)
    stray = os.path.join(out, "result.json")       # bambu-studio's CLI writes this beside its input
    if os.path.exists(stray):
        os.remove(stray)
    if err:
        print(f"Note: couldn't make the Bambu project ({err}). Open {a.code}-parts.3mf instead and give the "
              "project four filaments (white, black, gold, red) first, or the colors collapse onto one.")
    for obj in parts.values():
        for pname, tris, _ in obj:
            if tris:
                write_stl(os.path.join(out, f"{a.code}-{pname}.stl"), tris)
    qr.save(os.path.join(out, f"{a.code}-qr.svg"), scale=10, border=4)
    write_preview(os.path.join(out, f"{a.code}-preview.png"), parts, info)
    print(f"QR version {info['version']}-{info['error']} ({info['modules']}x{info['modules']} modules, "
          f"{a.module} mm each). Plaque {info['width']:.0f} x {info['height']:.0f} mm, "
          f"stand {info['width']:.0f} x {info['stand_depth']:.0f} mm. "
          f"Text {info['brand_size']:.1f} / {info['head_size']:.1f} mm.")
    print(f"Files in {out}")


if __name__ == "__main__":
    main()
