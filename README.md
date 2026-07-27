# Zenboard

A calm workspace for independent professionals — tasks, projects, goals, documents, finance, and a client portal in one place, built to feel closer to Linear or Notion than to a typical productivity tool.

## Stack

- **Next.js** (app router) + TypeScript
- **Tailwind CSS** + shadcn/ui (Radix primitives) for the design system
- **Supabase** — Postgres, auth, row-level security; migrations in `supabase/migrations`
- **Cloudflare Workers** for deployment, via OpenNext (`open-next.config.ts`, `wrangler.jsonc`)
- **Vitest** for unit tests

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

`SETUP.md` documents where every environment variable comes from. Nothing runs without a Supabase project and the keys in `.env.local`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run preview` | Build and preview the Workers bundle locally |
| `npm run deploy` | Deploy to Cloudflare Workers |

## Layout

```
app/          routes — app shell, auth, API handlers, public client portal
components/   design-system primitives and feature components
lib/          data access, Supabase clients, domain logic
supabase/     SQL migrations
types/        hand-authored database types
scripts/      maintenance and security-test scripts
```

## Design system

The interface follows a single enforced design language: semantic color tokens only (never raw hex), a fixed type scale, one filled-accent action per view, and shared primitives that are reused rather than forked. `DESIGN_CONSTITUTION.md` and `CLAUDE.md` hold the rules; `MASTER_PRODUCT_PLAN.md` covers product direction.

## License

No license is granted. This source is published for reference; all rights reserved.
