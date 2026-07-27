-- Client Portal — Request → Task lifecycle (CLIENT_PORTAL_MASTER_PLAN.md, Phase 1).
-- Turns the fire-and-forget message box into a tracked request with a decision
-- state (pending | needs_info | approved | declined), a persistent two-way link
-- to the task it becomes, and a client↔team message thread. Delivery state
-- (in progress / completed) is DERIVED from the linked task — never stored — so
-- the client's view tracks real work with zero extra bookkeeping.
--
-- Security is unchanged: anon RLS stays closed. Public reads/writes (submit,
-- reply, status) go through token-scoped service-role server actions that
-- validate the token first. These policies only ever let the owner manage their
-- own rows.

-- 1) Evolve client_requests: decision state + link + attribution.
alter table client_requests
  add column if not exists title           text,
  add column if not exists client_id       uuid references clients on delete set null,
  add column if not exists task_id         uuid references tasks   on delete set null,
  add column if not exists resolution_note text,
  add column if not exists updated_at      timestamptz default now();

-- Backfill: title from the first line of the body; client from the project.
update client_requests
  set title = nullif(btrim(split_part(body, E'\n', 1)), '')
  where title is null;

update client_requests cr
  set client_id = p.client_id
  from projects p
  where cr.project_id = p.id and cr.client_id is null and p.client_id is not null;

-- Migrate the status vocabulary. Old: new | seen | done. New decision states:
--   new  → pending      (awaiting a decision)
--   seen → pending      ("seen" was never a decision — collapse into pending)
--   done → approved     (it had been actioned)
alter table client_requests drop constraint if exists client_requests_status_check;
update client_requests set status = case status
  when 'new'  then 'pending'
  when 'seen' then 'pending'
  when 'done' then 'approved'
  else status end;
alter table client_requests
  add constraint client_requests_status_check
  check (status in ('pending','needs_info','approved','declined'));
alter table client_requests alter column status set default 'pending';

-- Keep updated_at fresh (function defined in 0001_init.sql).
drop trigger if exists trg_client_requests_updated_at on client_requests;
create trigger trg_client_requests_updated_at
  before update on client_requests
  for each row execute function set_updated_at();

-- 2) The return path: a task remembers the request it came from.
alter table tasks add column if not exists request_id uuid references client_requests on delete set null;
create index if not exists idx_tasks_request on tasks(request_id) where request_id is not null;

-- 3) The client↔team thread. client_facing=false is a team-only note that is
-- NEVER projected to the portal (same discipline as internal task notes).
create table if not exists request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references client_requests on delete cascade not null,
  author text check (author in ('team','client')) not null,
  body text not null,
  client_facing boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_request_messages_request on request_messages(request_id, created_at);

-- RLS: owner-only, resolved through the request's project. No insert policy for
-- the client — client replies are written by the token-scoped server action
-- (service role), exactly like client_requests inserts.
alter table request_messages enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='request_messages' and policyname='sel') then
    create policy sel on request_messages for select
      using (exists (
        select 1 from client_requests cr join projects p on p.id = cr.project_id
        where cr.id = request_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='request_messages' and policyname='ins') then
    create policy ins on request_messages for insert
      with check (exists (
        select 1 from client_requests cr join projects p on p.id = cr.project_id
        where cr.id = request_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='request_messages' and policyname='upd') then
    create policy upd on request_messages for update
      using (exists (
        select 1 from client_requests cr join projects p on p.id = cr.project_id
        where cr.id = request_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='request_messages' and policyname='del') then
    create policy del on request_messages for delete
      using (exists (
        select 1 from client_requests cr join projects p on p.id = cr.project_id
        where cr.id = request_id and p.user_id = auth.uid()));
  end if;
end $$;

-- 4) Realtime so the owner's inbox and the client's thread update live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'request_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.request_messages';
  end if;
end $$;
