import { describe, it, expect } from 'vitest';
import { blockHref, parseBlockFragment, fragmentOf, withFragment, BLOCK_FRAGMENT_PREFIX } from '@/lib/block-link';
import { parseRecordHref, recordHref } from '@/lib/connected';
import { togglesHiding, type Block } from '@/lib/blocks';

const PAGE = '9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d';

describe('blockHref', () => {
  it('is the page address plus the block fragment', () => {
    expect(blockHref(PAGE, 'babc123')).toBe(`/documents?page=${PAGE}#${BLOCK_FRAGMENT_PREFIX}babc123`);
  });

  it('is built from recordHref, so the two cannot drift', () => {
    expect(blockHref(PAGE, 'b1')!.startsWith(recordHref('doc', PAGE)!)).toBe(true);
  });

  it('is null without both halves', () => {
    expect(blockHref('', 'b1')).toBeNull();
    expect(blockHref(PAGE, '')).toBeNull();
  });

  it('percent-encodes an id that is not URL-safe', () => {
    // `normalize()` accepts any string it finds as an id in stored JSON.
    const href = blockHref(PAGE, 'a b#c')!;
    expect(href.endsWith('#block-a%20b%23c')).toBe(true);
    expect(parseBlockFragment(href)).toBe('a b#c');
  });
});

describe('a block link is still a link to its document', () => {
  // The reason the address is a fragment: the fabric records one backlink per
  // document, not one per paragraph, and it gets that for free.
  it('parses as the doc, not as something new', () => {
    expect(parseRecordHref(blockHref(PAGE, 'b1')!)).toEqual({ type: 'doc', id: PAGE });
  });

  it('parses as the doc when absolute too', () => {
    const abs = `https://app.example.com${blockHref(PAGE, 'b1')}`;
    expect(parseRecordHref(abs, 'https://app.example.com')).toEqual({ type: 'doc', id: PAGE });
  });
});

describe('parseBlockFragment', () => {
  it('reads a whole href, a #fragment, or a bare fragment', () => {
    expect(parseBlockFragment(`/documents?page=${PAGE}#block-bxyz`)).toBe('bxyz');
    expect(parseBlockFragment('#block-bxyz')).toBe('bxyz');
    expect(parseBlockFragment('block-bxyz')).toBe('bxyz');
  });

  it('ignores anything that is not a block fragment', () => {
    expect(parseBlockFragment('')).toBeNull();
    expect(parseBlockFragment('#')).toBeNull();
    expect(parseBlockFragment('#section-2')).toBeNull();
    expect(parseBlockFragment(`/documents?page=${PAGE}`)).toBeNull();
    expect(parseBlockFragment('#block-')).toBeNull();
  });

  it('takes the FIRST hash, so a second one cannot smuggle a fragment in', () => {
    expect(parseBlockFragment('#other#block-b1')).toBeNull();
  });

  it('survives a malformed escape instead of throwing', () => {
    // decodeURIComponent('%zz') throws; the caller is a URL bar.
    expect(parseBlockFragment('#block-%zz')).toBeNull();
  });

  it('refuses an absurdly long id', () => {
    expect(parseBlockFragment(`#block-${'b'.repeat(200)}`)).toBeNull();
  });
});

describe('fragmentOf / withFragment', () => {
  it('reads the fragment, hash included', () => {
    expect(fragmentOf('/documents?page=1#block-b1')).toBe('#block-b1');
    expect(fragmentOf('/documents?page=1')).toBe('');
  });

  it('carries a fragment across a re-derived href', () => {
    // The defect this exists to stop: resolveLink normalises an internal link
    // back through recordHref, which knows nothing about fragments — so every
    // block link would have landed at the top of its page.
    expect(withFragment('/documents?page=1', 'https://app/documents?page=1#block-b7'))
      .toBe('/documents?page=1#block-b7');
  });

  it('leaves an href that already has one alone', () => {
    expect(withFragment('/documents?page=1#keep', '/x#drop')).toBe('/documents?page=1#keep');
  });

  it('adds nothing when there is nothing to add', () => {
    expect(withFragment('/documents?page=1', '/documents?page=1')).toBe('/documents?page=1');
    expect(withFragment('/documents?page=1', '/documents?page=1#')).toBe('/documents?page=1');
  });
});

// ── which toggles have to be opened on the way in ────────────────────────────

const b = (id: string, extra: Partial<Block> = {}): Block =>
  ({ id, type: 'text', text: '', ...extra });
const toggle = (id: string, collapsed: boolean, indent = 0): Block =>
  ({ id, type: 'toggle', text: '', collapsed, indent });

describe('togglesHiding', () => {
  it('is empty for a block nobody is hiding', () => {
    expect(togglesHiding([b('a'), b('b')], 'b')).toEqual([]);
  });

  it('is empty when the toggle is open', () => {
    const blocks = [toggle('t', false), b('child', { indent: 1 })];
    expect(togglesHiding(blocks, 'child')).toEqual([]);
  });

  it('names the collapsed toggle hiding a child', () => {
    const blocks = [toggle('t', true), b('child', { indent: 1 })];
    expect(togglesHiding(blocks, 'child')).toEqual(['t']);
  });

  it('names nested toggles outermost first', () => {
    const blocks = [
      toggle('outer', true, 0),
      toggle('inner', true, 1),
      b('deep', { indent: 2 }),
    ];
    expect(togglesHiding(blocks, 'deep')).toEqual(['outer', 'inner']);
  });

  it('does not name a toggle that is itself the target', () => {
    // A collapsed toggle's own row is on screen — only its children are not.
    const blocks = [toggle('t', true), b('child', { indent: 1 })];
    expect(togglesHiding(blocks, 't')).toEqual([]);
  });

  it('stops at the end of the toggle section', () => {
    const blocks = [toggle('t', true), b('child', { indent: 1 }), b('after', { indent: 0 })];
    expect(togglesHiding(blocks, 'after')).toEqual([]);
  });

  it('is empty for an id that is not in the document', () => {
    expect(togglesHiding([toggle('t', true), b('child', { indent: 1 })], 'gone')).toEqual([]);
  });
});
