'use client';
// Rituals — calm full-screen guided flows that each write a `rituals` row.
// daily_plan: pick the day's highlight · daily_shutdown: close + carry forward
// + reflect · weekly_review: reflect against goals.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Repeat, X, ArrowRight, ChevronLeft, Check, Circle, Flame, Flag, Inbox, Kanban } from "@/components/ds/icons";
import { Icon, FullScreenLayer, EmptyLine, Illustration } from "@/components/ds/ui";
import { saveRitual } from '@/lib/actions/rituals';
import { setHighlight, toggleTask, rescheduleTask } from '@/lib/actions/tasks';
import { toggleHabit, setHabitCount } from '@/lib/actions/habits';
import { HabitCount } from '@/components/habits/habit-count';
import { confirmMemory, archiveMemory } from '@/lib/actions/memory';
import { updateGoal } from '@/lib/actions/goals';
import { signalTaskToggle } from '@/lib/sound';
import { formatMinutes } from '@/lib/date';
import { useNarrow } from '@/lib/use-narrow';
import { capacity, deferSuggestion, DEFAULT_WORK_HOURS, type Span, type WorkHours } from '@/lib/capacity';
import { CapacityLine } from '@/components/capacity/capacity-line';

export type RitualType = 'daily_plan' | 'daily_shutdown' | 'weekly_review';
export type RTask = {
  id: string; title: string; done: boolean; highlight: boolean; estimate_minutes: number | null;
  /** Drives the capacity step's defer suggestion (§7C "lowest-priority first"). */
  priority?: 'low' | 'med' | 'high';
};
export type RGoal = {
  id: string; title: string; behind: boolean; progress: number;
  /** Linked work rolled up at review time (§7G) — 0/0 means nothing is linked. */
  linkedDone?: number; linkedTotal?: number;
};
export type RProject = { id: string; name: string; openCount: number };
export type RHabit = {
  id: string; title: string; done: boolean;
  /** How many times in a day counts as done — 1 for most habits. */
  goalTarget: number;
  /** Times already logged today, so a partial arrives here as a partial. */
  count: number;
};

// The ritual's name, once, in sentence case. It had a second name for the eyebrow — "DAILY PLANNING", set in
// capitals and tracked 0.12em — beside a title that said the same thing in other words.
const META: Record<RitualType, { icon: typeof Sun; title: string }> = {
  daily_plan: { icon: Sun, title: 'Plan your day' },
  daily_shutdown: { icon: Moon, title: 'Close the day' },
  weekly_review: { icon: Repeat, title: 'Weekly review' },
};

function Frame({ type, children }: { type: RitualType; children: React.ReactNode }) {
  const router = useRouter();
  const m = META[type];
  const leave = () => router.push('/today');
  return (
    // The × here has always been titled "Leave (Esc)" — and Escape was never
    // wired. It is now, along with the dialog role, focus-in/focus-back and the
    // one z value, because the layer owns that contract instead of each
    // full-screen surface re-deriving a different half of it.
    <FullScreenLayer label={m.title} onClose={leave} surface="canvas" enter="blur"
      className="flex flex-col overflow-auto">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center' }}><Icon icon={m.icon} size={16} /></span>
        <span className="text-ui font-medium text-ink-700">{m.title}</span>
        <div style={{ flex: 1 }} />
        <button onClick={leave} title="Leave (Esc)" aria-label="Leave (Esc)" style={{ width: 30, height: 30, border: 'none', background: 'var(--paper-2)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center' }}><Icon icon={X} size={16} /></button>
      </div>
      <div style={{ flex: 1, padding: '8px 24px 60px', display: 'flex', justifyContent: 'center' }}>{children}</div>
    </FullScreenLayer>
  );
}

