#!/usr/bin/env bash
#
# build-portfolio.sh
# -----------------------------------------------------------------------------
# Assembles your two interactive artifacts (the scrolling spine + the 3D brain)
# into ONE portfolio folder, without changing any of your content.
#
# It does the safe, deterministic part of the job:
#   1. Copies both projects (including hidden state files) into portfolio/
#   2. Generates a shared theme.css  = the single source of truth for the look
#   3. Generates a themed index.html = a hub page that links into both scenes
#   4. Generates RESTYLE-MAP.txt     = every literal colour that the Claude Code
#                                      step needs to unify, with file + line
#
# It does NOT rewrite the colours inside your two scenes — that needs judgement,
# so it's handled by MERGE-PROMPT.md in Claude Code. This script just gives that
# step a clean, working starting point.
#
# Usage:
#   ./build-portfolio.sh                 # auto-detects the two folders or zips
#   ./build-portfolio.sh --spine PATH --brain PATH
#   ./build-portfolio.sh --force         # overwrite an existing portfolio/
#
# Nothing here is destructive to your originals — everything is copied.
# -----------------------------------------------------------------------------
set -euo pipefail

SPINE_SRC=""
BRAIN_SRC=""
FORCE=0
OUT="portfolio"

# ----- pick the theme direction here (dark = match the brain, light = match the spine)
THEME="dark"          # "dark" or "light"
ACCENT="#5980a6"      # shared accent used across the whole portfolio

# ---------------------------------------------------------------- arg parsing
while [ $# -gt 0 ]; do
  case "$1" in
    --spine) SPINE_SRC="$2"; shift 2;;
    --brain) BRAIN_SRC="$2"; shift 2;;
    --out)   OUT="$2"; shift 2;;
    --theme) THEME="$2"; shift 2;;
    --force) FORCE=1; shift;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown option: $1" >&2; exit 1;;
  esac
done

say() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------- locate sources
# Accept a folder, or a .zip we can unpack. Auto-detect the common names.
resolve() {
  # $1 = candidate folder, $2 = candidate zip, $3 = label
  local dir="$1" zip="$2" label="$3"
  if [ -n "$dir" ] && [ -d "$dir" ]; then echo "$dir"; return; fi
  for d in "$dir" ./"$label"* ; do
    [ -d "$d" ] && { echo "$d"; return; }
  done
  for z in "$zip" ./"$label"*.zip ; do
    if [ -f "$z" ]; then
      local unz=".unz_${label}"
      rm -rf "$unz"; mkdir -p "$unz"
      unzip -o -q "$z" -d "$unz"
      # descend into a single wrapper folder if the zip nested one
      local inner; inner="$(find "$unz" -maxdepth 2 -name '*.dc.html' -print -quit)"
      [ -n "$inner" ] && { dirname "$inner"; return; }
    fi
  done
  echo ""
}

say "Locating your two projects…"
SPINE_SRC="$(resolve "$SPINE_SRC" "" "Interactive_scrolling_spine")"
BRAIN_SRC="$(resolve "$BRAIN_SRC" "" "Interactive_3D_brain")"

[ -n "$SPINE_SRC" ] || { echo "Could not find the spine project. Pass it with --spine PATH" >&2; exit 1; }
[ -n "$BRAIN_SRC" ] || { echo "Could not find the brain project. Pass it with --brain PATH" >&2; exit 1; }
ok "spine: $SPINE_SRC"
ok "brain: $BRAIN_SRC"

# ---------------------------------------------------------------- output guard
if [ -e "$OUT" ]; then
  if [ "$FORCE" = "1" ]; then rm -rf "$OUT"; else
    echo "'$OUT/' already exists. Re-run with --force to rebuild it." >&2; exit 1
  fi
fi
mkdir -p "$OUT/spine" "$OUT/brain"

# ---------------------------------------------------------------- copy (incl. dotfiles)
say "Copying projects (content untouched, hidden state files included)…"
cp -a "$SPINE_SRC/." "$OUT/spine/"
cp -a "$BRAIN_SRC/." "$OUT/brain/"
ok "copied spine  → $OUT/spine/"
ok "copied brain  → $OUT/brain/"

# entry files (the brain's has a space; give it a URL-safe name — the only rename)
SPINE_HTML="$(cd "$OUT/spine" && ls *.dc.html | head -1)"
BRAIN_HTML_ORIG="$(cd "$OUT/brain" && ls *.dc.html | head -1)"
BRAIN_HTML="brain-portfolio.dc.html"
if [ "$BRAIN_HTML_ORIG" != "$BRAIN_HTML" ]; then
  mv "$OUT/brain/$BRAIN_HTML_ORIG" "$OUT/brain/$BRAIN_HTML"
  warn "renamed \"$BRAIN_HTML_ORIG\" → \"$BRAIN_HTML\" (removes the space for clean URLs)"
