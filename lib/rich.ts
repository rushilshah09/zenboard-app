// Rich text spans — the inline-formatting model for the block editor.
// A block's visible text lives in Block.text (plain); formatting lives in
// Block.spans (sparse: absent means unformatted). The markdown-marker
// encoding (**bold**, *italic*, `code`, ~~strike~~, [label](url)) remains the
// interchange format: lib/clipboard.ts emits it on paste, blocksToMarkdown
// emits it on export, and legacy stored text carrying markers is lifted into
// spans on load (see liftText / normalize in lib/blocks.ts).
//
// Pure data module — no ProseMirror imports here; the PM bridge lives in
// components/documents/rich-text.tsx.

export type RichSpan = {
  text: string;
  b?: boolean; i?: boolean; u?: boolean; s?: boolean; c?: boolean; // bold/italic/underline/strike/code
  link?: string;
  // Span color — same encoding as Block.color: '<palette>' tints the text,
  // '<palette>-bg' washes the background (one slot, Notion-style). Dropped by
  // the markdown serialization; survives the internal block-JSON flavor.
  color?: string;
};

type Flags = Omit<RichSpan, 'text'>;

export const plainOf = (spans: RichSpan[]): string => spans.map((sp) => sp.text).join('');

// Spans for a block regardless of whether it stores them sparsely.
export function spansOf(b: { text: string; spans?: RichSpan[] }): RichSpan[] {
  if (b.spans?.length) return b.spans;
  return b.text ? [{ text: b.text }] : [];
}

// Sparse storage: plain single-run spans collapse back to undefined.
export function sparse(spans: RichSpan[]): RichSpan[] | undefined {
  const merged = mergeSpans(spans);
  if (!merged.length) return undefined;
  if (merged.length === 1 && !merged[0].b && !merged[0].i && !merged[0].u && !merged[0].s && !merged[0].c && !merged[0].link && !merged[0].color) return undefined;
  return merged;
}

const sameFlags = (a: RichSpan, b: RichSpan) =>
  !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && !!a.s === !!b.s && !!a.c === !!b.c && a.link === b.link && a.color === b.color;

export function mergeSpans(spans: RichSpan[]): RichSpan[] {
  const out: RichSpan[] = [];
  for (const sp of spans) {
    if (sp.text === '') continue;
    const prev = out[out.length - 1];
    if (prev && sameFlags(prev, sp)) prev.text += sp.text;
    else out.push({ ...sp });
  }
  return out;
}

// ── marker text → spans (the lift) ──────────────────────────────────────────
// Parses exactly the marker set lib/clipboard.ts serializes. Recursive so
// nested emphasis (**a *b* c**) survives; unclosed markers stay literal.
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
    if (!handled) { push(tk, flags); rest = rest.slice(tk.length); }
  }
  return mergeSpans(out);
}

// Does a string carry any marker syntax worth lifting?
export function hasMarkers(text: string): boolean {
  return /\*\*[^*]+\*\*|\*[^*\s][^*]*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(text);
}

// Lift a possibly-marker-carrying string into { plain text, sparse spans }.
export function liftText(text: string): { text: string; spans?: RichSpan[] } {
  if (!hasMarkers(text)) return { text };
  const spans = mdToSpans(text);
  return { text: plainOf(spans), spans: sparse(spans) };
}

// ── spans → marker text (export / copy) ─────────────────────────────────────
export function spansToMd(spans: RichSpan[] | undefined, fallback = ''): string {
  if (!spans?.length) return fallback;
  return spans.map((sp) => {
    let t = sp.text;
    if (sp.c) return '`' + t.replace(/`/g, '') + '`';
    if (sp.b) t = `**${t}**`;
    if (sp.s) t = `~~${t}~~`;
    if (sp.i) t = `*${t}*`;
    if (sp.link) t = `[${t}](${sp.link})`;
    return t;
  }).join('');
}

// ── span editing algebra (caret positions are plain-text offsets) ───────────
export function splitSpans(spans: RichSpan[], at: number): [RichSpan[], RichSpan[]] {
  const a: RichSpan[] = []; const b: RichSpan[] = [];
  let n = 0;
  for (const sp of spans) {
    const end = n + sp.text.length;
    if (end <= at) a.push({ ...sp });
    else if (n >= at) b.push({ ...sp });
    else { a.push({ ...sp, text: sp.text.slice(0, at - n) }); b.push({ ...sp, text: sp.text.slice(at - n) }); }
    n = end;
  }
  return [mergeSpans(a), mergeSpans(b)];
}

// Split a block's rich content at a caret → [head, tail] as {text, spans}.
export function cutAt(b: { text: string; spans?: RichSpan[] }, at: number): [{ text: string; spans?: RichSpan[] }, { text: string; spans?: RichSpan[] }] {
  const [a, t] = splitSpans(spansOf(b), Math.max(0, Math.min(at, b.text.length)));
  return [{ text: plainOf(a), spans: sparse(a) }, { text: plainOf(t), spans: sparse(t) }];
}

// Remove [from, to) from a block's rich content.
export function removeRange(b: { text: string; spans?: RichSpan[] }, from: number, to: number): { text: string; spans?: RichSpan[] } {
  const [head] = splitSpans(spansOf(b), from);
  const [, tail] = splitSpans(spansOf(b), to);
  const joined = mergeSpans([...head, ...tail]);
  return { text: plainOf(joined), spans: sparse(joined) };
}

// Insert a span at a plain-text offset (used by paste-link-over-selection).
export function insertSpan(b: { text: string; spans?: RichSpan[] }, at: number, span: RichSpan): { text: string; spans?: RichSpan[] } {
  const [head, tail] = splitSpans(spansOf(b), at);
  const joined = mergeSpans([...head, span, ...tail]);
  return { text: plainOf(joined), spans: sparse(joined) };
}

// Concatenate two blocks' rich content (Backspace merge).
export function concatRich(a: { text: string; spans?: RichSpan[] }, b: { text: string; spans?: RichSpan[] }): { text: string; spans?: RichSpan[] } {
  const joined = mergeSpans([...spansOf(a), ...spansOf(b)]);
  return { text: plainOf(joined), spans: sparse(joined) };
}
