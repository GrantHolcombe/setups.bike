"""Builds the app icons, favicon and link-preview image from public/img/logos/Setups.png.

Run from the repo root:  python scripts/make-icons.py   (needs Pillow: pip install pillow)
Re-run it after changing the logo, colors or tagline below, then commit the files in public/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
LOGO = PUBLIC / "img" / "logos" / "Setups.png"

RED = (255, 0, 0)          # the logo tile in the header
GOLD = (218, 165, 32)      # header bar ("goldenrod", #daa520)
INK = (28, 28, 28)         # dark text on gold
TITLE = "Setups.Bike"
TAGLINE = "Tire pressure and suspension\nsettings, saved for every bike."
FONT_DIR = Path("C:/Windows/Fonts")


def white(img):
    """The logo's light-grey line art, recolored pure white (keeps the alpha)."""
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(img.split()[3])
    return out


logo = white(Image.open(LOGO).convert("RGBA"))
glyph = logo.crop(logo.split()[3].crop((0, 0, 1200, 760)).getbbox())  # cloud + pump, no text
full = logo.crop(logo.split()[3].getbbox())                            # with the wordmark


def tile(size, art, fill, radius=0, bg=None):
    """A square of `fill` color with `art` centered at `fill` fraction of the width."""
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    shape = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shape).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    canvas.paste(Image.new("RGBA", (size, size), RED + (255,)), (0, 0), shape)
    scale = size * fill / max(art.size)
    a = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
    return canvas


def save(img, name):
    path = PUBLIC / name
    img.save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), img.size)


# Home-screen / install icons. Square and full-bleed: Android and iOS apply their own mask.
save(tile(192, glyph, 0.72), "logo192.png")
save(tile(512, glyph, 0.72), "logo512.png")
# Maskable: the art stays inside the central 80% "safe zone" circle.
save(tile(512, glyph, 0.56), "maskable512.png")
# iOS home screen (it rounds the corners itself and shows black behind transparency).
save(tile(180, glyph, 0.72).convert("RGB"), "apple-touch-icon.png")
# Browser tab icon: rounded red tile.
fav = tile(256, glyph, 0.8, radius=48)
fav.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("wrote public/favicon.ico")

# Link preview (Open Graph / Twitter card), 1200x630: gold like the header, the red logo
# tile on the left, the name and a tagline on the right.
W, H = 1200, 630
og = Image.new("RGBA", (W, H), GOLD + (255,))
SIDE = 400
TOP = (H - SIDE) // 2
logo_tile = tile(SIDE, full, 0.82, radius=36)
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((80, TOP + 8, 80 + SIDE, TOP + 8 + SIDE), radius=36, fill=(0, 0, 0, 60))
og.alpha_composite(shadow)
og.alpha_composite(logo_tile, (80, TOP))
d = ImageDraw.Draw(og)
x, right = 540, W - 60


def fit(text, file, size):
    """Largest font size (up to `size`) at which every line fits between x and the right margin."""
    while True:
        f = ImageFont.truetype(str(FONT_DIR / file), size)
        if max(d.textlength(line, font=f) for line in text.split("\n")) <= right - x:
            return f
        size -= 2


title_font = fit(TITLE, "segoeuib.ttf", 88)
tag_font = fit(TAGLINE, "segoeui.ttf", 40)
d.text((x, 175), TITLE, font=title_font, fill=INK)
d.multiline_text((x, 300), TAGLINE, font=tag_font, fill=INK, spacing=14)
d.text((x, 430), "setups.bike", font=tag_font, fill=(90, 62, 0))
save(og.convert("RGB"), "og-image.png")

# Header logo at 2x its 175px display size (the 1200px original was the page's slowest image).
# Same light-grey line art on transparent; the red tile comes from CSS.
src = Image.open(LOGO).convert("RGBA")
for fmt, ext, opts in [("PNG", "png", {"optimize": True}), ("WEBP", "webp", {"quality": 90, "method": 6})]:
    out = src.resize((350, 350), Image.LANCZOS)
    path = PUBLIC / "img" / "logos" / f"Setups-350.{ext}"
    out.save(path, fmt, **opts)
    print("wrote", path.relative_to(ROOT), out.size, f"{path.stat().st_size // 1024} KB")
