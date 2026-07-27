-- Saved views — Wave 3 of the PM feature spec (§3.5). A named filter combo the
-- user can recall from the Tasks rail ("Client work due this week"). The filter
-- itself lives in JSONB so new filter dimensions ship without further DDL.
-- Idempotent; owner-only RLS matching every other user_id-owned table. The app
-- degrades gracefully until this is applied (the Views section stays hidden).

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  name text not null,
  filter jsonb not null default '{}'::jsonb,   -- { view, filter, labelId, listId }
  sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_saved_views_space on saved_views(space_id, sort_order);

alter table saved_views enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='saved_views' and policyname='sel') then
    create policy sel on saved_views for select using (user_id = auth.uid());
    create policy ins on saved_views for insert with check (user_id = auth.uid());
    create policy upd on saved_views for update using (user_id = auth.uid());
    create policy del on saved_views for delete using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'saved_views'
  ) then
    alter publication supabase_realtime add table public.saved_views;
  end if;
end $$;
