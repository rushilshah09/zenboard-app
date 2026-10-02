-- Lists — ledger entry 0038.
--
-- THE PROBLEM THIS FIXES. The Tasks rail has had a section headed "List" since
-- it was built, and every row under it was a PROJECT. That was a lie told by a
-- label: a project is a piece of client work with a budget, a client, milestones
-- and a close-out; a list is "Priority", "Self improvement", "Extra work" — a
-- bucket you sort your own day into. Filing a personal errand under a project
-- gave it a client. Making a project just to hold three errands polluted the
-- Projects module, the Finance rollup, and the portal.
--
-- So Lists become their own thing, and the rail gets two sections that mean two
-- different things. A task may sit in a project, in a list, in both, or in
-- neither — they answer different questions ("whose work is this?" vs "which
-- pile do I keep it in?") and neither is derived from the other.
--
-- WHY A TABLE AND NOT A LABEL. Labels (0014) already exist and are many-to-many.
-- A list is exactly one per task and it is a PLACE — it owns ordering, it is a
-- board column, it can be turned off in the sidebar. Modelling it as a label
-- would mean "which of your six labels is the list one?" everywhere forever.
--
-- Additive and idempotent. Everything degrades: without this migration
-- `taskListsSupported()` reports false, the Lists section is hidden, the board
-- groups by project, and Tasks behaves exactly as it did before.

-- 1. The lists themselves. Space-scoped, ordered, colourable — the same shape as
--    `labels` and `saved_views`, because they are the same kind of object: a
--    small user-named thing that belongs to a space and appears in a rail.
create table if not exists task_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  space_id uuid references spaces on delete cascade not null,
  name text not null,
  color text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- One name per space, case-insensitive — "Priority" and "priority" are the same
-- pile, and two rails rows with the same word is a bug you cannot click your way
-- out of. Matches the rule labels already use.
create unique index if not exists idx_task_lists_space_name on task_lists(space_id, lower(name));
create index if not exists idx_task_lists_space on task_lists(space_id, sort_order);

alter table task_lists enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='task_lists' and policyname='sel') then
    create policy sel on task_lists for select using (user_id = auth.uid());
    create policy ins on task_lists for insert with check (user_id = auth.uid());
    create policy upd on task_lists for update using (user_id = auth.uid());
    create policy del on task_lists for delete using (user_id = auth.uid());
  end if;
end $$;

-- 2. The task's list. ON DELETE SET NULL, deliberately: deleting a list must
--    never delete the work inside it. The tasks fall back to having no list,
--    which is a state the app already draws (they appear under "No list"), so
--    there is no orphan to clean up and no confirmation dialog that has to be
--    honest about destroying rows.
alter table tasks
  add column if not exists list_id uuid references task_lists(id) on delete set null;

-- The board reads "every open task in this list" once per column, and the rail
-- counts each list. Without this that is a sequential scan of every task the
-- user owns, per column, on the render path of the module's default screen.
create index if not exists idx_tasks_list on tasks(list_id) where list_id is not null;

-- 3. Realtime, so a list created in one tab appears in the other — the same
--    treatment saved_views got, and for the same reason: the rail is drawn in
--    two places at once (list layout and board layout).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_lists'
  ) then
    alter publication supabase_realtime add table public.task_lists;
  end if;
end $$;
