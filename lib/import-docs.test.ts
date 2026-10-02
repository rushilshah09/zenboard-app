import { describe, it, expect } from 'vitest';
import { parseNotionMarkdown, notionTitleFromFilename, isImportableDoc , notionBodyToBlocks} from './import-docs';

describe('notionTitleFromFilename', () => {
  it('strips the 32-hex id Notion appends to every export', () => {
    expect(notionTitleFromFilename('Meeting notes a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md'))
      .toBe('Meeting notes');
  });

  it('handles the underscore and hyphen separators too', () => {
    expect(notionTitleFromFilename('Roadmap_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md')).toBe('Roadmap');
    expect(notionTitleFromFilename('Roadmap-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md')).toBe('Roadmap');
  });

  it('leaves an ordinary filename alone — renaming a page is worse than an ugly suffix', () => {
    expect(notionTitleFromFilename('report-2026.md')).toBe('report-2026');
    expect(notionTitleFromFilename('notes.md')).toBe('notes');
    // 31 hex chars: not Notion's shape, so not stripped.
    expect(notionTitleFromFilename('Thing a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.md'))
      .toBe('Thing a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d');
  });

  it('drops any directory part and never returns empty', () => {
    expect(notionTitleFromFilename('Export/Sub/Page.md')).toBe('Page');
    expect(notionTitleFromFilename('.md')).toBe('Untitled');
  });
});

describe('parseNotionMarkdown', () => {
  it('takes the title from the H1 and does not repeat it in the body', () => {
    const doc = parseNotionMarkdown('Kickoff a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md',
      '# Client kickoff\n\nWe agreed on scope.\n');
    expect(doc.title).toBe('Client kickoff');
    expect(doc.blocks.map((b) => b.text)).toEqual(['We agreed on scope.']);
  });

  it('falls back to the filename when there is no H1', () => {
    const doc = parseNotionMarkdown('Loose note a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md', 'Just a line.\n');
    expect(doc.title).toBe('Loose note');
    expect(doc.blocks[0].text).toBe('Just a line.');
  });

  it('lifts a database page’s property block off the body', () => {
    const doc = parseNotionMarkdown('Task.md',
      '# Ship v1\n\nStatus: Done\nOwner: Sam\nTags: launch, web\n\nThe actual note.\n');
    expect(doc.properties).toEqual([
      { name: 'Status', value: 'Done' },
      { name: 'Owner', value: 'Sam' },
      { name: 'Tags', value: 'launch, web' },
    ]);
    expect(doc.blocks.map((b) => b.text)).toEqual(['The actual note.']);
  });

  it('does NOT eat prose that merely opens with a colon phrase', () => {
    // The failure that would silently delete a sentence: one "Name: value"
    // shaped line is prose far more often than it is a property block.
    const doc = parseNotionMarkdown('Note.md', '# Note\n\nNote: remember to call Sam.\n\nMore.\n');
    expect(doc.properties).toEqual([]);
    expect(doc.blocks.map((b) => b.text)).toContain('Note: remember to call Sam.');
  });

  it('keeps Markdown structure through textToBlocks', () => {
    const doc = parseNotionMarkdown('Doc.md',
      '# Doc\n\n## Section\n\n- one\n- two\n\n- [ ] todo\n\n> quote\n\n```ts\nconst x = 1;\n```\n');
    const types = doc.blocks.map((b) => b.type);
    expect(types).toContain('h2');
    expect(types).toContain('bullet');
    expect(types).toContain('todo');
    expect(types).toContain('quote');
    expect(types).toContain('code');
  });

  it('survives an empty file', () => {
    const doc = parseNotionMarkdown('Empty a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.md', '');
    expect(doc.title).toBe('Empty');
    expect(doc.properties).toEqual([]);
  });

  it('strips a BOM rather than putting it in the title', () => {
    expect(parseNotionMarkdown('x.md', '﻿# Real title\n').title).toBe('Real title');
  });
});

describe('isImportableDoc', () => {
  it('accepts the formats a Notion export contains', () => {
    for (const f of ['a.md', 'b.MARKDOWN', 'c.txt']) expect(isImportableDoc(f)).toBe(true);
  });
  it('rejects everything else — CSV belongs to the task importer', () => {
    for (const f of ['a.csv', 'b.pdf', 'c']) expect(isImportableDoc(f)).toBe(false);
  });
});

