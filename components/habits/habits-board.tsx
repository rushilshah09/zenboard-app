'use client';
// The Habits page — a daily JOURNAL and a REVIEW surface, built entirely in the
// Zenboard DS (no integrations, no AI, no scores).
//
// What it takes from the reference app: grouping by time of day, a per-day goal
// you can actually count, a repeat schedule, a date navigator, a review view
// with calendar heat. What it deliberately does NOT take: "Fail" as a logging
// verb, a daily performance score, "peak focus zones", or streak-loss framing.
// MASTER_PRODUCT_PLAN §7G is explicit — gentle streaks, no fire emoji, no
// loss-shaming; a missed day is a gray dot, not a broken chain. The strongest
// thing on this page is a done day.
//
// Degrades gracefully before migration 0025: everything shows as a daily habit
// under "Any time", skip falls back to a plain uncheck, and a partial count is
// recorded only once it completes.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Clock, Repeat, Plus, ChevronLeft, ChevronRight, Trash2, Archive, ChevronDown, type IconType } from '@/components/ds/icons';
import { Icon, Button, Checkbox, Badge, EmptyState, EmptyLine, Modal, Field, TextInput, SegmentedControl, PageView, DropdownMenuItem, useConfirm, toast, cardClass } from '@/components/ds/ui';
import { HabitHeat, buildHeat } from '@/components/habits/habit-heat';
import { HabitCount } from '@/components/habits/habit-count';
import { RepeatPicker } from '@/components/habits/repeat-picker';
import { PageLayout } from '@/components/ui/page-layout';
import { addHabit, updateHabit, setHabitStatus, setHabitCount, archiveHabit, deleteHabit } from '@/lib/actions/habits';
import type { HabitsBoard, BoardHabit, TimeOfDay, HabitStatus } from '@/lib/habits-data';
import { scheduleLabel, DAILY, type HabitSchedule } from '@/lib/habit-schedule';
import { cn } from '@/lib/cn';
import { formatRelativeDay, addDaysISO } from '@/lib/date';
import { tempId } from '@/lib/temp-id';

