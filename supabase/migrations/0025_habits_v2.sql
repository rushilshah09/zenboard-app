-- Habits v2 — the Habitify-inspired redesign (Zenboard DS, no integrations/AI).
-- Adds time-of-day grouping, per-period goals, archive, ordering, and a per-log
-- status so a day can be COMPLETED or SKIPPED (not just done/undone). Idempotent
-- and additive — the app degrades gracefully until this is applied (the redesigned
-- Habits page falls back to the simple list; the Today home is unaffected).

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
