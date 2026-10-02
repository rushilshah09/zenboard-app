import { describe, it, expect } from 'vitest';
import { formInsights, respondentKey, median, answersFor, type InsightResponse } from './form-insights';

const r = (over: Partial<InsightResponse> & { id: string }): InsightResponse => ({
  status: 'complete', answers: {}, respondent: null, meta: {}, createdAt: '2026-08-15T10:00:00.000Z', ...over,
});

describe('median', () => {
  it('is the middle value', () => {
    expect(median([10, 20, 30])).toBe(20);
  });

  it('takes the LOWER middle on an even count rather than averaging', () => {
    // Averaging two real durations invents a third that nobody experienced.
    expect(median([10, 20, 30, 40])).toBe(20);
  });

  it('does not care what order it is given', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('is 0 for nothing', () => {
    expect(median([])).toBe(0);
  });
});

describe('respondentKey', () => {
  it('treats one email as one person however it was typed', () => {
    expect(respondentKey(r({ id: '1', respondent: { email: 'A@b.com ' } })))
      .toBe(respondentKey(r({ id: '2', respondent: { email: 'a@b.com' } })));
  });

  it('prefers the email over the name', () => {
    // Two people called Sam are two people; one email is one person.
    const a = r({ id: '1', respondent: { name: 'Sam', email: 'sam@one.com' } });
    const b = r({ id: '2', respondent: { name: 'Sam', email: 'sam@two.com' } });
    expect(respondentKey(a)).not.toBe(respondentKey(b));
  });

  it('falls back to the name, then to the response itself', () => {
    expect(respondentKey(r({ id: '1', respondent: { name: 'Sam' } })))
      .toBe(respondentKey(r({ id: '2', respondent: { name: ' sam ' } })));
    expect(respondentKey(r({ id: '1' }))).not.toBe(respondentKey(r({ id: '2' })));
  });
});

describe('formInsights', () => {
  it('counts an empty form without dividing by zero', () => {
    expect(formInsights([], 0)).toEqual({
      visits: 0, starts: 0, completed: 0, partials: 0, completion: 0, unique: 0, medianTime: 0, dropOff: [],
    });
  });

  it('divides completion by STARTS, never by visits', () => {
    // The defect this prevents: a form opened 100 times and started twice,
    // both completed, is a 100% completion — not 2%. Visits include the owner
    // testing their own link, and a refresh counts twice.
    const rs = [r({ id: '1' }), r({ id: '2' })];
    const i = formInsights(rs, 100);
    expect(i.visits).toBe(100);
    expect(i.starts).toBe(2);
    expect(i.completion).toBe(100);
  });

  it('splits completes from partials', () => {
    const i = formInsights([r({ id: '1' }), r({ id: '2', status: 'partial' }), r({ id: '3' })], 5);
    expect(i.completed).toBe(2);
    expect(i.partials).toBe(1);
    expect(i.completion).toBe(67);
  });

  it('counts distinct people, not rows', () => {
    const i = formInsights([
      r({ id: '1', respondent: { email: 'a@b.com' } }),
      r({ id: '2', respondent: { email: 'A@B.com' } }),
      r({ id: '3', respondent: { email: 'c@d.com' } }),
    ], 0);
    expect(i.starts).toBe(3);
    expect(i.unique).toBe(2);
  });

  it('times only COMPLETED responses, and ignores junk durations', () => {
    const i = formInsights([
      r({ id: '1', meta: { duration_s: 30 } }),
      r({ id: '2', meta: { duration_s: 90 } }),
      r({ id: '3', meta: { duration_s: 300 } }),
      r({ id: '4', status: 'partial', meta: { duration_s: 9999 } }),  // abandoned, not a time
      r({ id: '5', meta: { duration_s: 0 } }),                        // never started the clock
      r({ id: '6', meta: { duration_s: Number.NaN } }),
    ], 0);
    expect(i.medianTime).toBe(90);
  });

  it('ranks drop-off by how many people stopped there', () => {
    const i = formInsights([
      r({ id: '1', status: 'partial', meta: { last_field_id: 'phone' } }),
      r({ id: '2', status: 'partial', meta: { last_field_id: 'phone' } }),
      r({ id: '3', status: 'partial', meta: { last_field_id: 'budget' } }),
      r({ id: '4', status: 'partial', meta: {} }),   // stopped before touching anything
      r({ id: '5' }),                                 // finished — not a drop-off
    ], 0);
    expect(i.dropOff).toEqual([{ fieldId: 'phone', count: 2 }, { fieldId: 'budget', count: 1 }]);
  });

  it('orders tied drop-offs stably', () => {
    // A list that reshuffles on every render reads as data changing when it
    // hasn't.
    const rs = [
      r({ id: '1', status: 'partial', meta: { last_field_id: 'b' } }),
      r({ id: '2', status: 'partial', meta: { last_field_id: 'a' } }),
    ];
    expect(formInsights(rs, 0).dropOff.map((d) => d.fieldId)).toEqual(['a', 'b']);
    expect(formInsights([...rs].reverse(), 0).dropOff.map((d) => d.fieldId)).toEqual(['a', 'b']);
  });
});

describe('answersFor', () => {
  const text = (v: unknown) => (v == null ? '' : String(v));

  it('returns only completed, non-empty answers', () => {
    const rows = answersFor([
      r({ id: '1', answers: { q: 'Yes' } }),
      r({ id: '2', answers: { q: '   ' } }),          // whitespace is not an answer
      r({ id: '3', answers: {} }),                     // skipped an optional field
      r({ id: '4', status: 'partial', answers: { q: 'Maybe' } }),
    ], 'q', text);
    expect(rows.map((x) => x.text)).toEqual(['Yes']);
  });

  it('keeps the order it was given, with the response id and time', () => {
    const rows = answersFor([
      r({ id: '1', answers: { q: 'A' }, createdAt: '2026-08-15T10:00:00.000Z' }),
      r({ id: '2', answers: { q: 'B' }, createdAt: '2026-08-14T10:00:00.000Z' }),
    ], 'q', text);
    expect(rows).toEqual([
      { responseId: '1', text: 'A', at: '2026-08-15T10:00:00.000Z' },
      { responseId: '2', text: 'B', at: '2026-08-14T10:00:00.000Z' },
    ]);
  });
});
