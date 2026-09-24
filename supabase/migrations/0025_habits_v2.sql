-- Habits v2 — the redesigned tracker (Zenboard DS, no integrations, no AI).
-- Adds time-of-day grouping, a REPEAT SCHEDULE, per-day goal counting, archive,
-- ordering, and a per-log status so a day can be COMPLETED or SKIPPED (not just
-- done/undone).
--
-- Every statement is `if not exists` / guarded, so this file is SAFE TO RE-RUN.
-- If you already applied an earlier version of it, run it again to pick up the
-- schedule and count columns in section 3.
--
-- Additive throughout: the app degrades gracefully until this is applied (the
-- Habits page falls back to a plain daily list; the Today home is unaffected).

-- 1) Richer habit definition.
alter table habits add column if not exists time_of_day text not null default 'any';   -- any | morning | afternoon | evening
alter table habits add column if not exists goal_target int not null default 1;         -- "N times"
alter table habits add column if not exists goal_period text not null default 'day';    -- day | week
alter table habits add column if not exists sort_order int not null default 0;
alter table habits add column if not exists archived boolean not null default false;
alter table habits add column if not exists color text;                                 -- optional dot colour (hue token name)

-- Keep time_of_day honest.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_time_of_day_check') then
    alter table habits add constraint habits_time_of_day_check
      check (time_of_day in ('any','morning','afternoon','evening'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habits_goal_period_check') then
    alter table habits add constraint habits_goal_period_check
      check (goal_period in ('day','week'));
  end if;
end $$;

-- 2) Per-log status: a day can be completed or explicitly skipped. `done` stays
-- for back-compat (Today home + the existing streak query read it); a skip is a
-- row with done=false, status='skipped'. Clearing a day deletes the row.
alter table habit_logs add column if not exists status text not null default 'done';    -- done | skipped

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_logs_status_check') then
    alter table habit_logs add constraint habit_logs_status_check
      check (status in ('done','skipped'));
  end if;
end $$;

-- One row per (habit, day) — the upsert target the actions already rely on.
create unique index if not exists idx_habit_logs_habit_day on habit_logs(habit_id, log_date);

-- 3) Repeat schedule + goal counting (the reason the review numbers can be
-- trusted). Before this, every habit was implicitly due EVERY day: a
-- weekday-only habit was scored as having failed every weekend it ever lived
-- through, and `goal_target` was displayed ("3×/day") while the UI could only
-- record a single binary check. Both are now real.
--
--   schedule_kind  daily  — every day
--                  days   — only the weekdays in schedule_days
--                  weekly — schedule_count times a week, on any days
--   schedule_days  0 = Sunday … 6 = Saturday. Only read when kind = 'days'.
--   schedule_count times per week. Only read when kind = 'weekly'.
alter table habits add column if not exists schedule_kind text not null default 'daily';
alter table habits add column if not exists schedule_days int[] not null default '{}';
alter table habits add column if not exists schedule_count int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_schedule_kind_check') then
    alter table habits add constraint habits_schedule_kind_check
      check (schedule_kind in ('daily','days','weekly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habits_schedule_count_check') then
    alter table habits add constraint habits_schedule_count_check
      check (schedule_count between 1 and 7);
  end if;
end $$;

-- How many times it was done that day. `done` stays the source of truth for
-- "did this day count" (Today home and the streak query read it), so a partial
-- day is count > 0 with done = false — it shows progress without claiming
-- completion, and nothing that reads the old column has to change.
alter table habit_logs add column if not exists count int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_logs_count_check') then
    alter table habit_logs add constraint habit_logs_count_check check (count >= 0);
  end if;
end $$;

-- Carry the old "N times per week" goal over to the schedule that now expresses
-- it. goal_period stays in place for back-compat but is no longer read: a habit
-- is due on days (schedule_*) and has a per-day target (goal_target), which are
-- two separate questions the old single control conflated.
update habits
   set schedule_kind = 'weekly',
       schedule_count = least(7, greatest(1, goal_target)),
       goal_target = 1
 where goal_period = 'week'
   and schedule_kind = 'daily';
