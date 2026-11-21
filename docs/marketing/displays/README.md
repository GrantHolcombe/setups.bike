# Shop displays: 3D-printed, one per shop

Board card: "Shop display + comped Pro pilot" (Marketing). Each shop gets its own QR short code
(`/q/shop-<name>`). Instead of a small sticker run per shop, the whole display is printed on
the Bambu with an AMS, QR code included.

## What you get

`make_shop_display.py` makes, for one code:

- **Plaque**, about 123 × 163 mm × 4 mm, printed flat, face up:
  - The QR code inlaid black on white (flat, no shadows), with a gold frame.
  - A gold band with the red logo tile (white mark, inlaid) and **raised** black text (0.6 mm):
    "Setups.Bike" (14 mm) and "Dialed it in? Save it." (9 mm), set in Segoe UI Bold.
- **Stand**, 123 × 55 mm, in gold: a base slab, a front lip, and two posts plus a brace leaning
  back 15°. The plaque slides in behind the lip and rests on the posts with about 0.8 mm
  clearance.
- `<code>-display.3mf`: both objects on one plate, every part already assigned to its AMS slot.
  Also one STL per color (fallback), the QR code alone as SVG, and `<code>-preview.png` (top
  view).

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
3. Open `docs/marketing/displays/out/shop-<name>/shop-<name>-display.3mf` in Bambu Studio. Load white,
   black, gold and red into AMS slots 1-4 (or remap the slots in Bambu's filament list).
4. Print. Then scan the printed plaque with an iPhone and an Android under the shop's lighting
   before leaving it there.

## How the file was checked (2026-11-21)

- Bambu Studio only keeps part colors from a 3MF laid out like its own projects. Meshes go in
  `3D/Objects/`, every mesh ID is unique across the file, and slots are set in
  `Metadata/model_settings.config`. The file also has no "Application: BambuStudio" tag:
  with that tag, Bambu expects full printer settings inside the file and crashes without them.
- Checked by loading and re-saving it with `bambu-studio.exe --export-3mf`. Both objects
  survived intact, with every slot as above, and Bambu's own render showed the text, stand and
  plaque correctly.
- **Not checked yet:** a real print. Things to watch on the first one (try `trailhead`, which is
  live): the stand's fit, how well the inlaid QR scans, and the logo mark. It's sampled to
  0.55 mm cells on a 24 mm tile, so it's the lowest-detail part of the display.
