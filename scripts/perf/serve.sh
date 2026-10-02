#!/bin/bash
# Measurement tool only. Serve a built checkout against the mock Supabase with
# the request tracer preloaded. Starts the mock first if it is not running.
#   scripts/perf/serve.sh <checkout> <port>
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="${ZB_PERF_STATE:-$(cd "$HERE/../.." && pwd)/.perf}"
mkdir -p "$STATE"
CHECKOUT="$(cd "$1" && pwd)" || exit 1
PORT="$2"
if ! curl -s -o /dev/null --max-time 1 http://127.0.0.1:54321/auth/v1/settings; then
  ZB_PERF_STATE="$STATE" nohup node "$HERE/mock-supabase.cjs" >> "$STATE/mock.log" 2>&1 &
  for _ in $(seq 1 30); do curl -s -o /dev/null --max-time 1 http://127.0.0.1:54321/auth/v1/settings && break; sleep 0.2; done
fi
cd "$CHECKOUT" || exit 1
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key SUPABASE_SERVICE_ROLE_KEY=mock-service-key
export NODE_OPTIONS="--require $HERE/trace.cjs" ZB_TRACE_HOST=127.0.0.1:54321 ZB_TRACE_FILE="$STATE/trace-$PORT.jsonl"
exec npx next start -p "$PORT"
