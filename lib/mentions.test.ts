import { describe, it, expect } from 'vitest';
import { mentionsInBlocks, mentionsInProps, mentionsInDoc, diffMentions, edgeKey, insertMention, type MentionEdge } from './mentions';
import { parseRecordHref, recordHref, type EntityType } from './connected';

const ID = '11111111-2222-3333-4444-555555555555';
const ID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const block = (id: string, text: string, links: { text: string; link?: string }[] = []) =>
  ({ id, text, spans: links.length ? links : undefined });

describe('parseRecordHref', () => {
  it('round-trips every type recordHref can produce', () => {
    const types: EntityType[] = ['task', 'client', 'doc', 'invoice', 'project', 'form', 'memory'];
    for (const type of types) {
      const href = recordHref(type, ID);
      expect(href, `${type} has no href`).toBeTruthy();
      expect(parseRecordHref(href!)).toEqual({ type, id: ID });
    }
  });

  it('accepts the absolute URL that "Copy link" puts on the clipboard', () => {
    expect(parseRecordHref(`https://app.zenboard.com/documents?page=${ID}`, 'https://app.zenboard.com'))
      .toEqual({ type: 'doc', id: ID });
  });

  it('rejects another origin — that is an external link, not a reference', () => {
    expect(parseRecordHref(`https://evil.example/documents?page=${ID}`, 'https://app.zenboard.com')).toBeNull();
  });

  it('rejects a bare external URL', () => {
    expect(parseRecordHref('https://linear.app/some/page')).toBeNull();
    expect(parseRecordHref('mailto:hi@example.com')).toBeNull();
  });

  it('rejects an internal route with no id, or a junk id', () => {
    expect(parseRecordHref('/documents')).toBeNull();
    expect(parseRecordHref('/documents?page=')).toBeNull();
    expect(parseRecordHref('/documents?page=nope')).toBeNull();
    expect(parseRecordHref('/projects')).toBeNull();
    expect(parseRecordHref('/projects/x/settings')).toBeNull();
  });

  it('is not fooled by an unknown internal route', () => {
    expect(parseRecordHref(`/habits/${ID}`)).toBeNull();
  });
});

describe('mentionsInBlocks', () => {
  it('finds a record link and keeps the whole line as context', () => {
    const out = mentionsInBlocks([
      block('b1', 'Send the brief to Acme before Friday', [
        { text: 'Send the brief to ' }, { text: 'Acme', link: `/clients?c=${ID}` }, { text: ' before Friday' },
      ]),
    ]);
    expect(out).toEqual<MentionEdge[]>([
      { target_type: 'client', target_id: ID, anchor: 'b1', context: 'Send the brief to Acme before Friday' },
    ]);
  });

  it('ignores external links', () => {
    expect(mentionsInBlocks([block('b1', 'see linear', [{ text: 'see linear', link: 'https://linear.app' }])])).toEqual([]);
  });

  it('one block naming the same record twice is one edge', () => {
    const out = mentionsInBlocks([
      block('b1', 'Acme and Acme', [
        { text: 'Acme', link: `/clients?c=${ID}` }, { text: ' and ' }, { text: 'Acme', link: `/clients?c=${ID}` },
      ]),
    ]);
    expect(out).toHaveLength(1);
  });

  it('two blocks naming the same record are two edges — each deep-links elsewhere', () => {
    const l = [{ text: 'Acme', link: `/clients?c=${ID}` }];
    const out = mentionsInBlocks([block('b1', 'Acme', l), block('b2', 'Acme', l)]);
    expect(out.map((e) => e.anchor)).toEqual(['b1', 'b2']);
  });

  it('drops a document’s links to itself', () => {
    const out = mentionsInBlocks(
      [block('b1', 'this page', [{ text: 'this page', link: `/documents?page=${ID}` }])],
      { self: { type: 'doc', id: ID } },
    );
    expect(out).toEqual([]);
  });

  it('keeps a link to a DIFFERENT doc', () => {
    const out = mentionsInBlocks(
      [block('b1', 'other', [{ text: 'other', link: `/documents?page=${ID2}` }])],
      { self: { type: 'doc', id: ID } },
    );
    expect(out.map((e) => e.target_id)).toEqual([ID2]);
  });

  it('truncates a very long line rather than storing the essay', () => {
    const long = 'x'.repeat(400);
    const out = mentionsInBlocks([block('b1', long, [{ text: long, link: `/clients?c=${ID}` }])]);
    expect(out[0].context!.length).toBeLessThanOrEqual(180);
    expect(out[0].context!.endsWith('…')).toBe(true);
  });

  it('collapses whitespace and survives an empty line', () => {
    const out = mentionsInBlocks([block('b1', '  A   B  ', [{ text: 'A B', link: `/clients?c=${ID}` }])]);
    expect(out[0].context).toBe('A B');
  });

  it('tolerates null, empty and malformed input instead of throwing', () => {
    expect(mentionsInBlocks(null)).toEqual([]);
    expect(mentionsInBlocks([])).toEqual([]);
    expect(mentionsInBlocks([null as never])).toEqual([]);
    expect(mentionsInBlocks([{ }])).toEqual([]);
  });

  it('a block with no id still yields an edge, anchored nowhere', () => {
    const out = mentionsInBlocks([{ text: 'Acme', spans: [{ text: 'Acme', link: `/clients?c=${ID}` }] }]);
    expect(out[0].anchor).toBeNull();
  });
});

