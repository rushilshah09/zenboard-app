// Export serializers — principle 11's floor, tested.
import { describe, it, expect } from 'vitest';
import { csvEscape, tasksToCsv, projectsToMarkdown, invoicesToCsv, invoiceItemsToCsv, paymentsToCsv, type ExportTask, type ExportProject, type ExportInvoice } from './export';

const task = (over: Partial<ExportTask> = {}): ExportTask => ({
  title: 'Write the brief', notes: null, done: false, status: 'todo', priority: 'low',
  scheduled_date: '2026-07-21', due_date: null, estimate_minutes: 30,
  completed_at: null, created_at: '2026-07-20T10:00:00Z', recurrence: null,
  is_inbox: false, space: 'Work', project: 'Acme', section: null, parent: null, labels: [],
  ...over,
});

describe('csvEscape', () => {
  it('quotes only when needed and doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('two\nlines')).toBe('"two\nlines"');
  });
});

describe('tasksToCsv', () => {
  it('emits a header plus one CRLF row per task', () => {
    const csv = tasksToCsv([task()]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('Title,Status,Priority,Scheduled')).toBe(true);
    expect(lines[1]).toContain('Write the brief');
    expect(lines[1]).toContain('Acme');
  });
  it('survives titles with commas, quotes and newlines', () => {
    const csv = tasksToCsv([task({ title: 'call "Sam", then\nemail' })]);
    expect(csv).toContain('"call ""Sam"", then\nemail"');
  });
  it('renders recurrence through the contract and joins labels', () => {
    const csv = tasksToCsv([task({ recurrence: { freq: 'weekly', byday: 5 }, labels: ['Errand', 'Waiting'] })]);
    expect(csv).toContain('Every Friday');
    expect(csv).toContain('"Errand, Waiting"');
  });
  it('falls back to done/todo when status is null', () => {
    const csv = tasksToCsv([task({ status: null, done: true })]);
    expect(csv.split('\r\n')[1].split(',')[1]).toBe('done');
  });
});

describe('projectsToMarkdown', () => {
  const project = (over: Partial<ExportProject> = {}): ExportProject => ({
    name: 'Acme rebrand', status: 'active', client: 'Acme', space: 'Work',
    created_at: '2026-07-01T00:00:00Z', sections: [], tasks: [],
    ...over,
  });

  it('renders headings, checklists, and nested subtasks', () => {
    const md = projectsToMarkdown([project({
      sections: [{
        name: 'Design',
        tasks: [{
          title: 'Logo drafts', done: false, notes: null, scheduled_date: null,
          due_date: '2026-07-28', estimate_minutes: 60,
          subtasks: [{ title: 'Sketches', done: true, notes: null, scheduled_date: null, due_date: null, estimate_minutes: null, subtasks: [] }],
        }],
      }],
    })], '2026-07-20');
    expect(md).toContain('# Zenboard projects, exported 2026-07-20');
    expect(md).toContain('## Acme rebrand');
    expect(md).toContain('Status: active · Client: Acme · Space: Work');
    expect(md).toContain('### Design');
    expect(md).toContain('- [ ] Logo drafts (due 2026-07-28 · 60m)');
    expect(md).toContain('  - [x] Sketches');
  });
  it('keeps multiline notes as indented continuation lines', () => {
    const md = projectsToMarkdown([project({
      tasks: [{ title: 'Brief', done: false, notes: 'line one\nline two', scheduled_date: null, due_date: null, estimate_minutes: null, subtasks: [] }],
    })], '2026-07-20');
    expect(md).toContain('- [ ] Brief\n  line one\n  line two');
  });
  it('says so when a project has no tasks', () => {
    expect(projectsToMarkdown([project()], '2026-07-20')).toContain('_No tasks._');
  });
});

// ── Finance export (§7N) ────────────────────────────────────────────────────

const inv = (over: Partial<ExportInvoice> = {}): ExportInvoice => ({
  number: 'INV-001', status: 'sent', client: 'Acme', project: null,
  issue_date: '2026-07-01', due_date: '2026-07-15',
  items: [{ description: 'Design', quantity: 2, unit_amount: 500 }],
  payments: [], notes: null, created_at: '2026-07-01T09:00:00Z', ...over,
});
const rows = (csv: string) => csv.trim().split('\r\n');

describe('invoicesToCsv', () => {
  it('derives subtotal, paid and balance from the lines themselves', () => {
    const csv = invoicesToCsv([inv({ payments: [{ amount: 400, paid_on: '2026-07-10', method: 'bank' }] })]);
    const [header, row] = rows(csv);
    expect(header).toContain('Subtotal,Paid,Balance');
    expect(row).toContain('1000.00,400.00,600.00');
  });

  it('writes money as a plain decimal a spreadsheet can parse', () => {
    // A locale format ("1.234,56" or "$1,234.56") lands in a cell as TEXT, which
    // is the difference between a usable export and a retyping job.
    const csv = invoicesToCsv([inv({ items: [{ description: 'x', quantity: 1, unit_amount: 1234.5 }] })]);
    expect(rows(csv)[1]).toContain('1234.50');
    expect(csv).not.toMatch(/[$£€]/);
  });

  it('rounds to cents rather than emitting float noise', () => {
    const csv = invoicesToCsv([inv({ items: [{ description: 'x', quantity: 3, unit_amount: 0.1 }] })]);
    expect(rows(csv)[1]).toContain('0.30');   // not 0.30000000000000004
  });

  it('shows a zero balance for a fully paid invoice', () => {
    const csv = invoicesToCsv([inv({ payments: [{ amount: 1000, paid_on: '2026-07-09', method: null }] })]);
    expect(rows(csv)[1]).toContain('1000.00,1000.00,0.00');
  });

  it('escapes a client name containing a comma', () => {
    const csv = invoicesToCsv([inv({ client: 'Acme, Inc.' })]);
    expect(csv).toContain('"Acme, Inc."');
    expect(rows(csv)).toHaveLength(2);   // the comma did not split the row
  });

  it('emits a header even with no invoices', () => {
    expect(rows(invoicesToCsv([]))).toHaveLength(1);
  });
});

describe('invoiceItemsToCsv', () => {
  it('gives every line its own row, so category totals are possible', () => {
    const csv = invoiceItemsToCsv([inv({
      items: [
        { description: 'Design', quantity: 2, unit_amount: 500 },
        { description: 'Copy', quantity: 1, unit_amount: 250 },
      ],
    })]);
    const out = rows(csv);
    expect(out).toHaveLength(3);            // header + 2 lines
    expect(out[1]).toContain('Design,2,500.00,1000.00');
    expect(out[2]).toContain('Copy,1,250.00,250.00');
  });

  it('carries the invoice number onto each line so the sheets join', () => {
    const csv = invoiceItemsToCsv([inv()]);
    expect(rows(csv)[1].startsWith('INV-001,')).toBe(true);
  });
});

describe('paymentsToCsv', () => {
  it('reads as a ledger — chronological ACROSS invoices, not grouped by one', () => {
    const csv = paymentsToCsv([
      inv({ number: 'INV-001', payments: [{ amount: 100, paid_on: '2026-07-20', method: null }] }),
      inv({ number: 'INV-002', payments: [{ amount: 50, paid_on: '2026-07-05', method: 'card' }] }),
    ]);
    const out = rows(csv);
    expect(out[1]).toContain('2026-07-05,INV-002');
    expect(out[2]).toContain('2026-07-20,INV-001');
  });

  it('skips invoices with no payments rather than emitting blank rows', () => {
    expect(rows(paymentsToCsv([inv()]))).toHaveLength(1);   // header only
  });
});
