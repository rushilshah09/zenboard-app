#!/usr/bin/env bash
# Renders the 1080p60 master and sets its loudness to -14 LUFS / -1 dBTP (§6).
#   scripts/master.sh [path/to/chromium-headless-shell]
set -euo pipefail
cd "$(dirname "$0")/.."
BROWSER=${1:+--browser-executable=$1}
npx remotion render Film16x9 out/zenboard-raw.mp4 --codec=h264 --crf=14 --image-format=png --gl=angle $BROWSER
# Two-pass loudnorm: measure, then apply linearly.
STATS=$(ffmpeg -hide_banner -i out/zenboard-raw.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | sed -n "s/.*\"$1\" : \"\\([^\"]*\\)\".*/\\1/p"; }
ffmpeg -y -hide_banner -loglevel error -i out/zenboard-raw.mp4 -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -c:a aac -b:a 320k -ar 48000 out/zenboard-1080p60.mp4
# Delivery copy under GitHub's 100 MB limit (the animated grain makes the master heavy).
ffmpeg -y -hide_banner -loglevel error -i out/zenboard-1080p60.mp4 -c:v libx264 -preset slow -crf 22 -tune grain -pix_fmt yuv420p -c:a copy -movflags +faststart out/zenboard-delivery.mp4
echo "wrote out/zenboard-1080p60.mp4 and out/zenboard-delivery.mp4"