function Step({ n, total, title, sub, children, onNext, onPrev, nextLabel = 'Continue', canNext = true }: {
  n: number; total: number; title: string; sub?: string; children?: React.ReactNode; onNext: () => void; onPrev?: () => void; nextLabel?: string; canNext?: boolean;
}) {
  return (
    <div className="zb-enter" style={{ width: '100%', maxWidth: 620, animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>
      <div style={{ fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Step {n} of {total}</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-size)', fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</h2>
      {/* The house family. It was an italic serif at h2 size — a second typeface for one line, on the screen the
          day starts on (CLAUDE.md: one family). */}
      {sub && <p className="mb-6 text-lead text-ink-500">{sub}</p>}
      <div>{children}</div>
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onPrev} style={{ visibility: n === 1 ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)' }}><Icon icon={ChevronLeft} size={14} /> Back</button>
        <div style={{ display: 'flex', gap: 4 }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ width: 22, height: 3, borderRadius: 'var(--r-full)', background: i < n ? 'var(--ink-2)' : 'var(--line)', transition: 'background var(--duration-base) var(--ease-hover)' }} />)}</div>
        <button onClick={onNext} disabled={!canNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', background: 'var(--primary)', color: 'var(--on-primary)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--text-small-size)', fontWeight: 600, cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.4, transition: 'opacity var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)' }}>{nextLabel} <Icon icon={ArrowRight} size={16} /></button>
      </div>
    </div>
  );
}

function pickRow(active: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'left', background: active ? 'var(--nav-active-bg)' : 'var(--paper-2)', border: '1px solid var(--line)', marginBottom: 8, transition: 'background var(--duration-fast) var(--ease-hover), border-color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)' };
}

/** One fact the review asks about. Deliberately the three fields the step
 *  shows — the ritual has no business holding a whole `Memory`. */
export type RMemory = { id: string; body: string; confidence: number };

