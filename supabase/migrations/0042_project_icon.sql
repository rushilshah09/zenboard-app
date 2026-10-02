-- A project can have an icon — ledger entry 0042.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- A project identified itself with a 10px filled square in one of five muted
-- colours. In a rail of five projects that is five near-identical marks, so
-- the colour carried almost no information — you read the name every time —
-- and the raw hex was painted directly, which is the theme-blindness
-- lib/entity-color.ts exists to end (a stored `#9A1B6F` measures 1.86:1 on the
-- dark rail: a mark you cannot see).
--
-- Linear gives every project a TILE with a glyph the person chose. The tile
-- itself needed no schema — `components/ui/record-icon.tsx` renders it from
-- the existing colour with a default glyph. THIS column is what lets the
-- person choose the glyph.
--
-- ── WHY NOT A NEW TABLE, OR A JSONB BLOB ────────────────────────────────────
-- Because the app already has exactly one vocabulary for "an icon a person
-- picked", and it is a single string: `components/ui/page-icon.tsx` resolves
--
--     "🎨"                  an emoji
--     "ph:RocketLaunch"     one of the curated glyphs
--     "data:…" / "https:…"  an uploaded or linked image
--
-- Documents have stored icons in that shape since the covers work, and the
-- picker that produces them (`components/ui/emoji-picker.tsx`) already exists.
-- A second shape here would mean a second renderer and a second picker, which
-- is the drift this codebase keeps finding. One text column, same grammar.
--
-- NULL means "no icon chosen", which the tile renders as the Projects nav
-- glyph in the project's colour — undecorated, never empty.

alter table projects
  add column if not exists icon text;

comment on column projects.icon is
  'A page-icon value: an emoji, "ph:<CuratedName>", or an image URL. '
  'Same grammar as pages.content->icon — see components/ui/page-icon.tsx. '
  'NULL = no icon chosen; the UI falls back to the Projects glyph.';

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--   alter table projects drop column if exists icon;
