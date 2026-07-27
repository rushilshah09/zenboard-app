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
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Plus, GripVertical, X, ArrowDownUp, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Table, Quote, Lightbulb, Code, Minus, ChevronRight, ChevronLeft, Copy as CopyIcon, Trash2, ArrowUp, ArrowDown, ArrowLeftRight, Image, UnfoldHorizontal, Download, Bookmark, Globe, CodeXml, ExternalLink, Video, Volume2, FileText, Paperclip, Palette as PaletteIcon, AlignLeft, AlignCenter, AlignRight, Database as DatabaseIcon, type IconType } from "@/components/ds/icons";
import { Icon, Checkbox, Button, ToolbarButton, MenuPanel, MenuItem, MenuLabel, MenuSeparator, MenuGlyph } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import {
  type Block, type BlockType, type BlockMenuItem, LIST_TYPES, NESTABLE_TYPES, MEDIA_TYPES, genId, emptyBlock,
  markdownPrefix, BLOCK_MENU, emptyTableRows, sectionEnd, hiddenIds, blocksToText,
  computeDrop, type DropTargetCalc,
} from '@/lib/blocks';
import { cutAt, concatRich, removeRange, insertSpan, type RichSpan } from '@/lib/rich';
import { RichText, RichTextStyles, textareaHandle, type SurfaceHandle, type KeyLike, type TurnIntoOption } from '@/components/documents/rich-text';
import { createCollection } from '@/lib/actions/collections';
import { InlineCollection } from '@/components/documents/database-view';
import { htmlToBlocks, textToBlocks, copyBlocks, blocksFromHtml } from '@/lib/clipboard';
import { fileToDataUrl } from '@/lib/image';
import { PALETTE_NAMES } from '@/lib/palette';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  DragOverlay, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, type SortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const BLOCK_ICON: Record<BlockType, IconType> = {
  text: Type, h1: Heading1, h2: Heading2, h3: Heading3, bullet: List, numbered: ListOrdered,
  todo: ListChecks, table: Table, quote: Quote, callout: Lightbulb, code: Code, divider: Minus,
  toggle: ChevronRight, image: Image, bookmark: Bookmark, embed: CodeXml, collection: DatabaseIcon,
  video: Video, audio: Volume2, pdf: FileText, file: Paperclip,
};
const CODE_LANGS = ['text', 'ts', 'js', 'tsx', 'json', 'html', 'css', 'sql', 'bash', 'python', 'go', 'rust'];
// §7.3 toolbar turn-into — the same convertible set as the block menu's
// "Convert into" (text-carrying types only), hoisted so rows stay memoizable.
const TURN_INTO: TurnIntoOption[] = BLOCK_MENU
  .filter((m) => !m.db && m.type !== 'table' && m.type !== 'divider' && m.type !== 'collection' && !MEDIA_TYPES.includes(m.type))
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
type SlashItem = { type: BlockType; db?: BlockMenuItem['db'] };

