-- 0043 — project messages: a Slack-style channel per project, between the owner and the client.
--
-- See CHAT_PLAN.md. A conversation belongs to a PROJECT because the portal token belongs to a
-- project (`projects.portal_token`): a portal link can therefore never read more than it already
-- can. Per-client chat would let a leaked link to one project read another project's messages.
--
-- SECURITY — the `request_messages` (0017) pattern, unchanged:
--   · the OWNER reads and writes through RLS, resolved through the message's project;
--   · the CLIENT has NO policy at all. Every client read and write goes through a server action
--     that re-resolves the portal token and uses the service role, scoped to that one project.
--     An anon SELECT policy is deliberately absent: it would hand every project's messages to
--     anyone holding the public anon key.
--
-- Idempotent: safe to run twice. Additive only: nothing existing is altered.

create table if not exists project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author text not null check (author in ('team', 'client')),
  -- The name shown on the message. The owner's comes from their profile; a client's is the
  -- client's name on the project. Stored, so history reads correctly if either is renamed later.
  author_name text,
  -- Rendered as TEXT, never HTML. Bounded so one paste cannot become a 50MB row.
  body text not null check (char_length(body) between 1 and 8000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- Soft delete: the row stays so a reply's context survives, the body is cleared by the action.
  deleted_at timestamptz
);

create index if not exists idx_project_messages_project on project_messages(project_id, created_at);

-- Where each side has read up to. One row per (project, side); the unread count is every
-- message after `last_read_at` authored by the OTHER side.
create table if not exists project_message_reads (
  project_id uuid not null references projects(id) on delete cascade,
  reader text not null check (reader in ('team', 'client')),
  last_read_at timestamptz not null default now(),
  primary key (project_id, reader)
);

alter table project_messages enable row level security;
alter table project_message_reads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'project_messages' and policyname = 'owner_sel') then
    create policy owner_sel on project_messages for select
      using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  -- The owner may only ever author as the TEAM. A client message cannot be forged from the app.
  if not exists (select 1 from pg_policies where tablename = 'project_messages' and policyname = 'owner_ins') then
    create policy owner_ins on project_messages for insert
      with check (author = 'team' and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_messages' and policyname = 'owner_upd') then
    create policy owner_upd on project_messages for update
      using (author = 'team' and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'project_message_reads' and policyname = 'owner_all') then
    create policy owner_all on project_message_reads for all
      using (reader = 'team' and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
      with check (reader = 'team' and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
  end if;
end $$;

-- The owner's side streams messages live. Realtime honours the RLS above, so an owner only ever
-- receives their own projects' messages. (The client side polls through the token action.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'project_messages'
  ) then
    alter publication supabase_realtime add table project_messages;
  end if;
end $$;
