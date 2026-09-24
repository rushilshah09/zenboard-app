'use client';
// The Memory home — master plan §7X §7, M2.
//
// "The `/memory` page is for REVIEW, not browsing." So it is a page you READ:
// facts grouped by what they are about, densest first, with the whole lifecycle
// (pin · fix wording · this changed · archive · forget) on each row's menu. A
// wall of cards to scroll is mymind's product, not this one.
//
// THERE IS NO SEARCH FIELD HERE, and that is a decision rather than an omission:
// ⌘K is the one search (never-list), and memories joined that index in
// `lib/search.ts` as a `Recall` group rather than growing a sibling.
//
// TWO BANDS ASK QUESTIONS at the top: "Noticed" (M3 — a detected pattern) and
// "About to fade" (§5.4 — a fact gone quiet). Both render nothing when they have
// nothing to ask. "What contradicts" is still unbuilt: a contradiction needs two
// live facts that disagree, and supersession means the app does not currently
// produce that state — an empty heading would be chrome asking to be fed.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, ChevronRight, History as HistoryIcon, X } from '@/components/ds/icons';
import { Icon, EmptyState, EmptyLine, toast, DatePicker, Popover, PopoverTrigger, PopoverContent } from '@/components/ds/ui';
import { formatDay } from '@/lib/date';
import { PageLayout } from '@/components/ui/page-layout';
import { MemoryRow, FactField } from '@/components/memory/memory-row';
import { sortMemories, alreadyKnown, selfFirst, SELF, type Memory, type MemorySubject } from '@/lib/memory';
import { remember, forgetMemory, archiveMemory } from '@/lib/actions/memory';
import { NoticedBand } from '@/components/memory/noticed-band';
import { FadingBand } from '@/components/memory/fading-band';
import type { MemoryHome as HomeData, MemoryGroup } from '@/lib/memory-data';
import type { ProposalView } from '@/lib/memory-suggest';

function Group({ group, history, onAdd }: {
  group: MemoryGroup;
  /** Every chain on the page, keyed by the fact it belongs to. */
  history: Record<string, Memory[]>;
  /** Present only for "About you" — see the note at the call site. */
  onAdd?: (body: string) => Promise<string | null>;
}) {
  const [items, setItems] = useState<Memory[]>(group.items);
  const [adding, setAdding] = useState(false);
  const anyPinned = items.some((m) => m.pinned);

  const replace = (id: string) => (next: Memory | null) =>
    setItems((cur) => sortMemories(next ? cur.map((m) => (m.id === id ? next : m)) : cur.filter((m) => m.id !== id)));

  const add = async (body: string) => {
    const err = await onAdd!(body);
    if (err) return err;
    setAdding(false);
    return null;
  };

  return (
    <section className="border-t border-line-soft pt-4 first:border-0 first:pt-0">
      <div className="flex items-center gap-2 pb-1">
        {group.href ? (
          <a href={group.href} className="focus-ring group/h -mx-1 flex items-center gap-1 rounded-md px-1 text-meta font-semibold text-ink-800 hover:text-ink-900">
            {group.label}
            <Icon icon={ChevronRight} size={12} className="text-ink-500 opacity-0 transition-opacity group-hover/h:opacity-100" />
          </a>
        ) : (
          <h2 className={`text-meta font-semibold ${group.tombstone ? 'text-ink-500 line-through' : 'text-ink-800'}`}>
            {group.label}
          </h2>
        )}
        <span className="text-caption tabular-nums text-ink-500">{items.length}</span>
      </div>

      {items.length === 0 && !adding && onAdd && (
        <EmptyLine>Nothing yet — the things you keep re-deriving about yourself go here.</EmptyLine>
      )}

      <ul className="divide-y divide-line-soft">
        {items.map((m) => (
          <MemoryRow key={m.id} m={m} gutter={anyPinned} history={history[m.id]} onChanged={replace(m.id)} />
        ))}
      </ul>

      {onAdd && (adding
        ? <FactField onSubmit={add} onCancel={() => setAdding(false)} />
        : (
          <button
            onClick={() => setAdding(true)}
            className="focus-ring touch-row -mx-1.5 mt-0.5 flex min-h-8 items-center gap-2 rounded-md px-1.5 text-ui text-ink-500 hover:bg-surface-hover hover:text-ink-800"
          >
            <Icon icon={Brain} size={14} />
            Remember something about yourself
          </button>
        ))}
    </section>
  );
}

