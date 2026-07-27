-- Today home: enable Realtime for the rhythm tables so habit check-offs and
-- calendar changes appear live on /today (and anywhere else they're shown).
-- Idempotent; Realtime still respects RLS (each user only sees their own rows).
-- The Today view also works without this — it loads on navigation and updates
-- optimistically — this only adds live cross-session/device sync.
do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs','calendar_events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
