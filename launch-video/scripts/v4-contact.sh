#!/usr/bin/env bash
# Contact sheet of a v4 composition: renders every Nth frame at low scale and tiles them.
#   scripts/v4-contact.sh V4-resolve 30 [scale]
set -e
ID=$1; N=${2:-30}; SC=${3:-0.3}
B=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
D=out/v4/seq-$ID; rm -rf $D; mkdir -p $D
npx remotion render src/index.ts $ID $D --sequence --image-format=jpeg --scale=$SC --every-nth-frame=$N --browser-executable=$B --log=error >/dev/null
python3 - "$D" "out/v4/$ID.jpg" <<'PY'
import sys, glob
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1] + "/*.jpeg"))
ims = [Image.open(f) for f in fs]; w, h = ims[0].size; c = 4
s = Image.new("RGB", (c * (w + 4), ((len(ims) + c - 1) // c) * (h + 4)), "black")
for i, im in enumerate(ims):
    s.paste(im, ((i % c) * (w + 4), (i // c) * (h + 4)))
    ImageDraw.Draw(s).text(((i % c) * (w + 4) + 6, (i // c) * (h + 4) + 4), fs[i].split("/")[-1], fill=(200, 0, 90))
s.save(sys.argv[2], quality=80); print(sys.argv[2], len(ims))
PY
