import { describe, it, expect } from 'vitest';
import { recencyOf, groupDocs, DOC_GROUPS } from './doc-recency';

const TODAY = '2026-10-01';

describe('recencyOf — calendar days in the person\'s zone', () => {
  it('buckets by calendar day, not elapsed hours', () => {
    expect(recencyOf('2026-10-01T08:00:00Z', TODAY, 'UTC')).toBe('today');
    expect(recencyOf('2026-09-30T23:59:00Z', TODAY, 'UTC')).toBe('yesterday');
    expect(recencyOf('2026-09-26T12:00:00Z', TODAY, 'UTC')).toBe('week');
    expect(recencyOf('2026-09-10T12:00:00Z', TODAY, 'UTC')).toBe('month');
    expect(recencyOf('2026-07-01T12:00:00Z', TODAY, 'UTC')).toBe('older');
  });

  it('uses the ZONE it is given — the reason the server needs one', () => {
    // 20:00 UTC on Sept 30 is already 01:30 on Oct 1 in Kolkata. A server in UTC that ignored
    // the zone would call this "Yesterday" while the browser called it "Today".
    const ts = '2026-09-30T20:00:00Z';
    expect(recencyOf(ts, TODAY, 'Asia/Kolkata')).toBe('today');
    expect(recencyOf(ts, TODAY, 'UTC')).toBe('yesterday');
  });

  it('keeps a timestamp from a fast clock in Today rather than burying it', () => {
    expect(recencyOf('2026-10-03T09:00:00Z', TODAY, 'UTC')).toBe('today');
  });

  it('treats an unreadable timestamp as Older, not as a crash', () => {
    expect(recencyOf('not a date', TODAY, 'UTC')).toBe('older');
  });
});

describe('groupDocs', () => {
  const doc = (id: string, updated_at: string, is_pinned = false) => ({ id, updated_at, is_pinned });

  it('puts pinned docs first whatever their age, and never re-sorts inside a group', () => {
    const sorted = [
      doc('p-old', '2026-01-01T00:00:00Z', true),
      doc('a', '2026-10-01T09:00:00Z'),
      doc('b', '2026-10-01T07:00:00Z'),
      doc('c', '2026-09-30T10:00:00Z'),
      doc('d', '2026-05-01T10:00:00Z'),
    ];
    const g = groupDocs(sorted, TODAY, 'UTC');
    expect(g.map((x) => x.id)).toEqual(['pinned', 'today', 'yesterday', 'older']);
    expect(g[0].items.map((x) => x.id)).toEqual(['p-old']);
    // The caller's order inside a bucket survives exactly.
    expect(g[1].items.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('drops empty groups — no heading over nothing', () => {
    const g = groupDocs([doc('a', '2026-10-01T09:00:00Z')], TODAY, 'UTC');
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe('Today');
  });

  it('loses nothing: every item lands in exactly one group', () => {
    const items = Array.from({ length: 40 }, (_, i) => doc(String(i), new Date(Date.UTC(2026, 9, 1) - i * 86_400_000 * 3).toISOString(), i % 9 === 0));
    const g = groupDocs(items, TODAY, 'UTC');
    expect(g.flatMap((x) => x.items).length).toBe(items.length);
    expect(new Set(g.flatMap((x) => x.items.map((i) => i.id))).size).toBe(items.length);
  });

  it('labels are sentence case (control: the glossary rule for headings)', () => {
    for (const { label } of DOC_GROUPS) expect(label[0] + label.slice(1).toLowerCase()).toBe(label);
  });
});