describe('diffMentions', () => {
  const stored = (id: string, target_id: string, anchor: string | null) =>
    ({ id, target_type: 'client' as const, target_id, anchor });
  const wanted = (target_id: string, anchor: string | null, context = 'c'): MentionEdge =>
    ({ target_type: 'client', target_id, anchor, context });

  it('an unchanged document writes nothing', () => {
    const d = diffMentions([stored('m1', ID, 'b1')], [wanted(ID, 'b1')]);
    expect(d.insert).toEqual([]);
    expect(d.remove).toEqual([]);
  });

  it('a new link inserts; a deleted one removes', () => {
    const d = diffMentions([stored('m1', ID, 'b1')], [wanted(ID2, 'b1')]);
    expect(d.insert.map((e) => e.target_id)).toEqual([ID2]);
    expect(d.remove.map((e) => e.id)).toEqual(['m1']);
  });

  it('moving a link to another block is a remove and an insert — the anchor changed', () => {
    const d = diffMentions([stored('m1', ID, 'b1')], [wanted(ID, 'b2')]);
    expect(d.insert).toHaveLength(1);
    expect(d.remove.map((e) => e.id)).toEqual(['m1']);
  });

  it('editing the sentence around a link writes nothing', () => {
    // Context is not part of the key on purpose: it would otherwise rewrite the
    // row on every keystroke.
    const d = diffMentions([stored('m1', ID, 'b1')], [wanted(ID, 'b1', 'a totally different sentence')]);
    expect(d.insert).toEqual([]);
    expect(d.remove).toEqual([]);
  });

  it('clearing a document removes everything it had', () => {
    const d = diffMentions([stored('m1', ID, 'b1'), stored('m2', ID2, 'b2')], []);
    expect(d.insert).toEqual([]);
    expect(d.remove.map((e) => e.id).sort()).toEqual(['m1', 'm2']);
  });
});

describe('edgeKey', () => {
  it('matches 0027’s unique index — anchor included, null coalesced', () => {
    expect(edgeKey({ target_type: 'doc', target_id: ID, anchor: null })).toBe(`doc:${ID}:`);
    expect(edgeKey({ target_type: 'doc', target_id: ID, anchor: 'b1' })).toBe(`doc:${ID}:b1`);
  });
});

// ── insertMention: the picker's text surgery ────────────────────────────────

describe('insertMention', () => {
  // A real UUID: `parseRecordHref` rejects anything else, so a toy id here
  // would make the round-trip test below silently vacuous.
  const PID = '9f1c2b7e-4d3a-4c8b-9f10-2ab7c6de5401';
  const HREF = `/projects/${PID}`;

  it('replaces the whole "@query" with the linked name, plus a trailing space', () => {
    const out = insertMention({ text: 'ship @acm' }, { at: 5, query: 'acm' }, 'Acme rebrand', HREF);
    expect(out).toMatchObject({ text: 'ship Acme rebrand ', caret: 18 });
    expect(out!.spans).toEqual([
      { text: 'ship ' },
      { text: 'Acme rebrand', link: HREF },
      { text: ' ' },
    ]);
  });

  it('works at the very start of a block', () => {
    const out = insertMention({ text: '@a' }, { at: 0, query: 'a' }, 'Acme', HREF);
    expect(out).toMatchObject({ text: 'Acme ', caret: 5 });
  });

  it('keeps the text that follows the trigger, and the caret before it', () => {
    const out = insertMention({ text: 'see @ac is late' }, { at: 4, query: 'ac' }, 'Acme', HREF);
    expect(out).toMatchObject({ text: 'see Acme  is late', caret: 9 });
  });

  it('preserves formatting on the surrounding spans', () => {
    const block = {
      text: 'bold @ac tail',
      spans: [{ text: 'bold ', b: true }, { text: '@ac tail' }],
    };
    const out = insertMention(block, { at: 5, query: 'ac' }, 'Acme', HREF);
    expect(out!.spans).toEqual([
      { text: 'bold ', b: true },
      { text: 'Acme', link: HREF },
      { text: '  tail' },
    ]);
  });

  it('does not extend the link mark over the trailing space', () => {
    const out = insertMention({ text: '@a' }, { at: 0, query: 'a' }, 'Acme', HREF);
    expect(out!.spans!.filter((s) => s.link)).toHaveLength(1);
    expect(out!.spans!.at(-1)).toEqual({ text: ' ' });
  });

  it('falls back to "Untitled" for a blank name rather than an empty link', () => {
    expect(insertMention({ text: '@a' }, { at: 0, query: 'a' }, '   ', HREF)).toMatchObject({ text: 'Untitled ' });
  });

  it('refuses when the trigger has moved — it must never cut the wrong range', () => {
    // The user kept typing between clicking a row and this running.
    expect(insertMention({ text: 'ship it' }, { at: 5, query: 'acm' }, 'Acme', HREF)).toBeNull();
    expect(insertMention({ text: '' }, { at: 0, query: '' }, 'Acme', HREF)).toBeNull();
  });

  it('round-trips: what it writes is what mentionsInBlocks reads back', () => {
    const out = insertMention({ text: 'ship @ac' }, { at: 5, query: 'ac' }, 'Acme', HREF)!;
    expect(mentionsInBlocks([{ id: 'b1', text: out.text, spans: out.spans }])).toEqual([
      { target_type: 'project', target_id: PID, anchor: 'b1', context: 'ship Acme' },
    ]);
  });
});

