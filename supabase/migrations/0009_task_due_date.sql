-- Task due dates. The Week composer (and future task detail) can set a due date
-- distinct from scheduled_date (when you plan to work on it). Owner-only RLS is
-- already enforced by the existing tasks policies — this only adds a column.
-- addTask degrades gracefully until this is applied (it omits due_date), so
-- applying this is what makes the composer's "due" chip actually persist.

alter table tasks add column if not exists due_date date;

-- Cheap lookups for "due this week / overdue" style queries later.
create index if not exists idx_tasks_due on tasks(due_date) where due_date is not null;
