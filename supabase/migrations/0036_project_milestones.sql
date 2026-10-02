-- Project milestones — master plan §7E: "**Milestones** move to project level:
-- dated checkpoints rendering on Overview + Calendar."
--
-- NUMBERING. §3.3 called this "0032 milestones repoint", but 0032 went to
-- `task_links` (the other half of that ledger row, split because bundling meant
-- neither could be applied without the other) and 0033–0035 are taken. This is
-- the same work under the next free number.
--
-- "REPOINT" IS THE WRONG WORD, and following it literally would break Horizon.
-- Milestones today belong to GOALS and are load-bearing there: the Horizon page
-- renders them, and `lib/goal-rollup.ts` counts them toward a goal's ring. So a
-- milestone gains the ABILITY to belong to a project; it does not move house.
-- One row, two possible owners, exactly one of them set.
--
-- THE THIRD CHANGE, which the plan does not mention but its own words require:
-- milestones have no date column at all. "Dated checkpoints" is not a thing the
-- current table can store, so `due_date` is part of this migration rather than a
-- follow-up — a milestone that cannot be dated cannot render on a calendar.
--
-- Additive and idempotent. Everything degrades: without this migration
-- `projectMilestonesSupported()` reports false, the Overview card is hidden, and
-- goals' milestones behave exactly as they do today.

alter table milestones
  add column if not exists project_id uuid references projects on delete cascade,
  add column if not exists due_date date;

-- `goal_id` has been NOT NULL since 0001, which is precisely what stops a
-- milestone belonging to a project. Dropping the constraint is safe: the CHECK
-- below immediately re-imposes the part that mattered — a milestone always has
-- exactly one owner, never zero.
alter table milestones alter column goal_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'milestones_one_owner'
  ) then
    -- Validates against existing rows on creation. Every row today has a goal
    -- and no project, so `num_nonnulls` is 1 and they all pass.
    alter table milestones
      add constraint milestones_one_owner check (num_nonnulls(goal_id, project_id) = 1);
  end if;
end $$;

-- The Overview's one query: "this project's milestones, soonest first". Partial,
-- because the overwhelming majority of rows are still goal milestones and have
-- no business in this index.
create index if not exists idx_milestones_project
  on milestones (project_id, due_date)
  where project_id is not null;

-- RLS: none needed. `milestones` already carries owner-only policies on
-- `user_id`, and these are columns on that table rather than a new one.
