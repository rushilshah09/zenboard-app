-- Attachments — master plan §7H ("files everywhere"), ledger 0033.
--
-- Today Zenboard can LINK a file (paste a URL into a file/pdf block) but cannot
-- HOLD one. The only bytes it stores are images, base64'd into `pages.content`
-- as data-URLs — which works, and is measured as harmless right now (zero
-- data-URLs in the live database, 33 KB of content total), but does not scale:
-- that column is re-read on every page open, re-written on every autosave, and
-- snapshotted into `page_versions` on every save.
--
-- THE SHAPE: real bytes in a private bucket, one row per file, and the OWNER is
-- a real foreign key rather than a polymorphic pair.
--
-- `mentions` (0027) is polymorphic (`target_type`/`target_id`, no FK) and that
-- was right there: an edge to a deleted record should leave a tombstone. A file
-- is the opposite. An attachment whose parent is gone is not a tombstone, it is
-- bytes you keep paying for and can no longer find. Three nullable FKs with a
-- CHECK that exactly one is set gives us: cascade cleanup for free, an indexed
-- lookup for the only query anyone runs ("this thing's files"), and a database
-- that can still answer "what is orphaned". A fourth owner type costs one column
-- and one line of the check — cheap, and explicit.
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,

  -- Exactly one owner. Cascade, so deleting the parent reclaims the row.
  page_id uuid references pages(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,

  -- `path` is the object key inside the private bucket, and the only handle the
  -- app stores. There is deliberately NO url column: a private object's URL is a
  -- short-lived signature, so persisting one would persist something already
  -- expired by the time anybody read it.
  path text not null unique,
  filename text not null,
  mime_type text,
  size_bytes bigint,

  created_at timestamptz not null default now()
);

-- Exactly one owner, enforced where it cannot be forgotten.
alter table attachments drop constraint if exists attachments_one_owner;
alter table attachments add constraint attachments_one_owner check (
  (page_id is not null)::int + (task_id is not null)::int + (project_id is not null)::int = 1
);

-- The only query anyone runs: "this record's files", newest last.
create index if not exists idx_attachments_page on attachments(page_id, created_at) where page_id is not null;
create index if not exists idx_attachments_task on attachments(task_id, created_at) where task_id is not null;
create index if not exists idx_attachments_project on attachments(project_id, created_at) where project_id is not null;

-- Owner-only RLS, the same shape as every other table here.
alter table attachments enable row level security;
drop policy if exists attachments_owner on attachments;
create policy attachments_owner on attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The bucket. Private, and DELIBERATELY without storage.objects policies —
-- identical reasoning to `form-uploads` (0022): every path in and out runs
-- through the service role inside a server action that has already proven
-- ownership through RLS. An RLS policy on storage.objects would only add a
-- second, weaker door to the same bytes.
--
-- 25 MB: comfortably a design PDF, a contract scan or a photo, and small enough
-- that one bad paste cannot fill a free-tier bucket. Storage enforces it itself,
-- so the cap holds even for bytes uploaded straight to a signed URL that this
-- server never sees.
--
-- 25_000_000 and not 25 MiB: `ATTACHMENT_MAX_BYTES` and `formatBytes` in
-- lib/attachments.ts are decimal (what Finder and every storage bill show), and
-- a binary limit here would make the app refuse a file with "the limit is 26 MB".
insert into storage.buckets (id, name, public, file_size_limit)
  values ('attachments', 'attachments', false, 25000000)
  on conflict (id) do nothing;
