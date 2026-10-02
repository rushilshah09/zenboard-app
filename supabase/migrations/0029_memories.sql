-- Memory — the sixth layer (master plan §7X, `MEMORY_MODULE_PLAN.md`), ledger 0029.
--
-- THE DECISION THIS TABLE ENCODES: a memory is a FACT WITH A TIME VALIDITY. It is
-- not a saved thing. "Acme wants invoices on the 1st" is a memory; a saved article
-- is a bookmark and a meeting write-up is a Doc. Every column below exists to keep
-- that line sharp, because the moment it blurs this becomes a second Documents
-- module with a worse editor.
--
-- Two consequences are load-bearing and both are schema, not UI:
--
--   1. FACTS ARE SUPERSEDED, NEVER OVERWRITTEN. Acme moves from net-30 to net-15
--      and the old row does not get edited — it gets an `invalid_from` and a
--      pointer to its replacement. That is what makes the answer to "what was true
--      in March" a query rather than an apology, and it is the single most
--      valuable idea in the four reference products (Zep's temporal graph).
--
--   2. FACTS ARE ATOMIC. One line, one fact. `body` is capped at 280 characters by
--      a CHECK, and that cap is a design statement: ten paragraphs of meeting notes
--      produce three memories, not one blob. The app trims and validates before it
--      ever gets here (`normalizeBody` in lib/memory.ts), so the constraint is a
--      backstop that users should never meet.
--
-- Edges REUSE `mentions` (0027). A memory that names a record writes an ordinary
-- row with `source_type = 'memory'`. No second edge table: the fabric is one
-- mechanism or it is not a fabric.
--
-- Additive and idempotent, like every migration here.

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,

  -- NULLABLE ON PURPOSE, and it is the answer to open question 2 in the plan.
  -- A fact about a client belongs to the space that client lives in. A fact about
  -- YOU ("you move design work to the afternoon") is true in every space, and
  -- filing it under whichever space you happened to be in when it was noticed
  -- would make it disappear the moment you switched. So: `space_id` set = scoped
  -- to that space, null = true everywhere. Reads ask for both.
  space_id uuid references spaces on delete cascade,

  -- The fact, in one line. See the cap's reasoning above.
  body text not null check (length(btrim(body)) between 1 and 280),

  -- Six, fixed, and deliberately NOT user-extensible: a taxonomy the user has to
  -- maintain is filing by another name, and filing is the thing this module
  -- exists to abolish.
  --   preference — how someone likes to be dealt with ("prefers a call to a thread")
  --   fact       — a plain durable truth ("their financial year ends in March")
  --   decision   — something settled, worth not relitigating ("we agreed no Figma handoff")
  --   pattern    — behaviour over time, the shape most derived memories take
  --   person     — who someone is / who does what ("Ravi signs off, not Meera")
  --   snippet    — a reusable phrasing you keep retyping
  kind text not null default 'fact'
    check (kind in ('preference', 'fact', 'decision', 'pattern', 'person', 'snippet')),

  -- WHAT THE FACT IS ABOUT. Polymorphic with no FK, for exactly 0027's reason:
  -- the subject can be any record type, and a deleted subject should leave the
  -- fact behind as a tombstone rather than take it with it.
  --
  -- 'self' is the one subject with no row anywhere — it is you — so it is also
  -- the one subject_type allowed a null id, and the CHECK below makes those two
  -- statements the same statement. Without it, a self-fact and a fact about a
  -- deleted client would be indistinguishable.
  subject_type text not null,
  subject_id uuid,

  -- HOW THIS GOT HERE, which is not decoration: it decides what the app is
  -- allowed to do with the row.
  --   derived   — Zenboard noticed it (M3). Never shown until accepted.
  --   marked    — you selected text and said remember this.
  --   told      — you typed it.
  --   suggested — the clerk proposed it (M5) and you accepted.
  -- The never-list is explicit that nothing is written silently, so `derived` and
  -- `suggested` are proposals; they reach this table only once accepted.
  origin text not null default 'told'
    check (origin in ('derived', 'marked', 'told', 'suggested')),

  -- The receipt. A memory you cannot trace is a rumour, so every row can answer
  -- "why do you think this?" with a link back to the doc block, task or invoice
  -- it came from. Null for a fact typed straight in — the honest answer there is
  -- "you told me", and inventing a source would be worse than having none.
  source_type text,
  source_id uuid,
  anchor text,

  -- THE TEMPORAL SPINE. `invalid_from is null` means "currently true" and is the
  -- predicate every read uses; `superseded_by` gives an audit trail instead of a
  -- hole. A row is never edited to change what it claims — `body` changes are for
  -- fixing a typo, not for changing the fact.
  valid_from timestamptz not null default now(),
  invalid_from timestamptz,
  superseded_by uuid references memories on delete set null,

  -- 0–1. Derived facts start below 1 and rise when confirmed. NEVER rendered as a
  -- number: it orders a list, it does not decorate a row. A "87% confident"
  -- badge would invite an argument with a number nobody can check.
  confidence real not null default 1 check (confidence >= 0 and confidence <= 1),

  -- Feeds decay (§5.4). A memory never recalled and never confirmed loses
  -- confidence and eventually archives ITSELF — it is never deleted by the
  -- system, because archived is reversible and deleted is not, and a memory
  -- system that quietly loses things is worse than no memory system.
  recall_count integer not null default 0,
  last_recalled_at timestamptz,

  -- The user overrides all of the above. `pinned` exempts a row from decay and
  -- floats it; `archived_at` is the reversible end of a fact's life.
  pinned boolean not null default false,
  archived_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 'self' is the only subject without a row of its own. One constraint, so the two
-- halves of that sentence can never drift apart.
alter table memories drop constraint if exists memories_subject_shape;
alter table memories add constraint memories_subject_shape check (
  (subject_type = 'self') = (subject_id is null)
);

-- A fact cannot stop being true before it started, and a superseded fact must say
-- when it stopped. Both are cheap here and expensive to discover later in a
-- history view that renders an impossible interval.
alter table memories drop constraint if exists memories_validity_order;
alter table memories add constraint memories_validity_order check (
  invalid_from is null or invalid_from >= valid_from
);
alter table memories drop constraint if exists memories_superseded_is_invalid;
alter table memories add constraint memories_superseded_is_invalid check (
  superseded_by is null or invalid_from is not null
);

-- THE ONE QUERY THAT EXISTS AT M1: "what do I know about this record", currently
-- true, unarchived. Partial, because that predicate is on every read and a
-- superseded fact from 2024 should not be in the index the ambient panel scans.
create index if not exists idx_memories_subject_current
  on memories(subject_type, subject_id, pinned desc, valid_from desc)
  where invalid_from is null and archived_at is null;

-- The history query — "what was true in March" (M4) — which by definition wants
-- the rows the partial index above excludes.
create index if not exists idx_memories_subject_history
  on memories(subject_type, subject_id, valid_from desc);

create index if not exists idx_memories_user on memories(user_id, created_at desc);

-- Following a supersession chain forwards is the audit trail; backwards ("what
-- did this replace") is how the history view builds a timeline without an N+1.
create index if not exists idx_memories_superseded_by
  on memories(superseded_by) where superseded_by is not null;

-- DEDUPE, which is Mem0's lesson and the difference between a memory and a note
-- pile. Remembering the same thing about the same subject twice is one fact, and
-- the second attempt should be told so rather than quietly making a twin.
--
-- Partial on the currently-true rows: a fact that was superseded in March can be
-- stated again in July, because that is a genuinely new claim about the world.
-- `coalesce` over the nil uuid because a null subject_id (a self-fact) must
-- still collide with another self-fact — in a unique index nulls never collide,
-- which would have left `self` the one subject with no dedupe at all.
create unique index if not exists idx_memories_dedupe
  on memories(
    user_id, subject_type,
    coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(body))
  )
  where invalid_from is null and archived_at is null;

drop trigger if exists trg_memories_updated on memories;
create trigger trg_memories_updated before update on memories
  for each row execute function set_updated_at();

-- Owner-only, the same shape as every other table here. There is deliberately no
-- portal-facing policy and no anon grant: Memory is inference ABOUT clients, and
-- the never-list calls a leak into the portal the single most damaging thing that
-- could happen to this module. The portal's projections (lib/portal.ts) run under
-- their own token and cannot see this table at all.
alter table memories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='memories' and policyname='sel') then
    create policy sel on memories for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='memories' and policyname='ins') then
    create policy ins on memories for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='memories' and policyname='upd') then
    create policy upd on memories for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='memories' and policyname='del') then
    create policy del on memories for delete using (user_id = auth.uid());
  end if;
end $$;
