-- Acceptances — master plan §7M ("proposals, contracts & paperwork"), ledger 0034.
--
-- THE LEDGER SAYS `proposals` / `contracts`. IT IS WRONG, AND THIS IS THE FIX.
--
-- §7M's own solution line is "Paperwork = Docs + special blocks (principle 8 —
-- one document system): a Proposal is a Doc containing scope blocks, a
-- line-items block, an accept block." A proposal is therefore NOT a new entity:
-- it is a page. Adding a `proposals` table would give the product two document
-- systems, which principle 8 exists to forbid, and would immediately raise the
-- question nobody wants to answer — what happens when a proposal needs a
-- heading, an image, or a table.
--
-- So the scope blocks need no table (they are blocks), the line-items block
-- needed no table (it shipped with no migration at all), and exactly one thing
-- here needs storage of its own: THE SIGNATURE.
--
-- WHY THE SIGNATURE CANNOT LIVE IN THE BLOCK. `pages.content` is rewritten by
-- the document owner's autosave. A signature stored there would be a field that
-- the party who benefits from it can edit, and that an autosave race can erase.
-- The whole value of an acceptance is that the counterparty produced it and the
-- beneficiary cannot change it — so it is a row, written by the server, from the
-- server's clock and the request's own address.
create table if not exists acceptances (
  id uuid primary key default gen_random_uuid(),

  -- The owner: who sent the document. RLS column, same shape as every other
  -- table here. Cascade, because an acceptance is meaningless without its doc.
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  -- Where the crossing will fire (sprint 3: accept → project + invoice draft).
  -- `set null` and not cascade: losing the project must never destroy evidence.
  project_id uuid references projects(id) on delete set null,

  -- Which accept block on the page. Text, because block ids live in the page's
  -- content JSON — there is no blocks table to reference.
  block_id text not null,

  -- ── The signature ──────────────────────────────────────────────────────────
  signer_name text not null,
  signer_email text,
  -- Server clock, never a timestamp the browser sent. The one is evidence; the
  -- other is a number the signer's machine happened to be set to.
  accepted_at timestamptz not null default now(),
  -- Click-wrap evidence. Best effort by nature — a proxy can hide or forge both
  -- — so they are recorded, never trusted as identity.
  ip text,
  user_agent text,

  -- ── What was signed ────────────────────────────────────────────────────────
  -- The exact words shown above the name field, denormalised so this row can be
  -- read on its own without parsing the snapshot to find out what was asked.
  statement text not null,
  -- The document as it stood at that instant. `page_versions` (0001) already
  -- proves snapshotting content is affordable; this one is not a version, it is
  -- the artifact, and it must survive every later edit to the page.
  content jsonb not null,
  -- Fingerprint of the same content (lib/acceptance.ts canonicalizeForSignature
  -- → sha256). Lets "has this changed since it was signed?" be one string
  -- comparison at render time instead of a deep diff of two documents.
  content_hash text not null,
  -- The line-items total at that moment, so "what did they agree to pay" is a
  -- query and not an exercise in re-reading old JSON.
  amount numeric(12,2),

  created_at timestamptz not null default now()
);

-- ONE SIGNATURE PER BLOCK, enforced where it cannot be forgotten.
--
-- A double-click, a page refresh mid-submit, or a retried request must not
-- produce two signatures on the same terms. The public accept path reads before
-- it writes, but that read-then-write is a race between two tabs; this index is
-- what actually decides. The action treats a 23505 here as "already accepted"
-- and returns the existing row, which makes accepting idempotent rather than an
-- error the client has to understand.
create unique index if not exists acceptances_block_unique on acceptances(page_id, block_id);

-- The only query the document renderer runs: "this page's acceptances".
create index if not exists idx_acceptances_page on acceptances(page_id);
-- Sprint 3's query: "what has this project had accepted", newest first.
create index if not exists idx_acceptances_project on acceptances(project_id, accepted_at desc) where project_id is not null;

-- Owner-only RLS. Note what this deliberately does NOT grant: there is no
-- policy for the signer. The client has no account — they accept through the
-- portal's service-role path, which proves the token owns the page before it
-- writes a row. Adding an anon policy here would be a second, weaker door to the
-- same table (identical reasoning to `attachments` and `form-uploads`).
alter table acceptances enable row level security;
drop policy if exists acceptances_owner on acceptances;
create policy acceptances_owner on acceptances
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- An acceptance is evidence, so the owner may READ and DELETE (withdrawing a
-- document they should never have sent) but must not be able to quietly rewrite
-- who signed, when, or what for. Postgres has no per-column RLS, so this is the
-- rule stated as a trigger: any UPDATE to the signature columns is refused.
create or replace function acceptances_immutable() returns trigger
  language plpgsql as $$
begin
  if new.signer_name is distinct from old.signer_name
     or new.signer_email is distinct from old.signer_email
     or new.accepted_at is distinct from old.accepted_at
     or new.statement is distinct from old.statement
     or new.content is distinct from old.content
     or new.content_hash is distinct from old.content_hash
     or new.amount is distinct from old.amount
     or new.ip is distinct from old.ip
     or new.user_agent is distinct from old.user_agent then
    raise exception 'An acceptance cannot be edited after it is signed.';
  end if;
  return new;
end $$;

drop trigger if exists acceptances_no_edit on acceptances;
create trigger acceptances_no_edit before update on acceptances
  for each row execute function acceptances_immutable();
