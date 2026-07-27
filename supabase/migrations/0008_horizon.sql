-- Horizon: allow a 'month' horizon, constrain goal status, and index the
-- task→goal link so goal progress (linked tasks done/total) is cheap. Builds on
-- the existing goals + tasks.goal_id model — no new tables.

-- Relax the horizon check to include 'month' (was quarter/year only).
alter table goals drop constraint if exists goals_horizon_check;
alter table goals add constraint goals_horizon_check check (horizon in ('month', 'quarter', 'year'));

-- Constrain status to the lifecycle the UI uses.
alter table goals drop constraint if exists goals_status_check;
alter table goals add constraint goals_status_check check (status in ('active', 'done', 'dropped'));

-- Goal progress rolls up from linked tasks (tasks.goal_id).
create index if not exists idx_tasks_goal on tasks(goal_id);
