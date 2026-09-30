#!/usr/bin/env bash
# Render stills of a composition at given frames and tile them into a contact sheet.
#   scripts/stills.sh <composition> <out.png> <frame> [frame...]
set -euo pipefail
comp=$1; out=$2; shift 2
tmp=$(mktemp -d)
BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
i=0
for f in "$@"; do
  ./node_modules/.bin/remotion still "$comp" "$tmp/$(printf %03d $i).png" --frame="$f" --gl=angle --browser-executable=$BROWSER --log=error >/dev/null
  i=$((i+1))
done
n=$#
cols=$(( n < 3 ? n : 3 ))
ffmpeg -loglevel error -y -pattern_type glob -i "$tmp/*.png" -vf "scale=640:-1,tile=${cols}x$(( (n + cols - 1) / cols ))" -frames:v 1 "$out"
rm -rf "$tmp"
echo "$out"
