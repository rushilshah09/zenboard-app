// The @-mention write path — the half of the fabric (§3.4) that was missing.
//
// Migration 0027 shipped the `mentions` table and `lib/connected.ts` has been
// READING it since; nothing ever wrote a row, so every backlink section in the
// app has been rendering an empty list against a table that could never fill.
// This module is the producer.
//
// WHAT COUNTS AS A MENTION: an internal link. Zenboard already has one canonical
// address per record (`recordHref`), so a span whose href resolves to a record
// IS a reference to it — whether it arrived from an @-picker, a pasted "Copy
// link" URL, or a dragged breadcrumb. That choice is why this needed no new
// inline node type, no ProseMirror schema change, and no migration: the edges
// were already being typed into documents, and nobody was collecting them.
//
// Pure and synchronous. `lib/actions/mentions.ts` does the writing.
import { spansOf, removeRange, insertSpan, type RichSpan } from '@/lib/rich';
import { parseRecordHref, type EntityRef, type EntityType } from '@/lib/connected';

/** One edge as it will be stored. `anchor` deep-links a backlink to the exact
 *  block; `context` is the line it appeared in, snapshotted at write time. */
export type MentionEdge = {
  target_type: EntityType;
  target_id: string;
  anchor: string | null;
  context: string | null;
};

/** The block shape this reads — deliberately narrower than `lib/blocks`.Block,
 *  so a doc, a comment or a row body can all be passed in. */
export type MentionBlock = { id?: string; text?: string; spans?: { text: string; link?: string }[] };

/** How much of the surrounding line to keep. A backlink that shows only a title
 *  is a list; one that shows the sentence it appeared in is a memory (§7H). */
const CONTEXT_MAX = 180;

const trimContext = (s: string): string | null => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length <= CONTEXT_MAX ? t : t.slice(0, CONTEXT_MAX - 1).trimEnd() + '…';
};

/** `type:id:anchor` — the shape of 0027's unique index, so "already stored" and
 *  "present in the text" are comparable without a join. */
export const edgeKey = (e: Pick<MentionEdge, 'target_type' | 'target_id' | 'anchor'>) =>
  `${e.target_type}:${e.target_id}:${e.anchor ?? ''}`;

/**
 * Every record referenced by a block document.
 *
 * Deduped on (target, anchor): naming the same client twice in ONE block is one
 * edge, but naming it from two blocks is two, because each deep-links somewhere
 * different — the same rule 0027's unique index enforces.
 *
 * `self` drops a document's links to itself, which are navigation, not
 * references, and would otherwise render as a backlink to the page you are on.
 */
export function mentionsInBlocks(
  blocks: MentionBlock[] | null | undefined,
  opts: { self?: EntityRef; origin?: string } = {},
): MentionEdge[] {
  const out = new Map<string, MentionEdge>();
  for (const b of blocks ?? []) {
    if (!b) continue;
    const spans = spansOf({ text: b.text ?? '', spans: b.spans as never });
    for (const sp of spans) {
      if (!sp.link) continue;
      const ref = parseRecordHref(sp.link, opts.origin);
      if (!ref) continue;
      if (opts.self && ref.type === opts.self.type && ref.id === opts.self.id) continue;
      const edge: MentionEdge = {
        target_type: ref.type,
        target_id: ref.id,
        anchor: b.id ?? null,
        // The whole line, not the link's own words: "see Acme's brief" is worth
        // more at the other end than "Acme".
        context: trimContext(b.text ?? spans.map((s) => s.text).join('')),
      };
      const k = edgeKey(edge);
      if (!out.has(k)) out.set(k, edge);
    }
  }
  return [...out.values()];
}

/** The property shape this reads — narrower than `DocProp`, for the same reason
 *  `MentionBlock` is narrower than `Block`. */
export type MentionProp = { id?: string; name?: string; type?: string; records?: EntityRef[] };

/**
 * Every record referenced by a page's PROPERTIES.
 *
 * A relation property is a reference, so it is an edge — otherwise the Connected
 * panel would show the client you mentioned in a sentence and miss the one you
 * put in the "Client" field, which is the more deliberate of the two. Sharing
 * the `mentions` table rather than inventing a second edge store is the same
 * decision 0027 made: an internal link and a relation differ in how they were
 * typed, not in what they mean.
 *
 * The anchor is the PROPERTY id, so a relation and a body link to the same
 * record stay two distinct edges — which is right, they are two references —
 * and `context` is the property's name, since "Client" is what a backlink at
 * the far end most usefully says about why it exists.
 */
