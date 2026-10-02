// Shared block model for the page editor. Content is stored in pages.content as
// { blocks: Block[] }. toBlocks() also accepts the legacy { text } prose shape so
// existing pages keep working — they're lifted into paragraph blocks on open.
// Inline formatting: Block.text is always PLAIN visible text; Block.spans
// (sparse) carries bold/italic/…/link runs. Legacy text carrying markdown
// markers (**b**, *i*, `c`, ~~s~~, [t](url) — the lib/clipboard.ts encoding)
// is lifted into spans by normalize() on load.
import { liftText, sparse, mergeSpans, spansToMd, type RichSpan } from '@/lib/rich';
import { lineTotal, itemsTotal, emptyLineItem, type LineItem } from '@/lib/line-items';
import { acceptStatement, acceptLabel, type AcceptTerms } from '@/lib/acceptance';
import { safeHref } from '@/lib/safe-url';
import { isViewKind, type ViewKind } from '@/lib/collections';

// The union is DERIVED from this array so the runtime can check membership.
// `normalize()` below is the trust boundary for everything in `pages.content`,
// and until it could ask "is this a real type?" it could not enforce the one
// invariant the whole editor rests on — see `asBlockType`.
export const BLOCK_TYPES = [
  'text', 'h1', 'h2', 'h3', 'bullet', 'numbered',
  'todo', 'quote', 'callout', 'code', 'divider', 'table', 'toggle',
  'image', 'bookmark', 'embed', 'video', 'audio', 'pdf', 'file',
  'collection',
  // A page inside this page (Notion's Page block). The block holds only the page's
  // id; its title and icon are the page's own, so a rename shows everywhere.
  'page',
  // §7M paperwork: a proposal is a Doc with special blocks, not a separate
  // entity, so neither of these needs a table of its own. (The *acceptance* does
  // — see lib/acceptance.ts for why the signature cannot live in the payload.)
  'lineitems', 'accept',
] as const;

export type BlockType = typeof BLOCK_TYPES[number];

const TYPE_SET: ReadonlySet<string> = new Set(BLOCK_TYPES);

/**
 * A stored `type` becomes a real one, or becomes a paragraph.
 *
 * THE FAILURE THIS EXISTS FOR IS SILENT. An unrecognised type used to be cast
 * straight through, and the block still rendered, still edited and still saved —
 * it just matched nothing in the editor's type maps, so it fell out of the
 * document's typography onto the app's inherited 14px UI text. No error, no
 * warning: a paragraph that looks like chrome.
 *
 * Text is the right landing place because it is the only type that can hold any
 * content without losing it. Dropping the block would lose the words; keeping
 * the unknown type loses their meaning.
 */
export function asBlockType(raw: unknown): BlockType {
  return typeof raw === 'string' && TYPE_SET.has(raw) ? (raw as BlockType) : 'text';
}


// Media/link leaf blocks: carry a `src` URL, no editable body text (image also
// carries a caption in `text`). Shared by the editor for intake + turn-into rules.
export const MEDIA_TYPES: BlockType[] = ['image', 'bookmark', 'embed', 'video', 'audio', 'pdf', 'file'];

// Blocks with no editable body text: inserting one always drops a fresh
// paragraph after it, and typing never lands inside it. One list, because the
// editor asks this question on three different paths (slash menu, turn-into,
// paste) and three inline copies of it is how they drift apart.
export const LEAF_TYPES: BlockType[] = ['divider', 'table', 'lineitems', 'accept', 'page', ...MEDIA_TYPES];
export const isLeafBlock = (type: BlockType): boolean => LEAF_TYPES.includes(type);
/**
 * Carries editable body text — the set "Turn into" is allowed to move between,
 * and the set the slash menu offers as a conversion. A database is excluded for
 * a different reason than the leaves (it has text, but it is a view onto rows),
 * which is why this is stated once rather than re-derived at each menu.
 */
export const isTextBlock = (type: BlockType): boolean => !isLeafBlock(type) && type !== 'collection';

