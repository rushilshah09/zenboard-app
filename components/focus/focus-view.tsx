'use client';
// Focus — immersive single-task mode inside the standard app shell (the global
// top bar's Focus switch is the way in and out; Esc also exits): one centered
// column holding the focused task (checkbox · tags · subtasks · Notes), and a
// pinned "Leave a message…" bar that logs comments to the task. The session
// timer lives behind the ⋮ menu (Space still starts/pauses; completing logs
// elapsed time).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EllipsisVertical, SquarePlus, Notebook, ArrowUp, Flag, Folder, ChevronDown, Check, Play, Pause, RotateCcw, Timer as TimerIcon, Flame, ExternalLink } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { QuickAddRow } from '@/components/ui/primitives';
import { Composer } from '@/components/tasks/tasks-view';
import { toggleTask, logTime, addTask, addSubtask, updateTask, addComment } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';

export type FocusTask = {
  id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high';
  highlight: boolean; estimate_minutes: number | null; elapsed_minutes: number;
  project_id: string | null; notes: string | null;
};
export type FocusSub = { id: string; title: string; done: boolean };
export type FocusProject = { id: string; name: string; color: string | null };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const WORK = 25 * 60, BREAK = 5 * 60;
const PRIO_COLOR: Record<string, string> = { high: 'var(--red)', med: 'var(--amber)', low: 'var(--text-muted)' };
const PRIO_LABEL: Record<string, string> = { high: 'High', med: 'Medium', low: 'Low' };
const isoDay = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function FocusView({ initialTasks, subsByTask, projects }: {
  initialTasks: FocusTask[]; subsByTask: Record<string, FocusSub[]>; projects: Record<string, FocusProject>;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [subs, setSubs] = useState(subsByTask);
  const [activeId, setActiveId] = useState<string | null>(initialTasks.find((t) => !t.done)?.id ?? null);
  const [composing, setComposing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskMenu, setTaskMenu] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const subRef = useRef<HTMLInputElement>(null);

  // ── session timer (kept from the original engine; surfaced via the ⋮ menu) ──
  const [mode, setMode] = useState<'focus' | 'pomodoro'>('focus');
  const [pomoPhase, setPomoPhase] = useState<'work' | 'break'>('work');
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
    const id = setInterval(() => setSeconds((s) => {
      const n = s + 1;
      if (mode === 'pomodoro') {
        if (pomoPhase === 'work' && n >= WORK) { setPomoPhase('break'); setRunning(false); return 0; }
        if (pomoPhase === 'break' && n >= BREAK) { setPomoPhase('work'); setRunning(false); return 0; }
      }
      return n;
    }), 1000);
    return () => clearInterval(id);
  }, [running, mode, pomoPhase]);

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
  async function toggleSub(sid: string) {
    if (!activeId) return;
    const cur = (subs[activeId] ?? []).find((s) => s.id === sid); if (!cur) return;
    setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) }));
    signalTaskToggle(!cur.done);
    const res = await toggleTask(sid, !cur.done);
    if ('error' in res) setSubs((m) => ({ ...m, [activeId]: (m[activeId] ?? []).map((s) => (s.id === sid ? { ...s, done: cur.done } : s)) }));
  }
  async function submitSub() {
    const t = subDraft.trim(); if (!t || !activeId) { setAddingSub(false); setSubDraft(''); return; }
    setSubDraft('');
    const tmp = 'tmp-' + Date.now();
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
  async function createTask(spec: { title: string; notes: string; date: string | null; priority: 'low' | 'med' | 'high' | null; projectId: string | null; dest: 'inbox' | 'today' | 'tomorrow' }) {
    const title = spec.title.trim(); if (!title) return;
    const isInbox = !spec.date && spec.dest === 'inbox';
    const scheduledDate = spec.date ?? (spec.dest === 'today' ? isoDay(0) : spec.dest === 'tomorrow' ? isoDay(1) : null);
    const res = await addTask({ title, priority: spec.priority ?? 'low', scheduledDate: isInbox ? null : scheduledDate, isInbox, projectId: spec.projectId, notes: spec.notes || null });
    setComposing(false);
    if ('error' in res) { note(res.error); return; }
    if (!isInbox && scheduledDate === isoDay(0)) {
      const t: FocusTask = { id: res.id, title, done: false, priority: spec.priority ?? 'low', highlight: false, estimate_minutes: null, elapsed_minutes: 0, project_id: spec.projectId, notes: spec.notes || null };
      setTasks((ts) => [...ts, t]);
      setActiveId(res.id);
    } else {
      note(isInbox ? 'Added to Inbox.' : 'Scheduled for tomorrow.');
    }
  }

  const proj = active?.project_id ? projects[active.project_id] : null;
  const plannedSec = mode === 'pomodoro' ? (pomoPhase === 'work' ? WORK : BREAK) : (active?.estimate_minutes ?? 25) * 60;
  const upNext = tasks.filter((t) => !t.done && t.id !== activeId);

  return (
    // Fills the shell's content panel like every other page — the approved
    // global top bar (with its Focus switch) stays visible, so Focus no longer
    // carries a second, drifting top bar of its own.
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadein 220ms' }}>
        {/* Card header: elapsed chip + ⋮ session menu */}
        <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '0 12px', borderBottom: '1px solid var(--line-2)' }}>
          {seconds > 0 && (
            <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: running ? 'var(--ink)' : 'var(--text-secondary)' }}>
              {clock(seconds)}{mode === 'pomodoro' ? ` · ${pomoPhase}` : ''}
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Focus session options"
              style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Icon icon={EllipsisVertical} size={20} weight="bold" />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, width: 224, background: 'var(--paper-2)', border: '1px solid var(--line-pop)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, animation: 'fadein 120ms' }}
                onMouseLeave={() => setMenuOpen(false)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
                  <span className="num" style={{ flex: 1, fontSize: 'var(--text-h3-size)', fontWeight: 500, color: 'var(--ink)' }}>{clock(seconds)}</span>
                  <button onClick={() => setSeconds(0)} title="Reset" style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><Icon icon={RotateCcw} size={14} /></button>
                  <button onClick={() => setRunning((r) => !r)} className="zb-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 'var(--text-caption-size)', fontWeight: 500, cursor: 'pointer' }}>
                    <Icon icon={running ? Pause : Play} size={12} /> {running ? 'Pause' : 'Start'}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)', padding: '0 8px 6px' }}>Space starts or pauses · {mode === 'pomodoro' ? (pomoPhase === 'work' ? '25 min work' : '5 min break') : `${Math.round(plannedSec / 60)} min planned`}</div>
                <div style={{ height: 1, background: 'var(--line-2)', margin: '2px 0 4px' }} />
                {([['focus', 'Focus session', Flame], ['pomodoro', 'Pomodoro 25/5', TimerIcon]] as const).map(([id, label, icon]) => (
                  <button key={id} onClick={() => { setMode(id); setSeconds(0); setRunning(false); setPomoPhase('work'); }} className="zb-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 'var(--r-xs)', border: 'none', background: mode === id ? 'var(--nav-active-bg)' : 'transparent', color: mode === id ? 'var(--ink)' : 'var(--ink-2)', fontSize: 'var(--text-small-size)', fontWeight: mode === id ? 600 : 500, cursor: 'pointer', textAlign: 'left' }}>
                    <Icon icon={icon} size={14} /> {label}
                    {mode === id && <span style={{ marginLeft: 'auto', display: 'inline-flex' }}><Icon icon={Check} size={14} /></span>}
                  </button>
                ))}
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
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-stat-size)', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 20 }}>Your task list is empty.</div>
                <QuickAddRow onClick={() => setComposing(true)} />
              </div>
            ) : (
              <>
                {/* Focused task */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <button onClick={() => complete(active.id)} aria-label="Complete task"
                    style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0, borderRadius: 'var(--r-sm)', border: '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }} className="zb-press">
                    <Icon icon={Check} size={14} weight="bold" style={{ color: 'var(--text-secondary)', opacity: 0 }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-h2-size)', color: 'var(--ink)', lineHeight: 1.4 }}>{active.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                      {active.priority !== 'low' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          <Icon icon={Flag} size={14} weight="fill" style={{ color: PRIO_COLOR[active.priority] }} /> {PRIO_LABEL[active.priority]}
                        </span>
                      )}
                      {proj && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          <Icon icon={Folder} size={14} weight="fill" style={{ color: proj.color ?? 'var(--amber)' }} /> {proj.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                    <button onClick={() => setTaskMenu((v) => !v)} aria-label="Task options"
                      style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Icon icon={EllipsisVertical} size={16} weight="bold" />
                    </button>
                    {taskMenu && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, minWidth: 190, background: 'var(--paper-2)', border: '1px solid var(--line-pop)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, animation: 'fadein 120ms' }}
                        onMouseLeave={() => setTaskMenu(false)}>
                        <button onClick={() => { setTaskMenu(false); complete(active.id); }} className="zb-press" style={menuRow}>
                          <Icon icon={Check} size={14} /> Complete{mins > 0 ? ` · log ${mins}m` : ''}
                        </button>
                        {upNext.map((t) => (
                          <button key={t.id} onClick={() => { setTaskMenu(false); setActiveId(t.id); }} className="zb-press" style={menuRow}>
                            <Icon icon={ChevronDown} size={12} style={{ transform: 'rotate(-90deg)' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          </button>
                        ))}
                        <button onClick={() => router.push(`/tasks?task=${active.id}`)} className="zb-press" style={menuRow}>
                          <Icon icon={ExternalLink} size={14} /> Open in Tasks
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div aria-hidden style={{ height: 1, background: 'var(--line-2)', margin: '24px 0' }} />

                {/* Subtasks */}
                {activeSubs.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <button onClick={() => toggleSub(s.id)} aria-label={s.done ? 'Mark subtask not done' : 'Mark subtask done'}
                      style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 'var(--r-xs)', border: s.done ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: s.done ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      {s.done && <Icon icon={Check} size={12} weight="bold" style={{ color: 'var(--on-accent)' }} />}
                    </button>
                    <span style={{ fontSize: 'var(--text-body-lg-size)', color: s.done ? 'var(--text-secondary)' : 'var(--ink-2)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
                  </div>
                ))}
                {addingSub ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 'var(--r-xs)', border: '1.5px dashed color-mix(in srgb, var(--ink) 22%, transparent)' }} />
                    <input ref={subRef} value={subDraft} onChange={(e) => setSubDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitSub(); if (e.key === 'Escape') { setAddingSub(false); setSubDraft(''); } }}
                      onBlur={() => { if (!subDraft.trim()) setAddingSub(false); }}
                      placeholder="Subtask title…" autoComplete="off" data-1p-ignore data-lpignore="true"
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-lg-size)', color: 'var(--ink)', padding: 0 }} />
                  </div>
                ) : (
                  <button onClick={() => setAddingSub(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color var(--dur-fast) var(--ease)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
                    <Icon icon={SquarePlus} size={20} />
                    <span style={{ fontSize: 'var(--text-body-lg-size)' }}>Add subtask</span>
                  </button>
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

