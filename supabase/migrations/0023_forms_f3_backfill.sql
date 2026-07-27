-- Backfill the F3 form columns for databases whose `forms` table was created by
-- the ORIGINAL 0020 (F1), before show_in_portal / task_id were folded into that
-- file. Because `0020` uses `create table if not exists`, re-running it on an
-- existing table is a no-op and never adds these — so they need an explicit ALTER.
--
-- Symptom this fixes: opening /forms/[id] 404s in production. loadForm() selects
-- `show_in_portal`, the column is missing, PostgREST errors, the row comes back
-- null, and the page calls notFound(). The Forms hub still works because it selects
-- only the original columns — which is why a form is visible but won't open.
--
-- Idempotent: safe to run whether or not the columns already exist.
alter table forms
  add column if not exists show_in_portal boolean not null default false;

alter table form_responses
  add column if not exists task_id uuid references tasks on delete set null;
