#!/usr/bin/env bash
# Seam check: renders the last frame of each v4 scene and the first frame of the next, side by side,
# and prints the mean pixel difference (a seamless hand-off should be close to 0).
#   scripts/v4-seams.sh [scale]
set -e
SC=${1:-0.25}
B=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
D=out/v4/seams; rm -rf $D; mkdir -p $D
# scene starts in seconds (keep in sync with src/v4/timeline.ts)
for t in 10 16.5 23.5 29.5 41.5 47.5 52.5 59.5; do
  f=$(python3 -c "print(round($t*60))")
  for g in $((f-1)) $f; do
    npx remotion still src/index.ts FilmV4 $D/$g.png --frame=$g --scale=$SC --browser-executable=$B --log=error >/dev/null
  done
done
python3 - "$D" <<'PY'
import sys, glob
from PIL import Image, ImageChops, ImageStat
D = sys.argv[1]
rows = []
for t in (10, 16.5, 23.5, 29.5, 41.5, 47.5, 52.5, 59.5):
    f = round(t * 60)
    a, b = Image.open(f"{D}/{f-1}.png").convert("RGB"), Image.open(f"{D}/{f}.png").convert("RGB")
    diff = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
    print(f"{t:>3}s  seam diff {diff:6.2f}")
    s = Image.new("RGB", (a.width * 2 + 4, a.height), "black"); s.paste(a, (0, 0)); s.paste(b, (a.width + 4, 0)); rows.append(s)
sheet = Image.new("RGB", (rows[0].width, len(rows) * (rows[0].height + 4)), "black")
for i, r in enumerate(rows): sheet.paste(r, (0, i * (r.height + 4)))
sheet.save(f"{D}/seams.jpg", quality=80)
PY
