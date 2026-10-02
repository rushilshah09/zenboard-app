'use client';
// The Zenboard Block Engine — one editor used by Library, Project Docs, and
// Client notes. Controlled: the parent owns `blocks` + autosave; this renders
// and edits them. Per-block <textarea>s (reliable over contenteditable) with:
//   · slash menu (search · groups · recently-used · keyboard)
//   · markdown shortcuts, Enter/Backspace merge, Tab nest / Shift-Tab unnest
//   · block drag with live ghost — headings/toggles carry their whole section,
//     and a multi-selection drags as a group
//   · multi-select (Esc · ⌘-click · Shift-click · Shift-↑/↓) with bulk
//     copy / duplicate / delete / move
//   · per-block context menu (convert · duplicate · move · delete)
//   · toggle blocks that collapse their children
//   · document-level undo/redo (⌘Z / ⌘⇧Z) across structural edits
import { Fragment, memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NO_SETTLE } from '@/lib/drop-settle';
import { createPortal } from 'react-dom';
import {
  Check, Plus, GripVertical, X, ArrowDownUp, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Table, Quote, Lightbulb, Code, Minus, ChevronRight, ChevronLeft, Copy as CopyIcon, Trash2, ArrowUp, ArrowDown, ArrowLeftRight, Image, UnfoldHorizontal, Download, Bookmark, Globe, CodeXml, ExternalLink, Link as LinkIcon, MessageCircle, Video, Volume2, FileText, Paperclip, Palette as PaletteIcon, AlignLeft, AlignCenter, AlignRight, Database as DatabaseIcon, Receipt, PenTool, Images, type IconType } from "@/components/ds/icons";
import { Icon, IconSwap, Checkbox, Button, ToolbarButton, MenuPanel, MenuItem, MenuLabel, MenuSeparator, MenuGlyph, MENU_PANEL_CLASS, OVERLAY_CLASS, FullScreenLayer, Popover, PopoverAnchor, PopoverContent, LinkCard, Tooltip, toast, DropLine, DragGhost } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { useLinkMeta, fetchLinkMeta } from '@/lib/use-link-meta';
import { isBareUrl, pasteOptions, mentionLabel, type PasteAs } from '@/lib/unfurl';
import {
  type Block, type BlockType, type BlockMenuItem, LIST_TYPES, NESTABLE_TYPES, MEDIA_TYPES, genId, emptyBlock,
  markdownPrefix, BLOCK_MENU, slashMenu, menuKey, FILTERED_SECTION, type SlashEntry, emptyTableRows, sectionEnd, hiddenIds, togglesHiding, blocksToText, isLeafBlock, isTextBlock, newLeaf,
  computeDrop, type DropTargetCalc,
} from '@/lib/blocks';
import { blockHref } from '@/lib/block-link';
import { useBlockAnchor, ANCHOR_TTL } from '@/lib/use-block-anchor';
import { BlockComments, type CommentActions } from '@/components/documents/comment-thread';
import type { CommentThread } from '@/lib/comments';
import { cutAt, concatRich, removeRange, insertSpan, type RichSpan } from '@/lib/rich';
import { triggerAt } from '@/lib/editor-trigger';
import { insertMention } from '@/lib/mentions';
import { MentionMenu, useMentionSearch, MENTION_MAX_QUERY } from '@/components/documents/mention-menu';
import type { RecordHit } from '@/lib/search';
import { RichText, RichTextStyles, textareaHandle, type SurfaceHandle, type CaretRect, type KeyLike, type TurnIntoOption, type RememberHook } from '@/components/documents/rich-text';
import { newDatabase } from '@/lib/db-store';
import { COLLECTION_PAGE_TYPE, NEW_COLLECTION_NAME } from '@/lib/collection';
import { newPage } from '@/lib/page-store';
import { PageBlock } from '@/components/documents/page-block';
import { DB_MENU_ICON } from '@/components/documents/view-icons';
import { SlashPreview } from '@/components/documents/slash-previews';
import { InlineCollection } from '@/components/documents/database-view';
import { LineItemsBlock } from '@/components/documents/line-items-block';
import { AcceptBlock } from '@/components/documents/accept-block';
import { acceptanceFor, type Acceptance } from '@/lib/acceptance';
import { htmlToBlocks, textToBlocks, copyBlocks, blocksFromHtml } from '@/lib/clipboard';
import { fileToDataUrl, downscaleImage, reencodedName } from '@/lib/image';
import { useAttachmentUrl, useAttachmentUpload } from '@/lib/use-attachment';
import { attachmentKind, unplacedUploads, type Attachment, type AttachmentOwner } from '@/lib/attachments';
import { unplacedPageUploads } from '@/lib/actions/attachments';
import { PALETTE_NAMES } from '@/lib/palette';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  DragOverlay, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, type SortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// An <a> with no href is not a link: no navigation, not focusable. That is the
// right shape for a URL we will not vouch for — the card still renders, it just
// does not take anyone anywhere. (The image DOWNLOAD link is deliberately not
// guarded: an uploaded image is a legitimate `data:` URL and `download` never
// navigates.)
import { safeHref, safeEmbedSrc, EMBED_SANDBOX } from '@/lib/safe-url';

const BLOCK_ICON: Record<BlockType, IconType> = {
  text: Type, h1: Heading1, h2: Heading2, h3: Heading3, bullet: List, numbered: ListOrdered,
  todo: ListChecks, table: Table, quote: Quote, callout: Lightbulb, code: Code, divider: Minus,
  toggle: ChevronRight, image: Image, bookmark: Bookmark, embed: CodeXml, collection: DatabaseIcon, page: FileText,
  video: Video, audio: Volume2, pdf: FileText, file: Paperclip,
  // A proposal's line items become the invoice on accept (§7M) — same glyph.
  lineitems: Receipt, accept: PenTool,
};
const CODE_LANGS = ['text', 'ts', 'js', 'tsx', 'json', 'html', 'css', 'sql', 'bash', 'python', 'go', 'rust'];
// "You arrived here" — one pulse of the same wash a selected block wears, so
// arriving reads as the block being pointed at rather than as a new colour
// nobody has seen before. 1200ms is the DS's own --animate-flash-highlight.
const FLASH_CLASS = 'block-anchor-flash';
const FLASH_MS = 1200;

/**
 * What a host must provide for block comments to appear (§7H, 0037).
 *
 * The editor is handed the grouped threads rather than the raw list, because
 * grouping is `lib/comments.ts`'s job and the host is already doing it for the
 * page-level panel — asking the editor to group again would be the same answer
 * computed twice.
 */
export type CommentsHook = {
  /** Open threads by anchor; `openThreadsByAnchor` in lib/comments.ts. */
  byBlock: Map<string | null, CommentThread[]>;
  /** The block whose composer is open, if any. */
  composingFor: string | null;
  open: (blockId: string) => void;
  close: () => void;
  actions: CommentActions;
};

/** Stable empty array — a fresh `[]` per row would defeat the row memo. */
const NO_THREADS: CommentThread[] = [];
// §7.3 toolbar turn-into — the same convertible set as the block menu's
// "Convert into" (text-carrying types only), hoisted so rows stay memoizable.
const TURN_INTO: TurnIntoOption[] = BLOCK_MENU
  .filter((m) => !m.db && isTextBlock(m.type))
  .map((m) => ({ type: m.type, label: m.label, icon: BLOCK_ICON[m.type] }));
const RECENT_KEY = 'zb_slash_recent';
// Hoisted so DndContext props keep referential identity across renders —
// inline literals here defeat useSensor/useSensors memoization, which churns
// dnd-kit's InternalContext and re-renders EVERY useSortable row per keystroke.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 3 } }; // §6.5: drag after 3px
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };
// Rows stay put during a drag (§6.5 Notion model): we render our own indicator
// line instead of shifting rows, so the measured geometry never moves under us.
const NO_SHIFT_STRATEGY: SortingStrategy = () => null;
const INDENT_STEP = 24; // px of rightward drag per nest level (~PRD 28)

