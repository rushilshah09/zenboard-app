-- 0047 — a meeting's write-up (MEETINGS_PLAN.md, stage M2). Apply after 0046.
--
-- The clerk's notes for a meeting — summary, decisions, your action items, what the client promised
-- and asked for, open questions — written from your notes and the transcript, every item quoted
-- from them (lib/meeting-notes.ts). Kept ON the meeting because it is one-to-one with it and only
-- ever read with it; every query that lists meetings names its columns, so no list pays for it.
--
-- The existing row policies on `meetings` (owner only, 0016) already cover these columns.
--
-- UNTIL THIS IS APPLIED the write-up still appears — it just is not kept, and the meeting says so.
-- Idempotent: safe to run twice. Additive only.

alter table meetings add column if not exists summary jsonb;
alter table meetings add column if not exists summarized_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meetings_summary_is_object') then
    alter table meetings add constraint meetings_summary_is_object
      check (summary is null or jsonb_typeof(summary) = 'object');
  end if;
end $$;
