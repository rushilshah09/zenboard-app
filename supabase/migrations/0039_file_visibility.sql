-- Per-file client visibility — ledger entry 0039, sprint S1 of
-- AGENCY_WORKFLOW_PLAN.md.
--
-- THE INCONSISTENCY THIS CLOSES. Four kinds of thing can reach a client, and
-- they obeyed four different rules:
--
--     tasks    per-item `client_visible`         ✔
--     pages    per-item `client_visible`         ✔
--     files    project-level `share_files` only  ← all or nothing
--     updates  not shareable at all              ← S2
--
-- So you could hand a client one task but never one file: you shared every
-- attachment on the project or none of them. In practice that means agencies
-- share nothing, because "every file on the project" includes the working
-- files, the rejected cuts, and the contract with the subcontractor.
--
-- Same column name and same default as `tasks` and `pages` deliberately. The
-- rule that reads it is one function (`lib/visibility.ts`), and three tables
-- spelling the same idea three ways is how that function would have ended up
-- with three branches.

alter table attachments
  add column if not exists client_visible boolean not null default false;

-- DEFAULT FALSE, and it matters more here than anywhere else. Every file that
-- already exists was uploaded under a regime where per-file sharing did not
-- exist, so nobody has ever expressed an intention about any of them. Defaulting
-- to true would publish an agency's entire back catalogue of working files the
-- moment this migration ran. The safe failure is a client asking where a file
-- is; the unsafe one cannot be undone.

-- The portal asks "which files on this project may this client see?" on every
-- load. Without this it is a scan of every attachment the user owns.
create index if not exists idx_attachments_client_visible
  on attachments(project_id) where client_visible = true;

-- RLS: none needed. `attachments` already carries owner-only policies on
-- `user_id`, and this is a column on that table rather than a new one. The
-- portal reads through the service role and applies the visibility rule in
-- `lib/portal.ts`, exactly as it already does for tasks and pages — the
-- database is not the gate here, the projection is.

-- ── BACKFILL: keep every portal showing exactly what it shows today ─────────
--
-- `lib/portal.ts` used to read the task gates as "bucket flag OR per-task
-- override": with `share_completed_tasks` ON, EVERY completed task reached the
-- client and `client_visible` was ignored. That defeated the whole
-- internal-vs-client-facing distinction — the one switch an agency would
-- obviously turn on published the internal task list.
--
-- It now requires BOTH gates (lib/visibility.ts). Without this backfill that
-- change would empty every live portal the next time it loaded, because no
-- task was ever marked: the flag was doing the work.
--
-- So: for every project whose bucket flag is on, mark the tasks that flag was
-- already publishing. Same portal contents before and after; the difference is
-- that from now on the marks are explicit, and NEW work is internal until
-- somebody says otherwise.
--
-- Idempotent: `and client_visible is distinct from true` means re-running
-- touches nothing, and it never un-marks anything a person marked by hand.

update tasks t
   set client_visible = true
  from projects p
 where t.project_id = p.id
   and t.done = true
   and p.share_completed_tasks = true
   and t.client_visible is distinct from true;

update tasks t
   set client_visible = true
  from projects p
 where t.project_id = p.id
   and t.done = false
   and p.share_open_tasks = true
   and t.client_visible is distinct from true;