// ── FIDELITY ────────────────────────────────────────────────────────────────
// "I don't want that document damaged — it should look and behave like their
// Notion document." Each test below is one thing the old parser destroyed.
describe('notionBodyToBlocks — a Notion page survives the trip', () => {
  it('keeps nesting, which is the loss that changes MEANING', () => {
    // A three-level outline used to arrive as one flat column of bullets.
    const blocks = notionBodyToBlocks([
      '- Top',
      '    - Middle',
      '        - Deep',
    ].join('\n'));
    expect(blocks.map((b) => [b.type, b.text, b.indent ?? 0]))
      .toEqual([['bullet', 'Top', 0], ['bullet', 'Middle', 2], ['bullet', 'Deep', 4]]);
  });

  it('rebuilds a table instead of leaving rows of pipes', () => {
    const blocks = notionBodyToBlocks([
      '| Name | Status |',
      '| --- | --- |',
      '| Acme | Active |',
      '| Beta | Paused |',
    ].join('\n'));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows).toEqual([['Name', 'Status'], ['Acme', 'Active'], ['Beta', 'Paused']]);
  });

  it('turns an image into an image, not into its own markdown', () => {
    const [b] = notionBodyToBlocks('![Cover shot](Untitled%20Database/cover.png)');
    expect(b.type).toBe('image');
    expect(b.src).toBe('Untitled Database/cover.png');   // decoded
    expect(b.text).toBe('Cover shot');                    // alt survives as the caption
  });

  it('reads a Notion callout', () => {
    const [b] = notionBodyToBlocks('<aside>\n💡 Ship on Friday\n</aside>');
    expect(b.type).toBe('callout');
    expect(b.text).toContain('Ship on Friday');
  });

  it('reads a toggle and nests what was inside it', () => {
    const blocks = notionBodyToBlocks([
      '<details>',
      '<summary>Deploy steps</summary>',
      '',
      '- Build',
      '- Ship',
      '',
      '</details>',
    ].join('\n'));
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].text).toBe('Deploy steps');
    // The body belongs TO the toggle, so it is one level deeper.
    const kids = blocks.filter((b) => b.type === 'bullet');
    expect(kids.map((b) => [b.text, b.indent])).toEqual([['Build', 1], ['Ship', 1]]);
  });

  it('keeps code verbatim, with its language', () => {
    const [b] = notionBodyToBlocks('```ts\nconst a = 1;\n  const b = 2;\n```');
    expect(b.type).toBe('code');
    expect(b.lang).toBe('ts');
    expect(b.text).toBe('const a = 1;\n  const b = 2;');  // inner indentation intact
  });

  it('does not lose an equation it has no block for', () => {
    // Zenboard has no math block. Silently dropping it, or flattening it to
    // prose, is the kind of damage this whole file exists to prevent.
    const [b] = notionBodyToBlocks('$$\nE = mc^2\n$$');
    expect(b.type).toBe('code');
    expect(b.lang).toBe('latex');
    expect(b.text).toBe('E = mc^2');
  });

  it('makes a bare URL a bookmark, the way Notion exports one', () => {
    const [b] = notionBodyToBlocks('https://example.com/spec');
    expect(b.type).toBe('bookmark');
    expect(b.src).toBe('https://example.com/spec');
  });

  it('keeps inline formatting as spans, not as literal asterisks', () => {
    const [b] = notionBodyToBlocks('Ship **today**, not [later](https://x.com)');
    expect(b.text).not.toContain('**');
    expect(b.spans?.some((s) => s.b)).toBe(true);
    expect(b.spans?.some((s) => s.link)).toBe(true);
  });

  it('keeps a checked to-do checked', () => {
    const blocks = notionBodyToBlocks('- [x] Done\n- [ ] Not done');
    expect(blocks.map((b) => [b.type, b.checked])).toEqual([['todo', true], ['todo', false]]);
  });

  it('reads headings, quotes and dividers', () => {
    const blocks = notionBodyToBlocks('# A\n## B\n### C\n> Quoted\n---');
    expect(blocks.map((b) => b.type)).toEqual(['h1', 'h2', 'h3', 'quote', 'divider']);
  });
});