/**
 * A fresh leaf, seeded so it is usable the instant it appears — a table with
 * cells, a price list with a row to type into. Lives beside LEAF_TYPES because
 * the two answers must agree: a type in that list with no seed here inserts an
 * empty shell, which is how "Table" once arrived with nothing to click.
 */
export function newLeaf(type: BlockType): Block {
  switch (type) {
    case 'table': return { id: genId(), type, text: '', rows: emptyTableRows() };
    case 'lineitems': return { id: genId(), type, text: '', items: [emptyLineItem(genId())] };
    // No seed: the default statement is supplied at render time, so an untouched
    // accept block and one the owner deliberately cleared stay distinguishable.
    case 'accept': return { id: genId(), type, text: '', accept: {} };
    default: return { id: genId(), type, text: '' };
  }
}

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
  /**
   * An uploaded attachment (0033), for pdf/file blocks. Stores the ROW ID, never
   * a URL: the bucket is private, so a URL is a short-lived signature that would
   * be expired by the time the document was reopened. The block resolves one on
   * render (`useAttachmentUrl`). `src` stays for externally linked files.
   */
  fileId?: string;
  fileName?: string;   // shown while the signature is being minted
  fileSize?: number;
  width?: number;      // image — width as a percent of the column (default 100)
  align?: 'left' | 'center' | 'right'; // image — horizontal placement (default left)
  color?: string;      // Notion-style block color: '<palette>' (text) or '<palette>-bg'
  colId?: string;      // collection — the inline database's collection id
  /**
   * page — the page this block opens: a child of the page it sits in, minted in the
   * browser (`newPage`) so the block is final from its first frame. Absent only on a
   * block whose page was never created, which offers to make it again.
   */
  pageId?: string;
  /**
   * collection — the layout the database was made with. Only "Try again" reads
   * it, after a database failed to save: the retry must make the same layout the
   * person picked, not whatever the default is.
   */
  dbKind?: ViewKind;
  items?: LineItem[];  // lineitems — services & prices (lib/line-items.ts)
  /**
   * accept — the TERMS only (what is asked, in what words). The signature that
   * answers them is a row in `acceptances`, never a field here: this object is
   * rewritten by the document owner's autosave, and a signature the beneficiary
   * can edit is not a signature. See lib/acceptance.ts.
   */
  accept?: AcceptTerms;
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

/**
 * The collapsed toggles hiding `id`, outermost first — the inverse question to
 * `hiddenIds`, which is why it lives beside it.
 *
 * Arriving at a block by link has to be able to open the toggles it is folded
 * inside; scrolling to a row that is not rendered is the failure Notion's own
 * block links avoid by expanding on the way in. Empty when the block is
 * visible, absent, or is itself the collapsed toggle (that row is on screen —
 * only its children are not).
 */
export function togglesHiding(blocks: Block[], id: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'toggle' || !blocks[i].collapsed) continue;
    const end = sectionEnd(blocks, i);
    for (let j = i + 1; j < end; j++) {
      if (blocks[j].id === id) { out.push(blocks[i].id); break; }
    }
  }
  return out;
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
    // A stored link is UNTRUSTED: it arrives by paste, by Notion import, and by
    // `liftText` reading `[label](url)` out of stored text, and the document is
    // then shown to clients. An unsafe one loses its link and keeps its words.
    if (typeof o.link === 'string') { const href = safeHref(o.link); if (href) sp.link = href; }
    if (typeof o.color === 'string') sp.color = o.color;
    spans.push(sp);
  }
  return sparse(mergeSpans(spans));
}

/** An attachment's row id (0033: `uuid default gen_random_uuid()`). Anything else in `fileId` is not a reference. */
const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The upload a media block points at, as stored — or nothing.
 *
 * An upload is kept as its attachment's ROW ID, never a URL (the bucket is private, so a URL is a signature that has
 * expired by the time anyone reopens the page). This function did not exist: `normalize` never named `fileId`, so
 * every uploaded image, PDF and file came back empty the next time its document opened, and the next autosave wrote
 * the empty block over the stored one (user report 2026-09-21). A name and a size only describe an upload, so they
 * are kept only beside a real id; the id itself is only a reference if it is shaped like one — whether the reader
 * may SEE that attachment is still decided by the server when it signs a URL.
 */
