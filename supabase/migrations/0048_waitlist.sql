-- 0048 — THE WAITLIST, AND THE NUMBER ON THE TICKET. Apply after 0047; it depends on nothing.
--
-- WHAT IT IS FOR. Zenboard's front door is a waitlist: a stranger leaves an email and gets back a
-- numbered golden ticket. The number is the whole point — it is a place in a queue, so it must be
-- unique, stable once given, and never reused. That is a SEQUENCE's job, not `max(number) + 1`,
-- which two people submitting in the same second would both read as the same value.
--
-- WHY THE SEQUENCE STARTS AT 81. The list is presented as already eighty strong (lib/waitlist.ts,
-- `WAITLIST_SEED`), so the first real person is #81 and the count shown on the site is
-- 80 + the rows here. Both readings come from that one constant; change it in the lib and the
-- sequence below together, or the ticket number and the count drift apart.
--
-- SECURITY. There is NO anon policy on this table, in either direction:
--   · a stranger must not be able to INSERT directly — the action in lib/actions/waitlist.ts is the
--     only way in, and it is what runs Turnstile, the honeypot and the time trap;
--   · a stranger must certainly not be able to SELECT — this is a list of other people's email
--     addresses. The admin view reads it through the service role behind an email gate.
-- So RLS is on and the table carries no policies at all: only the service role reaches it.
--
-- UNTIL THIS IS APPLIED the site does not break and no one is lost: `waitlistReady()` probes the
-- table once, and while it is missing the site shows its ordinary "Start free" call to action
-- instead of a form that would drop what people type. Idempotent: safe to run twice. Additive only.

create sequence if not exists waitlist_number_seq as integer start with 81 minvalue 81;

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  -- The place in the queue, printed on the ticket. Given once, never recomputed.
  number integer not null unique default nextval('waitlist_number_seq'),
  email text not null check (char_length(email) between 3 and 254),
  -- Optional: it personalises the ticket and gives the admin list a human column.
  name text check (name is null or char_length(name) between 1 and 80),
  -- The handle they claim after joining, held for them until launch. Claimed once and not changed
  -- from the site: a handle people have already shared is not a thing to let someone quietly swap.
  username text check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  username_claimed_at timestamptz,
  -- Which surface they joined from (hero, waitlist page, footer), for attribution.
  source text not null default 'site' check (char_length(source) between 1 and 32),
  created_at timestamptz not null default now()
);

alter sequence waitlist_number_seq owned by waitlist.number;

-- ONE ROW PER PERSON, case-insensitively. Joining twice is not an error the visitor should ever see:
-- the action reads this conflict and hands back the number they already hold, so a second submit
-- shows them the same ticket rather than "that email is taken".
create unique index if not exists idx_waitlist_email_lower on waitlist (lower(email));

-- ONE HANDLE, ONCE, case-insensitively. A partial index so the many rows without one do not all
-- collide on null — and `lower()` because `Rushil` and `rushil` are the same handle to a reader.
create unique index if not exists idx_waitlist_username_lower
  on waitlist (lower(username)) where username is not null;

-- The admin list reads newest first; the count reads the whole table.
create index if not exists idx_waitlist_created on waitlist (created_at desc);

alter table waitlist enable row level security;

-- Deliberately NO policies. See SECURITY above: service role only, both ways.
