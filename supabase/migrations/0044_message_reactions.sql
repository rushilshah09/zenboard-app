-- 0044 — reactions on project messages (chat C3). Apply AFTER 0043.
--
-- One row per (message, side, emoji): the team and the client can each react once with each emoji, and
-- reacting again takes it back — Slack's toggle. There are two sides and no individual users (Zenboard is
-- single-player and clients reach chat through a portal link; see CHAT_PLAN.md), so `reactor` is the SIDE.
--
-- A REACTION IS NEVER DELETED. Taking one back sets `removed_at`; adding it again clears it.
--   Supabase's realtime stream checks INSERTs and UPDATEs against RLS before it sends them, but it cannot
--   check a DELETE — the row is gone — so it sends every DELETE's primary key to EVERY subscriber of the
--   table. Here the key is (message, side, emoji): a delete would tell every Zenboard account that someone,
--   somewhere, took back a 👍. As an UPDATE, the change reaches only the owner RLS says it belongs to.
--   (There is deliberately no delete policy. The only deletes are the message's own cascade.)
--
-- SECURITY — the 0043 pattern, unchanged:
--   · the OWNER reads and writes through RLS, resolved through the message's project, and only ever as
--     the team;
--   · the CLIENT has NO policy. Their reactions go through a token-scoped server action on the service
--     role, which checks the message belongs to the token's project and forces `reactor = 'client'`;
--   · the emoji is checked against an allowlist in both actions (lib/chat.ts REACTIONS); the length bound
--     here is the backstop, so a stored reaction can never be a sentence.
--
-- Idempotent: safe to run twice. Additive only.

create table if not exists project_message_reactions (
  message_id uuid not null references project_messages(id) on delete cascade,
  reactor text not null check (reactor in ('team', 'client')),
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (message_id, reactor, emoji)
);

create index if not exists idx_project_message_reactions_message on project_message_reactions(message_id);

alter table project_message_reactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'project_message_reactions' and policyname = 'owner_sel') then
    create policy owner_sel on project_message_reactions for select
      using (exists (
        select 1 from project_messages m join projects p on p.id = m.project_id
        where m.id = message_id and p.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_message_reactions' and policyname = 'owner_ins') then
    create policy owner_ins on project_message_reactions for insert
      with check (reactor = 'team' and exists (
        select 1 from project_messages m join projects p on p.id = m.project_id
        where m.id = message_id and p.user_id = auth.uid()));
  end if;
  -- Taking a reaction back, or adding it again, is an update of the team's own row.
  if not exists (select 1 from pg_policies where tablename = 'project_message_reactions' and policyname = 'owner_upd') then
    create policy owner_upd on project_message_reactions for update
      using (reactor = 'team' and exists (
        select 1 from project_messages m join projects p on p.id = m.project_id
        where m.id = message_id and p.user_id = auth.uid()))
      with check (reactor = 'team' and exists (
        select 1 from project_messages m join projects p on p.id = m.project_id
        where m.id = message_id and p.user_id = auth.uid()));
  end if;
end $$;

-- The owner's side streams reactions live, like messages; RLS limits the stream to their own projects.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'project_message_reactions'
  ) then
    alter publication supabase_realtime add table project_message_reactions;
  end if;
end $$;
