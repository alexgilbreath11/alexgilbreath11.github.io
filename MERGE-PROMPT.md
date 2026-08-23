# Claude Code prompt — unify my two portfolio scenes into one consistent look

Paste everything below into Claude Code, from inside the `portfolio/` folder that
`build-portfolio.sh` created.

---

I have a portfolio folder with two separate interactive 3D scenes that I want to
look like one consistent site. Do NOT change any content — this is a pure restyle
+ wiring job.

## What's in this folder
- `index.html` — a themed hub page (already done, this is the target look)
- `theme.css` — the shared palette. **This is the single source of truth.**
- `spine/Spine.dc.html` — a scrolling interactive spine. Currently **light + gold**.
- `brain/brain-portfolio.dc.html` — a 3D brain. Currently **dark + blue**. This is
  the reference look; the spine should be made to match it.
- `RESTYLE-MAP.txt` — a scan of every hard-coded colour in both scenes, with line
  numbers. Read it first.
- Both scenes share an identical `_ds/` design system, `support.js`, and
  `image-slot.js`, and both use the Barlow / Barlow Condensed fonts — so the type
  and components already match. The only mismatch is the **theme (colour + light/dark)**.

## The one decision — leave as-is unless I say otherwise
Target theme = **dark + blue accent `#5980a6`** (match the brain). If I instead
tell you "make it light," flip the direction: keep the spine's light look and
restyle the brain to match it, using the same steps in reverse.

## Hard constraints — do not break these
- **Do not change any words, copy, headings, project descriptions, names, dates,
  captions, or links.** ("Alexander Gilbreath", the LinkedIn URL, project text,
  etc. all stay exactly as written.)
- **Do not touch any image, `uploads/`, `assets/`, `.image-slots.state.json`, or
  `.thumbnail` file.**
- **Do not change the 3D geometry, the Three.js logic, `brain-stage.js`, the spine's
  embedded model code, the interactions (hover/click/scroll), or the `x-dc`
  component logic / props behaviour.** Only colours, backgrounds, borders, and the
  small nav strip change.
- Keep each scene on its own page. Don't try to merge them onto one scroll page —
  they're both full-viewport interactive canvases and would fight each other.
- Work on copies-in-place; don't rename files. Test after each file.

## Tasks

### 1. Wire the shared theme into both scenes
In **both** `.dc.html` files, inside the `<helmet>` block (right after the existing
`styles.css` link), add:
```html
<link rel="stylesheet" href="../theme.css">
```
This retargets the design-system variables (`--color-bg`, `--color-text`,
`--color-accent`) to the portfolio palette for anything that already uses those
variables.

### 2. Restyle the spine to the dark theme
`theme.css` only fixes the *variable*-driven styles. The spine also has **literal
hex colours** in inline styles that must be changed in place. Use `RESTYLE-MAP.txt`
for the exact lines. Specifically, in `spine/Spine.dc.html`:

- **Gold UI accent → portfolio accent.** Replace the gold used for *UI chrome*
  (cue pills, nav dot, section underlines, hover tips, glow/ring animations) —
  `#d9a833`, and its tints `#f0c04a`, `#c8901f`, `#e8b95c`, `#8a6412` — with the
  shared accent `#5980a6` (and `var(--color-accent)` where a variable reads cleaner).
  The gold `@keyframes cueGlow` / `cueRing` rgba values (`rgba(217,168,51,…)`)
  should become the accent's rgb `rgba(89,128,166,…)`.
- **Light surfaces → dark.** The light panel/nav backgrounds and warm "bone" tones
  (`#e7ddc8`, `#d8c39a`, `#efe7d6`, `#dcc7a6`, `#f3ede1`, `#e8b95c`) and the light
  page background should move to the dark palette (`#0b0e11` bg, `#14202b` surface,
  `#e9eef3` text) so the spine reads on a dark ground like the brain. Prefer the
  `--pf-*` / `--color-*` variables where possible.
- **IMPORTANT — keep the region/status colours as meaning, not decoration.** The
  spine uses `#a8422f` (red), `#4d7a52` (green), and gold-as-yellow to signal
  severity / spinal region (e.g. "Minor", "Yellow → pre-alert"). These are a
  legend, not the UI accent. **Keep red and green as-is.** For the yellow status
  swatch, keep a yellow (`#e8b95c` is fine) so the legend still has 3 distinct
  signal colours — only the gold used as *interface accent* becomes blue. If you're
  unsure whether a given gold is "accent" or "status," leave a `TODO:` comment
  rather than guessing.
- The `data-props` block near line 407 defines the editable colour options
  (`spineColor`, `goldColor`). Update its defaults/options to the new palette so the
  in-editor controls stay consistent, but don't change the prop *names* or types.

### 3. Add the shared top nav to both scenes
So the two scenes feel like one portfolio, add this bar as the first element inside
`<body>` (or inside the top-level wrapper) of **each** `.dc.html`, adjusting
`aria-current` per page:
```html
<div class="pf-bar">
  <a class="pf-home" href="../index.html">GILBREATH<b>.</b></a>
  <a href="../index.html">Home</a>
  <a href="../spine/Spine.dc.html">Spine</a>
  <a href="../brain/brain-portfolio.dc.html">Brain</a>
</div>
```
The spine already has its own `VERTEBRA.` nav and the brain has its own header —
keep those, but make sure they don't visually clash with the shared bar (nudge
their top offset down by ~44px if they overlap, or fold the shared links into the
existing nav instead — your call, whichever looks cleaner). The point is: from
either scene I can get Home / Spine / Brain.

### 4. Verify
- Start a local server: `python3 -m http.server 8000` and open
  `http://localhost:8000/`.
- Check the hub, then click into **both** scenes.
- Confirm for each: the 3D still renders and rotates, hover/click/scroll still
  work, every image still loads, all text is unchanged, and the colours now match
  (dark ground, blue accent, red/green/yellow legend still readable).
- Show me a short diff summary of what you changed per file. If anything about a
  colour's role was ambiguous, list it so I can confirm.

Start by reading `RESTYLE-MAP.txt`, `theme.css`, and the two `.dc.html` files, then
make the edits file by file.
