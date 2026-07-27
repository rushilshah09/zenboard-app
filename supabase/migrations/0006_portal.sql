-- Client Portal: per-project share controls + a tokenized public portal.
-- The public portal is UNAUTHENTICATED and is served only through a server route
-- that validates portal_token and returns a fixed safe projection via the
-- service role. RLS is NEVER opened to anon — these policies only let the owner
-- read/manage their own rows; portal inserts come from the server (service role).

-- 1) Project-level portal settings + token + granular share flags.
alter table projects
  add column if not exists portal_enabled        boolean default false,
  add column if not exists portal_token          text,
  add column if not exists share_progress        boolean default true,
  add column if not exists share_completed_tasks boolean default true,
  add column if not exists share_open_tasks      boolean default false,
  add column if not exists share_timeline        boolean default true,
  add column if not exists share_files           boolean default false,
  add column if not exists allow_requests        boolean default true,
  add column if not exists portal_intro          text;

-- Unique token (nullable until the portal is first enabled).
create unique index if not exists idx_projects_portal_token on projects(portal_token) where portal_token is not null;

-- 2) Per-item "share with client" overrides.
alter table pages add column if not exists client_visible boolean default false;
alter table tasks add column if not exists client_visible boolean default false;

-- 3) Client requests/messages submitted from the portal.
create table if not exists client_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  client_token text not null,
  name text,
  body text not null,
  status text check (status in ('new','seen','done')) default 'new',
  created_at timestamptz default now()
);
create index if not exists idx_client_requests_project on client_requests(project_id, created_at desc);

-- RLS: owner can read/manage requests for their own projects. There is NO insert
-- policy, so the only way to create a request is the server (service role, which
-- bypasses RLS) after it has validated the token. anon gets nothing.
alter table client_requests enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='client_requests' and policyname='sel') then
    create policy sel on client_requests for select
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='client_requests' and policyname='upd') then
    create policy upd on client_requests for update
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='client_requests' and policyname='del') then
    create policy del on client_requests for delete
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
end $$;

-- 4) Realtime so new client requests appear in the owner's Requests tab live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.client_requests';
  end if;
end $$;
