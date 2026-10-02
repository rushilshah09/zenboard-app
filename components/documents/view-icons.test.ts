import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VIEW_ICON, DB_MENU_ICON } from './view-icons';

// The user's brief, §4: "we are using the same icon for every database. This makes
// Zenboard feel generic and unfinished." Seven slash-menu entries drew one glyph.
describe('database glyphs', () => {
  it('no two database entries in the slash menu share a glyph', () => {
    const glyphs = Object.values(DB_MENU_ICON);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('a layout wears the same glyph in the slash menu as on its view tab', () => {
    for (const kind of ['table', 'board', 'gallery', 'list', 'calendar'] as const) {
      expect(DB_MENU_ICON[kind], kind).toBe(VIEW_ICON[kind]);
    }
  });

  it('is read from this one map by the view tabs, the slash menu and the Docs grid', () => {
    expect(readFileSync('components/documents/database-view.tsx', 'utf8')).toMatch(/VIEW_ICON\[/);
    expect(readFileSync('components/documents/block-editor.tsx', 'utf8')).toMatch(/DB_MENU_ICON\[/);
    // A database page in the Docs grid was drawn with the document glyph.
    expect(readFileSync('components/documents/documents-view.tsx', 'utf8')).toMatch(/t === 'database' \? Database/);
  });
});
