-- Milestones become workstreams — ledger entry 0041.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- A project had TWO levels between itself and its tasks, and neither worked:
--
--   MILESTONE   a dated checkpoint that OWNS NOTHING. "Will we hit Beta to
--               client?" was unanswerable, because no work hung off it.
--   WORKSTREAM  a named group that owns tasks and computes progress, but had
--               no date rendered anywhere, so it could never be a phase.
--
-- They are the same level of the hierarchy asked in two different ways —
-- *when* versus *what kind*. Linear resolved exactly this by making the
-- milestone the container: one sub-level, with a target date, owning issues
-- and reporting its own progress. Basecamp attaches progress to the list
-- rather than the item; Monday's group carries a summary. All three point the
-- same way, and 0040 had already given `sections` the `due_date` and `status`
-- this needs — those two columns were simply never wired to any UI.
--
-- So a workstream becomes both things: a phase when it is dated ("Discovery,
-- 12 Sep"), a category when it is not ("Motion"). Milestones then have nothing
-- left to do at project level.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────
-- It does NOT drop `milestones`, and it must not. That table predates projects
-- entirely: it belongs to GOALS (0001), and 0036 merely added `project_id`
-- beside `goal_id` under a check constraint that exactly one is set. Goal
-- milestones are a live feature and not one of their rows is touched here.
--
-- It also does not remove the project-owned rows. They are STAMPED, not
-- deleted:
--
--   · nothing is destroyed, so a bad copy is recoverable;
--   · the rollback is one UPDATE (see the foot of this file);
--   · the stamp is the application's gate — while a project still has an
--     unstamped milestone, its Overview keeps rendering the old, fully
--     editable checkpoint list, so the product is correct both before and
--     after this runs, which is what the sprint rules require of a migration
--     the user applies by hand.
--
-- A later cleanup migration can drop the stamped rows once you are happy. That
-- is a decision for a day when nothing depends on it, not for this one.
--
-- ── IDEMPOTENT BY CONSTRUCTION ──────────────────────────────────────────────
-- The insert only takes unstamped project milestones, and the same statement
-- stamps them. A second run finds none. Safe to paste twice.

begin;

-- 1. The stamp. Nullable, so every existing row reads as "not migrated".
alter table milestones
  add column if not exists migrated_at timestamptz;

comment on column milestones.migrated_at is
  'Set by 0041 when a project milestone was copied into sections as a workstream. '
  'Non-null rows are ignored by the app. Goal milestones are never stamped.';

-- 2. Copy every unstamped PROJECT-owned milestone into that project's
--    workstreams.
--
--    sort_order continues after the project's existing streams rather than
--    restarting at 0, so a project that already had "Discovery / Design" does
--    not get its checkpoints interleaved into the middle of them. The window
--    orders incoming rows by date first, which is how a phase list reads.
--
--    `done` becomes an EXPLICIT status, and that is load-bearing:
--    `lib/workstreams.ts` DERIVES a stream's status from its progress, and a
--    checkpoint arrives here owning no tasks — so a finished one would derive
--    as "no status" and silently look unstarted. `statusOf` states the rule
--    this leans on: an explicit status always wins, because it is a fact about
--    intent that progress cannot know.
--
--    client_visible is FALSE, like every other thing that can reach a client
--    (0039, 0040). Nobody has expressed an intention about these rows, and the
--    unsafe direction shows a client a checkpoint called "Chase unpaid invoice".
with moved as (
  select
    m.id,
    m.user_id,
    m.project_id,
    m.title,
    coalesce((select max(s.sort_order) from sections s where s.project_id = m.project_id), -1)
      + row_number() over (
          partition by m.project_id
          order by m.due_date nulls last, m.sort_order, m.created_at
        ) as sort_order,
    case when m.done then 'completed' end as status,
    m.due_date
  from milestones m
  where m.project_id is not null
    and m.migrated_at is null
),
inserted as (
  insert into sections (user_id, project_id, name, sort_order, status, due_date, client_visible)
  select user_id, project_id, title, sort_order, status, due_date, false
  from moved
  returning 1
)
update milestones
   set migrated_at = now()
 where id in (select id from moved);

commit;

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Un-stamping brings the checkpoint list back; the workstreams it created are
-- ordinary rows you can delete from the UI, or with the second statement.
--
--   update milestones set migrated_at = null where migrated_at is not null;
--   -- and, if you want the copies gone as well, review before running:
--   -- delete from sections s
--   --  where exists (select 1 from milestones m
--   --                 where m.project_id = s.project_id
--   --                   and m.title = s.name
--   --                   and m.migrated_at is not null);
