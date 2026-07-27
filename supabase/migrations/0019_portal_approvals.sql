-- Client Portal — deliverable approvals (CLIENT_PORTAL_MASTER_PLAN.md §7.1, Phase 3).
-- The owner asks the client to sign off on a document; the client Approves or
-- Requests changes (with a note). Same shape as the request lifecycle: a decision
-- state that flows back to the portal, no free-form chat required. anon RLS stays
-- closed — the client's decision is written by a token-scoped service-role action.
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade not null,
  page_id uuid references pages on delete cascade not null,
  title text,                                    -- doc title snapshot at request time
  status text check (status in ('awaiting','approved','changes_requested')) default 'awaiting',
  note text,                                     -- the client's change-request / sign-off note
  decided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_approvals_project on approvals(project_id, created_at desc);
create index if not exists idx_approvals_page on approvals(page_id);

drop trigger if exists trg_approvals_updated_at on approvals;
create trigger trg_approvals_updated_at
  before update on approvals
  for each row execute function set_updated_at();

-- RLS: owner-only, resolved through the approval's project. Client decisions come
-- from the token-scoped server action (service role), never anon.
alter table approvals enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='approvals' and policyname='sel') then
    create policy sel on approvals for select
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='approvals' and policyname='ins') then
    create policy ins on approvals for insert
      with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='approvals' and policyname='upd') then
    create policy upd on approvals for update
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='approvals' and policyname='del') then
    create policy del on approvals for delete
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
end $$;

-- Realtime so the owner's approvals list updates the moment the client decides.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'approvals'
  ) then
    execute 'alter publication supabase_realtime add table public.approvals';
  end if;
end $$;
