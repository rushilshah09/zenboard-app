import { describe, it, expect } from 'vitest';
import { outlineOf, outlineDepths } from './outline';
import type { Block, BlockType } from './blocks';

const b = (id: string, type: BlockType, text = ''): Block => ({ id, type, text } as Block);

describe('outlineOf', () => {
  it('lists headings in document order with their level', () => {
    const items = outlineOf([
      b('1', 'h1', 'Intro'), b('2', 'text', 'body'), b('3', 'h2', 'Details'), b('4', 'h3', 'Edge cases'),
    ]);
    expect(items.map((i) => [i.label, i.level])).toEqual([['Intro', 1], ['Details', 2], ['Edge cases', 3]]);
  });

  it('includes toggle, table and callout as level-4 landmarks', () => {
    const items = outlineOf([b('1', 'toggle', 'FAQ'), b('2', 'table'), b('3', 'callout', 'Warning')]);
    expect(items.map((i) => [i.label, i.level])).toEqual([['FAQ', 4], ['Table', 4], ['Warning', 4]]);
  });

  it('ignores ordinary blocks', () => {
    expect(outlineOf([b('1', 'text', 'hi'), b('2', 'bullet', 'x'), b('3', 'image')])).toEqual([]);
  });

  it('uses the first line only, and truncates a long one', () => {
    expect(outlineOf([b('1', 'callout', 'First line\nsecond line')])[0].label).toBe('First line');
    const long = 'x'.repeat(200);
    const got = outlineOf([b('1', 'h1', long)])[0].label;
    expect(got.endsWith('…')).toBe(true);
    expect(got.length).toBeLessThanOrEqual(80);
  });

  it('falls back to a type name when the block has no text', () => {
    expect(outlineOf([b('1', 'h2')])[0].label).toBe('Heading 2');
  });
});

describe('outlineDepths', () => {
  it('indents headings by rank and nests a landmark under the heading above it', () => {
    const items = outlineOf([
      b('1', 'h1', 'Intro'),      // depth 0
      b('2', 'h2', 'Details'),    // depth 1
      b('3', 'toggle', 'FAQ'),    // one step under Details (depth 1) → depth 2
      b('4', 'h1', 'Next'),       // depth 0
      b('5', 'table'),            // one step under Next (depth 0) → depth 1
    ]);
    expect(outlineDepths(items)).toEqual([0, 1, 2, 0, 1]);
  });

  it('puts a landmark before any heading at the left margin', () => {
    expect(outlineDepths(outlineOf([b('1', 'callout', 'Note')]))).toEqual([0]);
  });
});
