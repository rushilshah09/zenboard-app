'use client';
// Horizon — goals grouped by horizon (Month / Quarter / Year, switchable).
// Progress rolls up from linked tasks (done/total), then milestones, then a
// manual value. Set a target date, link a project, complete/drop/reopen.
// Optimistic; persisted via goals.ts. 'month' needs migration 0008.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Target, CalendarDays, Plus, Check, ChevronDown, Repeat, Ellipsis, Kanban } from "@/components/ds/icons";
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/primitives';
import { Icon, SegmentedControl } from "@/components/ds/ui";
import { EmptyState } from '@/components/ui/states';
import { addGoal, updateGoal, addMilestone, toggleMilestone } from '@/lib/actions/goals';

type Milestone = { id: string; title: string; done: boolean };
type Horizon = 'month' | 'quarter' | 'year';
export type GoalProject = { id: string; name: string; color: string | null };
export type Goal = {
  id: string; title: string; note: string | null; horizon: Horizon;
  target_date: string | null; status: string; progress: number; project_id: string | null;
  milestones: Milestone[]; linkedDone: number; linkedTotal: number;
};

const SECTIONS: { id: Horizon; label: string; icon: typeof Flag }[] = [
  { id: 'month', label: 'Month', icon: CalendarDays },
  { id: 'quarter', label: 'Quarter', icon: Flag },
  { id: 'year', label: 'Year', icon: Target },
];
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function goalFrac(g: Goal) {
  if (g.linkedTotal > 0) return g.linkedDone / g.linkedTotal;
  if (g.milestones.length > 0) return g.milestones.filter((m) => m.done).length / g.milestones.length;
  return Math.max(0, Math.min(1, g.progress > 1 ? g.progress / 100 : g.progress));
}

function Ring({ frac, tone }: { frac: number; tone: string }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={26} cy={26} r={r} stroke="color-mix(in srgb, var(--ink) 8%, transparent)" strokeWidth={4} fill="none" />
        <circle cx={26} cy={26} r={r} stroke={tone} strokeWidth={4} fill="none" strokeDasharray={c} strokeDashoffset={(1 - frac) * c} strokeLinecap="round" style={{ transition: 'stroke-dashoffset var(--dur-mid) var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-caption-size)', fontWeight: 500 }}>{Math.round(frac * 100)}</div>
    </div>
  );
}

