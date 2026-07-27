-- Feedback — the loop primitive from MASTER_PRODUCT_PLAN.md (the "fabric" layer).
-- Customer signal becomes a first-class object: captured from a client or deal,
-- weighted by the revenue of the deals that want it (feedback_deals rollup),
-- and shipped by promoting it to a task (task_id). This is what closes the
-- talk → get feedback → log → ship → close-deal → repeat loop. Also adds
-- `meetings` (client conversations that feedback is extracted from) and the
-- feedback↔meeting/client links. Owner-only RLS matching every other
-- user_id-owned table; the app hides these surfaces until this is applied
-- (the queries simply return nothing when the tables are absent).

-- 1) Feedback items.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete set null,
  number int not null default 0,          -- human-facing id (#34), assigned per user
  title text not null,
  body text,
  status text not null default 'open'
    check (status in ('open','planned','in_progress','shipped','declined')),
  source text,                            -- 'meeting' | 'client' | 'deal' | 'portal' | 'manual'
  client_id uuid references clients on delete set null,  -- who asked (CRM attribution)
  task_id uuid references tasks on delete set null,  -- the work that ships it
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_feedback_user on feedback(user_id, status);
create index if not exists idx_feedback_client on feedback(client_id) where client_id is not null;

drop trigger if exists set_feedback_updated_at on feedback;
create trigger set_feedback_updated_at before update on feedback
  for each row execute function set_updated_at();

alter table feedback enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='feedback' and policyname='sel') then
    create policy sel on feedback for select using (user_id = auth.uid());
    create policy ins on feedback for insert with check (user_id = auth.uid());
    create policy upd on feedback for update using (user_id = auth.uid());
    create policy del on feedback for delete using (user_id = auth.uid());
  end if;
end $$;

-- 2) Feedback ↔ deal (lead) joins — the revenue rollup.
--    "$ at stake" for a feature = Σ value of the deals linked to its feedback.
create table if not exists feedback_deals (
  feedback_id uuid references feedback on delete cascade not null,
  lead_id uuid references leads on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (feedback_id, lead_id)
);
create index if not exists idx_feedback_deals_lead on feedback_deals(lead_id);

alter table feedback_deals enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='feedback_deals' and policyname='sel') then
    create policy sel on feedback_deals for select using (user_id = auth.uid());
    create policy ins on feedback_deals for insert with check (user_id = auth.uid());
    create policy upd on feedback_deals for update using (user_id = auth.uid());
    create policy del on feedback_deals for delete using (user_id = auth.uid());
  end if;
end $$;

-- 2b) Meetings — a client interaction (call/meeting) with running notes or a
--     transcript. This is where feedback comes from: items extracted from a
--     meeting point back via feedback.meeting_id (the "2.2" card in the plan).
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete set null,
  client_id uuid references clients on delete set null,
  title text not null,
  notes text,                             -- transcript / running notes
  met_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_meetings_client on meetings(client_id, met_at desc);

drop trigger if exists set_meetings_updated_at on meetings;
create trigger set_meetings_updated_at before update on meetings
  for each row execute function set_updated_at();

alter table meetings enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='sel') then
    create policy sel on meetings for select using (user_id = auth.uid());
    create policy ins on meetings for insert with check (user_id = auth.uid());
    create policy upd on meetings for update using (user_id = auth.uid());
    create policy del on meetings for delete using (user_id = auth.uid());
  end if;
end $$;

-- Feedback traces back to the meeting it was pulled out of.
alter table feedback add column if not exists meeting_id uuid references meetings on delete set null;
create index if not exists idx_feedback_meeting on feedback(meeting_id) where meeting_id is not null;

-- 3) Realtime, matching the existing publication setup.
do $$
declare t text;
begin
  foreach t in array array['feedback','feedback_deals','meetings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
