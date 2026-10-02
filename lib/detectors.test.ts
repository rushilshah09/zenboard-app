import { describe, it, expect } from 'vitest';
import {
  median, derivedConfidence, rankProposals,
  paymentRhythm, estimateAccuracy, workingHours,
  PAYMENT_MIN_INVOICES, ESTIMATE_MIN_TASKS, HOURS_MIN_COMPLETIONS,
  type SettledInvoice, type MeasuredTask,
} from './detectors';

const CLIENT = '11111111-2222-3333-4444-555555555555';
const PROJECT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** An invoice due on the 1st, paid `late` days after (negative = early). */
const inv = (late: number, over: Partial<SettledInvoice> = {}): SettledInvoice => {
  const due = new Date('2026-03-01T00:00:00.000Z');
  const paid = new Date(due.getTime() + late * 86_400_000);
  return {
    clientId: CLIENT,
    clientName: 'Meridian Studio',
    dueDate: due.toISOString().slice(0, 10),
    paidOn: paid.toISOString().slice(0, 10),
    ...over,
  };
};

describe('median', () => {
  it('is the middle value, and the mean of two for an even count', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('ignores an outlier that would drag a mean', () => {
    // One invoice paid a year late must not invent a pattern.
    expect(median([1, 2, 2, 3, 365])).toBe(2);
  });

  it('is 0 for nothing rather than NaN', () => {
    expect(median([])).toBe(0);
  });
});

describe('derivedConfidence', () => {
  it('never reaches 1 — a derived fact must sort below one you stated', () => {
    expect(derivedConfidence(1000, 1)).toBeLessThan(1);
    expect(derivedConfidence(1000, 1)).toBeLessThanOrEqual(0.85);
  });

  it('rises with sample size and falls with disagreement', () => {
    expect(derivedConfidence(10, 1)).toBeGreaterThan(derivedConfidence(3, 1));
    expect(derivedConfidence(10, 0.6)).toBeLessThan(derivedConfidence(10, 1));
  });

  it('has a floor, so a weak signal still sorts rather than vanishing', () => {
    expect(derivedConfidence(1, 0.01)).toBeGreaterThanOrEqual(0.3);
  });
});

describe('paymentRhythm', () => {
  it('notices a client who is consistently late', () => {
    // Median of 5, 6, 7 — not the mean, and not the worst one.
    const [p] = paymentRhythm([inv(6), inv(7), inv(5)]);
    expect(p.body).toBe('Meridian Studio pays about 6 days late.');
    expect(p.subject).toEqual({ type: 'client', id: CLIENT });
    expect(p.kind).toBe('pattern');
    expect(p.key).toBe(`payment-rhythm:${CLIENT}`);
  });

  it('notices a client who pays early', () => {
    const [p] = paymentRhythm([inv(-8), inv(-6), inv(-7)]);
    expect(p.body).toBe('Meridian Studio pays about 7 days early.');
  });

  it('says NOTHING about a client who pays on time — that is not a fact', () => {
    expect(paymentRhythm([inv(0), inv(1), inv(-2), inv(2)])).toEqual([]);
  });

  it('needs a real sample before calling it a rhythm', () => {
    expect(paymentRhythm([inv(9), inv(8)])).toEqual([]);
    expect(paymentRhythm(Array.from({ length: PAYMENT_MIN_INVOICES }, () => inv(9)))).toHaveLength(1);
  });

  it('refuses to describe an erratic client, even when the median is past tolerance', () => {
    // Median 9, but half the invoices were paid on time — "pays 9 days late"
    // would be a claim about someone who is simply unpredictable.
    expect(paymentRhythm([inv(0), inv(1), inv(18), inv(20), inv(-1), inv(30)])).toEqual([]);
  });

  it('keeps clients apart', () => {
    const other = { clientId: PROJECT, clientName: 'Acme' };
    const out = paymentRhythm([
      inv(9), inv(8), inv(10),
      inv(9, other), inv(11, other), inv(8, other),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.subject.id).sort()).toEqual([CLIENT, PROJECT].sort());
  });

  it('drops a row with an unparseable date rather than throwing', () => {
    const bad = inv(9);
    bad.paidOn = 'not a date';
    expect(() => paymentRhythm([bad, inv(9), inv(8)])).not.toThrow();
    // Two usable rows is below the minimum, so nothing is claimed.
    expect(paymentRhythm([bad, inv(9), inv(8)])).toEqual([]);
  });

  it('speaks up just past the tolerance band, and not inside it', () => {
    expect(paymentRhythm([inv(3), inv(3), inv(3)])).toEqual([]);
    const [p] = paymentRhythm([inv(4), inv(4), inv(4)]);
    expect(p.body).toBe('Meridian Studio pays about 4 days late.');
  });

  it('carries evidence a person can check', () => {
    const [p] = paymentRhythm([inv(6), inv(7), inv(5)]);
    expect(p.evidence).toBe('3 of 3 settled invoices, measured from the due date.');
  });
});

describe('estimateAccuracy', () => {
  const task = (estimateMinutes: number, actualMinutes: number, over: Partial<MeasuredTask> = {}): MeasuredTask => ({
    projectId: PROJECT, projectName: 'Acme rebrand', estimateMinutes, actualMinutes, ...over,
  });

  it('notices work that consistently runs over', () => {
    const [p] = estimateAccuracy(Array.from({ length: 6 }, () => task(60, 90)));
    expect(p.body).toBe('Work on Acme rebrand takes about 50% longer than estimated.');
    expect(p.subject).toEqual({ type: 'project', id: PROJECT });
  });

  it('notices work that comes in under', () => {
    const [p] = estimateAccuracy(Array.from({ length: 6 }, () => task(100, 60)));
    expect(p.body).toBe('Work on Acme rebrand comes in about 40% under estimate.');
  });

  it('says nothing when the estimates are about right', () => {
    expect(estimateAccuracy(Array.from({ length: 8 }, () => task(60, 62)))).toEqual([]);
  });

  it('needs enough measured tasks', () => {
    expect(estimateAccuracy(Array.from({ length: ESTIMATE_MIN_TASKS - 1 }, () => task(60, 120)))).toEqual([]);
  });

  it('ignores tasks missing either half — they say nothing about estimating', () => {
    const rows = [
      ...Array.from({ length: 6 }, () => task(60, 90)),
      task(0, 500), task(500, 0),
    ];
    const [p] = estimateAccuracy(rows);
    expect(p.evidence).toBe('6 tasks with both an estimate and tracked time.');
  });

  it('compares TOTALS, so one tiny task cannot dominate', () => {
    // Five accurate hours plus a 5-minute task that took 15. Averaging the
    // per-task ratios would report a ~40% overrun; the totals say 3%.
    const rows = [
      ...Array.from({ length: 5 }, () => task(60, 60)),
      task(5, 15),
    ];
    expect(estimateAccuracy(rows)).toEqual([]);
  });
});

describe('workingHours', () => {
  const at = (hour: number, times: number) => Array.from({ length: times }, () => hour);

  it('finds the window most work lands in', () => {
    const [p] = workingHours([...at(9, 8), ...at(10, 8), ...at(11, 8), ...at(16, 4)]);
    expect(p.body).toBe('You finish most of your work between 09:00 and 13:00.');
    expect(p.subject).toEqual({ type: 'self', id: null });
    expect(p.key).toBe('working-hours:self');
  });

  it('wraps midnight, so a night owl is not invisible', () => {
    const [p] = workingHours([...at(22, 8), ...at(23, 8), ...at(0, 8), ...at(12, 4)]);
    expect(p.body).toBe('You finish most of your work between 22:00 and 02:00.');
  });

  it('will not start a window on an hour nothing landed in', () => {
    // 09/10/11 are busy and 08 is empty: both windows total the same, and the
    // one beginning at 08:00 would be padding dressed as a habit.
    const [p] = workingHours([...at(9, 9), ...at(10, 9), ...at(11, 9)]);
    expect(p.body).toBe('You finish most of your work between 09:00 and 13:00.');
  });

  it('says nothing when work is spread across the day', () => {
    const spread = Array.from({ length: 24 }, (_, h) => at(h, 2)).flat();
    expect(workingHours(spread)).toEqual([]);
  });

  it('needs enough completions before claiming a habit', () => {
    expect(workingHours(at(9, HOURS_MIN_COMPLETIONS - 1))).toEqual([]);
    expect(workingHours(at(9, HOURS_MIN_COMPLETIONS))).toHaveLength(1);
  });

  it('discards impossible hours rather than trusting the caller', () => {
    expect(workingHours([...at(9, 25), ...at(-1, 5), ...at(99, 5)])).toHaveLength(1);
  });

  it('reports the share it actually saw', () => {
    const [p] = workingHours([...at(9, 15), ...at(10, 15), ...at(15, 10)]);
    expect(p.evidence).toBe('75% of 40 completed tasks landed in that window.');
  });
});

describe('rankProposals', () => {
  it('puts the surest first, and is stable for ties', () => {
    const p = (key: string, confidence: number) =>
      ({ key, confidence, subject: { type: 'self' as const, id: null }, body: '', kind: 'fact' as const, evidence: '' });
    const out = rankProposals([p('b', 0.4), p('a', 0.8), p('c', 0.4)]);
    expect(out.map((x) => x.key)).toEqual(['a', 'b', 'c']);
  });
});
