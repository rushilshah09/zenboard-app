-- Zenboard initial schema (PRD v2 §8).
-- Conventions: every table has id/created_at; user-owned tables carry user_id and
-- have RLS enabled with owner-only policies. updated_at is maintained by a trigger.
-- A signup trigger seeds a profile + a default space for each new auth user.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Idempotent reset — lets this migration be re-run safely. SAFE on a fresh
-- project (no real data yet): drops our objects so the CREATEs below never
-- collide with a partial earlier run. Remove this block once you have real data.
-- ─────────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop function if exists set_updated_at() cascade;
drop table if exists
  portal_requests, portal_links, ai_messages, ai_conversations, notifications,
  payments, invoice_items, invoices, leads, client_notes, clients,
  page_links, page_versions, pages, folders, calendar_events, rituals,
  habit_logs, habits, time_entries, task_activity, task_comments, tasks,
  milestones, goals, projects, spaces, profiles
  cascade;

-- ─────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Identity ─────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text check (role in ('individual','freelancer','founder')),
  avatar_url text,
  onboarding_complete boolean default false,
  preferences jsonb default '{"accent":"#9A1B6F","density":"comfortable","displayFont":"Rubik"}',
  hourly_rate numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text,
  color text default '#9A1B6F',
  tag text check (tag in ('WORK','LIFE','SIDE')),
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Work spine ───────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  client_id uuid,                                  -- fk added after clients
  name text not null,
  color text,
  status text default 'active',                    -- active | paused | done | archived
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  project_id uuid references projects on delete set null,
  title text not null,
  note text,
  horizon text check (horizon in ('quarter','year')) default 'quarter',
  cadence text check (cadence in ('weekly','monthly')) default 'weekly',
  progress numeric default 0,                      -- 0..1, derived
  behind boolean default false,
  last_reviewed date,
  target_date date,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  goal_id uuid references goals on delete cascade not null,
  title text not null,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  project_id uuid references projects on delete set null,
  goal_id uuid references goals on delete set null,
  parent_task_id uuid references tasks on delete cascade,   -- infinite nesting
  title text not null,
  notes text,
  priority text check (priority in ('low','med','high')) default 'low',
  done boolean default false,
  highlight boolean default false,
  scheduled_date date,
  is_inbox boolean default false,
  estimate_minutes int,
  elapsed_minutes int default 0,                   -- rolled up from time_entries
  recurrence jsonb,
  completed_at timestamptz,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  task_id uuid references tasks on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

create table task_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  task_id uuid references tasks on delete cascade not null,
  kind text not null,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  task_id uuid references tasks on delete set null,
  project_id uuid references projects on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes int,
  source text check (source in ('timer','manual')) default 'timer',
  billed boolean default false,
  created_at timestamptz default now()
);

-- ── Rhythm ───────────────────────────────────────────────────
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,
  title text not null,
  cadence text default 'daily',
  active boolean default true,
  created_at timestamptz default now()
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  habit_id uuid references habits on delete cascade not null,
  log_date date not null,
  done boolean default true,
  unique (habit_id, log_date)
);

create table rituals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  type text check (type in ('daily_plan','daily_shutdown','weekly_review')) not null,
  ritual_date date not null,
  reflection text,
  highlight_task_id uuid references tasks on delete set null,
  energy int,
  data jsonb default '{}',
  completed_at timestamptz,
  unique (user_id, type, ritual_date)
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean default false,
  source text default 'manual',
  external_id text,
  created_at timestamptz default now()
);

-- ── Library (Notes + Docs unified) ───────────────────────────
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade,
  name text not null,
  parent_folder_id uuid references folders on delete cascade,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  folder_id uuid references folders on delete set null,
  project_id uuid references projects on delete set null,
  title text,
  type text default 'note',                        -- note | doc | brief | review | template
  content jsonb default '[]',
  tags text[] default '{}',
  is_daily boolean default false,
  daily_date date,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages on delete cascade not null,
  content jsonb not null,
  created_at timestamptz default now()
);