const GROUPS: { key: TimeOfDay; label: string; icon: IconType }[] = [
  { key: 'morning', label: 'Morning', icon: Sun },
  { key: 'afternoon', label: 'Afternoon', icon: Sun },
  { key: 'evening', label: 'Evening', icon: Moon },
  { key: 'any', label: 'Any time', icon: Clock },
];
const TOD_OPTIONS = [
  { value: 'any', label: 'Any time' }, { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' },
];

// Today/Yesterday/Tomorrow + a weekday-led date, from the one date vocabulary.
const fmtDate = (day: string) => formatRelativeDay(day, { weekday: true }) ?? '';

/** What a habit is, in one line: when it repeats, and what counts as done. */
function habitMeta(h: BoardHabit): string {
  const parts = [scheduleLabel(h.schedule)];
  if (h.goalTarget > 1) parts.push(`${h.goalTarget}× a day`);
  const tod = GROUPS.find((g) => g.key === h.timeOfDay);
  if (tod && h.timeOfDay !== 'any') parts.push(tod.label);
  return parts.join(' · ');
}

export function HabitsJournal({ board }: { board: HabitsBoard }) {
  const router = useRouter();
  const [habits, setHabits] = useState<BoardHabit[]>(board.habits);
  // Re-seeded by the route's `key`, so no effect syncs state from props.
  const [addOpen, setAddOpen] = useState(false);
  // §7G: /habits is "the review surface (calendar heat, gentle streaks)". It
  // was only ever the daily journal; Review is the half that was missing.
  const [mode, setMode] = useState<'journal' | 'review'>('journal');
  const [openHabit, setOpenHabit] = useState<string | null>(null);
  const [showOffDuty, setShowOffDuty] = useState(false);
  const [confirm, confirmUI] = useConfirm();
  const detail = habits.find((h) => h.id === openHabit) ?? null;

  // `today` comes from the loader, which resolves it in the USER's timezone.
  // Computing it here with `new Date().toISOString().slice(0,10)` — as this file
  // used to — is the UTC date, so in IST the journal called yesterday "today"
  // from midnight until 05:30 and the date navigator refused to advance.
  const today = board.today;
  const isToday = board.date === today;
  const isFuture = board.date > today;

  async function patch(id: string, p: { title?: string; timeOfDay?: TimeOfDay; goalTarget?: number; schedule?: HabitSchedule }) {
    const before = habits.find((h) => h.id === id);
    if (!before) return;
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...p } : h)));
    const r = await updateHabit(id, p);
    if ('error' in r) {
      setHabits((hs) => hs.map((h) => (h.id === id ? before : h)));
      toast({ message: r.error, variant: 'error' });
    } else {
      // The schedule feeds every number on the review surface, so a change to it
      // has to be recomputed server-side rather than guessed at here.
      if (p.schedule) router.refresh();
    }
  }
  async function archive(h: BoardHabit) {
    setOpenHabit(null);
    setHabits((hs) => hs.filter((x) => x.id !== h.id));
    // Reversible, so it acts at once and offers Undo (§2.2) — no dialog.
    toast({ message: `“${h.title}” archived.`, action: { label: 'Undo', onAction: () => {
      setHabits((hs) => (hs.some((x) => x.id === h.id) ? hs : [...hs, h]));
      archiveHabit(h.id, false);
    } } });
    const r = await archiveHabit(h.id, true);
    if ('error' in r) { setHabits((hs) => (hs.some((x) => x.id === h.id) ? hs : [...hs, h])); toast({ message: r.error, variant: 'error' }); }
  }
  async function remove(h: BoardHabit) {
    const ok = await confirm({
      title: `Delete “${h.title}”?`,
      body: `Its whole history goes with it — ${h.doneDates.length} logged ${h.doneDates.length === 1 ? 'day' : 'days'}. Archive instead if you just want it out of the way.`,
      actionLabel: 'Delete habit',
    });
    if (!ok) return;
    setOpenHabit(null);
    setHabits((hs) => hs.filter((x) => x.id !== h.id));
    const r = await deleteHabit(h.id);
    if ('error' in r) toast({ message: r.error, variant: 'error' });
  }

  // Only what's actually due today belongs in the journal. A Mon/Wed/Fri habit
  // listed on a Tuesday is a row you have to decide to ignore, every Tuesday —
  // and an unchecked row reads like a debt whether or not the maths agrees.
  const onDuty = habits.filter((h) => h.due);
  const offDuty = habits.filter((h) => !h.due);
  const doneCount = onDuty.filter((h) => h.status === 'done').length;

  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: onDuty.filter((h) => h.timeOfDay === g.key) })).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habits],
  );

  function goto(day: string) { router.push(day === today ? '/habits' : `/habits?date=${day}`); }

  function setStatus(id: string, next: HabitStatus) {
    if (isFuture) return; // can't log a day that hasn't happened
    const prev = habits.find((h) => h.id === id);
    if (!prev) return;
    const streak = next === 'done' && prev.status !== 'done' ? prev.streak + 1
      : next !== 'done' && prev.status === 'done' ? Math.max(0, prev.streak - 1)
      : prev.streak;
    const count = next === 'done' ? prev.goalTarget : 0;
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, status: next, streak, count } : h)));
    setHabitStatus(id, next === 'partial' ? 'none' : next, board.date).then((r) => {
      if ('error' in r) { setHabits((hs) => hs.map((h) => (h.id === id ? prev : h))); toast({ message: r.error, variant: 'error' }); }
    });
  }

  function setCount(id: string, next: number) {
    if (isFuture) return;
    const prev = habits.find((h) => h.id === id);
    if (!prev) return;
    const n = Math.max(0, Math.min(prev.goalTarget, next));
    const status: HabitStatus = n >= prev.goalTarget ? 'done' : n > 0 ? 'partial' : 'none';
    const streak = status === 'done' && prev.status !== 'done' ? prev.streak + 1
      : status !== 'done' && prev.status === 'done' ? Math.max(0, prev.streak - 1)
      : prev.streak;
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, count: n, status, streak } : h)));
    setHabitCount(id, n, prev.goalTarget, board.date).then((r) => {
      if ('error' in r) { setHabits((hs) => hs.map((h) => (h.id === id ? prev : h))); toast({ message: r.error, variant: 'error' }); }
    });
  }

  // The date navigator is the page's `lead`; the day itself is the title,
  // so Habits reads with the same left-to-right grammar as every other
  // page instead of inventing its own header row.
  return (
    <PageLayout
      title={mode === 'journal' ? fmtDate(board.date) : undefined}
      subtitle={mode === 'journal' && onDuty.length > 0 ? `${doneCount}/${onDuty.length} done` : undefined}
      lead={mode === 'journal' ? <>
        <button aria-label="Previous day" onClick={() => goto(addDaysISO(board.date, -1))}
          className="focus-ring grid size-7 place-items-center rounded-md text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900">
          <Icon icon={ChevronLeft} size={16} />
        </button>
        <button aria-label="Next day" disabled={isToday} onClick={() => goto(addDaysISO(board.date, 1))}
          className="focus-ring grid size-7 place-items-center rounded-md text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900 disabled:opacity-30">
          <Icon icon={ChevronRight} size={16} />
        </button>
      </> : undefined}
      actions={<>
        {mode === 'journal' && !isToday && <Button size="sm" variant="ghost" onClick={() => goto(today)}>Today</Button>}
        {/* Journal ⇄ Review changes how you look at the same habits, so it is a
            layout switch and belongs in the right lane with the other view
            controls — same rule as Tasks and Documents. */}
        <SegmentedControl
          aria-label="Journal or review"
          value={mode}
          onValueChange={(v) => setMode(v as 'journal' | 'review')}
          options={[{ value: 'journal', label: 'Journal' }, { value: 'review', label: 'Review' }]}
          fit="content"
        />
        <Button size="sm" variant="secondary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>New habit</Button>
      </>}
    >
      {board.error ? (
        <div className="py-2 text-ui text-danger-600">Couldn’t load your habits. Try refreshing.</div>
      ) : habits.length === 0 ? (
        <EmptyState
          illustration={<Icon icon={Repeat} size={20} />}
          title="No habits yet"
          description="Small things, done often — on the days you choose."
          primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>New habit</Button>}
        />
      ) : mode === 'review' ? (
        /* The review surface (§7G). One row per habit: the calendar heat, and
           three quiet numbers. No fire, no "you broke your streak" — the loudest
           thing on screen is a done day. Every number here is computed over the
           days the habit was DUE, so a weekday habit kept perfectly reads 100%
           and an unbroken streak, which it did not before. */
        <div className="flex flex-col">
          {habits.map((h, i) => (
            <div key={h.id} className={cn('flex flex-wrap items-center gap-x-5 gap-y-3 py-4', i > 0 && 'border-t border-line-soft')}>
              <div className="min-w-[160px] flex-1">
                <button onClick={() => setOpenHabit(h.id)} className="focus-ring touch-min rounded-xs text-left text-ui text-ink-900 hover:underline">{h.title}</button>
                <div className="mt-0.5 text-caption text-ink-500">{habitMeta(h)}</div>
              </div>
              <HabitHeat className="order-last w-full sm:order-none sm:w-auto"
                weeks={buildHeat({ endISO: board.date, weeks: 18, doneDates: h.doneDates, skippedDates: h.skippedDates, createdAt: h.createdAt, schedule: h.schedule })} />
              <div className="flex shrink-0 items-center gap-5">
                <Stat label="Streak" value={streakText(h)} />
                <Stat label="Best" value={h.bestStreak > 0 ? `${h.bestStreak}${h.streakUnit === 'week' ? 'w' : 'd'}` : '—'} />
                <Stat label="30 days" value={`${h.consistency30}%`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-overline text-ink-500">
                <Icon icon={g.icon} size={12} /> {g.label}
                <span className="tabular-nums text-ink-500">{g.items.filter((h) => h.status === 'done').length}/{g.items.length}</span>
              </div>
              <div className={cardClass('overflow-hidden')}>
                {g.items.map((h, i) => (
                  <HabitRow key={h.id} h={h} last={i === g.items.length - 1} isFuture={isFuture}
                    onOpen={() => setOpenHabit(h.id)} onStatus={(s) => setStatus(h.id, s)} onCount={(n) => setCount(h.id, n)} />
                ))}
              </div>
            </div>
          ))}

          {onDuty.length === 0 && (
            <EmptyLine>Nothing scheduled for {isToday ? 'today' : fmtDate(board.date).toLowerCase()}. A day off is part of the rhythm.</EmptyLine>
          )}

          {/* Not due today — collapsed, because it is information rather than
              work. Reachable in one click, because "I'll do it anyway" is a
              perfectly good reason to log a day the schedule didn't ask for. */}
          {offDuty.length > 0 && (
            <div>
              <button onClick={() => setShowOffDuty((v) => !v)} aria-expanded={showOffDuty}
                className="focus-ring flex items-center gap-1.5 rounded-sm py-1 text-caption text-ink-500 transition-colors hover:text-ink-800">
                <Icon icon={ChevronDown} size={12} className={cn('transition-transform duration-fast ease-standard', !showOffDuty && '-rotate-90')} />
                {offDuty.length} not scheduled {isToday ? 'today' : 'that day'}
              </button>
              {showOffDuty && (
                <div className={cardClass('mt-1.5 overflow-hidden')}>
                  {offDuty.map((h, i) => (
                    <HabitRow key={h.id} h={h} last={i === offDuty.length - 1} isFuture={isFuture} offDuty
                      onOpen={() => setOpenHabit(h.id)} onStatus={(s) => setStatus(h.id, s)} onCount={(n) => setCount(h.id, n)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!board.supported && (
            <p className="text-caption text-ink-500">Apply migration 0025 for repeat schedules, goal counting, time-of-day grouping and skipped days.</p>
          )}
        </div>
      )}

      {detail && <HabitDetail
        key={detail.id}
        habit={detail}
        endISO={board.date}
        onClose={() => setOpenHabit(null)}
        onPatch={patch}
        onArchive={archive}
        onDelete={remove}
      />}
      {confirmUI}

      <NewHabitModal open={addOpen} onOpenChange={setAddOpen} onCreate={(h) => {
        const tmp = tempId();
        // A habit created today has no history — and no retroactive misses
        // (§7G "habit created mid-week → no retroactive misses"): its trail is
        // `off` days, which read as nothing at all, never as failures.
        setHabits((hs) => [...hs, {
          id: tmp, title: h.title, timeOfDay: h.timeOfDay, schedule: h.schedule, goalTarget: h.goalTarget,
          color: null, status: 'none', count: 0, due: true, streak: 0, streakUnit: h.schedule.kind === 'weekly' ? 'week' : 'day',
          last7: ['off', 'off', 'off', 'off', 'off', 'off', 'off'], doneDates: [], skippedDates: [],
          bestStreak: 0, consistency30: 0, createdAt: new Date().toISOString(),
          weekDone: 0, weekTarget: h.schedule.kind === 'weekly' ? h.schedule.count : 0,
        }]);
        addHabit(h.title, { timeOfDay: h.timeOfDay, goalTarget: h.goalTarget, schedule: h.schedule }).then((res) => {
          if ('id' in res) { setHabits((hs) => hs.map((x) => (x.id === tmp ? { ...x, id: res.id } : x))); router.refresh(); }
          else { setHabits((hs) => hs.filter((x) => x.id !== tmp)); toast({ message: res.error, variant: 'error' }); }
        });
      }} />
    </PageLayout>
  );
}

/** "4d" · "2w" · "3/5 this week" — the unit the habit is actually judged in. */
function streakText(h: BoardHabit): string {
  if (h.schedule.kind === 'weekly') return `${h.weekDone}/${h.weekTarget} this week`;
  return h.streak > 0 ? `${h.streak}d` : '—';
}

function HabitRow({ h, last, isFuture, offDuty, onOpen, onStatus, onCount }: {
  h: BoardHabit; last: boolean; isFuture: boolean; offDuty?: boolean;
  onOpen: () => void; onStatus: (s: HabitStatus) => void; onCount: (n: number) => void;
}) {
  const counted = h.goalTarget > 1;
  return (
    <div className={cn('group/hb flex items-center gap-3 px-3.5 py-2.5', !last && 'border-b border-line-soft')}>
      {counted ? (
        <span className="grid size-5 shrink-0 place-items-center">
          {/* A ring that fills as the tally rises — the same signal the checkbox
              gives, for a goal that isn't binary. */}
          <span aria-hidden className={cn('block size-3.5 rounded-full border-2', h.status === 'done' ? 'border-ink-700 bg-ink-700' : h.count > 0 ? 'border-ink-700' : 'border-line-strong')} />
        </span>
      ) : (
        <Checkbox size="md" checked={h.status === 'done'} disabled={isFuture}
          onCheckedChange={() => onStatus(h.status === 'done' ? 'none' : 'done')}
          aria-label={h.status === 'done' ? `Uncheck ${h.title}` : `Complete ${h.title}`} />
      )}

      <button onClick={onOpen}
        className={cn('focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui hover:underline [@media(pointer:coarse)]:min-h-6',
          h.status === 'done' ? 'text-ink-500 line-through' : h.status === 'skipped' ? 'text-ink-500' : 'text-ink-900')}>
        {h.title}
      </button>

      {offDuty && <span className="shrink-0 text-caption text-ink-500">{scheduleLabel(h.schedule)}</span>}

      {counted && <HabitCount count={h.count} target={h.goalTarget} title={h.title} disabled={isFuture} onChange={onCount} />}

      {h.status === 'skipped' ? (
        <button onClick={() => onStatus('none')} className="focus-ring touch-min rounded-sm" aria-label={`Clear skip on ${h.title}`}>
          <Badge status="neutral">Skipped</Badge>
        </button>
      ) : (
        !isFuture && h.status !== 'done' && (
          <button onClick={() => onStatus('skipped')}
            // Not the `reveal-on-hover` utility: that targets the unnamed
            // `.group`, and this row is `group/hb`. A phone has no hover, so
            // Skip is always visible on touch.
            className="focus-ring touch-min shrink-0 rounded-sm px-1.5 py-0.5 text-caption text-ink-500 opacity-0 transition-opacity hover:text-ink-900 focus-visible:opacity-100 group-hover/hb:opacity-100 [@media(pointer:coarse)]:opacity-100">
            Skip
          </button>
        )
      )}

      {/* §7G: gentle streaks — no fire, no loss-shaming. Seven days as quiet
          dots; a missed day is a gray dot, not a broken chain, a skipped day is
          a hollow ring, and a day it wasn't due is nothing at all. */}
      <span className="inline-flex shrink-0 items-center gap-2">
        <span aria-hidden className="hidden items-center gap-1 sm:inline-flex">
          {h.last7.map((d, i) => (
            <span key={i} className={
              d === 'done' ? 'size-1.5 rounded-full bg-ink-700'
                : d === 'skipped' ? 'size-1.5 rounded-full border border-line-strong'
                  : d === 'missed' ? 'size-1.5 rounded-full bg-surface-fill'
                    : 'size-1.5 rounded-full'
            } />
          ))}
        </span>
        <span className="whitespace-nowrap tabular-nums text-meta text-ink-500">
          {streakText(h)}
          <span className="sr-only"> — last seven days: {h.last7.join(', ')}</span>
        </span>
      </span>
    </div>
  );
}

function NewHabitModal({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onCreate: (h: { title: string; timeOfDay: TimeOfDay; goalTarget: number; schedule: HabitSchedule }) => void;
}) {
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const [goalTarget, setGoalTarget] = useState(1);
  const [schedule, setSchedule] = useState<HabitSchedule>(DAILY);
  // Keyed by the caller on `open`, so each opening starts clean without an
  // effect resetting four pieces of state.

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onCreate({ title: t, timeOfDay, goalTarget: Math.max(1, goalTarget), schedule });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title="New habit" dirty={!!title.trim()}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!title.trim()} onClick={submit}>Create habit</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Morning walk" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Repeat">
          <RepeatPicker value={schedule} onChange={setSchedule} />
        </Field>
        <Field label="Goal" helper="How many times in a day counts as done.">
          <div className="flex items-center gap-2">
            <TextInput type="number" min={1} value={String(goalTarget)} onChange={(e) => setGoalTarget(parseInt(e.target.value, 10) || 1)} className="w-16" aria-label="Times a day" />
            <span className="text-ui text-ink-500">{goalTarget === 1 ? 'time a day' : 'times a day'}</span>
          </div>
        </Field>
        <Field label="Time of day">
          <SegmentedControl aria-label="Time of day" value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as TimeOfDay)} options={TOD_OPTIONS} />
        </Field>
      </div>
    </Modal>
  );
}

// Three numbers, one shape — used across the review rows and the detail.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="whitespace-nowrap tabular-nums text-ui text-ink-900">{value}</div>
      <div className="text-caption text-ink-500">{label}</div>
    </div>
  );
}

