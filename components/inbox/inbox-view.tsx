'use client';
// Inbox — the triage surface for captured thoughts (tasks with is_inbox = true,
// not yet scheduled or filed). Capture fast with the global "C" shortcut; here
// you process to zero: complete it, send it to Today or a date, file it under a
// project, or bin it. Every action is optimistic (the row leaves the inbox),
// persisted via the shared task actions, and REVERSIBLE — a toast with Undo
// (MASTER_PRODUCT_PLAN §6.3). Built on DS primitives; the reward state is the
// only budgeted moment of delight (§1.4).
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox as InboxIcon, Plus, Sun, Trash2, Check, Kanban, Calendar, ListChecks, ArrowUpDown,
} from "@/components/ds/icons";
import {
  Icon, Button, IconButton, Checkbox, PriorityBars, Kbd, Toaster, toast, EmptyState,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ds/ui";
import { PageHeader } from '@/components/ui/page-header';
import { ViewContainer } from '@/components/ui/view-container';
import { cn } from '@/lib/cn';
import { Triage } from '@/components/inbox/triage';
import { addTask, toggleTask, rescheduleTask, moveTaskToProject, deleteTask, returnToInbox } from '@/lib/actions/tasks';
import { setTaskLabel } from '@/lib/actions/labels';
import { createClient } from '@/lib/supabase/client';
import { signalTaskToggle } from '@/lib/sound';

export type InboxTask = { id: string; title: string; priority: 'low' | 'med' | 'high'; done: boolean; is_inbox: boolean; created_at: string; project_id: string | null };
export type InboxProject = { id: string; name: string; color: string | null };
export type InboxLabel = { id: string; name: string };
export type UndoKind = 'complete' | 'schedule' | 'project' | 'delete';

const composerShell = 'flex items-center gap-2 rounded-lg border border-line-strong bg-surface-raised py-1 pl-3.5 pr-1.5';
const composerInput = 'min-w-0 flex-1 border-0 bg-transparent py-2 text-ui text-ink-900 outline-none placeholder:text-ink-400';

const isoOf = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const nextMonday = () => { const d = new Date(); return addDays(((8 - d.getDay()) % 7) || 7); };
const byNewest = (a: InboxTask, b: InboxTask) => b.created_at.localeCompare(a.created_at);

export function InboxView({ initialTasks, projects, initialLabels }: { initialTasks: InboxTask[]; projects: InboxProject[]; initialLabels?: InboxLabel[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState('');
  const [triaging, setTriaging] = useState(false);
  const [oldestFirst, setOldestFirst] = useState(false);
  const [labels, setLabels] = useState<InboxLabel[]>(initialLabels ?? []);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  // Render order (§7A): newest-first by default; a backlog can flip to
  // oldest-first ("process what's been waiting"). Triage always drains oldest
  // first regardless — the toggle is only the list's reading order.
  const ordered = useMemo(() => {
    const arr = [...tasks].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return oldestFirst ? arr : arr.reverse();
  }, [tasks, oldestFirst]);

  // ⇧T anywhere on the Inbox starts triage (§7A flow), mirroring the button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.shiftKey && (e.key === 'T' || e.key === 't') && tasks.length > 0 && !triaging) {
        e.preventDefault();
        setTriaging(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tasks.length, triaging]);

  // Labels for the triage "L" panel (migration 0014) — probed quietly; a
  // missing table just leaves the Label action hidden.
  useEffect(() => {
    if (initialLabels) return;
    let gone = false;
    createClient().from('labels').select('id, name').order('sort_order').order('name')
      .then(({ data, error }) => { if (!gone && !error && data) setLabels(data); });
    return () => { gone = true; };
  }, [initialLabels]);

  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'project';
  const remove = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));
  const restore = (task: InboxTask) => setTasks((ts) => [task, ...ts.filter((t) => t.id !== task.id)].sort(byNewest));
  const err = (m: string) => toast({ message: m, variant: 'error' });

  async function add() {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    const tmp = 'tmp-' + Date.now();
    setTasks((ts) => [{ id: tmp, title, priority: 'low', done: false, is_inbox: true, created_at: new Date().toISOString(), project_id: null }, ...ts]);
    const res = await addTask({ title, isInbox: true });
    if ('error' in res) { remove(tmp); err(res.error); }
    else setTasks((ts) => ts.map((t) => (t.id === tmp ? { ...t, id: res.id } : t)));
  }

  // The reversal for any triage decision. Returns the restored task (its id may
  // change when undoing a delete, since a hard delete is undone by re-creating).
  async function undo(task: InboxTask, kind: UndoKind): Promise<InboxTask> {
    restore(task);
    if (kind === 'delete') {
      const res = await addTask({ title: task.title, priority: task.priority, isInbox: true });
      if ('id' in res) { setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, id: res.id } : t))); return { ...task, id: res.id }; }
      remove(task.id); err(res.error);
      return task;
    }
    await returnToInbox(task.id);
    return task;
  }

  // Core mutations (silent — used by triage, which has its own undo). Each does
  // the optimistic remove + server write, rolling the row back on failure.
  async function complete(task: InboxTask) { signalTaskToggle(true); remove(task.id); const r = await toggleTask(task.id, true); if ('error' in r) { restore(task); err(r.error); } }
  async function schedule(task: InboxTask, date: string) { if (!date) return; remove(task.id); const r = await rescheduleTask(task.id, date); if ('error' in r) { restore(task); err(r.error); } }
  async function toProject(task: InboxTask, pid: string) { if (!pid) return; remove(task.id); const r = await moveTaskToProject(task.id, pid); if ('error' in r) { restore(task); err(r.error); } }
  async function del(task: InboxTask) { remove(task.id); const r = await deleteTask(task.id); if ('error' in r) { restore(task); err(r.error); } }

  // List wrappers — same mutation, then a toast that offers Undo (§6.3).
  const withUndo = (task: InboxTask, kind: UndoKind, message: string) =>
    toast({ message, action: { label: 'Undo', onAction: () => { void undo(task, kind); } } });
  const listComplete = (task: InboxTask) => { void complete(task); withUndo(task, 'complete', 'Completed'); };
  const listToday = (task: InboxTask) => { void schedule(task, isoOf(new Date())); withUndo(task, 'schedule', 'Scheduled for today'); };
  const listSchedule = (task: InboxTask, date: string, label: string) => { if (!date) return; void schedule(task, date); withUndo(task, 'schedule', `Scheduled for ${label}`); };
  const listProject = (task: InboxTask, pid: string) => { void toProject(task, pid); withUndo(task, 'project', `Moved to ${projName(pid)}`); };
  const listDelete = (task: InboxTask) => { void del(task); withUndo(task, 'delete', 'Deleted'); };

  return (
    <ViewContainer className="pt-[var(--view-pt)] pb-[var(--view-pb)]" style={{ animation: 'fadein 220ms' }}>
      <PageHeader hideTitle icon={InboxIcon} title="Inbox" count={tasks.length}
        subtitle={<>Capture now, decide later. Press <Kbd keys={['C']} /> anywhere to add a thought.</>}
        actions={tasks.length > 0 && (
          <div className="flex items-center gap-1.5">
            {tasks.length >= 8 && (
              <Button size="sm" variant="ghost" icon={<Icon icon={ArrowUpDown} size={14} />} onClick={() => setOldestFirst((v) => !v)}>
                {oldestFirst ? 'Oldest first' : 'Newest first'}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Icon icon={ListChecks} size={16} />} onClick={() => setTriaging(true)}>
              Triage {tasks.length}
            </Button>
          </div>
        )} />

      {/* Inline capture */}
      <div className={cn(composerShell, 'mb-3.5')}>
        <Icon icon={Plus} size={16} className="shrink-0 text-ink-500" />
        <input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Add to inbox…" autoComplete="off" data-1p-ignore data-lpignore="true" className={composerInput} />
        {draft.trim() && <Button size="sm" variant="primary" onClick={add}>Add</Button>}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          illustration={<Icon icon={Check} size={20} />}
          title="Inbox zero"
          description="Nothing to triage. Press C anywhere to capture a thought."
        />
      ) : (
        <div className="rounded-lg border border-line-soft bg-surface-raised">
          {ordered.map((t, i) => (
            <Row key={t.id} t={t} projects={projects} last={i === ordered.length - 1}
              onComplete={() => listComplete(t)} onToday={() => listToday(t)}
              onSchedule={(d, label) => listSchedule(t, d, label)} onProject={(p) => listProject(t, p)} onDelete={() => listDelete(t)} />
          ))}
        </div>
      )}

      {triaging && (
        <Triage
          items={tasks} projects={projects} labels={labels}
          onComplete={complete} onSchedule={schedule} onProject={toProject} onDelete={del}
          onLabel={(id, labelId) => { setTaskLabel(id, labelId, true); }}
          onUnlabel={(id, labelId) => { setTaskLabel(id, labelId, false); }}
          onUndo={undo}
          onClose={() => setTriaging(false)}
        />
      )}
      <Toaster />
    </ViewContainer>
  );
}

