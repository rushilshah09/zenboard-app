-- Zenboard AI chat. The base tables (ai_conversations / ai_messages) shipped in
-- 0001 with RLS; this adds what the chat surface needs:
--   · updated_at — the Chats rail sorts by last activity ("Last updated …")
--   · pinned     — pinned chats float to the top of the rail
--   · rating     — 👍 / 👎 on an assistant reply (-1 | 1, null = unrated)
--   · meta       — structured extras on a reply (e.g. proposed tasks the user
--                  can add with one tap — the AI never writes on its own)
alter table ai_conversations add column if not exists updated_at timestamptz default now();
alter table ai_conversations add column if not exists pinned boolean default false;

alter table ai_messages add column if not exists rating smallint;
alter table ai_messages drop constraint if exists ai_messages_rating_check;
alter table ai_messages add constraint ai_messages_rating_check check (rating is null or rating in (-1, 1));
alter table ai_messages add column if not exists meta jsonb;

create index if not exists idx_ai_conversations_user on ai_conversations(user_id, updated_at desc);
create index if not exists idx_ai_messages_conversation on ai_messages(conversation_id, created_at);