export function BlockEditor({ blocks, onChange, onCreateDatabasePage, onExpandCollection }: {
  blocks: Block[]; onChange: (b: Block[]) => void;
  // Host hook for "Database — Full page" — creates + opens a database page.
  // Hosts without page context (drawers) omit it; the entry falls back inline.
  onCreateDatabasePage?: () => void;
  // Host hook for "Turn into page" on an inline database: attach the
  // collection to a new database page and open it. The inline block stays as
  // a linked view of the now-page-owned database (Notion's replacement).
  onExpandCollection?: (colId: string) => void;
}) {
  // Caret surfaces by block id — the active rich block's PM handle, or a
  // code block's wrapped <textarea>. Static (unfocused) rich blocks are null.
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
    // Slash menu (Notion behavior): a '/' at the start of the block or right
    // after whitespace opens the menu at the caret — anywhere in the text
    // ("Hello /img" works). The query is what follows the '/'. Whitespace
    // immediately after the '/' or deleting the '/' closes it instantly.
    if (b.type !== 'image') {
      const upto = value.slice(0, caret);
      const si = upto.lastIndexOf('/');
      const q = si >= 0 ? upto.slice(si + 1) : '';
      if (si >= 0 && (si === 0 || /\s/.test(upto[si - 1])) && !/^\s/.test(q) && !q.includes('\n')) {
        setSlash({ id, at: si, query: q, active: 0 });
      } else if (slash?.id === id) setSlash(null);
    } else if (slash?.id === id) setSlash(null);
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
    setSlash(null);
    rememberRecent(type);
    const i = idx(id); if (i < 0) return;
    if (type === 'divider' || type === 'table' || MEDIA_TYPES.includes(type)) {
      const block: Block = type === 'table'
        ? { id: blocks[i].id, type: 'table', text: '', rows: emptyTableRows() }
        : { id: blocks[i].id, type, text: '' };
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
  // create + open a database page; view kinds create a standalone collection
  // and mount it as an inline block. The block shows a "Creating database…"
  // shell (colId 'pending') until the server id lands — or 'error:<msg>'.
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
    const nb: Block = { id: targetId, type: 'collection', text: '', colId: db === 'linked' ? 'picker' : 'pending' };
    if (rest.text.trim() === '') {
      const after = emptyBlock();
      commit([...bs.slice(0, i), nb, after, ...bs.slice(i + 1)], { id: after.id, pos: 0 });
    } else {
      commit([...bs.slice(0, i), { ...b, ...rest }, nb, ...bs.slice(i + 1)]);
    }
    if (db === 'linked') return;
    const kind = db === 'board' || db === 'gallery' || db === 'list' ? db : 'table';
    createCollection(kind)
      .then((res) => onChange(blocksRef.current.map((x) => (x.id === targetId ? { ...x, colId: 'id' in res ? res.id : 'error:' + res.error } : x))))
      .catch((e: unknown) => onChange(blocksRef.current.map((x) => (x.id === targetId ? { ...x, colId: 'error:' + (e instanceof Error ? e.message : 'Could not create database.') } : x))));
  }

  // Slash pick (Notion): strip "/query" from the text and keep the rest.
  // Empty remainder → convert/replace in place (same as applyType). Otherwise:
  // turn-into types convert this block; leaf/media types insert right below.
  function pickSlash(id: string, item: SlashItem) {
    const { type } = item;
    const s = slash;
    if (!s || s.id !== id) {
      if (type === 'collection') { rememberRecent(type); insertCollection(id, undefined, item.db); return; }
      applyType(id, type, '');
      return;
    }
    setSlash(null);
    rememberRecent(type);
    const blocks = blocksRef.current;
    const i = idx(id); if (i < 0) return;
    const b = blocks[i];
    const stripped = removeRange(b, s.at, s.at + 1 + s.query.length);
    if (type === 'collection') { insertCollection(id, stripped, item.db); return; }
    if (type === 'divider' || type === 'table' || MEDIA_TYPES.includes(type)) {
      const nb: Block = type === 'table' ? { id: genId(), type, text: '', rows: emptyTableRows() } : { id: genId(), type, text: '' };
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
  function selectOnly(id: string) { anchorRef.current = id; setSel(new Set(spanIds(id))); setSlash(null); refs.current[id]?.blur(); }
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
      setSlash(null); setMenuFor(null);
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

  // ── slash menu (with recently-used) ──
  function recentTypes(): BlockType[] {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as BlockType[]).filter((t) => BLOCK_MENU.some((m) => m.type === t)); } catch { return []; }
  }
  function rememberRecent(t: BlockType) {
    try {
      const next = [t, ...recentTypes().filter((x) => x !== t)].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  function slashResults(q: string) {
    const s = q.toLowerCase().trim();
    if (s) return BLOCK_MENU.filter((m) => (m.label + ' ' + m.keywords).toLowerCase().includes(s)).map((m) => ({ ...m, group: m.group as string }));
    const rec = recentTypes();
    const recent = rec.map((t) => BLOCK_MENU.find((m) => m.type === t)!).filter(Boolean).map((m) => ({ ...m, group: 'Recent' as string }));
    return [...recent, ...BLOCK_MENU.map((m) => ({ ...m, group: m.group as string }))];
  }

  // Shared key handler for both caret surfaces (PM-hosted rich blocks and the
  // code-block textarea). Returns true when consumed — the PM host uses that
  // to stop the event; the textarea path relies on preventDefault alone.
  function onKeyDown(e: KeyLike, b: Block, el: SurfaceHandle): boolean | void {
    const blocks = blocksRef.current;
    const mod = e.metaKey || e.ctrlKey;
    if (slash?.id === b.id) {
      const res = slashResults(slash.query);
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlash({ ...slash, active: Math.min(Math.max(res.length - 1, 0), slash.active + 1) }); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlash({ ...slash, active: Math.max(0, slash.active - 1) }); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const pick = res[slash.active]; if (pick) pickSlash(b.id, pick); return true; }
      if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return true; }
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
      fileToDataUrl(imgFile, { max: 1600, quality: 0.85 }).then((src) => setImage(img.id, { src })).catch(() => {});
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
    setSlash(null); setMenuFor(null);
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
    <DndContext id="doc-blocks" sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => { movingRef.current = []; endDrag(); }}>
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
                onBlurText={() => { setFocusedId((cur) => (cur === b.id ? null : cur)); setSlash((cur) => (cur?.id === b.id ? null : cur)); }}
                onToggleTodo={() => toggleTodo(b.id)} onToggleCollapse={() => toggleCollapse(b.id)}
                onAddToggleChild={() => addToggleChild(b.id)}
                onSetLang={(l) => setLang(b.id, l)} onTableChange={(rows) => setRows(b.id, rows)}
                onImage={(patch) => setImage(b.id, patch)}
                onExpandDb={expand}
                onAddAfter={(above) => insertMenu(b.id, above)}
                onRowMouseDown={(e) => {
                  if (e.metaKey || e.ctrlKey) { e.preventDefault(); toggleSelect(b.id); }
                  else if (e.shiftKey && (selRef.current.size || anchorRef.current)) { e.preventDefault(); rangeSelect(b.id); }
                  else if (selRef.current.size) setSel(new Set());
                }}
                menu={menuFor === b.id}
                onOpenMenu={() => { setMenuFor(menuFor === b.id ? null : b.id); setSlash(null); }}
                onCloseMenu={() => setMenuFor(null)}
                menuActions={{
                  convert: (t) => convertTo(b.id, t),
                  setColor: (c) => { setMenuFor(null); setColor(b.id, c); },
                  duplicate: () => { setMenuFor(null); duplicateIds(spanIds(b.id)); },
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
                slash={slash?.id === b.id ? { query: slash.query, active: slash.active, results: slashResults(slash.query), pick: (m) => pickSlash(b.id, m) } : null}
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
      <DragOverlay>{activeBlock ? <DragGhost block={activeBlock} count={dragCount} /> : null}</DragOverlay>
    </DndContext>
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
  h1: { fontSize: 30, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.006em', marginTop: 18 },
  h2: { fontSize: 20, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em', marginTop: 12 },
  h3: { fontSize: 16, fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.01em', marginTop: 6 },
  bullet: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' }, numbered: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' }, todo: { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  quote: { fontSize: 16, fontStyle: 'italic', color: 'var(--color-ink-800)', lineHeight: 1.5 },
  callout: { fontSize: 16, lineHeight: 1.5 }, code: { fontSize: 14, fontFamily: 'var(--font-mono)' }, divider: {}, table: {},
  image: {}, bookmark: {}, embed: {}, video: {}, audio: {}, pdf: {}, file: {}, collection: {},
  toggle: { fontSize: 16, fontWeight: 500, lineHeight: 1.5 },
};

type MenuActions = {
  convert: (t: BlockType) => void; setColor: (c: string | null) => void; duplicate: () => void; copyText: () => void;
  select: () => void; moveUp: () => void; moveDown: () => void; remove: () => void;
  expandPage?: () => void; // inline database → full-page database
};

// Rows are memoized on their data props only — callback identity is ignored,
// which is safe because every editor handler reads live state through refs
// (blocksRef/selRef), never through render-time closures.
type ActiveSel = { anchor: number; head: number; epoch: number } | null;
const activeEq = (a: ActiveSel, b: ActiveSel) =>
  a === b || (!!a && !!b && a.anchor === b.anchor && a.head === b.head && a.epoch === b.epoch);

const BlockRow = memo(function BlockRow({
  block: b, number, selected, focused, dimmed, hasChildren, findShadow, active, inputRef, onRich, onConvertInline, onTurnInto, onCodeText, onKey, onPasteShared, onActivate, onFocusText, onBlurText,
  onToggleTodo, onToggleCollapse, onAddToggleChild, onSetLang, onTableChange, onImage, onExpandDb, slash, onAddAfter,
  onRowMouseDown, menu, onOpenMenu, onCloseMenu, menuActions,
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
  onExpandDb?: () => void;
  onAddAfter: (above: boolean) => void; onRowMouseDown: (e: React.MouseEvent) => void;
  menu: boolean; onOpenMenu: () => void; onCloseMenu: () => void; menuActions: MenuActions;
  slash: { query: string; active: number; results: SlashResults; pick: (m: SlashItem) => void } | null;
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
        value={b.text} rows={1} placeholder={ph} wrap={b.wrap ? 'soft' : 'off'}
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
        style={{ ...baseRich, ...TYPE_STYLE[b.type], ...tint, ...extra }}
        onRich={onRich} onConvertInline={onConvertInline} onKey={onKey} onPasteEvent={(e, el) => onPasteShared(e, el)}
        turnIntoOptions={TURN_INTO} onTurnInto={(t, anchor, head) => onTurnInto(t as BlockType, anchor, head)}
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
          <Icon icon={ChevronRight} size={14} weight="bold" style={{ transform: b.collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 140ms var(--ease-standard)' }} />
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
  } else if (b.type === 'quote') {
    inner = <div className="border-l-[3px] border-line-strong pl-3.5" style={{ marginLeft: pad }}>{ta()}</div>;
  } else if (b.type === 'callout') {
    inner = <div className="flex gap-2.5 rounded-md border border-line-strong bg-surface-raised px-3.5 py-3" style={{ marginLeft: pad }}><CalloutIcon icon={b.icon} onPick={(emoji) => onImage({ icon: emoji })} />{ta()}</div>;
  } else if (b.type === 'code') {
    // §8.10 header row: language selector · Copy (raw text, 1.5s confirm) · Wrap.
    inner = (
      <div className="overflow-hidden rounded-md border border-line-strong bg-surface-raised">
        <div className="flex items-center justify-end gap-0.5 border-b border-line-soft px-1.5 py-1">
          <select value={b.lang ?? 'text'} onChange={(e) => onSetLang(e.target.value)} className="mr-auto cursor-pointer border-0 bg-transparent font-mono text-caption text-ink-600 outline-none">
            {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <ToolbarButton wide size="sm" active={!!b.wrap} onClick={() => onImage({ wrap: !b.wrap })} title="Toggle soft wrap" aria-pressed={!!b.wrap}>
            <Icon icon={ArrowDownUp} size={13} style={{ transform: 'rotate(90deg)' }} /> Wrap
          </ToolbarButton>
          <ToolbarButton wide size="sm" onClick={() => { navigator.clipboard?.writeText(b.text).catch(() => {}); setCopied(true); }} title="Copy code">
            <Icon icon={copied ? Check : CopyIcon} size={13} /> {copied ? 'Copied' : 'Copy'}
          </ToolbarButton>
        </div>
        <div className="px-3.5 py-2.5">{ta()}</div>
      </div>
    );
  } else if (b.type === 'table') {
    inner = <TableBlock rows={b.rows && b.rows.length ? b.rows : emptyTableRows()} onChange={onTableChange} />;
  } else if (b.type === 'image') {
    inner = <div style={{ marginLeft: pad }}><ImageBlock block={b} onImage={onImage} caption={ta} /></div>;
  } else if (b.type === 'bookmark' || b.type === 'embed' || b.type === 'video' || b.type === 'audio' || b.type === 'pdf' || b.type === 'file') {
    inner = <div style={{ marginLeft: pad }}><LinkBlock block={b} onSubmit={(url) => onImage({ src: url })} onClear={() => onImage({ src: undefined })} /></div>;
  } else if (b.type === 'collection') {
    /* Inline database — the block hosts a full database surface. onPick binds
       a "Linked view" block to its chosen source collection. */
    inner = <div style={{ marginLeft: pad }}><InlineCollection colId={b.colId} onExpand={onExpandDb} onPick={(cid) => onImage({ colId: cid })} /></div>;
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
        if (b.type === 'table' || b.type === 'collection') return;
        e.preventDefault(); onOpenMenu();
      }}
      style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'flex-start', opacity: isDragging ? 0.35 : dimmed ? 0.45 : 1, transform: CSS.Transform.toString(transform), transition }}
    >
      {/* Hover gutter — lives in the page margin, OUTSIDE the writing column
          (Notion architecture): absolutely positioned left of the row so the
          caret, placeholder, and text never shift, hover or not. Consumers
          reserve ≥44px of horizontal padding for it. */}
      <span className={cn('block-gutter absolute top-[3px] flex w-10 items-center justify-end gap-px opacity-0 transition-opacity duration-fast group-hover/row:opacity-100', menu && 'opacity-100')} style={{ left: -44 }}>
        <button onClick={(e) => onAddAfter(e.altKey)} title="Click to add below · ⌥-click to add above" aria-label="Add block"
          className="zb-press grid h-[22px] w-5 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-600">
          <Icon icon={Plus} size={16} />
        </button>
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} onClick={onOpenMenu} title="Drag to move · click for menu" aria-label="Block menu"
          className={cn('zb-press grid h-[22px] w-4 cursor-grab place-items-center rounded-xs border-0 text-ink-600 [touch-action:none]', menu ? 'bg-paper-3' : 'bg-transparent')}>
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
        ...(active || menu || slash || b.type === 'collection' || b.type === 'callout' ? {} : { contentVisibility: 'auto', containIntrinsicSize: 'auto 34px' }),
      }}>
        {inner}
        {slash && <SlashMenu {...slash} />}
      </div>
      {findShadow !== undefined && <FindShadow text={findShadow} onReveal={onToggleCollapse} />}
      {menu && <BlockMenu block={b} actions={menuActions} onClose={onCloseMenu} />}
    </div>
  );
}, (p, n) =>
  p.block === n.block && p.number === n.number && p.selected === n.selected &&
  p.focused === n.focused && p.dimmed === n.dimmed && p.hasChildren === n.hasChildren &&
  p.findShadow === n.findShadow &&
  p.menu === n.menu && activeEq(p.active, n.active) && !p.slash && !n.slash);

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
  const convertible = block.type !== 'table' && block.type !== 'divider' && block.type !== 'collection' && !MEDIA_TYPES.includes(block.type);
  const colorable = convertible;
  const typeLabel = BLOCK_MENU.find((m) => m.type === block.type)?.label ?? block.type;
  // Type-ahead: fuzzy-filter every menu item on label + keywords (§6.4).
  const query = q.trim().toLowerCase();
  const hit = (kw: string) => !query || kw.toLowerCase().includes(query);
  // Leaf actions modeled as data so the search can filter them uniformly.
  type Leaf = { key: string; label: string; kw: string; icon: IconType; kbd?: string; danger?: boolean; run: () => void };
  const leaves: Leaf[] = [
    ...(actions.expandPage ? [{ key: 'page', label: 'Turn into page', kw: 'turn into page subpage', icon: ExternalLink, run: actions.expandPage }] : []),
    { key: 'dup', label: 'Duplicate', kw: 'duplicate copy clone', icon: CopyIcon, kbd: '⌘D', run: actions.duplicate },
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
    <MenuPanel ref={ref} onMouseDown={(e) => e.stopPropagation()} className="absolute top-[26px] left-0 z-[70] w-[216px]">
      <input
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
              {BLOCK_MENU.filter((m) => m.type !== 'table' && m.type !== 'divider' && m.type !== 'collection' && !MEDIA_TYPES.includes(m.type) && m.type !== block.type).map((m) => (
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
    </MenuPanel>
  );
}
function Kbdish({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-caption text-ink-500">{children}</span>;
}

// ── Image block (Notion-style) ───────────────────────────────────────────────
// Empty → a quiet "Add an image" bar (click / drag-drop / paste). Set → the
// image at its stored width, with drag-to-resize side handles, a hover toolbar
// (Replace · Full width · Download), and an editable caption below.
function ImageBlock({ block: b, onImage, caption }: {
  block: Block; onImage: (patch: Partial<Block>) => void; caption: (extra?: React.CSSProperties) => React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [w, setW] = useState<number | null>(null); // live width while dragging
  const [lightbox, setLightbox] = useState<{ srcs: string[]; index: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function intake(file: File) {
    setErr(null);
    try { onImage({ src: await fileToDataUrl(file, { max: 1600, quality: 0.85 }) }); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
  }

  // Click the image → full-screen lightbox. Collect every image on the page at
  // open time so ←/→ can page through them (§8.11) without lifting state.
  function openLightbox() {
    if (!b.src) return;
    const srcs = Array.from(document.querySelectorAll<HTMLImageElement>('.img-block img'))
      .map((im) => im.getAttribute('src') || '').filter(Boolean);
    const index = Math.max(0, srcs.indexOf(b.src));
    setLightbox({ srcs: srcs.length ? srcs : [b.src], index });
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

  if (!b.src) {
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
          <span>{dragOver ? 'Drop image to upload' : 'Add an image'}</span>
        </button>
        {err && <div role="alert" className="pt-1.5 text-caption text-danger-600">{err}</div>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) intake(f); e.target.value = ''; }} />
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
        <img src={b.src} alt={b.text || ''} draggable={false} onClick={openLightbox}
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
          <a href={b.src} download={(b.text || 'image')} title="Download" aria-label="Download image" onClick={(e) => e.stopPropagation()}
            className="zb-press grid size-[22px] place-items-center rounded-sm text-ink-600 no-underline transition-colors duration-fast hover:text-ink-900"><Icon icon={Download} size={14} /></a>
        </span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) intake(f); e.target.value = ''; }} />
      </div>
      <div className="max-w-full" style={{ width: `${width}%` }}>{caption({ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 0' })}</div>
      {lightbox && <Lightbox srcs={lightbox.srcs} index={lightbox.index} alt={b.text || ''} onClose={() => setLightbox(null)} />}
    </figure>
  );
}

// ── Lightbox (§8.11) — full-screen image viewer, portalled to <body> so it
// escapes any content-visibility/overflow containment on the block row.
// Esc / click-out closes; ←/→ pages through every image on the document.
function Lightbox({ srcs, index, alt, onClose }: { srcs: string[]; index: number; alt: string; onClose: () => void }) {
  const [i, setI] = useState(index);
  const many = srcs.length > 1;
  const step = (d: number) => setI((c) => (c + d + srcs.length) % srcs.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (many && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setI((c) => (c + (e.key === 'ArrowLeft' ? -1 : 1) + srcs.length) % srcs.length);
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [many, srcs.length, onClose]);
  const src = srcs[i] ?? srcs[0];
  const navBtn = 'absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border-0 bg-[color-mix(in_srgb,var(--color-paper)_14%,transparent)] text-white [cursor:pointer]';
  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Image viewer"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-12 backdrop-blur-[2px] [animation:fadein_120ms]">
      <button onClick={onClose} aria-label="Close" title="Close (Esc)"
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-0 bg-[color-mix(in_srgb,var(--color-paper)_14%,transparent)] text-white [cursor:pointer]">
        <Icon icon={X} size={18} />
      </button>
      {many && (
        <>
          <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous image" className={cn(navBtn, 'left-4')}><Icon icon={ChevronLeft} size={20} /></button>
          <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next image" className={cn(navBtn, 'right-4')}><Icon icon={ChevronRight} size={20} /></button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-caption tracking-[0.02em] text-white/80">{i + 1} / {srcs.length}</span>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- user image, data/blob/http URL */}
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain shadow-lg" />
    </div>,
    document.body,
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
function LinkBlock({ block: b, onSubmit, onClear }: { block: Block; onSubmit: (url: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState('');
  const intake = LINK_INTAKE[b.type] ?? LINK_INTAKE.bookmark!;
  const submit = () => { const u = normalizeUrl(draft); if (u) onSubmit(u); };
  if (!b.src) {
    return (
      <div className="my-1">
        <div className="flex items-center gap-2 rounded-md bg-paper-3 px-3 py-2.5">
          <Icon icon={intake.icon} size={20} className="shrink-0 text-ink-600" />
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') setDraft(''); }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={intake.placeholder}
            autoComplete="off" data-1p-ignore data-lpignore="true"
            className="min-w-0 flex-1 border-0 bg-transparent text-body text-ink-900 outline-none" />
          <Button size="sm" variant="primary" disabled={!draft.trim()} onMouseDown={(e) => { e.preventDefault(); submit(); }} className="whitespace-nowrap">
            {intake.action}
          </Button>
        </div>
      </div>
    );
  }
  // Hover toolbar shared by the framed media types.
  const tools = (
    <span className="embed-tools absolute right-2 top-2 inline-flex gap-0.5 rounded-sm bg-paper-2 p-0.5 opacity-0 shadow-[0_0_0_1px_var(--color-line-soft),var(--shadow-sm)] transition-opacity duration-fast group-hover/embed:opacity-100">
      <a href={b.src} target="_blank" rel="noreferrer" title="Open" aria-label="Open in new tab" onClick={(e) => e.stopPropagation()}
        className="zb-press grid size-[22px] place-items-center rounded-sm text-ink-600 no-underline transition-colors duration-fast hover:text-ink-900"><Icon icon={ExternalLink} size={14} /></a>
      <ToolbarButton size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Remove" aria-label="Remove"><Icon icon={X} size={14} /></ToolbarButton>
    </span>
  );
  const directVideo = b.type === 'video' && toEmbedUrl(b.src) === b.src;
  if (b.type === 'embed' || (b.type === 'video' && !directVideo)) {
    return (
      <div className="embed-block group/embed relative my-1">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-paper-3">
          <iframe src={toEmbedUrl(b.src)} title={b.type === 'video' ? 'Video' : 'Embed'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
        </div>
        {tools}
      </div>
    );
  }
  if (directVideo) {
    return (
      <div className="embed-block group/embed relative my-1">
        <video src={b.src} controls playsInline className="block w-full rounded-md border border-line bg-paper-3" />
        {tools}
      </div>
    );
  }
  if (b.type === 'audio') {
    return (
      <div className="embed-block group/embed relative my-1 rounded-md border border-line bg-paper-3 px-2.5 py-2">
        <audio src={b.src} controls className="block w-full" />
        {tools}
      </div>
    );
  }
  if (b.type === 'pdf') {
    return (
      <div className="embed-block group/embed relative my-1">
        <iframe src={b.src} title="PDF" loading="lazy" className="block w-full rounded-md border border-line bg-paper-3" style={{ height: 480 }} />
        {tools}
      </div>
    );
  }
  if (b.type === 'file') {
    return (
      <div className="embed-block group/embed doc-proprow relative my-1">
        <a href={b.src} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}
          className="bookmark-card flex items-center gap-2.5 rounded-md border border-line bg-paper-2 px-3 py-2 no-underline transition-colors duration-fast hover:bg-paper-3">
          <Icon icon={Paperclip} size={16} className="shrink-0 text-ink-600" />
          <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-800">{urlFilename(b.src)}</span>
          <Icon icon={Download} size={16} className="shrink-0 text-ink-500" />
        </a>
        {tools}
      </div>
    );
  }
  // bookmark
  let host = b.src; try { host = new URL(b.src).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return (
    <a href={b.src} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}
      className="bookmark-card my-1 flex items-center gap-3 rounded-md border border-line bg-paper-2 px-3.5 py-3 no-underline transition-colors duration-fast hover:bg-paper-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-paper-3">
        <Icon icon={Globe} size={20} className="text-ink-600" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body font-medium text-ink-800">{host}</span>
        <span className="truncate text-caption text-ink-500">{b.src}</span>
      </span>
      <Icon icon={ExternalLink} size={16} className="ml-auto shrink-0 text-ink-500" />
    </a>
  );
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
                    <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} placeholder="—" className={cellInput()} autoComplete="off" data-1p-ignore data-lpignore="true" />
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

// Drag preview under the cursor — shows a count pill for group moves.
// §6.5 drop indicator: a 2px accent line at the target gap, inset to the nest
// level. Position is precomputed (container-relative top/left) by the drag's
// rAF loop, so this renders from plain numbers — no DOM reads during render.
function DropIndicator({ top, left }: { top: number; left: number }) {
  return (
    <div aria-hidden style={{ position: 'absolute', left, right: 0, top, height: 2, background: 'var(--accent)', borderRadius: 1, pointerEvents: 'none', zIndex: 50 }}>
      <span style={{ position: 'absolute', left: -3, top: -2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
    </div>
  );
}

function DragGhost({ block, count }: { block: Block; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-body-size)', color: 'var(--ink-2)', maxWidth: 360, maxHeight: 120, opacity: 0.9, transform: 'scale(0.98)', cursor: 'grabbing', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      <Icon icon={GripVertical} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.type === 'divider' ? '— divider —' : (block.text || 'Empty block')}</span>
      {count > 1 && <span className="num shrink-0 rounded-full bg-ink-900 px-1.5 py-px text-caption font-semibold text-onsolid">{count} blocks</span>}
    </div>
  );
}

type SlashResults = (Omit<BlockMenuItem, 'group'> & { group: string })[];

function SlashMenu({ results, active, pick }: { query: string; active: number; results: SlashResults; pick: (m: SlashItem) => void }) {
  const order: string[] = ['Recent', 'Basic', 'Lists', 'Media', 'Database', 'Blocks'];
  const groups = order.filter((g) => results.some((m) => m.group === g));
  let flat = -1; // running index across groups, aligned with keyboard nav
  return (
    // onMouseDown preventDefault keeps the block textarea focused (Notion: the
    // editor never loses focus) — clicks and scrollbar drags don't blur it.
    <MenuPanel onMouseDown={(e) => e.preventDefault()}
      className="absolute z-50 mt-1 max-h-[320px] w-[272px] origin-top-left overflow-y-auto">
      {results.length === 0 && (
        <div className="px-2.5 py-3.5 text-center">
          <div className="text-meta font-medium text-ink-600">No results found</div>
          <div className="mt-0.5 text-caption text-ink-500">Try another block type.</div>
        </div>
      )}
      {groups.map((g) => {
        const items = results.filter((m) => m.group === g);
        return (
          <div key={g}>
            <MenuLabel>{g}</MenuLabel>
            {items.map((m, k) => {
              flat += 1; const i = flat; const on = i === active;
              return (
                <button key={g + m.type + k} onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  className={cn('zb-press flex w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 px-2 py-1.5 text-left', on ? 'bg-surface-selected' : 'bg-transparent')}>
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-sm border border-line-soft bg-surface-fill', on ? 'text-ink-800' : 'text-ink-600')}><Icon icon={BLOCK_ICON[m.type]} size={16} /></span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="text-meta font-medium text-ink-900">{m.label}</span>
                    <span className="text-caption text-ink-600">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </MenuPanel>
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
        <div className="absolute left-0 top-[calc(100%+4px)] z-[70] grid gap-0.5 rounded-lg border border-line-strong bg-surface-raised p-1.5 shadow-lift-2 [animation:fadein_120ms]" style={{ gridTemplateColumns: 'repeat(8, 26px)' }}>
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
