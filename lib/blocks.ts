// Shared block model for the page editor. Content is stored in pages.content as
// { blocks: Block[] }. toBlocks() also accepts the legacy { text } prose shape so
// existing pages keep working — they're lifted into paragraph blocks on open.
// Inline formatting: Block.text is always PLAIN visible text; Block.spans
// (sparse) carries bold/italic/…/link runs. Legacy text carrying markdown
// markers (**b**, *i*, `c`, ~~s~~, [t](url) — the lib/clipboard.ts encoding)
// is lifted into spans by normalize() on load.
import { liftText, sparse, mergeSpans, spansToMd, type RichSpan } from '@/lib/rich';

export type BlockType =
  | 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered'
  | 'todo' | 'quote' | 'callout' | 'code' | 'divider' | 'table' | 'toggle'
  | 'image' | 'bookmark' | 'embed' | 'video' | 'audio' | 'pdf' | 'file'
  | 'collection';

// Media/link leaf blocks: carry a `src` URL, no editable body text (image also
// carries a caption in `text`). Shared by the editor for intake + turn-into rules.
export const MEDIA_TYPES: BlockType[] = ['image', 'bookmark', 'embed', 'video', 'audio', 'pdf', 'file'];

export type Block = {
  id: string;
  type: BlockType;
  text: string;          // plain visible text (never carries markers)
  spans?: RichSpan[];    // inline formatting runs; absent = unformatted
  checked?: boolean;   // todo
  lang?: string;       // code
  wrap?: boolean;      // code — soft-wrap long lines instead of scrolling
  indent?: number;     // nesting (0..n) — lists, text, quotes, toggle children
  rows?: string[][];   // table — rows[0] is the header row
  collapsed?: boolean; // toggle — children hidden when true
  src?: string;        // image — data/blob/http URL
  width?: number;      // image — width as a percent of the column (default 100)
  align?: 'left' | 'center' | 'right'; // image — horizontal placement (default left)
  color?: string;      // Notion-style block color: '<palette>' (text) or '<palette>-bg'
  colId?: string;      // collection — the inline database's collection id
  icon?: string;       // callout — emoji shown in the icon slot (default 💡)
};

// A fresh table: one header row + one body row, two columns.
export function emptyTableRows(): string[][] {
  return [['Column 1', 'Column 2'], ['', '']];
}

export const LIST_TYPES: BlockType[] = ['bullet', 'numbered', 'todo'];
// Blocks that participate in Tab nesting (indent).
export const NESTABLE_TYPES: BlockType[] = ['text', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'toggle'];

// ── Drag-and-drop drop target (§6.5) ────────────────────────────────────────
// Pure geometry: given the pointer and the on-screen midpoints of the
// non-moving rows (in document order), pick the gap to drop into and the nest
// indent level. Vertical gap = first row whose midpoint is below the pointer;
// indent = how far right the pointer sits past the column, snapped per `step`
// and clamped to one level deeper than the block above the gap.
export type DropRow = { id: string; mid: number; indent: number };
export type DropTargetCalc = { beforeId: string | null; aboveId: string | null; indent: number };
export function computeDrop(
  pointerY: number, pointerX: number, rows: DropRow[],
  colLeft: number, step: number, leaderNestable: boolean,
): DropTargetCalc {
  let gap = rows.length;
  for (let i = 0; i < rows.length; i++) { if (pointerY < rows[i].mid) { gap = i; break; } }
  const beforeId = gap < rows.length ? rows[gap].id : null;
  const aboveId = gap > 0 ? rows[gap - 1].id : null;
  if (!leaderNestable || gap === 0) return { beforeId, aboveId, indent: 0 };
  const maxIndent = rows[gap - 1].indent + 1;
  const indent = Math.max(0, Math.min(maxIndent, Math.round((pointerX - colLeft) / step)));
  return { beforeId, aboveId, indent };
}

const HEADING_RANK: Partial<Record<BlockType, number>> = { h1: 1, h2: 2, h3: 3 };

