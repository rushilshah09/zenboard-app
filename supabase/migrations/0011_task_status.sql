-- Board (kanban) status for tasks. Nullable; a NULL status is treated as 'todo'
-- by the app, so existing rows keep working before/after this runs. The Done
-- column stays driven by tasks.done (authoritative); status only distinguishes
-- the non-done columns (To do / In progress / Review). RLS is inherited from
-- the existing tasks policies — no policy change needed.
alter table public.tasks add column if not exists status text;

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status is null or status in ('todo', 'doing', 'review', 'done'));

-- Backfill: completed tasks land in Done; everything else is implicitly 'todo'.
update public.tasks set status = 'done' where done = true and status is null;

-- Helps the Board group/order within a project.
create index if not exists tasks_project_status_idx on public.tasks (project_id, status, sort_order);
