# Traces the white artwork of public/img/logos/Setups.png (1200px: mark, "Setups.Bike", tagline)
# into one SVG on a transparent background, in the same 350x350 frame as Setups-350.
# The tagline is enlarged (TAG_SCALE, 1.4 since 2026-11-24) so it reads at header size; its letters
# stay the logo's own, just bigger, and still smaller than "Setups.Bike".
# The lettering ("Setups.Bike" and the tagline) is traced with straight segments and its real corners
# (no smoothing, which made it look like a bubble font), and thickened by BOLD source pixels; the
# mark above keeps its smoothed curves.
# Needs opencv-python-headless and numpy (pip install into a throwaway venv).
# Usage: python scripts/trace-logo.py public/img/logos/Setups.png public/img/logos/setups-logo.svg 0.8 1.4 2 1
import sys, cv2, numpy as np

src, out = sys.argv[1], sys.argv[2]
eps = float(sys.argv[3]) if len(sys.argv) > 3 else 0.8
TAG_SCALE = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
BOLD = int(sys.argv[5]) if len(sys.argv) > 5 else 0   # extra stroke thickness for "Setups.Bike", in source px
BOLD_TAG = int(sys.argv[6]) if len(sys.argv) > 6 else BOLD // 2   # and for the tagline (thin strokes thicken faster)
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
alpha = im[:, :, 3]
# white artwork = opaque and light
light = (im[:, :, :3].min(axis=2) > 128) & (alpha > 128)
binary = cv2.GaussianBlur(light.astype(np.uint8) * 255, (3, 3), 0) > 127
scale = 350 / im.shape[1]

f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
TEXT_TOP = int(230 / scale)   # the lettering starts below this row of the source (230 in the 350 frame)

def trace(mask, smooth):
    out = []
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    for c in contours:
        if cv2.contourArea(c) < 20:
            continue
        pts = c[:, 0, :].astype(np.float32)
        if smooth:
            for _ in range(2):  # Chaikin smoothing
                q = np.roll(pts, -1, axis=0)
                pts = np.stack([0.75 * pts + 0.25 * q, 0.25 * pts + 0.75 * q], axis=1).reshape(-1, 2)
        pts = cv2.approxPolyDP(pts.reshape(-1, 1, 2), eps, True)[:, 0, :] * scale
        if len(pts) < 3:
            continue
        if smooth:  # curves through the midpoints
            mids = (pts + np.roll(pts, -1, axis=0)) / 2
            seg = [f'M{f(mids[-1][0])} {f(mids[-1][1])}']
            seg += [f'Q{f(px)} {f(py)} {f(mx)} {f(my)}' for (px, py), (mx, my) in zip(pts, mids)]
        else:       # straight segments, corners kept
            seg = [f'M{f(pts[0][0])} {f(pts[0][1])}'] + [f'L{f(x)} {f(y)}' for x, y in pts[1:]]
        out.append((pts[:, 1].min(), ''.join(seg) + 'Z'))
    return out

mark = binary.copy(); mark[TEXT_TOP:] = False
text = binary.copy(); text[:TEXT_TOP] = False
TAG_TOP = int(276 / scale)   # the tagline starts below this row of the source
def thicken(m, px):
    return cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))) > 0 if px else m
name_m = text.copy(); name_m[TAG_TOP:] = False
tag_m = text.copy(); tag_m[:TAG_TOP] = False
text = thicken(name_m, BOLD) | thicken(tag_m, BOLD_TAG)
parts = [d for _, d in trace(mark, True)]
tag = []
for top, d in trace(text, False):
    # the tagline is the bottom line of lettering (below y=276 in the 350 frame)
    (tag if top > 276 else parts).append(d)

# enlarge the tagline about its own centre line, then move it down so it clears the name
cx, cy = 175, 285
dy = (TAG_SCALE - 1) * 9
g = (f'<path fill="#fff" fill-rule="evenodd" transform="translate({cx} {cy + dy:.1f}) scale({TAG_SCALE}) translate({-cx} {-cy})" d="{"".join(tag)}"/>'
     if TAG_SCALE != 1 else f'<path fill="#fff" fill-rule="evenodd" d="{"".join(tag)}"/>')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 350" role="img" aria-label="Setups.Bike">'
       '<title>Setups.Bike: We remember the clicks</title>'
       f'<path fill="#fff" fill-rule="evenodd" d="{"".join(parts)}"/>{g}</svg>\n')
open(out, 'w').write(svg)
print('bytes', len(svg), 'shapes', len(parts), 'tagline shapes', len(tag))