// The span of blocks that "belong" to blocks[i] (exclusive of i itself):
// · toggle → following blocks with a deeper indent
// · heading → everything until the next heading of the same or higher rank
// · otherwise → empty. Used by section drag, collapse, and section select.
export function sectionEnd(blocks: Block[], i: number): number {
  const b = blocks[i];
  if (!b) return i + 1;
  if (b.type === 'toggle') {
    const base = b.indent ?? 0;
    let j = i + 1;
    while (j < blocks.length && (blocks[j].indent ?? 0) > base) j++;
    return j;
  }
  const rank = HEADING_RANK[b.type];
  if (rank) {
    let j = i + 1;
    while (j < blocks.length) {
      const r = HEADING_RANK[blocks[j].type];
      if (r && r <= rank) break;
      j++;
    }
    return j;
  }
  return i + 1;
}

// Ids hidden by collapsed toggles (children of any collapsed toggle).
export function hiddenIds(blocks: Block[]): Set<string> {
  const hidden = new Set<string>();
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'toggle' && blocks[i].collapsed) {
      for (let j = i + 1; j < sectionEnd(blocks, i); j++) hidden.add(blocks[j].id);
    }
  }
  return hidden;
}

export function genId() {
  return 'b' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function emptyBlock(type: BlockType = 'text'): Block {
  return { id: genId(), type, text: '' };
}

// Validate a stored spans array; malformed entries are dropped.
function normalizeSpans(raw: unknown): RichSpan[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const spans: RichSpan[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || typeof (s as { text?: unknown }).text !== 'string') continue;
    const o = s as Record<string, unknown>;
    const sp: RichSpan = { text: o.text as string };
    if (o.b) sp.b = true; if (o.i) sp.i = true; if (o.u) sp.u = true; if (o.s) sp.s = true; if (o.c) sp.c = true;
    if (typeof o.link === 'string') sp.link = o.link;
    if (typeof o.color === 'string') sp.color = o.color;
    spans.push(sp);
  }
  return sparse(mergeSpans(spans));
}

function normalize(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = (o.type as BlockType) ?? 'text';
  const block: Block = { id: typeof o.id === 'string' ? o.id : genId(), type, text: typeof o.text === 'string' ? o.text : '' };
  // Rich text: stored spans win; otherwise lift legacy marker text (code
  // blocks stay literal — backticks there are content, not formatting).
  const spans = normalizeSpans(o.spans);
  if (spans) { block.spans = spans; block.text = spans.map((s) => s.text).join(''); }
  else if (type !== 'code' && block.text) {
    const lifted = liftText(block.text);
    block.text = lifted.text;
    if (lifted.spans) block.spans = lifted.spans;
  }
  if (type === 'todo') block.checked = !!o.checked;
  if (type === 'code') { block.lang = typeof o.lang === 'string' ? o.lang : 'text'; if (o.wrap) block.wrap = true; }
  if (type === 'toggle') block.collapsed = !!o.collapsed;
  if (type === 'callout' && typeof o.icon === 'string') block.icon = o.icon;
  if (type === 'image') { if (typeof o.src === 'string') block.src = o.src; if (typeof o.width === 'number') block.width = o.width; if (o.align === 'center' || o.align === 'right') block.align = o.align; }
  if (type === 'bookmark' || type === 'embed' || type === 'video' || type === 'audio' || type === 'pdf' || type === 'file') { if (typeof o.src === 'string') block.src = o.src; }
  if (type === 'collection' && typeof o.colId === 'string') block.colId = o.colId;
  if (typeof o.indent === 'number') block.indent = o.indent;
  if (typeof o.color === 'string') block.color = o.color;
  if (type === 'table') {
    const rows = Array.isArray(o.rows)
      ? (o.rows as unknown[]).map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))) : []))
      : emptyTableRows();
    block.rows = rows.length ? rows : emptyTableRows();
  }
  return block;
}

