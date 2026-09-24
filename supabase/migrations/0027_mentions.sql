-- The fabric: one typed edge table (master plan §3.4, "the single highest-leverage
-- new mechanic in this plan").
--
-- IMPORTANT — this is only ONE of the fabric's three producers. The other two need
-- no schema at all and already ship:
--   1. structural edges  — task→project, invoice→client, doc→client … are already
--      FKs. `lib/connected.ts` mirrors them at read time; the Connected panel works
--      TODAY without this migration.
--   2. @-mentions        — the rows this table holds (a doc block, comment or note
--      that names another entity). Gated on `mentionsSupported()`.
--   3. AI clerk suggestions — never auto-written; accepted with one tap, and when
--      accepted they land here as ordinary rows.
--
-- Why a table rather than more FKs: an @-mention is many-to-many across EVERY pair
-- of entity types (a doc can name a client, an invoice, and three tasks). Adding a
-- column per pair is combinatorial; one polymorphic edge row is not.
--
-- Why no FK on target_id: the target is polymorphic, so Postgres cannot reference
-- it. That is deliberate and it is why deletes are handled below in the read path
-- rather than by `on delete cascade` — §7H calls for "deleting a mentioned doc →
-- mentions become TOMBSTONES", not silent disappearance. A dangling edge is a
-- feature here; `lib/connected.ts` resolves targets and renders unresolvable ones
-- as a tombstone row.
--
-- Additive and idempotent.

create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,

  -- The entity that CONTAINS the reference (the doc you typed @Acme into).
  -- Cascade-deleted in the read path, not here — see the note above.
  source_type text not null,
  source_id uuid not null,

  -- The entity being referenced.
  target_type text not null,
  target_id uuid not null,

  -- Where in the source it appeared — a block id, a comment id, or null for a
  -- whole-entity link. Lets a backlink deep-link to the exact paragraph.
  anchor text,

  -- The surrounding sentence, snapshotted at write time. A backlink that shows
  -- only a title is a list; one that shows the line it appeared in is a memory.
  context text,

  -- 'mention' (typed by hand) | 'suggested' (AI clerk, accepted). Structural
  -- edges are NOT stored here — they are derived. Kept so an accepted suggestion
  -- stays distinguishable from something the user actually wrote.
  origin text check (origin in ('mention', 'suggested')) not null default 'mention',

  created_at timestamptz default now()
);

-- Both directions are hot: "what does this doc reference" (source) and the
-- backlink query "what references this client" (target). Two indexes, not one.
create index if not exists idx_mentions_source on mentions(source_type, source_id);
create index if not exists idx_mentions_target on mentions(target_type, target_id);
create index if not exists idx_mentions_user on mentions(user_id, created_at desc);

-- Typing @Acme twice in one doc is one edge, not two. The unique key includes
-- `anchor` so the same doc CAN name the same client from two different blocks
-- (each deep-links somewhere different), but re-saving one block is idempotent.
create unique index if not exists idx_mentions_edge
  on mentions(source_type, source_id, target_type, target_id, coalesce(anchor, ''));

alter table mentions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='mentions' and policyname='sel') then
    create policy sel on mentions for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='mentions' and policyname='ins') then
    create policy ins on mentions for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='mentions' and policyname='upd') then
    create policy upd on mentions for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='mentions' and policyname='del') then
    create policy del on mentions for delete using (user_id = auth.uid());
  end if;
end $$;
