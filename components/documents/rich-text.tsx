'use client';
// The rich text surface for editor blocks. Idle blocks render their spans as
// static styled HTML; the focused block hosts the document's single live
// ProseMirror instance (M0-spike-proven architecture: caret lands at the
// click point, zero layout shift on the swap, one PM view per page).
//
// The editor's document-level history stays the undo authority: PM ships no
// history plugin, every doc change is reported upward as (text, spans, caret),
// and external changes (undo/redo) resync the mounted view in place.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Schema, type Node as PMNode, type Mark, type MarkType } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark } from 'prosemirror-commands';
import { Bold, Italic, Underline, Strikethrough, Code as CodeIcon, Link2, X, ChevronDown, Brain } from "@/components/ds/icons";
import { Icon, Toolbar, ToolbarButton, ToolbarSeparator, MenuPanel, MenuItem, MenuLabel, MenuGlyph } from "@/components/ds/ui";
import { RecordPreview } from '@/components/connected/record-preview';
import { cn } from '@/lib/cn';
import { mergeSpans, sparse, plainOf, spansOf, removeRange, insertSpan, type RichSpan } from '@/lib/rich';
import { PALETTE_NAMES } from '@/lib/palette';
import { useFollowLink } from '@/lib/use-follow-link';
import { safeHref } from '@/lib/safe-url';

// Span color styling — same token bridge as block color: '<palette>' tints the
// text via --pal-<n>-text, '<palette>-bg' washes the background via --pal-<n>-bg.
const colorCss = (name: string): string =>
  name.endsWith('-bg')
    ? `background:var(--pal-${name.slice(0, -3)}-bg);border-radius:2px`
    : `color:var(--pal-${name}-text)`;

const colorStyle = (name: string): React.CSSProperties =>
  name.endsWith('-bg')
    ? { background: `var(--pal-${name.slice(0, -3)}-bg)`, borderRadius: 2 }
    : { color: `var(--pal-${name}-text)` };

// ── PM schema: one paragraph of inline content, marks mirror RichSpan ────────
// Mark classes are shared with the static renderer so the swap is pixel-exact.
export const richSchema = new Schema({
  nodes: {
    doc: { content: 'para' },
    para: { content: 'inline*', toDOM: () => ['p', { class: 'zb-rich-p' }, 0], parseDOM: [{ tag: 'p' }] },
    text: { group: 'inline' },
    // Soft line-break (Shift+Enter). Round-trips as '\n' in Block.text, so all
    // plain-text offset math (slash, caret, split) keeps working unchanged.
    br: { inline: true, group: 'inline', selectable: false, toDOM: () => ['br'], parseDOM: [{ tag: 'br' }] },
  },
  marks: {
    b: { toDOM: () => ['strong', { class: 'zb-rich-b' }, 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }, { style: 'font-weight=600' }, { style: 'font-weight=700' }] },
    i: { toDOM: () => ['em', { class: 'zb-rich-i' }, 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }] },
    u: { toDOM: () => ['span', { class: 'zb-rich-u' }, 0], parseDOM: [{ tag: 'u' }, { tag: 'span.zb-rich-u' }] },
    s: { toDOM: () => ['s', { class: 'zb-rich-s' }, 0], parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }] },
    c: { toDOM: () => ['code', { class: 'zb-rich-c' }, 0], parseDOM: [{ tag: 'code' }] },
    link: {
      attrs: { href: {} },
      inclusive: false,
      // The RENDER boundary. `lib/blocks.ts` already refuses an unsafe stored
      // link, but a mark can also arrive from a paste that never touched
      // storage, and this is the last place before a real <a> exists that a
      // click can follow. An unsafe href renders with NO href — the words stay,
      // the navigation does not.
      toDOM: (m: Mark) => {
        const href = safeHref(m.attrs.href);
        // No class on the refused branch. Keeping `zb-rich-a` would leave it
        // underlined and cursor-pointer — something that LOOKS like a link and
        // does nothing, which is worse than either outcome. It renders as the
        // words it is.
        return href ? ['a', { class: 'zb-rich-a', href }, 0] : ['span', {}, 0];
      },
      parseDOM: [{ tag: 'a[href]', getAttrs: (el) => {
        const href = safeHref((el as HTMLElement).getAttribute('href'));
        return href ? { href } : false;   // false ⇒ the mark is not applied at all
      } }],
    },
    color: {
      attrs: { name: {} },
      toDOM: (m: Mark) => ['span', { class: 'zb-rich-color', 'data-color': m.attrs.name as string, style: colorCss(m.attrs.name as string) }, 0],
      parseDOM: [{ tag: 'span[data-color]', getAttrs: (el) => ({ name: (el as HTMLElement).getAttribute('data-color') }) }],
    },
  },
});

export function spansToDoc(spans: RichSpan[]): PMNode {
  const nodes: PMNode[] = [];
  for (const sp of spans) {
    if (!sp.text) continue;
    const marks: Mark[] = [];
    if (sp.b) marks.push(richSchema.marks.b.create());
    if (sp.i) marks.push(richSchema.marks.i.create());
    if (sp.u) marks.push(richSchema.marks.u.create());
    if (sp.s) marks.push(richSchema.marks.s.create());
    if (sp.c) marks.push(richSchema.marks.c.create());
    if (sp.link) marks.push(richSchema.marks.link.create({ href: sp.link }));
    if (sp.color) marks.push(richSchema.marks.color.create({ name: sp.color }));
    // '\n' runs become br nodes; the text around them keeps the span's marks.
    const parts = sp.text.split('\n');
    parts.forEach((part, i) => {
      if (part) nodes.push(richSchema.text(part, marks));
      if (i < parts.length - 1) nodes.push(richSchema.nodes.br.create());
    });
  }
  return richSchema.node('doc', null, [richSchema.node('para', null, nodes)]);
}