fi
ok "spine entry: spine/$SPINE_HTML"
ok "brain entry: brain/$BRAIN_HTML"

# ---------------------------------------------------------------- shared theme.css
say "Writing shared theme.css (single source of truth for the look)…"
if [ "$THEME" = "light" ]; then
  BG="#f2f2f3"; SURF="#e9e9ea"; TEXT="#1d1f20"
else
  BG="#0b0e11"; SURF="#14202b"; TEXT="#e9eef3"
fi
cat > "$OUT/theme.css" <<CSS
/* theme.css — shared across the whole portfolio.
   Link this from every page so the spine, the brain and the hub agree.
   Both scenes already load the same design system; this pins the tokens
   they share so the two experiences read as one site. */
:root {
  --pf-bg: $BG;
  --pf-surface: $SURF;
  --pf-text: $TEXT;
  --pf-accent: $ACCENT;

  /* re-point the design-system tokens at the portfolio palette */
  --color-bg: var(--pf-bg);
  --color-surface: var(--pf-surface);
  --color-text: var(--pf-text);
  --color-accent: var(--pf-accent);
}

/* one shared top strip so both scenes feel like the same portfolio */
.pf-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; gap: 22px;
  padding: 12px 22px;
  font-family: var(--font-heading, "Barlow Condensed", sans-serif);
  letter-spacing: .16em; text-transform: uppercase; font-size: 12px;
  background: color-mix(in srgb, var(--pf-bg) 72%, transparent);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid color-mix(in srgb, var(--pf-text) 16%, transparent);
}
.pf-bar a { color: color-mix(in srgb, var(--pf-text) 72%, transparent); text-decoration: none; }
.pf-bar a:hover, .pf-bar a[aria-current="page"] { color: var(--pf-accent); }
.pf-bar .pf-home { margin-right: auto; font-weight: 600; color: var(--pf-text); }
.pf-bar .pf-home b { color: var(--pf-accent); }
CSS
ok "wrote $OUT/theme.css  (theme = $THEME, accent = $ACCENT)"

# ---------------------------------------------------------------- hub index.html
say "Writing themed hub index.html…"
cat > "$OUT/index.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alexander Gilbreath — Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="theme.css">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background:
      radial-gradient(120% 90% at 50% 40%, color-mix(in srgb, var(--pf-surface) 60%, var(--pf-bg)) 0%, var(--pf-bg) 62%, #07090b 100%);
    color: var(--pf-text);
    font-family: "Barlow", system-ui, sans-serif;
    min-height: 100%;
    display: flex; flex-direction: column;
  }
  .wrap { flex: 1; max-width: 1080px; margin: 0 auto; padding: 120px 28px 60px; width: 100%; }
  .kicker { font-family: "Barlow Condensed", sans-serif; letter-spacing: .24em; text-transform: uppercase;
            font-size: 12px; color: var(--pf-accent); }
  h1 { font-family: "Barlow Condensed", sans-serif; font-weight: 700; text-transform: uppercase;
       font-size: clamp(40px, 7vw, 68px); line-height: .96; margin: 8px 0 10px; }
  .lede { max-width: 52ch; color: color-mix(in srgb, var(--pf-text) 64%, transparent); font-size: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 44px; }
  .card {
    position: relative; display: block; text-decoration: none; color: inherit;
    padding: 26px; min-height: 200px;
    background: color-mix(in srgb, var(--pf-surface) 55%, transparent);
    border: 1px solid color-mix(in srgb, var(--pf-text) 14%, transparent);
    transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
  }
  .card:hover { transform: translateY(-3px); border-color: var(--pf-accent);
                box-shadow: 0 0 0 1px var(--pf-accent), 0 18px 40px color-mix(in srgb, var(--pf-accent) 22%, transparent); }
  .card .tag { font-family: "Barlow Condensed", sans-serif; letter-spacing: .16em; text-transform: uppercase;
               font-size: 11px; color: var(--pf-accent); }
  .card h2 { font-family: "Barlow Condensed", sans-serif; text-transform: uppercase; font-weight: 700;
             font-size: 30px; margin: 8px 0 6px; }
  .card p { margin: 0; color: color-mix(in srgb, var(--pf-text) 60%, transparent); font-size: 14px; }
  .card .go { position: absolute; right: 22px; bottom: 20px; color: var(--pf-accent); font-size: 20px; }
  /* blueprint corners to echo the two scenes */
  .card i { position: absolute; width: 10px; height: 10px; border: 1px solid var(--pf-accent); opacity: .8; }
  .card .tl { top: 8px; left: 8px; border-right: 0; border-bottom: 0; }
  .card .tr { top: 8px; right: 8px; border-left: 0; border-bottom: 0; }
  .card .bl { bottom: 8px; left: 8px; border-right: 0; border-top: 0; }
  .card .br { bottom: 8px; right: 8px; border-left: 0; border-top: 0; }
  footer { text-align: center; padding: 22px; font-size: 12px;
           color: color-mix(in srgb, var(--pf-text) 42%, transparent); }
