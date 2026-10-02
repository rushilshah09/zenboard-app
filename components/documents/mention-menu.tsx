'use client';
// The @-mention picker — the ergonomic half of the fabric's write path.
//
// `lib/mentions.ts` established that a mention IS an internal link: a span whose
// href resolves through `parseRecordHref` becomes a real edge the next time the
// document saves. That worked from the day it shipped, but only if you already
// had the record's URL on your clipboard. This is the picker that makes it a
// keystroke — and it inserts exactly the same thing a pasted link would, so
// there is still only one kind of mention in the product.
//
// Benchmark (Notion's @ menu):
//  · opens on `@` at a word start; a bare `@` lists recent pages — matched, and
//    "recent" here is a server answer (see `searchRecords`) rather than a local
//    one, because a record can be renamed or deleted and a stale row in a picker
//    is worse than no row.
//  · the query tolerates spaces, because titles have them — matched, bounded by
//    `MENTION_MAX_QUERY` so a stray `@` cannot leave a menu open for a paragraph.
//  · results are page titles only, not page bodies — matched deliberately
//    (`deep: false`): the picker writes the record's NAME into your sentence, so
//    matching on anything else makes the inserted text unpredictable.
//  · Notion inserts an atomic chip carrying the page icon. We deliberately
//    differ: a Zenboard mention is a normal linked span, so it survives
//    plain-text export, copy-paste into another app, and ⌘F — and it needed no
//    ProseMirror schema change to exist. The cost is no inline icon; the type is
//    named on the picker row instead, where it actually helps you choose.
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { searchRecords, MENTIONABLE_TYPES, type RecordHit } from '@/lib/search';
import { MenuPanel, Icon } from '@/components/ds/ui';
import {
  SquareCheck, Kanban, Users, FileText, Receipt, SquarePen, AtSign, type IconType,
} from '@/components/ds/icons';
import { cn } from '@/lib/cn';

/** Longest `@…` query before the menu gives up and assumes you meant the character. */
export const MENTION_MAX_QUERY = 32;
/** Rows shown. Ranked, so the cap trims the least relevant, not a whole type. */
export const MENTION_LIMIT = 10;

// The same glyphs the ⌘K palette uses for the same types — a record has one
// face in this product.
const GLYPH: Record<string, IconType> = {
  doc: FileText, task: SquareCheck, project: Kanban,
  client: Users, invoice: Receipt, form: SquarePen,
};
// Singular, sentence case, per the glossary (Doc/Documents, never "Note").
const TYPE_LABEL: Record<string, string> = {
  doc: 'Document', task: 'Task', project: 'Project',
  client: 'Client', invoice: 'Invoice', form: 'Form',
};

export const mentionTypeLabel = (h: RecordHit): string =>
  [TYPE_LABEL[h.type] ?? h.type, h.meta].filter(Boolean).join(' · ');

export type MentionSearch = { hits: RecordHit[]; loading: boolean };

// Backspacing through a query must not re-fetch what was on screen a keystroke
// ago. Module-level so it survives the menu closing and reopening inside one
// writing session; short TTL because a record renamed in another tab should not
// keep its old name here for the rest of the day.
const CACHE_TTL = 30_000;
const CACHE_MAX = 40;
const cache = new Map<string, { at: number; hits: RecordHit[] }>();

// Read-only, so it is safe to consult while rendering. Expired entries are
// reported as missing and swept on the next write rather than deleted here — a
// getter that mutates would make render impure for no benefit.
const peek = (q: string): RecordHit[] | null => {
  const e = cache.get(q);
  if (!e || Date.now() - e.at > CACHE_TTL) return null;
  return e.hits;
};
const remember = (q: string, hits: RecordHit[]) => {
  cache.set(q, { at: Date.now(), hits });
  for (const [k, v] of cache) {
    if (cache.size <= CACHE_MAX && Date.now() - v.at <= CACHE_TTL) break;
    if (k !== q) cache.delete(k);
  }
};

/**
 * Records matching the open `@` query. `query === null` means the menu is
 * closed and nothing is fetched.
 *
 * A bare `@` fires immediately — there is nothing to wait for and the recent
 * list is the whole point of pressing it. A typed query waits out the debounce,
 * so walking a word costs one request rather than one per letter.
 *
 * While a longer query is in flight the PREVIOUS results stay on screen, so
 * refining a search does not strobe the menu between a list and a spinner. The
 * previous results are shown only when the old query is a prefix of the new one
 * — i.e. only while you are narrowing. That restriction is a correctness rule,
 * not a nicety: rows you can press Enter on must never belong to a search that
 * has nothing to do with what you have typed.
 */
