-- Client Portal — read-only invoices (CLIENT_PORTAL_MASTER_PLAN.md §7.3, Phase 3).
-- Surfaces a project's ISSUED invoices (sent / paid / overdue only — never draft or
-- void) in the portal: number, status, total, due date. Amounts and totals are the
-- client's own bill, so they are safe to show; invoice notes and any internal
-- breakdown are never selected by the projection (lib/portal.ts).
--
-- No new tables — invoices/invoice_items/payments already exist. This is purely a
-- per-project share switch, mirroring the other share_* flags from 0006.
alter table projects add column if not exists share_invoices boolean default false;
