'use client';
// Focus — immersive single-task mode inside the standard app shell (the global
// top bar's Focus switch is the way in and out; Esc also exits): one centered
// column holding the focused task (checkbox · tags · subtasks · Notes), and a
// pinned "Leave a message…" bar that logs comments to the task. The session
// timer lives behind the ⋮ menu (Space still starts/pauses; completing logs
// elapsed time).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { useServerState } from '@/lib/use-server-state';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/date';
import { useRouter } from 'next/navigation';
import {
  EllipsisVertical, Notebook, ArrowUp, Check, Plus, Play, Pause, RotateCcw, ExternalLink, ArrowLeft, ArrowRight} from "@/components/ds/icons";
import { Icon, IconSwap, Button, Checkbox, AddLine, addLine, toastReverted, OVERLAY_CLASS } from "@/components/ds/ui";
import { TaskMeta } from '@/components/tasks/task-meta';
import { Composer } from '@/components/tasks/tasks-view';
import { toggleTask, logTime, addTask, addSubtask, updateTask, addComment } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { tempId } from '@/lib/temp-id';

export type FocusTask = {
  id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high';
  highlight: boolean; estimate_minutes: number | null; elapsed_minutes: number;
  project_id: string | null; notes: string | null;
};
export type FocusSub = { id: string; title: string; done: boolean };
export type FocusProject = { id: string; name: string; color: string | null };

/**
 * The ACTUAL and PLANNED cells. One component so every row — the task you are
 * on, the ones queued behind it, the ones already done — lands its numbers on
 * the same two columns. Fixed widths and `tabular-nums`, because a column of
 * times that shifts as the seconds tick is unreadable.
 *
 * An unstarted task shows "–:–" rather than "0:00": nothing has happened yet,
 * and a zero reads as a measurement.
 */
