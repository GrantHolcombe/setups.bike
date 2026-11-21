# Setups.Bike style guide

How the app looks and behaves, so new screens match the existing ones. React + MUI v5, with
color tokens in [`src/index.css`](../src/index.css) and the MUI theme in
[`src/App.tsx`](../src/App.tsx) (`makeTheme`). When you add a new pattern, add it here.

## Principles

- **Plain and readable first.** Every text color meets 4.5:1 contrast (3:1 for icons and large
  text) in both light and dark mode.
- **Follows the system theme.** Light and dark come from `prefers-color-scheme`; never hard-code
  a background or text color: use the tokens below.
- **Friendly voice, clear labels.** Playful copy ("Add a steed to the stable!") is welcome in
  descriptions; titles and buttons say exactly what happens.
- **Works by keyboard and screen reader.** Real buttons (or `role="button"` with a label and
  Enter/Space), labelled icon buttons, real lists for steps.

## Color

| Token / value | Light | Dark | Use for |
|---|---|---|---|
| `--bg` | `#ffffff` | `#121212` | Page background |
| `--surface` | `#ffffff` | `#1e1e1e` | Cards (dialogs use MUI's paper, which matches) |
| `--text` | `#1c1c1c` | `#ececec` | Body text |
| `--text-muted` | `#5f5f5f` | `#b0b0b0` | Secondary text, captions, footer |
| `--border` | `#cdcdcd` | `#4a4a4a` | Card borders, input underlines, dividers between sections |
| `--divider` | `#eeeeee` | `#333333` | Light separators inside lists |
| `--gold-text` | `#8a6514` | `#daa530` | Gold used as **text, outlines or icons** |
| `--ink` | `#1c1c1c` | `#1c1c1c` | Text on gold (always dark) |
| Brand gold fill | `#daa530` | `#daa530` | `primary` buttons and selected chips (MUI `primary.main`) |
| Header gold | `goldenrod` `#daa520` | same | Header bar, browser theme color, splash |
| Logo red | `#ff0000` | same | Logo tile and menu button only |
| Error red | MUI `error` | MUI `error` | Destructive buttons, failed saves (`#d32f2f` light, `#ff6b6b` dark outline) |
| Spinner green | `#4fa94d` | same | The loading spinner only |

Rules:
- Gold **fills** always get dark text (`--ink`, 7.6:1). Never white on gold (2.2:1).
- Gold **text** always uses `--gold-text`, which the theme applies to text/outlined `primary`
  buttons, outlined chips and focused inputs automatically.
- Don't use MUI `secondary` (pure red) for actions; use `error` for destructive ones.

## Type

- System font stack (see `body` in `index.css`); MUI typography variants on top.
- Dialog titles: `DialogTitle` (h6). Body text in dialogs: `body2`. Captions: `caption`.
- Bike cards: `.modelHeader` (model, small) above `.brandHeader` (brand, 2rem).
- MUI buttons are uppercase by default; leave that as is for consistency.

## Spacing and layout

- MUI's 8 px grid: `sx={{ mb: 2 }}` = 16 px. Prefer `sx` spacing over pixel values.
- Cards are max 360 px wide in an auto-fit grid; dialogs are `maxWidth="xs"` (`"sm"` for lists).
- Everything must work at phone width (360 px and up) with no sideways scrolling.
- The page is locked on mobile (`src/index.css`): `touch-action: pan-y` allows vertical scrolling
  only (no pinch or double-tap zoom, no sideways drag), with horizontal overflow clipped and no
  sideways bounce. Keep inputs at 16 px or larger, or iOS zooms in when one is focused.

## Dialogs (the one modal pattern)

Every modal is an MUI `Dialog`. Don't use `Modal` with a hand-positioned `Box`.

```tsx
<Dialog open={open} onClose={busy ? undefined : onClose} maxWidth='xs' fullWidth>
  <DialogTitle>Add a bike</DialogTitle>
  <DialogContent>
    <Typography variant='body2' sx={{ mb: 2, color: 'text.secondary' }}>
      One short line on what this does (playful copy is fine here).
    </Typography>
    {/* fields, lists, an <Alert severity='error'> for errors */}
  </DialogContent>
  <DialogActions>
    <Button color='inherit' onClick={onClose}>Cancel</Button>
    <Button variant='contained' disabled={!valid || busy} onClick={submit}>
      {busy ? 'Saving…' : 'Save'}
    </Button>
  </DialogActions>
</Dialog>
```

- **Title:** what the dialog does, sentence case, no exclamation marks ("Rename setup",
  "Retire bikes").
- **Description:** optional `body2` / `text.secondary` line under the title.
- **Actions** (right-aligned, in this order):
  - Cancel / Close: text button, `color='inherit'`.
  - Main action: `variant='contained'` (gold, dark text).
  - Destructive main action: `variant='contained' color='error'` ("Delete", "Remove 2 bikes").
  - An info-only dialog has a single text button ("Got it", "Done").
- **Disabled main action** when the form isn't valid; explain with helper text, not a tooltip.
- **Enter** submits single-field forms; the first field gets `autoFocus`.
- **Closing:** Escape and clicking outside close the dialog, except while it's saving.
- **Errors** show inside the dialog as an `Alert`; the dialog stays open so nothing is lost.
- **Confirmations** for destructive actions are a small dialog with the consequence spelled out
  ("This removes the ride note. It can't be undone.").
- **Steps** are a real `<ol>` with inline icons; no trailing periods on short steps.

## Buttons and icons

- Icons: MUI icons (`@mui/icons-material`), outlined style where there's a choice.
- Icon-only buttons are `IconButton` with an `aria-label` ("Move Trance up", "Ride actions").
- Small card actions (Log ride, Rides, Share) are `size='small'` text buttons with a start icon
  and `textTransform: 'none'`.

## Inputs

- Bike settings use `SettingInput` (digits only, 0–99999, clears a 0 on focus, restores on blur).
- Dialog fields use `TextField variant='standard'`, with `inputProps={{ maxLength }}` matching the
  database column.
- Selections with a few fixed options are chips (ride conditions), not dropdowns.

## Feedback

| Situation | Pattern |
|---|---|
| Blocking work (switching setups, loading the garage) | `LoadingOverlay` (green radio spinner on a dimmed screen) |
| Loading inside a dialog | `<Spinner />` centered in the content |
| Background saves on a card | Small "Saving… / Saved / Couldn't save · Retry" note by the bike name; "Saved" clears after 2 s |
| A field that failed to save | Red outline (`.saveFailed`) until a save succeeds |
| App-level news (checkout done, copied a setup) | `Snackbar` with a filled `Alert` at the bottom center |
| New version deployed | Snackbar "A new version of Setups.Bike is ready" with a Reload button |
| Offline | Info `Alert` banner under the header |

## Cards

- `.cardContainer`: `--surface` background, `--border` border, 8 px radius, shadow.
- Pro actions sit under the setup picker; settings are grouped front/rear.
- Front and rear columns use the same markup, so their rows line up: pressure, then Compression
  and Rebound, each title with its cog beside it, then one `.adjusterRow` with the low/high-speed
  adjusters side by side and right-aligned (small muted LSC/HSC label, then the value), so the last
  value lines up with the Fork/Shock value above. No row when the adjuster is set to None. The
  token counter sits at the bottom of the column. Columns have `min-width: 0`; check a 360 px-wide
  phone (and iPhone, whose fonts run wider) when changing this row.
- Dropdown menus (`Menu`/`Popover`) don't lock page scrolling (theme default in `App.tsx`): the
  lock made iPhone Safari jump to the top while a menu was open.
- Read-only settings (ride notes, shared setups) use `SettingsSummary`.