function GoalCard({ goal, projects, onAddMilestone, onToggleMilestone, onSaveNote, onStatus, onTarget, onProject }: {
  goal: Goal; projects: GoalProject[];
  onAddMilestone: (t: string) => void; onToggleMilestone: (id: string) => void; onSaveNote: (note: string) => void;
  onStatus: (s: 'active' | 'done' | 'dropped') => void; onTarget: (d: string | null) => void; onProject: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState('');
  const frac = goal.status === 'done' ? 1 : goalFrac(goal);
  const tone = goal.status === 'done' ? 'var(--green-text)' : goal.status === 'dropped' ? 'var(--text-muted)' : 'var(--ink-2)';
  const project = goal.project_id ? projects.find((p) => p.id === goal.project_id) : null;
  const progressLabel = goal.linkedTotal > 0 ? `${goal.linkedDone}/${goal.linkedTotal} tasks` : goal.milestones.length > 0 ? `${goal.milestones.filter((m) => m.done).length}/${goal.milestones.length} steps` : `${Math.round(frac * 100)}%`;

  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', overflow: 'hidden', opacity: goal.status === 'dropped' ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 18 }}>
        <Ring frac={frac} tone={tone} />
        <button onClick={() => setOpen((o) => !o)} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--text-h3-size)', letterSpacing: '-0.01em', color: 'var(--ink)', textDecoration: goal.status === 'dropped' ? 'line-through' : 'none' }}>{goal.title}</h3>
            {goal.status === 'done' && <span style={{ fontSize: 'var(--text-label-size)', fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green-text)' }}>Done</span>}
            {goal.status === 'dropped' && <span style={{ fontSize: 'var(--text-label-size)', fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--paper-3)', color: 'var(--text-secondary)' }}>Dropped</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span>{progressLabel}</span>
            {goal.target_date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon icon={CalendarDays} size={12} />{fmtDate(goal.target_date)}</span>}
            {project && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: project.color || 'var(--text-secondary)' }} />{project.name}</span>}
          </div>
          <div style={{ height: 5, borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', overflow: 'hidden', marginTop: 10 }}>
            <div style={{ height: '100%', width: `${frac * 100}%`, background: tone, transition: 'width var(--dur-mid) var(--ease)' }} />
          </div>
        </button>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setMenu((m) => !m)} aria-label="Goal menu" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={Ellipsis} size={16} /></button>
          {menu && (
            <div onMouseLeave={() => setMenu(false)} style={{ position: 'absolute', top: 30, right: 0, zIndex: 60, width: 180, background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8 }}>
              {goal.status !== 'done' && <MenuBtn icon={Check} label="Mark done" onClick={() => { setMenu(false); onStatus('done'); }} />}
              {goal.status !== 'active' && <MenuBtn icon={Flag} label="Reopen" onClick={() => { setMenu(false); onStatus('active'); }} />}
              {goal.status !== 'dropped' && <MenuBtn icon={ChevronDown} label="Drop" onClick={() => { setMenu(false); onStatus('dropped'); }} />}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--line-2)', padding: '12px 18px 16px' }}>
          {/* target date + project link */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>Target date
              <input type="date" defaultValue={goal.target_date ?? ''} onChange={(e) => onTarget(e.target.value || null)} style={fieldStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>Project
              <select defaultValue={goal.project_id ?? ''} onChange={(e) => onProject(e.target.value || null)} style={fieldStyle}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          {goal.linkedTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginBottom: 8 }}><Icon icon={Kanban} size={12} />Progress tracks {goal.linkedTotal} linked task{goal.linkedTotal === 1 ? '' : 's'}.</div>
          )}
          {goal.milestones.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <button onClick={() => onToggleMilestone(m.id)} aria-label="toggle" style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 'var(--r-xs)', cursor: 'pointer', border: m.done ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 28%, transparent)', background: m.done ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.done && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--on-accent)' }} />}
              </button>
              <span style={{ fontSize: 'var(--text-small-size)', color: m.done ? 'var(--text-secondary)' : 'var(--ink-2)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 4px' }}>
            <Icon icon={Plus} size={14} style={{ color: 'var(--text-secondary)' }} />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onAddMilestone(draft.trim()); setDraft(''); } }} placeholder="Add a step…" autoComplete="off" data-1p-ignore data-lpignore="true" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-small-size)', padding: '4px 0', color: 'var(--ink)' }} />
          </div>
          <textarea defaultValue={goal.note ?? ''} placeholder="Add a note…" rows={1} onBlur={(e) => e.target.value !== (goal.note ?? '') && onSaveNote(e.target.value)} onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
            style={{ width: '100%', marginTop: 8, border: '1px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none', background: 'var(--paper)', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-small-size)', lineHeight: 1.5, color: 'var(--ink-2)', padding: '8px 10px' }} />
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, label, onClick }: { icon: typeof Flag; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'transparent', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left', color: 'var(--ink-2)', fontSize: 'var(--text-small-size)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <Icon icon={icon} size={14} style={{ color: 'var(--text-secondary)' }} />{label}
    </button>
  );
}

const fieldStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none', background: 'var(--paper)', fontSize: 'var(--text-small-size)', padding: '6px 8px', color: 'var(--ink)' };

