// Export serializers — principle 11: every object has an exit. Pure functions
// (tested in lib/export.test.ts); the /api/export routes fetch RLS-scoped rows,
// map them into these shapes, and stream the result as a download.
import { parseRecurrence, describeRecurrence } from './recurrence';

export type ExportTask = {
  title: string;
  notes: string | null;
  done: boolean;
  status: string | null;
  priority: string;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  recurrence: unknown;
  is_inbox: boolean;
  space: string | null;
  project: string | null;
  section: string | null;
  parent: string | null;
  labels: string[];
};

// A field is quoted whenever it could break the row; quotes double per RFC 4180.
export function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const cell = (v: string | number | boolean | null | undefined) =>
  v == null ? '' : csvEscape(String(v));

export function tasksToCsv(tasks: ExportTask[]): string {
  const header = [
    'Title', 'Status', 'Priority', 'Scheduled', 'Due', 'Estimate (min)',
    'Repeats', 'Space', 'Project', 'Section', 'Subtask of', 'Labels', 'Inbox',
    'Notes', 'Completed at', 'Created at',
  ];
  const lines = tasks.map((t) => {
    const rec = parseRecurrence(t.recurrence);
    return [
      cell(t.title),
      cell(t.status ?? (t.done ? 'done' : 'todo')),
      cell(t.priority),
      cell(t.scheduled_date),
      cell(t.due_date),
      cell(t.estimate_minutes),
      cell(rec ? describeRecurrence(rec) : ''),
      cell(t.space),
      cell(t.project),
      cell(t.section),
      cell(t.parent),
      cell(t.labels.join(', ')),
      cell(t.is_inbox ? 'yes' : ''),
      cell(t.notes),
      cell(t.completed_at),
      cell(t.created_at),
    ].join(',');
  });
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

export type ExportProject = {
  name: string;
  status: string;
  client: string | null;
  space: string | null;
  created_at: string;
  sections: { name: string; tasks: ExportProjectTask[] }[];
  /** Tasks with no section. */
  tasks: ExportProjectTask[];
};

export type ExportProjectTask = {
  title: string;
  done: boolean;
  notes: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  subtasks: ExportProjectTask[];
};

function mdTask(t: ExportProjectTask, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const meta = [
    t.scheduled_date ? `scheduled ${t.scheduled_date}` : null,
    t.due_date ? `due ${t.due_date}` : null,
    t.estimate_minutes ? `${t.estimate_minutes}m` : null,
  ].filter(Boolean).join(' · ');
  const lines = [`${pad}- [${t.done ? 'x' : ' '}] ${t.title}${meta ? ` (${meta})` : ''}`];
  if (t.notes?.trim()) {
    for (const n of t.notes.trim().split('\n')) lines.push(`${pad}  ${n}`);
  }
  for (const s of t.subtasks) lines.push(...mdTask(s, depth + 1));
  return lines;
}

export function projectsToMarkdown(projects: ExportProject[], exportedOnISO: string): string {
  const out: string[] = [`# Zenboard projects — exported ${exportedOnISO}`, ''];
  for (const p of projects) {
    out.push(`## ${p.name}`);
    const meta = [
      `Status: ${p.status}`,
      p.client ? `Client: ${p.client}` : null,
      p.space ? `Space: ${p.space}` : null,
    ].filter(Boolean).join(' · ');
    out.push(meta, '');
    for (const s of p.sections) {
      if (!s.tasks.length) continue;
      out.push(`### ${s.name}`, '');
      for (const t of s.tasks) out.push(...mdTask(t, 0));
      out.push('');
    }
    if (p.tasks.length) {
      if (p.sections.some((s) => s.tasks.length)) out.push('### Other tasks', '');
      for (const t of p.tasks) out.push(...mdTask(t, 0));
      out.push('');
    }
    if (!p.tasks.length && !p.sections.some((s) => s.tasks.length)) out.push('_No tasks._', '');
  }
  return out.join('\n');
}

// ── Finance (§7N: the accountant's exit) ────────────────────────────────────
//
// The one export that leaves the product for somebody ELSE to read. A task CSV
// is for a person moving tools; this is for a bookkeeper reconciling a year, so
// it optimises for a different thing: every row carries its own money in full
// rather than referencing another sheet, and nothing is rounded on the way out.

export type ExportInvoice = {
  number: string;
  status: string;
  client: string | null;
  project: string | null;
  issue_date: string | null;
  due_date: string | null;
  /** Line items, so subtotal is derived here rather than trusted from a column. */
  items: { description: string; quantity: number; unit_amount: number }[];
  payments: { amount: number; paid_on: string; method: string | null }[];
  notes: string | null;
  created_at: string;
};

/** Money as a plain decimal string — never a locale format. A spreadsheet has
 *  to parse this, and "1.234,56" or "$1,234.56" both land as text. */
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export const invoiceSubtotal = (inv: Pick<ExportInvoice, 'items'>): number =>
  inv.items.reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

export const invoicePaid = (inv: Pick<ExportInvoice, 'payments'>): number =>
  inv.payments.reduce((sum, p) => sum + p.amount, 0);

/**
 * One row per invoice, with its totals and what has been paid against it.
 *
 * `Balance` is included even though it is Total − Paid: a bookkeeper filtering
 * for "what is still owed" should not have to write a formula, and a derived
 * column that the exporter computes cannot disagree with the app the way a
 * hand-written one would.
 */
export function invoicesToCsv(invoices: ExportInvoice[]): string {
  const header = [
    'Number', 'Status', 'Client', 'Project', 'Issued', 'Due',
    'Subtotal', 'Paid', 'Balance', 'Notes', 'Created at',
  ];
  const lines = invoices.map((inv) => {
    const total = invoiceSubtotal(inv);
    const paid = invoicePaid(inv);
    return [
      cell(inv.number), cell(inv.status), cell(inv.client), cell(inv.project),
      cell(inv.issue_date), cell(inv.due_date),
      cell(money(total)), cell(money(paid)), cell(money(total - paid)),
      cell(inv.notes), cell(inv.created_at),
    ].join(',');
  });
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

/**
 * One row per LINE ITEM. Separate from the invoice sheet on purpose: an invoice
 * has many lines, and flattening them into one cell is the thing that makes an
 * export useless for anyone doing category totals.
 */
export function invoiceItemsToCsv(invoices: ExportInvoice[]): string {
  const header = ['Invoice', 'Client', 'Issued', 'Description', 'Quantity', 'Unit amount', 'Amount'];
  const lines = invoices.flatMap((inv) =>
    inv.items.map((i) => [
      cell(inv.number), cell(inv.client), cell(inv.issue_date),
      cell(i.description), cell(i.quantity), cell(money(i.unit_amount)),
      cell(money(i.quantity * i.unit_amount)),
    ].join(',')),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

/** One row per payment received — the cash-basis view of the same year. */
export function paymentsToCsv(invoices: ExportInvoice[]): string {
  const header = ['Paid on', 'Invoice', 'Client', 'Amount', 'Method'];
  const rows = invoices.flatMap((inv) =>
    inv.payments.map((p) => ({ ...p, number: inv.number, client: inv.client })),
  );
  // Chronological across every invoice: a payments sheet is read as a ledger,
  // and a ledger grouped by invoice is not one.
  rows.sort((a, b) => (a.paid_on < b.paid_on ? -1 : a.paid_on > b.paid_on ? 1 : 0));
  const lines = rows.map((p) =>
    [cell(p.paid_on), cell(p.number), cell(p.client), cell(money(p.amount)), cell(p.method)].join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}
