-- Calendar sync connections — per-user Google OAuth tokens for two-way sync.
--
-- SECURITY: OAuth tokens must never reach the browser. RLS is enabled with NO
-- policies, so the anon / authenticated clients can't read or write this table at
-- all — only the server (service-role client, which bypasses RLS) touches it.
-- Connection *status* (connected / account / last-synced) is mirrored into
-- profiles.preferences, which is safe to read client-side.
--
-- v1 stores one Google connection per user (unique on user_id, provider). Adding
-- a second account later means relaxing that to (user_id, provider, account_email).

create table if not exists calendar_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users on delete cascade not null,
  provider         text not null default 'google',
  account_email    text,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  calendar_id      text not null default 'primary',
  sync_token       text,          -- Google incremental-sync cursor
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id, provider)
);

create index if not exists idx_calendar_connections_user on calendar_connections(user_id);

-- RLS on, no policies → server (service-role) only.
alter table calendar_connections enable row level security;
