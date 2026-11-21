# Trailhead QR sticker: draft

Board card: "Trailhead QR stickers" (Marketing). **Draft: do not print.** The QR codes in the
mockups are placeholders and don't scan.

## Layouts (4 × 4 in, 100 SVG units = 1 in)

**Chosen direction (2026-11-20): gold layout with the red draft's text.** Gold is mostly
yellow ink with little magenta, and magenta is the ink that fades fastest in sun, so a gold
background fades less than a full red one. It still needs a UV laminate.

| File | Look | Headline |
|---|---|---|
| [sticker-a-gold-DRAFT.svg](sticker-a-gold-DRAFT.svg) | **Chosen.** Gold, like the app header and link preview; small red logo tile | "Dialed it in? Save it." |
| [sticker-b-red-DRAFT.svg](sticker-b-red-DRAFT.svg) | Earlier option: red with white text, gold footer with the name | "Dialed it in? Save it." |

Both have the logo, the "We remember the clicks" line (already on the link preview image),
what the app saves, "Free. No card." and a QR code on a white panel. The dashed line is the
0.125 in safe margin. Keep all text inside it.

## Headline options (pick one, or mix and match)

1. **Forgot your rebound clicks?** Names the pain. Most riders have had this happen.
2. **Dialed it in? Save it.** Short and active. Reads from farthest away.
3. **What PSI was that?** Tire pressure, which every rider has, not only full-suspension riders.
4. **We remember the clicks.** The existing brand line as the headline.
5. **Your settings, saved for every bike.** Plain and safe, but less fun.
6. **Pump. Click. Saved.** Punchy, but it says less.

Copy rule: it must never sound like the app recommends settings. All of the above talk about
*your* settings.

## QR code

- **Encodes a permanent short link: `https://setups.bike/q/trailhead`** (decided 2026-11-20).
  A Cloudflare redirect sends it to `https://setups.bike/?utm_source=sticker&utm_campaign=trailhead`.
  If the destination ever changes, only the redirect changes, and stickers already out keep
  working. Never reuse a code for something else. Shops get `/q/shop-<name>`. Dev card:
  "QR short links: /q/<code> redirects". The QR code won't work until that ships.
- The real QR code is in the gold layout. There's also a standalone vector file,
  [qr-trailhead.svg](qr-trailhead.svg), for the printer. Version 3 (29 × 29 modules), error
  correction Q (about 25% can be damaged), dark on white with a 4-module quiet zone, about
  1.22 in square. Generated with `segno`.
- Screen scan checked 2026-11-20: decodes to the right URL (it shows a 404 until the redirect
  ships). Still to do: a paper proof scanned on iPhone and Android.
- The red layout still has a placeholder.
- Print a proof on paper first and scan it with an iPhone and an Android at arm's length, in
  sun and in shade.
- Don't print until the Dev cards "Basic analytics" and "Signup source tracking" ship, so
  the first scans are counted.

## Print specs to ask for

- 4 × 4 in die-cut, rounded corners, **outdoor vinyl with UV/matte laminate**. Red fades
  fastest in sun, and laminate also helps against scratches and wet weather.
- Small first run (50-100). Get quotes from two printers and compare.
- Export text to outlines (or a PDF with fonts embedded). The mockups use Segoe UI from the
  system font stack.
- Most printers add bleed in their own template. Extend the background 0.125 in if asked.

## Where they go

Only where stickers are allowed: ask the land manager or trail org before using kiosks, and
use bulletin boards with permission.
