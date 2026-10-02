'use client';
// Horizon — goals grouped by horizon (Month / Quarter / Year, switchable).
// Progress rolls up from linked tasks (done/total), then milestones, then a
// manual value. Set a target date, link a project, complete/drop/reopen.
// Optimistic; persisted via goals.ts. 'month' needs migration 0008.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Target, CalendarDays, Plus, Check, Repeat, Ellipsis, Kanban, Folder, X } from "@/components/ds/icons";
import { PageLayout } from '@/components/ui/page-layout';
import {
  Icon, Button, IconButton, SegmentedControl, Modal, Field, TextInput, Textarea, EmptyState, DatePicker, Badge, Checkbox,
  CircularProgress, MenuSelect, addLine, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  toastReverted, cardClass } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { scopeFill } from '@/lib/entity-color';

import { addGoal, updateGoal, addMilestone, toggleMilestone } from '@/lib/actions/goals';
import { formatDay } from '@/lib/date';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';

type Milestone = { id: string; title: string; done: boolean };
type Horizon = 'month' | 'quarter' | 'year';
export type GoalProject = { id: string; name: string; color: string | null };
export type Goal = {
  id: string; title: string; note: string | null; horizon: Horizon;
  target_date: string | null; status: string; progress: number; project_id: string | null;
  milestones: Milestone[]; linkedDone: number; linkedTotal: number;
  /** One line written when the goal was finished (0026). */
  retro?: string | null;
};

const SECTIONS: { id: Horizon; label: string; icon: typeof Flag }[] = [
  { id: 'month', label: 'Month', icon: CalendarDays },
  { id: 'quarter', label: 'Quarter', icon: Flag },
  { id: 'year', label: 'Year', icon: Target },
];
const fmtDate = (iso: string) => formatDay(iso) ?? '';

function goalFrac(g: Goal) {
  if (g.linkedTotal > 0) return g.linkedDone / g.linkedTotal;
  if (g.milestones.length > 0) return g.milestones.filter((m) => m.done).length / g.milestones.length;
  return Math.max(0, Math.min(1, g.progress > 1 ? g.progress / 100 : g.progress));
}

/**
 * One goal — the house card (`bg-surface-raised`, a hairline, `rounded-lg`), not a grey-filled panel on the grey page.
 *
 * Rebuilt on the design system 2026-09-22 (plans/PRODUCT_POLISH_2026-09-22.md sprint 5). It drew ONE percentage
 * twice — a 52px ring with the number in it and a 5px bar under the title; a dropped goal faded its whole card with
 * `opacity: 0.6` (text included); its ••• was a hand-rolled menu that closed when the pointer left it; the project
 * was a native `<select>`; steps ticked into an accent box where every other box in the app is ink; and the note and
 * the retro line were set in an italic serif, a second typeface on a page of one.
 */