export function HorizonView({ initialGoals, projects }: { initialGoals: Goal[]; projects: Record<string, GoalProject> }) {
  const [goals, setGoals] = useState(initialGoals);
  useEffect(() => { setGoals(initialGoals); }, [initialGoals]);
  const [active, setActive] = useState<Horizon>('quarter');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const projList = Object.values(projects);

  async function createGoal() {
    const t = title.trim(); if (!t) return;
    setTitle(''); setTarget(''); setAdding(false); setErr(null);
    const tmp = 'tmp-' + Date.now();
    setGoals((g) => [...g, { id: tmp, title: t, note: null, horizon: active, target_date: target || null, status: 'active', progress: 0, project_id: null, milestones: [], linkedDone: 0, linkedTotal: 0 }]);
    const res = await addGoal({ title: t, horizon: active, targetDate: target || null });
    if ('id' in res) setGoals((g) => g.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else { setGoals((g) => g.filter((x) => x.id !== tmp)); setErr(active === 'month' ? 'Month goals need migration 0008 applied.' : res.error); }
  }
  const patch = (id: string, p: Partial<Goal>) => setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...p } : x)));
  function setStatus(id: string, status: 'active' | 'done' | 'dropped') { patch(id, { status }); updateGoal(id, { status }); }
  function setTargetDate(id: string, d: string | null) { patch(id, { target_date: d }); updateGoal(id, { target_date: d }); }
  function setProjectLink(id: string, projectId: string | null) { patch(id, { project_id: projectId }); updateGoal(id, { project_id: projectId }); }
  function saveNote(id: string, note: string) { patch(id, { note }); updateGoal(id, { note }); }
  function addMs(goalId: string, t: string) {
    const tmp = 'tmpm-' + Date.now();
    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, milestones: [...x.milestones, { id: tmp, title: t, done: false }] } : x)));
    addMilestone(goalId, t).then((res) => { if ('id' in res) setGoals((g) => g.map((x) => x.id === goalId ? { ...x, milestones: x.milestones.map((m) => m.id === tmp ? { ...m, id: res.id } : m) } : x)); });
  }
  function toggleMs(goalId: string, msId: string) {
    let next = false;
    setGoals((g) => g.map((x) => x.id === goalId ? { ...x, milestones: x.milestones.map((m) => { if (m.id === msId) { next = !m.done; return { ...m, done: next }; } return m; }) } : x));
    toggleMilestone(msId, next);
  }

  const list = goals.filter((g) => g.horizon === active).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));

  return (
    <div style={{ padding: 'var(--view-pt) var(--view-px) var(--view-pb)', maxWidth: 1000, margin: '0 auto', animation: 'fadein 220ms' }}>
      <PageHeader hideTitle icon={Target} title="Goals" subtitle="The few outcomes that matter. Everything else is just this week." style={{ marginBottom: 20 }}
        actions={<>
          <Link href="/rituals?type=weekly_review" className="zb-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', color: 'var(--text-secondary)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-small-size)', fontWeight: 500, textDecoration: 'none' }}><Icon icon={Repeat} size={14} /> Weekly review</Link>
          <Button variant="primary" icon={Plus} onClick={() => setAdding((a) => !a)}>New goal</Button>
        </>} />

      {/* horizon switch — the shared segmented control */}
      <div style={{ marginBottom: 20 }}>
        <SegmentedControl
          aria-label="Goal horizon"
          value={active}
          onValueChange={(v) => setActive(v as Horizon)}
          options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
        />
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, padding: 12, background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', flexWrap: 'wrap' }}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createGoal(); if (e.key === 'Escape') setAdding(false); }} placeholder={`What outcome matters this ${active}?`} style={{ flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 'var(--r-md)', outline: 'none', background: 'var(--paper)', fontSize: 'var(--text-body-size)', padding: '8px 12px', color: 'var(--ink)' }} />
          <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} title="Target date (optional)" style={fieldStyle} />
          <Button variant="primary" onClick={createGoal}>Add</Button>
        </div>
      )}
      {err && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)', marginBottom: 14 }}>{err}</div>}

      {list.length === 0 ? (
        <EmptyState
          className="border border-line rounded-xl bg-paper-2"
          icon={Target}
          title={`No ${active} goals yet`}
          hint={`Name an outcome that matters this ${active} and track it through to done.`}
          action={{ label: 'New goal', icon: Plus, onClick: () => setAdding(true) }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} projects={projList}
              onAddMilestone={(t) => addMs(g.id, t)} onToggleMilestone={(id) => toggleMs(g.id, id)} onSaveNote={(n) => saveNote(g.id, n)}
              onStatus={(s) => setStatus(g.id, s)} onTarget={(d) => setTargetDate(g.id, d)} onProject={(p) => setProjectLink(g.id, p)} />
          ))}
        </div>
      )}
    </div>
  );
}
