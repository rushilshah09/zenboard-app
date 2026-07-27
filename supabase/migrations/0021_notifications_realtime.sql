-- Notifications, activated. The `notifications` table (id, user_id, kind, title,
-- body, link, read, created_at) and its owner-only RLS already exist from 0001 —
-- the row was just never written to or read. This migration does two small things
-- so the shell Bell can light up:
--   1. adds an index for the bell's one query (a user's recent unread, newest first);
--   2. adds the table to the realtime publication so a new notification pushes live.
-- The feature degrades gracefully without this: the Bell still fetches on open, it
-- just won't update in real time until the publication line below has run.
-- Idempotent; no schema/RLS changes (those are already live).

create index if not exists idx_notifications_user_unread
  on notifications (user_id, read, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