function Row({ t, projects, last, onComplete, onToday, onSchedule, onProject, onDelete }: {
  t: InboxTask; projects: InboxProject[]; last: boolean;
  onComplete: () => void; onToday: () => void; onSchedule: (date: string, label: string) => void; onProject: (p: string) => void; onDelete: () => void;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn('group flex items-center gap-2.5 px-3.5 py-2.5', !last && 'border-b border-line-soft')}>
      <Checkbox size="sm" checked={false} onCheckedChange={onComplete} aria-label={`Complete ${t.title}`} className="shrink-0" />
      {t.priority !== 'low' && <PriorityBars level={t.priority} size={11} className="shrink-0" />}
      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{t.title}</span>

      {/* Actions reveal on hover (calm at rest, keyboard-triage for volume). */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100">
        <Button size="xs" variant="ghost" icon={<Icon icon={Sun} size={13} />} onClick={onToday}>Today</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="xs" variant="ghost" label="Schedule" icon={<Icon icon={Calendar} size={14} />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onSchedule(isoOf(addDays(1)), 'tomorrow')}>Tomorrow</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSchedule(isoOf(nextMonday()), 'next week')}>Next week</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { requestAnimationFrame(() => { dateRef.current?.showPicker?.(); dateRef.current?.focus(); }); }}>Pick a date…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {projects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton size="xs" variant="ghost" label="Move to project" icon={<Icon icon={Kanban} size={14} />} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {projects.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => onProject(p.id)}
                  icon={<span className="size-2.5 rounded-xs" style={{ background: p.color ?? 'var(--color-ink-400)' }} />}>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <IconButton size="xs" variant="ghost" label="Delete" icon={<Icon icon={Trash2} size={14} />} onClick={onDelete} />
      </div>
      <input ref={dateRef} type="date" tabIndex={-1} aria-hidden className="pointer-events-none absolute size-0 opacity-0"
        onChange={(e) => { if (e.target.value) onSchedule(e.target.value, 'that day'); }} />
    </div>
  );
}
