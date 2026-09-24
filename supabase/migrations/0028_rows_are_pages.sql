-- Phase 1 — "every row is a page" (the Notion structural model).
--
-- TODAY: `collection_rows` is a separate table from `pages`. A row has a title,
-- a jsonb `data` bag, and a body smuggled into `data->'__content'`. It has no
-- icon, no cover, no comments, no history, and it cannot be mentioned, linked,
-- or found by anything that walks `pages`. Every page-level feature therefore
-- has to be built twice.
--
-- AFTER: a database row IS a page — `pages.database_id` points at its collection,
-- `pages.properties` holds its typed values, and its body is the page's own
-- `content`. Rows inherit icon/cover/archive/history/backlinks for free.
--
-- STRATEGY: additive + incremental, NOT a big-bang rewrite. Nothing is dropped
-- here. `collection_rows` keeps working exactly as it does today; it gains a
-- `page_id` bridge column pointing at its new twin. Readers migrate one at a
-- time in later commits, and a LATER migration retires the old table once
-- nothing reads it. That way a half-migrated app is still a working app.
--
-- IDEMPOTENT: safe to run more than once. The backfill only creates a page for
-- rows that do not already have one (`collection_rows.page_id is null`).
--
-- ROLLBACK: see 0028_rows_are_pages_rollback.sql (delete the generated pages,
-- drop the three columns). No pre-existing data is modified by this migration,
-- so the rollback is total.

-- ── 1. Schema ───────────────────────────────────────────────────────────────

alter table pages
  -- Non-null makes a page a database ROW; null keeps it a standalone document.
  add column if not exists database_id uuid references collections on delete cascade,
  -- Property values keyed by PROPERTY ID (never by name), so renaming a property
  -- never touches row data. Mirrors collection_rows.data minus the body key.
  add column if not exists properties jsonb not null default '{}'::jsonb,
  -- Fractional index (text: 'a0', 'a0V', 'a1'). Nullable during the transition —
  -- ordering still comes from collection_rows.sort_index until readers move.
  -- Text, not float: a double runs out of precision after ~50 midpoint inserts.
  add column if not exists row_order text;

-- The bridge. While both tables exist this is how a row finds its page (and how
-- the backfill stays idempotent). Dropped when collection_rows is retired.
alter table collection_rows
  add column if not exists page_id uuid references pages on delete set null;

create index if not exists idx_pages_database on pages(database_id) where database_id is not null;
create index if not exists idx_pages_database_order on pages(database_id, row_order) where database_id is not null;
-- GIN over the whole property bag: filters are per-property and ad hoc, so a
-- btree per property is not knowable in advance. A specific hot property can get
-- its own generated column + btree later.
create index if not exists idx_pages_properties on pages using gin (properties);
create index if not exists idx_collection_rows_page on collection_rows(page_id) where page_id is not null;

-- ── 2. Backfill — one page per existing row ─────────────────────────────────
-- `pages.space_id` is NOT NULL but `collection_rows.space_id` is nullable, so we
-- fall back to the collection's space. Rows where BOTH are null are skipped
-- rather than guessed at; the report query at the bottom surfaces them.

with new_pages as (
  insert into pages (user_id, space_id, title, type, content, properties, database_id, sort_index, created_at, updated_at)
  select
    r.user_id,
    coalesce(r.space_id, c.space_id),
    coalesce(nullif(r.title, ''), null),
    'row',
    -- The body was smuggled into data->'__content'. Missing/!object → empty doc.
    case
      when jsonb_typeof(r.data -> '__content') = 'object' then r.data -> '__content'
      else '{"blocks": []}'::jsonb
    end,
    -- Everything EXCEPT the body becomes the property bag, already keyed by id.
    (r.data - '__content'),
    r.collection_id,
    -- sort_index is int on pages and double on rows.
    --
    -- FIXED 2026-08-03 (safe to edit: a live probe confirmed this migration has
    -- never been run). This was `round(r.sort_index)::int`, which raises
    -- `integer out of range` on any row created through `addDbRow` — that
    -- writes `Date.now()` (~1.75e12) into a double, and pages.sort_index is an
    -- int4 topping out at 2.1e9. The whole backfill would have aborted.
    --
    -- Zero, not a clamp: `row_order` below is what orders rows now, and
    -- clamping would invent an ordering that agrees with nothing.
    0,
    r.created_at,
    r.updated_at
  from collection_rows r
  join collections c on c.id = r.collection_id
  where r.page_id is null
    and coalesce(r.space_id, c.space_id) is not null
  returning id as page_id, database_id, created_at, title
)
-- Link each new page back to the row it came from. Matching on
-- (collection, created_at, title) is exact here because the insert above copies
-- all three verbatim from a single source row.
update collection_rows r
set page_id = np.page_id
from new_pages np
where r.collection_id = np.database_id
  and r.created_at = np.created_at
  and coalesce(r.title, '') = coalesce(np.title, '')
  and r.page_id is null;

-- ── 3. Seed row_order from the existing float ordering ──────────────────────
-- Not real fractional indexing yet — just a lexicographically sortable string in
-- the current order, so the first drag has something to bisect between. Padded
-- to a fixed width so text ordering matches the numeric ordering it came from.
update pages p
set row_order = lpad(to_hex(rn.n * 1000), 12, '0')
from (
  select r.page_id, row_number() over (partition by r.collection_id order by r.sort_index, r.created_at) as n
  from collection_rows r
  where r.page_id is not null
) rn
where p.id = rn.page_id and p.row_order is null;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- pages already has its own owner policy and these rows carry the same user_id,
-- so no new policy is needed. Stated explicitly so the omission reads as a
-- decision rather than an oversight.

-- ── 5. Report — run these after applying, they should all be sane ───────────
--   rows without a page (expect 0, unless space_id was null on both sides):
--     select count(*) from collection_rows where page_id is null;
--   pages created by this migration:
--     select count(*) from pages where type = 'row';
--   any row whose property bag lost keys (expect 0):
--     select count(*) from collection_rows r join pages p on p.id = r.page_id
--     where (select count(*) from jsonb_object_keys(r.data - '__content'))
--        <> (select count(*) from jsonb_object_keys(p.properties));