// Accepts: { blocks: [...] } (current), { text } (legacy prose), [] (empty default).
export function toBlocks(content: unknown): Block[] {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const o = content as Record<string, unknown>;
    if (Array.isArray(o.blocks)) {
      const bs = o.blocks.map(normalize).filter(Boolean) as Block[];
      return bs.length ? bs : [emptyBlock()];
    }
    if (typeof o.text === 'string') {
      const paras = o.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      return paras.length ? paras.map((p) => ({ id: genId(), type: 'text' as const, text: p })) : [emptyBlock()];
    }
  }
  if (Array.isArray(content)) {
    const bs = content.map(normalize).filter(Boolean) as Block[];
    return bs.length ? bs : [emptyBlock()];
  }
  return [emptyBlock()];
}

export function serialize(blocks: Block[]): { blocks: Block[] } {
  return { blocks };
}

// Plain-text projection (for portal docs, search, export).
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'divider') return '---';
      if (b.type === 'todo') return `${b.checked ? '[x]' : '[ ]'} ${b.text}`;
      if (b.type === 'bullet') return `• ${b.text}`;
      if (b.type === 'numbered') return `1. ${b.text}`;
      if (b.type === 'toggle') return `▸ ${b.text}`;
      if (b.type === 'image') return b.text ? `[image: ${b.text}]` : '[image]';
      if (b.type === 'bookmark' || b.type === 'embed' || b.type === 'video' || b.type === 'audio' || b.type === 'pdf' || b.type === 'file') return b.src ?? '';
      if (b.type === 'collection') return '[database]';
      if (b.type === 'table') return (b.rows ?? []).map((r) => r.join(' | ')).join('\n');
      return b.text;
    })
    .join('\n\n');
}

// Markdown export — inline formatting re-serializes to markers from spans.
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const md = spansToMd(b.spans, b.text);
      switch (b.type) {
        case 'h1': return `# ${md}`;
        case 'h2': return `## ${md}`;
        case 'h3': return `### ${md}`;
        case 'bullet': return `- ${md}`;
        case 'numbered': return `1. ${md}`;
        case 'todo': return `- [${b.checked ? 'x' : ' '}] ${md}`;
        case 'quote': return `> ${md}`;
        case 'toggle': return `- ▸ ${md}`;
        case 'callout': return `> 💡 ${md}`;
        case 'code': return '```' + (b.lang ?? '') + '\n' + b.text + '\n```';
        case 'image': return `![${b.text ?? ''}](${b.src ?? ''})`;
        case 'bookmark': case 'embed': case 'video': case 'audio': case 'pdf': case 'file': return b.src ?? '';
        case 'collection': return '[database]';
        case 'divider': return '---';
        case 'table': {
          const rows = b.rows ?? [];
          if (!rows.length) return '';
          const [head, ...body] = rows;
          const line = (r: string[]) => `| ${r.join(' | ')} |`;
          return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
        }
        default: return md;
      }
    })
    .join('\n\n');
}

// Markdown shortcut at the start of a block: returns the type to convert to.
// Markdown shortcuts typed at the start of a block (§7.2). Notion's mapping:
// `>` = toggle, `"` = quote (straight or smart quote). Any "N. " starts a
// numbered list; `---` becomes a divider on the third dash (no space needed).
export function markdownPrefix(text: string): BlockType | null {
  switch (text) {
    case '# ': return 'h1';
    case '## ': return 'h2';
    case '### ': return 'h3';
    case '- ': case '* ': case '+ ': return 'bullet';
    case '[] ': case '[ ] ': return 'todo';
    case '> ': return 'toggle';
    case '" ': case '“ ': return 'quote';
    case '``` ': case '```': return 'code';
    case '--- ': case '---': return 'divider';
    default:
      // Numbered list from any number ("1. ", "5. ", "12. ").
      if (/^\d+\.\s$/.test(text)) return 'numbered';
      return null;
  }
}

