import { describe, it, expect } from 'vitest';
import {
  normalizeBody, bodyProblem, BODY_MAX, factKey, alreadyKnown,
  isCurrent, asOf, sortMemories, supersedePatch, validFromFor, groupBySubject, selfFirst, dismissedKeys, DISMISSED_KEY, historyOf, confirmedConfidence, needsReview, CONFIRM_STEP,
  fadedConfidence, isFading, fadingFacts, lastTouched, FADE_GRACE_DAYS, FADE_HALFLIFE_DAYS, FADE_THRESHOLD,
  subjectRef, sameSubject, SELF, MEMORY_KINDS, KIND_LABEL, MEMORY_ORIGINS, ORIGIN_LABEL,
  type Memory, type MemorySubject,
} from './memory';

const CLIENT: MemorySubject = { type: 'client', id: '11111111-2222-3333-4444-555555555555' };
const OTHER: MemorySubject = { type: 'client', id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };

const fact = (over: Partial<Memory> = {}): Memory => ({
  id: 'm1',
  body: 'Acme wants invoices on the 1st',
  kind: 'preference',
  subject_type: CLIENT.type,
  subject_id: CLIENT.id,
  origin: 'told',
  source_type: null,
  source_id: null,
  anchor: null,
  valid_from: '2026-01-01T00:00:00.000Z',
  invalid_from: null,
  superseded_by: null,
  confidence: 1,
  pinned: false,
  archived_at: null,
  last_recalled_at: null,
  recall_count: 0,
  ...over,
});

describe('the vocabulary', () => {
  it('labels every kind and origin — a missing one would render as blank chrome', () => {
    for (const k of MEMORY_KINDS) expect(KIND_LABEL[k]).toBeTruthy();
    for (const o of MEMORY_ORIGINS) expect(ORIGIN_LABEL[o]).toBeTruthy();
  });

  it('keeps labels sentence case (constitution: no Title Case in UI copy)', () => {
    for (const label of [...Object.values(KIND_LABEL), ...Object.values(ORIGIN_LABEL)]) {
      // Every word after the first is lowercase, unless it is a proper noun.
      const rest = label.split(' ').slice(1).filter((w) => w !== 'Zenboard');
      expect(rest.every((w) => w === w.toLowerCase()), label).toBe(true);
    }
  });
});

describe('normalizeBody', () => {
  it('collapses a pasted selection into one line', () => {
    expect(normalizeBody('  They pay\n on the   1st,\n\nalways.  ')).toBe('They pay on the 1st, always.');
  });

  it('is empty for whitespace only', () => {
    expect(normalizeBody('   \n\t ')).toBeNull();
    expect(normalizeBody('')).toBeNull();
    expect(normalizeBody(null)).toBeNull();
    expect(normalizeBody(undefined)).toBeNull();
  });

  it('does NOT truncate — an over-long fact is refused, never silently cut', () => {
    const long = 'x'.repeat(BODY_MAX + 50);
    expect(normalizeBody(long)).toHaveLength(BODY_MAX + 50);
    expect(bodyProblem(long)).toBe('too-long');
  });

  it('accepts a body of exactly the cap', () => {
    expect(bodyProblem('x'.repeat(BODY_MAX))).toBeNull();
    expect(bodyProblem('x'.repeat(BODY_MAX + 1))).toBe('too-long');
  });

  it('measures the NORMALIZED length, so a blank-line-riddled paste is judged on its words', () => {
    // 250 characters of content that arrives over the cap only because of the
    // whitespace between the lines. A run of whitespace collapses to ONE space
    // (it does not vanish), so this lands at 274 and is accepted.
    const wrapped = Array.from({ length: 25 }, () => 'x'.repeat(10)).join('\n\n\n');
    expect(wrapped.length).toBeGreaterThan(BODY_MAX);
    expect(normalizeBody(wrapped)).toHaveLength(274);
    expect(bodyProblem(wrapped)).toBeNull();
  });

  it('reports empty for nothing at all', () => {
    expect(bodyProblem('  ')).toBe('empty');
  });
});