function GoalCard({ goal, projects, onAddMilestone, onToggleMilestone, onSaveNote, onStatus, onTarget, onProject, onFinish, goalsV2 = false }: {
  goal: Goal; projects: GoalProject[];
  onAddMilestone: (t: string) => void; onToggleMilestone: (id: string) => void; onSaveNote: (note: string) => void;
  onStatus: (s: 'active' | 'done' | 'dropped') => void; onTarget: (d: string | null) => void; onProject: (id: string | null) => void;
  /** Finish with a one-line retro (§7G "completed goal → archive with retro line"). */
  onFinish: (retro: string) => void;
  /** Migration 0026 applied — without it there is nowhere to store a retro. */
  goalsV2?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [retro, setRetro] = useState<string | null>(null);
  const done = goal.status === 'done';
  const dropped = goal.status === 'dropped';
  const frac = done ? 1 : goalFrac(goal);
  const project = goal.project_id ? projects.find((p) => p.id === goal.project_id) : null;
  const progressLabel = goal.linkedTotal > 0 ? `${goal.linkedDone}/${goal.linkedTotal} tasks` : goal.milestones.length > 0 ? `${goal.milestones.filter((m) => m.done).length}/${goal.milestones.length} steps` : `${Math.round(frac * 100)}%`;
  const finish = (line: string) => { onFinish(line.trim()); setRetro(null); };

  return (
    <article className={cardClass()}>
      <div className="flex items-start gap-3 px-[var(--panel-px)] py-3.5">
        {/* The one progress mark: a ring the size of a glyph, beside the name — the count beneath says the figure. */}
        <CircularProgress value={frac * 100} size={16} className="mt-[3px] shrink-0" />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="focus-ring min-w-0 flex-1 rounded-xs text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn('text-h4', dropped ? 'text-ink-500 line-through' : 'text-ink-900')}>{goal.title}</span>
            {done && <Badge status="success">Done</Badge>}
            {dropped && <Badge>Dropped</Badge>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
            <span className="tabular-nums">{progressLabel}</span>
            {goal.target_date && <span className="inline-flex items-center gap-1 tabular-nums"><Icon icon={CalendarDays} size={12} />{fmtDate(goal.target_date)}</span>}
            {project && (
              <span className="inline-flex items-center gap-1">
                <Icon icon={Folder} size={12} weight="fill" style={{ color: scopeFill(project.color, 'var(--color-ink-500)') }} />{project.name}
              </span>
            )}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" label="Goal actions" className="-me-1.5 -mt-0.5" icon={<Icon icon={Ellipsis} size={16} />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!done && <DropdownMenuItem icon={<Icon icon={Check} size={16} />} onSelect={() => { if (goalsV2) setRetro(''); else onStatus('done'); }}>Mark done</DropdownMenuItem>}
            {goal.status !== 'active' && <DropdownMenuItem icon={<Icon icon={Flag} size={16} />} onSelect={() => onStatus('active')}>Reopen</DropdownMenuItem>}
            {!dropped && <DropdownMenuItem icon={<Icon icon={X} size={16} />} onSelect={() => onStatus('dropped')}>Drop</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* The retro is the point of writing one — a finished goal reads back its line instead of just going quiet. */}
      {done && goal.retro && (
        <p className="border-t border-line-soft px-[var(--panel-px)] py-2.5 text-ui text-ink-600">&ldquo;{goal.retro}&rdquo;</p>
      )}

      {/* Finishing a goal asks for one sentence before it is archived (§7G). Skipping is one click — a retro you
          resent isn't worth having. */}
      {retro !== null && (
        <div className="flex flex-col gap-2 border-t border-line-soft px-[var(--panel-px)] pt-3 pb-3.5">
          <Field label="How did it go?">
            <TextInput autoFocus value={retro} onChange={(e) => setRetro(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') finish(retro); if (e.key === 'Escape') setRetro(null); }}
              placeholder="One line you'd want to read next year" autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <div className="flex gap-1.5">
            {/* Secondary, not primary: "New goal" is this view's one filled action. */}
            <Button size="sm" variant="secondary" onClick={() => finish(retro)}>Mark done</Button>
            <Button size="sm" variant="ghost" onClick={() => finish('')}>Skip</Button>
          </div>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-3 border-t border-line-soft px-[var(--panel-px)] pt-3 pb-3.5">
          <div className="flex flex-wrap gap-3">
            <Field label="Target date">
              <DatePicker aria-label="Target date" className="w-[168px]"
                value={goal.target_date ?? null} onValueChange={(iso) => onTarget(iso || null)} />
            </Field>
            <Field label="Project">
              <MenuSelect aria-label="Project" className="w-[200px]" value={goal.project_id ?? ''}
                onValueChange={(v) => onProject(v || null)}
                options={[{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
          </div>
          {goal.linkedTotal > 0 && (
            <p className="flex items-center gap-1.5 text-caption text-ink-500">
              <Icon icon={Kanban} size={12} />Progress tracks {goal.linkedTotal} linked task{goal.linkedTotal === 1 ? '' : 's'}.
            </p>
          )}
          {/* Steps: the house checkbox, and the house add line for the next one. */}
          <div>
            {goal.milestones.map((m) => (
              <label key={m.id} className="flex h-8 cursor-pointer items-center gap-3">
                <Checkbox checked={m.done} onCheckedChange={() => onToggleMilestone(m.id)} aria-label={m.done ? `Mark ${m.title} not done` : `Mark ${m.title} done`} />
                <span className={cn('min-w-0 flex-1 truncate text-ui', m.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{m.title}</span>
              </label>
            ))}
            <label className={cn(addLine({ as: 'field' }), 'h-8 gap-3 px-0')}>
              <Icon icon={Plus} size={14} className="mx-px shrink-0" />
              <input value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onAddMilestone(draft.trim()); setDraft(''); } }}
                placeholder="Add a step" aria-label="Add a step" autoComplete="off" data-1p-ignore data-lpignore="true"
                className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
            </label>
          </div>
          <Textarea defaultValue={goal.note ?? ''} placeholder="Add a note" aria-label="Note" rows={2}
            onBlur={(e) => { if (e.target.value !== (goal.note ?? '')) onSaveNote(e.target.value); }} />
        </div>
      )}
    </article>
  );
}

export function HorizonView({ initialGoals, projects, goalsV2 = false }: {
  initialGoals: Goal[]; projects: Record<string, GoalProject>;
  /** Migration 0026 applied — unlocks the retro line when finishing a goal. */
  goalsV2?: boolean;
}) {
  const [goals, setGoals] = useServerState(initialGoals);
  const [active, setActive] = useState<Horizon>('quarter');
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const projList = Object.values(projects);

  async function createGoal() {
    const t = title.trim(); if (!t) return;
    setTitle(''); setTarget(''); setAdding(false); setErr(null);
    const tmp = tempId();
    setGoals((g) => [...g, { id: tmp, title: t, note: null, horizon: active, target_date: target || null, status: 'active', progress: 0, project_id: null, milestones: [], linkedDone: 0, linkedTotal: 0 }]);
    const res = await addGoal({ title: t, horizon: active, targetDate: target || null });
    if ('id' in res) setGoals((g) => g.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else { setGoals((g) => g.filter((x) => x.id !== tmp)); setErr(res.error); }
  }
  const patch = (id: string, p: Partial<Goal>) => setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...p } : x)));
  // Every edit is optimistic AND answers for itself: a save the server refuses puts the old value back and says so,
  // as a task's does. These were fire-and-forget — `updateGoal(…)` unawaited — so a refused "Drop" or a refused
  // target date stayed on screen as if it had saved, until the next refresh quietly undid it.
  async function save(id: string, next: Partial<Goal>) {
    const before = goals.find((x) => x.id === id);
    if (!before) return;
    const prev = Object.fromEntries(Object.keys(next).map((k) => [k, before[k as keyof Goal]])) as Partial<Goal>;
    patch(id, next);
    const res = await updateGoal(id, next as Parameters<typeof updateGoal>[1]);
    if ('error' in res) { patch(id, prev); toastReverted(res.error); }
  }
  const setStatus = (id: string, status: 'active' | 'done' | 'dropped') => save(id, { status });
  // Archive with the retro in one write; an empty line just means they skipped it. The retro is patched locally too
  // — otherwise the card marks itself done and the line you just wrote doesn't appear until a refresh.
  const finishGoal = (id: string, retro: string) => save(id, retro ? { status: 'done', retro } : { status: 'done' });
  const setTargetDate = (id: string, d: string | null) => save(id, { target_date: d });
  const setProjectLink = (id: string, projectId: string | null) => save(id, { project_id: projectId });
  const saveNote = (id: string, note: string) => save(id, { note });
  async function addMs(goalId: string, t: string) {
    const tmp = tempId();
    setGoals((g) => g.map((x) => (x.id === goalId ? { ...x, milestones: [...x.milestones, { id: tmp, title: t, done: false }] } : x)));
    const res = await addMilestone(goalId, t);
    if ('id' in res) setGoals((g) => g.map((x) => x.id === goalId ? { ...x, milestones: x.milestones.map((m) => m.id === tmp ? { ...m, id: res.id } : m) } : x));
    else { setGoals((g) => g.map((x) => x.id === goalId ? { ...x, milestones: x.milestones.filter((m) => m.id !== tmp) } : x)); toastReverted(res.error); }
  }
  async function toggleMs(goalId: string, msId: string) {
    const was = goals.find((x) => x.id === goalId)?.milestones.find((m) => m.id === msId)?.done;
    if (was === undefined) return;
    const flip = (done: boolean) => setGoals((g) => g.map((x) => x.id === goalId ? { ...x, milestones: x.milestones.map((m) => (m.id === msId ? { ...m, done } : m)) } : x));
    flip(!was);
    const res = await toggleMilestone(msId, !was);
    if ('error' in res) { flip(was); toastReverted(res.error); }
  }

  const list = goals.filter((g) => g.horizon === active).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));

  // Goals is a CONTENT page — one column of goal cards you read down — so it
  // comes through <PageLayout> like Home and Finance. It used to hand-roll the
  // container in inline styles: `maxWidth: 1000` (a FIFTH page width, next to
  // 978/1200/720/none), its own `fadein 220ms`, and the padding tokens spelled
  // out by hand. Inline styles are also why the ViewContainer guard never saw
  // it — it reads Tailwind classes.
  return (
    <PageLayout
        tabs={
          <SegmentedControl
            aria-label="Goal horizon"
            value={active}
            onValueChange={(v) => setActive(v as Horizon)}
            options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
            fit="content"
          />
        }
        actions={<>
          <Button variant="ghost" size="sm" icon={<Icon icon={Repeat} size={16} />} onClick={() => router.push('/rituals?type=weekly_review')}>Weekly review</Button>
          <Button variant="primary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding((a) => !a)}>New goal</Button>
        </>}
    >
      <Modal
        open={adding}
        onOpenChange={setAdding}
        size="sm"
        title="New goal"
        description={`An outcome that matters this ${active}, track it through to done.`}
        dirty={!!title.trim()}
        footer={<>
          <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={createGoal}>Create goal</Button>
        </>}
      >
        <div className="flex flex-col gap-4">
          <Field label="Outcome">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createGoal(); }}
              placeholder={`What outcome matters this ${active}?`}
              autoComplete="off" data-1p-ignore data-lpignore="true" />
          </Field>
          <Field label="Target date" optional>
            <DatePicker aria-label="Target date" value={target || null} onValueChange={setTarget} />
          </Field>
        </div>
      </Modal>
      {err && <p role="alert" className="mb-3.5 text-caption text-danger-600">{err}</p>}

      {list.length === 0 ? (
        <EmptyState
          illustration={<Icon icon={Target} size={20} />}
          title={`No ${active} goals yet`}
          description={`Name one outcome that matters this ${active}.`}
          primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>New goal</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} projects={projList}
              onAddMilestone={(t) => addMs(g.id, t)} onToggleMilestone={(id) => toggleMs(g.id, id)} onSaveNote={(n) => saveNote(g.id, n)}
              onStatus={(s) => setStatus(g.id, s)} onFinish={(r) => finishGoal(g.id, r)} goalsV2={goalsV2} onTarget={(d) => setTargetDate(g.id, d)} onProject={(p) => setProjectLink(g.id, p)} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