// A relation property is a reference, so it is an edge. Without this the
// Connected panel would show the client named in a sentence and miss the one put
// deliberately in a "Client" field — the more considered of the two.
describe('mentionsInProps', () => {
  const CLIENT = '11111111-2222-4333-8444-555555555555';
  const PROJ = '66666666-7777-4888-8999-aaaaaaaaaaaa';
  const rel = (over = {}) => ({ id: 'p1', name: 'Client', type: 'relation', records: [{ type: 'client' as const, id: CLIENT }], ...over });

  it('turns each record reference into an edge', () => {
    expect(mentionsInProps([rel()])).toEqual([
      { target_type: 'client', target_id: CLIENT, anchor: 'p1', context: 'Client' },
    ]);
  });

  it('anchors on the PROPERTY, and names it as the context', () => {
    // "Client" is what a backlink at the far end most usefully says about why
    // this edge exists — the same job `context` does for a body link's sentence.
    const [e] = mentionsInProps([rel({ id: 'pX', name: 'Billed to' })]);
    expect([e.anchor, e.context]).toEqual(['pX', 'Billed to']);
  });

  it('ignores properties that are not relations', () => {
    expect(mentionsInProps([{ id: 'p1', name: 'Notes', type: 'text' }])).toEqual([]);
    // A text property that somehow carries records is still not a relation.
    expect(mentionsInProps([{ id: 'p1', name: 'Notes', type: 'text', records: [{ type: 'client', id: CLIENT }] }])).toEqual([]);
  });

  it('drops a self-reference, like the body does', () => {
    const props = [rel({ records: [{ type: 'doc' as const, id: 'me' }] })];
    expect(mentionsInProps(props, { self: { type: 'doc', id: 'me' } })).toEqual([]);
  });

  it('survives empty, missing and malformed records', () => {
    expect(mentionsInProps(null)).toEqual([]);
    expect(mentionsInProps([rel({ records: [] })])).toEqual([]);
    expect(mentionsInProps([rel({ records: [{ type: 'client', id: '' }] })])).toEqual([]);
  });

  it('holds records of DIFFERENT types in one property', () => {
    // The deliberate difference from Notion, where a relation is configured
    // against one target database and can only ever reach rows of it.
    const mixed = mentionsInProps([rel({ records: [{ type: 'client' as const, id: CLIENT }, { type: 'project' as const, id: PROJ }] })]);
    expect(mixed.map((e) => e.target_type)).toEqual(['client', 'project']);
  });
});

describe('mentionsInDoc', () => {
  const CLIENT = '11111111-2222-4333-8444-555555555555';
  // Built from `recordHref` rather than a hand-written path: a client is
  // `/clients?c=<id>`, and a literal here would silently stop matching the day
  // that route changes — the exact failure recordHref/parseRecordHref are kept
  // adjacent to prevent.
  const body = [{ id: 'b1', text: 'see Acme', spans: [{ text: 'see ' }, { text: 'Acme', link: recordHref('client', CLIENT)! }] }];
  const props = [{ id: 'p1', name: 'Client', type: 'relation', records: [{ type: 'client' as const, id: CLIENT }] }];

  it('collects both halves in one pass', () => {
    // One call, because one save writes one set of edges: synced separately,
    // each half would see the other's rows as stale and delete them.
    expect(mentionsInDoc(body, props)).toHaveLength(2);
  });

  it('keeps the body link and the relation as SEPARATE edges', () => {
    // Same target, different anchors — two genuine references, and 0027's unique
    // index is on (target, anchor), so they do not collide.
    expect(mentionsInDoc(body, props).map((e) => e.anchor).sort()).toEqual(['b1', 'p1']);
  });

  it('is just the body when there are no properties', () => {
    expect(mentionsInDoc(body, null)).toEqual(mentionsInBlocks(body));
  });
});
