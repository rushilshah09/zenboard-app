import { describe, it, expect } from 'vitest';
import { BLOCK_MENU, menuKey } from '@/lib/blocks';
import { PREVIEW_KEYS } from './slash-previews';

// Every slash-menu entry carries a picture of what it makes (Notion's hover
// preview — the user asked for it "same to same"). Without this, a new entry
// would silently show the plain-text picture: a preview that lies.
describe('slash menu previews', () => {
  it('draws a picture for every entry, and none for an entry that is gone', () => {
    const keys = BLOCK_MENU.map(menuKey);
    expect([...PREVIEW_KEYS].sort()).toEqual([...keys].sort());
  });
});