export function docToSpans(doc: PMNode): RichSpan[] {
  const spans: RichSpan[] = [];
  doc.firstChild?.forEach((n) => {
    if (n.type.name === 'br') { spans.push({ text: '\n' }); return; }
    if (!n.isText || !n.text) return;
    const sp: RichSpan = { text: n.text };
    for (const m of n.marks) {
      if (m.type.name === 'b') sp.b = true;
      else if (m.type.name === 'i') sp.i = true;
      else if (m.type.name === 'u') sp.u = true;
      else if (m.type.name === 's') sp.s = true;
      else if (m.type.name === 'c') sp.c = true;
      else if (m.type.name === 'link') sp.link = m.attrs.href as string;
      else if (m.type.name === 'color') sp.color = m.attrs.name as string;
    }
    spans.push(sp);
  });
  return mergeSpans(spans);
}

// ── the caret-surface contract shared with the code-block <textarea> path ────
// Mirrors the textarea properties the editor's key/selection logic reads, so
// one set of handlers drives both surfaces.
/** Viewport coordinates of a caret position — what a menu anchors to. */
export type CaretRect = { left: number; top: number; bottom: number };

export type SurfaceHandle = {
  focus: (pos?: number) => void;
  blur: () => void;
  selectAll: () => void;
  readonly selStart: number;
  readonly selEnd: number;
  readonly dir: 'forward' | 'backward' | 'none';
  readonly length: number;
  readonly text: string;
  /**
   * Where a plain-text offset sits on screen, so a typed-trigger menu can open
   * AT the caret instead of at the block's left edge. `/` almost always starts
   * a block so the difference never showed; `@` is typed mid-sentence, where a
   * menu pinned to the margin reads as belonging to something else.
   */
  caretRect: (pos: number) => CaretRect | null;
};

export function textareaHandle(el: HTMLTextAreaElement): SurfaceHandle {
  return {
    focus: (pos) => { el.focus(); if (pos !== undefined) { const p = Math.min(pos, el.value.length); el.setSelectionRange(p, p); } },
    blur: () => el.blur(),
    selectAll: () => el.select(),
    get selStart() { return el.selectionStart; },
    get selEnd() { return el.selectionEnd; },
    get dir() { return el.selectionDirection as 'forward' | 'backward' | 'none'; },
    get length() { return el.value.length; },
    get text() { return el.value; },
    // A <textarea> has no per-character geometry. Code blocks are the only
    // surface that use this handle and they carry no typed-trigger menus, so
    // the element's own left edge is an honest answer rather than a guess.
    caretRect: () => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, bottom: r.bottom };
    },
  };
}

// Key events forwarded to the editor's shared handler. `code` is the physical
// key (layout-independent) — needed for ⌘⌥-digit turn-into shortcuts, since
// Alt+digit produces punctuation in `key` on Mac.
export type KeyLike = {
  key: string; code: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean;
  preventDefault: () => void;
};

// DOM point → plain-text offset within the static span container.
function charOffsetAt(node: Node | null, nodeOffset: number, container: HTMLElement): number | null {
  if (!node || !container.contains(node)) return null;
  const w = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let n = 0; let cur: Node | null;
  while ((cur = w.nextNode())) {
    if (cur === node) return n + nodeOffset;
    n += (cur.textContent ?? '').length;
  }
  // Element-level hit (e.g. the container itself): treat as end of text.
  return n;
}

/**
 * What a host must provide for "Remember this" to appear on a selection.
 *
 * Passed down unchanged through the editor — neither this component nor the
 * block editor knows what a memory IS. The host owns the subject (which record
 * the fact is about) and the write; they own the gesture.
 */
export type RememberHook = {
  /** Named in the field's hint, so the user always sees where a fact will land. */
  subjectLabel: string;
  max: number;
  /** Returns an error message to show in place, or null when it saved. */
  onSave: (body: string) => Promise<string | null>;
};

export type RichTextProps = {
  blockId: string;
  text: string;
  spans?: RichSpan[];
  type: string; // BlockType — used only for placeholder/caret styling hooks
  active: { anchor: number; head: number; epoch: number } | null;
  placeholder: string;
  /**
   * An open trigger menu's text — the "/" and what has been typed after it —
   * drawn as a soft pill, with `placeholder` after the caret while nothing has
   * been typed ("/Type to search", Notion's slash menu). Offsets are Block.text
   * offsets; null when no menu is open on this block.
   */
  trigger?: { at: number; length: number; placeholder?: string } | null;
  style?: React.CSSProperties;
  onRich: (text: string, spans: RichSpan[] | undefined, caret: number) => void;
  // Inline markdown auto-convert: `literal` is the exact typed state (already
  // emitted through onRich), `converted` carries the real mark. The editor
  // records `literal` as its own history step, so one ⌘Z restores it (§7.2).
  onConvertInline: (literal: { text: string; spans?: RichSpan[] }, converted: { text: string; spans?: RichSpan[] }, caret: number) => void;
  // §7.3 toolbar turn-into: the editor supplies the convertible types (static
  // list) and performs the conversion; anchor/head restore the selection.
  turnIntoOptions?: TurnIntoOption[];
  onTurnInto?: (type: string, anchor: number, head: number) => void;
  // Memory's marked capture (§7X §4.2). The editor supplies the subject and the
  // write; this component only knows how to hand over the selected text. Absent
  // on hosts with nothing to record a fact ABOUT.
  remember?: RememberHook;
  // Return true when the editor's shared handler consumed the key.
  onKey: (e: KeyLike, el: SurfaceHandle) => boolean | void;
  // Return true when the editor's paste engine consumed the event.
  onPasteEvent: (e: ClipboardEvent, el: SurfaceHandle) => boolean;
  onFocus: () => void;
  onBlur: () => void;
  // Request activation (mount PM here) with a caret range — fired on mouseup
  // over the static render so native drag-selection over static spans becomes
  // the initial PM selection (Notion feel, no selection lost to the swap).
  onActivate: (anchor: number, head: number) => void;
  handleRef: (h: SurfaceHandle | null) => void;
};