describe('factKey — the app-side half of idx_memories_dedupe', () => {
  it('ignores case and whitespace, exactly as the index does', () => {
    expect(factKey(CLIENT, 'They pay  late')).toBe(factKey(CLIENT, '  they PAY late  '));
  });

  it('separates the same words said about different subjects', () => {
    expect(factKey(CLIENT, 'They pay late')).not.toBe(factKey(OTHER, 'They pay late'));
  });

  it('gives `self` a stable key — the nil-uuid coalesce, or nulls would never collide', () => {
    expect(factKey(SELF, 'I plan more than I do')).toBe(factKey(SELF, 'i plan more than i do'));
    expect(factKey(SELF, 'x')).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('finds a duplicate the database would reject', () => {
    const known = [fact()];
    expect(alreadyKnown(known, CLIENT, 'acme wants INVOICES on the 1st')?.id).toBe('m1');
    expect(alreadyKnown(known, CLIENT, 'Acme pays late')).toBeNull();
    expect(alreadyKnown(known, OTHER, 'Acme wants invoices on the 1st')).toBeNull();
  });

  it('lets a superseded fact be stated again — the index is partial for this reason', () => {
    const known = [fact({ invalid_from: '2026-03-01T00:00:00.000Z' })];
    expect(alreadyKnown(known, CLIENT, 'Acme wants invoices on the 1st')).toBeNull();
  });
});

describe('isCurrent — the temporal spine', () => {
  const MARCH = '2026-03-15T00:00:00.000Z';
  const JULY = '2026-07-15T00:00:00.000Z';

  it('is true while a fact has not been replaced', () => {
    expect(isCurrent(fact(), MARCH)).toBe(true);
  });

  it('is false before the fact was established', () => {
    expect(isCurrent(fact({ valid_from: JULY }), MARCH)).toBe(false);
  });

  it('answers what was true in March after a June supersession', () => {
    const old = fact({ invalid_from: '2026-06-01T00:00:00.000Z', superseded_by: 'm2' });
    expect(isCurrent(old, MARCH)).toBe(true);
    expect(isCurrent(old, JULY)).toBe(false);
  });

  it('never shows a fact and its replacement as both true at the switchover', () => {
    const at = new Date('2026-06-01T12:00:00.000Z');
    const old = fact({ ...supersedePatch('m2', at) });
    const next = fact({ id: 'm2', body: 'Acme wants invoices on the 15th', valid_from: validFromFor(at) });
    // The interval is half-open: the instant belongs to the replacement alone.
    expect(isCurrent(old, at)).toBe(false);
    expect(isCurrent(next, at)).toBe(true);
    expect(asOf([old, next], at).map((m) => m.id)).toEqual(['m2']);
  });

  it('excludes archived facts here, so no surface has to remember to', () => {
    expect(isCurrent(fact({ archived_at: '2026-02-01T00:00:00.000Z' }), MARCH)).toBe(false);
    // …but they were still true before you archived them.
    expect(isCurrent(fact({ archived_at: '2026-06-01T00:00:00.000Z' }), MARCH)).toBe(true);
  });

  it('treats an unparseable timestamp as not current rather than throwing', () => {
    expect(isCurrent(fact({ valid_from: 'not a date' }), MARCH)).toBe(true);
    expect(isCurrent(fact(), 'not a date')).toBe(false);
  });
});

describe('sortMemories', () => {
  it('puts pinned first, then confidence, then most recently established', () => {
    const list: Memory[] = [
      fact({ id: 'guess', confidence: 0.4, valid_from: '2026-05-01T00:00:00.000Z' }),
      fact({ id: 'old', valid_from: '2026-01-01T00:00:00.000Z' }),
      fact({ id: 'pinned-guess', confidence: 0.2, pinned: true }),
      fact({ id: 'new', valid_from: '2026-06-01T00:00:00.000Z' }),
    ];
    // A FIXED instant. `sortMemories` orders on FADED confidence (§5.4), so
    // without this the assertion would quietly depend on the day it is run.
    expect(sortMemories(list, '2026-06-15T00:00:00.000Z').map((m) => m.id))
      .toEqual(['pinned-guess', 'new', 'old', 'guess']);
  });

  it('does not mutate its input — surfaces render server data they do not own', () => {
    const list = [fact({ id: 'a', confidence: 0.1 }), fact({ id: 'b' })];
    sortMemories(list);
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('supersedePatch', () => {
  it('stops the old fact at exactly the instant the new one starts', () => {
    const at = new Date('2026-06-01T12:00:00.000Z');
    expect(supersedePatch('m2', at)).toEqual({
      invalid_from: '2026-06-01T12:00:00.000Z',
      superseded_by: 'm2',
    });
    expect(validFromFor(at)).toBe('2026-06-01T12:00:00.000Z');
  });

  it('satisfies 0029s memories_superseded_is_invalid — a pointer implies an end', () => {
    const patch = supersedePatch('m2');
    expect(patch.superseded_by).toBeTruthy();
    expect(patch.invalid_from).toBeTruthy();
  });
});

describe('subjects', () => {
  it('turns a record subject into an ordinary fabric ref', () => {
    expect(subjectRef(CLIENT)).toEqual({ type: 'client', id: CLIENT.id });
  });

  it('has no ref for `self` — you are the one subject with no row', () => {
    expect(subjectRef(SELF)).toBeNull();
  });

  it('compares subjects without caring how null arrived', () => {
    expect(sameSubject(SELF, { type: 'self', id: null })).toBe(true);
    expect(sameSubject(CLIENT, OTHER)).toBe(false);
    expect(sameSubject(CLIENT, { type: 'project', id: CLIENT.id })).toBe(false);
  });
});

describe('groupBySubject — the /memory home\'s shape', () => {
  const about = (id: string, subject: Partial<Memory>, over: Partial<Memory> = {}) =>
    fact({ id, ...subject, ...over });

  it('puts "About you" first however late it arrives', () => {
    const rows = [
      about('a', { subject_type: 'client', subject_id: CLIENT.id }),
      about('b', { subject_type: 'project', subject_id: OTHER.id }),
      about('c', { subject_type: 'self', subject_id: null }),
    ];
    expect(groupBySubject(rows).map((g) => g.subject.type)).toEqual(['self', 'client', 'project']);
  });

  it('keeps every other subject in the order it arrived — recency, not alphabet', () => {
    const rows = [
      about('z', { subject_type: 'client', subject_id: OTHER.id }),
      about('a', { subject_type: 'client', subject_id: CLIENT.id }),
    ];
    expect(groupBySubject(rows).map((g) => g.subject.id)).toEqual([OTHER.id, CLIENT.id]);
  });

  it('collapses one subject\'s facts into one group, sorted', () => {
    const rows = [
      about('plain', { subject_type: 'client', subject_id: CLIENT.id }),
      about('pinned', { subject_type: 'client', subject_id: CLIENT.id }, { pinned: true }),
    ];
    const groups = groupBySubject(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((m) => m.id)).toEqual(['pinned', 'plain']);
  });

  it('separates the same id used as two different subject types', () => {
    const rows = [
      about('as-client', { subject_type: 'client', subject_id: CLIENT.id }),
      about('as-project', { subject_type: 'project', subject_id: CLIENT.id }),
    ];
    expect(groupBySubject(rows)).toHaveLength(2);
  });

  it('gives every group a distinct key', () => {
    const rows = [
      about('s', { subject_type: 'self', subject_id: null }),
      about('c', { subject_type: 'client', subject_id: CLIENT.id }),
    ];
    const keys = groupBySubject(rows).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is empty for no rows rather than inventing an About you group', () => {
    expect(groupBySubject([])).toEqual([]);
  });
});

describe('selfFirst — one rule, shared by the loader and the page', () => {
  const g = (type: MemorySubject['type'], id: string | null) => ({ subject: { type, id } });

  it('lifts "About you" out of the middle without disturbing the rest', () => {
    const groups = [g('client', 'a'), g('self', null), g('project', 'b')];
    expect(selfFirst(groups).map((x) => x.subject.type)).toEqual(['self', 'client', 'project']);
  });

  it('is a no-op when there is no self group', () => {
    const groups = [g('client', 'a'), g('project', 'b')];
    expect(selfFirst(groups)).toEqual(groups);
  });

  it('leaves an already-leading self group where it is', () => {
    const groups = [g('self', null), g('client', 'a')];
    expect(selfFirst(groups)).toEqual(groups);
  });
});

describe('dismissedKeys — refusals live in untyped JSON', () => {
  it('reads the keys back', () => {
    expect(dismissedKeys({ [DISMISSED_KEY]: ['payment-rhythm:a', 'working-hours:self'] }))
      .toEqual(['payment-rhythm:a', 'working-hours:self']);
  });

  it('is empty for a profile that has never dismissed anything', () => {
    expect(dismissedKeys({})).toEqual([]);
    expect(dismissedKeys(null)).toEqual([]);
    expect(dismissedKeys(undefined)).toEqual([]);
  });

  it('survives a preferences blob of the wrong shape rather than throwing', () => {
    // `preferences` is hand-edited JSON in practice; a bad value here must not
    // take down the page that reads it.
    expect(dismissedKeys({ [DISMISSED_KEY]: 'not-an-array' })).toEqual([]);
    expect(dismissedKeys({ [DISMISSED_KEY]: [1, null, 'ok', {}] })).toEqual(['ok']);
    expect(dismissedKeys('a string')).toEqual([]);
  });
});

describe('historyOf — the claim "superseded, never overwritten", made checkable', () => {
  // net-45 → net-30 → net-15, each replacing the one before.
  const chain = [
    fact({ id: 'v1', body: 'net-45', invalid_from: '2026-02-01T00:00:00.000Z', superseded_by: 'v2' }),
    fact({ id: 'v2', body: 'net-30', invalid_from: '2026-05-01T00:00:00.000Z', superseded_by: 'v3' }),
    fact({ id: 'v3', body: 'net-15' }),
  ];

  it('returns what the current fact replaced, oldest first', () => {
    expect(historyOf(chain, 'v3').map((m) => m.body)).toEqual(['net-45', 'net-30']);
  });

  it('gives a mid-chain fact only what came before IT', () => {
    expect(historyOf(chain, 'v2').map((m) => m.body)).toEqual(['net-45']);
  });

  it('is empty for a fact that replaced nothing', () => {
    expect(historyOf(chain, 'v1')).toEqual([]);
    expect(historyOf([], 'v3')).toEqual([]);
  });

  it('ignores unrelated facts about other subjects', () => {
    const noise = fact({ id: 'other', body: 'unrelated', subject_id: OTHER.id });
    expect(historyOf([...chain, noise], 'v3').map((m) => m.body)).toEqual(['net-45', 'net-30']);
  });

  it('terminates on a cycle rather than hanging the render', () => {
    // Nothing in the app can write this; `superseded_by` has no constraint
    // forbidding it, and an infinite walk would take down a page.
    const loop = [
      fact({ id: 'a', superseded_by: 'b' }),
      fact({ id: 'b', superseded_by: 'a' }),
    ];
    expect(() => historyOf(loop, 'a')).not.toThrow();
    expect(historyOf(loop, 'a').length).toBeLessThanOrEqual(2);
  });

  it('survives a dangling pointer to a row that is gone', () => {
    const dangling = [fact({ id: 'v2', body: 'net-30', superseded_by: 'deleted' })];
    expect(historyOf(dangling, 'v2')).toEqual([]);
  });
});

describe('confirmedConfidence — the half that was never wired', () => {
  it('is a step, not a jump to certainty', () => {
    expect(confirmedConfidence(0.5)).toBeCloseTo(0.5 + CONFIRM_STEP);
    expect(confirmedConfidence(0.5)).toBeLessThan(1);
  });

  it('caps at 1 — 0029s CHECK is a boundary the app should never reach', () => {
    expect(confirmedConfidence(0.95)).toBe(1);
    expect(confirmedConfidence(1)).toBe(1);
  });

  it('takes three confirmations to carry a derived guess to the top', () => {
    let c = 0.5;
    for (let i = 0; i < 3; i += 1) c = confirmedConfidence(c);
    expect(c).toBeGreaterThan(0.9);
  });

  it('never returns something the database would reject', () => {
    for (const bad of [NaN, -5, Infinity]) {
      const out = confirmedConfidence(bad);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(1);
    }
  });
});

describe('needsReview — what a weekly review should actually ask about', () => {
  it('asks about the least certain first', () => {
    const list = [
      fact({ id: 'sure', confidence: 0.9 }),
      fact({ id: 'guess', confidence: 0.3 }),
      fact({ id: 'middling', confidence: 0.6 }),
    ];
    expect(needsReview(list).map((m) => m.id)).toEqual(['guess', 'middling', 'sure']);
  });

  it('never asks about a pinned fact — pinning IS the answer', () => {
    const list = [fact({ id: 'pinned', confidence: 0.1, pinned: true }), fact({ id: 'open', confidence: 0.8 })];
    expect(needsReview(list).map((m) => m.id)).toEqual(['open']);
  });

  it('skips anything already superseded or archived', () => {
    const list = [
      fact({ id: 'old', confidence: 0.1, invalid_from: '2026-01-01T00:00:00.000Z' }),
      fact({ id: 'gone', confidence: 0.1, archived_at: '2026-01-01T00:00:00.000Z' }),
      fact({ id: 'live', confidence: 0.9 }),
    ];
    expect(needsReview(list).map((m) => m.id)).toEqual(['live']);
  });

  it('is bounded — a review is not a wall', () => {
    const many = Array.from({ length: 40 }, (_, i) => fact({ id: `m${i}`, confidence: i / 100 }));
    expect(needsReview(many)).toHaveLength(5);
    expect(needsReview(many, 2)).toHaveLength(2);
  });
});

describe('decay — §5.4, computed and never stored', () => {
  const JAN = '2026-01-01T00:00:00.000Z';
  const day = (n: number) => new Date(Date.parse(JAN) + n * 86_400_000).toISOString();

  it('does not touch a fact inside the grace period', () => {
    const m = fact({ valid_from: JAN, confidence: 0.8 });
    expect(fadedConfidence(m, day(FADE_GRACE_DAYS - 1))).toBe(0.8);
    expect(fadedConfidence(m, day(0))).toBe(0.8);
  });

  it('halves a silent fact every half-life after the grace period', () => {
    const m = fact({ valid_from: JAN, confidence: 0.8 });
    expect(fadedConfidence(m, day(FADE_GRACE_DAYS + FADE_HALFLIFE_DAYS))).toBeCloseTo(0.4, 5);
    expect(fadedConfidence(m, day(FADE_GRACE_DAYS + FADE_HALFLIFE_DAYS * 2))).toBeCloseTo(0.2, 5);
  });

  it('never fades a pinned fact — pinning is the user overruling the rule', () => {
    const m = fact({ valid_from: JAN, confidence: 0.8, pinned: true });
    expect(fadedConfidence(m, day(900))).toBe(0.8);
    expect(isFading(m, day(900))).toBe(false);
  });

  it('resets the clock when a fact is recalled, without changing what is stored', () => {
    const stale = fact({ valid_from: JAN, confidence: 0.8 });
    const recalled = fact({ valid_from: JAN, confidence: 0.8, last_recalled_at: day(300) });
    const at = day(400);
    expect(fadedConfidence(stale, at)).toBeLessThan(fadedConfidence(recalled, at));
    // The STORED number is untouched either way — decay is a read-time rule.
    expect(stale.confidence).toBe(0.8);
    expect(recalled.confidence).toBe(0.8);
  });

  it('prefers the recall stamp over the establishment date', () => {
    const m = fact({ valid_from: JAN, last_recalled_at: day(200) });
    expect(lastTouched(m)).toBe(Date.parse(day(200)));
  });

  it('flags a fact as fading only once it drops under the threshold', () => {
    const m = fact({ valid_from: JAN, confidence: 0.8 });
    expect(isFading(m, day(FADE_GRACE_DAYS))).toBe(false);
    // 0.8 → under 0.25 needs a bit over two half-lives.
    expect(isFading(m, day(FADE_GRACE_DAYS + FADE_HALFLIFE_DAYS * 3))).toBe(true);
    expect(fadedConfidence(m, day(FADE_GRACE_DAYS + FADE_HALFLIFE_DAYS * 3))).toBeLessThan(FADE_THRESHOLD);
  });

  it('never flags a superseded or archived fact — they are already gone', () => {
    const old = fact({ valid_from: JAN, confidence: 0.8, invalid_from: day(10) });
    const gone = fact({ valid_from: JAN, confidence: 0.8, archived_at: day(10) });
    expect(isFading(old, day(900))).toBe(false);
    expect(isFading(gone, day(900))).toBe(false);
  });

  it('lists the faintest first, and is bounded', () => {
    const list = [
      fact({ id: 'faint', valid_from: JAN, confidence: 0.4 }),
      fact({ id: 'fainter', valid_from: JAN, confidence: 0.31 }),
      fact({ id: 'fresh', valid_from: day(880), confidence: 0.9 }),
    ];
    const at = day(900);
    expect(fadingFacts(list, at).map((m) => m.id)).toEqual(['fainter', 'faint']);
    expect(fadingFacts(list, at, 1)).toHaveLength(1);
  });

  it('sorts a long-silent fact below a freshly confirmed one', () => {
    const silent = fact({ id: 'silent', valid_from: JAN, confidence: 0.9 });
    const recent = fact({ id: 'recent', valid_from: JAN, confidence: 0.6, last_recalled_at: day(890) });
    expect(sortMemories([silent, recent], day(900)).map((m) => m.id)).toEqual(['recent', 'silent']);
  });
});
