-- Library / pages upgrade: nesting, page metadata, templates, backlinks, search,
-- and an image bucket. Builds on the existing `pages` model — no parallel doc
-- tables. The block editor itself only needs the existing `content` jsonb; these
-- columns power the tree, icons, pin/favorite, archive, project/client linking,
-- backlinks, full-text search, and image upload landing in the next passes.

-- 1) Page metadata + nesting.
alter table pages
  add column if not exists parent_id   uuid references pages on delete set null,
  add column if not exists client_id   uuid references clients on delete set null,
  add column if not exists icon        text,
  add column if not exists cover        text,
  add column if not exists is_pinned   boolean default false,
  add column if not exists is_favorite boolean default false,
  add column if not exists archived_at timestamptz,
  add column if not exists sort_index  int default 0;

create index if not exists idx_pages_parent on pages(parent_id);
create index if not exists idx_pages_project on pages(project_id);
create index if not exists idx_pages_client on pages(client_id);

-- 2) Full-text search over the title (plaintext block search is applied app-side
--    until block content is denormalized; this covers the title index cheaply).
alter table pages add column if not exists search_tsv tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;
create index if not exists idx_pages_search on pages using gin(search_tsv);

-- 3) page_links already exists (0001: from_page_id / to_page_id, owner RLS via the
--    standard loop). Add a uniqueness guard so a backlink isn't duplicated.
create unique index if not exists idx_page_links_pair
  on page_links(from_page_id, to_page_id) where to_page_id is not null;

-- 4) Page templates (optional surface).
create table if not exists page_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text,
  content jsonb default '{"blocks":[]}'::jsonb,
  created_at timestamptz default now()
);
alter table page_templates enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='page_templates' and policyname='sel') then
    create policy sel on page_templates for select using (user_id = auth.uid());
    create policy ins on page_templates for insert with check (user_id = auth.uid());
    create policy upd on page_templates for update using (user_id = auth.uid());
    create policy del on page_templates for delete using (user_id = auth.uid());
  end if;
end $$;

-- 5) Storage bucket for page images. Private bucket; owner-only read/write enforced
--    by foldering uploads under the user id (path = <uid>/<file>). The app uploads
--    via the authenticated client so auth.uid() is set.
insert into storage.buckets (id, name, public)
  values ('page-images', 'page-images', false)
  on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='page_images_select') then
    create policy page_images_select on storage.objects for select
      using (bucket_id = 'page-images' and owner = auth.uid());
    create policy page_images_insert on storage.objects for insert
      with check (bucket_id = 'page-images' and owner = auth.uid()
        and (storage.foldername(name))[1] = auth.uid()::text);
    create policy page_images_delete on storage.objects for delete
      using (bucket_id = 'page-images' and owner = auth.uid());
  end if;
end $$;

-- 6) Realtime for page_templates (pages/page_links already covered as needed).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='page_links') then
    execute 'alter publication supabase_realtime add table public.page_links';
  end if;
end $$;
