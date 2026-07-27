-- Money hub — fill the gaps the richer billing flow wants. Idempotent.
-- The hub works WITHOUT this (Unbilled uses time_entries.billed + profiles.hourly_rate;
-- invoice totals are computed from items). Applying it unlocks: voiding invoices,
-- per-time-log billable/rate/note, and a direct invoice link on time logs.

-- time_entries = the app's "time_logs". Add billing fields.
alter table time_entries add column if not exists billable boolean default true;
alter table time_entries add column if not exists rate numeric;
alter table time_entries add column if not exists note text;
alter table time_entries add column if not exists invoiced_invoice_id uuid references invoices on delete set null;

-- invoices: allow 'void' (totals stay computed from items; issue_date optional).
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check check (status in ('draft','sent','paid','overdue','void'));
alter table invoices add column if not exists issue_date date;

-- payments: optional note.
alter table payments add column if not exists note text;