// A habit's own page: what it is, how it's going, and the two ways out.
function HabitDetail({ habit, endISO, onClose, onPatch, onArchive, onDelete }: {
  habit: BoardHabit;
  endISO: string;
  onClose: () => void;
  onPatch: (id: string, p: { title?: string; timeOfDay?: TimeOfDay; goalTarget?: number; schedule?: HabitSchedule }) => void;
  onArchive: (h: BoardHabit) => void;
  onDelete: (h: BoardHabit) => void;
}) {
  // Keyed on the habit id by its caller, so the draft starts from the right
  // title on every open without an effect syncing state from props.
  const [draft, setDraft] = useState(habit.title);
  const commit = () => { const t = draft.trim(); if (t && t !== habit.title) onPatch(habit.id, { title: t }); else setDraft(habit.title); };

  return (
    // A habit is a RECORD, so it opens the way every record opens
    // (components/ds/ui/page-view.tsx). It used to be a bespoke modal Drawer,
    // which meant the habits board was the one place in the app where opening a
    // thing could not be side-peeked, could not be widened, and did not
    // remember how you like this kind of record to open. `habit` was already in
    // the ContentType vocabulary waiting for it.
    <PageView
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      contentType="habit"
      title={habit.title}
      more={
        <>
          <DropdownMenuItem icon={<Icon icon={Archive} size={14} />} onSelect={() => onArchive(habit)}>Archive habit</DropdownMenuItem>
          <DropdownMenuItem danger icon={<Icon icon={Trash2} size={14} />} onSelect={() => onDelete(habit)}>Delete habit</DropdownMenuItem>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        <Field label="Name">
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(habit.title); }}
            autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>

        {/* Editable here, not only at creation. A habit's schedule is the thing
            most likely to be wrong on the first guess, and it was previously
            unreachable after the modal closed — rename was the only edit. */}
        <Field label="Repeat">
          <RepeatPicker value={habit.schedule} onChange={(s) => onPatch(habit.id, { schedule: s })} />
        </Field>

        <Field label="Goal" helper="How many times in a day counts as done.">
          <div className="flex items-center gap-2">
            <TextInput type="number" min={1} value={String(habit.goalTarget)} className="w-16" aria-label="Times a day"
              onChange={(e) => onPatch(habit.id, { goalTarget: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            <span className="text-ui text-ink-500">{habit.goalTarget === 1 ? 'time a day' : 'times a day'}</span>
          </div>
        </Field>

        <Field label="Time of day">
          <SegmentedControl aria-label="Time of day" value={habit.timeOfDay}
            onValueChange={(v) => onPatch(habit.id, { timeOfDay: v as TimeOfDay })} options={TOD_OPTIONS} />
        </Field>

        <div className="flex items-center gap-6 border-t border-line-soft pt-4">
          <Stat label={habit.schedule.kind === 'weekly' ? 'This week' : 'Current streak'} value={streakText(habit)} />
          <Stat label="Best" value={habit.bestStreak > 0 ? `${habit.bestStreak}${habit.streakUnit === 'week' ? 'w' : 'd'}` : '—'} />
          <Stat label="Last 30 days" value={`${habit.consistency30}%`} />
        </div>

        <div>
          <div className="mb-2 text-overline text-ink-500">Last 26 weeks</div>
          {habit.doneDates.length === 0 && habit.skippedDates.length === 0 ? (
            <EmptyLine className="py-0">Nothing logged yet — the grid fills in as you go.</EmptyLine>
          ) : (
            <div className="overflow-x-auto">
              <HabitHeat weeks={buildHeat({ endISO, weeks: 26, doneDates: habit.doneDates, skippedDates: habit.skippedDates, createdAt: habit.createdAt, schedule: habit.schedule })} />
            </div>
          )}
        </div>

      </div>
    </PageView>
  );
}
