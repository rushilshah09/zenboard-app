'use client';
// Rituals — calm full-screen guided flows that each write a `rituals` row.
// daily_plan: pick the day's highlight · daily_shutdown: close + carry forward
// + reflect · weekly_review: reflect against goals.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Repeat, X, ArrowRight, ChevronLeft, Check, Flame, Flag, Inbox, Kanban } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { saveRitual } from '@/lib/actions/rituals';
import { setHighlight, toggleTask, rescheduleTask } from '@/lib/actions/tasks';
import { toggleHabit } from '@/lib/actions/habits';
import { signalTaskToggle } from '@/lib/sound';

export type RitualType = 'daily_plan' | 'daily_shutdown' | 'weekly_review';
export type RTask = { id: string; title: string; done: boolean; highlight: boolean; estimate_minutes: number | null };
export type RGoal = { id: string; title: string; behind: boolean; progress: number };
export type RProject = { id: string; name: string; openCount: number };
export type RHabit = { id: string; title: string; done: boolean };

const META: Record<RitualType, { icon: typeof Sun; title: string; tag: string }> = {
  daily_plan: { icon: Sun, title: 'Plan your day', tag: 'DAILY PLANNING' },
  daily_shutdown: { icon: Moon, title: 'Close the day', tag: 'DAILY SHUTDOWN' },
  weekly_review: { icon: Repeat, title: 'Weekly review', tag: 'WEEKLY REVIEW' },
};
const fmtDur = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`);

function Frame({ type, children }: { type: RitualType; children: React.ReactNode }) {
  const router = useRouter();
  const m = META[type];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--paper)', display: 'flex', flexDirection: 'column', animation: 'blurin 320ms var(--ease)', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center' }}><Icon icon={m.icon} size={16} /></span>
        <span style={{ fontSize: 'var(--text-label-size)', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>{m.tag}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.push('/today')} title="Leave (Esc)" style={{ width: 30, height: 30, border: 'none', background: 'var(--paper-2)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center' }}><Icon icon={X} size={16} /></button>
      </div>
      <div style={{ flex: 1, padding: '8px 24px 60px', display: 'flex', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

function Step({ n, total, title, sub, children, onNext, onPrev, nextLabel = 'Continue', canNext = true }: {
  n: number; total: number; title: string; sub?: string; children?: React.ReactNode; onNext: () => void; onPrev?: () => void; nextLabel?: string; canNext?: boolean;
}) {
  return (
    <div style={{ width: '100%', maxWidth: 620, animation: 'fadein 260ms var(--ease)' }}>
      <div style={{ fontSize: 'var(--text-label-size)', fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Step {n} of {total}</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-size)', fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</h2>
      {sub && <div style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 'var(--text-h2-size)', color: 'var(--text-secondary)', marginBottom: 24 }}>{sub}</div>}
      <div>{children}</div>
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onPrev} style={{ visibility: n === 1 ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)' }}><Icon icon={ChevronLeft} size={14} /> Back</button>
        <div style={{ display: 'flex', gap: 4 }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ width: 22, height: 3, borderRadius: 'var(--r-full)', background: i < n ? 'var(--ink-2)' : 'var(--line)', transition: 'background var(--dur-mid) var(--ease)' }} />)}</div>
        <button onClick={onNext} disabled={!canNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', background: 'var(--primary)', color: 'var(--on-primary)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--text-small-size)', fontWeight: 600, cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.4, transition: 'opacity var(--dur-fast) var(--ease)' }}>{nextLabel} <Icon icon={ArrowRight} size={16} /></button>
      </div>
    </div>
  );
}

function pickRow(active: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', borderRadius: 'var(--r-lg)', cursor: 'pointer', textAlign: 'left', background: active ? 'var(--nav-active-bg)' : 'var(--paper-2)', border: '1px solid var(--line)', marginBottom: 8, transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)' };
}

export function RitualFlow({ type, todayTasks, goals, habits = [], todayISO, tomorrowISO, inboxCount = 0, projects = [] }: { type: RitualType; todayTasks: RTask[]; goals: RGoal[]; habits?: RHabit[]; todayISO?: string; tomorrowISO: string; inboxCount?: number; projects?: RProject[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [tasks, setTasks] = useState(todayTasks);
  const [highlightId, setHighlightId] = useState<string | null>(todayTasks.find((t) => t.highlight)?.id ?? null);
  const [habitDone, setHabitDone] = useState<Set<string>>(() => new Set(habits.filter((h) => h.done).map((h) => h.id)));
  const [carry, setCarry] = useState(true);
  const [reflection, setReflection] = useState('');
  const [busy, setBusy] = useState(false);

  // Check a habit off (or back on) for today — optimistic, writes a habit_log.
  function flipHabit(id: string) {
    const on = !habitDone.has(id);
    setHabitDone((prev) => { const s = new Set(prev); if (on) s.add(id); else s.delete(id); return s; });
    if (on) signalTaskToggle(true);
    toggleHabit(id, on, todayISO);
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const next = () => setIdx((i) => i + 1);
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  async function finish() {
    if (busy) return; setBusy(true);
    if (type === 'daily_plan') {
      if (highlightId) await setHighlight(highlightId, true);
      await saveRitual('daily_plan', { highlightTaskId: highlightId });
    } else if (type === 'daily_shutdown') {
      if (carry) await Promise.all(open.map((t) => rescheduleTask(t.id, tomorrowISO)));
      await saveRitual('daily_shutdown', { reflection });
    } else {
      await saveRitual('weekly_review', { reflection });
    }
    router.push('/today'); router.refresh();
  }

  // ── flows ──────────────────────────────────────────────────────────
  if (type === 'daily_plan') {
    const hasHabits = habits.length > 0;
    const total = hasHabits ? 4 : 3;
    const readyIdx = hasHabits ? 3 : 2;
    return (
      <Frame type={type}>
        {idx === 0 && <Step n={1} total={total} title="A calm start." sub="Three minutes to shape the day before it shapes you." onNext={next} nextLabel="Begin" />}
        {idx === 1 && (
          <Step n={2} total={total} title="Pick today's highlight." sub="The one thing that, if done, makes today a win." onNext={next} onPrev={prev} canNext={open.length === 0 || !!highlightId}>
            {open.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>Nothing scheduled today yet — add tasks on Today first.</div> :
              open.map((t) => (
                <button key={t.id} style={pickRow(highlightId === t.id)} onClick={() => setHighlightId(t.id)}>
                  <Icon icon={Flame} size={16} style={{ color: highlightId === t.id ? 'var(--ink)' : 'var(--text-secondary)' }} />
                  <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{t.title}</span>
                  {t.estimate_minutes != null && <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>{fmtDur(t.estimate_minutes)}</span>}
                  {highlightId === t.id && <Icon icon={Check} size={16} style={{ color: 'var(--accent-text)' }} />}
                </button>
              ))}
          </Step>
        )}
        {hasHabits && idx === 2 && (
          <Step n={3} total={total} title="Keep your streak." sub="Check off the habits you're carrying through today." onNext={next} onPrev={prev} nextLabel="Continue">
            {habits.map((h) => {
              const on = habitDone.has(h.id);
              return (
                <button key={h.id} style={pickRow(on)} onClick={() => flipHabit(h.id)}>
                  <span style={{ width: 18, height: 18, borderRadius: 'var(--r-xs)', border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background var(--dur-fast) var(--ease)' }}>
                    {on && <Icon icon={Check} size={12} style={{ color: 'var(--paper)' }} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)', textDecoration: on ? 'line-through' : 'none' }}>{h.title}</span>
                </button>
              );
            })}
          </Step>
        )}
        {idx === readyIdx && (
          <Step n={total} total={total} title="Ready." sub="Your day is set. Go make it count." onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Start the day'} canNext={!busy}>
            <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)' }}>{open.length} task{open.length === 1 ? '' : 's'} planned · {fmtDur(open.reduce((a, t) => a + (t.estimate_minutes ?? 0), 0)) || '0m'} committed{highlightId ? ' · highlight set' : ''}{hasHabits ? ` · ${habitDone.size}/${habits.length} habits` : ''}.</div>
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
                  style={{ width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', border: t.done ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: t.done ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all var(--dur-fast) var(--ease)' }}>
                  {t.done && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--paper-2)' }} />}
                </button>
                <span style={{ fontSize: 'var(--text-body-size)', color: t.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
              </div>
            ))}
            {tasks.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>Nothing on today.</div>}
          </Step>
        )}
        {idx === 1 && (
          <Step n={2} total={total} title="Carry the rest forward?" sub={`${open.length} unfinished task${open.length === 1 ? '' : 's'}.`} onNext={next}>
            <button onClick={() => setCarry((c) => !c)} style={pickRow(carry)}>
              <span style={{ width: 18, height: 18, borderRadius: 'var(--r-xs)', border: carry ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: carry ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{carry && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--on-accent)' }} />}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>Move {open.length} unfinished to tomorrow</span>
            </button>
          </Step>
        )}
        {idx === 2 && (
          <Step n={3} total={total} title="One honest line." sub="What mattered today? What slipped?" onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Close the day'} canNext={!busy}>
            <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} autoFocus rows={4} placeholder="Today I…"
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', outline: 'none', background: 'var(--paper-2)', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-body-lg-size)', lineHeight: 1.6, color: 'var(--ink-2)', padding: '12px 14px' }} />
          </Step>
        )}
      </Frame>
    );
  }

  // weekly_review — a guided pass: clear the inbox · each project's next action
  // · goals glance · reflect. (GTD's weekly review, sized for one person.)
  const total = 4;
  const activeProjects = projects.filter((p) => p.openCount > 0);
  return (
    <Frame type={type}>
      {idx === 0 && (
        <Step n={1} total={total} title={inboxCount === 0 ? 'Inbox is clear.' : `${inboxCount} thought${inboxCount === 1 ? '' : 's'} waiting.`}
          sub={inboxCount === 0 ? 'Nothing to process — a clean start to the week.' : 'Process these to zero after the review, so nothing stays loose.'}
          onNext={next} nextLabel="Next">
          <button onClick={() => router.push('/inbox')} style={{ ...pickRow(false), cursor: inboxCount === 0 ? 'default' : 'pointer' }} disabled={inboxCount === 0}>
            <Icon icon={Inbox} size={16} style={{ color: inboxCount === 0 ? 'var(--green-text)' : 'var(--accent-text)' }} />
            <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{inboxCount === 0 ? 'Inbox at zero' : `Open the inbox to triage ${inboxCount}`}</span>
            {inboxCount === 0 ? <Icon icon={Check} size={16} style={{ color: 'var(--green-text)' }} /> : <Icon icon={ArrowRight} size={16} style={{ color: 'var(--text-secondary)' }} />}
          </button>
        </Step>
      )}
      {idx === 1 && (
        <Step n={2} total={total} title="What needs a next action?" sub="Each active project should have one clear next move." onNext={next} onPrev={prev} nextLabel="Next">
          {activeProjects.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>No active projects with open work — nothing waiting on you.</div> :
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
        <Step n={3} total={total} title="Where do your goals stand?" sub="A quick look at the few outcomes that matter." onNext={next} onPrev={prev} nextLabel="Reflect">
          {goals.length === 0 ? <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>No goals yet — set some in Goals.</div> :
            goals.map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', marginBottom: 8 }}>
                <Icon icon={g.behind ? Flag : Check} size={14} style={{ color: g.behind ? 'var(--red-text)' : 'var(--green-text)' }} />
                <span style={{ flex: 1, fontSize: 'var(--text-body-size)', color: 'var(--ink)' }}>{g.title}</span>
                <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round((g.progress ?? 0) * 100)}%</span>
                <span style={{ fontSize: 'var(--text-label-size)', color: g.behind ? 'var(--red-text)' : 'var(--green-text)' }}>{g.behind ? 'Behind' : 'On track'}</span>
              </div>
            ))}
        </Step>
      )}
      {idx === 3 && (
        <Step n={4} total={total} title="What did this week teach you?" sub="Carry the lesson, not the guilt." onNext={finish} onPrev={prev} nextLabel={busy ? 'Saving…' : 'Finish review'} canNext={!busy}>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} autoFocus rows={4} placeholder="This week…"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', outline: 'none', background: 'var(--paper-2)', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-body-lg-size)', lineHeight: 1.6, color: 'var(--ink-2)', padding: '12px 14px' }} />
        </Step>
      )}
    </Frame>
  );
}
