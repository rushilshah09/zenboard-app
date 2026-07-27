-- Labels + Sections — Wave 2 of the PM feature spec (PM_FEATURE_SPEC.md §3.2/§3.4).
-- Labels: flat, space-scoped tags on tasks (filterable everywhere; the
-- `@waiting` behavior builds on these — no fifth status). Sections: named
-- dividers inside a project's task list (Things-style headings; board columns
-- stay status-based). Idempotent; owner-only RLS matching every other
-- user_id-owned table. The app degrades gracefully until this is applied
-- (label/section UI simply stays hidden when the tables are missing).

-- 1) Labels.
create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  name text not null,
  color text,
  sort_order int default 0,
  created_at timestamptz default now()
);
-- One name per space, case-insensitive ("Waiting" and "waiting" are the same tag).
create unique index if not exists idx_labels_space_name on labels(space_id, lower(name));

alter table labels enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='labels' and policyname='sel') then
    create policy sel on labels for select using (user_id = auth.uid());
    create policy ins on labels for insert with check (user_id = auth.uid());
    create policy upd on labels for update using (user_id = auth.uid());
    create policy del on labels for delete using (user_id = auth.uid());
  end if;
end $$;

-- 2) Task ↔ label joins.
create table if not exists task_labels (
  task_id uuid references tasks on delete cascade not null,
  label_id uuid references labels on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (task_id, label_id)
);
create index if not exists idx_task_labels_label on task_labels(label_id);

alter table task_labels enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='task_labels' and policyname='sel') then
    create policy sel on task_labels for select using (user_id = auth.uid());
    create policy ins on task_labels for insert with check (user_id = auth.uid());
    create policy upd on task_labels for update using (user_id = auth.uid());
    create policy del on task_labels for delete using (user_id = auth.uid());
  end if;
end $$;

-- 3) Sections within a project.
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects on delete cascade not null,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_sections_project on sections(project_id, sort_order);

alter table sections enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='sections' and policyname='sel') then
    create policy sel on sections for select using (user_id = auth.uid());
    create policy ins on sections for insert with check (user_id = auth.uid());
    create policy upd on sections for update using (user_id = auth.uid());
    create policy del on sections for delete using (user_id = auth.uid());
  end if;
end $$;

-- 4) Tasks point at their section; deleting a section keeps its tasks.
alter table tasks add column if not exists section_id uuid references sections on delete set null;
create index if not exists idx_tasks_section on tasks(section_id) where section_id is not null;

-- 5) Realtime, matching the existing publication setup.
do $$
declare t text;
begin
  foreach t in array array['labels','task_labels','sections'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
