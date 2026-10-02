-- Goals: a `paused` status, and the number the weekly review needs to show a trend.
-- Master plan §7G: the review asks "still true?" and the answer is edit / **pause**
-- / drop. Today `0008_horizon.sql` constrains status to active|done|dropped, so
-- "park this for now" has to be spelled "drop it" — a different, heavier decision.
--
-- Additive and idempotent. Everything degrades: without this migration the review
-- offers Still true / Drop it (both already valid) and shows no trend line.

-- 1. Allow 'paused'. Rebuilding the check is safe — no existing row can hold a
--    value outside the old set, and the new set is a strict superset.
alter table goals drop constraint if exists goals_status_check;
alter table goals add constraint goals_status_check
  check (status in ('active', 'done', 'dropped', 'paused'));

-- 2. The trend the review is supposed to show ("since last review"). `progress`
--    is always current and `last_reviewed` records when it was settled, but the
--    PREVIOUS value was never kept, so "up 15% since last week" was uncomputable.
--    recomputeGoalProgress() copies progress -> progress_at_review before writing
--    the new progress, giving exactly one week of delta.
alter table goals add column if not exists progress_at_review numeric;

-- 3. A goal that finishes deserves a line about how it went (§7G: "completed goal
--    → archive with retro line"). Kept on the goal itself rather than a new table —
--    it is one sentence, written once.
alter table goals add column if not exists retro text;

-- Dropped/paused goals are excluded from the weekly review's active list, so the
-- common query stays "active only" — index it.
create index if not exists idx_goals_space_status on goals(space_id, status);
