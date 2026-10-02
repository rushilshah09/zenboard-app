-- 0046 — meeting transcripts (MEETINGS_PLAN.md, stage M1). Apply after 0045.
--
-- A recorded meeting's transcript: one row per meeting, the segments in order, each with its start
-- and end in seconds, who spoke ('me' = the microphone, 'them' = the call, null = not measured) and
-- the words. The AI plan's data model names this table; it is a table rather than a column on
-- `meetings` because an hour of talk is ~60 KB of JSON, and `meetings` is read in lists.
--
-- AUDIO IS NOT STORED. Chunks are transcribed and dropped, the way Granola works and Fellow's
-- zero-day retention does; keeping a recording is a later, opt-in stage.
--
-- SECURITY: the owner reads and writes their own rows, and may only attach a transcript to a meeting
-- that is theirs — checked in the policy, not just in the app.
--
-- Also: `ai_usage.audio_seconds`, because transcription is billed by the audio minute, not by the
-- token, and the per-person allowance is counted in minutes.
--
-- UNTIL THIS IS APPLIED the app still works: recording and the live transcript run, but a
-- transcript cannot be saved, and the meeting says so. Idempotent: safe to run twice. Additive only.

create table if not exists meeting_transcripts (
  meeting_id uuid primary key references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  language text check (language is null or char_length(language) between 2 and 16),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  source text not null default 'recording' check (source in ('recording', 'upload')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_meeting_transcripts_updated_at on meeting_transcripts;
create trigger set_meeting_transcripts_updated_at before update on meeting_transcripts
  for each row execute function set_updated_at();

alter table meeting_transcripts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'meeting_transcripts' and policyname = 'owner_sel') then
    create policy owner_sel on meeting_transcripts for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'meeting_transcripts' and policyname = 'owner_ins') then
    create policy owner_ins on meeting_transcripts for insert
      with check (user_id = auth.uid() and exists (
        select 1 from meetings m where m.id = meeting_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'meeting_transcripts' and policyname = 'owner_upd') then
    create policy owner_upd on meeting_transcripts for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid() and exists (
        select 1 from meetings m where m.id = meeting_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'meeting_transcripts' and policyname = 'owner_del') then
    create policy owner_del on meeting_transcripts for delete using (user_id = auth.uid());
  end if;
end $$;

alter table ai_usage add column if not exists audio_seconds numeric(10, 2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_audio_seconds_check') then
    alter table ai_usage add constraint ai_usage_audio_seconds_check check (audio_seconds >= 0);
  end if;
end $$;
