// ─────────────────────────────────────────────────────────────────────────────
// `@/lib/icons` — the import path the design-system components (mirrored into
// components/ds/ui via `design-system/scripts/sync-to-web.mjs`) use for glyphs.
//
// In the design-system package that path is design-system/src/lib/icons.ts. In
// this app the canonical icon seam lives at components/ds/icons.ts, so this file
// simply re-exports it — giving the mirrored ui/ components a `@/lib/icons` that
// resolves here without hand-editing the generated mirror. Switch the underlying
// icon set in ONE place (components/ds/icons.ts); this shim needs no changes.
// ─────────────────────────────────────────────────────────────────────────────
export * from "@/components/ds/icons";