function TimeCells({ actualSec, plannedMin, live }: { actualSec: number; plannedMin: number | null; live?: boolean }) {
  return (
    <>
      <span className={cn('w-[52px] shrink-0 text-right tabular-nums text-caption', live ? 'text-ink-900' : 'text-ink-500')}>
        {actualSec > 0 ? clock(actualSec) : '–:–'}
      </span>
      <span className="w-[56px] shrink-0 text-right tabular-nums text-caption text-ink-500">
        {plannedMin ? clock(plannedMin * 60) : '—'}
      </span>
    </>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const isoDay = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function FocusView({ initialTasks, subsByTask, projects }: {
  initialTasks: FocusTask[]; subsByTask: Record<string, FocusSub[]>; projects: Record<string, FocusProject>;
}) {
  const router = useRouter();
  // Both are server props, so both follow the server: a refresh — including the
  // one the failure net makes when a save does not land — must reach them.
  // Seeded with plain `useState`, a failed tick here stayed ticked forever.
  const [tasks, setTasks] = useServerState(initialTasks);
  const [subs, setSubs] = useServerState(subsByTask);
  const [activeId, setActiveId] = useState<string | null>(initialTasks.find((t) => !t.done)?.id ?? null);
  const [composing, setComposing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useFocusReturn(menuOpen);
  const [taskMenu, setTaskMenu] = useState(false);
  useFocusReturn(taskMenu);
  const [addingSub, setAddingSub] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const subRef = useRef<HTMLInputElement>(null);

  // ── session timer (kept from the original engine; surfaced via the ⋮ menu) ──
  // POMODORO REMOVED (user: "remove Pomodoro, it's not important"). It forced a
  // mode decision into every timer — two clocks with different rules, one of
  // which ignored the task's own estimate. What is left is the session timer:
  // it counts up against the task's PLANNED time, which is the number the user
  // already set.
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const active = tasks.find((t) => t.id === activeId) ?? null;
  const activeSubs = useMemo(() => (activeId ? subs[activeId] ?? [] : []), [subs, activeId]);
  const lastId = useRef(activeId);
  useEffect(() => {
    if (activeId !== lastId.current) { setSeconds(0); setRunning(false); setNotesDraft(null); setAddingSub(false); lastId.current = activeId; }
  }, [activeId]);
  useEffect(() => { if (addingSub) subRef.current?.focus(); }, [addingSub]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && /input|textarea/i.test((e.target as HTMLElement).tagName)) return;
      if (e.key === ' ') { e.preventDefault(); setRunning((r) => !r); }
      if (e.key === 'Escape') router.push('/today');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const mins = Math.round(seconds / 60);
  const note = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2200); };

  async function complete(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: true } : t)));
    signalTaskToggle(true);
    await toggleTask(id, true);
    if (id === activeId && mins > 0) await logTime(id, mins);
    setRunning(false); setSeconds(0);
    if (id === activeId) setActiveId(tasks.find((t) => t.id !== id && !t.done)?.id ?? null);
  }
  // A ticked row in "Done today" un-ticks, as a checked box does everywhere else — it used to be a filled disc that
  // did nothing when pressed.
  async function reopen(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: false } : t)));
    signalTaskToggle(false);
    const res = await toggleTask(id, false);
    if ('error' in res) {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: true } : t)));
      toastReverted(res.error);
    }
  }
  async function toggleSub(sid: string) {
    if (!activeId) return;
    const cur = (subs[activeId] ?? []).find((s) => s.id === sid); if (!cur) return;
    setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) }));
    signalTaskToggle(!cur.done);
    const res = await toggleTask(sid, !cur.done);
    if ('error' in res) {
      setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).map((s) => (s.id === sid ? { ...s, done: cur.done } : s)) }));
      toastReverted(res.error);
    }
  }
  async function submitSub() {
    const t = subDraft.trim(); if (!t || !activeId) { setAddingSub(false); setSubDraft(''); return; }
    setSubDraft('');
    const tmp = tempId();
    setSubs((m) => ({ ...m, [activeId]: [...(m[activeId] ?? []), { id: tmp, title: t, done: false }] }));
    const res = await addSubtask(activeId, t);
    if ('id' in res) setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).map((s) => (s.id === tmp ? { ...s, id: res.id } : s)) }));
    else setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).filter((s) => s.id !== tmp) }));
    subRef.current?.focus();
  }
  async function saveNotes() {
    if (!active || notesDraft === null || notesDraft === (active.notes ?? '')) return;
    const val = notesDraft;
    setTasks((ts) => ts.map((t) => (t.id === active.id ? { ...t, notes: val } : t)));
    const res = await updateTask(active.id, { notes: val });
    if ('error' in res) note('Couldn’t save notes.');
  }
  // Auto-save notes shortly after typing stops (blur also saves — this covers
  // closing the tab or switching tasks mid-thought).
  useEffect(() => {
    if (notesDraft === null) return;
    const t = setTimeout(saveNotes, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft]);
  async function sendMessage() {
    const t = msg.trim(); if (!t || !active) return;
    setMsg('');
    const res = await addComment(active.id, t);
    note('error' in res ? 'Couldn’t log that.' : 'Logged to task.');
  }
  async function createTask(spec: { title: string; notes: string; date: string | null; priority: 'low' | 'med' | 'high' | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow'; estimate: number | null }) {
    const title = spec.title.trim(); if (!title) return;
    const isInbox = !spec.date && spec.dest === 'inbox';
    const scheduledDate = spec.date ?? (spec.dest === 'today' ? isoDay(0) : spec.dest === 'tomorrow' ? isoDay(1) : null);
    const res = await addTask({ title, priority: spec.priority ?? 'low', estimateMinutes: spec.estimate, scheduledDate: isInbox ? null : scheduledDate, isInbox, projectId: spec.projectId, notes: spec.notes || null });
    setComposing(false);
    if ('error' in res) { note(res.error); return; }
    if (!isInbox && scheduledDate === isoDay(0)) {
      const t: FocusTask = { id: res.id, title, done: false, priority: spec.priority ?? 'low', highlight: false, estimate_minutes: spec.estimate ?? null, elapsed_minutes: 0, project_id: spec.projectId, notes: spec.notes || null };
      setTasks((ts) => [...ts, t]);
      setActiveId(res.id);
    } else {
      note(isInbox ? 'Added to Inbox.' : 'Scheduled for tomorrow.');
    }
  }

  const proj = active?.project_id ? projects[active.project_id] : null;
  const plannedSec = (active?.estimate_minutes ?? 25) * 60;
  const upNext = tasks.filter((t) => !t.done && t.id !== activeId);
  const doneToday = tasks.filter((t) => t.done).length;
  // ACTUAL vs PLANNED — the two columns the session reads down. `actualOf`
  // folds the LIVE session into the active row, so the number you are watching
  // is the number that will be logged; every other row shows what it has
  // already banked.
  const actualOf = (t: FocusTask) =>
    (t.elapsed_minutes ?? 0) * 60 + (t.id === activeId ? seconds : 0);
  const flowSeconds = tasks.reduce((n, t) => n + actualOf(t), 0);
  // Previous / Next walk today's OPEN work in its order — the queue you are
  // actually working, not every row on the page.
  const queue = tasks.filter((t) => !t.done);
  const qi = queue.findIndex((t) => t.id === activeId);
  const prevTask = qi > 0 ? queue[qi - 1] : null;
  const nextTask = qi >= 0 && qi < queue.length - 1 ? queue[qi + 1] : null;
  // `formatMinutes` (lib/date.ts), not a private "1h 30m" — the guard in
  // date-vocabulary.test.ts caught this one the moment it was written, which is
  // what it is for: six copies of this formatter existed once and disagreed.
  const flowLabel = formatMinutes(Math.round(flowSeconds / 60));
  // "Nothing left" and "nothing at all" are different days and deserve
  // different sentences. Telling someone who has just finished eight things
  // that their task list is empty is the app failing to notice.
  const clearedUp = !active && doneToday > 0;

  return (
    // Fills the shell's content panel like every other page — the approved
    // global top bar (with its Focus switch) stays visible, so Focus no longer
    // carries a second, drifting top bar of its own.
    <div className="zb-page-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Card header: elapsed chip + ⋮ session menu */}
        <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '0 12px', borderBottom: '1px solid var(--line-2)' }}>
          {seconds > 0 && (
            <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: running ? 'var(--ink)' : 'var(--text-secondary)' }}>
              {clock(seconds)}
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Focus session options"
              style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Icon icon={EllipsisVertical} size={20} weight="bold" />
            </button>
            {menuOpen && (
              <div className={`${OVERLAY_CLASS} zb-enter`} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 'var(--z-dropdown)', width: 224, padding: 4, animation: 'zb-pop-in var(--duration-fast) var(--ease-out-quiet)', transformOrigin: 'top right' }}
                onMouseLeave={() => setMenuOpen(false)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
                  <span className="num" style={{ flex: 1, fontSize: 'var(--text-h3-size)', fontWeight: 500, color: 'var(--ink)' }}>{clock(seconds)}</span>
                  <button onClick={() => setSeconds(0)} title="Reset" style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><Icon icon={RotateCcw} size={14} /></button>
                  <button onClick={() => setRunning((r) => !r)} className="zb-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 'var(--text-caption-size)', fontWeight: 500, cursor: 'pointer' }}>
                    <IconSwap swapKey={running ? 'pause' : 'play'}><Icon icon={running ? Pause : Play} size={12} /></IconSwap> {running ? 'Pause' : 'Start'}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)', padding: '0 8px 6px' }}>Space starts or pauses · {Math.round(plannedSec / 60)} min planned</div>
                {active && (
                  <>
                    <div style={{ height: 1, background: 'var(--line-2)', margin: '4px 0' }} />
                    <button onClick={() => { setMenuOpen(false); complete(active.id); }} className="zb-press" style={menuRow}>
                      <Icon icon={Check} size={14} /> Complete task{mins > 0 ? ` · log ${mins}m` : ''}
                    </button>
                    <button onClick={() => router.push(`/tasks?task=${active.id}`)} className="zb-press" style={menuRow}>
                      <Icon icon={ExternalLink} size={14} /> Open in Tasks
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card body — centered column */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '48px 24px 24px' }}>
          <div style={{ maxWidth: 848, margin: '0 auto' }}>
            {composing ? (
              <Composer projects={Object.values(projects)} defaultDest="today" defaultProject={null} onCancel={() => setComposing(false)} onSubmit={createTask} />
            ) : !active ? (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-stat-size)', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 20 }}>
                  {clearedUp
                    ? `That's everything for today.`
                    : 'Nothing planned for today.'}
                </div>
                <AddLine lead="checkbox" className="px-1" onClick={() => setComposing(true)}>Add task</AddLine>
              </div>
            ) : (
              <>
                {/* Column headers — the two numbers this mode is about. Without
                    them the times on each row are unlabelled and read as noise. */}
                <div className="mb-2.5 flex items-center gap-3 border-b border-line-soft pb-1.5">
                  <span className="flex-1 text-overline text-ink-500">Today&rsquo;s tasks</span>
                  <span className="w-[52px] shrink-0 text-right text-overline text-ink-500">Actual</span>
                  <span className="w-[56px] shrink-0 text-right text-overline text-ink-500">Planned</span>
                  <span className="w-[86px] shrink-0" aria-hidden />
                </div>

                {/* Focused task */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* The house checkbox at the hero's size — one control for "done" on every surface, here a step
                      larger because this task is the page. */}
                  <Checkbox checked={false} onCheckedChange={() => complete(active.id)} aria-label="Complete task" className="mt-1 size-5 shrink-0" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-h2-size)', color: 'var(--ink)', lineHeight: 1.4 }}>{active.title}</div>
                    {/* The same facts, marks and order as the task's row everywhere else. */}
                    <TaskMeta layout="card" className="mt-2" project={proj} priority={active.priority} />
                  </div>
                  {/* THE TIMER, ON THE TASK. It used to live inside the ⋮ menu,
                      which put the one control this mode exists for behind an
                      unlabelled button — you could sit in Focus and never find
                      it. It counts against the task's own planned time. */}
                  <div className="flex shrink-0 items-center gap-3 self-start pt-1">
                    <TimeCells actualSec={actualOf(active)} plannedMin={active.estimate_minutes} live={running} />
                    <Button
                      size="sm"
                      variant={running ? 'secondary' : 'primary'}
                      className="w-[86px]"
                      icon={<IconSwap swapKey={running ? 'pause' : 'play'}><Icon icon={running ? Pause : Play} size={14} /></IconSwap>}
                      onClick={() => setRunning((r) => !r)}
                    >
                      {running ? 'Pause' : 'Start'}
                    </Button>
                  </div>
                  <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                    <button onClick={() => setTaskMenu((v) => !v)} aria-label="Task options"
                      style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Icon icon={EllipsisVertical} size={16} weight="bold" />
                    </button>
                    {taskMenu && (
                      <div className={`${OVERLAY_CLASS} zb-enter`} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 'var(--z-dropdown)', minWidth: 190, padding: 4, animation: 'zb-pop-in var(--duration-fast) var(--ease-out-quiet)', transformOrigin: 'top right' }}
                        onMouseLeave={() => setTaskMenu(false)}>
                        <button onClick={() => { setTaskMenu(false); complete(active.id); }} className="zb-press" style={menuRow}>
                          <Icon icon={Check} size={14} /> Complete{mins > 0 ? ` · log ${mins}m` : ''}
                        </button>
                        {/* The task switcher moved out of here and onto the
                            page as "Up next" — a menu is the wrong home for
                            the one list this mode exists to show. */}
                        <button onClick={() => router.push(`/tasks?task=${active.id}`)} className="zb-press" style={menuRow}>
                          <Icon icon={ExternalLink} size={14} /> Open in Tasks
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div aria-hidden style={{ height: 1, background: 'var(--line-2)', margin: '24px 0' }} />

                {/* Subtasks */}
                {/* The checklist, on the same geometry as every list in Focus: a 36px row, the house checkbox, the
                    add line with its + on the checkboxes' vertical. The checked box was the accent here and ink
                    everywhere else. */}
                {activeSubs.map((s) => (
                  <div key={s.id} className="flex h-9 items-center gap-3 px-1">
                    <Checkbox checked={s.done} onCheckedChange={() => toggleSub(s.id)} aria-label={s.done ? 'Mark subtask not done' : 'Mark subtask done'} className="shrink-0" />
                    <span className={cn('min-w-0 flex-1 truncate text-ui', s.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{s.title}</span>
                  </div>
                ))}
                {addingSub ? (
                  <label className={cn(addLine({ as: 'field', lead: 'checkbox' }), 'px-1')}>
                    <Icon icon={Plus} size={14} className="mx-px shrink-0" />
                    <input ref={subRef} value={subDraft} onChange={(e) => setSubDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitSub(); if (e.key === 'Escape') { setAddingSub(false); setSubDraft(''); } }}
                      onBlur={() => { if (!subDraft.trim()) setAddingSub(false); }}
                      placeholder="Subtask title" aria-label="New subtask" autoComplete="off" data-1p-ignore data-lpignore="true"
                      className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
                  </label>
                ) : (
                  <AddLine lead="checkbox" className="px-1" onClick={() => setAddingSub(true)}>Add subtask</AddLine>
                )}

                {/* UP NEXT — today's remaining work, visible.
                    It used to exist only inside the ⋮ menu, which meant a mode
                    whose whole promise is "show me what I have to do today"
                    showed exactly one task and hid the rest behind a button
                    with no label. One line each, no metadata, no actions: this
                    is a glance at what is left and a way to switch, not a
                    second task list to manage. */}
                {(upNext.length > 0 || doneToday > 0) && (
                  <div className="mt-7">
                    {upNext.length > 0 && (
                      <div className="mb-1 px-1 text-overline text-ink-500">
                        Up next ({upNext.length})
                      </div>
                    )}
                    {/* Each row carries its OWN two numbers on the same grid as
                        the task above, so the day reads as one column of actual
                        against planned rather than one task plus a list. */}
                    {upNext.map((t) => {
                      const proj = t.project_id ? projects[t.project_id] : null;
                      // The box completes, the title switches — a task's checkbox means "done" on every surface, and
                      // here it used to be a hairline circle that only switched.
                      return (
                        <div key={t.id} className="flex h-9 w-full items-center gap-3 rounded-sm px-1 transition-colors duration-fast hover:bg-surface-hover">
                          <Checkbox checked={false} onCheckedChange={() => complete(t.id)} aria-label={`Complete ${t.title}`} className="shrink-0" />
                          <button type="button" onClick={() => setActiveId(t.id)}
                            className="focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-ui text-ink-700 hover:text-ink-900 [@media(pointer:coarse)]:min-h-6">
                            {t.title}
                          </button>
                          <TaskMeta project={proj} className="max-sm:hidden" />
                          <TimeCells actualSec={actualOf(t)} plannedMin={t.estimate_minutes} />
                          <span className="w-[86px] shrink-0" aria-hidden />
                        </div>
                      );
                    })}
                    {/* Done today stays on screen. A day where you finished six
                        things and a day where you finished none are not the same
                        day, and hiding the evidence makes Focus feel like it
                        never moves. */}
                    {tasks.filter((t) => t.done).map((t) => (
                      <div key={t.id} className="flex h-9 w-full items-center gap-3 rounded-sm px-1 text-ui text-ink-500">
                        <Checkbox checked onCheckedChange={() => reopen(t.id)} aria-label={`Mark ${t.title} not done`} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate line-through">{t.title}</span>
                        <TimeCells actualSec={actualOf(t)} plannedMin={t.estimate_minutes} />
                        <span className="w-[86px] shrink-0" aria-hidden />
                      </div>
                    ))}
                    <AddLine lead="checkbox" className="mt-1 px-1" onClick={() => setComposing(true)}>Add task</AddLine>
                  </div>
                )}

                {/* Notes */}
                <div style={{ background: 'var(--paper-3)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon icon={Notebook} size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 'var(--text-body-lg-size)', color: 'var(--text-muted)' }}>Notes</span>
                  </div>
                  <textarea
                    value={notesDraft ?? active.notes ?? ''}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={saveNotes}
                    placeholder="Start writing"
                    rows={Math.max(2, (notesDraft ?? active.notes ?? '').split('\n').length)}
                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontSize: 'var(--text-body-lg-size)', lineHeight: 1.6, color: 'var(--ink-2)', fontFamily: 'inherit', padding: '0 0 0 26px' }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* SESSION FOOTER — where you are in the day, and the one act that ends
            the current task. Previous/Next move through today's open work
            without going back to a list; the middle is the day's score, which is
            the only number that answers "is this session going anywhere".
            Deliberately a bar, not a menu: completing a task is the most common
            thing done in Focus and it was two clicks inside a ⋮. */}
        {active && !composing && (
          <div className="shrink-0 border-t border-line-soft px-6 py-3">
            <div className="mx-auto flex max-w-[848px] flex-wrap items-center gap-3">
              <Button size="sm" variant="ghost" disabled={prevTask === null}
                icon={<Icon icon={ArrowLeft} size={16} />}
                onClick={() => prevTask && setActiveId(prevTask.id)}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={nextTask === null}
                iconRight={<Icon icon={ArrowRight} size={16} />}
                onClick={() => nextTask && setActiveId(nextTask.id)}>Next</Button>
              <span className="flex-1" />
              <span className="text-caption text-ink-500">
                <b className="tabular-nums text-ink-800">{doneToday}/{tasks.length}</b> done
                {flowSeconds > 0 && <> · <b className="tabular-nums text-ink-800">{flowLabel}</b> in flow</>}
              </span>
              <Button size="sm" variant="secondary" icon={<Icon icon={Check} size={16} />}
                onClick={() => complete(active.id)}>
                Complete task{mins > 0 ? ` · ${mins}m` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Pinned message bar (only while focusing a task) */}
        {active && !composing && (
          <div style={{ flexShrink: 0, padding: '14px 24px 20px' }}>
            <div style={{ maxWidth: 848, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 8px 0 20px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-sm)' }}>
              <input value={msg} onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Leave a message..." autoComplete="off" data-1p-ignore data-lpignore="true"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-lg-size)', color: 'var(--ink)' }} />
              {flash && <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--accent-text)', flexShrink: 0 }}>{flash}</span>}
              <button onClick={sendMessage} disabled={!msg.trim()} aria-label="Log message to task" className="zb-press"
                style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 'var(--r-lg)', border: 'none', background: msg.trim() ? 'var(--primary)' : 'var(--paper-3)', color: msg.trim() ? 'var(--on-primary)' : 'var(--text-secondary)', cursor: msg.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
                <Icon icon={ArrowUp} size={16} weight="bold" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

const menuRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 'var(--r-xs)',
  border: 'none', background: 'transparent', color: 'var(--ink-2)', fontSize: 'var(--text-small-size)', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
};

