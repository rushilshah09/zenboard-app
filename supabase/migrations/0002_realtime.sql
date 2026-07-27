-- Enable Supabase Realtime for the tables the app subscribes to. Idempotent:
-- only adds a table to the supabase_realtime publication if not already a member.
-- Realtime still respects RLS, so each user only receives their own row changes.
do $$
declare t text;
begin
  foreach t in array array['tasks','goals','milestones','projects','task_comments','rituals','clients','client_notes','leads','invoices'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
