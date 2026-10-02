-- 0049 — ASK REMEMBERS ITS CONVERSATIONS
--
-- It depends on nothing but `auth.users` and `spaces`, so it can be applied at any point after
-- those exist — the number is a position in the queue, not a prerequisite.
--
-- IT WAS WRITTEN AS 0044 AND RENUMBERED 2026-09-30. Chat's reactions had already claimed 0044
-- (0044_message_reactions.sql, five days earlier), so there were two files with one number in a
-- directory the user applies BY HAND, in order, by pasting. Two 0044s is not an untidy name: it is
-- an ambiguous instruction about what has already been run, in the one place where the answer has
-- to be unambiguous.
--
-- USER DIRECTION 2026-09-29: "left side of history chat collessable … i want claude like claude
-- chat expirence", with Claude's and Notion AI's sidebars. Ask's store (lib/ask-store.ts) is
-- in-memory: it holds ONE conversation and loses it on reload. A history rail needs the
-- conversations to exist somewhere, which is this.
--
-- TWO TABLES, because a conversation and its messages have different lifetimes and different
-- read patterns: the rail lists conversations (never their bodies), and opening one reads its
-- messages. One table with a jsonb array would make the rail read every message in the account
-- to draw a list of titles.
--
-- WHAT IS DELIBERATELY NOT HERE:
--   · No `space_id` on messages. A message belongs to its conversation and nothing reads messages
--     without one, so the space lives in one place and cannot disagree with itself.
--   · No title column that a model writes. The title is the first thing the person said, trimmed —
--     the same rule Ask already holds: a model never names a record (lib/ask.ts). It is a plain
--     column so a person can rename it, which is the only way it ever changes.
--   · No `updated_at` trigger. The rail groups by `last_message_at`, which the write path sets
--     explicitly in the same statement that inserts the message; a trigger would be a second
--     writer of one fact.

create table if not exists public.ask_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  -- The person's own first sentence, trimmed. Never model-written; renameable.
  title text not null,
  -- The rail's sort key and its date grouping ("Today", "Sep 27", "Older"), set by the write path.
  last_message_at timestamptz not null default now(),
  -- Pinned conversations sit above the dated groups, as they do in the references.
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ask_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ask_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'said' is the person, 'answered' is Ask. Two values, checked, rather than a free text column
  -- that drifts into three.
  role text not null check (role in ('said', 'answered')),
  -- The person's sentence, or the answer's own `text`. The rest of an answer (its kind, records,
  -- proposal) is in `payload`, because those shapes are the app's and change with it.
  body text not null,
  -- The whole `AskAnswer`, and its `trace` with it — so reopening a conversation shows the same
  -- receipts it showed live, rather than a sentence with its evidence gone.
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ask_conversations_user_recent_idx
  on public.ask_conversations (user_id, last_message_at desc);
create index if not exists ask_messages_conversation_idx
  on public.ask_messages (conversation_id, created_at);

alter table public.ask_conversations enable row level security;
alter table public.ask_messages enable row level security;

-- RLS is the only thing standing between two accounts' conversations, so each table states all
-- four verbs explicitly rather than relying on a permissive default.
create policy ask_conversations_select on public.ask_conversations
  for select using (auth.uid() = user_id);
create policy ask_conversations_insert on public.ask_conversations
  for insert with check (auth.uid() = user_id);
create policy ask_conversations_update on public.ask_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ask_conversations_delete on public.ask_conversations
  for delete using (auth.uid() = user_id);

-- Messages are scoped by their OWN user_id as well as their conversation's. Both, on purpose: the
-- column makes every row self-describing (no join to decide who may read it), and the EXISTS makes
-- it impossible to attach a message to someone else's conversation even with a matching user_id.
create policy ask_messages_select on public.ask_messages
  for select using (
    auth.uid() = user_id
    and exists (select 1 from public.ask_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy ask_messages_insert on public.ask_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.ask_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy ask_messages_delete on public.ask_messages
  for delete using (auth.uid() = user_id);