// Static span rendering — the SAME semantic elements and classes as the PM
// mark toDOMs, so the active swap is DOM-shape-identical (styling, a11y, and
// copied HTML all match).
function staticSpans(spans: RichSpan[] | undefined, text: string, follow?: (href: string) => void): React.ReactNode {
  const list = spans?.length ? spans : text ? [{ text } as RichSpan] : [];
  if (!list.length) return <br />; // hold one line height, like PM's trailing break
  return list.map((sp, i) => {
    let n: React.ReactNode = sp.text;
    // Innermost first — nesting order mirrors PM's mark rank so the swap is
    // DOM-shape-identical (color is the schema's last mark → innermost).
    if (sp.color) n = <span className="zb-rich-color" data-color={sp.color} style={colorStyle(sp.color)}>{n}</span>;
    // A plain click FOLLOWS the link — `useFollowLink` decides in-app vs new
    // tab. This used to `preventDefault` and do nothing, so a mention could
    // only be opened with ⌘-click. Handling it here rather than on the parent's
    // mouseup also covers the keyboard: Enter on a focused anchor fires `click`.
    // ⌘/ctrl-click is left to the browser, so "open in a new tab" still works.
    // THE RENDER PATH THAT MATTERS. Almost every block on screen is static —
    // only the focused one is a live ProseMirror view — so this, not the mark's
    // toDOM, is where a stored link becomes a real <a> with a click handler that
    // navigates. A link nobody can vouch for renders as the words it is.
    const href = safeHref(sp.link);
    if (href) {
      n = (
        <a
          className="zb-rich-a" href={href} rel="noreferrer"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let the browser have it
            e.preventDefault();
            follow?.(href);
          }}
        >{n}</a>
      );
      // Hovering an INTERNAL link previews what is on the other end. Returns the
      // anchor untouched for an external link or an unaddressable route, so this
      // costs nothing on the overwhelming majority of links — and the query does
      // not fire until the card actually opens.
      n = <RecordPreview href={href}>{n}</RecordPreview>;
    }
    if (sp.c) n = <code className="zb-rich-c">{n}</code>;
    if (sp.s) n = <s className="zb-rich-s">{n}</s>;
    if (sp.u) n = <span className="zb-rich-u">{n}</span>;
    if (sp.i) n = <em className="zb-rich-i">{n}</em>;
    if (sp.b) n = <strong className="zb-rich-b">{n}</strong>;
    return <span key={i}>{n}</span>;
  });
}

// ── The trigger pill ─────────────────────────────────────────────────────────
// Plugin state, not React props, because a view's plugins are fixed when it is
// created: the editor hands a new trigger over as transaction meta and the
// decorations follow. Between hand-overs the range rides the document mapping,
// so a keystroke never leaves the pill a character behind.
type TriggerState = NonNullable<RichTextProps['trigger']> | null;
const TRIGGER = new PluginKey<TriggerState>('zb-trigger');
const triggerPlugin = new Plugin<TriggerState>({
  key: TRIGGER,
  state: {
    init: () => null,
    apply(tr, value) {
      const meta = tr.getMeta(TRIGGER) as TriggerState | undefined;
      if (meta !== undefined) return meta;
      if (!value || !tr.docChanged) return value;
      return { ...value, at: tr.mapping.map(1 + value.at, -1) - 1 };
    },
  },
  props: {
    decorations(state) {
      const t = TRIGGER.getState(state);
      if (!t) return null;
      const from = 1 + t.at;
      const to = Math.min(from + t.length, state.doc.content.size - 1);
      if (from >= to) return null;
      const decos = [Decoration.inline(from, to, { class: t.placeholder ? 'zb-trigger zb-trigger-open' : 'zb-trigger' })];
      if (t.placeholder) {
        const text = t.placeholder;
        decos.push(Decoration.widget(to, () => {
          const el = document.createElement('span');
          el.className = 'zb-trigger-ph';
          el.textContent = text;
          return el;
        }, { side: 1, key: 'zb-trigger-ph:' + text }));
      }
      return DecorationSet.create(state.doc, decos);
    },
  },
});

export function RichText(props: RichTextProps) {
  const { active } = props;
  return (
    <div className="zb-rich" style={{ position: 'relative', flex: 1, minWidth: 0, ...props.style }}>
      {active ? <ActivePM {...props} active={active} /> : <StaticRich {...props} />}
      {/* Placeholder shows whenever the block is empty and a hint is supplied —
          the editor decides which blocks get one (focused block, or any empty
          heading per §6.9); unfocused non-heading empties pass '' and show none. */}
      {props.text === '' && props.placeholder && (
        <span aria-hidden className="zb-rich-ph pointer-events-none absolute inset-0 text-ink-500">
          {props.placeholder}
        </span>
      )}
    </div>
  );
}

function StaticRich({ text, spans, onActivate }: RichTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Activation happens on mouseUP so a drag over the static spans first makes
  // a native selection, which we then adopt as the PM selection.
  const armed = useRef(false);
  const follow = useFollowLink();
  return (
    <div
      ref={ref}
      className="zb-rich-static"
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'text' }}
      onMouseDown={() => { armed.current = true; }}
      onMouseUp={(e) => {
        if (!armed.current || !ref.current) return;
        armed.current = false;
        const sel = window.getSelection();
        // A click that landed ON a link follows it instead of activating the
        // block — otherwise mouseup swaps this static render for the live
        // editor and the anchor's own click never reaches a live element.
        // A DRAG that ends on a link is still a selection, so this only applies
        // when the selection collapsed: dragging across a mention to select it
        // behaves exactly as before.
        const onLink = (e.target as HTMLElement | null)?.closest?.('a.zb-rich-a');
        if (onLink && (!sel || sel.isCollapsed)) return;
        let anchor: number | null = null; let head: number | null = null;
        if (sel && sel.rangeCount && ref.current.contains(sel.anchorNode) && ref.current.contains(sel.focusNode)) {
          anchor = charOffsetAt(sel.anchorNode, sel.anchorOffset, ref.current);
          head = charOffsetAt(sel.focusNode, sel.focusOffset, ref.current);
        }
        if (head === null) {
          // No usable selection (click on padding): caret from the point.
          const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
          const p = doc.caretPositionFromPoint?.(e.clientX, e.clientY) ?? null;
          const r = !p && document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
          head = charOffsetAt(p?.offsetNode ?? r?.startContainer ?? null, p?.offset ?? r?.startOffset ?? 0, ref.current) ?? text.length;
        }
        onActivate(anchor ?? head, head);
      }}
    >
      {staticSpans(spans, text, follow)}
    </div>
  );
}

