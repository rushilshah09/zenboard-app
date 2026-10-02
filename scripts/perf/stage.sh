#!/bin/bash
# Measurement tool only. Mirror a BUILT checkout into <run-dir>/<name> so it can
# be served from outside ~/Downloads, which macOS can refuse to a process that
# was not started from your terminal. Sources are small, so they are copied;
# node_modules and .next are hard-linked, which takes seconds and no disk, and
# unlike a symlink a hard link is opened by its own path. The harness files
# serve.sh needs are copied to <run-dir>/harness.
#   scripts/perf/stage.sh <checkout> <run-dir> <name>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$1" && pwd)"
RUN="$2"
NAME="$3"
[ -f "$SRC/.next/BUILD_ID" ] || { echo "not built: $SRC (run build.sh first)" >&2; exit 1; }
mkdir -p "$RUN/harness" "$RUN/state"
cp "$HERE/serve.sh" "$HERE/mock-supabase.cjs" "$HERE/fixtures.cjs" "$HERE/trace.cjs" "$RUN/harness/"
DEST="$RUN/$NAME"
rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude .next --exclude .git --exclude .open-next --exclude .wrangler --exclude .perf --exclude tsconfig.tsbuildinfo "$SRC/" "$DEST/"
cp -al "$SRC/.next" "$DEST/.next"
cp -al "$SRC/node_modules" "$DEST/node_modules"
echo "staged $SRC → $DEST (build $(cat "$DEST/.next/BUILD_ID"))"
