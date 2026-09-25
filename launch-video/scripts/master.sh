#!/usr/bin/env bash
# Renders the launch film and masters it: -14 LUFS / -1 dBTP (DIRECTION_V3.md §6),
# a delivery encode under GitHub's 100 MB limit, and a 720p preview for chat.
#   scripts/master.sh [--skip-render]
set -euo pipefail
cd "$(dirname "$0")/.."
BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
if [ "${1:-}" != "--skip-render" ]; then
  python3 scripts/make-film-sound.py
  ./node_modules/.bin/remotion render Film out/film-raw.mp4 --gl=angle --browser-executable=$BROWSER --concurrency=4
fi
# Two-pass loudnorm: measure, then apply linearly.
STATS=$(ffmpeg -hide_banner -i out/film-raw.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | sed -n "s/.*\"$1\" : \"\\([^\"]*\\)\".*/\\1/p"; }
ffmpeg -y -hide_banner -loglevel error -i out/film-raw.mp4 -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -c:a aac -b:a 320k -ar 48000 out/zenboard-film-master.mp4
ffmpeg -y -hide_banner -loglevel error -i out/zenboard-film-master.mp4 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a copy -movflags +faststart zenboard-launch.mp4
ffmpeg -y -hide_banner -loglevel error -i out/zenboard-film-master.mp4 -vf scale=1280:-2 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out/zenboard-film-720p.mp4
ls -la zenboard-launch.mp4 out/zenboard-film-720p.mp4
