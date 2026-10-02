import { describe, it, expect } from 'vitest';
import { toBlocks, serialize, type Block, type BlockType } from './blocks';

// "When I upload an image to this document it's visible, but when I reopen the same document the image is not"
// (user report 2026-09-21, with a screenshot of three empty "Add an image" blocks).
//
// An upload is stored as its attachment's row id (0033) with `src` cleared — and `normalize()`, the trust boundary
// every document is read through, keeps only the fields it names. It named `src`, `width` and `align` for an image,
// and never `fileId`. So every uploaded image, PDF and file came back empty the next time its document opened, and
// the next autosave wrote the empty block over the stored one. The same rule once took a proposal's prices away
// (line items): this is the second field it has dropped in silence, hence the structural guard at the bottom.

/** "an image", "a pdf" — test names are sentences. */
const a = (type: string) => (/^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`);

/** Through JSON, as the database hands a document back. */
const reopen = (blocks: Block[]): Block[] => toBlocks(JSON.parse(JSON.stringify(serialize(blocks))));

const UPLOAD = { fileId: '3f9a1c2e-1111-4a2b-8c3d-9e8f7a6b5c4d', fileName: 'Besan barfi slip.webp', fileSize: 184_320 };

describe('an uploaded file survives reopening its document', () => {
  for (const type of ['image', 'pdf', 'file'] as const) {
    it(`${a(type)} block keeps its upload`, () => {
      const [b] = reopen([{ id: 'u1', type, text: '', ...UPLOAD }]);
      expect(b).toMatchObject({ id: 'u1', type, ...UPLOAD });
    });
  }

  it('an image keeps its caption, width and placement with it', () => {
    const [b] = reopen([{ id: 'u1', type: 'image', text: 'Front of pack', ...UPLOAD, width: 60, align: 'center' }]);
    expect(b).toEqual({ id: 'u1', type: 'image', text: 'Front of pack', ...UPLOAD, width: 60, align: 'center' });
  });

  it('an image written inline before uploads moved to storage still opens', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    expect(reopen([{ id: 'u1', type: 'image', text: '', src }])[0].src).toBe(src);
  });

  it('a reference that is not an attachment id is dropped, not trusted', () => {
    for (const fileId of ['../../someone-else/secret.pdf', 'javascript:alert(1)', '', 'tmp-123', 42, null, { id: UPLOAD.fileId }]) {
      const [b] = toBlocks({ blocks: [{ id: 'u1', type: 'image', text: '', fileId, fileName: 'x.png', fileSize: 1 }] });
      expect(b.fileId, String(fileId)).toBeUndefined();
      // A name and a size describe an upload; without one they describe nothing.
      expect(b.fileName).toBeUndefined();
      expect(b.fileSize).toBeUndefined();
    }
  });

  it('a name and a size must be the right shape to be kept', () => {
    const [b] = toBlocks({ blocks: [{ id: 'u1', type: 'file', text: '', fileId: UPLOAD.fileId, fileName: 7, fileSize: -1 }] });
    expect(b).toMatchObject({ fileId: UPLOAD.fileId });
    expect(b.fileName).toBeUndefined();
    expect(b.fileSize).toBeUndefined();
    const [c] = toBlocks({ blocks: [{ id: 'u1', type: 'file', text: '', fileId: UPLOAD.fileId, fileName: 'n'.repeat(900), fileSize: Number.NaN }] });
    expect(c.fileName!.length).toBeLessThanOrEqual(200);
    expect(c.fileSize).toBeUndefined();
  });

  it('only a block that can hold a file keeps one', () => {
    const [b] = toBlocks({ blocks: [{ id: 'u1', type: 'text', text: 'A paragraph', ...UPLOAD }] });
    expect(b.fileId).toBeUndefined();
  });
});

// ── THE GUARD: every field the editor writes must come back ────────────────────
//
// `FIELDS` must name every key of `Block` — TypeScript refuses this file otherwise — and each one must appear in a
// fixture below that survives the round trip unchanged. A field added to `Block` without teaching `normalize()` to
// keep it now fails here, instead of shipping as a document that forgets.
const FIELDS: Record<keyof Block, true> = {
  id: true, type: true, text: true, spans: true, checked: true, lang: true, wrap: true, indent: true, rows: true,
  collapsed: true, src: true, fileId: true, fileName: true, fileSize: true, width: true, align: true, color: true,
  colId: true, pageId: true, dbKind: true, items: true, accept: true, icon: true,
};

/** One block per type, carrying every field that type is written with — in the canonical form normalize() keeps. */
const FULL: Record<BlockType, Block> = {
  text: { id: 'x-text', type: 'text', text: 'Bold start', spans: [{ text: 'Bold', b: true }, { text: ' start' }], color: 'red' },
  h1: { id: 'x-h1', type: 'h1', text: 'Title', color: 'blue-bg' },
  h2: { id: 'x-h2', type: 'h2', text: 'Section' },
  h3: { id: 'x-h3', type: 'h3', text: 'Subsection' },
  bullet: { id: 'x-bullet', type: 'bullet', text: 'Nested point', indent: 2 },
  numbered: { id: 'x-numbered', type: 'numbered', text: 'Step', indent: 1 },
  todo: { id: 'x-todo', type: 'todo', text: 'Slip missing for besan barfi', checked: true },
  quote: { id: 'x-quote', type: 'quote', text: 'Said on the call' },
  callout: { id: 'x-callout', type: 'callout', text: 'Heads up', icon: '🔥' },
  code: { id: 'x-code', type: 'code', text: 'const a = `b`;', lang: 'ts', wrap: true },
  divider: { id: 'x-divider', type: 'divider', text: '' },
  table: { id: 'x-table', type: 'table', text: '', rows: [['Item', 'Price'], ['Barfi', '120']] },
  toggle: { id: 'x-toggle', type: 'toggle', text: 'More', collapsed: true },
  image: { id: 'x-image', type: 'image', text: 'Front of pack', ...UPLOAD, width: 60, align: 'right' },
  bookmark: { id: 'x-bookmark', type: 'bookmark', text: 'Final logos — use these', src: 'https://drive.google.com/x' },
  embed: { id: 'x-embed', type: 'embed', text: '', src: 'https://www.figma.com/file/abc' },
  video: { id: 'x-video', type: 'video', text: '', src: 'https://www.youtube.com/watch?v=abc' },
  audio: { id: 'x-audio', type: 'audio', text: '', src: 'https://example.com/a.mp3' },
  pdf: { id: 'x-pdf', type: 'pdf', text: '', ...UPLOAD, fileName: 'Nutrition table.pdf' },
  file: { id: 'x-file', type: 'file', text: '', ...UPLOAD, fileName: 'Dieline.ai' },
  collection: { id: 'x-collection', type: 'collection', text: '', colId: 'c1', dbKind: 'board' },
  page: { id: 'x-page', type: 'page', text: '', pageId: 'p-child' },
  lineitems: { id: 'x-lineitems', type: 'lineitems', text: '', items: [{ id: 'li1', description: 'Packaging', quantity: 2, unitAmount: 1500 }] },
  accept: { id: 'x-accept', type: 'accept', text: '', accept: { statement: 'I accept this proposal.', label: 'Accept', requireEmail: true } },
};

describe('every field the editor writes comes back when the document reopens', () => {
  for (const [type, block] of Object.entries(FULL)) {
    it(`${a(type)} block`, () => {
      expect(reopen([block])).toEqual([block]);
    });
  }

  it('every field of a block is exercised by a fixture above', () => {
    const used = new Set(Object.values(FULL).flatMap((b) => Object.keys(b)));
    expect(Object.keys(FIELDS).filter((k) => !used.has(k))).toEqual([]);
  });
});