// Block types whose text edits through the rich surface (static spans + the
// page's single ProseMirror instance). Code keeps a plain <textarea> — its
// content is literal; media/table/divider/collection carry no body text.
const RICH_TYPES = new Set<BlockType>(['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'toggle', 'image']);

// §12 turn-into shortcuts: ⌘⌥1–9 keyed on physical digit (e.code) — Alt+digit
// yields punctuation in e.key on Mac. ⌘⇧0 → text is handled separately (no Alt).
const TURN_KEY: Record<string, BlockType> = {
  Digit1: 'h1', Digit2: 'h2', Digit3: 'h3',
  Digit4: 'todo', Digit5: 'bullet', Digit6: 'numbered',
  Digit7: 'toggle', Digit8: 'code', Digit9: 'quote',
};

// Plain-text/markdown line parsing lives in lib/clipboard.ts (textToBlocks).

// Slash picks carry the menu item (not just the type) so database entries can
// distinguish inline view kinds from "Database — Full page".
type SlashItem = { type: BlockType; db?: BlockMenuItem['db']; page?: BlockMenuItem['page'] };

export function BlockEditor({ blocks, onChange, onCreateDatabasePage, onExpandCollection, onOpenPage, attachTo, remember, acceptances, docHashes, onWithdrawAccept, acceptInvoices, onCreateAcceptInvoice, pageId, comments }: {
  blocks: Block[]; onChange: (b: Block[]) => void;
  /**
   * Block comments (§7H, 0037). Absent ⇒ no comment affordance anywhere, which
   * is the correct reading both for a host with no page of its own and for a
   * workspace where the migration has not been applied — the host decides, the
   * editor never probes.
   */
  comments?: CommentsHook;
  /**
   * The page these blocks belong to — what makes a block ADDRESSABLE (v2.3 §2).
   * With it, every block offers "Copy link to block" and the editor answers a
   * `#block-…` fragment by opening, scrolling to and flashing that row.
   *
   * Hosts editing blocks that are not a page of their own — a task drawer, the
   * form builder, project docs — omit it, and neither half appears. Same rule
   * as `attachTo` and `remember`: a capability the host either has or does not.
   */
  pageId?: string;
  /**
   * "Remember this" on a selection (§7X §4.2). Forwarded to every rich block and
   * otherwise untouched: the editor deliberately does not know what a memory is,
   * which record a fact would be about, or how one is written. Hosts with no
   * record context (a drawer) omit it and the toolbar action does not appear.
   */
  remember?: RememberHook;
  /**
   * Signatures on this page (§7M) and the fingerprint of the page AS SAVED.
   * Both come from the server in one call (`loadAcceptanceState`); the editor
   * never computes either, because a signature the editor could produce would
   * not be worth anything. Absent ⇒ accept blocks render unsigned, which is the
   * correct reading for a host with no page context, such as a drawer.
   */
  acceptances?: Acceptance[];
  docHashes?: readonly string[];
  onWithdrawAccept?: (id: string) => void;
  /** Invoices §7M's crossing drafted, by id. Empty until 0035 is applied. */
  acceptInvoices?: Record<string, { number: string; status: string }>;
  onCreateAcceptInvoice?: (acceptanceId: string) => void;
  /**
   * What a file uploaded from this editor hangs off — normally the page being
   * edited (§7H, 0033). Hosts with no record context (a drawer) omit it, and
   * file blocks fall back to accepting a pasted link, exactly as before.
   */
  attachTo?: AttachmentOwner;
  // Host hook for "Database — Full page" — creates + opens a database page.
  // Hosts without page context (drawers) omit it; the entry falls back inline.
  onCreateDatabasePage?: () => void;
  // Host hook for "Turn into page" on an inline database: attach the
  // collection to a new database page and open it. The inline block stays as
  // a linked view of the now-page-owned database (Notion's replacement).
  onExpandCollection?: (colId: string) => void;
  /**
   * Open a page — one a Page block links to, or one `/page` has just made. The
   * host decides what opening means: Documents selects the page, a peek steps
   * into it. The page itself is made HERE (`newPage`, a child of `pageId`), on
   * screen at once, like an inline database.
   */
  onOpenPage?: (pageId: string) => void;
}) {
  // Caret surfaces by block id — the active rich block's PM handle, or a
  // code block's wrapped <textarea>. Static (unfocused) rich blocks are null.
  // Generated, never a literal: dnd-kit derives the drag description's element
  // id from this and, given none, falls back to a MODULE-LEVEL COUNTER that
  // keeps counting on the server and restarts at 0 in the browser — which
  // hydrates `aria-describedby="DndDescribedBy-1"` against a client expecting
  // `-0` and makes React discard the subtree. A hard-coded string fixes that
  // but collides the moment two of these mount at once; `useId` does both.
  const dndId = useId();
  const refs = useRef<Record<string, SurfaceHandle | null>>({});
  // The block hosting the live PM editor + its initial selection. `epoch`
  // bumps force a re-mount (re-position) when re-focusing the same block.
  const [active, setActive] = useState<{ id: string; anchor: number; head: number; epoch: number } | null>(null);
  const activeRef = useRef(active);
  useLayoutEffect(() => { activeRef.current = active; }, [active]);
  const [focus, setFocus] = useState<{ id: string; pos: number } | null>(null);
  // Slash menu state — `at` is the index of the '/' in the block's text; the
  // query is everything between it and the caret (typing stays in the block,
  // Notion-style: the editor never loses focus).
  const [slash, setSlash] = useState<{ id: string; at: number; query: string; active: number } | null>(null);
  // @-mention picker — the same shape as `slash` on purpose: one trigger rule
  // (lib/editor-trigger.ts) drives both, so the two menus cannot drift apart in
  // when they open, what they treat as the query, or how the keyboard moves.
  const [mention, setMention] = useState<{ id: string; at: number; query: string; active: number } | null>(null);
  // Pasting an image uploads it too — the paste handler lives here rather than
  // in ImageBlock (the block does not exist yet when the paste arrives).
  const { upload: pasteUpload } = useAttachmentUpload(attachTo);
  // What this page holds and no block shows — offered by its empty image and file blocks.
  const uploads = useUnplacedUploads(attachTo, blocks);
  const mentionResults = useMentionSearch(mention?.query ?? null);
  // Both typed-trigger menus close together wherever the caret's context is
  // gone — a drag, a block menu, a block selection. One function so a new
  // dismissal site cannot remember one menu and forget the other.
  const closeTriggerMenus = () => { setSlash(null); setMention(null); };
  // "Paste as" (Notion §): a lone pasted URL goes in as a plain link IMMEDIATELY,
  // and this offers to turn it into something richer. The paste is never blocked —
  // dismissing the menu leaves you with exactly the link you pasted, which is why
  // "URL" is one of the choices rather than a cancel button.
  const [pasteAs, setPasteAs] = useState<{ id: string; url: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(1);
  // Render mirror of movingRef — which rows dim while a group drags.
  const [movingIds, setMovingIds] = useState<string[]>([]);
  // §6.5 live drop target (gap + nest indent) + container-relative pixel
  // position for the indicator; ref mirror lets onDragEnd read it synchronously.
  type DropView = DropTargetCalc & { top: number; left: number };
  const [dropTarget, setDropTargetState] = useState<DropView | null>(null);
  const dropTargetRef = useRef<DropView | null>(null);
  const setDropTarget = (v: DropView | null) => { dropTargetRef.current = v; setDropTargetState(v); };
  const dragPointer = useRef({ x: 0, y: 0 });
  const dragRaf = useRef<number | null>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const leaderNestable = useRef(false);
  const leaderIndent = useRef(0);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // The block that currently holds the caret. The single Notion-style placeholder
  // renders only on this block while it's empty, so the page never shows more than
  // one helper text at a time.
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // ── selection engine ──
  const [sel, setSel] = useState<Set<string>>(new Set());
  const selRef = useRef(sel);
  const anchorRef = useRef<string | null>(null);
  const blocksRef = useRef(blocks);
  useLayoutEffect(() => { selRef.current = sel; }, [sel]);
  useLayoutEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // ── history engine (document-level undo/redo) ──
  const undoStack = useRef<Block[][]>([]);
  const redoStack = useRef<Block[][]>([]);
  const typingSnap = useRef<{ snap: Block[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  function pushHistory(snapshot: Block[]) {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }
  // Batch keystrokes: snapshot the state at the start of a typing run.
  function pushTypingHistory() {
    if (typingSnap.current) { clearTimeout(typingSnap.current.timer); }
    else pushHistory(blocksRef.current);
    typingSnap.current = { snap: blocksRef.current, timer: setTimeout(() => { typingSnap.current = null; }, 700) };
  }
  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(blocksRef.current);
    typingSnap.current = null;
    onChange(prev);
    setSel(new Set());
  }
  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(blocksRef.current);
    typingSnap.current = null;
    onChange(next);
    setSel(new Set());
  }

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  // Caret placement. Rich blocks mount the PM editor via `active`; code
  // blocks focus their textarea through the handle after render.
  const focusBlock = (id: string, pos: number) => {
    const b = blocksRef.current.find((x) => x.id === id);
    if (!b) return;
    if (RICH_TYPES.has(b.type)) setActive((a) => ({ id, anchor: pos, head: pos, epoch: (a?.epoch ?? 0) + 1 }));
    else { setActive(null); setFocus({ id, pos }); }
  };
  useLayoutEffect(() => {
    if (!focus) return;
    refs.current[focus.id]?.focus(focus.pos);
    // Consume the one-shot focus request once applied (DOM focus is the
    // external system being synced; the reset only marks it done).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocus(null);
  }, [focus]);

  const idx = (id: string) => blocksRef.current.findIndex((b) => b.id === id);
  // Structural commit — records history, applies, optionally refocuses.
  const commit = (next: Block[], f?: { id: string; pos: number }) => {
    pushHistory(blocksRef.current);
    typingSnap.current = null;
    onChange(next);
    // Focus resolves against the NEXT block array (it may hold new blocks).
    if (f) {
      const b = next.find((x) => x.id === f.id);
      if (b && RICH_TYPES.has(b.type)) setActive((a) => ({ id: f.id, anchor: f.pos, head: f.pos, epoch: (a?.epoch ?? 0) + 1 }));
      else { setActive(null); setFocus(f); }
    }
  };

  // The ids a block carries when it moves: its whole section (heading/toggle).
  function spanIds(id: string): string[] {
    const bs = blocksRef.current;
    const i = idx(id); if (i < 0) return [id];
    return bs.slice(i, sectionEnd(bs, i)).map((b) => b.id);
  }
  // Ordered ids for a group move: the selection if the block is part of it.
  function movingIdsFor(id: string): string[] {
    const bs = blocksRef.current;
    if (selRef.current.has(id) && selRef.current.size > 1) {
      const set = new Set<string>();
      for (const b of bs) if (selRef.current.has(b.id)) for (const s of spanIds(b.id)) set.add(s);
      return bs.filter((b) => set.has(b.id)).map((b) => b.id);
    }
    return spanIds(id);
  }

  // Rich-surface edits (every text-carrying block except code). `caret` is the
  // plain-text offset after the edit, straight from the PM selection.
  // Event handlers read blocksRef (shadowing the prop) so their identity can
  // be safely ignored by the memoized rows — a row holding an older closure
  // still reads fresh state.
  function setRich(id: string, value: string, spans: RichSpan[] | undefined, caret: number) {
    const blocks = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const b = blocks[i];
    // Typed-trigger menus (Notion behaviour): '/' at the start of the block or
    // right after whitespace opens the block menu; '@' opens the mention
    // picker. Both work anywhere in the line ("Hello /img", "ship @Acme"), and
    // both close the instant the trigger stops being one — see
    // `triggerAt` for the exact rules, which they now share.
    //
    // WHICHEVER IS NEARER THE CARET WINS, so typing '@' inside an open slash
    // query hands over rather than leaving two menus fighting for the arrows.
    // An image block takes neither: its text is a caption.
    const slashT = b.type === 'image' ? null : triggerAt(value, caret, '/');
    const mentionT = b.type === 'image' ? null : triggerAt(value, caret, '@', { maxQuery: MENTION_MAX_QUERY });
    const winner = (slashT?.at ?? -1) > (mentionT?.at ?? -1) ? 'slash' : 'mention';
    if (slashT && winner === 'slash') setSlash({ id, at: slashT.at, query: slashT.query, active: 0 });
    else if (slash?.id === id) setSlash(null);
    // Every keystroke re-ranks the list, so the highlight returns to the best
    // match (Notion does the same) — and can never point past the new results.
    if (mentionT && winner === 'mention') setMention({ id, at: mentionT.at, query: mentionT.query, active: 0 });
    else if (mention?.id === id) setMention(null);
    if (b.type === 'text' && !value.startsWith('/')) {
      const t = markdownPrefix(value);
      if (t) {
        // Commit the literal characters first, so the conversion is its own
        // undo step and one ⌘Z restores exactly what was typed (PRD §7.2).
        const withLiteral = blocks.map((x) => (x.id === id ? { ...x, text: value, spans } : x));
        onChange(withLiteral);
        blocksRef.current = withLiteral; // applyType's commit snapshots this
        applyType(id, t, '');
        return;
      }
    }
    pushTypingHistory();
    onChange(blocks.map((x) => (x.id === id ? { ...x, text: value, spans } : x)));
  }

  // Code blocks keep a plain textarea: literal content, no slash, no marks.
  function setCodeText(id: string, value: string) {
    pushTypingHistory();
    onChange(blocksRef.current.map((x) => (x.id === id ? { ...x, text: value } : x)));
  }

  // Inline markdown auto-convert (**bold** etc). The literal typed state
  // becomes its own history step, so one ⌘Z restores the exact characters;
  // the epoch bump remounts the PM view at the converted caret.
  function convertInline(id: string, literal: { text: string; spans?: RichSpan[] }, converted: { text: string; spans?: RichSpan[] }, caret: number) {
    const withLiteral = blocksRef.current.map((x) => (x.id === id ? { ...x, ...literal } : x));
    blocksRef.current = withLiteral;
    pushHistory(withLiteral);
    typingSnap.current = null;
    onChange(withLiteral.map((x) => (x.id === id ? { ...x, ...converted } : x)));
    setActive((a) => ({ id, anchor: caret, head: caret, epoch: (a?.epoch ?? 0) + 1 }));
  }

  function applyType(id: string, type: BlockType, text?: string, caret?: number) {
    const blocks = blocksRef.current;
    closeTriggerMenus();
    rememberRecent({ type });
    const i = idx(id); if (i < 0) return;
    if (isLeafBlock(type)) {
      const block: Block = { ...newLeaf(type), id: blocks[i].id };
      const after = emptyBlock();
      commit([...blocks.slice(0, i), block, after, ...blocks.slice(i + 1)], { id: after.id, pos: 0 });
      return;
    }
    const patch: Block = { ...blocks[i], type, text: text ?? blocks[i].text };
    if (text !== undefined) patch.spans = undefined;       // explicit text replaces rich content
    if (type === 'code') patch.spans = undefined;          // code re-enters as plain text (PRD 6.7)
    if (type === 'todo' && patch.checked === undefined) patch.checked = false;
    if (type === 'code' && !patch.lang) patch.lang = 'text';
    if (type === 'toggle' && patch.collapsed === undefined) patch.collapsed = false;
    const end = (text ?? blocks[i].text).length;
    commit(blocks.map((x) => (x.id === id ? patch : x)), { id, pos: caret !== undefined ? Math.min(caret, end) : end });
  }

  // Database from the slash menu (Notion): 'fullpage' delegates to the host to
  // create + open a database page; view kinds make the database HERE, at once —
  // `newDatabase` mints its final id and seeds its store, so the table is on
  // screen before the server has heard of it — and save it behind. A failed save
  // turns the block into 'error:<msg>'; 'linked' mounts the source picker.
  function insertCollection(id: string, stripped: { text: string; spans?: RichSpan[] } | undefined, db?: BlockMenuItem['db']) {
    const bs = blocksRef.current;
    const i = bs.findIndex((x) => x.id === id); if (i < 0) return;
    const b = bs[i];
    const rest = stripped ?? { text: b.text, spans: b.spans };
    if (db === 'fullpage' && onCreateDatabasePage) {
      // Clean the "/query" out of the block, then let the host take over.
      onChange(bs.map((x) => (x.id === id ? { ...x, ...rest } : x)));
      onCreateDatabasePage();
      return;
    }
    const targetId = rest.text.trim() === '' ? b.id : genId();
    // 'linked' mounts the source picker instead of creating a collection.
    const kind = db === 'board' || db === 'gallery' || db === 'list' || db === 'calendar' || db === 'timeline' ? db : 'table';
    const made = db === 'linked' ? null : newDatabase({ kind });
    const nb: Block = made
      ? { id: targetId, type: 'collection', text: '', colId: made.store.getState().col.id, dbKind: kind }
      : { id: targetId, type: 'collection', text: '', colId: 'picker' };
    if (rest.text.trim() === '') {
      const after = emptyBlock();
      commit([...bs.slice(0, i), nb, after, ...bs.slice(i + 1)], { id: after.id, pos: 0 });
    } else {
      commit([...bs.slice(0, i), { ...b, ...rest }, nb, ...bs.slice(i + 1)]);
    }
    if (made) saveCollection(targetId, made);
  }

  // Page from the slash menu (Notion's): a page INSIDE this one, made at once under
  // an id minted here, saved behind (lib/page-store.ts). Like Notion, making a page
  // takes you into it — the block stays behind as the way back in.
  function insertPage(id: string, stripped: { text: string; spans?: RichSpan[] } | undefined, kind?: 'collection') {
    const bs = blocksRef.current;
    const i = bs.findIndex((x) => x.id === id); if (i < 0) return;
    const b = bs[i];
    const rest = stripped ?? { text: b.text, spans: b.spans };
    // "/collection" makes a Collection: a page of its own kind, named (COLLECTION_ITEM_BRIEF §12).
    const made = newPage({ parentId: pageId ?? null, ...(kind === 'collection' ? { type: COLLECTION_PAGE_TYPE, title: NEW_COLLECTION_NAME } : {}) });
    const targetId = rest.text.trim() === '' ? b.id : genId();
    const nb: Block = { id: targetId, type: 'page', text: '', pageId: made.id };
    if (rest.text.trim() === '') {
      const after = emptyBlock();
      commit([...bs.slice(0, i), nb, after, ...bs.slice(i + 1)], { id: after.id, pos: 0 });
    } else {
      commit([...bs.slice(0, i), { ...b, ...rest }, nb, ...bs.slice(i + 1)]);
    }
    // A frame later, not in this handler: opening the page replaces the page this
    // editor is on, and in the same render its host would never commit the block
    // just added — let alone schedule its save. Measured: the Page block vanished
    // from its parent every time, in Documents and in a peek alike.
    if (onOpenPage) requestAnimationFrame(() => onOpenPage(made.id));
  }

  // A Page block whose page was never made (a block from before its page existed,
  // or one pasted without it) gets a new page, in place.
  function recreatePage(blockId: string) {
    const made = newPage({ parentId: pageId ?? null });
    onChange(blocksRef.current.map((x) => (x.id === blockId ? { ...x, pageId: made.id } : x)));
  }

  // Save a database this block is already showing. A failure turns the block into
  // its failure line; neither outcome is an edit of the person's, so neither goes
  // through `commit` onto the undo stack.
  function saveCollection(blockId: string, made: ReturnType<typeof newDatabase>) {
    // Shown where it happened: an 'error:' block renders its failure line.
    const fail = (message: string) => onChange(blocksRef.current.map((x) => (x.id === blockId ? { ...x, colId: 'error:' + message } : x)));
    void made.persist().then((res) => {
      if ('error' in res) fail(res.error);
    });
  }

  // "Try again" on a database that failed to save: a NEW database, in the layout
  // the person picked, on screen at once — the failed one never reached the server.
  function retryCollection(blockId: string) {
    const b = blocksRef.current.find((x) => x.id === blockId);
    if (!b || b.type !== 'collection') return;
    const made = newDatabase({ kind: b.dbKind ?? 'table' });
    onChange(blocksRef.current.map((x) => (x.id === blockId ? { ...x, colId: made.store.getState().col.id } : x)));
    saveCollection(blockId, made);
  }

  // Slash pick (Notion): strip "/query" from the text and keep the rest.
  // Empty remainder → convert/replace in place (same as applyType). Otherwise:
  // turn-into types convert this block; leaf/media types insert right below.
  function pickSlash(id: string, item: SlashItem) {
    const { type } = item;
    const s = slash;
    if (!s || s.id !== id) {
      if (type === 'collection') { rememberRecent(item); insertCollection(id, undefined, item.db); return; }
      if (type === 'page') { rememberRecent(item); insertPage(id, undefined, item.page); return; }
      applyType(id, type, '');
      return;
    }
    closeTriggerMenus();
    rememberRecent(item);
    const blocks = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const b = blocks[i];
    const stripped = removeRange(b, s.at, s.at + 1 + s.query.length);
    if (type === 'collection') { insertCollection(id, stripped, item.db); return; }
    if (type === 'page') { insertPage(id, stripped, item.page); return; }
    if (isLeafBlock(type)) {
      const nb: Block = newLeaf(type);
      if (stripped.text.trim() === '') {
        const after = emptyBlock();
        commit([...blocks.slice(0, i), { ...nb, id: b.id }, after, ...blocks.slice(i + 1)], { id: after.id, pos: 0 });
      } else {
        commit([...blocks.slice(0, i), { ...b, ...stripped }, nb, ...blocks.slice(i + 1)]);
      }
      return;
    }
    const patch: Block = { ...b, type, ...stripped };
    if (type === 'code') patch.spans = undefined;
    if (type === 'todo' && patch.checked === undefined) patch.checked = false;
    if (type === 'code' && !patch.lang) patch.lang = 'text';
    if (type === 'toggle' && patch.collapsed === undefined) patch.collapsed = false;
    commit(blocks.map((x) => (x.id === id ? patch : x)), { id, pos: Math.min(s.at, stripped.text.length) });
  }

  function convertTo(id: string, type: BlockType) { setMenuFor(null); applyType(id, type); }

  // §7.3 toolbar turn-into: convert in place, then restore the text selection
  // (conversion never changes the plain text, so the offsets stay valid). The
  // toolbar recomputes from the remounted view and shows the new type.
  function turnIntoFromToolbar(id: string, type: BlockType, anchor: number, head: number) {
    applyType(id, type);
    if (RICH_TYPES.has(type)) setActive((a) => ({ id, anchor, head, epoch: (a?.epoch ?? 0) + 1 }));
  }

  function enter(id: string, caret: number) {
    const blocks = blocksRef.current;
    const i = idx(id); const b = blocks[i];
    const [head, tail] = cutAt(b, caret); // rich split: formatting rides with each side
    if (LIST_TYPES.includes(b.type) && b.text === '') {
      // empty list item → unnest first, then exit to text
      if ((b.indent ?? 0) > 0) { commit(blocks.map((x) => (x.id === id ? { ...x, indent: (x.indent ?? 0) - 1 } : x)), { id, pos: 0 }); return; }
      commit(blocks.map((x) => (x.id === id ? { ...x, type: 'text', checked: undefined, indent: undefined } : x)), { id, pos: 0 });
      return;
    }
    if (b.type === 'toggle') {
      // Enter on a toggle creates its first child (and opens it)
      const nb: Block = { id: genId(), type: 'text', ...tail, indent: (b.indent ?? 0) + 1 };
      const next = blocks.map((x) => (x.id === id ? { ...x, ...head, collapsed: false } : x));
      commit([...next.slice(0, i + 1), nb, ...next.slice(i + 1)], { id: nb.id, pos: 0 });
      return;
    }
    const continued = LIST_TYPES.includes(b.type);
    const nb: Block = { id: genId(), type: continued ? b.type : 'text', ...tail };
    if (b.type === 'todo') nb.checked = false;
    if (b.indent) nb.indent = b.indent;
    commit([...blocks.slice(0, i), { ...b, ...head }, nb, ...blocks.slice(i + 1)], { id: nb.id, pos: 0 });
  }

  // Exit a quote/callout (§6.3): drop the empty trailing line the caret sits on
  // (a soft break, if present) and open a fresh text block below it.
  function exitContainer(id: string, caret: number) {
    const bs = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const b = bs[i];
    const trimmed = caret > 0 && b.text[caret - 1] === '\n' ? removeRange(b, caret - 1, caret) : { text: b.text, spans: b.spans };
    const nb: Block = { id: genId(), type: 'text', text: '', ...(b.indent ? { indent: b.indent } : {}) };
    commit([...bs.slice(0, i), { ...b, ...trimmed }, nb, ...bs.slice(i + 1)], { id: nb.id, pos: 0 });
  }

  function backspaceStart(id: string) {
    const blocks = blocksRef.current;
    const i = idx(id); const b = blocks[i];
    if ((b.indent ?? 0) > 0) { // unnest before converting/merging
      commit(blocks.map((x) => (x.id === id ? { ...x, indent: (x.indent ?? 0) - 1 } : x)), { id, pos: 0 });
      return;
    }
    if (b.type !== 'text') {
      commit(blocks.map((x) => (x.id === id ? { ...x, type: 'text', checked: undefined, lang: undefined, indent: undefined, collapsed: undefined } : x)), { id, pos: 0 });
      return;
    }
    if (i === 0) return;
    const prev = blocks[i - 1];
    if (prev.type === 'divider' || prev.type === 'table') {
      commit([...blocks.slice(0, i - 1), ...blocks.slice(i)], { id, pos: 0 });
      return;
    }
    // Backspacing against a database or media block selects it (Notion) —
    // never merges into it or deletes it. An empty paragraph collapses first.
    if (prev.type === 'collection' || MEDIA_TYPES.includes(prev.type)) {
      if (b.text === '' && blocks.length > 1) commit(blocks.filter((x) => x.id !== id));
      refs.current[id]?.blur();
      selectOnly(prev.id);
      return;
    }
    const mergedPos = prev.text.length;
    commit([...blocks.slice(0, i - 1), { ...prev, ...concatRich(prev, b) }, ...blocks.slice(i + 1)], { id: prev.id, pos: mergedPos });
  }

  function indent(id: string, delta: number) {
    const blocks = blocksRef.current;
    const i = idx(id); const b = blocks[i];
    if (!NESTABLE_TYPES.includes(b.type)) return;
    const next = Math.max(0, Math.min(6, (b.indent ?? 0) + delta));
    if (next === (b.indent ?? 0)) return;
    commit(blocks.map((x) => (x.id === id ? { ...x, indent: next } : x)), { id, pos: refs.current[id]?.selStart ?? 0 });
  }

  const toggleTodo = (id: string) => commit(blocksRef.current.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)));
  const toggleCollapse = (id: string) => onChange(blocksRef.current.map((x) => (x.id === id ? { ...x, collapsed: !x.collapsed } : x)));
  // §6.9 empty-toggle affordance: seed the toggle's first child and focus it.
  const addToggleChild = (id: string) => {
    const bs = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const b = bs[i];
    const nb: Block = { id: genId(), type: 'text', text: '', indent: (b.indent ?? 0) + 1 };
    const next = bs.map((x) => (x.id === id ? { ...x, collapsed: false } : x));
    commit([...next.slice(0, i + 1), nb, ...next.slice(i + 1)], { id: nb.id, pos: 0 });
  };
  const setLang = (id: string, lang: string) => onChange(blocksRef.current.map((x) => (x.id === id ? { ...x, lang } : x)));
  const setRows = (id: string, rows: string[][]) => { pushTypingHistory(); onChange(blocksRef.current.map((x) => (x.id === id ? { ...x, rows } : x))); };
  // Image src/width (undoable). Width during a resize drag is committed once on release.
  const setImage = (id: string, patch: Partial<Block>) => commit(blocksRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  // Block color (Notion-style): '<palette>' = text tint, '<palette>-bg' = wash, null = default.
  const setColor = (id: string, color: string | null) => commit(blocksRef.current.map((x) => (x.id === id ? { ...x, color: color ?? undefined } : x)));

  // ── duplicate / delete / move (single or section or selection) ──
  function duplicateIds(ids: string[]) {
    const bs = blocksRef.current;
    const set = new Set(ids);
    const group = bs.filter((b) => set.has(b.id));
    if (!group.length) return;
    const lastIdx = idx(group[group.length - 1].id);
    const clones = group.map((b) => ({ ...b, id: genId(), rows: b.rows ? b.rows.map((r) => [...r]) : undefined }));
    commit([...bs.slice(0, lastIdx + 1), ...clones, ...bs.slice(lastIdx + 1)]);
    setSel(new Set(clones.map((c) => c.id)));
  }
  function deleteIds(ids: string[]) {
    const bs = blocksRef.current;
    const set = new Set(ids);
    let next = bs.filter((b) => !set.has(b.id));
    if (!next.length) next = [emptyBlock()];
    commit(next, { id: next[Math.max(0, Math.min(next.length - 1, idx(ids[0]) - 1))]?.id ?? next[0].id, pos: 0 });
    setSel(new Set());
  }
  function moveSpan(id: string, dir: -1 | 1) {
    const bs = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const end = sectionEnd(bs, i);
    const span = bs.slice(i, end);
    const rest = [...bs.slice(0, i), ...bs.slice(end)];
    let at = dir === -1 ? i - 1 : i + 1;
    at = Math.max(0, Math.min(rest.length, at));
    commit([...rest.slice(0, at), ...span, ...rest.slice(at)], { id, pos: refs.current[id]?.selStart ?? 0 });
  }

  // ── selection interactions ──
  function selectOnly(id: string) { anchorRef.current = id; setSel(new Set(spanIds(id))); closeTriggerMenus(); refs.current[id]?.blur(); }
  function toggleSelect(id: string) {
    const n = new Set(selRef.current);
    const span = spanIds(id);
    if (n.has(id)) span.forEach((s) => n.delete(s)); else { span.forEach((s) => n.add(s)); anchorRef.current = id; }
    setSel(n);
  }
  function rangeSelect(id: string) {
    const bs = blocksRef.current;
    const a = anchorRef.current ?? id;
    const ai = idx(a), bi = idx(id);
    if (ai < 0 || bi < 0) return selectOnly(id);
    const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai];
    const hiEnd = sectionEnd(bs, hi);
    setSel(new Set(bs.slice(lo, hiEnd).map((b) => b.id)));
  }
  function selectAllBlocks() {
    const bs = blocksRef.current;
    if (!bs.length) return;
    anchorRef.current = bs[0].id;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSel(new Set(bs.map((b) => b.id)));
  }

  // ── cross-block drag selection (Notion-style) ──
  // Native selection is trapped inside each block's <textarea>, so a drag that
  // leaves its starting block escalates to fluid whole-block selection: the
  // range from the anchor block to the block under the pointer stays selected
  // as the mouse moves (either direction), with edge auto-scroll. In-block
  // drags never escalate, so partial text selection keeps working natively.
  const rootRef = useRef<HTMLDivElement>(null);
  const dragSel = useRef<{ active: boolean } | null>(null);

  // Textarea autosize is measured at ref-mount, which can land while the
  // column is still laying out (width 0 → per-character wrap → giant heights
  // that never self-correct). Re-grow every textarea whenever the editor's
  // width actually changes — covers first paint, sidebar toggles, and resizes.
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    let lastW = -1;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastW || w === 0) return;
      lastW = w;
      el.querySelectorAll('textarea').forEach((t) => grow(t));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── arriving at a block by link (v2.3 §2) ──────────────────────────────────
  // A `#block-…` fragment, or an in-app jump announced through `zb:block-anchor`.
  // Three things have to happen in order, and the order is the whole feature:
  // open the toggles the block is folded inside, scroll it into view, then say
  // which one it was. Skipping the first scrolls to a row that is not rendered.
  const anchor = useBlockAnchor();
  const seekedRef = useRef(-1);
  useEffect(() => {
    if (!pageId || !anchor || seekedRef.current === anchor.nonce) return;
    // A request outlives one render so it can wait for a document that is still
    // loading; ANCHOR_TTL is what stops it re-scanning on every later keystroke.
    if (Date.now() - anchor.at > ANCHOR_TTL) return;
    if (!blocks.some((b) => b.id === anchor.id)) return;

    const folded = togglesHiding(blocks, anchor.id);
    if (folded.length) {
      // Expanding is an ordinary edit, but not one worth an undo step of its
      // own — arriving somewhere is not something a reader means to undo.
      const open = new Set(folded);
      onChange(blocksRef.current.map((b) => (open.has(b.id) ? { ...b, collapsed: false } : b)));
      return; // the row exists next render; the effect re-runs on `blocks`
    }

    seekedRef.current = anchor.nonce;
    // The id came out of a URL, so it is untrusted input. Building a
    // `[data-block-id="…"]` selector out of it would let a quote character
    // break the selector — scan and compare instead.
    const row = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-block-id]') ?? [])]
      .find((el) => el.getAttribute('data-block-id') === anchor.id);
    if (!row) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    row.classList.remove(FLASH_CLASS);
    // Reading offsetWidth restarts the animation when the same block is asked
    // for twice: without the reflow the class is removed and re-added inside one
    // frame and the browser never sees it change.
    void row.offsetWidth;
    row.classList.add(FLASH_CLASS);
    const t = setTimeout(() => row.classList.remove(FLASH_CLASS), FLASH_MS);
    return () => clearTimeout(t);
  }, [anchor, blocks, pageId, onChange]);

  function nearestBlockId(y: number): string | null {
    const rows = rootRef.current?.querySelectorAll<HTMLElement>('[data-block-id]');
    if (!rows?.length) return null;
    let best: string | null = null, dist = Infinity;
    rows.forEach((r) => {
      const rect = r.getBoundingClientRect();
      const d = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      if (d < dist) { dist = d; best = r.getAttribute('data-block-id'); }
    });
    return best;
  }

  function beginDragSelect(anchor: string, e: React.MouseEvent) {
    if (dragSel.current) return;
    const state = {
      active: false,
      pointer: { x: e.clientX, y: e.clientY },
      raf: 0,
      lastHover: anchor,
      scroller: (() => {
        let n = rootRef.current?.parentElement ?? null;
        while (n) {
          const o = getComputedStyle(n).overflowY;
          if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
          n = n.parentElement;
        }
        return (document.scrollingElement as HTMLElement | null);
      })(),
    };

    // Selection only re-renders when the hovered block changes — pointer moves
    // just record coordinates; a rAF loop does hover + auto-scroll at 60fps.
    const pickHover = () => {
      const root = rootRef.current; if (!root) return;
      const rr = root.getBoundingClientRect();
      const sr = state.scroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
      const y = Math.min(Math.max(state.pointer.y, Math.max(rr.top, sr.top) + 4), Math.min(rr.bottom, sr.bottom) - 4);
      const x = Math.min(Math.max(state.pointer.x, rr.left + 48), rr.right - 8);
      const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest?.('[data-block-id]');
      const id = hit?.getAttribute('data-block-id');
      if (id && id !== state.lastHover) { state.lastHover = id; rangeSelect(id); }
    };
    const autoscroll = () => {
      const sc = state.scroller; if (!sc) return;
      const r = sc === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
      const margin = 48, maxV = 22;
      const y = state.pointer.y;
      if (y < r.top + margin) sc.scrollTop -= Math.ceil(((r.top + margin - y) / margin) * maxV);
      else if (y > r.bottom - margin) sc.scrollTop += Math.ceil(((y - (r.bottom - margin)) / margin) * maxV);
    };
    const tick = () => {
      if (!dragSel.current) return;
      // keep the browser's in-progress text selection suppressed (textarea or PM)
      const ae = document.activeElement as HTMLElement | null;
      if (ae && rootRef.current?.contains(ae) && (ae.tagName === 'TEXTAREA' || ae.isContentEditable)) ae.blur();
      autoscroll();
      pickHover();
      state.raf = requestAnimationFrame(tick);
    };

    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => {
      state.pointer = { x: ev.clientX, y: ev.clientY };
      if (state.active) { ev.preventDefault(); return; } // stop native selection growth
      // Dead zone: a sloppy click (or a slow double-click) must never flash
      // into block selection — real movement is required before escalating.
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 5) return;
      // Escalate only once the pointer leaves the anchor block's row.
      const row = rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${anchor}"]`);
      const r = row?.getBoundingClientRect();
      if (!r || (ev.clientY >= r.top - 1 && ev.clientY <= r.bottom + 1)) return;
      state.active = true;
      if (dragSel.current) dragSel.current.active = true;
      anchorRef.current = anchor;
      document.body.style.userSelect = 'none';
      closeTriggerMenus(); setMenuFor(null);
      setSel(new Set(spanIds(anchor)));
      state.raf = requestAnimationFrame(tick);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (state.raf) cancelAnimationFrame(state.raf);
      document.body.style.userSelect = '';
      dragSel.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    dragSel.current = { active: false };
  }

  // Container-level mousedown: clears stale selections and arms drag-select.
  // Gutter buttons (add/drag), menus, checkboxes and table inputs are excluded;
  // textareas are allowed so an in-block selection can grow into a block sweep.
  function onSurfaceMouseDown(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    // The drag handle is the intentional block-mode entry — never clear there.
    if (t.closest('.block-gutter')) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    // A plain click anywhere dissolves block selection back to the caret
    // (Notion: text editing is the primary mode, block mode is transient).
    if (selRef.current.size) setSel(new Set());
    if (t.closest('button, select, input')) return;
    const row = t.closest('[data-block-id]');
    const anchor = row?.getAttribute('data-block-id') ?? nearestBlockId(e.clientY);
    if (anchor) beginDragSelect(anchor, e);
  }

  // Window-level keyboard for selection mode + global undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const t = e.target as HTMLElement | null;
      // Scope: only handle keys aimed at THIS editor (or the blurred page
      // body in selection mode). An embedded database surface owns its own
      // keys — its store-level undo/redo must win over document history.
      if (t && t !== document.body && !rootRef.current?.contains(t)) return;
      const dbScope = t?.closest?.('[data-db-surface]');
      if (dbScope && rootRef.current?.contains(dbScope)) return;
      const typing = !!e.target && (/input|textarea|select/i.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable);
      // global undo/redo (also while typing — history is document-level)
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
      // ⌘A outside a field selects the whole document as blocks (Notion-style);
      // inside a textarea the block-level ⌘A handler escalates instead.
      if (mod && e.key.toLowerCase() === 'a' && !typing) { e.preventDefault(); selectAllBlocks(); return; }
      const s = selRef.current;
      if (!s.size || typing) return;
      const bs = blocksRef.current;
      const ordered = bs.filter((b) => s.has(b.id)).map((b) => b.id);
      if (e.key === 'Escape') { setSel(new Set()); return; }
      if (e.key === 'Enter') { e.preventDefault(); const first = ordered[0]; setSel(new Set()); focusBlock(first, bs.find((x) => x.id === first)?.text.length ?? 0); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); deleteIds(ordered); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateIds(ordered); return; }
      // Block copy: markdown on text/plain + true block JSON in text/html
      // (PRD §7.5 — external apps get clean markdown, Zenboard gets fidelity).
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyBlocks(bs.filter((b) => s.has(b.id)));
        return;
      }
      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        copyBlocks(bs.filter((b) => s.has(b.id)));
        deleteIds(ordered); // one undo step restores the cut (PRD §7.5)
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const li = e.key === 'ArrowDown' ? idx(ordered[ordered.length - 1]) : idx(ordered[0]);
        const ni = e.key === 'ArrowDown' ? Math.min(bs.length - 1, sectionEnd(bs, li)) : Math.max(0, li - 1);
        const nid = bs[ni]?.id; if (!nid) return;
        if (e.shiftKey) { const n = new Set(s); spanIds(nid).forEach((x) => n.add(x)); setSel(n); }
        else selectOnly(nid);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── paste as (a lone pasted URL) ──────────────────────────────────────────
  // Whether the block is JUST the link decides which choices are honest: turning
  // the block into a bookmark card would throw away any other prose in it, so
  // when there is some, only the inline choices are offered. It reads the block
  // being RENDERED: it runs during render, where `blocksRef` can still hold the
  // previous commit's blocks.
  function pasteAsChoices(b: Block, url: string) {
    const soleContent = b.text.trim() === url;
    return pasteOptions(url).filter((o) => soleContent || o.value === 'mention' || o.value === 'url');
  }

  function applyPasteAs(id: string, url: string, choice: PasteAs) {
    setPasteAs(null);
    if (choice === 'url') return; // already pasted — nothing to do
    const blocks = blocksRef.current;
    const i = blocks.findIndex((x) => x.id === id);
    if (i < 0) return;

    if (choice === 'bookmark' || choice === 'video') {
      // The block IS the link (guaranteed by pasteAsChoices), so it becomes the
      // media block, and a fresh paragraph follows to keep the caret in prose.
      const media: Block = { id: genId(), type: choice === 'video' ? 'video' : 'bookmark', text: '', src: url };
      const after = emptyBlock();
      commit([...blocks.slice(0, i), media, after, ...blocks.slice(i + 1)], { id: after.id, pos: 0 });
      // Warm the metadata cache so the card renders titled on first paint.
      void fetchLinkMeta(url);
      return;
    }

    // Mention: swap the URL text for the page's own title, keeping the link.
    void fetchLinkMeta(url).then((meta) => {
      const label = mentionLabel(meta ?? { url });
      const cur = blocksRef.current;
      const target = cur.find((x) => x.id === id);
      if (!target) return;
      const at = target.text.indexOf(url);
      if (at < 0) return; // edited away while we were fetching — leave it alone
      const cut = removeRange(target, at, at + url.length);
      const next = insertSpan(cut, at, { text: label, link: url });
      commit(cur.map((x) => (x.id === id ? { ...x, ...next } : x)), { id, pos: at + label.length });
    });
  }

  // Mention pick. The text surgery itself lives in `insertMention`
  // (lib/mentions.ts), beside the function that reads those links back out as
  // graph edges — the two are one contract, and a picker that wrote a slightly
  // different span would produce mentions the fabric could not see.
  function pickMention(id: string, hit: RecordHit) {
    const m = mention;
    setMention(null);
    if (!m || m.id !== id || !hit.href) return;
    const blocks = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const next = insertMention(blocks[i], m, hit.title, hit.href);
    if (!next) return;   // the trigger moved under us — leave the text alone
    const { caret, ...content } = next;
    commit(blocks.map((x) => (x.id === id ? { ...x, ...content } : x)), { id, pos: caret });
  }

  // ── slash menu (with recently-used) ──
  // Remembered by ENTRY (`menuKey`), not by block type: every database is a
  // `collection`, so a board you had just made came back as "Table view".
  function recentKeys(): string[] {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown[]).filter((k): k is string => typeof k === 'string'); } catch { return []; }
  }
  function rememberRecent(item: SlashItem) {
    const key = menuKey(item);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...recentKeys().filter((x) => x !== key)].slice(0, 4)));
    } catch { /* ignore */ }
  }
  /** The ONE list the menu draws and Enter picks from — see `slashMenu`. */
  function slashResults(q: string) {
    return slashMenu(q, recentKeys());
  }

  // Shared key handler for both caret surfaces (PM-hosted rich blocks and the
  // code-block textarea). Returns true when consumed — the PM host uses that
  // to stop the event; the textarea path relies on preventDefault alone.
  function onKeyDown(e: KeyLike, b: Block, el: SurfaceHandle): boolean | void {
    const blocks = blocksRef.current;
    const mod = e.metaKey || e.ctrlKey;
    if (slash?.id === b.id) {
      const res = slashResults(slash.query);
      // The highlight wraps at both ends, as Notion's does.
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlash({ ...slash, active: res.length ? (slash.active + 1) % res.length : 0 }); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlash({ ...slash, active: res.length ? (slash.active - 1 + res.length) % res.length : 0 }); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const pick = res[slash.active]; if (pick) pickSlash(b.id, pick); return true; }
      if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return true; }
    }
    // Mention picker — the same grammar as the slash menu above, with one
    // deliberate difference: when there is nothing to pick, Enter is NOT
    // swallowed. A slash query resolves the moment you finish typing a known
    // word, but a mention query is a name that may simply not exist yet, and a
    // menu that eats your Enter until you notice it is a trap.
    if (mention?.id === b.id) {
      const res = mentionResults.hits;
      // Clamped, not wrapping — the same as the slash menu one branch up, and
      // the right shape for a RANKED list: the top row is the best match, so
      // ArrowUp from it should stay put rather than jump to the worst one.
      if (e.key === 'ArrowDown') { e.preventDefault(); setMention({ ...mention, active: Math.min(Math.max(res.length - 1, 0), mention.active + 1) }); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMention({ ...mention, active: Math.max(0, mention.active - 1) }); return true; }
      if ((e.key === 'Enter' || e.key === 'Tab') && res[mention.active]) { e.preventDefault(); pickMention(b.id, res[mention.active]); return true; }
      // Escape keeps the literal "@" you typed — dismissing the menu must never
      // also undo the character that opened it.
      if (e.key === 'Escape') { e.preventDefault(); setMention(null); return true; }
      if (e.key === 'Enter') setMention(null);
    }
    if (e.key === 'Escape') { e.preventDefault(); selectOnly(b.id); return true; }
    // ⌘A: first press selects this block's text; once the block is already
    // fully selected (or empty), the next press selects the document. Done
    // explicitly through the handle — the browser's native select-all is not
    // reliable inside the PM surface.
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (el.selStart === 0 && el.selEnd === el.length) selectAllBlocks();
      else el.selectAll();
      return true;
    }
    // ⌘Enter: toggle a to-do's checkbox / open-close a toggle (§12). Consumed
    // for every block so it never falls through to the plain-Enter split below.
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (b.type === 'todo') toggleTodo(b.id);
      else if (b.type === 'toggle') toggleCollapse(b.id);
      return true;
    }
    // Turn-into shortcuts (§12). ⌘⌥1–9 → headings/lists/blocks; ⌘⇧0 → text.
    // The block keeps its text; the caret is preserved through the conversion.
    if (mod && e.altKey && TURN_KEY[e.code]) {
      e.preventDefault(); applyType(b.id, TURN_KEY[e.code], undefined, el.selStart); return true;
    }
    if (mod && e.shiftKey && !e.altKey && e.code === 'Digit0') {
      e.preventDefault(); applyType(b.id, 'text', undefined, el.selStart); return true;
    }
    // Shift+arrow at the block edge extends the selection into the next/prev
    // block (escalates to block selection, then grows via the window handler).
    if (e.shiftKey && !mod && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const collapsed = el.selStart === el.selEnd;
      const atEdge = e.key === 'ArrowDown'
        ? el.selEnd === el.length && (collapsed || el.dir !== 'backward')
        : el.selStart === 0 && (collapsed || el.dir !== 'forward');
      if (atEdge) {
        e.preventDefault(); el.blur(); anchorRef.current = b.id;
        const bs = blocksRef.current; const hid = hiddenIds(bs); const i = idx(b.id);
        const n = new Set(spanIds(b.id));
        if (e.key === 'ArrowDown') { for (let j = i + 1; j < bs.length; j++) if (!hid.has(bs[j].id)) { spanIds(bs[j].id).forEach((x) => n.add(x)); break; } }
        else { for (let j = i - 1; j >= 0; j--) if (!hid.has(bs[j].id)) { spanIds(bs[j].id).forEach((x) => n.add(x)); break; } }
        setSel(n); return true;
      }
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'm' && comments) {
      // Notion's own shortcut for "comment on this block", so the muscle memory
      // transfers. Checked before ⌘D so the Shift variant is never swallowed.
      e.preventDefault(); comments.open(b.id); return true;
    }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateIds(spanIds(b.id)); return true; }
    if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveSpan(b.id, e.key === 'ArrowUp' ? -1 : 1); return true; }
    if (e.key === 'Enter' && !e.shiftKey && b.type !== 'code') {
      // Quote/callout (§6.3): Enter adds a line INSIDE; only Enter on an empty
      // trailing line exits to a text block below. Continue-cases fall through
      // to PM's Enter keymap (inserts a soft break); the exit case is structural.
      if (b.type === 'quote' || b.type === 'callout') {
        const caret = el.selStart;
        const onEmptyTrailingLine = caret === el.length && (caret === 0 || el.text[caret - 1] === '\n');
        if (!onEmptyTrailingLine) return; // let PM add a soft break inside
        e.preventDefault(); exitContainer(b.id, caret); return true;
      }
      e.preventDefault(); enter(b.id, el.selStart); return true;
    }
    if (e.key === 'Backspace' && el.selStart === 0 && el.selEnd === 0) {
      if (b.type !== 'text' || (b.indent ?? 0) > 0 || idx(b.id) > 0) { e.preventDefault(); backspaceStart(b.id); return true; }
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); indent(b.id, e.shiftKey ? -1 : 1); return true; }
    if (e.key === 'ArrowUp' && el.selStart === 0 && !e.shiftKey) {
      const i = idx(b.id);
      // skip rows hidden by collapsed toggles
      const hidden = hiddenIds(blocks);
      for (let j = i - 1; j >= 0; j--) if (!hidden.has(blocks[j].id)) { e.preventDefault(); focusBlock(blocks[j].id, blocks[j].text.length); return true; }
    }
    if (e.key === 'ArrowDown' && el.selStart === el.length && !e.shiftKey) {
      const i = idx(b.id);
      const hidden = hiddenIds(blocks);
      for (let j = i + 1; j < blocks.length; j++) if (!hidden.has(blocks[j].id)) { e.preventDefault(); focusBlock(blocks[j].id, 0); return true; }
    }
  }

  // Shared paste engine for both caret surfaces. Returns true when consumed —
  // the PM host uses that to stop its default paste; unconsumed single-line
  // pastes fall through to the surface's native handling (PM parses inline
  // HTML into marks via the schema; the code textarea inserts literally).
  function onPaste(e: { clipboardData: DataTransfer | null; preventDefault: () => void }, b: Block, el: SurfaceHandle): boolean {
    const blocks = blocksRef.current;
    if (!e.clipboardData) return false;
    // Pasted image → insert an image block after this one (Notion-style).
    const imgFile = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (imgFile && b.type !== 'code') {
      e.preventDefault();
      const i = idx(b.id);
      const img: Block = { id: genId(), type: 'image', text: '' };
      const after = emptyBlock();
      const at = b.text.trim() === '' ? i : i + 1; // reuse an empty block, else append after
      const next = b.text.trim() === ''
        ? [...blocks.slice(0, i), img, after, ...blocks.slice(i + 1)]
        : [...blocks.slice(0, at), img, after, ...blocks.slice(at)];
      commit(next);
      // The block appears immediately and fills in when the bytes land, so a
      // paste never blocks on the network. Same destination as the picker: with
      // an owner the image goes to storage (0033), without one it falls back to
      // the inline data-URL this always used.
      void (async () => {
        try {
          if (attachTo) {
            const { blob, mime } = await downscaleImage(imgFile, { max: 1600, quality: 0.85 });
            const named = new File([blob], reencodedName(imgFile.name || 'pasted-image', mime), { type: mime });
            const saved = await pasteUpload(named);
            if (saved) setImage(img.id, { fileId: saved.id, fileName: saved.filename, fileSize: saved.size_bytes ?? 0 });
          } else {
            setImage(img.id, { src: await fileToDataUrl(imgFile, { max: 1600, quality: 0.85 }) });
          }
        } catch { /* the empty image block stays, ready to retry */ }
      })();
      return true;
    }
    const text = e.clipboardData.getData('text/plain');

    // Zenboard's own copy flavor: true block structures, full fidelity,
    // fresh ids (PRD §7.5). Checked before every other interpretation.
    if (b.type !== 'code' && b.type !== 'table') {
      const html = e.clipboardData.getData('text/html');
      const internal = html ? blocksFromHtml(html) : null;
      if (internal) { e.preventDefault(); spliceParsed(internal, b, el); return true; }
    }

    // Pasting a URL over selected text turns the selection into a real link span.
    if (/^https?:\/\/\S+$/.test(text.trim()) && el.selStart !== el.selEnd && b.type !== 'code') {
      e.preventDefault();
      const label = b.text.slice(el.selStart, el.selEnd);
      const linked = insertSpan(removeRange(b, el.selStart, el.selEnd), el.selStart, { text: label, link: text.trim() });
      commit(blocks.map((x) => (x.id === b.id ? { ...x, ...linked } : x)), { id: b.id, pos: el.selStart + label.length });
      return true;
    }

    // Rich clipboard → Notion-style sanitization: semantic structure becomes
    // native blocks; all foreign presentation is dropped (lib/clipboard).
    // ⌘⇧V arrives without text/html, so it naturally takes the plain path.
    if (b.type !== 'code' && b.type !== 'table') {
      const html = e.clipboardData.getData('text/html');
      if (html) {
        const parsed = htmlToBlocks(html);
        const richEnough = parsed.length > 1 || (parsed.length === 1 && (parsed[0].type !== 'text' || parsed[0].text !== text.trim().replace(/\s+/g, ' ')));
        if (parsed.length && richEnough) { e.preventDefault(); spliceParsed(parsed, b, el); return true; }
      }
    }

    // A URL on its own: let it land as a link, then offer Mention · Embed video ·
    // Bookmark · URL. Only a BARE url qualifies — pasting a sentence that happens
    // to contain a link must not pop a menu (see isBareUrl).
    if (isBareUrl(text) && b.type !== 'code' && b.type !== 'table') {
      setPasteAs({ id: b.id, url: text.trim() });
      return false;
    }

    if (!text.includes('\n') || b.type === 'code' || b.type === 'table') return false; // single-line / code paste = default
    e.preventDefault();
    const parsed = textToBlocks(text);
    if (parsed.length) { spliceParsed(parsed, b, el); return true; }
    return false;
  }

  // Insert converted clipboard blocks at the caret: a leading text block merges
  // into the current one; anything after the caret becomes a tail paragraph.
  // Rich content on both sides of the caret survives the splice.
  function spliceParsed(parsed: Block[], b: Block, el: SurfaceHandle) {
    const blocks = blocksRef.current;
    const i = idx(b.id);
    const [head] = cutAt(b, el.selStart);
    const [, tail] = cutAt(b, el.selEnd);
    // Caret at the very start of a non-empty block and a structural first
    // block: insert the paste above and keep this block intact (no empty husk).
    if (!head.text && el.selStart === el.selEnd && b.text.trim() !== '' && parsed[0].type !== 'text') {
      const last = parsed[parsed.length - 1];
      commit([...blocks.slice(0, i), ...parsed, ...blocks.slice(i)], { id: last.id, pos: last.text.length });
      return;
    }
    const mergeFirst = parsed[0].type === 'text' && b.type !== 'divider';
    const first = mergeFirst ? { ...b, ...concatRich(head, parsed[0]) } : b.text.trim() === '' && !head.text ? null : { ...b, ...head };
    const middle = mergeFirst ? parsed.slice(1) : parsed;
    const tailBlocks: Block[] = tail.text ? [{ id: genId(), type: 'text', ...tail }] : [];
    const next = [...blocks.slice(0, i), ...(first ? [first] : []), ...middle, ...tailBlocks, ...blocks.slice(i + 1)];
    const last = tailBlocks[0] ?? middle[middle.length - 1] ?? first ?? parsed[parsed.length - 1];
    commit(next, { id: last.id, pos: last.text.length });
  }

  function numberFor(i: number) {
    const b = blocks[i]; let n = 1;
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].type === 'numbered' && (blocks[j].indent ?? 0) === (b.indent ?? 0)) n++;
      else break;
    }
    return n;
  }

  const addAtEnd = () => { const nb = emptyBlock(); commit([...blocksRef.current, nb], { id: nb.id, pos: 0 }); };

  // The gutter "+" opens the block/elements picker (Notion-style): it seeds a "/"
  // into an empty block (reusing the current one when it's already empty, so we
  // never leave a stray blank block) and opens the slash menu so typing filters.
  // `above` (alt/option+click, §6.1) inserts before the row instead of after.
  function insertMenu(id: string, above = false) {
    const bs = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const cur = bs[i];
    pushHistory(bs);
    typingSnap.current = null;
    if (!above && cur.type === 'text' && cur.text === '') {
      onChange(bs.map((x) => (x.id === id ? { ...x, text: '/', spans: undefined } : x)));
      setActive((a) => ({ id, anchor: 1, head: 1, epoch: (a?.epoch ?? 0) + 1 }));
      setSlash({ id, at: 0, query: '', active: 0 });
    } else {
      const nb: Block = { id: genId(), type: 'text', text: '/' };
      const at = above ? i : i + 1;
      onChange([...bs.slice(0, at), nb, ...bs.slice(at)]);
      setActive((a) => ({ id: nb.id, anchor: 1, head: 1, epoch: (a?.epoch ?? 0) + 1 }));
      setSlash({ id: nb.id, at: 0, query: '', active: 0 });
    }
    setMenuFor(null);
  }

  // ── drag (group + section aware, §6.5) ──
  const movingRef = useRef<string[]>([]);
  // Recompute the live drop target from the pointer + on-screen row geometry.
  // Rows don't shift during drag (NO_SHIFT_STRATEGY), so their rects are stable
  // per frame; we only read those near the viewport (drop happens where visible).
  const updateDropTarget = () => {
    const root = rootRef.current; if (!root) return;
    const moving = new Set(movingRef.current);
    const { x, y } = dragPointer.current;
    const vh = window.innerHeight;
    const cr = root.getBoundingClientRect();
    const rows: { id: string; top: number; bottom: number; mid: number; indent: number }[] = [];
    root.querySelectorAll<HTMLElement>('[data-block-id]').forEach((el) => {
      const id = el.getAttribute('data-block-id')!;
      if (moving.has(id)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return; // offscreen — skip
      rows.push({ id, top: r.top, bottom: r.bottom, mid: r.top + r.height / 2, indent: blocksRef.current.find((b) => b.id === id)?.indent ?? 0 });
    });
    const calc = computeDrop(y, x, rows.map(({ id, mid, indent }) => ({ id, mid, indent })), cr.left, INDENT_STEP, leaderNestable.current);
    // Anchor the indicator to the live rect of the row at the gap (scroll-safe).
    const anchor = rows.find((r) => r.id === (calc.beforeId ?? calc.aboveId));
    const top = anchor ? (calc.beforeId ? anchor.top : anchor.bottom) - cr.top : 0;
    setDropTarget({ ...calc, top: top - 1, left: calc.indent * 22 });
  };
  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    movingRef.current = movingIdsFor(id);
    const b = blocksRef.current.find((x) => x.id === id);
    leaderNestable.current = !!b && NESTABLE_TYPES.includes(b.type);
    leaderIndent.current = b?.indent ?? 0;
    setActiveId(id);
    setMovingIds(movingRef.current);
    setDragCount(movingRef.current.length);
    closeTriggerMenus(); setMenuFor(null);
    // Track the pointer live (rAF-throttled) to drive the indicator.
    const onMove = (ev: PointerEvent) => {
      dragPointer.current = { x: ev.clientX, y: ev.clientY };
      if (dragRaf.current) return;
      dragRaf.current = requestAnimationFrame(() => { dragRaf.current = null; updateDropTarget(); });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    dragCleanup.current = () => {
      window.removeEventListener('pointermove', onMove);
      if (dragRaf.current) { cancelAnimationFrame(dragRaf.current); dragRaf.current = null; }
    };
  }
  function endDrag() {
    dragCleanup.current?.(); dragCleanup.current = null;
    setActiveId(null); setMovingIds([]); setDropTarget(null);
  }
  function onDragEnd() {
    const blocks = blocksRef.current;
    const dt = dropTargetRef.current;
    const moving = movingRef.current; movingRef.current = [];
    endDrag();
    if (!moving.length || !dt) return;
    const set = new Set(moving);
    if (dt.beforeId && set.has(dt.beforeId)) return; // dropping into own range = no-op
    const group = blocks.filter((b) => set.has(b.id));
    const rest = blocks.filter((b) => !set.has(b.id));
    const at = dt.beforeId ? rest.findIndex((b) => b.id === dt.beforeId) : rest.length;
    if (at < 0) return;
    // Apply the nest level to the leader and shift the whole moved subtree by
    // the same delta so relative nesting is preserved (§6.5). Non-nestable
    // blocks (divider/media) keep indent 0.
    const shift = dt.indent - leaderIndent.current;
    const moved = group.map((b) => (NESTABLE_TYPES.includes(b.type)
      ? { ...b, indent: Math.max(0, Math.min(6, (b.indent ?? 0) + shift)) }
      : b));
    const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
    if (next.every((b, i) => b === blocks[i])) return; // nothing changed
    pushHistory(blocks);
    onChange(next);
    if (set.size > 1) setSel(new Set(moving));
  }

  const hidden = hiddenIds(blocks);
  const visible = blocks.filter((b) => !hidden.has(b.id));
  // SortableContext's `items` identity feeds its context value: a fresh array
  // every render re-renders every useSortable row and defeats the row memo.
  // Keep the array stable while the id SEQUENCE is unchanged (typing) via the
  // adjust-state-during-render pattern for derived state.
  const nextIds = visible.map((b) => b.id);
  const [ids, setIds] = useState(nextIds);
  if (ids.length !== nextIds.length || ids.some((v, k) => v !== nextIds[k])) setIds(nextIds);
  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) ?? null : null;

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => { movingRef.current = []; endDrag(); }}>
      <SortableContext items={ids} strategy={NO_SHIFT_STRATEGY}>
        <div ref={rootRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }} onMouseDown={onSurfaceMouseDown}>
          {activeId && dropTarget && <DropIndicator top={dropTarget.top} left={dropTarget.left} />}
          {visible.map((b) => {
            const i = blocks.indexOf(b);
            const secEnd = b.type === 'toggle' ? sectionEnd(blocks, i) : i + 1;
            // "Turn into page" is offered only for live inline databases.
            const expand = onExpandCollection && b.type === 'collection' && b.colId
              && b.colId !== 'pending' && b.colId !== 'picker'
              && !b.colId.startsWith('demo') && !b.colId.startsWith('error:')
              ? () => onExpandCollection(b.colId!) : undefined;
            return (
              <BlockRow
                key={b.id} block={b} number={b.type === 'numbered' ? numberFor(i) : 0}
                selected={sel.has(b.id)}
                focused={focusedId === b.id}
                dimmed={!!activeId && movingIds.includes(b.id) && b.id !== activeId}
                hasChildren={b.type === 'toggle' && secEnd > i + 1}
                findShadow={b.type === 'toggle' && b.collapsed && secEnd > i + 1 ? blocksToText(blocks.slice(i + 1, secEnd)) : undefined}
                active={active?.id === b.id ? active : null}
                inputRef={(el) => { refs.current[b.id] = el; }}
                onRich={(v, spans, caret) => setRich(b.id, v, spans, caret)}
                onConvertInline={(literal, converted, caret) => convertInline(b.id, literal, converted, caret)}
                onTurnInto={(t, anchor, head) => turnIntoFromToolbar(b.id, t, anchor, head)}
                onCodeText={(v) => setCodeText(b.id, v)}
                onKey={(e, el) => onKeyDown(e, b, el)}
                onPasteShared={(e, el) => onPaste(e, b, el)}
                onActivate={(anchor, head) => setActive((a) => ({ id: b.id, anchor, head, epoch: (a?.epoch ?? 0) + 1 }))}
                onFocusText={() => { anchorRef.current = b.id; setFocusedId(b.id); }}
                onBlurText={() => { setFocusedId((cur) => (cur === b.id ? null : cur)); setSlash((cur) => (cur?.id === b.id ? null : cur)); setMention((cur) => (cur?.id === b.id ? null : cur)); }}
                onToggleTodo={() => toggleTodo(b.id)} onToggleCollapse={() => toggleCollapse(b.id)}
                onAddToggleChild={() => addToggleChild(b.id)}
                onSetLang={(l) => setLang(b.id, l)} onTableChange={(rows) => setRows(b.id, rows)}
                onImage={(patch) => setImage(b.id, patch)}
                attachTo={attachTo}
                uploads={takesUpload(b) && uploads.length ? uploads : undefined}
                remember={remember}
                acceptance={b.type === 'accept' ? acceptanceFor(acceptances, b.id) : null}
                docHashes={b.type === 'accept' ? docHashes : undefined}
                onWithdrawAccept={onWithdrawAccept}
                acceptInvoices={b.type === 'accept' ? acceptInvoices : undefined}
                onCreateAcceptInvoice={onCreateAcceptInvoice}
                onExpandDb={expand}
                onRetryDb={b.type === 'collection' ? () => retryCollection(b.id) : undefined}
                onOpenPage={onOpenPage}
                onRecreatePage={b.type === 'page' ? () => recreatePage(b.id) : undefined}
                commentThreads={comments?.byBlock.get(b.id) ?? NO_THREADS}
                commenting={comments?.composingFor === b.id}
                commentActions={comments?.actions}
                onCloseComposer={comments?.close}
                onAddAfter={(above) => insertMenu(b.id, above)}
                onRowMouseDown={(e) => {
                  if (e.metaKey || e.ctrlKey) { e.preventDefault(); toggleSelect(b.id); }
                  else if (e.shiftKey && (selRef.current.size || anchorRef.current)) { e.preventDefault(); rangeSelect(b.id); }
                  else if (selRef.current.size) setSel(new Set());
                }}
                menu={menuFor === b.id}
                onOpenMenu={() => { setMenuFor(menuFor === b.id ? null : b.id); closeTriggerMenus(); }}
                onCloseMenu={() => setMenuFor(null)}
                menuActions={{
                  convert: (t) => convertTo(b.id, t),
                  setColor: (c) => { setMenuFor(null); setColor(b.id, c); },
                  duplicate: () => { setMenuFor(null); duplicateIds(spanIds(b.id)); },
                  copyLink: pageId ? () => { setMenuFor(null); copyBlockLink(pageId, b.id); } : undefined,
                  comment: comments ? () => { setMenuFor(null); comments.open(b.id); } : undefined,
                  copyText: () => {
                    setMenuFor(null);
                    const bs = blocksRef.current;
                    const j = bs.findIndex((x) => x.id === b.id);
                    if (j >= 0) navigator.clipboard?.writeText(blocksToText(bs.slice(j, sectionEnd(bs, j)))).catch(() => {});
                  },
                  select: () => { setMenuFor(null); selectOnly(b.id); },
                  moveUp: () => { setMenuFor(null); moveSpan(b.id, -1); },
                  moveDown: () => { setMenuFor(null); moveSpan(b.id, 1); },
                  remove: () => { setMenuFor(null); deleteIds(spanIds(b.id)); },
                  expandPage: expand ? () => { setMenuFor(null); expand(); } : undefined,
                }}
                trigger={slash?.id === b.id ? { at: slash.at, query: slash.query } : null}
                pasteAs={pasteAs?.id === b.id ? {
                  options: pasteAsChoices(b, pasteAs.url),
                  pick: (c) => applyPasteAs(b.id, pasteAs.url, c),
                  dismiss: () => setPasteAs(null),
                } : null}
              />
            );
          })}
          {/* Click-to-write zone (no helper text — the single placeholder lives in
              the focused block). Clicking the open space below the last block
              focuses it when empty, otherwise appends a fresh paragraph, exactly
              like Notion's trailing whitespace. */}
          <div
            onMouseDown={(e) => {
              if (e.target !== e.currentTarget) return;
              e.preventDefault();
              const last = blocks[blocks.length - 1];
              if (last && last.type === 'text' && last.text === '') focusBlock(last.id, 0);
              else addAtEnd();
            }}
            aria-hidden
            style={{ minHeight: 96, cursor: 'text' }}
          />
          <RichTextStyles />
        </div>
      </SortableContext>
      {/* A ghost chip NAMES the block; the DropLine says where it lands. Flying
          the chip into the page would animate a claim that is not true — see
          NO_SETTLE. */}
      <DragOverlay dropAnimation={NO_SETTLE}>{activeBlock ? <BlockDragGhost block={activeBlock} count={dragCount} /> : null}</DragOverlay>
      {/* The mention picker anchors to the CARET, not to the block, so it is
          portalled and fixed rather than absolutely positioned inside the row —
          an absolute popover is clipped by the first scrolling ancestor, and
          every host of this editor scrolls. */}
      {/* The slash menu anchors to its "/" the same way — fixed-size, flipped
          above the caret when there is no room below, never clipped. */}
      {slash && (
        <CaretLayer
          anchorKey={`slash:${slash.id}:${slash.at}`}
          rectOf={() => {
            const r = refs.current[slash.id]?.caretRect(slash.at);
            // The panel's rows start at its inner edge; pulling it left by that
            // inset lines the row text up with the "/" you typed.
            return r ? { ...r, left: r.left - SLASH_INSET } : null;
          }}
          onLost={() => setSlash(null)}
        >
          <SlashMenu
            results={slashResults(slash.query)}
            active={slash.active}
            pick={(m) => pickSlash(slash.id, m)}
            hover={(i) => setSlash((cur) => (cur && cur.active !== i ? { ...cur, active: i } : cur))}
            close={() => setSlash(null)}
          />
        </CaretLayer>
      )}
      {mention && (
        <CaretLayer
          anchorKey={`${mention.id}:${mention.at}`}
          rectOf={() => refs.current[mention.id]?.caretRect(mention.at) ?? null}
          onLost={() => setMention(null)}
        >
          <MentionMenu
            {...mentionResults}
            query={mention.query}
            active={mention.active}
            listId="zb-mention-list"
            pick={(h) => pickMention(mention.id, h)}
          />
        </CaretLayer>
      )}
    </DndContext>
  );
}