export type BlockMenuGroup = 'Basic' | 'Lists' | 'Media' | 'Database' | 'Blocks';
// `db` marks database entries: an inline collection block seeded with that
// view kind, or 'fullpage' → create a new database page (host must support it).
export type BlockMenuItem = { type: BlockType; label: string; hint: string; keywords: string; group: BlockMenuGroup; db?: 'table' | 'board' | 'gallery' | 'list' | 'fullpage' | 'linked' };
export const BLOCK_MENU: BlockMenuItem[] = [
  { type: 'text', label: 'Text', hint: 'Plain paragraph', keywords: 'text paragraph plain body', group: 'Basic' },
  { type: 'h1', label: 'Heading 1', hint: 'Large heading', keywords: 'h1 heading title big', group: 'Basic' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium heading', keywords: 'h2 heading subtitle', group: 'Basic' },
  { type: 'h3', label: 'Heading 3', hint: 'Small heading', keywords: 'h3 heading', group: 'Basic' },
  { type: 'bullet', label: 'Bulleted list', hint: 'Unordered list', keywords: 'bullet list unordered ul', group: 'Lists' },
  { type: 'numbered', label: 'Numbered list', hint: 'Ordered list', keywords: 'numbered ordered list ol', group: 'Lists' },
  { type: 'todo', label: 'To-do list', hint: 'Checkbox items', keywords: 'todo checkbox task check', group: 'Lists' },
  { type: 'toggle', label: 'Toggle list', hint: 'Collapsible section', keywords: 'toggle collapse expand fold accordion', group: 'Lists' },
  { type: 'image', label: 'Image', hint: 'Upload or embed', keywords: 'image picture photo media upload img figure', group: 'Media' },
  { type: 'bookmark', label: 'Web bookmark', hint: 'Link preview card', keywords: 'bookmark link url web preview card', group: 'Media' },
  { type: 'embed', label: 'Embed', hint: 'YouTube, Figma, and more', keywords: 'embed iframe youtube figma map', group: 'Media' },
  { type: 'video', label: 'Video', hint: 'YouTube, Vimeo, or a video link', keywords: 'video movie youtube vimeo mp4 player', group: 'Media' },
  { type: 'audio', label: 'Audio', hint: 'A link to a sound file', keywords: 'audio sound music mp3 podcast player', group: 'Media' },
  { type: 'pdf', label: 'PDF', hint: 'Embed a PDF viewer', keywords: 'pdf document viewer paper', group: 'Media' },
  { type: 'file', label: 'File', hint: 'Link a file attachment', keywords: 'file attachment download document upload', group: 'Media' },
  { type: 'collection', label: 'Table view', hint: 'Inline database, table view', keywords: 'database table view grid rows', group: 'Database', db: 'table' },
  { type: 'collection', label: 'Board view', hint: 'Inline database, board view', keywords: 'database board view kanban cards', group: 'Database', db: 'board' },
  { type: 'collection', label: 'Gallery view', hint: 'Inline database, gallery view', keywords: 'database gallery view cards grid', group: 'Database', db: 'gallery' },
  { type: 'collection', label: 'List view', hint: 'Inline database, list view', keywords: 'database list view rows minimal', group: 'Database', db: 'list' },
  { type: 'collection', label: 'Database — Inline', hint: 'Add a database to this page', keywords: 'database inline collection table rows data', group: 'Database', db: 'table' },
  { type: 'collection', label: 'Database — Full page', hint: 'Add a new database as a page', keywords: 'database full page collection new subpage', group: 'Database', db: 'fullpage' },
  { type: 'collection', label: 'Linked view of database', hint: 'Show an existing database here', keywords: 'linked view database source sync existing reference', group: 'Database', db: 'linked' },
  { type: 'table', label: 'Table', hint: 'Rows and columns', keywords: 'table grid rows columns spreadsheet', group: 'Blocks' },
  { type: 'quote', label: 'Quote', hint: 'Callout quote', keywords: 'quote blockquote', group: 'Blocks' },
  { type: 'callout', label: 'Callout', hint: 'Highlighted note', keywords: 'callout note info tip', group: 'Blocks' },
  { type: 'code', label: 'Code', hint: 'Monospace block', keywords: 'code snippet monospace', group: 'Blocks' },
  { type: 'divider', label: 'Divider', hint: 'Horizontal rule', keywords: 'divider hr line separator', group: 'Blocks' },
];
