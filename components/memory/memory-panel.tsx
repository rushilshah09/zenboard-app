'use client';
// Memory on a record — master plan §7X §5.2/§5.3, migration 0029.
//
// What you'd otherwise have gone digging for, on the page where you'd have gone
// digging. Opening a client should tell you how they pay and how they reply
// without you opening three screens; that is the module's whole measure of
// success, and this panel is where it is either true or it isn't.
//
// A SIBLING OF <ConnectedPanel>, NOT A GROUP INSIDE IT. Connected renders
// references — a label, a status, a chevron — and a fact is a sentence. Putting
// facts in that panel would mean either truncating them to four words (a fact
// you cannot read is not a fact) or teaching one row component two typographies.
// Same heading rung, same hairlines, same absence of fill, so the two read as
// one idea in two registers.
//
// BENCHMARK (rule 7). Neither Notion nor Linear has this surface: Notion's
// nearest is a backlinks list and Linear's is "similar issues", and both are
// pointers to other records rather than standing truths. The references that DO
// have it are mymind (a wall of cards, zero organisation, one gesture to save)
// and Mem0 (extracted atomic facts). We take the one gesture and the atomicity;
// we refuse the wall — three facts on the record they are about, the rest one
// click away, because a scrolling card wall is a thing you have to READ and the
// point of this panel is that you don't.
import { useEffect, useState } from 'react';
import { Brain, Plus } from '@/components/ds/icons';
import { Icon, EmptyLine, toast } from '@/components/ds/ui';
import { MemoryRow, FactField, sourceRef } from '@/components/memory/memory-row';
import { createClient } from '@/lib/supabase/client';
import { resolveRefs } from '@/lib/connected';
import type { EntityType } from '@/lib/connected';
import {
  loadMemoriesFor, sortMemories, alreadyKnown, AMBIENT_MAX,
  type Memory, type MemorySubject,
} from '@/lib/memory';
import { remember, forgetMemory } from '@/lib/actions/memory';


// ── The panel ────────────────────────────────────────────────────────────────

export interface MemoryPanelProps {
  /** What these facts are about. */
  subject: MemorySubject;
  /**
   * Pre-loaded rows — skips the fetch entirely (harnesses, tests, server-rendered
   * hosts). A SEED, read once: unlike `<ConnectedPanel>`'s equivalent this panel
   * also writes, so the list has to be local state, and a literal array prop is a
   * new reference on every render — feeding it through `useServerState` would
   * snap back during render forever.
   */
  memories?: Memory[];
  /**
   * Whether this surface can record a fact.
   *
   * Off by default, and that is a judgement rather than a permission: durable
   * facts accumulate about people and engagements, not about a task you will
   * close on Thursday. A task and a doc SHOW what is known and stay out of the
   * way; a client offers to learn.
   */
  canAdd?: boolean;
  /** What the fact came from, for the receipt. */
  source?: { type: string; id: string; anchor?: string | null };
  className?: string;
}

