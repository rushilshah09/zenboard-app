import { describe, it, expect } from 'vitest';
import { docText, snippetAround, rankRecordHits, MENTIONABLE_TYPES, type RecordHit } from './search';
import { recordHref } from './connected';

const blocks = (...items: unknown[]) => ({ blocks: items });

describe('docText', () => {
  it('flattens block text in order', () => {
    expect(docText(blocks(
      { id: 'a', type: 'h1', text: 'Kickoff agenda' },
      { id: 'b', type: 'text', text: 'Introductions, then scope.' },
    ))).toBe('Kickoff agenda\nIntroductions, then scope.');
  });

  it('reads the legacy { text } prose shape', () => {
    expect(docText({ text: 'An old note.' })).toBe('An old note.');
  });

  it('includes table cells, joined per row', () => {
    expect(docText(blocks({ id: 't', type: 'table', text: '', rows: [['Name', 'Owner'], ['Rebrand', 'Sarah']] })))
      .toBe('Name · Owner\nRebrand · Sarah');
  });

  it('skips empty and malformed blocks without throwing', () => {
    expect(docText(blocks({ text: '   ' }, null, 'nonsense', { type: 'divider' }, { text: 'kept' }))).toBe('kept');
  });

  it('returns empty string for anything that is not content', () => {
    for (const v of [null, undefined, 42, 'text', {}, { blocks: 'no' }]) {
      expect(docText(v)).toBe('');
    }
  });
});

describe('snippetAround', () => {
  it('returns the whole line when it is short', () => {
    expect(snippetAround('Kickoff agenda\nSend the Meridian brief', 'meridian'))
      .toBe('Send the Meridian brief');
  });

  it('is case-insensitive', () => {
    expect(snippetAround('The MERIDIAN rebrand', 'meridian')).toBe('The MERIDIAN rebrand');
  });

  it('windows a long line around the match with ellipses', () => {
    const line = `${'a'.repeat(80)} meridian ${'b'.repeat(80)}`;
    const s = snippetAround(line, 'meridian')!;
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s).toContain('meridian');
    expect(s.length).toBeLessThan(line.length);
  });

  it('never spans a line break — a snippet glued from two paragraphs reads as nonsense', () => {
    const s = snippetAround('first paragraph\nmeridian here\nthird paragraph', 'meridian')!;
    expect(s).toBe('meridian here');
    expect(s).not.toContain('paragraph');
  });

  it('returns undefined when the term is absent — this is how coarse DB hits get dropped', () => {
    // The jsonb pre-filter matches block ids and type names too; those must not
    // survive into results.
    expect(snippetAround('Kickoff agenda', 'meridian')).toBeUndefined();
    expect(snippetAround('', 'meridian')).toBeUndefined();
    expect(snippetAround('anything', '')).toBeUndefined();
  });
});

// ── record search ordering ──────────────────────────────────────────────────

const hit = (title: string, extra: Partial<RecordHit> = {}): RecordHit => ({
  key: `${extra.type ?? 'doc'}:${title}`,
  type: extra.type ?? 'doc',
  id: title,
  title,
  ...extra,
});
const titles = (hits: RecordHit[]) => hits.map((h) => h.title);

describe('rankRecordHits', () => {
  it('reads exact, then prefix, then word-start, then contains', () => {
    const out = rankRecordHits([
      hit('Rebrand kickoff'),           // contains — "brand" starts no word here
      hit('Acme brand'),                // word-start
      hit('Brand'),                     // exact
      hit('Brand guide'),               // prefix
    ], 'brand');
    expect(titles(out)).toEqual(['Brand', 'Brand guide', 'Acme brand', 'Rebrand kickoff']);
  });

  it('is case-insensitive and trims the term', () => {
    expect(titles(rankRecordHits([hit('Zeta'), hit('ACME')], '  acme  '))).toEqual(['ACME', 'Zeta']);
  });

  it('puts body-only matches (a snippet, no title match) last', () => {
    const out = rankRecordHits([
      hit('Meeting notes', { snippet: '…the acme deadline…' }),
      hit('Acme'),
    ], 'acme');
    expect(titles(out)).toEqual(['Acme', 'Meeting notes']);
  });

  it('breaks ties by recency', () => {
    const out = rankRecordHits([
      hit('Acme one', { updatedAt: '2026-01-01T00:00:00Z' }),
      hit('Acme two', { updatedAt: '2026-08-01T00:00:00Z' }),
    ], 'acme');
    expect(titles(out)).toEqual(['Acme two', 'Acme one']);
  });

  it('orders purely by recency when there is no term — the bare "@" list', () => {
    const out = rankRecordHits([
      hit('Older', { updatedAt: '2026-01-01T00:00:00Z' }),
      hit('Newest', { updatedAt: '2026-08-03T00:00:00Z' }),
      hit('Middle', { updatedAt: '2026-05-01T00:00:00Z' }),
    ], '');
    expect(titles(out)).toEqual(['Newest', 'Middle', 'Older']);
  });

  it('treats a regex-special term as literal text, not a pattern', () => {
    expect(() => rankRecordHits([hit('C++ notes')], 'c++')).not.toThrow();
    expect(titles(rankRecordHits([hit('Zeta'), hit('C++ notes')], 'c++'))).toEqual(['C++ notes', 'Zeta']);
  });

  it('does not mutate its input', () => {
    const input = [hit('Zeta'), hit('Acme')];
    rankRecordHits(input, 'acme');
    expect(titles(input)).toEqual(['Zeta', 'Acme']);
  });
});

describe('MENTIONABLE_TYPES', () => {
  // A mention IS an internal link (lib/mentions.ts), so a type that cannot be
  // addressed could only produce a dead link and no backlink. This test is the
  // tripwire: give `goal` a route and it must join the list, not sit there
  // silently unmentionable.
  it('is exactly the set of types recordHref can address', () => {
    for (const t of MENTIONABLE_TYPES) expect(recordHref(t, 'id-1')).toBeDefined();
    // `meeting` left this list when it gained a route — which is precisely the
    // tripwire firing: an addressable type that stayed unmentionable.
    for (const t of ['goal', 'request', 'feedback'] as const) {
      expect(MENTIONABLE_TYPES).not.toContain(t);
      expect(recordHref(t, 'id-1')).toBeUndefined();
    }
  });
});