function uploadOf(o: Record<string, unknown>): Pick<Block, 'fileId' | 'fileName' | 'fileSize'> {
  if (typeof o.fileId !== 'string' || !ATTACHMENT_ID.test(o.fileId)) return {};
  return {
    fileId: o.fileId,
    ...(typeof o.fileName === 'string' && o.fileName ? { fileName: o.fileName.slice(0, 200) } : {}),
    ...(typeof o.fileSize === 'number' && Number.isFinite(o.fileSize) && o.fileSize >= 0 ? { fileSize: o.fileSize } : {}),
  };
}

function normalize(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = asBlockType(o.type);
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
  // Every media block renders an upload the same way (`useAttachmentUrl(b.fileId)`), so every one keeps it.
  if (MEDIA_TYPES.includes(type)) Object.assign(block, uploadOf(o));
  if (type === 'collection' && typeof o.colId === 'string') block.colId = o.colId;
  if (type === 'collection' && isViewKind(o.dbKind)) block.dbKind = o.dbKind;
  if (type === 'page' && typeof o.pageId === 'string') block.pageId = o.pageId;
  if (typeof o.indent === 'number') block.indent = o.indent;
  if (typeof o.color === 'string') block.color = o.color;
  if (type === 'table') {
    const rows = Array.isArray(o.rows)
      ? (o.rows as unknown[]).map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))) : []))
      : emptyTableRows();
    block.rows = rows.length ? rows : emptyTableRows();
  }
  // §7M paperwork payloads. This function is the trust boundary for everything
  // stored in pages.content: a field it does not name is DROPPED, which is the
  // right default and is also how a line-items block silently came back empty
  // after a reload. Prices must survive the round trip, and must survive it as
  // numbers — `quantity: "2"` from hand-edited JSON would make every total NaN.
  if (type === 'lineitems') {
    block.items = (Array.isArray(o.items) ? o.items : [])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        id: typeof r.id === 'string' ? r.id : genId(),
        description: typeof r.description === 'string' ? r.description : '',
        quantity: num(r.quantity, 1),
        unitAmount: num(r.unitAmount, 0),
      }));
  }
  if (type === 'accept') {
    const a = (o.accept && typeof o.accept === 'object' ? o.accept : {}) as Record<string, unknown>;
    block.accept = {
      ...(typeof a.statement === 'string' ? { statement: a.statement.slice(0, 600) } : {}),
      ...(typeof a.label === 'string' ? { label: a.label.slice(0, 40) } : {}),
      ...(a.requireEmail ? { requireEmail: true } : {}),
    };
  }
  return block;
}

/** A finite number, or the fallback. `Number('')` is 0 and `Number(null)` is 0. */
function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
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