</style>
</head>
<body>
  <div class="pf-bar">
    <span class="pf-home">GILBREATH<b>.</b></span>
    <a href="index.html" aria-current="page">Home</a>
    <a href="spine/$SPINE_HTML">Spine</a>
    <a href="brain/$BRAIN_HTML">Brain</a>
  </div>

  <div class="wrap">
    <div class="kicker">Portfolio — index of work</div>
    <h1>Alexander<br>Gilbreath</h1>
    <p class="lede">Two interactive ways into the same body of work. Pick a lens below —
       each opens a full 3D scene you can explore.</p>

    <div class="grid">
      <a class="card" href="brain/$BRAIN_HTML">
        <i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
        <span class="tag">3D · Cortex</span>
        <h2>The Brain</h2>
        <p>Projects filed by region. Hover the cortex, click to open.</p>
        <span class="go">↗</span>
      </a>
      <a class="card" href="spine/$SPINE_HTML">
        <i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
        <span class="tag">3D · Vertebra</span>
        <h2>The Spine</h2>
        <p>Click a vertebra to travel the build history end to end.</p>
        <span class="go">↗</span>
      </a>
    </div>
  </div>

  <footer>Built by Alexander Gilbreath</footer>
</body>
</html>
HTML
ok "wrote $OUT/index.html"

# ---------------------------------------------------------------- restyle map
say "Scanning the two scenes for colours the merge step must unify…"
MAP="$OUT/RESTYLE-MAP.txt"
{
  echo "RESTYLE MAP — generated $(date)"
  echo "Target theme: $THEME   Shared accent: $ACCENT"
  echo
  echo "These are the literal (hard-coded) colours inside each scene. theme.css can"
  echo "retarget the design-system *variables*, but literal hex in inline styles has"
  echo "to be changed in place. The Claude Code step (MERGE-PROMPT.md) does that."
  echo
  echo "============================================================"
  echo "SPINE  — currently light + GOLD accent. Unify its gold -> $ACCENT,"
  echo "         warm 'bone' tones -> neutral, light bg -> portfolio bg."
  echo "============================================================"
  grep -nEo '#[0-9a-fA-F]{6}' "$OUT/spine/$SPINE_HTML" | sort | uniq -c | sort -rn \
    | sed 's/^/   /'
  echo
  echo "  Occurrences of the gold accent (#d9a833) to remap:"
  grep -n '#d9a833' "$OUT/spine/$SPINE_HTML" | sed 's/^/   line /' | cut -c1-120 || true
  echo
  echo "============================================================"
  echo "BRAIN  — already dark + blue ($ACCENT). This is the reference look;"
  echo "         leave it as the target and match the spine to it."
  echo "============================================================"
  grep -nEo '#[0-9a-fA-F]{6}' "$OUT/brain/$BRAIN_HTML" | sort | uniq -c | sort -rn \
    | sed 's/^/   /'
} > "$MAP"
ok "wrote $MAP"

# ---------------------------------------------------------------- summary
echo
say "Done. Structure:"
echo "  $OUT/"
echo "  ├─ index.html          themed hub (links into both scenes)"
echo "  ├─ theme.css           shared tokens — edit here to change the whole look"
echo "  ├─ RESTYLE-MAP.txt     what the Claude Code step needs to unify"
echo "  ├─ spine/$SPINE_HTML"
echo "  └─ brain/$BRAIN_HTML"
echo
say "Next:"
echo "  1. Open $OUT/index.html in a browser — the hub + both scenes already work."
echo "  2. The spine still looks light/gold. To unify it, open this folder in"
echo "     Claude Code and paste MERGE-PROMPT.md."
echo "  3. Preview locally with:  cd $OUT && python3 -m http.server 8000"