export function RitualFlow({ type, todayTasks, goals, habits = [], todayISO, tomorrowISO, inboxCount = 0, projects = [], goalsV2 = false, memories = [], workHours = DEFAULT_WORK_HOURS, meetings = [] }: { type: RitualType; todayTasks: RTask[]; goals: RGoal[]; habits?: RHabit[]; todayISO?: string; tomorrowISO: string; inboxCount?: number; projects?: RProject[];
  /** Facts to ask "still true?" about (§7X §5.4). Empty without 0029. */
  memories?: RMemory[];
  /** Migration 0026 applied — unlocks 'Park it' (a paused status). */
  goalsV2?: boolean;
  /** The hours the user says they work, from `profiles.preferences` (§7C). */
  workHours?: WorkHours;
  /**
   * Today's meetings as minutes-from-midnight spans, twins already excluded.
   * Resolved on the server in the user's zone — see `minutesOfDayIn`; doing it
   * here would answer in UTC during the server render and in the user's zone
   * after hydration.
   */
  meetings?: Span[];
}) {
  const router = useRouter();
  const narrow = useNarrow(560);
  const [idx, setIdx] = useState(0);
  const [tasks, setTasks] = useState(todayTasks);
  const [highlightId, setHighlightId] = useState<string | null>(todayTasks.find((t) => t.highlight)?.id ?? null);
  const [habitDone, setHabitDone] = useState<Set<string>>(() => new Set(habits.filter((h) => h.done).map((h) => h.id)));
  // Progress on counted habits, so "3 of 8 glasses" survives into the ritual
  // instead of collapsing to an empty checkbox.
  const [habitCounts, setHabitCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(habits.map((h) => [h.id, h.count])),
  );
  // Which unfinished tasks move to tomorrow (§7C "shutdown→tomorrow picker").
  // Null means "not touched yet" — resolved to every open task when the step is
  // reached, so the default stays "carry everything" without needing an effect
  // that fights the user's first click.
  const [carryIds, setCarryIds] = useState<Set<string> | null>(null);
  // The morning mirror of `carryIds` (§7C's capacity step): which of today's
  // tasks you have decided to push to tomorrow because the day is too full.
  // Empty by default — the opposite default from shutdown, and deliberately so:
  // at night everything unfinished follows you unless you say otherwise, in the
  // morning nothing leaves your plan unless you say so.
  const [deferIds, setDeferIds] = useState<Set<string>>(() => new Set());
  const [reflection, setReflection] = useState('');
  const [busy, setBusy] = useState(false);
  // §7G's "still true?" — keeping is the default and costs one click; dropping
  // writes immediately so the review never becomes a form you have to submit.
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const [paused, setPaused] = useState<Set<string>>(new Set());

  // Memory's half of "still true?" (§7X §5.4). Same shape as the goal answers
  // above and for the same reason: each writes immediately, so the review is
  // never a form you have to remember to submit.
  const [answered, setAnswered] = useState<Map<string, 'kept' | 'let-go'>>(new Map());
  const answer = (id: string, how: 'kept' | 'let-go') => {
    setAnswered((m) => new Map(m).set(id, how));
    if (how === 'kept') confirmMemory(id);
    else archiveMemory(id, true);
  };

  function dropGoal(id: string) {
    setDropped((s) => new Set(s).add(id));
    updateGoal(id, { status: 'dropped' });
  }
  /** Park it: still true, just not now. Needs 0026 — hidden until it's applied. */
  function pauseGoal(id: string) {
    setPaused((s) => new Set(s).add(id));
    updateGoal(id, { status: 'paused' });
  }

  // Check a habit off (or back on) for today — optimistic, writes a habit_log.
  function flipHabit(id: string) {
    const on = !habitDone.has(id);
    const h = habits.find((x) => x.id === id);
    setHabitDone((prev) => { const s = new Set(prev); if (on) s.add(id); else s.delete(id); return s; });
    setHabitCounts((c) => ({ ...c, [id]: on ? (h?.goalTarget ?? 1) : 0 }));
    if (on) signalTaskToggle(true);
    toggleHabit(id, on, todayISO);
  }

  // A counted habit: n of target. `done` follows the tally rather than being set
  // separately, so the ritual and /habits can never disagree about the same day.
  function countHabit(id: string, next: number) {
    const h = habits.find((x) => x.id === id);
    if (!h) return;
    const n = Math.max(0, Math.min(h.goalTarget, next));
    setHabitCounts((c) => ({ ...c, [id]: n }));
    setHabitDone((prev) => {
      const s = new Set(prev);
      if (n >= h.goalTarget) { s.add(id); } else { s.delete(id); }
      return s;
    });
    if (n >= h.goalTarget && !habitDone.has(id)) signalTaskToggle(true);
    setHabitCount(id, n, h.goalTarget, todayISO);
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const next = () => setIdx((i) => i + 1);
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  // Everything open carries by default; unticking is the deliberate act. Ticking
  // a task off in step 1 removes it from `open`, so it drops out here too.
  const carrying = open.filter((t) => carryIds === null || carryIds.has(t.id));
  const toggleCarry = (id: string) =>
    setCarryIds((prev) => {
      const s = new Set(prev ?? open.map((t) => t.id));
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });

  // ── The capacity step (§7C) ───────────────────────────────────────────────
  // Recomputed from the CURRENT plan, so ticking a task off in step 1 or
  // pushing one to tomorrow here moves the bar immediately. Cheap enough to do
  // on every render — it is a couple of sums over one day's tasks — and cheaper
  // than the bug where a memo's dependency list forgets `deferIds`.
  const staying = open.filter((t) => !deferIds.has(t.id));
  const cap = capacity({
    tasks: staying.map((t) => ({ ...t, highlight: t.id === highlightId })),
    meetings,
    hours: workHours,
  });
  const suggested = deferSuggestion(
    staying.map((t) => ({ ...t, highlight: t.id === highlightId })),
    cap,
  );
  const suggestedIds = new Set(suggested.map((t) => t.id));
  const toggleDefer = (id: string) =>
    setDeferIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  // Worth asking about only when there is something to weigh. A day with no
  // open tasks and no meetings has no fit to check, and a step that says
  // "nothing planned" is a step that wastes a morning.
  const showCapacity = type === 'daily_plan' && (open.length > 0 || meetings.length > 0);

  async function finish() {
    if (busy) return; setBusy(true);
    if (type === 'daily_plan') {
      if (highlightId) await setHighlight(highlightId, true);
      // Same mechanism as shutdown's carry-forward, pointed the other way: the
      // tasks you decided the day could not hold get tomorrow's date. Written
      // here rather than on click so Back is a real undo for the whole step.
      const moved = open.filter((t) => deferIds.has(t.id));
      if (moved.length) await Promise.all(moved.map((t) => rescheduleTask(t.id, tomorrowISO)));
      await saveRitual('daily_plan', { highlightTaskId: highlightId, data: { deferred: moved.length } });
    } else if (type === 'daily_shutdown') {
      // Only the picked ones get a new date. Anything left behind stays on today
      // and surfaces tomorrow morning as a rollover on Home (§7V) — that's the
      // intended loop, not a leak.
      await Promise.all(carrying.map((t) => rescheduleTask(t.id, tomorrowISO)));
      await saveRitual('daily_shutdown', { reflection });
    } else {
      await saveRitual('weekly_review', { reflection });
    }
    router.push('/today'); router.refresh();
  }

  // ── flows ──────────────────────────────────────────────────────────
  if (type === 'daily_plan') {
    const hasHabits = habits.length > 0;
    // The flow's shape, as a list rather than as arithmetic. It used to be
    // `total = hasHabits ? 4 : 3` with a matching `readyIdx`, which is two
    // places to update and one to forget every time a step is added — and this
    // sprint added one whose presence is conditional too.
    // No intro step. It was a screen with a slogan and a Begin button — one more click every morning, asking
    // nothing. The ritual starts on its first real question.
    const steps = ['highlight', ...(showCapacity ? ['capacity'] : []), ...(hasHabits ? ['rhythm'] : []), 'ready'] as const;
    const total = steps.length;
    const at = steps[Math.min(idx, total - 1)];
    const no = (k: string) => steps.indexOf(k as typeof steps[number]) + 1;
    return (
      <Frame type={type}>
        {at === 'highlight' && (
          <Step n={no('highlight')} total={total} title="Pick today's highlight" sub="The one task that matters most today." onNext={next} onPrev={idx > 0 ? prev : undefined} canNext={open.length === 0 || !!highlightId}>
            {open.length === 0 ? <EmptyLine className="py-0">Nothing scheduled today yet — add tasks on Today first.</EmptyLine> :
              open.map((t) => (
                <button key={t.id} style={pickRow(highlightId === t.id)} onClick={() => setHighlightId(t.id)}>
                  <Icon icon={Flame} size={16} style={{ color: highlightId === t.id ? 'var(--ink)' : 'var(--text-secondary)' }} />
                  <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{t.title}</span>
                  {t.estimate_minutes != null && <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>{formatMinutes(t.estimate_minutes)}</span>}
                  {highlightId === t.id && <Icon icon={Check} size={16} style={{ color: 'var(--accent-text)' }} />}
                </button>
              ))}
          </Step>
        )}
        {/* §7C's capacity line, as a step you can act on rather than a number
            you read on the way out. Putting it AFTER the highlight is the whole
            design: you decide what matters first, and only then find out
            whether the rest fits — so the thing under pressure is the filler,
            never the one task that makes the day a win. */}
        {at === 'capacity' && (
          <Step
            n={no('capacity')} total={total}
            // "It fits" is a CLAIM, and with nothing estimated there is nothing
            // to claim it about — a day of five unmeasured tasks would have
            // been declared comfortable. The empty case asks the question
            // instead of answering it.
            title={!cap.fits ? 'More than fits in today'
              : cap.plannedMinutes === 0 ? (cap.unestimated > 0 ? 'How long will these take?' : 'Nothing planned yet')
                : 'It fits'}
            sub={!cap.fits
              ? 'Nothing moves unless you say so — here are the quietest things to let go of.'
              : cap.plannedMinutes === 0 && cap.unestimated > 0
                ? 'Nothing here has an estimate yet, so there is nothing to weigh.'
                : 'Your plan against the hours you keep.'}
            onNext={next} onPrev={prev} nextLabel="Continue"
          >
            <CapacityLine c={cap} bar className="mb-5" />

            {open.length === 0 ? (
              <EmptyLine className="py-0">Only meetings today — no tasks to weigh against them.</EmptyLine>
            ) : (
              <>
                {open.map((t) => {
                  const moved = deferIds.has(t.id);
                  const isHighlight = t.id === highlightId;
                  // On a phone the title, the Suggested tag, the estimate and
                  // the button cannot share one line without the title
                  // wrapping to three — so the row becomes two lines, title
                  // first. §7C promises rituals full mobile parity; a task
                  // whose name breaks mid-word is not parity.
                  const meta = (
                    <>
                      {/* Suggested, not selected. §7C is explicit that an
                          overloaded day "suggests moving lowest-priority —
                          never auto-moves", and the difference between a hint
                          and a pre-ticked box is the whole promise. */}
                      {!moved && suggestedIds.has(t.id) && (
                        <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--amber-text)' }}>Suggested</span>
                      )}
                      <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', minWidth: 42, textAlign: 'right' }}>
                        {t.estimate_minutes != null ? formatMinutes(t.estimate_minutes) : '—'}
                      </span>
                      <button
                        onClick={() => toggleDefer(t.id)}
                        aria-pressed={moved}
                        aria-label={moved ? `Keep ${t.title} on today` : `Move ${t.title} to tomorrow`}
                        className="focus-ring touch-row"
                        style={{ height: 28, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: moved ? 'var(--ink)' : 'var(--text-secondary)', fontSize: 'var(--text-label-size)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {moved ? 'Keep' : 'Tomorrow'}
                      </button>
                    </>
                  );
                  const title = (
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-body-size)', color: moved ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: moved ? 'line-through' : 'none' }}>
                      {t.title}
                    </span>
                  );
                  return (
                    <div key={t.id} style={{ ...pickRow(false), cursor: 'default', opacity: moved ? 0.55 : 1, ...(narrow ? { flexDirection: 'column', alignItems: 'stretch', gap: 8 } : null) }}>
                      {narrow ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon icon={isHighlight ? Flame : Circle} size={14}
                              style={{ color: isHighlight ? 'var(--ink)' : 'var(--text-secondary)', flexShrink: 0 }} />
                            {title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>{meta}</div>
                        </>
                      ) : (
                        <>
                          <Icon icon={isHighlight ? Flame : Circle} size={14}
                            style={{ color: isHighlight ? 'var(--ink)' : 'var(--text-secondary)', flexShrink: 0 }} />
                          {title}
                          {meta}
                        </>
                      )}
                    </div>
                  );
                })}
                {/* Only the count, and only once something has moved — the bar
                    above already says what it did to the day. */}
                {deferIds.size > 0 && (
                  <p style={{ marginTop: 12, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>
                    Moving <b style={{ color: 'var(--ink)' }}>{deferIds.size}</b> to tomorrow. Nothing is written until you start the day.
                  </p>
                )}
                {cap.unestimated > 0 && deferIds.size === 0 && (
                  <p style={{ marginTop: 12, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>
                    Tasks without an estimate aren&rsquo;t counted above — they still take time.
                  </p>
                )}
              </>
            )}
          </Step>
        )}
        {/* "Keep your streak." was the old title here — precisely the framing
            §7G rules out. A planning ritual that opens by invoking something you
            could lose has already made the morning about anxiety. The step's job
            is quieter: say what today asks for, and let you tick off whatever
            you have already done. Only habits DUE today reach this list. */}
        {at === 'rhythm' && (
          <Step n={no('rhythm')} total={total} title="Habits due today" sub="Tick anything you've already done." onNext={next} onPrev={prev} nextLabel="Continue">
            {habits.map((h) => {
              const on = habitDone.has(h.id);
              const counted = h.goalTarget > 1;
              const n = habitCounts[h.id] ?? 0;
              // A counted habit's row can't be one big button — the −/+ controls
              // live inside it, and nesting buttons is invalid.
              if (counted) {
                return (
                  <div key={h.id} style={pickRow(on)}>
                    <span aria-hidden style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 999, border: `2px solid ${on || n > 0 ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'transparent' }} />
                    </span>
                    <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)', textDecoration: on ? 'line-through' : 'none' }}>{h.title}</span>
                    <HabitCount count={n} target={h.goalTarget} title={h.title} onChange={(v) => countHabit(h.id, v)} />
                  </div>
                );
              }
              return (
                <button key={h.id} style={pickRow(on)} onClick={() => flipHabit(h.id)} aria-pressed={on}>
                  <span style={{ width: 18, height: 18, borderRadius: 'var(--r-xs)', border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background var(--duration-fast) var(--ease-hover)' }}>
                    {on && <Icon icon={Check} size={12} style={{ color: 'var(--paper)' }} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)', textDecoration: on ? 'line-through' : 'none' }}>{h.title}</span>
                </button>
              );
            })}
          </Step>
        )}
        {at === 'ready' && (
          <Step n={total} total={total} title="Your day is planned" onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Start the day'} canNext={!busy}>
            {/* ZB-01, the style anchor for every illustration after it: the one card that matters, placed
                on top of the rest — which is exactly what this ritual just did. */}
            <Illustration name="day-planned" className="mb-5 max-w-[320px]" />
            {/* The same numbers as the capacity step, not a second sum of its
                own — this line used to total every open task's estimate and
                call the result "committed", which disagreed with the capacity
                step the moment a meeting or a deferral existed. */}
            <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)' }}>
              {staying.length} task{staying.length === 1 ? '' : 's'} planned · {formatMinutes(cap.plannedMinutes)} committed
              {deferIds.size > 0 ? ` · ${deferIds.size} moved to tomorrow` : ''}
              {highlightId ? ' · highlight set' : ''}
              {hasHabits ? ` · ${habitDone.size}/${habits.length} habits` : ''}.
            </div>
          </Step>
        )}
      </Frame>
    );
  }

  if (type === 'daily_shutdown') {
    const total = 3;
    return (
      <Frame type={type}>
        {idx === 0 && (
          <Step n={1} total={total} title="How did today go?" sub={`${done.length} done · ${open.length} still open.`} onNext={next} nextLabel="Review">
            {tasks.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', marginBottom: 8 }}>
                <button aria-label="toggle" onClick={() => { const nd = !t.done; setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: nd } : x)); signalTaskToggle(nd); toggleTask(t.id, nd); }}
                  style={{ width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', border: t.done ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: t.done ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color var(--duration-fast) var(--ease-hover), border-color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)' }}>
                  {t.done && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--paper-2)' }} />}
                </button>
                <span style={{ fontSize: 'var(--text-body-size)', color: t.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
              </div>
            ))}
            {tasks.length === 0 && <EmptyLine className="py-0">Nothing on today.</EmptyLine>}
          </Step>
        )}
        {idx === 1 && (
          <Step n={2} total={total} title="Carry the rest forward?" sub={`${open.length} unfinished task${open.length === 1 ? '' : 's'}. Untick anything that shouldn't follow you into tomorrow.`} onNext={next} onPrev={prev}>
            {open.length === 0 ? (
              <EmptyLine className="py-0">Nothing left open — the day closed itself.</EmptyLine>
            ) : (
              <>
                {open.map((t) => {
                  const on = carryIds === null || carryIds.has(t.id);
                  // Ink, not accent — same as the habits step: the step's
                  // Continue button stays the one accent on screen.
                  return (
                    <button key={t.id} onClick={() => toggleCarry(t.id)} aria-pressed={on} style={pickRow(on)}>
                      <span style={{ width: 18, height: 18, borderRadius: 'var(--r-xs)', border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background var(--duration-fast) var(--ease-hover)' }}>
                        {on && <Icon icon={Check} size={12} style={{ color: 'var(--paper)' }} />}
                      </span>
                      <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: on ? 'var(--ink)' : 'var(--text-secondary)' }}>{t.title}</span>
                    </button>
                  );
                })}
                <p style={{ marginTop: 12, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>
                  {carrying.length === 0
                    ? 'Nothing moves — all of these stay on today and show up as rollover tomorrow morning.'
                    : <>Moving <b style={{ color: 'var(--ink)' }}>{carrying.length}</b> to tomorrow{carrying.length < open.length && <>; the other {open.length - carrying.length} {open.length - carrying.length === 1 ? 'stays' : 'stay'} on today</>}.</>}
                </p>
              </>
            )}
          </Step>
        )}
        {idx === 2 && (
          <Step n={3} total={total} title="A note on today" sub="What mattered? What slipped?" onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Close the day'} canNext={!busy}>
            <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} autoFocus rows={4} placeholder="Today I…"
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', outline: 'none', background: 'var(--paper-2)', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-body-lg-size)', lineHeight: 1.6, color: 'var(--ink-2)', padding: '12px 14px' }} />
          </Step>
        )}
      </Frame>
    );
  }

  // weekly_review — a guided pass: clear the inbox · each project's next action
  // · goals glance · reflect. (GTD's weekly review, sized for one person.)
  // FIVE steps only when there is a fact to ask about. A permanently-present
  // step that says "nothing to review" makes the weekly review longer every week
  // in exchange for nothing — and this ritual's whole promise is that it is
  // short enough to actually do.
  const asksMemory = memories.length > 0;
  const total = asksMemory ? 5 : 4;
  const activeProjects = projects.filter((p) => p.openCount > 0);
  return (
    <Frame type={type}>
      {idx === 0 && (
        <Step n={1} total={total} title={inboxCount === 0 ? 'Inbox is clear' : `${inboxCount} ${inboxCount === 1 ? 'item' : 'items'} in your inbox`}
          sub={inboxCount === 0 ? 'Nothing to process.' : 'Process these after the review, so nothing stays loose.'}
          onNext={next} nextLabel="Next">
          <button onClick={() => router.push('/tasks?view=inbox')} style={{ ...pickRow(false), cursor: inboxCount === 0 ? 'default' : 'pointer' }} disabled={inboxCount === 0}>
            <Icon icon={Inbox} size={16} style={{ color: inboxCount === 0 ? 'var(--green-text)' : 'var(--accent-text)' }} />
            <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{inboxCount === 0 ? 'Inbox at zero' : `Open the inbox to triage ${inboxCount}`}</span>
            {inboxCount === 0 ? <Icon icon={Check} size={16} style={{ color: 'var(--green-text)' }} /> : <Icon icon={ArrowRight} size={16} style={{ color: 'var(--text-secondary)' }} />}
          </button>
        </Step>
      )}
      {idx === 1 && (
        <Step n={2} total={total} title="What needs a next action?" sub="Each active project should have one clear next move." onNext={next} onPrev={prev} nextLabel="Next">
          {activeProjects.length === 0 ? <EmptyLine className="py-0">No active projects with open work — nothing waiting on you.</EmptyLine> :
            activeProjects.map((p) => (
              <button key={p.id} style={pickRow(false)} onClick={() => router.push(`/projects/${p.id}`)}>
                <Icon icon={Kanban} size={16} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{p.name}</span>
                <span className="num" style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{p.openCount} open</span>
              </button>
            ))}
        </Step>
      )}
      {idx === 2 && (
        <Step n={3} total={total} title="Where do your goals stand?" sub="One question each: is it still true? Keeping is the default — say so and move on." onNext={next} onPrev={prev} nextLabel="Reflect">
          {goals.length === 0 ? <EmptyLine className="py-0">No goals yet — set some in Goals.</EmptyLine> :
            goals.filter((g) => !dropped.has(g.id) && !paused.has(g.id)).map((g) => {
              const linked = g.linkedTotal ?? 0;
              return (
                <div key={g.id} style={{ padding: '12px 14px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon icon={g.behind ? Flag : Check} size={14} style={{ color: g.behind ? 'var(--red-text)' : 'var(--green-text)' }} />
                    <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{g.title}</span>
                    <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round((g.progress ?? 0) * 100)}%</span>
                    <span style={{ fontSize: 'var(--text-label-size)', color: g.behind ? 'var(--red-text)' : 'var(--green-text)' }}>{g.behind ? 'Behind' : 'On track'}</span>
                  </div>
                  {/* The line that makes this a review and not a dashboard: what
                      work actually moved, or the fact that none is linked. */}
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {linked > 0
                        ? `${g.linkedDone ?? 0}/${linked} linked ${linked === 1 ? 'task' : 'tasks'} done`
                        : 'Nothing linked — link some work, or drop it.'}
                    </span>
                    {kept.has(g.id) ? (
                      <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--green-text)' }}>Still true</span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto' }}>
                        <button onClick={() => setKept((s) => new Set(s).add(g.id))}
                          style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                          Still true
                        </button>
                        {goalsV2 && (
                          <button onClick={() => pauseGoal(g.id)}
                            style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                            Park it
                          </button>
                        )}
                        <button onClick={() => dropGoal(g.id)}
                          style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--red-text)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                          Drop it
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          {(dropped.size > 0 || paused.size > 0) && (
            <p style={{ marginTop: 10, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
              {[paused.size > 0 ? `${paused.size} parked` : null, dropped.size > 0 ? `${dropped.size} dropped` : null]
                .filter(Boolean).join(' · ')}
              {paused.size > 0 && dropped.size > 0 ? '. Both are reversible in Goals.' : '. Reversible in Goals.'}
            </p>
          )}
        </Step>
      )}
      {asksMemory && idx === 3 && (
        // §7X §5.4 — memory's natural curation moment, asked exactly the way the
        // goals step above asks it. KEEPING IS THE DEFAULT and costs one click;
        // "It changed" hands off to /memory rather than forking the supersede
        // editor into a ritual, because rewording a fact is a writing task and
        // this step is a triage one.
        <Step n={4} total={total} title="Are these still true?"
          sub="The things Zenboard is least sure of. Keeping is the default — say so and move on."
          onNext={next} onPrev={prev} nextLabel="Reflect">
          {memories.map((m) => {
            const said = answered.get(m.id);
            return (
              <div key={m.id} style={{ padding: '12px 14px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', marginBottom: 8 }}>
                <p style={{ fontSize: 'var(--text-body-size)', color: said === 'let-go' ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: said === 'let-go' ? 'line-through' : 'none' }}>
                  {m.body}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  {said ? (
                    <span style={{ fontSize: 'var(--text-label-size)', color: said === 'kept' ? 'var(--green-text)' : 'var(--text-secondary)' }}>
                      {said === 'kept' ? 'Still true' : 'Let go — reversible in Memory'}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => answer(m.id, 'kept')}
                        style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                        Still true
                      </button>
                      <button onClick={() => router.push('/memory')}
                        style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                        It changed
                      </button>
                      <button onClick={() => answer(m.id, 'let-go')}
                        style={{ height: 26, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-label-size)', cursor: 'pointer' }}>
                        Let go
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Step>
      )}
      {idx === total - 1 && (
        <Step n={total} total={total} title="What did this week teach you?" sub="What would you keep, and what would you change?" onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Finish review'} canNext={!busy}>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} autoFocus rows={4} placeholder="This week…"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', outline: 'none', background: 'var(--paper-2)', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-body-lg-size)', lineHeight: 1.6, color: 'var(--ink-2)', padding: '12px 14px' }} />
        </Step>
      )}
    </Frame>
  );
}
