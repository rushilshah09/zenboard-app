import { describe, it, expect } from 'vitest';
import { waitingOn, waitingSummary, waitingLabel, type WaitingSources } from './waiting';

const TODAY = '2026-08-17';
const src = (over: Partial<WaitingSources> = {}): WaitingSources => ({
  approvals: [], requests: [], invoices: [], clientOf: { p1: 'Acme' }, ...over,
});

describe('what counts as waiting', () => {
  it('an awaiting approval does', () => {
    const out = waitingOn(src({ approvals: [{ id: 'a', title: 'Logo', status: 'awaiting', created_at: '2026-08-10', project_id: 'p1' }] }), TODAY);
    expect(out.map((x) => x.kind)).toEqual(['approval']);
    expect(out[0].who).toBe('Acme');
  });

  it('a DECIDED approval does not', () => {
    const rows = ['approved', 'changes_requested'].map((status, i) => ({ id: `a${i}`, title: 'x', status, created_at: '2026-08-10', project_id: 'p1' }));
    expect(waitingOn(src({ approvals: rows }), TODAY)).toEqual([]);
  });

  it('THE ONE THAT MATTERS: a `pending` request is waiting on US, not them', () => {
    // `pending` means the client asked and WE have not decided. Putting it here
    // would turn a list of other people's moves into a second to-do list, which
    // is the failure mode this file exists to avoid.
    const rows = [
      { id: 'r1', title: 'Dark mode?', body: '', status: 'pending', created_at: '2026-08-10', project_id: 'p1' },
      { id: 'r2', title: 'Which screens?', body: '', status: 'needs_info', created_at: '2026-08-11', project_id: 'p1' },
    ];
    expect(waitingOn(src({ requests: rows }), TODAY).map((x) => x.id)).toEqual(['request:r2']);
  });

  it('falls back to the first line of the body when a request has no title', () => {
    const rows = [{ id: 'r', title: null, body: 'Send the swatch file\nand the fonts', status: 'needs_info', created_at: '2026-08-10', project_id: 'p1' }];
    expect(waitingOn(src({ requests: rows }), TODAY)[0].title).toBe('Send the swatch file');
  });

  it('counts sent and overdue invoices, never a draft or a paid one', () => {
    const rows = ['draft', 'sent', 'paid', 'overdue', 'void'].map((status, i) => ({ id: `i${i}`, number: `INV-${i}`, status, due_date: '2026-09-01', issue_date: '2026-08-01' }));
    expect(waitingOn(src({ invoices: rows }), TODAY).map((x) => x.title)).toEqual(['INV-1', 'INV-3']);
  });

  it('never invents a client name', () => {
    const out = waitingOn(src({ approvals: [{ id: 'a', title: 'x', status: 'awaiting', created_at: '2026-08-10', project_id: 'unknown' }] }), TODAY);
    expect(out[0].who).toBeNull();
    expect(waitingLabel(out[0])).toBe('Awaiting approval');
  });
});

describe('order', () => {
  it('puts OVERDUE first, then oldest', () => {
    const out = waitingOn(src({
      approvals: [{ id: 'old', title: 'Old', status: 'awaiting', created_at: '2026-01-01', project_id: 'p1' }],
      invoices: [{ id: 'late', number: 'INV-9', status: 'sent', due_date: '2026-08-01', issue_date: '2026-07-25' }],
    }), TODAY);
    // The approval is older, but a missed DATE is a different category of late
    // from "nobody has answered yet".
    expect(out.map((x) => x.id)).toEqual(['invoice:late', 'approval:old']);
  });

  it('an invoice not yet due is waiting but not overdue', () => {
    const out = waitingOn(src({ invoices: [{ id: 'i', number: 'INV-1', status: 'sent', due_date: '2026-12-01', issue_date: '2026-08-01' }] }), TODAY);
    expect(out[0].overdue).toBe(false);
  });
});

describe('waitingSummary', () => {
  it('is null when nothing is waiting — the section does not render', () => {
    expect(waitingSummary([])).toBeNull();
  });

  it('counts, and calls out overdue separately', () => {
    const out = waitingOn(src({
      approvals: [{ id: 'a', title: 'x', status: 'awaiting', created_at: '2026-08-10', project_id: 'p1' }],
      invoices: [{ id: 'i', number: 'INV-1', status: 'overdue', due_date: '2026-08-01', issue_date: '2026-07-01' }],
    }), TODAY);
    expect(waitingSummary(out)).toBe('2 things, 1 overdue');
    // The overdue one sorts FIRST, so the singular-without-overdue case has to
    // take the tail. (My first version sliced the head and asserted '1 thing' —
    // the code was right and the test was wrong.)
    expect(waitingSummary(out.slice(1))).toBe('1 thing');
    expect(waitingSummary(out.slice(0, 1))).toBe('1 thing, 1 overdue');
  });
});
