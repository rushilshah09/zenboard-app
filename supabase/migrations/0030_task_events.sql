-- The timebox twin — master plan §7C/§7D, ledger entry 0030.
--
-- "A timeboxed task is one object with two projections." Dragging a task onto the
-- calendar should not COPY it into an event; it should give the same task a place
-- in the day. That needs one link, readable from both ends: the task's list row
-- has to know it is scheduled, and the calendar block has to know whose it is.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD: a `done` column on calendar_events. The
-- plan says "completing either side completes both", and the cheapest way to make
-- that true is for the event to have no completion of its own — a twin block
-- renders the TASK's `done`, and its checkbox calls the same toggleTask everything
-- else calls. Two mirrors of one state would be a bug waiting to happen; one state
-- with two views cannot disagree.
--
-- Additive and idempotent. Everything degrades: without this migration
-- `taskEventsSupported()` reports false, the Timebox chip is hidden, and the
-- calendar renders every event as an ordinary event — which is what it did before.

-- 1. The link, from both ends. Two columns rather than one join table because the
--    relationship is 1:1 and both sides are read on their own hot path (the task
--    list asks "is this timeboxed?", the calendar asks "whose block is this?"), and
--    a join table would put a second query on both.
alter table tasks
  add column if not exists event_id uuid references calendar_events(id) on delete set null;

alter table calendar_events
  add column if not exists task_id uuid references tasks(id) on delete set null;

-- 2. ON DELETE SET NULL on both sides is the §7D contract encoded in the schema:
--    "deleting the event un-timeboxes (never deletes) the task". The database
--    will never destroy the other half of a twin — un-linking is the worst it
--    does. The application layer decides whether to also remove the leftover
--    (lib/actions/timebox.ts), which is a product decision and belongs there.

-- 3. 1:1, enforced where it cannot be forgotten. Partial unique indexes so the
--    many rows with no twin (the overwhelming majority) do not collide on null.
create unique index if not exists tasks_event_id_key
  on tasks(event_id) where event_id is not null;
create unique index if not exists calendar_events_task_id_key
  on calendar_events(task_id) where task_id is not null;

-- 4. The calendar loads a date window and then needs each block's task state.
--    Without this it is a sequential scan of every event the user owns, on the
--    render path of the most-visited screen after Home.
create index if not exists idx_calendar_events_task on calendar_events(task_id)
  where task_id is not null;

-- RLS: none needed. Both tables already carry owner-only policies on `user_id`,
-- and these are columns on those tables rather than a new one — a user can only
-- reach a twin through a row they already own from both directions.
