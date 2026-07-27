// M0 spike — RichSpan model + ProseMirror bridge. Spike-local: nothing in the
// product imports from here. Proves (a) the markdown-in-string → spans lift is
// lossless for the marker set lib/clipboard.ts emits, (b) spans round-trip
// cleanly through a PM doc.
import { Schema, type Node as PMNode, type Mark } from 'prosemirror-model';

export type RichSpan = {
  text: string;
  b?: boolean; i?: boolean; u?: boolean; s?: boolean; c?: boolean; // bold/italic/underline/strike/code
  link?: string;
};

export type SpikeKind = 'text' | 'h1' | 'h2' | 'h3' | 'bullet';

export type SpikeBlock = { id: string; type: SpikeKind; spans: RichSpan[] };

export const plain = (spans: RichSpan[]) => spans.map((s) => s.text).join('');

let seq = 0;
export const sid = () => 'sb' + (++seq).toString(36) + Math.random().toString(36).slice(2, 6);

// ── markdown-in-string → spans (the migration lift) ─────────────────────────
// Exact marker set clipboard.ts serializes: **b**, *i*, `c`, ~~s~~, [t](url).
// Recursive so nested emphasis (**a *b* c**) survives.
type Flags = Omit<RichSpan, 'text'>;

export function mdToSpans(text: string, flags: Flags = {}): RichSpan[] {
  const out: RichSpan[] = [];
  let rest = text;
  const push = (t: string, f: Flags) => { if (t) out.push({ text: t, ...f }); };
  while (rest) {
    const m = /(\*\*|\*|~~|`|\[)/.exec(rest);
    if (!m) { push(rest, flags); break; }
    push(rest.slice(0, m.index), flags);
    rest = rest.slice(m.index);
    const tk = m[1];
    let handled = false;
    if (tk === '[') {
      const lm = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(rest);
      if (lm) { push(lm[1], { ...flags, link: lm[2] }); rest = rest.slice(lm[0].length); handled = true; }
    } else {
      const close = rest.indexOf(tk, tk.length);
      if (close > tk.length) {
        const inner = rest.slice(tk.length, close);
        if (tk === '`') push(inner, { ...flags, c: true });
        else {
          const f = tk === '**' ? { ...flags, b: true } : tk === '~~' ? { ...flags, s: true } : { ...flags, i: true };
          mdToSpans(inner, f).forEach((sp) => out.push(sp));
        }
        rest = rest.slice(close + tk.length);
        handled = true;
      }
    }
    if (!handled) { push(tk, flags); rest = rest.slice(tk.length); } // unclosed marker: literal
  }
  return mergeSpans(out);
}

export function mergeSpans(spans: RichSpan[]): RichSpan[] {
  const out: RichSpan[] = [];
  for (const s of spans) {
    const p = out[out.length - 1];
    if (p && !!p.b === !!s.b && !!p.i === !!s.i && !!p.u === !!s.u && !!p.s === !!s.s && !!p.c === !!s.c && p.link === s.link) p.text += s.text;
    else out.push({ ...s });
  }
  return out.filter((s) => s.text !== '');
}

// Split a span array at a character offset — Enter-split / caret math.
export function splitSpans(spans: RichSpan[], at: number): [RichSpan[], RichSpan[]] {
  const a: RichSpan[] = []; const b: RichSpan[] = [];
  let n = 0;
  for (const s of spans) {
    const end = n + s.text.length;
    if (end <= at) a.push({ ...s });
    else if (n >= at) b.push({ ...s });
    else { a.push({ ...s, text: s.text.slice(0, at - n) }); b.push({ ...s, text: s.text.slice(at - n) }); }
    n = end;
  }
  return [mergeSpans(a), mergeSpans(b)];
}

// ── ProseMirror schema + doc bridge ──────────────────────────────────────────
// Single-paragraph doc: the active block edits exactly one block's inline
// content. Mark classes are shared with the static renderer so the swap is
// pixel-identical (Gate A: zero layout shift).
export const schema = new Schema({
  nodes: {
    doc: { content: 'para' },
    para: { content: 'inline*', toDOM: () => ['p', { class: 'sp-p' }, 0], parseDOM: [{ tag: 'p' }] },
    text: { group: 'inline' },
  },
  marks: {
    b: { toDOM: () => ['strong', { class: 'sp-b' }, 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }] },
    i: { toDOM: () => ['em', { class: 'sp-i' }, 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }] },
    u: { toDOM: () => ['span', { class: 'sp-u' }, 0], parseDOM: [{ tag: 'span.sp-u' }] },
    s: { toDOM: () => ['s', { class: 'sp-s' }, 0], parseDOM: [{ tag: 's' }] },
    c: { toDOM: () => ['code', { class: 'sp-code' }, 0], parseDOM: [{ tag: 'code' }] },
    link: {
      attrs: { href: {} },
      toDOM: (m: Mark) => ['a', { class: 'sp-link', href: m.attrs.href as string }, 0],
      parseDOM: [{ tag: 'a[href]', getAttrs: (el) => ({ href: (el as HTMLElement).getAttribute('href') }) }],
    },
  },
});

export function spansToDoc(spans: RichSpan[]): PMNode {
  const nodes = spans.filter((s) => s.text).map((s) => {
    const marks: Mark[] = [];
    if (s.b) marks.push(schema.marks.b.create());
    if (s.i) marks.push(schema.marks.i.create());
    if (s.u) marks.push(schema.marks.u.create());
    if (s.s) marks.push(schema.marks.s.create());
    if (s.c) marks.push(schema.marks.c.create());
    if (s.link) marks.push(schema.marks.link.create({ href: s.link }));
    return schema.text(s.text, marks);
  });
  return schema.node('doc', null, [schema.node('para', null, nodes)]);
}

export function docToSpans(doc: PMNode): RichSpan[] {
  const spans: RichSpan[] = [];
  doc.firstChild?.forEach((n) => {
    if (!n.isText || !n.text) return;
    const sp: RichSpan = { text: n.text };
    for (const m of n.marks) {
      if (m.type.name === 'b') sp.b = true;
      else if (m.type.name === 'i') sp.i = true;
      else if (m.type.name === 'u') sp.u = true;
      else if (m.type.name === 's') sp.s = true;
      else if (m.type.name === 'c') sp.c = true;
      else if (m.type.name === 'link') sp.link = m.attrs.href as string;
    }
    spans.push(sp);
  });
  return mergeSpans(spans);
}
