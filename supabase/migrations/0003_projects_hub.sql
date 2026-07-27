-- Projects hub — fill the schema gaps the hub's richer features want.
-- Idempotent: safe to run more than once. The hub already works without this
-- (NEXT DEADLINE is derived from task scheduled_date; Activity is derived from
-- task created/completed timestamps). Applying this unlocks explicit project
-- deadlines + a persistent project-level activity log.

-- 1) Explicit project deadline (the existing `status` text column already covers
--    active/paused/completed/archived — no change needed there).
alter table projects add column if not exists deadline date;
alter table projects add column if not exists deadline_label text;

-- 2) Project-level activity log (task created/completed, status changes, manual notes).
create table if not exists project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,                 -- task_created | task_completed | status_change | note
  body text,
  created_at timestamptz default now()
);

-- owner-only RLS, matching every other user_id-owned table
alter table project_activity enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_activity' and policyname='sel') then
    create policy sel on project_activity for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_activity' and policyname='ins') then
    create policy ins on project_activity for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_activity' and policyname='upd') then
    create policy upd on project_activity for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_activity' and policyname='del') then
    create policy del on project_activity for delete using (user_id = auth.uid());
  end if;
end $$;

-- 3) Realtime for project_activity + time_entries (so logged time / activity update live).
do $$
declare t text;
begin
  foreach t in array array['project_activity','time_entries'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
