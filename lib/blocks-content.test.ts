import { describe, it, expect } from 'vitest';
import { withBlocks } from './blocks';

// A page's body is `blocks`, but its content holds more — a doc's cover, a collected
// item's remembered preview (COLLECTION_VIEW_PLAN C2). A database row's body save wrote
// `{ blocks }` alone, so the first sentence typed under a collected link would have
// erased the preview remembered for it.
describe('withBlocks — a body save keeps what else the page holds', () => {
  const blocks = [{ id: 'b1', type: 'text' as const, text: 'Why I saved this' }];

  it('replaces the blocks and keeps every other key', () => {
    const before = { blocks: [], preview: { url: 'https://x.com/a', at: '2026-09-15', title: 'A' }, cover: 'ruri' };
    expect(withBlocks(before, blocks)).toEqual({ ...before, blocks });
  });

  it('makes a body from nothing', () => {
    expect(withBlocks(undefined, blocks)).toEqual({ blocks });
    expect(withBlocks(null, [])).toEqual({ blocks: [] });
  });

  it('never changes the content it was given', () => {
    const before = { blocks: [], cover: 'ruri' };
    withBlocks(before, blocks);
    expect(before).toEqual({ blocks: [], cover: 'ruri' });
  });
});