create table page_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  from_page_id uuid references pages on delete cascade not null,
  to_page_id uuid references pages on delete cascade,
  to_person_id uuid,
  created_at timestamptz default now()
);

-- ── Clients / Pipeline ───────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete set null,
  name text not null,
  contact text, role text, email text,
  status text default 'active',                    -- active | past
  health text default 'good',                      -- good | attention | risk
  since text,
  next_step text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  client_id uuid references clients on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null, contact text,
  value numeric default 0,
  stage text check (stage in ('lead','contacted','proposal','won')) default 'lead',
  source text, note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Money ────────────────────────────────────────────────────
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  number text not null,
  client_id uuid references clients on delete set null,
  project_id uuid references projects on delete set null,
  status text check (status in ('draft','sent','paid','overdue')) default 'draft',
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices on delete cascade not null,
  description text not null,
  quantity numeric default 1,
  unit_amount numeric default 0,
  time_entry_id uuid references time_entries on delete set null,
  sort_order int default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  invoice_id uuid references invoices on delete cascade not null,
  amount numeric not null,
  paid_on date not null,
  method text,
  created_at timestamptz default now()
);

-- ── System ───────────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  kind text not null,
  title text not null, body text,
  link jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations on delete cascade not null,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

create table portal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  project_id uuid references projects on delete cascade not null,
  token text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table portal_requests (
  id uuid primary key default gen_random_uuid(),
  portal_link_id uuid references portal_links on delete cascade not null,
  body text not null,
  submitted_at timestamptz default now()
);

-- deferred fk: project → client
alter table projects add constraint fk_project_client
  foreign key (client_id) references clients on delete set null;

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers (tables that have the column)
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','spaces','projects','goals','milestones','tasks','pages',
    'clients','leads','invoices'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$I
         for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

-- profiles: keyed by id = auth.uid()
alter table profiles enable row level security;
create policy sel on profiles for select using (id = auth.uid());
create policy ins on profiles for insert with check (id = auth.uid());
create policy upd on profiles for update using (id = auth.uid());

-- standard owner policies for every user_id-owned table
do $$
declare t text;
begin
  foreach t in array array[
    'spaces','projects','goals','milestones','tasks','task_comments','task_activity',
    'time_entries','habits','habit_logs','rituals','calendar_events','folders','pages',
    'page_links','clients','client_notes','leads','invoices','payments','notifications',
    'ai_conversations','portal_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy sel on %1$I for select using (user_id = auth.uid())', t);
    execute format('create policy ins on %1$I for insert with check (user_id = auth.uid())', t);
    execute format('create policy upd on %1$I for update using (user_id = auth.uid())', t);
    execute format('create policy del on %1$I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- child tables without user_id: scope through the parent's owner
alter table invoice_items enable row level security;
create policy all_own on invoice_items for all
  using (exists (select 1 from invoices i where i.id = invoice_id and i.user_id = auth.uid()))
  with check (exists (select 1 from invoices i where i.id = invoice_id and i.user_id = auth.uid()));

alter table page_versions enable row level security;
create policy all_own on page_versions for all
  using (exists (select 1 from pages p where p.id = page_id and p.user_id = auth.uid()))
  with check (exists (select 1 from pages p where p.id = page_id and p.user_id = auth.uid()));

alter table ai_messages enable row level security;
create policy all_own on ai_messages for all
  using (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- portal_requests: written only by the server (service role) after token validation.
-- RLS on with no policy = no client/anon access. Service role bypasses RLS.
alter table portal_requests enable row level security;

-- ─────────────────────────────────────────────────────────────
-- New-user trigger: create profile + a default space
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.spaces (user_id, name, emoji, color, tag, sort_order)
  values (new.id, 'Personal', '🌿', '#7B8B5F', 'LIFE', 0);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
