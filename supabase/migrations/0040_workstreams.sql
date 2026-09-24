-- Workstreams — ledger entry 0040.
--
-- Project → WORKSTREAM → Task → Subtask.
--
-- ── WHY THIS IS NOT A NEW TABLE ─────────────────────────────────────────────
-- The level already exists. `sections` (0014) is exactly Project → X → Task:
-- it has `project_id`, a name, an order, and `tasks.section_id` already points
-- at it. Create/rename/delete already work and the project Tasks tab already
-- groups by it.
--
-- What it does NOT have is anything that makes it a workstream rather than a
-- heading: no status, no deadline, and — the one that matters most — no way to
-- say "this stream is ours, that one is the client's". It was built as a
-- Things-style divider and named accordingly, so it reads as formatting.
--
-- Promoting it is therefore additive: three columns, no data migration, and
-- every project that already has sections becomes a project with workstreams
-- the moment this lands. Building a parallel `subprojects` table beside it
-- would have meant two things that mean the same thing, a migration to move
-- rows between them, and a fork in every query that groups tasks.
--
-- ── WHY NOT SELF-REFERENCING PROJECTS ───────────────────────────────────────
-- `projects.parent_id` would inherit status, deadline, files, activity and the
-- portal flags for free. It was rejected: every existing query that reads
-- `projects where space_id = …` — the gallery, the Finance rollup, the client
-- detail, the sidebar — would start returning workstreams as top-level
-- projects, and each would need a `parent_id is null` it currently lacks. That
-- is a large blast radius to buy fields most workstreams will never set.
--
-- It also opens a question the product should not answer: can a subproject have
-- a subproject? Four fixed levels is the shape asked for, and a table that
-- cannot nest cannot drift into infinite nesting later by accident.

-- 1. Status. The same vocabulary projects use, so one badge component and one
--    set of words serve both. `null` = no status set, which is the honest
--    default for the many workstreams that are just a grouping.
alter table sections
  add column if not exists status text;

-- 2. A deadline of its own. Nullable: "Logo design" may be due before the
--    project, or not be a date-driven thing at all.
alter table sections
  add column if not exists due_date date;

-- 3. THE IMPORTANT ONE. An agency keeps some streams entirely internal —
--    "Internal QA", "Subcontractor" — and shows others. Same column name,
--    same default and same meaning as `tasks`, `pages` and `attachments`
--    (0039), so ONE rule reads all four (lib/visibility.ts).
--
--    DEFAULT FALSE, like the others: a stream is internal until somebody says
--    otherwise. Every section that exists today was created when this concept
--    did not, so nobody has expressed an intention about any of them — and the
--    unsafe direction here shows a client the workstream called "Chasing
--    unpaid invoice".
alter table sections
  add column if not exists client_visible boolean not null default false;

-- The portal asks "which workstreams may this client see?" on every load.
create index if not exists idx_sections_client_visible
  on sections(project_id) where client_visible = true;

-- RLS: none needed. `sections` already carries owner-only policies on
-- `user_id`, and these are columns on that table. The portal reads through the
-- service role and applies the visibility rule in the projection, exactly as it
-- does for tasks and pages.

-- NOT ADDED, and worth saying why rather than leaving a gap someone re-derives:
--
--   · ASSIGNEES. The whole app is single-owner — `user_id` with owner-only RLS
--     on every table. There is nobody to assign to. Adding the column now
--     would be a field that can only ever hold your own id. It belongs to the
--     team-seats track, with the policy changes that make it mean something.
--   · PER-WORKSTREAM FILES. `attachments` hangs off project / task / page. A
--     file already reaches a workstream through its task, and a fourth owner
--     column is worth adding only once someone wants a file on the stream but
--     on none of its tasks.
--   · PER-WORKSTREAM ACTIVITY. `project_activity` is project-scoped and reads
--     as one story. Splitting it per stream fragments the one view that
--     answers "what happened on this project this week".