function Archived({ rows }: { rows: Memory[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(rows);
  if (items.length === 0) return null;

  return (
    <section className="mt-8 border-t border-line-soft pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring -mx-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-meta text-ink-500 hover:text-ink-800"
      >
        <Icon icon={ChevronRight} size={12} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform var(--duration-base) var(--ease-standard)' }} />
        Archived
        <span className="tabular-nums text-caption">{items.length}</span>
      </button>

      {open && (
        <ul className="mt-1 flex flex-col gap-1">
          {items.map((m) => (
            <li key={m.id} className="group flex items-start gap-2 py-1">
              <p className="min-w-0 flex-1 text-ui text-ink-500">{m.body}</p>
              {/* Restoring is the ONLY thing you can do to an archived fact here.
                  Archiving is reversible and that is its whole point; the rest of
                  the lifecycle belongs to facts that are still true. */}
              <button
                onClick={async () => {
                  const res = await archiveMemory(m.id, false);
                  if ('error' in res) return toast({ message: res.error, variant: 'error' });
                  setItems((cur) => cur.filter((x) => x.id !== m.id));
                  toast({ message: 'Restored.' });
                }}
                className="focus-ring reveal-on-hover shrink-0 rounded-md px-1.5 py-0.5 text-caption text-ink-500 hover:bg-surface-hover hover:text-ink-800"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "What was true in March" — the plan's §5 question, as a control.
 *
 * A DATE, not a slider or a diff view. The question people actually have is
 * "what did I know when I sent that quote", and a date is how they hold it.
 *
 * When a day is chosen the page states it in a full-width line rather than a
 * quiet chip: a screen showing March's facts that LOOKS like today's is the
 * worst outcome this module can produce, so the notice is the loudest thing on
 * the page and leaving is one click.
 */
function AsOfControl({ day }: { day?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // No conversion: <DatePicker> speaks the same YYYY-MM-DD the URL does. This
  // used to build a Date at noon on the way in and call `isoDateIn` on the way
  // out — the noon was there to dodge the UTC-date trap, which is a workaround
  // the string API removes rather than needing.
  const go = (iso: string) => {
    setOpen(false);
    router.push(iso ? `/memory?on=${iso}` : '/memory');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="focus-ring touch-row flex h-8 items-center gap-1.5 rounded-md px-2 text-caption text-ink-500 hover:bg-surface-hover hover:text-ink-800"
          aria-label="View what was true on a past day"
        >
          <Icon icon={HistoryIcon} size={14} />
          As of…
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2">
        <DatePicker aria-label="As of date" value={day ?? null} onValueChange={go} placeholder="1 March, last friday…" />
      </PopoverContent>
    </Popover>
  );
}

export function MemoryHome({ data, proposals = [] }: { data: HomeData; proposals?: ProposalView[] }) {
  // "About you" is the one subject with no other surface in the product, so the
  // page guarantees it exists even when empty — otherwise the only way to record
  // a fact about yourself would be a group that only appears once you already
  // have one.
  const selfGroup = data.groups.find((g) => g.subject.type === 'self');
  const [extraSelf, setExtraSelf] = useState<Memory[]>([]);
  // `selfFirst` is re-applied here rather than trusted from the loader: this
  // component also SYNTHESISES the group when it is missing, so it owns the
  // invariant either way. It is the same function the loader uses.
  // The synthesised "About you" exists to HOST CAPTURE. On a past day there is
  // no capture, so an empty group there would be a heading over nothing — it
  // would also imply you knew nothing about yourself that day, which is a
  // different claim from "this page cannot add facts to March".
  const groups: MemoryGroup[] = selfFirst(selfGroup
    ? data.groups.map((g) => (g === selfGroup ? { ...g, items: sortMemories([...g.items, ...extraSelf]) } : g))
    : data.asOfDay
      ? data.groups
      : [{ key: 'self:', subject: SELF, label: 'About you', items: extraSelf }, ...data.groups]);

  const addSelf = async (body: string): Promise<string | null> => {
    const known = [...(selfGroup?.items ?? []), ...extraSelf];
    if (alreadyKnown(known, SELF as MemorySubject, body)) return 'You already remember that.';
    const res = await remember({ body, subject: SELF });
    if ('error' in res) return res.error;
    const created = res.memory;
    setExtraSelf((cur) => [...cur, created]);
    toast({
      message: 'Remembered.',
      action: {
        label: 'Undo',
        onAction: async () => {
          await forgetMemory(created.id);
          setExtraSelf((cur) => cur.filter((m) => m.id !== created.id));
        },
      },
    });
    return null;
  };

  return (
    <PageLayout title="Memory" count={data.total} actions={<AsOfControl day={data.asOfDay} />}>
        {data.asOfDay && (
          // Loud on purpose. Everything below is history, and a reader who
          // misses that would act on a fact that stopped being true months ago.
          <div className="mb-5 flex items-center gap-2 border-b border-line pb-3">
            <Icon icon={HistoryIcon} size={14} className="shrink-0 text-ink-500" />
            <p className="min-w-0 flex-1 text-ui text-ink-800">
              What you knew on {formatDay(data.asOfDay, { year: true, long: true }) ?? data.asOfDay}
            </p>
            <a
              href="/memory"
              className="focus-ring touch-row flex h-8 shrink-0 items-center gap-1 rounded-md border border-line-strong px-2.5 text-caption text-ink-800 hover:bg-surface-hover"
            >
              <Icon icon={X} size={12} />
              Back to today
            </a>
          </div>
        )}
        {!data.supported ? (
          <EmptyState
            title="Memory isn’t switched on yet"
            description="Run migration 0029 to switch it on."
          />
        ) : (
          <>
            {/* Questions first, then what is already known. A proposal is the
                only thing on this page that is waiting on you. */}
            <NoticedBand proposals={proposals} />
            {/* Noticed asks "should I know this?"; this asks "do you still?".
                New questions before old ones. */}
            <FadingBand facts={data.fading} />
            {data.asOfDay && groups.length === 0 && (
              <EmptyLine>You hadn’t recorded anything by this day.</EmptyLine>
            )}
            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                // No capture while looking at a past day. A fact written from a
                // March view would be dated today off a screen that says March,
                // and the reader would have no way to tell.
                <Group key={g.key} group={g} history={data.history}
                  onAdd={!data.asOfDay && g.subject.type === 'self' ? addSelf : undefined} />
              ))}
            </div>
            <Archived rows={data.archived} />
          </>
        )}
    </PageLayout>
  );
}
