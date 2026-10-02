# Performance harness

Measures a real production build of Zenboard against a local stand-in for
Supabase whose every response waits a set number of milliseconds. That wait is
the variable that decides how fast this app feels: the live database is in AWS
Seoul while the worker answers from Cloudflare's Singapore edge, so each query
costs ~90–240 ms, several times per page.

Nothing here is imported by the app or shipped in the worker.

| File | What it is |
| --- | --- |
| `mock-supabase.cjs` | PostgREST + Auth subset on `127.0.0.1:54321`: ES256 sessions, JWKS, deterministic studio data from `fixtures.cjs`. Each response waits `.perf/rtt` ms, read live. |
| `trace.cjs` | Preloaded into `next start`. Records every Supabase call against the request that caused it. |
| `bench.cjs` | Hard-load and client-navigation timings for every main route, medians, plus waves from the trace. |
| `waves.cjs` | Prints one traced request's calls in order, with the round-trip wave each sits in. |
| `cdp.cjs` | Headless Chrome: skeleton and content timings, layout shift, screenshots, and `compare`: pixel-diff two builds route by route (animations frozen from document start), with zoomed crops of any difference and console errors from both sides. |
| `route-js.cjs` | First-load JavaScript per route, from a build's manifests. |

## Run

```sh
scripts/perf/build.sh <checkout>            # production build pointed at the mock
scripts/perf/serve.sh <checkout> <port>     # mock (if needed) + next start + tracer
node scripts/perf/bench.cjs --port 3103 --label current
node scripts/perf/bench.cjs --compare baseline,current
```

`echo 200 > .perf/rtt` models today's distance to the database (Singapore to
Seoul, per query). `echo 10 > .perf/rtt` models the worker placed next to it.

State (signing keys, the session cookie, traces, results) lives in `.perf/`,
which git ignores, or wherever `ZB_PERF_STATE` points.

On macOS, a process launched outside your terminal may be refused access to
`~/Downloads`. `stage.sh <checkout> <run-dir>` mirrors a built checkout into
another directory with hard links (seconds, no extra disk), so it can be served
from there with `ZB_PERF_STATE` pointing outside `~/Downloads` too.
