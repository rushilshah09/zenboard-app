-- The accept crossing — master plan §7M, ledger 0035.
--
-- §7M: "On accept: the crossing fires — project created from linked template,
-- line items become the invoice draft, client notified, activity logged."
--
-- The notification shipped with 0034. This column is what makes the INVOICE half
-- safe, and it is one column because that is genuinely all it needs.
--
-- WHY A COLUMN AND NOT "just create the invoice". Creating it is easy; creating
-- it exactly once is the problem. The signature itself is already protected —
-- `acceptances_block_unique` means a second accept returns the first row instead
-- of inserting — so the crossing cannot double-fire on a retry. What that does
-- NOT cover is the case where the signature lands and the invoice insert then
-- fails: the owner is left with an accepted proposal, no invoice, and no way to
-- ask for one that is guaranteed not to produce two. Recording the link makes
-- the retry safe and makes the answer to "did this proposal get invoiced?" a
-- column rather than a guess.
--
-- It is also the provenance §7P requires ("every behaviour states what it did"):
-- the accept block can show "Invoice INV-004 · draft" and link to it.
--
-- `on delete set null`: deleting an invoice is an ordinary thing to do, and it
-- must not take the signature with it. The acceptance simply becomes
-- uninvoiced again, which is true and re-runnable.
alter table acceptances
  add column if not exists invoice_id uuid references invoices(id) on delete set null;

-- "This project's accepted-but-uninvoiced proposals" — the only query that reads
-- it besides the block itself.
create index if not exists idx_acceptances_uninvoiced
  on acceptances(project_id) where invoice_id is null;

-- NOTE ON THE IMMUTABILITY TRIGGER (0034). `acceptances_immutable()` names the
-- signature columns explicitly and refuses UPDATEs to those. `invoice_id` is
-- deliberately not one of them, so this column can be written after the fact
-- without loosening anything: who signed, when, for what, and from where all
-- stay unwritable. No change to the trigger is needed — 0034 was built
-- anticipating exactly this.