export function MemoryPanel({ subject, memories: seed, canAdd, source, className }: MemoryPanelProps) {
  const [list, setList] = useState<Memory[] | null>(seed ?? null);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  /** `type:id` → name, for the receipts. Empty until resolved; a row without an
   *  entry falls back to the un-linked phrasing, so this never blocks a render. */
  const [sourceNames, setSourceNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (seed) return;
    let cancelled = false;
    (async () => {
      // `loadMemoriesFor` returns [] rather than throwing when 0029 has not been
      // applied, so the gate needs no separate probe on the read path.
      const next = await loadMemoriesFor(createClient(), subject);
      if (!cancelled) setList(next);
    })();
    return () => { cancelled = true; };
  }, [subject.type, subject.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The receipts' names, in ONE batched call through the app's single answer to
  // "what is this id called". Skipped entirely when no row has a source, which
  // is the common case — a panel of typed facts costs no second query.
  const sourceKeys = (list ?? []).map((m) => { const r = sourceRef(m); return r ? `${r.type}:${r.id}` : ''; })
    .filter(Boolean).join(',');
  useEffect(() => {
    if (!sourceKeys) return;
    let cancelled = false;
    const refs = sourceKeys.split(',').map((k) => {
      const [type, id] = k.split(':');
      return { type: type as EntityType, id };
    });
    resolveRefs(createClient(), refs).then((found) => { if (!cancelled) setSourceNames(found); });
    return () => { cancelled = true; };
  }, [sourceKeys]);

  const replace = (id: string) => (next: Memory | null) => {
    setList((cur) => {
      const base = cur ?? [];
      return sortMemories(next ? base.map((m) => (m.id === id ? next : m)) : base.filter((m) => m.id !== id));
    });
  };

  const add = async (body: string): Promise<string | null> => {
    // The duplicate is caught locally first purely so the message is instant and
    // specific; 0029's partial unique index is what actually guarantees it, and
    // `remember()` returns the same sentence when two tabs race.
    const dup = alreadyKnown(list ?? [], subject, body);
    if (dup) return 'You already remember that.';

    const res = await remember({ body, subject, origin: source ? 'marked' : 'told', source });
    if ('error' in res) return res.error;

    const created = res.memory;
    setList((cur) => sortMemories([...(cur ?? []), created]));
    setAdding(false);
    toast({
      message: 'Remembered.',
      action: {
        label: 'Undo',
        onAction: async () => {
          // A hard delete, and the one place the product ever performs one
          // without asking: the row is seconds old and undoing your own action
          // should leave nothing behind (§5.4 / open question 3).
          await forgetMemory(created.id);
          setList((cur) => (cur ?? []).filter((m) => m.id !== created.id));
        },
      },
    });
    return null;
  };

  // Nothing fetched yet → nothing. No skeleton: this sits below content that is
  // already useful, and a placeholder flashing there reads as breakage.
  if (!list) return null;
  // Nothing known and nothing to offer → the panel does not exist. An empty
  // "Memory" heading on every task is chrome asking to be fed.
  if (list.length === 0 && !canAdd) return null;

  const shown = expanded ? list : list.slice(0, AMBIENT_MAX);
  const hidden = list.length - shown.length;
  // Reserved on every row, or on none — one starred fact must not indent its
  // own sentence past its neighbours'.
  const anyPinned = shown.some((m) => m.pinned);

  return (
    <section className={className} aria-label="Memory">
      <div className="flex items-center gap-2 pb-1.5">
        <Icon icon={Brain} size={14} className="text-ink-500" />
        <h3 className="text-meta font-semibold text-ink-800">Memory</h3>
        <span className="text-caption text-ink-500 tabular-nums">{list.length}</span>
      </div>

      {list.length === 0 && canAdd && !adding && (
        <EmptyLine>What you learn about them, kept where you&rsquo;ll need it.</EmptyLine>
      )}

      <ul className="divide-y divide-line-soft">
        {shown.map((m) => {
          const ref = sourceRef(m);
          return (
            <MemoryRow
              key={m.id} m={m} gutter={anyPinned}
              sourceLabel={ref ? sourceNames.get(`${ref.type}:${ref.id}`) : undefined}
              onChanged={replace(m.id)}
            />
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="focus-ring -mx-1.5 rounded-md px-1.5 py-1 text-caption text-ink-500 hover:text-ink-800"
        >
          Show {hidden} more
        </button>
      )}

      {canAdd && (adding
        ? <FactField onSubmit={add} onCancel={() => setAdding(false)} />
        : (
          <button
            onClick={() => setAdding(true)}
            className="focus-ring touch-row -mx-1.5 mt-0.5 flex min-h-8 w-full items-center gap-2 rounded-md px-1.5 text-ui text-ink-500 hover:bg-surface-hover hover:text-ink-800"
          >
            <Icon icon={Plus} size={14} />
            Remember something
          </button>
        ))}
    </section>
  );
}
