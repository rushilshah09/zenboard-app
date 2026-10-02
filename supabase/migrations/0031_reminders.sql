-- Reminders — master plan §7B ("remind_at (one)") and §7O channel 3, ledger 0031.
--
-- THE SHAPE, and why it is two columns rather than a `reminders` table:
--
-- The anatomy in §7B is frozen at ONE reminder per task. That is a product
-- decision, not a simplification we will regret: Todoist's multiple reminders
-- per task are the reason its reminder UI needs its own modal, and TickTick's
-- reminder list is the clutter the plan's own reference note calls out. One
-- reminder is a column. A second reminder would be a table, and we are not
-- building the second reminder.
--
--   remind_at    — WHEN to speak. An absolute instant (timestamptz), unlike
--                  `scheduled_date`, which is a calendar date with no time.
--                  §7B: "dates are dates (no TZ math on scheduled/due);
--                  reminders are timestamps." This is the one field on a task
--                  where a moment, not a day, is the truth.
--   reminded_at  — WHEN we spoke. Null means "not yet delivered".
--
-- WHY `reminded_at` EXISTS AT ALL. A reminder that fires twice is worse than
-- one that fires late, and the app can be open in three tabs on two machines.
-- Delivery therefore has to be *claimed*, and the claim has to be atomic:
--
--   update tasks set reminded_at = now() where id = $1 and reminded_at is null
--
-- One writer wins that UPDATE; every other tab gets zero rows back and stays
-- quiet. This is why the predicate is `reminded_at is null` and NOT
-- `reminded_at < remind_at` — a two-column comparison PostgREST cannot express,
-- and would not be needed anyway, because rescheduling a reminder always clears
-- `reminded_at` in the same write (lib/actions/reminders.ts). "Delivered" is
-- therefore always about the reminder currently set, never a stale one.
--
-- The same claim is what a future push/email worker will run: it can deliver
-- through another channel without a schema change, and cannot double-send.
--
-- Additive and idempotent. Everything degrades: without this migration
-- `remindersSupported()` reports false, the Remind chip is hidden, and the
-- scheduler never runs a query — which is exactly what the app did before.

alter table tasks
  add column if not exists remind_at timestamptz,
  add column if not exists reminded_at timestamptz;

-- The scheduler's ONE query: "my undelivered reminders, soonest first". A
-- partial index so it covers only rows that are actually pending — in a mature
-- account that is a handful of rows out of thousands of tasks, and the index
-- stays small enough to live in cache. `done` is deliberately NOT in the
-- predicate: it changes constantly (every completion would move a row in and
-- out of the index) and it is a cheap filter on the handful of rows this
-- returns.
create index if not exists idx_tasks_reminder_pending
  on tasks (remind_at)
  where remind_at is not null and reminded_at is null;

-- RLS: none needed. `tasks` already carries owner-only policies on `user_id`,
-- and these are columns on that table rather than a new one. The claim above
-- runs as the signed-in user, so a user can only ever deliver their own
-- reminders — the service role is not involved anywhere in this feature.