export function useMentionSearch(query: string | null): MentionSearch {
  const [done, setDone] = useState<{ query: string; hits: RecordHit[] } | null>(null);
  // Only the newest request may land; an earlier one resolving late must not
  // repaint the menu with results for a query you have already typed past.
  const seq = useRef(0);

  useEffect(() => {
    if (query === null || peek(query)) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      void searchRecords(createClient(), query, { types: MENTIONABLE_TYPES, limit: 4, deep: false })
        .then((hits) => {
          if (seq.current !== mine) return;
          remember(query, hits);
          setDone({ query, hits });
        });
      // 150ms: under the ~200ms where a list starts to feel like it lagged the
      // keystroke, over the ~16ms that would fire on every letter of a word.
    }, query ? 150 : 0);
    return () => { clearTimeout(t); };
  }, [query]);

  if (query === null) return { hits: [], loading: false };
  const exact = peek(query) ?? (done?.query === query ? done.hits : null);
  if (exact) return { hits: exact, loading: false };
  const narrowing = done && done.query !== '' && query.startsWith(done.query);
  return { hits: narrowing ? done.hits : [], loading: true };
}

/**
 * The picker panel. Positioned by the caller at the caret (fixed, portalled) —
 * it draws rows and nothing else, so the editor keeps sole ownership of the
 * keyboard.
 *
 * Focus never leaves the editor, which rules out `aria-activedescendant`
 * (that would require calling the writing surface a `combobox` and mis-announce
 * the whole document). The active row is announced through a polite live region
 * instead, which is what a screen reader needs and costs the editor nothing.
 */
export function MentionMenu({ hits, loading, active, query, pick, listId }: {
  hits: RecordHit[];
  loading: boolean;
  active: number;
  query: string;
  pick: (h: RecordHit) => void;
  listId: string;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  // Keep the highlighted row in view when the arrow keys walk past the fold.
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const current = hits[active];
  return (
    <>
      <MenuPanel
        role="listbox"
        aria-label="Mention a record"
        id={listId}
        // preventDefault keeps the caret in the block — the editor never loses
        // focus to its own chrome (the slash menu's rule, kept identical).
        onMouseDown={(e) => e.preventDefault()}
        className="max-h-[292px] w-[288px] overflow-y-auto"
      >
        {!query && hits.length > 0 && (
          <div className="px-2.5 pb-1 pt-1 text-overline text-ink-500">Recent</div>
        )}
        {hits.map((h, i) => {
          const on = i === active;
          return (
            <button
              key={h.key}
              ref={on ? activeRef : null}
              role="option"
              aria-selected={on}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              className={cn(
                'zb-press flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-1.5 text-left transition-colors duration-fast',
                on ? 'bg-surface-hover' : 'bg-transparent',
              )}
            >
              <span className={cn('grid shrink-0 place-items-center', on ? 'text-ink-800' : 'text-ink-500')}>
                <Icon icon={GLYPH[h.type] ?? AtSign} size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{h.title}</span>
              <span className="shrink-0 text-caption text-ink-500">{mentionTypeLabel(h)}</span>
            </button>
          );
        })}
        {hits.length === 0 && (
          <div className="px-2.5 py-3.5 text-center">
            <div className="text-meta font-medium text-ink-600">
              {loading ? 'Searching…' : 'No matches'}
            </div>
            {/* One short line. The Esc hint is here rather than "try another
                name" because the thing worth teaching is that dismissing the
                menu keeps the “@” you typed — nobody needs to be told to retype. */}
            <div className="mt-0.5 text-caption text-ink-500">
              {loading ? 'One moment.' : 'Esc keeps the “@”.'}
            </div>
          </div>
        )}
      </MenuPanel>
      {/* Announced, not drawn: focus stays in the document, so this is how the
          highlighted row reaches a screen reader. */}
      <span aria-live="polite" className="sr">
        {current ? `${current.title}, ${mentionTypeLabel(current)}. ${active + 1} of ${hits.length}.` : ''}
      </span>
    </>
  );
}