// ── inline markdown input rules (§7.2) ───────────────────────────────────────
// Typing the closing marker converts the run into a real mark. Checked against
// the plain text before the caret; bold before italic so '**' never half-matches.
const INLINE_MD: [RegExp, 'b' | 'i' | 'c' | 's'][] = [
  [/(?:^|[^*])(\*\*([^*\n]+)\*\*)$/, 'b'],
  [/(~~([^~\n]+)~~)$/, 's'],
  [/(`([^`\n]+)`)$/, 'c'],
  [/(\*([^*\s][^*\n]*)\*)$/, 'i'],
];

function detectInlineMd(text: string, caret: number): { start: number; inner: string; flag: 'b' | 'i' | 'c' | 's' } | null {
  const upto = text.slice(0, caret);
  for (const [re, flag] of INLINE_MD) {
    const m = re.exec(upto);
    if (m) {
      // For italic, reject when the char before the opening '*' is another '*'
      // (that's an in-progress '**bold**', handled by the bold rule).
      const start = caret - m[1].length;
      if (flag === 'i' && upto[start - 1] === '*') continue;
      return { start, inner: m[2], flag };
    }
  }
  return null;
}

// Does the ENTIRE range carry the mark? (Mixed runs read as unpressed, §7.3.)
function allHasMark(state: EditorState, from: number, to: number, type: MarkType): boolean {
  let all = true; let any = false;
  state.doc.nodesBetween(from, to, (n) => {
    if (!n.isText) return;
    any = true;
    if (!type.isInSet(n.marks)) all = false;
  });
  return any && all;
}

function firstLink(state: EditorState, from: number, to: number): string | null {
  let href: string | null = null;
  state.doc.nodesBetween(from, to, (n) => {
    if (href || !n.isText) return;
    const m = richSchema.marks.link.isInSet(n.marks);
    if (m) href = m.attrs.href as string;
  });
  return href;
}

// The selection's color when uniform; mixed colors read as none (§7.3).
function uniformColor(state: EditorState, from: number, to: number): string | null {
  let color: string | null | undefined;
  state.doc.nodesBetween(from, to, (n) => {
    if (!n.isText || color === null) return;
    const m = richSchema.marks.color.isInSet(n.marks);
    const c = m ? (m.attrs.name as string) : null;
    color = color === undefined || color === c ? c : null;
  });
  return color ?? null;
}

type ToolbarState = {
  x: number; y: number; below: boolean;
  from: number; to: number;
  b: boolean; i: boolean; u: boolean; s: boolean; c: boolean; link: string | null;
  color: string | null;
};

// Turn-into dropdown entries — supplied by the editor (it owns the block-type
// vocabulary); the toolbar stays block-model-agnostic.
export type TurnIntoOption = { type: string; label: string; icon: React.ComponentProps<typeof Icon>['icon'] };

function ActivePM(props: RichTextProps & { active: NonNullable<RichTextProps['active']> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Latest props without re-creating the view (synced pre-event in layout effect).
  const p = useRef(props);
  useLayoutEffect(() => { p.current = props; });
  // Last content THIS view emitted — external changes (undo) resync the doc.
  const emitted = useRef<{ text: string; spans?: RichSpan[] } | null>(null);

  // ── inline formatting toolbar (§7.3) ──
  const [tb, setTbState] = useState<ToolbarState | null>(null);
  const [linkOpen, setLinkOpenState] = useState(false);
  const tbRef = useRef<ToolbarState | null>(null);
  const linkOpenRef = useRef(false);
  const setTb = (v: ToolbarState | null) => { tbRef.current = v; setTbState(v); };
  const setLinkOpen = (v: boolean) => { linkOpenRef.current = v; setLinkOpenState(v); };
  const selTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeToolbar = (view: EditorView): ToolbarState | null => {
    const { from, to, empty } = view.state.selection;
    if (empty) return null;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const below = start.top < 64; // no room above → flip under the selection
    return {
      x: Math.max(150, Math.min(window.innerWidth - 150, (start.left + end.right) / 2)),
      y: below ? end.bottom : start.top,
      below,
      from, to,
      b: allHasMark(view.state, from, to, richSchema.marks.b),
      i: allHasMark(view.state, from, to, richSchema.marks.i),
      u: allHasMark(view.state, from, to, richSchema.marks.u),
      s: allHasMark(view.state, from, to, richSchema.marks.s),
      c: allHasMark(view.state, from, to, richSchema.marks.c),
      link: firstLink(view.state, from, to),
      color: uniformColor(view.state, from, to),
    };
  };

  // Toolbar shows 150ms after the selection stabilizes; hides instantly on
  // collapse. Every PM selection change funnels through dispatchTransaction.
  const scheduleToolbar = (view: EditorView) => {
    if (selTimer.current) clearTimeout(selTimer.current);
    if (view.state.selection.empty) { if (tbRef.current) setTb(null); setLinkOpen(false); return; }
    selTimer.current = setTimeout(() => {
      const v = viewRef.current;
      if (v) setTb(computeToolbar(v));
    }, tbRef.current ? 0 : 150);
  };

  const handleFromView = (view: EditorView): SurfaceHandle => ({
    focus: (pos) => {
      view.focus();
      if (pos !== undefined) {
        const max = view.state.doc.content.size - 1;
        const at = Math.max(1, Math.min(1 + pos, max));
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
      }
    },
    blur: () => (view.dom as HTMLElement).blur(),
    selectAll: () => {
      const doc = view.state.doc;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
    },
    get selStart() { const s = view.state.selection; return Math.min(s.anchor, s.head) - 1; },
    get selEnd() { const s = view.state.selection; return Math.max(s.anchor, s.head) - 1; },
    get dir() { const s = view.state.selection; return s.head === s.anchor ? 'none' : s.head > s.anchor ? 'forward' : 'backward'; },
    // Count soft-breaks (br nodes) as '\n' so offsets match Block.text — PM's
    // doc.textContent drops them, which would desync caret math around breaks.
    get length() { return plainOf(docToSpans(view.state.doc)).length; },
    get text() { return plainOf(docToSpans(view.state.doc)); },
    // +1 converts a Block.text offset to a PM document position (the same
    // shift `focus` and `selStart` apply). Clamped, because the caller's offset
    // comes from text that may already have moved under it.
    caretRect: (pos) => {
      try {
        const max = view.state.doc.content.size - 1;
        const c = view.coordsAtPos(Math.max(1, Math.min(1 + pos, max)));
        return { left: c.left, top: c.top, bottom: c.bottom };
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    const host = hostRef.current!;
    // A fresh view has emitted nothing — stale echo state from a previous
    // view (epoch remount) must not suppress the external-change resync.
    emitted.current = null;
    const doc = spansToDoc(spansOf({ text: p.current.text, spans: p.current.spans }));
    const max = doc.content.size - 1;
    const clamp = (n: number) => Math.max(1, Math.min(1 + n, max));
    const view: EditorView = new EditorView(host, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, clamp(p.current.active.anchor), clamp(p.current.active.head)),
        plugins: [
          keymap({
            'Mod-b': toggleMark(richSchema.marks.b),
            'Mod-i': toggleMark(richSchema.marks.i),
            'Mod-u': toggleMark(richSchema.marks.u),
            'Mod-Shift-s': toggleMark(richSchema.marks.s),
            'Mod-e': toggleMark(richSchema.marks.c),
            // Soft line-break inside the block (plain Enter splits blocks and
            // is consumed by the editor's shared handler before plugins).
            'Shift-Enter': (state, dispatch) => {
              dispatch?.(state.tr.replaceSelectionWith(richSchema.nodes.br.create()).scrollIntoView());
              return true;
            },
            // Plain Enter reaches here only for quote/callout continue-cases:
            // the editor's shared handler consumes Enter for every other type
            // and, for quote/callout, only lets it through to add a line inside
            // (§6.3). The exit-on-empty-trailing-line case is structural and
            // handled upstream before this runs.
            'Enter': (state, dispatch) => {
              if (p.current.type !== 'quote' && p.current.type !== 'callout') return false;
              dispatch?.(state.tr.replaceSelectionWith(richSchema.nodes.br.create()).scrollIntoView());
              return true;
            },
          }),
          // Character-level editing (Backspace/Delete/…). Block-boundary keys
          // never reach it: the editor's shared handler consumes them first
          // via handleKeyDown, which runs before all plugin keymaps.
          keymap(baseKeymap),
          triggerPlugin,
        ],
      }),
      handleKeyDown: (view, event) => {
        // Toolbar/link-popover keys run ahead of the editor's shared handler:
        // Esc dismisses them (block selection needs a second press), ⌘K opens
        // the link editor over the current selection.
        if (event.key === 'Escape' && (tbRef.current || linkOpenRef.current)) { setTb(null); setLinkOpen(false); return true; }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !view.state.selection.empty) {
          setTb(computeToolbar(view));
          setLinkOpen(true);
          return true;
        }
        const handled = p.current.onKey(event, handleFromView(view));
        return handled === true;
      },
      handleDOMEvents: {
        focus: () => { p.current.onFocus(); return false; },
        blur: () => { p.current.onBlur(); return false; },
        paste: (view, event) => p.current.onPasteEvent(event as ClipboardEvent, handleFromView(view)),
      },
      dispatchTransaction(tr: Transaction) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) {
          const spans = docToSpans(next.doc);
          const text = plainOf(spans);
          const out = { text, spans: sparse(spans) };
          emitted.current = out;
          const caret = next.selection.head - 1;
          p.current.onRich(out.text, out.spans, caret);
          // Inline markdown: only a single typed character can complete a
          // marker pair — pastes and command transactions never convert.
          // Shape-checked (not instanceof) so bundler module duplication of
          // prosemirror-transform can't break the detection.
          const st = tr.steps[0] as unknown as { from?: number; to?: number; slice?: { content?: { size?: number } } } | undefined;
          const typedOne = tr.steps.length === 1 && st?.from === st?.to && st?.slice?.content?.size === 1;
          if (typedOne) {
            const hit = detectInlineMd(text, caret);
            if (hit) {
              const stripped = removeRange({ text, spans: out.spans }, hit.start, caret);
              const converted = insertSpan(stripped, hit.start, { text: hit.inner, [hit.flag]: true });
              p.current.onConvertInline({ text, spans: out.spans }, converted, hit.start + hit.inner.length);
              return; // the parent remounts the view at the converted state
            }
          }
        }
        scheduleToolbar(view);
      },
    });
    viewRef.current = view;
    props.handleRef(handleFromView(view));
    view.focus();
    scheduleToolbar(view); // a drag-activation may mount with a live selection
    return () => {
      if (selTimer.current) clearTimeout(selTimer.current);
      props.handleRef(null); viewRef.current = null; view.destroy();
    };
    // Recreate only when the block identity or an explicit re-activation
    // (epoch) demands it — never on our own emitted changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.blockId, props.active.epoch]);

  // An open trigger menu hands its range to the pill (see `triggerPlugin`).
  const trigAt = props.trigger?.at;
  const trigLength = props.trigger?.length;
  const trigPlaceholder = props.trigger?.placeholder;
  const { epoch } = props.active;
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next: TriggerState = trigAt !== undefined && trigLength !== undefined
      ? { at: trigAt, length: trigLength, placeholder: trigPlaceholder }
      : null;
    const cur = TRIGGER.getState(view.state);
    if (cur === next || (cur && next && cur.at === next.at && cur.length === next.length && cur.placeholder === next.placeholder)) return;
    view.dispatch(view.state.tr.setMeta(TRIGGER, next));
    // `epoch` and the block: a re-created view starts with no pill and needs it again.
  }, [trigAt, trigLength, trigPlaceholder, epoch, props.blockId]);

  // External content change (undo/redo, structural ops touching this block):
  // rebuild the doc in place, keep the caret clamped.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const em = emitted.current;
    if (em && em.text === props.text && em.spans === props.spans) return; // our own echo
    const current = docToSpans(view.state.doc);
    if (plainOf(current) === props.text && JSON.stringify(sparse(current) ?? null) === JSON.stringify(props.spans ?? null)) return;
    const doc = spansToDoc(spansOf({ text: props.text, spans: props.spans }));
    const head = Math.max(1, Math.min(view.state.selection.head, doc.content.size - 1));
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, head), plugins: view.state.plugins });
    view.updateState(state);
    emitted.current = { text: props.text, spans: props.spans };
    scheduleToolbar(view); // undo/redo can change marks under a live toolbar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.text, props.spans]);

  // Scrolling more than 40px dismisses the toolbar (§7.3).
  useEffect(() => {
    if (!tb) return;
    let start: number | null = null;
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const top = t instanceof Document ? (t.scrollingElement?.scrollTop ?? 0) : t.scrollTop;
      if (start === null) start = top;
      else if (Math.abs(top - start) > 40) { setTb(null); setLinkOpen(false); }
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tb !== null]);

  const applyMark = (type: MarkType, attrs?: Record<string, unknown>, remove?: boolean) => {
    const view = viewRef.current; if (!view || !tbRef.current) return;
    const { from, to } = tbRef.current;
    if (remove) view.dispatch(view.state.tr.removeMark(from, to, type));
    else if (attrs) view.dispatch(view.state.tr.addMark(from, to, type.create(attrs)));
    else toggleMark(type)(view.state, view.dispatch);
    view.focus();
    setTb(computeToolbar(view));
  };

  // Span color: one slot — setting a new color (or default) replaces the old.
  const applyColor = (name: string | null) => {
    const view = viewRef.current; if (!view || !tbRef.current) return;
    const { from, to } = tbRef.current;
    let tr = view.state.tr.removeMark(from, to, richSchema.marks.color);
    if (name) tr = tr.addMark(from, to, richSchema.marks.color.create({ name }));
    view.dispatch(tr);
    view.focus();
    setTb(computeToolbar(view));
  };

  return (
    <>
      <div ref={hostRef} className="zb-rich-pm" style={{ display: 'contents' }} />
      {tb && (
        <InlineToolbar
          tb={tb} linkOpen={linkOpen}
          blockType={props.type}
          turnIntoOptions={props.turnIntoOptions}
          onTurnInto={props.onTurnInto && ((t) => {
            const sel = tbRef.current;
            if (sel) props.onTurnInto!(t, sel.from - 1, sel.to - 1);
          })}
          remember={props.remember && {
            ...props.remember,
            // Read at the moment the field opens, not when the toolbar rendered:
            // the selection is the source of truth and it can still change under
            // a toolbar that is already on screen.
            selectedText: () => {
              const view = viewRef.current; const sel = tbRef.current;
              if (!view || !sel) return '';
              // ' ' as the block separator — a selection spanning a hard break
              // must not weld two words together.
              return view.state.doc.textBetween(sel.from, sel.to, ' ', ' ');
            },
          }}
          onColor={applyColor}
          onToggle={(m) => applyMark(richSchema.marks[m])}
          onOpenLink={() => setLinkOpen(true)}
          onApplyLink={(href) => { applyMark(richSchema.marks.link, { href }); setLinkOpen(false); }}
          onRemoveLink={() => { applyMark(richSchema.marks.link, undefined, true); setLinkOpen(false); }}
          onCloseLink={() => { setLinkOpen(false); viewRef.current?.focus(); }}
        />
      )}
    </>
  );
}

// ── the floating toolbar (§7.3): B · i · U · S · code · link ────────────────
// Chrome now comes from the canonical <Toolbar>/<ToolbarButton> + <Menu…> DS
// primitives (components/ds/ui) — no more hand-rolled TB_* consts.

// The link editor mounts fresh each time it opens, so its draft state
// initializes from the selection's current link without any sync effect.
function LinkEditor({ current, onApply, onRemove, onClose }: {
  current: string | null;
  onApply: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(current ?? '');
  const submit = () => {
    const s = draft.trim();
    if (!s) { onClose(); return; }
    const url = /^https?:\/\//i.test(s) ? s : 'https://' + s;
    try { new URL(url); onApply(url); } catch { /* keep editing */ }
  };
  return (
    <div className="flex items-center gap-1.5 px-0.5">
      <span className="shrink-0 text-ink-600"><Icon icon={Link2} size={14} /></span>
      <input data-chromeless
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
        placeholder="Paste or type a link…"
        autoComplete="off" data-1p-ignore data-lpignore="true"
        className="w-[210px] border-0 bg-transparent text-meta text-ink-900 outline-none placeholder:text-ink-500"
      />
      {current && (
        <ToolbarButton onClick={onRemove} title="Remove link" aria-label="Remove link">
          <Icon icon={X} size={14} />
        </ToolbarButton>
      )}
    </div>
  );
}

/**
 * "Remember this" — Memory's marked-capture gesture (§7X §4.2), in the one
 * place where selecting text already means something.
 *
 * It mounts fresh with the selected text so the fact can be TRIMMED before it is
 * stored. That extra keystroke is deliberate and it is the one place we diverge
 * from mymind's "saving costs one gesture and no decisions": mymind saves images
 * and links, which need no editing, whereas a fact pulled out of prose almost
 * never arrives well-formed — "…they mentioned they'd prefer invoices on the
 * 1st, which…" is not a memory until someone trims it. Saving the raw selection
 * would fill Memory with sentence fragments, and the module's own success
 * measure is that facts are re-readable in one line.
 *
 * `subjectLabel` is shown, never chosen: the caller inferred it (§7X — the
 * doc's client, else the doc itself) and naming it out loud is what keeps the
 * "zero surprise" metric at zero.
 */
function RememberEditor({ initial, subjectLabel, max, onSave, onClose }: {
  initial: string;
  subjectLabel: string;
  max: number;
  onSave: (body: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const over = draft.trim().length - max;

  const submit = async () => {
    if (busy || !draft.trim() || over > 0) return;
    setBusy(true);
    try {
      const error = await onSave(draft);
      if (error) setErr(error);
      else onClose();
    } catch (e) {
      // The host's save is a server action and can REJECT (expired session,
      // dropped connection). Without `finally` the field stays disabled with the
      // user's sentence trapped in it — and this one is inside a floating
      // toolbar, so there is nowhere for them to go but Esc.
      // Deliberately NOT `e.message`: an exception here is a thrown server
      // action (an expired session, a dropped connection) and its message is
      // engineering vocabulary — "Not authenticated" is not UI copy. The
      // expected refusals all come back as `{ error }` with a real sentence.
      void e;
      setErr('That didn’t save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-0.5 px-0.5 py-0.5">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-ink-600"><Icon icon={Brain} size={14} /></span>
        <input data-chromeless
          autoFocus value={draft} onChange={(e) => { setDraft(e.target.value); if (err) setErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
          placeholder="The fact, in one line…"
          aria-label={`Remember about ${subjectLabel}`}
          aria-invalid={!!err || over > 0}
          autoComplete="off" data-1p-ignore data-lpignore="true"
          className="w-[280px] border-0 bg-transparent text-meta text-ink-900 outline-none placeholder:text-ink-500"
        />
        {/* Only in the last stretch — a counter on a short fact is a warning
            about a limit nobody was near. */}
        {max - draft.trim().length <= 40 && (
          <span className={cn('shrink-0 tabular-nums text-caption', over > 0 ? 'text-danger-600' : 'text-ink-500')}>
            {max - draft.trim().length}
          </span>
        )}
      </div>
      <span className={cn('pl-[22px] text-caption', err ? 'text-danger-600' : 'text-ink-500')}>
        {err ?? `Remember about ${subjectLabel} · Enter saves`}
      </span>
    </div>
  );
}

// The turn-into and color dropdowns reuse the canonical <MenuPanel>; only the
// absolute positioning (top offset, width, edge) is set per use.
const TB_PANEL_POS = 'absolute top-[calc(100%+6px)] max-h-[280px] w-[190px] overflow-y-auto';

function InlineToolbar({ tb, linkOpen, blockType, turnIntoOptions, onTurnInto, onColor, onToggle, onOpenLink, onApplyLink, onRemoveLink, onCloseLink, remember }: {
  tb: ToolbarState; linkOpen: boolean;
  blockType: string;
  turnIntoOptions?: TurnIntoOption[];
  onTurnInto?: (type: string) => void;
  onColor: (name: string | null) => void;
  onToggle: (m: 'b' | 'i' | 'u' | 's' | 'c') => void;
  onOpenLink: () => void;
  onApplyLink: (href: string) => void;
  onRemoveLink: () => void;
  onCloseLink: () => void;
  /** Memory's marked capture (§7X). Absent when the host cannot record facts. */
  remember?: { subjectLabel: string; max: number; selectedText: () => string; onSave: (body: string) => Promise<string | null> };
}) {
  // One dropdown at a time: the turn-into list or the color panel.
  const [drop, setDrop] = useState<'turn' | 'color' | null>(null);
  // The remember field takes over the whole bar, exactly as the link editor
  // does — one temporary mode, never two panels fighting for the same 320px.
  const [rememberOpen, setRememberOpen] = useState(false);
  const turnLabel = turnIntoOptions?.find((o) => o.type === blockType)?.label ?? blockType;
  const colorSwatch: React.CSSProperties = tb.color
    ? tb.color.endsWith('-bg')
      ? { background: `var(--pal-${tb.color.slice(0, -3)}-bg)`, borderRadius: 2, padding: '0 2px' }
      : { color: `var(--pal-${tb.color}-text)` }
    : {};
  return (
    <Toolbar
      floating
      onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
      className="fixed z-dropdown zb-enter [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]"
      // Position is computed from the selection coords — geometry stays inline.
      // `translate`, not `transform`: a running animation outranks an inline style,
      // so the entrance keyframe used to REPLACE a positioning `transform` and the
      // toolbar faded in 146px right and 46px low, over the words just selected,
      // then jumped. The two properties compose instead. It grows out of the edge
      // that faces the selection.
      style={{
        left: tb.x,
        top: tb.y,
        translate: tb.below ? '-50% 8px' : '-50% calc(-100% - 8px)',
        transformOrigin: tb.below ? '50% 0%' : '50% 100%',
      }}
    >
      {linkOpen ? (
        <LinkEditor current={tb.link} onApply={onApplyLink} onRemove={onRemoveLink} onClose={onCloseLink} />
      ) : rememberOpen && remember ? (
        <RememberEditor
          initial={remember.selectedText()}
          subjectLabel={remember.subjectLabel}
          max={remember.max}
          onSave={remember.onSave}
          onClose={() => setRememberOpen(false)}
        />
      ) : (
        <>
          {turnIntoOptions && onTurnInto && (
            <>
              <ToolbarButton
                wide active={drop === 'turn'}
                onClick={() => setDrop((d) => (d === 'turn' ? null : 'turn'))}
                title="Turn into" aria-label="Turn into" aria-expanded={drop === 'turn'}
                className="whitespace-nowrap text-meta"
              >
                {turnLabel} <Icon icon={ChevronDown} size={12} />
              </ToolbarButton>
              <ToolbarSeparator />
            </>
          )}
          <ToolbarButton active={tb.b} onClick={() => onToggle('b')} title="Bold ⌘B" aria-label="Bold" aria-pressed={tb.b}><Icon icon={Bold} size={16} weight={tb.b ? 'bold' : 'regular'} /></ToolbarButton>
          <ToolbarButton active={tb.i} onClick={() => onToggle('i')} title="Italic ⌘I" aria-label="Italic" aria-pressed={tb.i}><Icon icon={Italic} size={16} /></ToolbarButton>
          <ToolbarButton active={tb.u} onClick={() => onToggle('u')} title="Underline ⌘U" aria-label="Underline" aria-pressed={tb.u}><Icon icon={Underline} size={16} /></ToolbarButton>
          <ToolbarButton active={tb.s} onClick={() => onToggle('s')} title="Strikethrough ⌘⇧S" aria-label="Strikethrough" aria-pressed={tb.s}><Icon icon={Strikethrough} size={16} /></ToolbarButton>
          <ToolbarButton active={tb.c} onClick={() => onToggle('c')} title="Code ⌘E" aria-label="Inline code" aria-pressed={tb.c}><Icon icon={CodeIcon} size={16} /></ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton active={!!tb.link} onClick={onOpenLink} title="Link ⌘K" aria-label="Link" aria-pressed={!!tb.link}><Icon icon={Link2} size={16} /></ToolbarButton>
          <ToolbarButton
            wide active={drop === 'color' || !!tb.color}
            onClick={() => setDrop((d) => (d === 'color' ? null : 'color'))}
            title="Text color" aria-label="Text color" aria-expanded={drop === 'color'}
            className="gap-0.5 px-[5px]"
          >
            {/* Swatch reflects the selection's colour — user palette, inline. */}
            <span className="text-caption font-semibold leading-none" style={colorSwatch}>A</span>
            <Icon icon={ChevronDown} size={12} />
          </ToolbarButton>
          {/* Last, and behind a separator: everything to its left changes how the
              selection LOOKS, this one takes the selection somewhere else. */}
          {remember && (
            <>
              <ToolbarSeparator />
              <ToolbarButton
                onClick={() => { setDrop(null); setRememberOpen(true); }}
                title="Remember this" aria-label="Remember this"
              >
                <Icon icon={Brain} size={16} />
              </ToolbarButton>
            </>
          )}
          {drop === 'turn' && turnIntoOptions && onTurnInto && (
            <MenuPanel className={cn(TB_PANEL_POS, 'left-0')}>
              {turnIntoOptions.map((o) => (
                <MenuItem key={o.type} icon={<Icon icon={o.icon} size={14} />} active={o.type === blockType} onClick={() => { setDrop(null); if (o.type !== blockType) onTurnInto(o.type); }}>
                  {o.label}
                </MenuItem>
              ))}
            </MenuPanel>
          )}
          {drop === 'color' && (
            <MenuPanel className={cn(TB_PANEL_POS, 'right-0')}>
              <MenuLabel>Text color</MenuLabel>
              <MenuItem icon={<MenuGlyph>A</MenuGlyph>} active={!tb.color} onClick={() => { setDrop(null); onColor(null); }}>Default</MenuItem>
              {PALETTE_NAMES.map((n) => (
                <MenuItem key={n} className="capitalize" active={tb.color === n} icon={<MenuGlyph style={{ color: `var(--pal-${n}-text)` }}>A</MenuGlyph>} onClick={() => { setDrop(null); onColor(n); }}>{n}</MenuItem>
              ))}
              <MenuLabel>Background</MenuLabel>
              {PALETTE_NAMES.map((n) => (
                <MenuItem key={n + '-bg'} className="capitalize" active={tb.color === n + '-bg'} icon={<MenuGlyph style={{ background: `var(--pal-${n}-bg)` }}>A</MenuGlyph>} onClick={() => { setDrop(null); onColor(n + '-bg'); }}>{n} background</MenuItem>
              ))}
            </MenuPanel>
          )}
        </>
      )}
    </Toolbar>
  );
}

// One stylesheet for both renders (mounted once by the editor root).
export function RichTextStyles() {
  return (
    <style>{`
      .zb-rich-static, .zb-rich-pm .ProseMirror { min-height: 1.5em; }
      .zb-rich-pm .ProseMirror { outline: none; white-space: pre-wrap; word-break: break-word; }
      .zb-rich-p { margin: 0; padding: 0; }
      .zb-rich-b, strong.zb-rich-b { font-weight: 600; }
      .zb-rich-i { font-style: italic; }
      .zb-rich-u { text-decoration: underline; }
      .zb-rich-s { text-decoration: line-through; }
      .zb-rich-c { font-family: var(--font-mono); font-size: 85%; background: var(--color-surface-fill); border-radius: var(--radius-xs); padding: 1px 4px; }
      .zb-rich-a { color: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
      .zb-rich-ph { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* The open slash menu's "/query" — a soft pill in the one hover wash, its
         padding drawn by a spread shadow so the text does not move. With nothing
         typed yet, the placeholder after the caret completes the pill. */
      .zb-trigger { background: var(--color-surface-hover); box-shadow: 0 0 0 3px var(--color-surface-hover); border-radius: var(--radius-xs); }
      .zb-trigger-open { border-top-right-radius: 0; border-bottom-right-radius: 0; }
      .zb-trigger-ph { color: var(--color-ink-500); background: var(--color-surface-hover); box-shadow: 0 0 0 3px var(--color-surface-hover); border-radius: 0 var(--radius-xs) var(--radius-xs) 0; pointer-events: none; user-select: none; }
      @keyframes zbTbIn { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
  );
}
