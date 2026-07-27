-- Databases (Notion-style collections) — Phase 2 of the docs roadmap.
-- A collection is a typed database hosted by a page (type='database'); its
-- property definitions (`props`) and saved views (`views`) live in JSONB so new
-- property types (relation, rollup, formula…) and view kinds (calendar,
-- timeline…) ship without further DDL. Rows keep their values in JSONB keyed by
-- property id; the title is denormalized for cheap search/sorting.

-- 1) Collections.
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,
  page_id uuid references pages on delete cascade,
  name text not null default 'Untitled',
  icon text,
  props jsonb not null default '[]'::jsonb,
  views jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_collections_space on collections(space_id);
create unique index if not exists idx_collections_page on collections(page_id) where page_id is not null;

alter table collections enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='collections' and policyname='sel') then
    create policy sel on collections for select using (user_id = auth.uid());
    create policy ins on collections for insert with check (user_id = auth.uid());
    create policy upd on collections for update using (user_id = auth.uid());
    create policy del on collections for delete using (user_id = auth.uid());
  end if;
end $$;

-- 2) Rows.
create table if not exists collection_rows (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,
  title text not null default '',
  data jsonb not null default '{}'::jsonb,
  sort_index double precision not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_rows_collection on collection_rows(collection_id, sort_index);

alter table collection_rows enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='collection_rows' and policyname='sel') then
    create policy sel on collection_rows for select using (user_id = auth.uid());
    create policy ins on collection_rows for insert with check (user_id = auth.uid());
    create policy upd on collection_rows for update using (user_id = auth.uid());
    create policy del on collection_rows for delete using (user_id = auth.uid());
  end if;
end $$;

-- 3) Realtime (future live collaboration on databases).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='collection_rows') then
    execute 'alter publication supabase_realtime add table public.collection_rows';
  end if;
end $$;