export function mentionsInProps(
  props: MentionProp[] | null | undefined,
  opts: { self?: EntityRef } = {},
): MentionEdge[] {
  const out = new Map<string, MentionEdge>();
  for (const p of props ?? []) {
    if (!p || p.type !== 'relation') continue;
    for (const ref of p.records ?? []) {
      if (!ref?.type || !ref.id) continue;
      if (opts.self && ref.type === opts.self.type && ref.id === opts.self.id) continue;
      const edge: MentionEdge = {
        target_type: ref.type,
        target_id: ref.id,
        anchor: p.id ?? null,
        context: trimContext(p.name ?? ''),
      };
      const k = edgeKey(edge);
      if (!out.has(k)) out.set(k, edge);
    }
  }
  return [...out.values()];
}

/**
 * Every record a document references, from its body AND its properties.
 *
 * One function because one save writes one set of edges: if the two halves were
 * synced separately, each would see the other's rows as "not in my source" and
 * delete them on every keystroke.
 */
export function mentionsInDoc(
  blocks: MentionBlock[] | null | undefined,
  props: MentionProp[] | null | undefined,
  opts: { self?: EntityRef; origin?: string } = {},
): MentionEdge[] {
  const out = new Map<string, MentionEdge>();
  for (const e of [...mentionsInBlocks(blocks, opts), ...mentionsInProps(props, opts)]) {
    const k = edgeKey(e);
    if (!out.has(k)) out.set(k, e);
  }
  return [...out.values()];
}

export type MentionDiff<T> = { insert: MentionEdge[]; remove: T[] };

/**
 * What a save actually has to write.
 *
 * Every keystroke in a document triggers a save, so re-writing every edge each
 * time would mean a delete-and-reinsert storm against a table the Connected
 * panel is reading. Only genuine changes move — and an unchanged document
 * produces an empty diff, which the caller skips entirely.
 *
 * `context` deliberately does NOT count as a change. Editing the sentence around
 * a link would otherwise rewrite the row on every keystroke, and a slightly
 * stale snippet is worth far less than the write it would cost.
 */
export function diffMentions<T extends Pick<MentionEdge, 'target_type' | 'target_id' | 'anchor'> & { id: string }>(
  existing: T[],
  next: MentionEdge[],
): MentionDiff<T> {
  const have = new Map(existing.map((e) => [edgeKey(e), e]));
  const want = new Map(next.map((e) => [edgeKey(e), e]));
  return {
    insert: [...want].filter(([k]) => !have.has(k)).map(([, e]) => e),
    remove: [...have].filter(([k]) => !want.has(k)).map(([, e]) => e),
  };
}

// ── Writing one, from the picker ────────────────────────────────────────────

export type MentionInsert = {
  text: string;
  spans?: RichSpan[];
  /** Where the caret lands: past the inserted name AND its trailing space. */
  caret: number;
};

/**
 * Replace a typed `@query` with the record's name, carrying its canonical link.
 *
 * That link is the whole mechanism: `mentionsInBlocks` above reads it back on
 * the next save and turns it into an edge. So this deliberately produces the
 * EXACT span a pasted "Copy link" URL produces — the fabric has one kind of
 * mention in it, not a picker flavour and a paste flavour.
 *
 * The trailing space is not decoration. The link mark is `inclusive: false`, so
 * typing on continues in plain text either way; the space is what makes
 * "@Acme is late" come out as a sentence rather than a name jammed against its
 * next word.
 *
 * Returns null when `at` no longer points at the trigger character — a
 * keystroke can land between clicking a row and this running, and silently
 * cutting the wrong range would eat the user's text.
 */
export function insertMention(
  block: { text: string; spans?: RichSpan[] },
  trigger: { at: number; query: string },
  label: string,
  href: string,
  char = '@',
): MentionInsert | null {
  const { at, query } = trigger;
  if (block.text.slice(at, at + char.length) !== char) return null;
  const name = label.trim() || 'Untitled';
  const cut = removeRange(block, at, at + char.length + query.length);
  const linked = insertSpan(cut, at, { text: name, link: href });
  const withSpace = insertSpan(linked, at + name.length, { text: ' ' });
  return { ...withSpace, caret: at + name.length + 1 };
}
