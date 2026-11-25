# Shop displays: 3D-printed, one per shop

Board card: "Shop display + comped Pro pilot" (Marketing). Each shop gets its own QR short code
(`/q/shop-<name>`). Instead of a small sticker run per shop, the whole display is printed on
the Bambu with an AMS, QR code included.

## What you get

`make_shop_display.py` makes, for one code:

- **Plaque**, about 123 × 160 mm × 4 mm, printed flat, face up:
  - The QR code inlaid black on white (flat, no shadows), with a gold frame.
  - A gold band with a 32 mm red logo tile on the left (inlaid). The white mark is traced from
    `public/logo512.png` and raised 0.6 mm, with strokes about 1.4 mm wide. To its right,
    raised black text, left-aligned: "Setups.Bike" in the logo's own traced lettering (from
    `public/img/logos/setups-logo.svg`, about 15.5 mm tall, the same as the app; re-run after
    any logo change, last 2026-11-25 for the sharper, bolder lettering), with "Dialed it in? Save it."
    (8.1 mm, Segoe UI Bold) under it.
- **Stand**, 123 × 55 mm, in gold: a base slab, a front lip, and two posts plus a brace leaning
  back 15°. The plaque slides in behind the lip and rests on the posts with about 0.8 mm
  clearance.
- `<code>-display.3mf`: a real Bambu Studio project for your **P1S** (`--printer X1C`, `A1`
  and so on for others), with four filaments already colored white, black, gold and red, and
  every part on its slot. Also `<code>-parts.3mf` (plain 3MF, fallback), one STL per color, the
  QR code alone as SVG, and `<code>-preview.png` (top view).

| AMS slot | Filament | Used for |
|---|---|---|
| 1 | White (matte) | Plaque body, light QR modules, logo mark |
| 2 | Black (matte) | Dark QR modules, text |
| 3 | Gold / yellow | Frame, band, stand |
| 4 | Red | Logo tile |

Matte filament matters: glossy PLA reflects shop lights and can stop the code scanning.

## Steps for a new shop

1. **The code must be live first.** Move the Dev card "Add a shop QR code (per shop, on
   request)" so the dev session adds `shop-<name>`. Short names help (`shop-tw` makes a less
   dense code than `shop-trailworks`).
2. Generate the files, from the setups.bike folder:

   ```powershell
   Set-Location C:\Users\grant\Documents\Professional\setups.bike; python docs/marketing/displays/make_shop_display.py shop-<name>
   ```

   The script checks that the code redirects with tracking tags and warns if it doesn't. Each
   check counts as one scan in the KV counts. Options: `--module 3.2` (bigger modules),
   `--error q` (more damage tolerance; default `m` is fine indoors).
   Needs: `pip install --user segno fonttools mapbox-earcut pillow`.
3. Open `docs/marketing/displays/out/shop-<name>/shop-<name>-display.3mf` in Bambu Studio (Open Project).
   It opens as a project with the four colors in the filament list. Load matching filament
   into AMS slots 1-4, or remap them in the filament list.
4. Print. Then scan the printed plaque with an iPhone and an Android under the shop's lighting
   before leaving it there.

## How the file was checked (2026-11-21)

- A plain 3MF opened in the Bambu Studio app is "not from Bambu Lab": it loads geometry and
  painted colors only, and painted slots beyond the project's filament count all fall back to
  filament 1. The first test came out all yellow because the project had one yellow filament.
- So the script writes the parts file (meshes in `3D/Objects/`, file-unique mesh IDs, slots
  in `model_settings.config`, plus paint codes), then has `bambu-studio.exe` itself turn it
  into a project with your printer's bundled profiles and four filaments, and sets their
  colors. A hand-written Bambu project header without full printer settings crashes Bambu, which
  is why Bambu's own command line builds that part.
- Checked by reloading through the command line: P1S printer, colors `#F4F4F4 / #1C1C1C /
  #DAA520 / #FF0000`, and parts on slots 1-4 all survive. The command line can't render
  filament colors, so the colors on screen still need a look in the app.
- **Not checked yet:** a real print. Things to watch on the first one (try `trailhead`, which is
  live): the stand's fit, how well the inlaid QR scans, and the raised logo mark's finest
  details.
- Text and logo meshes are checked as closed solids (every edge shared by exactly two
  triangles). The logo needed a T-junction repair after triangulation, and the script does it.