// Holds a floating panel next to a caret: measured on open, re-measured while
// anything scrolls or resizes, flipped above when it would run off the bottom,
// and clamped so it never hangs off either side. When it fits on NEITHER side it
// takes the roomier one and says how much room there is (`--caret-room`), so a
// panel that can shrink — the slash menu's list — does, instead of running off
// the screen (a 423px menu under a caret with 191px below it did exactly that).
//
// `onLost` fires when the caret leaves the viewport. A menu still floating over
// a document you have scrolled away from is pointing at nothing — Notion
// dismisses in exactly that case.
const CARET_GAP = 6;
const VIEWPORT_MARGIN = 8;
function CaretLayer({ anchorKey, rectOf, onLost, children }: {
  anchorKey: string;
  rectOf: () => CaretRect | null;
  onLost: () => void;
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<CaretRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; room: number } | null>(null);
  const lost = useRef(onLost);
  useLayoutEffect(() => { lost.current = onLost; });

  // Track the caret. Capture-phase scroll catches the editor's own scroll
  // container, which does not bubble its scroll events to the window.
  useLayoutEffect(() => {
    const read = () => {
      const r = rectOf();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { lost.current(); return; }
      setRect(r);
    };
    read();
    window.addEventListener('scroll', read, true);
    window.addEventListener('resize', read);
    return () => {
      window.removeEventListener('scroll', read, true);
      window.removeEventListener('resize', read);
    };
    // `anchorKey` identifies the caret being tracked; `rectOf` is a fresh
    // closure every render and would otherwise re-subscribe on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // Place it once the panel has a measured size — before paint, so the flip is
  // never visible as a jump.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || !rect) return;
    const { width, height } = el.getBoundingClientRect();
    const roomBelow = window.innerHeight - VIEWPORT_MARGIN - (rect.bottom + CARET_GAP);
    const roomAbove = rect.top - CARET_GAP - VIEWPORT_MARGIN;
    // Below unless it doesn't fit there AND above has more room.
    const flip = height > roomBelow && roomAbove > roomBelow;
    const room = Math.floor(flip ? roomAbove : roomBelow);
    const drawn = Math.min(height, room);
    const next = {
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)),
      top: flip ? rect.top - CARET_GAP - drawn : rect.bottom + CARET_GAP,
      room,
    };
    setPos((cur) => (cur && cur.left === next.left && cur.top === next.top && cur.room === next.room ? cur : next));
  }, [rect, children]);

  if (typeof document === 'undefined' || !rect) return null;
  return createPortal(
    <div
      ref={hostRef}
      style={{
        position: 'fixed', zIndex: 'var(--z-dropdown)', left: pos?.left ?? rect.left, top: pos?.top ?? rect.bottom + CARET_GAP,
        ['--caret-room' as string]: pos ? `${pos.room}px` : undefined,
        // Until the first measurement lands there is no honest position to draw
        // at; one frame hidden beats one frame in the wrong place.
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function grow(el: HTMLTextAreaElement) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

const baseInput: React.CSSProperties = {
  width: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'none',
  fontFamily: 'inherit', color: 'var(--color-ink-900)', lineHeight: 1.6, padding: 0, overflow: 'hidden',
};
// Rich-surface equivalent of baseInput — same text defaults, no input chrome.
const baseRich: React.CSSProperties = { color: 'var(--color-ink-900)', lineHeight: 1.6 };
// Typography measured from the HiFi doc: body 16px/1.5, headings in the body
// font (not display) at 30 / 20 / 16 · 600. Headings carry top margin so
// sections breathe like the reference. Applied inline (passed to RichText's
// `style` contract); values track the §6 scale, colours are canonical tokens.
const TYPE_STYLE: Record<BlockType, React.CSSProperties> = {
  text: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  // The block draws its own table; this is only the caption/fallback run.
  lineitems: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  accept: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  h1: { fontSize: 30, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.006em', marginTop: 18 },
  h2: { fontSize: 20, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', marginTop: 12 },
  h3: { fontSize: 16, fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.01em', marginTop: 6 },
  bullet: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' }, numbered: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' }, todo: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  quote: { fontSize: 16, fontStyle: 'italic', color: 'var(--color-ink-800)', lineHeight: 1.5 },
  callout: { fontSize: 16, lineHeight: 1.5 }, code: { fontSize: 14, fontFamily: 'var(--font-mono)' }, divider: {}, table: {},
  image: {}, bookmark: {}, embed: {}, video: {}, audio: {}, pdf: {}, file: {}, collection: {}, page: {},
  toggle: { fontSize: 16, fontWeight: 500, lineHeight: 1.5 },
};

// ── Gutter alignment ────────────────────────────────────────────────────────
// The +/⠿ handles must sit on the block's FIRST LINE, the way Notion's do. They
// used to be `top: 3px` — a constant, which can only ever be right for ONE block
// type. It was right for a 16px/1.5 paragraph (2px content padding + (24−22)/2 =
// 3) and wrong for everything else: an h1 is 30px/1.3 with an 18px top margin, so
// its handles floated ~25px above the cap height they were meant to line up with.
//
// So it's derived from TYPE_STYLE — the same map that sets the typography — and
// cannot drift from it. Change a heading's size and the handles follow.
const GUTTER_H = 22;   // the handle buttons' height
const CONTENT_PT = 2;  // the content wrapper's own padding-top

/** Vertical padding a block type's wrapper adds above its first line of text. */
const WRAPPER_PT: Partial<Record<BlockType, number>> = {
  callout: 12, // rounded box: px-3.5 py-3
};

/** Container blocks have no line of prose to centre on — a code block, a table,
 *  an image. The handle sits near the container's top edge, which is where the
 *  block visually begins. */
const CONTAINER_TOP: Partial<Record<BlockType, number>> = {
  code: 4, table: 4, image: 4, collection: 4,
  bookmark: 4, embed: 4, video: 4, audio: 4, pdf: 4, file: 4,
  divider: 2,
  // A page line is 30px tall: the 22px handles centre on it (2 + (30 − 22) / 2).
  page: 6,
};

function gutterTop(type: BlockType): number {
  const fixed = CONTAINER_TOP[type];
  if (fixed != null) return fixed;
  const st = TYPE_STYLE[type] ?? {};
  const fontSize = typeof st.fontSize === 'number' ? st.fontSize : 16;
  // baseRich/baseInput default to 1.6 when a type doesn't override it.
  const lineHeight = typeof st.lineHeight === 'number' ? st.lineHeight : 1.6;
  const marginTop = typeof st.marginTop === 'number' ? st.marginTop : 0;
  const firstLine = fontSize * lineHeight;
  return marginTop + CONTENT_PT + (WRAPPER_PT[type] ?? 0) + Math.max(0, (firstLine - GUTTER_H) / 2);
}

type MenuActions = {
  convert: (t: BlockType) => void; setColor: (c: string | null) => void; duplicate: () => void; copyText: () => void;
  select: () => void; moveUp: () => void; moveDown: () => void; remove: () => void;
  expandPage?: () => void; // inline database → full-page database
  copyLink?: () => void;   // only where the host has a page of its own (see `pageId`)
  comment?: () => void;    // only where the host supplies `comments` (§7H, 0037)
};

/**
 * Put a block's address on the clipboard.
 *
 * Copying happens away from the user's eye, so it reports through the app's one
 * feedback channel (§2.5) — and says the whole failing URL on the way out,
 * because a clipboard write that silently did nothing is indistinguishable from
 * one that worked.
 */
function copyBlockLink(pageId: string, blockId: string) {
  const path = blockHref(pageId, blockId);
  if (!path) return;
  const url = `${window.location.origin}${path}`;
  navigator.clipboard?.writeText(url)
    .then(() => toast({ message: 'Link to block copied.' }))
    .catch(() => toast({ message: `Copy failed: the link is ${url}`, variant: 'error' }));
}

// Rows are memoized on their data props only — callback identity is ignored,
// which is safe because every editor handler reads live state through refs
// (blocksRef/selRef), never through render-time closures.
type ActiveSel = { anchor: number; head: number; epoch: number } | null;
const activeEq = (a: ActiveSel, b: ActiveSel) =>
  a === b || (!!a && !!b && a.anchor === b.anchor && a.head === b.head && a.epoch === b.epoch);

const BlockRow = memo(function BlockRow({
  block: b, number, selected, focused, dimmed, hasChildren, findShadow, active, inputRef, onRich, onConvertInline, onTurnInto, onCodeText, onKey, onPasteShared, onActivate, onFocusText, onBlurText,
  onToggleTodo, onToggleCollapse, onAddToggleChild, onSetLang, onTableChange, onImage, onExpandDb, onRetryDb, onOpenPage, onRecreatePage, trigger, pasteAs, onAddAfter, attachTo, uploads, remember,
  acceptance, docHashes, onWithdrawAccept, acceptInvoices, onCreateAcceptInvoice,
  onRowMouseDown, menu, onOpenMenu, onCloseMenu, menuActions,
  commentThreads, commenting, commentActions, onCloseComposer,
}: {
  block: Block; number: number; selected: boolean; focused: boolean; dimmed: boolean; hasChildren: boolean;
  // Plain text of the descendants a collapsed toggle is hiding — present only
  // on visible collapsed toggles; renders as a findable until-found shadow.
  findShadow?: string;
  active: { anchor: number; head: number; epoch: number } | null;
  inputRef: (el: SurfaceHandle | null) => void;
  onRich: (v: string, spans: RichSpan[] | undefined, caret: number) => void;
  onConvertInline: (literal: { text: string; spans?: RichSpan[] }, converted: { text: string; spans?: RichSpan[] }, caret: number) => void;
  onTurnInto: (t: BlockType, anchor: number, head: number) => void;
  onCodeText: (v: string) => void;
  onKey: (e: KeyLike, el: SurfaceHandle) => boolean | void;
  onPasteShared: (e: { clipboardData: DataTransfer | null; preventDefault: () => void }, el: SurfaceHandle) => boolean;
  onActivate: (anchor: number, head: number) => void;
  onFocusText: () => void; onBlurText: () => void;
  onToggleTodo: () => void; onToggleCollapse: () => void; onAddToggleChild: () => void; onSetLang: (l: string) => void; onTableChange: (rows: string[][]) => void;
  onImage: (patch: Partial<Block>) => void;
  /** What an uploaded file hangs off (0033). Absent ⇒ file blocks link only. */
  attachTo?: AttachmentOwner;
  /** The page's uploads nothing on it shows — given only to an empty block that could show one. */
  uploads?: readonly Attachment[];
  /** "Remember this" on a selection (§7X). Forwarded to the rich block. */
  remember?: RememberHook;
  /** This block's signature, if it is an accept block and has one (§7M). */
  acceptance?: Acceptance | null;
  docHashes?: readonly string[];
  onWithdrawAccept?: (id: string) => void;
  acceptInvoices?: Record<string, { number: string; status: string }>;
  onCreateAcceptInvoice?: (acceptanceId: string) => void;
  onExpandDb?: () => void;
  onRetryDb?: () => void;
  onOpenPage?: (pageId: string) => void;
  onRecreatePage?: () => void;
  /** Open conversations anchored to THIS block (§7H). Stable identity — see NO_THREADS. */
  commentThreads: CommentThread[];
  commenting: boolean;
  commentActions?: CommentActions;
  onCloseComposer?: () => void;
  onAddAfter: (above: boolean) => void; onRowMouseDown: (e: React.MouseEvent) => void;
  menu: boolean; onOpenMenu: () => void; onCloseMenu: () => void; menuActions: MenuActions;
  /** The slash menu is open on this row: where its "/" is, and what follows it. */
  trigger: { at: number; query: string } | null;
  pasteAs: { options: { value: PasteAs; label: string }[]; pick: (c: PasteAs) => void; dismiss: () => void } | null;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({ id: b.id });
  // Code-block "Copied" confirmation (§8.10) — auto-clears after 1.5s.
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, [copied]);
  const pad = (b.indent ?? 0) * 22;
  // Notion-style block color: '<palette>' tints the text, '<palette>-bg' washes
  // the block. Resolved through the shared palette tokens (light/dark aware).
  const isBgColor = !!b.color?.endsWith('-bg');
  const tint: React.CSSProperties = b.color && !isBgColor ? { color: `var(--pal-${b.color}-text)` } : {};
  const bgTint = isBgColor ? `var(--pal-${b.color!.slice(0, -3)}-bg)` : undefined;
  // Placeholder (§6.9): the focused/active empty block shows its hint inline at
  // the caret; empty headings ALSO show "Heading 1/2/3" while unfocused (Notion
  // keeps heading placeholders persistent), so the outline stays legible.
  const isHeading = b.type === 'h1' || b.type === 'h2' || b.type === 'h3';
  const ph = b.text === '' && (focused || !!active || isHeading) ? placeholderFor(b.type) : '';
  // The rich surface: static spans when idle, the page's single PM editor when
  // this block is active. Code blocks keep the plain textarea below.
  const ta = (extra?: React.CSSProperties) => (
    b.type === 'code' ? (
      <textarea
        ref={(el) => { inputRef(el ? textareaHandle(el) : null); if (el) grow(el); }}
        value={b.text} rows={1} placeholder={ph} wrap={b.wrap ? 'soft' : 'off'} data-chromeless
        onChange={(e) => { onCodeText(e.target.value); grow(e.currentTarget); }}
        onFocus={onFocusText} onBlur={onBlurText}
        onMouseDown={(e) => { if (e.detail >= 3) { e.preventDefault(); const t = e.currentTarget; t.focus(); t.select(); } }}
        onKeyDown={(e) => onKey(e, textareaHandle(e.currentTarget))}
        onPaste={(e) => onPasteShared(e, textareaHandle(e.currentTarget))}
        autoComplete="off" data-1p-ignore data-lpignore="true"
        style={{ ...baseInput, ...TYPE_STYLE[b.type], ...tint, whiteSpace: b.wrap ? 'pre-wrap' : 'pre', overflowX: b.wrap ? 'hidden' : 'auto', ...extra }}
      />
    ) : (
      <RichText
        blockId={b.id} text={b.text} spans={b.spans} type={b.type}
        active={active} placeholder={ph}
        trigger={trigger && b.text[trigger.at] === '/' ? { at: trigger.at, length: 1 + trigger.query.length, placeholder: trigger.query ? undefined : 'Type to search' } : null}
        style={{ ...baseRich, ...TYPE_STYLE[b.type], ...tint, ...extra }}
        onRich={onRich} onConvertInline={onConvertInline} onKey={onKey} onPasteEvent={(e, el) => onPasteShared(e, el)}
        turnIntoOptions={TURN_INTO} onTurnInto={(t, anchor, head) => onTurnInto(t as BlockType, anchor, head)}
        remember={remember}
        onFocus={onFocusText} onBlur={onBlurText}
        onActivate={onActivate} handleRef={inputRef}
      />
    )
  );

  let inner: React.ReactNode;
  if (b.type === 'divider') {
    inner = <div className="py-2.5"><div className="h-px bg-line-strong" /></div>;
  } else if (b.type === 'bullet') {
    inner = <div className="flex gap-2.5" style={{ paddingLeft: pad }}><span className="text-[16px] leading-[1.6] text-ink-600">•</span>{ta()}</div>;
  } else if (b.type === 'numbered') {
    inner = <div className="flex gap-2" style={{ paddingLeft: pad }}><span className="num min-w-[18px] text-[14px] leading-[1.6] text-ink-600">{number}.</span>{ta()}</div>;
  } else if (b.type === 'todo') {
    inner = (
      <div className="flex items-start gap-2.5" style={{ paddingLeft: pad }}>
        <Checkbox checked={!!b.checked} onCheckedChange={onToggleTodo} aria-label="toggle todo" className="mt-[3px]" />
        {ta({ textDecoration: b.checked ? 'line-through' : 'none', color: b.checked ? 'var(--color-ink-500)' : 'var(--color-ink-900)' })}
      </div>
    );
  } else if (b.type === 'toggle') {
    inner = (
      <div className="flex items-start gap-1.5" style={{ paddingLeft: pad }}>
        <button onClick={onToggleCollapse} aria-label={b.collapsed ? 'Expand' : 'Collapse'} aria-expanded={!b.collapsed}
          className="mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-600">
          <Icon icon={ChevronRight} size={14} weight="bold" style={{ transform: b.collapsed ? 'none' : 'rotate(90deg)', transition: 'transform var(--duration-base) var(--ease-standard)' }} />
        </button>
        {ta()}
        {b.collapsed && hasChildren && <span className="mt-[5px] shrink-0 text-caption text-ink-500">…</span>}
      </div>
    );
    // Open toggle with no children (§6.9): affordance row that seeds the first
    // child on click. Indented to the child level so it reads as "inside".
    if (!b.collapsed && !hasChildren) {
      inner = (
        <div>
          {inner}
          <button
            type="button" onClick={onAddToggleChild}
            className="mt-0.5 block w-full cursor-text border-0 bg-transparent text-left text-meta leading-normal text-ink-500"
            style={{ paddingLeft: pad + 26 }}>
            Empty toggle. Click or drop blocks inside.
          </button>
        </div>
      );
    }
  } else if (b.type === 'lineitems') {
    inner = (
      <div style={{ marginLeft: pad }}>
        <LineItemsBlock items={b.items ?? []} onChange={(items) => onImage({ items })} />
      </div>
    );
  } else if (b.type === 'accept') {
    // Terms only. The signature this block waits for is a row in `acceptances`
    // written by the client through the portal, never something the editor can
    // produce — so the editor never passes `onAccept`.
    inner = (
      <div style={{ marginLeft: pad }}>
        <AcceptBlock terms={b.accept} acceptance={acceptance} currentHashes={docHashes}
          onChange={(accept) => onImage({ accept })}
          onWithdraw={acceptance && onWithdrawAccept ? () => onWithdrawAccept(acceptance.id) : undefined}
          invoice={acceptance?.invoiceId ? { id: acceptance.invoiceId, ...(acceptInvoices?.[acceptance.invoiceId] ?? { number: 'Invoice', status: 'draft' }) } : null}
          onCreateInvoice={acceptance && !acceptance.invoiceId && onCreateAcceptInvoice ? () => onCreateAcceptInvoice(acceptance.id) : undefined} />
      </div>
    );
  } else if (b.type === 'quote') {
    inner = <div className="border-l-[3px] border-line-strong pl-3.5" style={{ marginLeft: pad }}>{ta()}</div>;
  } else if (b.type === 'callout') {
    inner = <div className="flex gap-2.5 rounded-md border border-line-strong bg-surface-raised px-3.5 py-3" style={{ marginLeft: pad }}><CalloutIcon icon={b.icon} onPick={(emoji) => onImage({ icon: emoji })} />{ta()}</div>;
  } else if (b.type === 'code') {
    // §8.10 header row: language selector · Copy (raw text, 1.5s confirm) · Wrap.
    inner = (
      <div className="overflow-hidden rounded-md border border-line-strong bg-surface-raised">
        <div className="flex items-center justify-end gap-0.5 border-b border-line-soft px-1.5 py-1">
          <select data-chromeless value={b.lang ?? 'text'} onChange={(e) => onSetLang(e.target.value)} className="mr-auto cursor-pointer border-0 bg-transparent font-mono text-caption text-ink-600 outline-none">
            {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <ToolbarButton wide size="sm" active={!!b.wrap} onClick={() => onImage({ wrap: !b.wrap })} title="Toggle soft wrap" aria-pressed={!!b.wrap}>
            <Icon icon={ArrowDownUp} size={12} style={{ transform: 'rotate(90deg)' }} /> Wrap
          </ToolbarButton>
          <ToolbarButton wide size="sm" onClick={() => { navigator.clipboard?.writeText(b.text).catch(() => {}); setCopied(true); }} title="Copy code">
            <IconSwap swapKey={copied ? 'check' : 'copy'}><Icon icon={copied ? Check : CopyIcon} size={12} /></IconSwap> {copied ? 'Copied' : 'Copy'}
          </ToolbarButton>
        </div>
        <div className="px-3.5 py-2.5">{ta()}</div>
      </div>
    );
  } else if (b.type === 'table') {
    inner = <TableBlock rows={b.rows && b.rows.length ? b.rows : emptyTableRows()} onChange={onTableChange} />;
  } else if (b.type === 'image') {
    inner = <div style={{ marginLeft: pad }}><ImageBlock block={b} onImage={onImage} caption={ta} attachTo={attachTo} uploads={uploads} /></div>;
  } else if (b.type === 'bookmark' || b.type === 'embed' || b.type === 'video' || b.type === 'audio' || b.type === 'pdf' || b.type === 'file') {
    inner = <div style={{ marginLeft: pad }}><LinkBlock block={b} attachTo={attachTo} uploads={uploads} note={ta}
      onSubmit={(url) => onImage({ src: url })}
      onAttach={(patch) => onImage(patch)}
      onClear={() => onImage({ src: undefined, fileId: undefined, fileName: undefined, fileSize: undefined })} /></div>;
  } else if (b.type === 'page') {
    inner = <div style={{ marginLeft: pad }}><PageBlock pageId={b.pageId} onOpen={onOpenPage} onRecreate={onRecreatePage} /></div>;
  } else if (b.type === 'collection') {
    /* Inline database — the block hosts a full database surface. onPick binds
       a "Linked view" block to its chosen source collection. */
    inner = <div style={{ marginLeft: pad }}><InlineCollection colId={b.colId} onExpand={onExpandDb} onRetry={onRetryDb} onPick={(cid) => onImage({ colId: cid })} /></div>;
  } else {
    inner = <div style={{ paddingLeft: pad }}>{ta()}</div>;
  }

  return (
    <div
      ref={setNodeRef}
      className="block-row group/row"
      data-block-id={b.id}
      data-heading={b.type === 'h1' || b.type === 'h2' || b.type === 'h3' ? b.type : undefined}
      onMouseDown={onRowMouseDown}
      onContextMenu={(e) => {
        // Right-click opens the block action menu (§6.4) for text-carrying
        // blocks; tables/databases keep their own native cell menus.
        if (b.type === 'table' || b.type === 'collection' || b.type === 'lineitems') return;
        e.preventDefault(); onOpenMenu();
      }}
      style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'flex-start', opacity: isDragging ? 0.35 : dimmed ? 0.45 : 1, transform: CSS.Transform.toString(transform), transition }}
    >
      {/* Hover gutter — lives in the page margin, OUTSIDE the writing column
          (Notion architecture): absolutely positioned left of the row so the
          caret, placeholder, and text never shift, hover or not. Consumers
          reserve ≥44px of horizontal padding for it. */}
      <span
        className={cn('block-gutter absolute flex w-10 items-center justify-end gap-px opacity-0 transition-opacity duration-fast group-hover/row:opacity-100', menu && 'opacity-100')}
        style={{ left: -44, top: gutterTop(b.type) }}
      >
        <button onClick={(e) => onAddAfter(e.altKey)} title="Click to add below · ⌥-click to add above" aria-label="Add block"
          className="zb-press grid h-[22px] w-5 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-600">
          <Icon icon={Plus} size={16} />
        </button>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} onClick={onOpenMenu} title="Drag to move · click for menu" aria-label="Block menu"
          className={cn('zb-press grid h-[22px] w-4 cursor-grab place-items-center rounded-xs border-0 text-ink-600 [touch-action:none]', menu ? 'bg-surface-active' : 'bg-transparent')}>
          <Icon icon={GripVertical} size={14} />
        </button>
      </span>
      {/* Swept-block highlight — Notion's flat blue band across the writing
          column: no border ring, no accent tint, just the selection wash.
          Idle rows skip offscreen layout/paint via content-visibility (§13);
          containment turns off whenever anything may overflow the box — the
          live editor's fixed toolbar, the slash menu, the block menu, and
          database surfaces with their own popovers. */}
      <div style={{
        flex: 1, minWidth: 0, padding: '2px 4px', borderRadius: 'var(--r-xs)',
        background: selected ? 'var(--sel-block)' : bgTint ?? 'transparent',
        // Containment is off whenever anything inside may overflow or must be
        // measured — a comment thread grows the row well past the 34px estimate.
        ...(active || menu || trigger || commenting || commentThreads.length || b.type === 'collection' || b.type === 'lineitems' || b.type === 'callout' ? {} : { contentVisibility: 'auto', containIntrinsicSize: 'auto 34px' }),
      }}>
        {inner}
        {pasteAs && <PasteAsMenu {...pasteAs} />}
        {commentActions && (
          <BlockComments
            threads={commentThreads} composing={commenting} blockId={b.id}
            actions={commentActions} onCloseComposer={onCloseComposer ?? (() => {})}
          />
        )}
      </div>
      {findShadow !== undefined && <FindShadow text={findShadow} onReveal={onToggleCollapse} />}
      {menu && <BlockMenu block={b} actions={menuActions} onClose={onCloseMenu} />}
    </div>
  );
}, (p, n) =>
  p.block === n.block && p.number === n.number && p.selected === n.selected &&
  p.focused === n.focused && p.dimmed === n.dimmed && p.hasChildren === n.hasChildren &&
  p.findShadow === n.findShadow &&
  // DATA a row paints from, which arrives after the row does: the page's unplaced uploads (an empty media row's
  // offer) and a proposal's signatures. Missing here, an offer that landed never appeared, and a signed proposal
  // kept reading "unsigned" until something else repainted its row (found 2026-09-21). Each is handed only to the
  // rows that paint it, as a stable reference, so these stay pointer compares and typing still skips every row.
  p.uploads === n.uploads && p.acceptance === n.acceptance && p.docHashes === n.docHashes &&
  p.acceptInvoices === n.acceptInvoices &&
  // Comments are data, so they belong in the comparator — a thread posted on
  // this row must repaint it. `byBlock` hands back the same array reference
  // while the threads are unchanged (and NO_THREADS when there are none), so
  // this stays a pointer compare and typing still skips every other row.
  p.commentThreads === n.commentThreads && p.commenting === n.commenting &&
  p.menu === n.menu && activeEq(p.active, n.active) && !p.trigger && !n.trigger);

// ⌘F reaches inside collapsed toggles (PRD §8.6): the hidden children's plain
// text stays in the DOM under hidden="until-found", so native find-on-page
// matches it; the browser fires `beforematch` before revealing, which expands
// the toggle (the shadow then unmounts because the toggle is open). React
// lowers `hidden` to a boolean attribute, so the valued form is set via ref.
// Browsers without beforematch (Safari) keep today's behavior: collapsed
// content simply isn't findable.
function FindShadow({ text, onReveal }: { text: string; onReveal: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useRef(onReveal);
  useLayoutEffect(() => { reveal.current = onReveal; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('hidden', 'until-found');
    const fn = () => reveal.current();
    el.addEventListener('beforematch', fn);
    return () => el.removeEventListener('beforematch', fn);
  }, []);
  // Zero-height transparent styling keeps the node invisible for the frame
  // between the browser stripping `hidden` and React unmounting the shadow.
  return <div ref={ref} aria-hidden style={{ height: 0, overflow: 'clip', color: 'transparent' }}>{text}</div>;
}

// ── per-block context menu (search · convert · color · duplicate · copy · select · move · delete) ──
// Chrome comes from the canonical <MenuPanel>/<MenuItem>/<MenuLabel>/<MenuGlyph>
// DS primitives (components/ds/ui). Only submenu positioning is set per use.
const MENU_SUB_POS = 'absolute top-[-4px] left-[calc(100%+4px)] z-[1] max-h-[280px] w-[190px] overflow-y-auto';

function BlockMenu({ block, actions, onClose }: { block: Block; actions: MenuActions; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [onClose]);
  const convertible = isTextBlock(block.type);
  const colorable = convertible;
  const typeLabel = BLOCK_MENU.find((m) => m.type === block.type)?.label ?? block.type;
  // Type-ahead: fuzzy-filter every menu item on label + keywords (§6.4).
  const query = q.trim().toLowerCase();
  const hit = (kw: string) => !query || kw.toLowerCase().includes(query);
  // Leaf actions modeled as data so the search can filter them uniformly.
  type Leaf = { key: string; label: string; kw: string; icon: IconType; kbd?: string; danger?: boolean; run: () => void };
  const leaves: Leaf[] = [
    ...(actions.expandPage ? [{ key: 'page', label: 'Turn into page', kw: 'turn into page subpage', icon: ExternalLink, run: actions.expandPage }] : []),
    ...(actions.comment ? [{ key: 'comment', label: 'Comment', kw: 'comment discuss note reply thread feedback', icon: MessageCircle, kbd: '⌘⇧M', run: actions.comment }] : []),
    { key: 'dup', label: 'Duplicate', kw: 'duplicate copy clone', icon: CopyIcon, kbd: '⌘D', run: actions.duplicate },
    ...(actions.copyLink ? [{ key: 'copylink', label: 'Copy link to block', kw: 'copy link to block anchor address url share permalink', icon: LinkIcon, run: actions.copyLink }] : []),
    { key: 'copytext', label: 'Copy text', kw: 'copy text', icon: CopyIcon, run: actions.copyText },
    { key: 'select', label: 'Select', kw: 'select highlight', icon: Check, kbd: 'Esc', run: actions.select },
    { key: 'up', label: 'Move up', kw: 'move up reorder', icon: ArrowUp, kbd: '⌘⇧↑', run: actions.moveUp },
    { key: 'down', label: 'Move down', kw: 'move down reorder', icon: ArrowDown, kbd: '⌘⇧↓', run: actions.moveDown },
    { key: 'delete', label: 'Delete', kw: 'delete remove trash', icon: Trash2, danger: true, run: actions.remove },
  ];
  const shownLeaves = leaves.filter((l) => hit(l.kw));
  const showConvert = convertible && hit('turn into convert type');
  const showColor = colorable && hit('color background text highlight');
  // Enter runs the single remaining match (fast keyboard path).
  const onlyOne = shownLeaves.length === 1 && !showConvert && !showColor ? shownLeaves[0] : null;
  return (
    // PORTALLED. This was `absolute top-[26px] left-0`, and a block lives inside
    // the editor's `overflow: auto` scroll region — measured — so the panel was
    // sliced at the region's edge for any block near the bottom. Same class of
    // bug as the document card menu.
    //
    // A Popover, not a DropdownMenu: this panel owns a SEARCH INPUT, and a
    // Radix menu would swallow those keystrokes for type-ahead. The anchor is a
    // zero-size span left exactly where the old panel's top-left corner sat, so
    // the menu appears in the same place while being positioned from the body.
    <Popover open onOpenChange={(next) => { if (!next) onClose(); }}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none absolute top-[26px] left-0 block size-0" />
      </PopoverAnchor>
      <PopoverContent
        ref={ref}
        align="start" side="bottom" sideOffset={0} flush
        onMouseDown={(e) => e.stopPropagation()}
        // The panel's own input carries autoFocus; letting Radix steal focus to
        // the content wrapper first would drop the first keystroke.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[216px] p-1"
      >
      <input data-chromeless
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          if (e.key === 'Enter' && onlyOne) { e.preventDefault(); onlyOne.run(); }
        }}
        placeholder="Search actions…" aria-label="Search actions"
        autoComplete="off" data-1p-ignore data-lpignore="true"
        className="w-full border-0 bg-transparent px-2 pt-0.5 pb-1.5 text-meta text-ink-900 outline-none placeholder:text-ink-500"
      />
      {/* Context label — the current block's type name (§6.4). */}
      <MenuLabel className="pt-0.5">{typeLabel}</MenuLabel>
      {showConvert && (
        <div className="relative">
          <MenuItem icon={<Icon icon={ArrowLeftRight} size={14} />} trailing={<Icon icon={ChevronRight} size={12} />} onClick={() => { setConvertOpen((v) => !v); setColorOpen(false); }}>Turn into</MenuItem>
          {convertOpen && (
            <MenuPanel className={MENU_SUB_POS}>
              {BLOCK_MENU.filter((m) => isTextBlock(m.type) && m.type !== block.type).map((m) => (
                <MenuItem key={m.type} icon={<Icon icon={BLOCK_ICON[m.type]} size={14} />} onClick={() => actions.convert(m.type)}>{m.label}</MenuItem>
              ))}
            </MenuPanel>
          )}
        </div>
      )}
      {showColor && (
        <div className="relative">
          <MenuItem
            icon={<Icon icon={PaletteIcon} size={14} />}
            onClick={() => { setColorOpen((v) => !v); setConvertOpen(false); }}
            trailing={
              <span className="inline-flex items-center gap-1.5">
                {/* Block colour is user content — inline swatch. */}
                {block.color && <span aria-hidden className="size-3 rounded-full shadow-[inset_0_0_0_1px_var(--color-line)]" style={{ background: block.color.endsWith('-bg') ? `var(--pal-${block.color.slice(0, -3)}-bg)` : `var(--pal-${block.color}-text)` }} />}
                <Icon icon={ChevronRight} size={12} />
              </span>
            }
          >Color</MenuItem>
          {colorOpen && (
            <MenuPanel className={MENU_SUB_POS}>
              <MenuLabel>Text color</MenuLabel>
              <MenuItem icon={<MenuGlyph>A</MenuGlyph>} active={!block.color} onClick={() => actions.setColor(null)}>Default</MenuItem>
              {PALETTE_NAMES.map((n) => (
                <MenuItem key={n} className="capitalize" active={block.color === n} icon={<MenuGlyph style={{ color: `var(--pal-${n}-text)` }}>A</MenuGlyph>} onClick={() => actions.setColor(n)}>{n}</MenuItem>
              ))}
              <MenuLabel>Background</MenuLabel>
              {PALETTE_NAMES.map((n) => (
                <MenuItem key={n + '-bg'} className="capitalize" active={block.color === n + '-bg'} icon={<MenuGlyph style={{ background: `var(--pal-${n}-bg)` }}>A</MenuGlyph>} onClick={() => actions.setColor(n + '-bg')}>{n} background</MenuItem>
              ))}
            </MenuPanel>
          )}
        </div>
      )}
      {shownLeaves.map((l) => (
        <div key={l.key}>
          {/* Separators only in the unfiltered view. */}
          {!query && (l.key === 'up' || l.key === 'delete') && <MenuSeparator className="mx-0.5" />}
          <MenuItem icon={<Icon icon={l.icon} size={14} />} danger={l.danger} trailing={l.kbd ? <Kbdish>{l.kbd}</Kbdish> : undefined} onClick={l.run}>{l.label}</MenuItem>
        </div>
      ))}
      {query && !showConvert && !showColor && shownLeaves.length === 0 && (
        <div className="px-2 py-1.5 text-meta font-medium text-ink-500">No actions</div>
      )}
      </PopoverContent>
    </Popover>
  );
}
function Kbdish({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-caption text-ink-500">{children}</span>;
}

// ── Uploads a page holds and no longer shows (2026-09-21) ────────────────────
// Until 2026-09-21 a reopened document dropped its uploads' references (lib/blocks.ts `uploadOf`), and its next save
// wrote the loss down. The files were never touched — each is an `attachments` row owned by the page — so every one
// can come back: an empty image or file block offers them, and one press puts one in. The person places them; the
// editor does not guess which empty block each belonged to.

/** A media block with nothing in it yet, of a type an upload can fill. */
const takesUpload = (b: Block): boolean => (b.type === 'image' || b.type === 'pdf' || b.type === 'file') && !b.src && !b.fileId;

/** What a block of this type can show: images for an image, PDFs for a PDF, anything but an image for a file. */
function uploadsFor(type: BlockType, files: readonly Attachment[] | undefined): Attachment[] {
  return (files ?? []).filter((f) => {
    const kind = attachmentKind(f.mime_type, f.filename);
    return type === 'image' ? kind === 'image' : type === 'pdf' ? kind === 'pdf' : kind !== 'image';
  });
}

/**
 * The page's uploads that nothing on it shows. Asked once per page, and only when some block could take one — an
 * ordinary document costs nothing. The editor's own placements are subtracted as they happen, so a file put back in
 * one block stops being offered in the others, and comes back if that block is deleted.
 */
function useUnplacedUploads(owner: AttachmentOwner | undefined, blocks: Block[]): Attachment[] {
  const pageId = owner && 'page_id' in owner ? owner.page_id : null;
  const wanted = !!pageId && blocks.some(takesUpload);
  const [got, setGot] = useState<{ pageId: string; files: Attachment[] } | null>(null);
  useEffect(() => {
    if (!wanted || !pageId || got?.pageId === pageId) return;
    let live = true;
    void unplacedPageUploads(pageId).then((files) => { if (live) setGot({ pageId, files }); });
    return () => { live = false; };
  }, [wanted, pageId, got?.pageId]);
  // Keyed by what is PLACED, not by the blocks: rows compare this by reference (BlockRow's memo), so it must keep its
  // identity while someone types and change only when a file is put in or taken out.
  const placed = blocks.map((b) => b.fileId ?? '').filter(Boolean).join(',');
  return useMemo(
    () => (got && got.pageId === pageId ? unplacedUploads(got.files, null, placed.split(',')) : []),
    [got, pageId, placed],
  );
}

/** Enough to recognise a lost picture at a glance; the rest are offered as these are placed. */
const MAX_UPLOAD_CHOICES = 12;

/**
 * The offer itself: images as themselves, any other file by its name. Draws nothing when there is nothing to offer.
 * Its name sits on a line of its own, so the choices wrap as one row at any width rather than around the words.
 */
function UploadChoices({ files, onPick }: { files: readonly Attachment[]; onPick: (f: Attachment) => void }) {
  const labelId = useId();
  if (!files.length) return null;
  return (
    <div role="group" aria-labelledby={labelId} className="mt-2">
      <div id={labelId} className="mb-1.5 text-caption text-ink-500">Uploaded to this doc</div>
      <div className="flex flex-wrap gap-1.5">
        {files.slice(0, MAX_UPLOAD_CHOICES).map((f) => <UploadChoice key={f.id} file={f} onPick={() => onPick(f)} />)}
      </div>
    </div>
  );
}

function UploadChoice({ file, onPick }: { file: Attachment; onPick: () => void }) {
  const image = attachmentKind(file.mime_type, file.filename) === 'image';
  // Minted per render and batched with every other URL asked for in the same moment (lib/use-attachment).
  const { url } = useAttachmentUrl(image ? file.id : null);
  const label = `Show ${file.filename} here`;
  if (!image) {
    return (
      <Button size="sm" variant="ghost" onClick={onPick} aria-label={label} className="max-w-64">
        <Icon icon={Paperclip} size={14} /><span className="truncate">{file.filename}</span>
      </Button>
    );
  }
  return (
    <Tooltip content={file.filename}>
      <button type="button" onClick={onPick} aria-label={label}
        className="focus-ring grid size-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-line bg-paper-3 p-0 text-ink-500 hover:border-line-strong">
        {url
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL for the person's own upload
          ? <img src={url} alt="" draggable={false} className="size-full object-cover" />
          : <Icon icon={Image} size={20} />}
      </button>
    </Tooltip>
  );
}

// ── Image block (Notion-style) ───────────────────────────────────────────────
// Empty → a quiet "Add an image" bar (click / drag-drop / paste). Set → the
// image at its stored width, with drag-to-resize side handles, a hover toolbar
// (Replace · Full width · Download), and an editable caption below.
function ImageBlock({ block: b, onImage, caption, attachTo, uploads }: {
  block: Block; onImage: (patch: Partial<Block>) => void; caption: (extra?: React.CSSProperties) => React.ReactNode;
  /** Where an uploaded image is stored (0033). Absent ⇒ the legacy inline path. */
  attachTo?: AttachmentOwner;
  /** The page's uploads nothing on it shows (`useUnplacedUploads`); its images are offered while this block is empty. */
  uploads?: readonly Attachment[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useAttachmentUpload(attachTo);
  // An uploaded image is an attachment id; the bucket is private, so the URL is
  // minted per render. `b.src` still renders anything stored inline before this
  // — documents written with data-URLs keep working untouched.
  const { url: storedUrl } = useAttachmentUrl(b.fileId);
  const src = b.fileId ? storedUrl : b.src;
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [w, setW] = useState<number | null>(null); // live width while dragging
  const [lightbox, setLightbox] = useState<{ srcs: string[]; index: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function intake(file: File) {
    setErr(null);
    try {
      // Downscale either way: a 12 MP phone photo is 4 MB of bytes nobody can
      // see at 1600px, and that cost is the same whether it lands in storage or
      // in the page JSON.
      if (attachTo) {
        const { blob, mime } = await downscaleImage(file, { max: 1600, quality: 0.85 });
        const named = new File([blob], reencodedName(file.name, mime), { type: mime });
        const saved = await upload(named);
        if (!saved) { setErr('Upload failed'); return; }
        // `src: undefined` so a replaced image cannot leave the old inline copy
        // behind it, silently winning the render.
        onImage({ fileId: saved.id, fileName: saved.filename, fileSize: saved.size_bytes ?? 0, src: undefined });
      } else {
        // No owner (an unsaved page, or a host with no record context): keep the
        // inline data-URL, which is exactly what this did before 0033.
        onImage({ src: await fileToDataUrl(file, { max: 1600, quality: 0.85 }) });
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
  }

  // Click the image → full-screen lightbox. Collect every image on the page at
  // open time so ←/→ can page through them (§8.11) without lifting state.
  function openLightbox() {
    if (!src) return;
    const srcs = Array.from(document.querySelectorAll<HTMLImageElement>('.img-block img'))
      .map((im) => im.getAttribute('src') || '').filter(Boolean);
    const index = Math.max(0, srcs.indexOf(src));
    setLightbox({ srcs: srcs.length ? srcs : [src], index });
  }

  // Drag a side handle to set width (% of the column, clamped 20–100).
  function startResize(side: 'l' | 'r', e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const wrap = wrapRef.current; if (!wrap) return;
    const full = wrap.clientWidth;
    const startX = e.clientX; const startW = b.width ?? 100;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) * (side === 'r' ? 1 : -1);
      setW(Math.max(20, Math.min(100, Math.round(startW + (dx / full) * 100))));
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      setW((cur) => { if (cur != null) onImage({ width: cur }); return null; });
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  if (!b.src && !b.fileId) {
    return (
      <div className="my-1">
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) intake(f); }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-3.5 py-3 text-left text-body text-ink-600 transition-colors duration-fast',
            dragOver ? 'bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent-border)]' : 'bg-paper-3',
          )}>
          <Icon icon={Image} size={20} className="shrink-0 text-ink-600" />
          <span>{busy ? 'Uploading…' : dragOver ? 'Drop image to upload' : 'Add an image'}</span>
        </button>
        <UploadChoices files={uploadsFor('image', uploads)}
          onPick={(f) => onImage({ fileId: f.id, fileName: f.filename, fileSize: f.size_bytes ?? 0, src: undefined })} />
        {err && <div role="alert" className="pt-1.5 text-caption text-danger-600">{err}</div>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) intake(f); e.target.value = ''; }} />
      </div>
    );
  }

  // A stored image whose short-lived URL has not been minted yet. Reserve the
  // frame instead of rendering a broken <img> — the swap is one paint, and an
  // empty box that becomes a picture reads far better than a torn-image glyph.
  if (b.fileId && !src) {
    return (
      <div className="my-1 flex h-24 items-center gap-2.5 rounded-md bg-paper-3 px-3.5 text-body text-ink-500">
        <Icon icon={Image} size={20} className="shrink-0" />
        <span>{b.fileName || 'Image'}</span>
      </div>
    );
  }

  const width = w ?? b.width ?? 100;
  const align = b.align ?? 'left';
  const alignItems = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <figure ref={wrapRef} className="img-block my-1 flex flex-col" style={{ alignItems }}>
      <div className="img-wrap group/img relative max-w-full overflow-hidden rounded-md leading-[0]" style={{ width: `${width}%`, userSelect: w != null ? 'none' : undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user image, data/blob/http URL */}
        <img src={src ?? undefined} alt={b.text || ''} draggable={false} onClick={openLightbox}
          className="block h-auto w-full" style={{ cursor: w != null ? 'ew-resize' : 'zoom-in' }} />
        {/* side resize handles */}
        {(['l', 'r'] as const).map((side) => (
          <span key={side} className="img-handle absolute rounded-full border border-paper-2 bg-[color-mix(in_srgb,var(--color-ink-900)_45%,transparent)] opacity-0 transition-opacity duration-fast group-hover/img:opacity-100 [cursor:ew-resize]" onMouseDown={(e) => startResize(side, e)}
            style={{ top: '50%', transform: 'translateY(-50%)', [side === 'l' ? 'left' : 'right']: 4, width: 6, height: 44, maxHeight: '60%' }} />
        ))}
        {/* hover toolbar */}
        <span className="img-tools absolute right-2 top-2 inline-flex gap-0.5 rounded-sm bg-paper-2 p-0.5 opacity-0 shadow-[0_0_0_1px_var(--color-line-soft),var(--shadow-sm)] transition-opacity duration-fast group-hover/img:opacity-100">
          {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, icon]) => (
            <ToolbarButton key={a} size="sm" active={align === a} onClick={() => onImage({ align: a })} title={`Align ${a}`} aria-label={`Align ${a}`}><Icon icon={icon} size={14} /></ToolbarButton>
          ))}
          <span aria-hidden className="mx-px my-0.5 w-px bg-line-soft" />
          <ToolbarButton size="sm" onClick={() => fileRef.current?.click()} title="Replace" aria-label="Replace image"><Icon icon={Image} size={14} /></ToolbarButton>
          <ToolbarButton size="sm" onClick={() => onImage({ width: width >= 100 ? 60 : 100 })} title="Toggle width" aria-label="Toggle width"><Icon icon={UnfoldHorizontal} size={14} /></ToolbarButton>
          <a href={src ?? undefined} download={(b.fileName || b.text || 'image')} title="Download" aria-label="Download image" onClick={(e) => e.stopPropagation()}
            className="zb-press grid size-[22px] place-items-center rounded-sm text-ink-600 no-underline transition-colors duration-fast hover:text-ink-900"><Icon icon={Download} size={14} /></a>
        </span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) intake(f); e.target.value = ''; }} />
      </div>
      <div className="max-w-full" style={{ width: `${width}%` }}>{caption({ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 0' })}</div>
      {lightbox && <Lightbox srcs={lightbox.srcs} index={lightbox.index} alt={b.text || ''} onClose={() => setLightbox(null)} />}
    </figure>
  );
}

// ── Lightbox (§8.11) — full-screen image viewer. The portal, the dark surface,
// the dialog role, Escape, backdrop-dismiss, the body scroll lock and the one
// z value all come from <FullScreenLayer>; this only owns what is actually
// specific to a viewer, which is ←/→ paging through the document's images.
function Lightbox({ srcs, index, alt, onClose }: { srcs: string[]; index: number; alt: string; onClose: () => void }) {
  const [i, setI] = useState(index);
  const many = srcs.length > 1;
  const step = (d: number) => setI((c) => (c + d + srcs.length) % srcs.length);
  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setI((c) => (c + (e.key === 'ArrowLeft' ? -1 : 1) + srcs.length) % srcs.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, srcs.length]);
  const src = srcs[i] ?? srcs[0];
  const navBtn = 'absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border-0 bg-[color-mix(in_srgb,var(--color-paper)_14%,transparent)] text-white [cursor:pointer]';
  return (
    <FullScreenLayer label="Image viewer" onClose={onClose} surface="dark" dismissOnBackdrop
      className="grid place-items-center p-12">
      <button onClick={onClose} aria-label="Close" title="Close (Esc)"
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-0 bg-[color-mix(in_srgb,var(--color-paper)_14%,transparent)] text-white [cursor:pointer]">
        <Icon icon={X} size={20} />
      </button>
      {many && (
        <>
          <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous image" className={cn(navBtn, 'left-4')}><Icon icon={ChevronLeft} size={20} /></button>
          <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next image" className={cn(navBtn, 'right-4')}><Icon icon={ChevronRight} size={20} /></button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-caption text-white/80">{i + 1} / {srcs.length}</span>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- user image, data/blob/http URL */}
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain shadow-lg" />
    </FullScreenLayer>
  );
}

// ── URL-based media blocks (bookmark · embed · video · audio · pdf · file) ───
// Empty → a "paste a link" bar with type-specific copy. Filled →
//   bookmark → clickable link-preview card
//   embed / video (YouTube/Vimeo) → responsive 16:9 iframe
//   video (direct link) → native <video> player
//   audio → native <audio> player
//   pdf → tall inline viewer
//   file → attachment row with a download affordance
function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  try { new URL(url); return url; } catch { return null; }
}
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`;
    return url;
  } catch { return url; }
}
function urlFilename(url: string): string {
  try {
    const u = new URL(url);
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
    return seg || u.hostname.replace(/^www\./, '');
  } catch { return url; }
}
const LINK_INTAKE: Partial<Record<BlockType, { icon: IconType; placeholder: string; action: string }>> = {
  bookmark: { icon: Globe, placeholder: 'Paste a link to bookmark', action: 'Create' },
  embed: { icon: CodeXml, placeholder: 'Paste a link to embed (YouTube, Figma…)', action: 'Embed' },
  video: { icon: Video, placeholder: 'Paste a video link (YouTube, Vimeo, .mp4)', action: 'Embed video' },
  audio: { icon: Volume2, placeholder: 'Paste an audio link (.mp3, .m4a…)', action: 'Embed audio' },
  pdf: { icon: FileText, placeholder: 'Paste a link to a PDF', action: 'Embed PDF' },
  file: { icon: Paperclip, placeholder: 'Paste a link to a file', action: 'Attach' },
};
function LinkBlock({ block: b, onSubmit, onClear, onAttach, attachTo, uploads, note }: {
  block: Block; onSubmit: (url: string) => void; onClear: () => void;
  /** The page's uploads nothing on it shows; a PDF or file block offers the ones it can show while empty. */
  uploads?: readonly Attachment[];
  /** Record an uploaded file on the block. */
  onAttach: (patch: { fileId: string; fileName: string; fileSize: number }) => void;
  /** What the file hangs off. Absent ⇒ upload is hidden and only links work. */
  attachTo?: AttachmentOwner;
  /**
   * The block's own editable text — YOUR note about this link.
   *
   * The card already shows a description, but it is SCRAPED from the page, and
   * for the links people actually paste that is worthless: a Drive folder says
   * "Sign in to continue", a Figma file says "Figma", a private Notion page
   * says nothing at all. What an agency needs to record is why this link
   * matters — "Final homepage designs, approved 12 Aug" — and there was
   * nowhere to put it.
   *
   * It is the same render-prop `ImageBlock` already takes for its caption, and
   * the same `block.text` field, so this needed no schema and no migration:
   * every block has carried `text` all along.
   */
  note?: (extra?: React.CSSProperties) => React.ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error: upErr } = useAttachmentUpload(attachTo);
  // Only the two block types that mean "a file lives here" offer an upload;
  // video/audio/embed/bookmark are about linking something already on the web.
  const uploadable = !!attachTo && (b.type === 'file' || b.type === 'pdf');
  const onUpload = async (f: File) => {
    const a = await upload(f);
    if (a) onAttach({ fileId: a.id, fileName: a.filename, fileSize: a.size_bytes ?? 0 });
  };
  const intake = LINK_INTAKE[b.type] ?? LINK_INTAKE.bookmark!;
  const submit = () => { const u = normalizeUrl(draft); if (u) onSubmit(u); };
  // An uploaded file is stored as an id; the private bucket only hands out
  // short-lived signatures, so the URL is minted here on render.
  const { url: signedUrl } = useAttachmentUrl(b.fileId);
  const src = b.fileId ? signedUrl : b.src;

  if (!b.src && !b.fileId) {
    return (
      <div className="my-1">
        {/* Wraps rather than squeezes: at a phone's width the field kept two characters ("Pa") beside its buttons. */}
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-paper-3 px-3 py-2.5">
          <Icon icon={intake.icon} size={20} className="shrink-0 text-ink-600" />
          <input data-chromeless autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') setDraft(''); }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={intake.placeholder}
            autoComplete="off" data-1p-ignore data-lpignore="true"
            className="min-w-40 flex-1 border-0 bg-transparent text-body text-ink-900 outline-none" />
          {/* Upload sits BESIDE the link field rather than replacing it: linking
              a file you host elsewhere is still legitimate, and a picker that
              swallowed the paste box would remove an ability people had. */}
          {uploadable && (
            <>
              <input ref={fileRef} type="file" hidden aria-hidden tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); e.target.value = ''; }} />
              <Button size="sm" loading={busy} onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click(); }} className="whitespace-nowrap">
                Upload
              </Button>
            </>
          )}
          <Button size="sm" variant="primary" disabled={!draft.trim()} onMouseDown={(e) => { e.preventDefault(); submit(); }} className="whitespace-nowrap">
            {intake.action}
          </Button>
        </div>
        {uploadable && (
          <UploadChoices files={uploadsFor(b.type, uploads)}
            onPick={(f) => onAttach({ fileId: f.id, fileName: f.filename, fileSize: f.size_bytes ?? 0 })} />
        )}
        {upErr && <div className="mt-1 px-1 text-caption text-danger-600">{upErr}</div>}
      </div>
    );
  }

  // An uploaded file whose signature has not landed yet — show the name we
  // already know rather than an empty frame that looks broken.
  if (b.fileId && !src) {
    return (
      <div className="my-1 flex items-center gap-2.5 rounded-md border border-line bg-paper-2 px-3 py-2">
        <Icon icon={Paperclip} size={16} className="shrink-0 text-ink-600" />
        <span className="min-w-0 flex-1 truncate text-body text-ink-600">{b.fileName || 'Attachment'}</span>
        <span className="text-caption text-ink-500">Opening…</span>
      </div>
    );
  }
  // Hover toolbar shared by the framed media types.
  const tools = (
    <span className="embed-tools absolute right-2 top-2 inline-flex gap-0.5 rounded-sm bg-paper-2 p-0.5 opacity-0 shadow-[0_0_0_1px_var(--color-line-soft),var(--shadow-sm)] transition-opacity duration-fast group-hover/embed:opacity-100">
      <a href={safeHref(src) ?? undefined} target="_blank" rel="noreferrer" title="Open" aria-label="Open in new tab" onClick={(e) => e.stopPropagation()}
        className="zb-press grid size-[22px] place-items-center rounded-sm text-ink-600 no-underline transition-colors duration-fast hover:text-ink-900"><Icon icon={ExternalLink} size={14} /></a>
      <ToolbarButton size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Remove" aria-label="Remove"><Icon icon={X} size={14} /></ToolbarButton>
    </span>
  );
  const directVideo = b.type === 'video' && toEmbedUrl(src!) === b.src;
  if (b.type === 'embed' || (b.type === 'video' && !directVideo)) {
    return (
      <div className="embed-block group/embed relative my-1">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-paper-3">
          {/* SANDBOXED, and the src is validated. An embed is a whole page some
              stranger wrote, running unprompted inside ours — and ours is often
              a client portal. `EMBED_SANDBOX` withholds top-level navigation, so
              an embed can no longer replace the tab with a lookalike. */}
          <iframe src={safeEmbedSrc(toEmbedUrl(src!)) ?? 'about:blank'} sandbox={EMBED_SANDBOX} referrerPolicy="no-referrer" title={b.type === 'video' ? 'Video' : 'Embed'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
        </div>
        {tools}
      </div>
    );
  }
  if (directVideo) {
    return (
      <div className="embed-block group/embed relative my-1">
        <video src={src!} controls playsInline className="block w-full rounded-md border border-line bg-paper-3" />
        {tools}
      </div>
    );
  }
  if (b.type === 'audio') {
    return (
      <div className="embed-block group/embed relative my-1 rounded-md border border-line bg-paper-3 px-2.5 py-2">
        <audio src={src!} controls className="block w-full" />
        {tools}
      </div>
    );
  }
  if (b.type === 'pdf') {
    return (
      <div className="embed-block group/embed relative my-1">
        <iframe src={safeEmbedSrc(src!) ?? 'about:blank'} sandbox={EMBED_SANDBOX} referrerPolicy="no-referrer" title="PDF" loading="lazy" className="block w-full rounded-md border border-line bg-paper-3" style={{ height: 480 }} />
        {tools}
      </div>
    );
  }
  if (b.type === 'file') {
    return (
      <div className="embed-block group/embed doc-proprow relative my-1">
        <a href={safeHref(src) ?? undefined} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}
          className="bookmark-card flex items-center gap-2.5 rounded-md border border-line bg-paper-2 px-3 py-2 no-underline transition-colors duration-fast hover:wash-over">
          <Icon icon={Paperclip} size={16} className="shrink-0 text-ink-600" />
          <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-800">{(b.fileName || urlFilename(src!))}</span>
          <Icon icon={Download} size={16} className="shrink-0 text-ink-500" />
        </a>
        {tools}
      </div>
    );
  }
  // bookmark — see BookmarkCard: it needs the page's own metadata, which means a
  // hook, which means its own component. The note sits BELOW the card and not
  // inside it, because the card is an <a> and a textarea inside an anchor is
  // invalid HTML that swallows its own clicks.
  return (
    <div className="my-1">
      <BookmarkCard url={src!} note={b.text?.trim() || undefined} />
      {note?.({ marginTop: 6 })}
    </div>
  );
}

// A bookmark is a PREVIEW of a page, not a bordered link. This used to render the
// hostname and the raw URL twice over — everything the plain link already said —
// because nothing ever fetched the page's title. Now: title, description, the
// site's favicon and name, and the og:image as a thumbnail.
//
// Every part is optional. A site that blocks us, serves no Open Graph tags, or
// simply has no image still gets a clean card built from what did arrive, down to
// just the hostname — which is exactly the old card, so this can only improve.
function BookmarkCard({ url, note }: { url: string; note?: string }) {
  // The card itself is the DS `LinkCard` (Content's library reads links too); the
  // editor brings the metadata and keeps a click on the card from selecting the
  // block underneath it.
  const meta = useLinkMeta(url);
  return <LinkCard url={url} meta={meta} note={note} className="my-1" onMouseDown={(e) => e.stopPropagation()} />;
}

// Editable table block — unchanged behavior: header + body, add/remove, sort.
function TableBlock({ rows, onChange }: { rows: string[][]; onChange: (rows: string[][]) => void }) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const cols = rows[0]?.length ?? 0;
  const head = rows[0] ?? [];
  const body = rows.slice(1);

  const setCell = (r: number, c: number, v: string) => onChange(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  const addRow = () => onChange([...rows, Array.from({ length: cols }, () => '')]);
  const addCol = () => onChange(rows.map((row, ri) => [...row, ri === 0 ? `Column ${cols + 1}` : '']));
  const removeRow = (r: number) => { if (body.length <= 1) return; onChange(rows.filter((_, ri) => ri !== r)); };
  const removeCol = (c: number) => { if (cols <= 1) return; onChange(rows.map((row) => row.filter((_, ci) => ci !== c))); };
  const sortByCol = (c: number) => {
    const dir: 1 | -1 = sort && sort.col === c && sort.dir === 1 ? -1 : 1;
    const sorted = [...body].sort((a, b) => (a[c] ?? '').localeCompare(b[c] ?? '', undefined, { numeric: true, sensitivity: 'base' }) * dir);
    setSort({ col: c, dir });
    onChange([head, ...sorted]);
  };

  const cellInput = (header?: boolean) => cn(
    'w-full border-0 bg-transparent px-2.5 py-2 text-meta text-ink-900 outline-none',
    header ? 'font-semibold' : 'font-normal',
  );

  return (
    <div className="tbl relative my-1 inline-block max-w-full overflow-x-auto rounded-md border border-line">
      <table className="w-auto border-collapse">
        <thead>
          <tr>
            {head.map((cell, c) => (
              <th key={c} className={cn('group relative min-w-[120px] border-b border-line bg-paper-3 text-left', c < cols - 1 && 'border-r border-line-soft')}>
                <div className="flex items-center">
                  <input value={cell} onChange={(e) => setCell(0, c, e.target.value)} placeholder={`Column ${c + 1}`} aria-label={`Column ${c + 1} header`} className={cellInput(true)} autoComplete="off" data-1p-ignore data-lpignore="true" />
                  <span className="flex gap-px pr-1 opacity-0 transition-opacity duration-fast group-hover:opacity-70">
                    <button onClick={() => sortByCol(c)} title="Sort column" className={CTL_BTN}><Icon icon={ArrowDownUp} size={12} /></button>
                    {cols > 1 && <button onClick={() => removeCol(c)} title="Delete column" className={CTL_BTN}><Icon icon={X} size={12} /></button>}
                  </span>
                </div>
              </th>
            ))}
            <th className="w-[34px] border-b border-line bg-paper-3">
              <button onClick={addCol} title="Add column" className={cn(CTL_BTN, 'mx-auto size-[26px]')}><Icon icon={Plus} size={14} /></button>
            </th>
          </tr>
        </thead>
        <tbody>
          {body.map((row, bi) => {
            const r = bi + 1;
            return (
              <tr key={r} className="tbl-tr group">
                {row.map((cell, c) => (
                  <td key={c} className={cn('min-w-[120px]', r < rows.length - 1 && 'border-b border-line-soft', c < cols - 1 && 'border-r border-line-soft')}>
                    <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} placeholder="–" className={cellInput()} autoComplete="off" data-1p-ignore data-lpignore="true" />
                  </td>
                ))}
                <td className="w-[34px] text-center">
                  {body.length > 1 && <button onClick={() => removeRow(r)} title="Delete row" className={cn(CTL_BTN, 'opacity-0 transition-opacity duration-fast group-hover:opacity-70')}><Icon icon={X} size={12} /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button onClick={addRow} title="Add row" className="flex w-full cursor-pointer items-center gap-1.5 border-0 border-t border-line-soft bg-transparent px-2.5 py-1.5 text-left text-caption text-ink-600">
        <Icon icon={Plus} size={14} /> Row
      </button>
    </div>
  );
}
const CTL_BTN = 'grid size-5 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-600';

// §6.5 drop indicator: the DS drop line at the target gap, inset to the nest level.
// Position is precomputed (container-relative top/left) by the drag's rAF loop, so
// this renders from plain numbers — no DOM reads during render.
function DropIndicator({ top, left }: { top: number; left: number }) {
  return <DropLine style={{ left, right: 0, top }} />;
}

// Drag preview under the cursor — the DS ghost, with a count for group moves.
function BlockDragGhost({ block, count }: { block: Block; count: number }) {
  return (
    <DragGhost icon={<Icon icon={GripVertical} size={14} />} count={{ n: count, noun: 'blocks' }}
      label={block.type === 'divider' ? ', divider, ' : (block.text || 'Empty block')} />
  );
}

type SlashResults = SlashEntry[];

// The "Paste as" chooser. Deliberately tiny: four words, no icons, no search —
// it appears unbidden right after a paste, so it has to be readable in the
// quarter-second before you decide to ignore it. Escape or clicking away leaves
// the plain link you already have.
function PasteAsMenu({ options, pick, dismiss }: {
  options: { value: PasteAs; label: string }[]; pick: (c: PasteAs) => void; dismiss: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
    // A click anywhere else means "I'm done with this" — including back in the text.
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest('.paste-as-menu')) dismiss(); };
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', down);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('mousedown', down); };
  }, [dismiss]);

  return (
    // preventDefault on mousedown keeps the caret in the block, the way the slash
    // menu does — the editor never loses focus to its own chrome.
    <MenuPanel onMouseDown={(e) => e.preventDefault()}
      className="paste-as-menu absolute z-50 mt-1 w-[188px] origin-top-left">
      <MenuLabel>Paste as</MenuLabel>
      {options.map((o) => (
        <MenuItem key={o.value} onClick={() => pick(o.value)}>{o.label}</MenuItem>
      ))}
    </MenuPanel>
  );
}

// The slash menu — Notion's, by the user's request ("same to same"): a fixed-size
// panel of compact rows under section headings, each row a glyph, a name and the
// markdown that makes the block as you type; a preview card beside the
// highlighted row; "Close menu · esc" pinned at the foot. It draws EXACTLY the
// list `slashMenu` returns and the highlight is an index into it, so the row you
// see highlighted is the row Enter inserts (the menu used to regroup its rows for
// display, and Enter on "Table view" inserted Line items).
const SLASH_INSET = 14;           // panel edge → row text, so the text lines up with the "/"
const SLASH_PREVIEW_OVERLAP = 12; // the preview tucks over the panel's edge, as Notion's does
function SlashMenu({ results, active, pick, hover, close }: {
  results: SlashResults; active: number;
  pick: (m: SlashItem) => void; hover: (index: number) => void; close: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ top: number; side: 'right' | 'left' } | null>(null);
  const item = results[active];

  // Hang the preview beside the highlighted row: centred on it, kept inside the
  // viewport, and moved to the left when the right has no room.
  const place = () => {
    const panel = panelRef.current, row = rowRef.current, card = previewRef.current;
    if (!panel || !row || !card) return;
    const p = panel.getBoundingClientRect(), r = row.getBoundingClientRect(), h = card.offsetHeight, w = card.offsetWidth;
    const centre = r.top + r.height / 2;
    const top = Math.max(8, Math.min(centre - h / 2, window.innerHeight - h - 8)) - p.top;
    const side = p.right - SLASH_PREVIEW_OVERLAP + w > window.innerWidth - 8 ? 'left' : 'right';
    setPreview((cur) => (cur && cur.top === top && cur.side === side ? cur : { top, side }));
  };

  // ↑↓ walk a list taller than the panel, so the highlight is kept in view — by
  // moving the LIST, never the page behind it.
  useLayoutEffect(() => {
    const list = listRef.current, row = rowRef.current;
    if (list && row) {
      const top = row.offsetTop, bottom = top + row.offsetHeight;
      if (top < list.scrollTop + 4) list.scrollTop = Math.max(0, top - 4);
      else if (bottom > list.scrollTop + list.clientHeight - 4) list.scrollTop = bottom - list.clientHeight + 4;
    }
    place();
  });

  return (
    // onMouseDown preventDefault keeps the block focused (Notion: the editor
    // never loses focus) — clicks and scrollbar drags don't blur it.
    <div ref={panelRef} onMouseDown={(e) => e.preventDefault()}
      className={cn(MENU_PANEL_CLASS, 'relative w-[324px] p-0')}>
      <div ref={listRef} role="listbox" aria-label="Insert a block" onScroll={place}
        className="max-h-[max(132px,min(388px,calc(var(--caret-room,440px)-50px)))] overflow-y-auto overscroll-contain px-1 pb-1">
        {results.length === 0 && <p className="px-2.5 pb-2 pt-3 text-ui text-ink-500">No results</p>}
        {results.map((m, i) => {
          const on = i === active;
          const heading = m.section !== results[i - 1]?.section;
          // Where no heading names the entry's group, the row does (Notion's "· Database").
          const showGroup = m.section === 'Recent' || m.section === FILTERED_SECTION;
          return (
            <Fragment key={m.section + ':' + menuKey(m)}>
              {heading && i > 0 && <div className="mx-2.5 my-1 h-px bg-line-soft" />}
              {heading && <MenuLabel className="pt-2.5">{m.section}</MenuLabel>}
              <button
                type="button" role="option" aria-selected={on} data-highlighted={on ? '' : undefined}
                ref={on ? rowRef : undefined}
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                onMouseMove={() => hover(i)}
                className="group/item flex h-8 w-full cursor-pointer select-none items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left text-ui text-ink-800 outline-none transition-colors duration-fast data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink-900"
              >
                <span className="grid size-5 shrink-0 place-items-center text-ink-600 group-data-[highlighted]/item:text-ink-800">
                  <Icon icon={m.db ? DB_MENU_ICON[m.db] : m.page === 'collection' ? Images : BLOCK_ICON[m.type]} size={20} />
                </span>
                <span className="min-w-0 truncate">{m.label}</span>
                {showGroup && <span className="shrink-0 truncate text-ink-500">· {m.group}</span>}
                {m.shortcut && <span className="ml-auto shrink-0 pl-2 text-meta text-ink-500">{m.shortcut}</span>}
              </button>
            </Fragment>
          );
        })}
      </div>
      <div className="border-t border-line-soft p-1">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); close(); }}
          className="flex h-8 w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2.5 text-left text-ui text-ink-800 outline-none transition-colors duration-fast hover:bg-surface-hover">
          <span className="flex-1">Close menu</span>
          <span className="text-meta text-ink-500">esc</span>
        </button>
      </div>
      {item && (
        <div
          ref={previewRef}
          aria-hidden
          className="pointer-events-none absolute max-sm:hidden"
          style={{
            top: preview?.top ?? 0,
            ...(preview?.side === 'left'
              ? { right: `calc(100% - ${SLASH_PREVIEW_OVERLAP}px)` }
              : { left: `calc(100% - ${SLASH_PREVIEW_OVERLAP}px)` }),
            visibility: preview ? 'visible' : 'hidden',
          }}
        >
          <SlashPreview item={item} />
        </div>
      )}
    </div>
  );
}

// §8.8 callout icon: click the emoji to pick a new one from a compact grid.
const CALLOUT_EMOJI = ['💡', '📌', '⚠️', '✅', '❗', '🔥', '⭐', '📝', '🎯', '🚀', '❤️', '🔒', '💬', '📖', '🧠', '🎉'];
function CalloutIcon({ icon, onPick }: { icon?: string; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} aria-label="Change callout icon" className="zb-press cursor-pointer border-0 bg-transparent p-0 text-[16px] leading-none">
        {icon || '💡'}
      </button>
      {open && (
        <div className={cn(OVERLAY_CLASS, 'absolute left-0 top-[calc(100%+4px)] z-dropdown grid gap-0.5 p-1 origin-top-left zb-enter [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]')} style={{ gridTemplateColumns: 'repeat(8, 26px)' }}>
          {CALLOUT_EMOJI.map((e) => (
            <button key={e} onClick={() => { onPick(e); setOpen(false); }}
              className={cn('zb-press grid size-[26px] cursor-pointer place-items-center rounded-xs border-0 text-[15px]', e === (icon || '💡') ? 'bg-surface-hover' : 'bg-transparent')}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function placeholderFor(type: BlockType): string {
  if (type === 'h1') return 'Heading 1';
  if (type === 'h2') return 'Heading 2';
  if (type === 'h3') return 'Heading 3';
  if (type === 'quote') return 'Quote';
  if (type === 'callout') return 'Callout';
  if (type === 'code') return 'Code';
  if (type === 'toggle') return 'Toggle';
  if (type === 'bullet' || type === 'numbered') return 'List item';
  if (type === 'todo') return 'To-do';
  if (type === 'image') return 'Write a caption…';
  // One canonical placeholder for paragraphs, everywhere (index-independent).
  return 'Write something, or press “/” for commands…';
}
