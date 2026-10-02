#!/bin/bash
# Measurement tool only. Production-build a checkout pointed at the mock
# Supabase. NEXT_PUBLIC_* values are inlined at build time, and process env
# beats .env files, so a checkout's own .env.local cannot leak into the build.
#   scripts/perf/build.sh <checkout>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="${ZB_PERF_STATE:-$(cd "$HERE/../.." && pwd)/.perf}"
mkdir -p "$STATE"
CHECKOUT="$(cd "$1" && pwd)"
LOG="$STATE/build-$(basename "$CHECKOUT").log"
[ -d "$CHECKOUT/node_modules" ] || { echo "no node_modules in $CHECKOUT" >&2; exit 1; }
cd "$CHECKOUT"
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key \
SUPABASE_SERVICE_ROLE_KEY=mock-service-key \
  npx next build > "$LOG" 2>&1 || { tail -30 "$LOG" >&2; exit 1; }
echo "built $CHECKOUT (log: ${LOG#$STATE/})"
