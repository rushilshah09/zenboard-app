---
description: Deploy Zenboard to production and verify it (gate → build → measure → deploy → smoke)
---

Ship Zenboard to production.

Run this, from the repo root or anywhere inside it:

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)/zenboard-web" 2>/dev/null || cd zenboard-web; npm run ship
```

`npm run ship` (`zenboard-web/scripts/ship.mjs`) does all five steps and prints a
pass/fail line per probe. Do not re-implement them by hand:

1. **Gate** — `tsc --noEmit` + the full vitest suite. A red suite never ships.
2. **Build** — OpenNext. It READS the working tree, so do not edit sources until
   the log says `OpenNext build complete`.
3. **Measure** — gzipped worker. It only ever WARNS. The 3,072 KiB figure is the
   FREE-plan ceiling and this account is past it (3,139 KiB shipped fine on
   2026-09-27). Never block a deploy on a remembered limit — if Cloudflare really
   refuses an upload it fails with `code: 10027` and the live version is untouched.
4. **Deploy** — `--keep-vars`, which is MANDATORY. wrangler.jsonc declares no
   `vars`, so a plain deploy DELETES every dashboard-set secret.
5. **Smoke** — the probes that prove something rather than just 200s.

## Reporting back

Give the user the **version ID** from wrangler's output, the **gzip size**, the
**test count**, and any probe that failed. If a probe fails, say so plainly — the
deploy is already live at that point, so a failure needs investigating, not hiding.

## Things that look like bugs and are not

- `/f/does-not-exist` → **200, never 404.** One calm page for every unavailable
  reason, so a stranger cannot enumerate form tokens. Do not "fix" it.
- `/` → **200, not a redirect.** The root is the marketing site for anyone without
  an `sb-…-auth-token` cookie; only a signed-in visitor is sent to `/today`.
- `/today` → **307 → /login** is the real health signal: it proves the worker
  booted *and* reached Supabase. A 500 there means the runtime env got wiped.

## Flags

- `npm run ship:dry` — gate, build and measure, deploy nothing. Use to check size.
- `npm run ship -- --skip-gate` — re-ship a tree that just passed. Not a way to
  make a red suite go away.
- `SHIP_ORIGIN=https://zenboard.life npm run ship` — also smoke the custom domain.