// Blocks whose emptiness is their text: an empty paragraph or heading is nothing,
// where an image, a divider or a database is something even with no words.
const TEXT_BLOCKS: ReadonlySet<string> = new Set(['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'toggle', 'code']);

/**
 * Does a page have anything in it? A board card shows the page glyph only then
 * (Notion), so a page someone wrote in and an untouched one differ at a glance —
 * which is what makes opening a card worth it. Deliberately cheap and untyped: it
 * runs for every card on every render of a board, on content straight from JSON.
 */
export function hasBody(content: unknown): boolean {
  const blocks = content && typeof content === 'object' ? (content as { blocks?: unknown }).blocks : undefined;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((b) => {
    if (!b || typeof b !== 'object') return false;
    const { type, text } = b as { type?: unknown; text?: unknown };
    if (typeof text === 'string' && text.trim() !== '') return true;
    return typeof type === 'string' && !TEXT_BLOCKS.has(type);
  });
}

export function serialize(blocks: Block[]): { blocks: Block[] } {
  return { blocks };
}

/**
 * A body save that keeps everything else a page's content holds — a doc's cover, a
 * collected item's remembered preview. `serialize` alone writes `{ blocks }`, and a
 * database row's page saved exactly that, so the first sentence typed under a collected
 * link would have erased what was remembered for it (COLLECTION_VIEW_PLAN C2).
 */
export function withBlocks(content: Record<string, unknown> | null | undefined, blocks: Block[]): Record<string, unknown> & { blocks: Block[] } {
  return { ...(content ?? {}), blocks };
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
      // The NOTE counts as text. A link block's `text` is the sentence someone
      // wrote about why the link matters, and returning only the URL would
      // make it unfindable in search — the same silent drop that once took a
      // proposal's prices out of copied text (see the lineitems case below).
      if (b.type === 'bookmark' || b.type === 'embed' || b.type === 'video' || b.type === 'audio' || b.type === 'pdf' || b.type === 'file') {
        return b.text?.trim() ? `${b.text.trim()} ${b.src ?? ''}`.trim() : (b.src ?? '');
      }
      if (b.type === 'collection') return '[database]';
      if (b.type === 'page') return '[page]';
      if (b.type === 'table') return (b.rows ?? []).map((r) => r.join(' | ')).join('\n');
      // Paperwork blocks hold their content in a payload, not in `text`. Without
      // these two cases they flatten to '' — which silently dropped a proposal's
      // prices out of the client portal and out of copied text.
      if (b.type === 'lineitems') {
        const items = b.items ?? [];
        if (!items.length) return '';
        return [
          ...items.map((i) => `${i.description || 'Item'} · ${i.quantity} × ${i.unitAmount.toFixed(2)} = ${lineTotal(i).toFixed(2)}`),
          `Total ${itemsTotal(items).toFixed(2)}`,
        ].join('\n');
      }
      if (b.type === 'accept') return acceptStatement(b.accept);
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
        // The note travels with the link. Exporting a bare URL loses the one
        // line that says what it is for.
        case 'bookmark': case 'embed': case 'video': case 'audio': case 'pdf': case 'file':
          return b.text?.trim() ? `[${b.text.trim()}](${b.src ?? ''})` : (b.src ?? '');
        case 'collection': return '[database]';
        case 'page': return '[page]';
        // A proposal's prices must survive being copied into an email or
        // exported — a placeholder like '[line items]' would silently drop the
        // one part of the document the client cares about.
        case 'lineitems': {
          const items = b.items ?? [];
          if (!items.length) return '';
          return [
            '| Description | Qty | Rate | Amount |',
            '| --- | --- | --- | --- |',
            ...items.map((i) => `| ${i.description} | ${i.quantity} | ${i.unitAmount.toFixed(2)} | ${lineTotal(i).toFixed(2)} |`),
            `| **Total** |  |  | **${itemsTotal(items).toFixed(2)}** |`,
          ].join('\n');
        }
        // An exported proposal keeps the words someone agreed to, and a ruled
        // line for the name — the paper equivalent of the block.
        case 'accept':
          return `${acceptStatement(b.accept)}\n\n${acceptLabel(b.accept)}: ______________________  Date: ____________`;
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

export type BlockMenuGroup = 'Basic blocks' | 'Media' | 'Database' | 'Advanced blocks';
// `db` marks database entries: an inline database in that layout ('inline' is a
// table, offered under its own name), 'fullpage' → a new database page (the host
// must support it), 'linked' → a view of a database that already exists.
export type BlockMenuItem = {
  type: BlockType;
  label: string;
  /** The caption under the entry's preview card — what it makes, in a few words. */
  hint: string;
  keywords: string;
  group: BlockMenuGroup;
  /** The markdown that makes this block as you type, shown at the row's end. */
  shortcut?: string;
  db?: 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline' | 'inline' | 'fullpage' | 'linked';
  /** A Page entry that makes a page of another kind — 'collection': a new Collection, on a page of its own. */
  page?: 'collection';
};

// The slash menu's entries, in the order the menu draws them (Notion's sections).
export const BLOCK_MENU: BlockMenuItem[] = [
  { type: 'text', label: 'Text', hint: 'Just start writing with plain text', keywords: 'text paragraph plain body', group: 'Basic blocks' },
  { type: 'page', label: 'Page', hint: 'A page inside this page', keywords: 'page subpage sub-page child nested document doc new', group: 'Basic blocks' },
  { type: 'page', label: 'Collection', hint: 'A visual collection, on a page of its own', keywords: 'collection references inspiration moodboard images links bookmarks videos screenshots saved gather canvas', group: 'Basic blocks', page: 'collection' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section heading', keywords: 'h1 heading title big', group: 'Basic blocks', shortcut: '#' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section heading', keywords: 'h2 heading subtitle', group: 'Basic blocks', shortcut: '##' },
  { type: 'h3', label: 'Heading 3', hint: 'Small section heading', keywords: 'h3 heading', group: 'Basic blocks', shortcut: '###' },
  { type: 'bullet', label: 'Bulleted list', hint: 'A simple list of points', keywords: 'bullet list unordered ul', group: 'Basic blocks', shortcut: '-' },
  { type: 'numbered', label: 'Numbered list', hint: 'A list in order, numbered', keywords: 'numbered ordered list ol', group: 'Basic blocks', shortcut: '1.' },
  { type: 'todo', label: 'To-do list', hint: 'Things to check off', keywords: 'todo checkbox task check', group: 'Basic blocks', shortcut: '[]' },
  { type: 'toggle', label: 'Toggle list', hint: 'Hide and show what is inside', keywords: 'toggle collapse expand fold accordion', group: 'Basic blocks', shortcut: '>' },
  { type: 'callout', label: 'Callout', hint: 'Make a note stand out', keywords: 'callout note info tip', group: 'Basic blocks' },
  { type: 'quote', label: 'Quote', hint: 'Set a quote apart', keywords: 'quote blockquote', group: 'Basic blocks', shortcut: '"' },
  { type: 'table', label: 'Table', hint: 'Simple rows and columns', keywords: 'table grid rows columns spreadsheet', group: 'Basic blocks' },
  { type: 'divider', label: 'Divider', hint: 'Separate one part from the next', keywords: 'divider hr line separator', group: 'Basic blocks', shortcut: '---' },
  { type: 'image', label: 'Image', hint: 'Upload an image, or embed one from a link', keywords: 'image picture photo media upload img figure', group: 'Media' },
  { type: 'video', label: 'Video', hint: 'Play a YouTube, Vimeo or video link', keywords: 'video movie youtube vimeo mp4 player', group: 'Media' },
  { type: 'audio', label: 'Audio', hint: 'Play a sound file from a link', keywords: 'audio sound music mp3 podcast player', group: 'Media' },
  { type: 'code', label: 'Code', hint: 'Show code in a monospace block', keywords: 'code snippet monospace', group: 'Media', shortcut: '```' },
  { type: 'file', label: 'File', hint: 'Attach a file, or link to one', keywords: 'file attachment download document upload', group: 'Media' },
  { type: 'pdf', label: 'PDF', hint: 'Read a PDF right in the page', keywords: 'pdf document viewer paper', group: 'Media' },
  { type: 'bookmark', label: 'Web bookmark', hint: 'Save a link as a visual card', keywords: 'bookmark link url web preview card', group: 'Media' },
  { type: 'embed', label: 'Embed', hint: 'Show Figma, Maps and more in the page', keywords: 'embed iframe youtube figma map', group: 'Media' },
  // Each database entry says what you GET, in words the others don't use — seven
  // of these once read "Inline database, … view" under one identical glyph.
  { type: 'collection', label: 'Table view', hint: 'A database seen as rows and columns', keywords: 'database table view grid rows columns spreadsheet', group: 'Database', db: 'table' },
  { type: 'collection', label: 'Board view', hint: 'A database seen as cards in columns', keywords: 'database board view kanban cards columns status', group: 'Database', db: 'board' },
  { type: 'collection', label: 'Gallery view', hint: 'A database seen as a grid of cards', keywords: 'database gallery view cards grid images covers', group: 'Database', db: 'gallery' },
  { type: 'collection', label: 'List view', hint: 'A database seen as a quiet list', keywords: 'database list view rows simple minimal', group: 'Database', db: 'list' },
  { type: 'collection', label: 'Calendar view', hint: 'A database seen on a calendar by date', keywords: 'database calendar view dates month schedule', group: 'Database', db: 'calendar' },
  { type: 'collection', label: 'Timeline view', hint: 'A database seen as bars across time', keywords: 'database timeline view gantt roadmap schedule dates bars plan', group: 'Database', db: 'timeline' },
  { type: 'collection', label: 'Inline database', hint: 'A new database inside this page', keywords: 'database inline collection table rows data new', group: 'Database', db: 'inline' },
  { type: 'collection', label: 'Full-page database', hint: 'A new database on a page of its own', keywords: 'database full page collection new subpage', group: 'Database', db: 'fullpage' },
  { type: 'collection', label: 'Linked view of database', hint: 'A view of a database that already exists', keywords: 'linked view database source sync existing reference', group: 'Database', db: 'linked' },
  { type: 'lineitems', label: 'Line items', hint: 'Services and prices, with a total', keywords: 'line items price quote proposal estimate services money invoice cost', group: 'Advanced blocks' },
  { type: 'accept', label: 'Accept', hint: 'A client agrees by typing their name', keywords: 'accept sign signature agree approve proposal contract esign terms', group: 'Advanced blocks' },
];

// ── The slash menu's list ──────────────────────────────────────────────────
// ONE ordered list, drawn in exactly this order and picked from by index. The
// menu used to regroup its rows for display while Enter picked from the data
// order — Line items and Accept came before the database entries in the data and
// after them on screen, so Enter on "Table view" inserted Line items.

/** A row, with the heading it is drawn under. */
export type SlashEntry = BlockMenuItem & { section: string };

/** The order the menu's sections are drawn in. */
export const SLASH_GROUPS: BlockMenuGroup[] = ['Basic blocks', 'Media', 'Database', 'Advanced blocks'];
/** The heading over typed results, where the ranking — not the group — is the order. */
export const FILTERED_SECTION = 'Filtered results';

/** How an entry is remembered: its type, and for a database, its layout too —
 *  stored as the type alone, every database came back as "Table view". */
export const menuKey = (m: Pick<BlockMenuItem, 'type' | 'db' | 'page'>): string => (m.db ? `${m.type}:${m.db}` : m.page ? `${m.type}:${m.page}` : m.type);

/**
 * The rows for `query`. Empty: recent picks, then every section in order. Typed:
 * ranked — the exact name, a name starting with it, a word in the name starting
 * with it, a name containing it, then keywords — ties in menu order.
 */
export function slashMenu(query: string, recentKeys: string[]): SlashEntry[] {
  const q = query.trim().toLowerCase();
  if (q) {
    return BLOCK_MENU
      .map((m, i) => ({ m, i, r: slashRank(m, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map(({ m }) => ({ ...m, section: FILTERED_SECTION }));
  }
  const recent = recentKeys
    .map((k) => BLOCK_MENU.filter((m) => menuKey(m) === k))
    .filter((hits) => hits.length === 1)
    .map(([m]) => ({ ...m, section: 'Recent' }));
  return [...recent, ...SLASH_GROUPS.flatMap((g) => BLOCK_MENU.filter((m) => m.group === g).map((m) => ({ ...m, section: g })))];
}

function slashRank(m: BlockMenuItem, q: string): number {
  const label = m.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.split(/[\s\u00B7\u2014-]+/).some((w) => w.startsWith(q))) return 2;
  if (label.includes(q)) return 3;
  const keywords = m.keywords.toLowerCase();
  if (keywords.split(/\s+/).some((w) => w.startsWith(q))) return 4;
  return keywords.includes(q) ? 5 : -1;
}
