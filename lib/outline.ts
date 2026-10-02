// The document outline — ONE rule for "what are the landmarks in this page".
//
// Headings are the spine, but a reader scanning a long doc is also looking for
// the things they can't see inside: a collapsed toggle, a table, a callout. Those
// are landmarks too (Notion and Google Docs both surface them), so the outline
// carries them at a visibly lower rank than headings rather than pretending the
// page is only its headings.
import type { Block, BlockType } from '@/lib/blocks';

export type OutlineItem = {
  id: string;
  type: BlockType;
  label: string;
  /** 1–3 for h1–h3; 4 for a structural landmark (toggle/table/callout). */
  level: 1 | 2 | 3 | 4;
};

const HEADING_LEVEL: Partial<Record<BlockType, 1 | 2 | 3>> = { h1: 1, h2: 2, h3: 3 };
/** Non-heading blocks worth a line: they hold content the reader can't see. */
const LANDMARKS: BlockType[] = ['toggle', 'table', 'callout'];

/** Fallback names, so a landmark with no text still reads as something. */
const FALLBACK: Partial<Record<BlockType, string>> = {
  toggle: 'Toggle', table: 'Table', callout: 'Callout',
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
};

/** First line only — a callout can be a paragraph, and the outline is an index. */
function label(b: Block): string {
  const first = (b.text ?? '').split(/\r?\n/)[0]?.trim() ?? '';
  if (!first) return FALLBACK[b.type] ?? b.type;
  return first.length > 80 ? first.slice(0, 79).trimEnd() + '…' : first;
}

export function outlineOf(blocks: Block[]): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const b of blocks) {
    const h = HEADING_LEVEL[b.type];
    if (h) { out.push({ id: b.id, type: b.type, label: label(b), level: h }); continue; }
    if (LANDMARKS.includes(b.type)) out.push({ id: b.id, type: b.type, label: label(b), level: 4 });
  }
  return out;
}

/**
 * Indent depth for display. Headings indent by their own rank; a landmark sits
 * one step under whatever heading precedes it, so it reads as *inside* that
 * section instead of floating at the left margin like a top-level heading.
 */
export function outlineDepths(items: OutlineItem[]): number[] {
  let lastHeading = 0;
  return items.map((it) => {
    if (it.level <= 3) { lastHeading = it.level; return it.level - 1; }
    return lastHeading; // a landmark under "## H2" (depth 1) shows at depth 1+... = lastHeading
  });
}
