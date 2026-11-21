# Shop displays: 3D-printed, one per shop

Board card: "Shop display + comped Pro pilot" (Marketing). Each shop gets its own QR short code
(`/q/shop-<name>`). Instead of a small sticker run per shop, the whole display is printed on
the Bambu with an AMS, QR code included.

## What you get

`make_shop_display.py` makes, for one code:

- **Plaque**, about 123 × 163 mm × 4 mm, printed flat, QR face up. The top 0.6 mm is the color
  layer: QR modules inlaid in black on white (flat face, no shadows), a gold frame, and a gold
  band at the top for text.
- **Stand**, 123 × 55 mm: base slab, front lip, and two posts plus a brace leaning back 15°.
  The plaque slides in behind the lip and rests on the posts with about 0.8 mm clearance.
- A `.3mf` with both, parts already assigned to AMS slots, plus one STL per color (fallback) and
  the QR code alone as SVG (for a phone check before printing).

| AMS slot | Filament | Used for |
|---|---|---|
| 1 | White (matte) | Plaque body, light QR modules, quiet zone |
| 2 | Black (matte) | Dark QR modules |
| 3 | Gold / yellow | Frame, top band, stand |
| 4 | Red | Text you add (optional) |

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
3. Open `docs/marketing/displays/out/shop-<name>/shop-<name>-display.3mf` in Bambu Studio. Check the
   parts show white / black / gold. If they don't, assign them in the Objects list (part names
   say which is which).
4. **Add the text** on the gold band with Bambu Studio's Text tool (right-click the plaque >
   Add part > Text), embossed about 0.6 mm in red or black. Suggested: "Setups.Bike" large, then
   "Dialed it in? Save it." Big and bold reads best; small body text prints poorly.
5. Print. Then scan the printed plaque with an iPhone and an Android under the shop's lighting
   before leaving it there.

## Not checked yet

- The `.3mf` color assignments follow Bambu Studio's project format, but haven't been opened in
  Bambu Studio yet. If the colors don't come through, the per-color STLs always work: select all
  of them, import, choose "load as a single object with multiple parts", and assign filaments.
- Nothing has been printed yet. The stand's fit and the inlay's scan quality need a first test
  print (try `trailhead`, which is live).
