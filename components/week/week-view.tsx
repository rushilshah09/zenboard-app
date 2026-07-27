'use client';
// Week — v3 "Calendar" board: an Inbox (Unscheduled) column first, then seven day
// columns divided by hairlines, the current day tinted. Larger task cards carry a
// checkbox, priority + project pills, estimate and subtask count, plus a ••• move
// menu. Drag a card between columns to reschedule (optimistic + persisted; rolls
// back on failure). Each column has an inline composer at the top with quick-set
// chips (priority / estimate / project / due) and natural-language parsing. Reuses
// the shared task actions and the same task data as Today — just arranged weekly.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Plus, Inbox, ChevronLeft, ChevronRight, Check, Flame, ListChecks, Ellipsis, Calendar as CalendarIcon, X, Trash2, Star, Circle, Repeat } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { addTask, toggleTask, updateTask, setHighlight, deleteTask, reorderTasks } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import type { WeekDay } from '@/lib/date';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin,
  useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type WeekTask = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  project_id: string | null; parent_task_id: string | null; sort_order: number;
  recurrence: { freq?: string } | null;
};
export type WeekProject = { id: string; name: string; color: string | null };

const DAY_CAP = 360; // soft daily target — 6h
const COL_DAY = 268;
const COL_INBOX = 320;
const PRIO = {
  high: { bar: 'var(--red)', text: 'var(--red-text)', label: 'High' },
  med: { bar: 'var(--amber)', text: 'var(--amber-text)', label: 'Medium' },
  low: { bar: 'var(--green)', text: 'var(--green-text)', label: 'Low' },
} as const;

const fmtDur = (m: number) =>
  m <= 0 ? '0m' : m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;

// Natural-language quick capture: "!!"=high, "!"=med, "30m"/"2h"=estimate, "@project".
function parseQuick(raw: string, projects: WeekProject[]) {
  let title = raw;
  let priority: WeekTask['priority'] | null = null;
  let estimateMinutes: number | null = null;
  let projectId: string | null = null;
  if (/!!/.test(title)) { priority = 'high'; title = title.replace(/!!/g, ''); }
  else if (/!/.test(title)) { priority = 'med'; title = title.replace(/!/g, ''); }
  const dur = title.match(/(\d+(?:\.\d+)?)\s*(h|hr|m|min)\b/i);
  if (dur) { const n = parseFloat(dur[1]); estimateMinutes = /h/i.test(dur[2]) ? Math.round(n * 60) : Math.round(n); title = title.replace(dur[0], ''); }
  const at = title.match(/@(\w+)/);
  if (at) {
    const q = at[1].toLowerCase();
    const p = projects.find((x) => x.name.toLowerCase().includes(q) || x.id.toLowerCase().startsWith(q));
    if (p) projectId = p.id;
    title = title.replace(at[0], '');
  }
  return { title: title.replace(/\s+/g, ' ').trim(), priority, estimateMinutes, projectId };
}

// ── Editable card chips ────────────────────────────────────────────────────
// Each chip on a card is a button that opens a small popover to change that one
// attribute (priority / project / estimate). The popover is portaled to <body>
// with fixed positioning so it escapes the column's scroll clipping. Optimistic
// updates flow through onUpdate → updateTask.
const EST_OPTS: (number | null)[] = [null, 15, 30, 45, 60, 90, 120, 180, 240];

const chipSolid: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 6px', borderRadius: 'var(--r-sm)', background: 'var(--paper-3)', border: '1px solid var(--line-2)', fontSize: 'var(--text-label-size)', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', maxWidth: 150, overflow: 'hidden' };
const chipGhost: React.CSSProperties = { ...chipSolid, background: 'transparent', border: '1px dashed var(--line)', color: 'var(--text-secondary)' };

// A chip-shaped trigger that opens a branded popover anchored beneath it. The
// popover is portaled to <body> with fixed positioning so it's never clipped by
// the column's scroll, and flips above the chip when there isn't room below.
function ChipPop({ face, faceStyle, title, width = 156, children }: { face: React.ReactNode; faceStyle: React.CSSProperties; title: string; width?: number; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false); };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current!.getBoundingClientRect();
    const estH = 320;
    const below = window.innerHeight - r.bottom;
    const top = below < estH && r.top > below ? Math.max(8, r.top - estH) : r.bottom + 4;
    const left = Math.min(r.left, window.innerWidth - width - 12);
    setPos({ top, left: Math.max(8, left) });
    setOpen(true);
  };
  return (
    <>
      <button ref={btnRef} title={`Change ${title.toLowerCase()}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggle(); }} style={faceStyle}>{face}</button>
      {open && pos && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 200, width, maxHeight: '70vh', overflowY: 'auto', background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, animation: 'zb-pop-in var(--dur-base) var(--ease-out)' }}>
          <div style={{ fontSize: 'var(--text-micro-size)', letterSpacing: '0.08em', color: 'var(--text-secondary)', padding: '4px 8px 4px' }}>{title.toUpperCase()}</div>
          {children(() => setOpen(false))}
        </div>, document.body)}
    </>
  );
}

// ── Branded date picker (replaces the native <input type=date>) ──────────────
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDue = (s: string) => { const d = fromISO(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };

function Calendar({ value, onPick, onClear }: { value: string; onPick: (iso: string) => void; onClear: () => void }) {
  const today = new Date();
  const todayISO = toISO(today);
  const init = value ? fromISO(value) : today;
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const startDow = first.getDay(); // 0 = Sun
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) cells.push(new Date(view.y, view.m, d));
  while (cells.length % 7) cells.push(null);
  const step = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const navBtn2: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--paper-2)', cursor: 'pointer', color: 'var(--text-secondary)' };
  return (
    <div style={{ padding: '4px 6px 6px', width: 228 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{MONTHS[view.m]} {view.y}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => step(-1)} aria-label="Previous month" style={navBtn2}><Icon icon={ChevronLeft} size={14} /></button>
          <button onClick={() => step(1)} aria-label="Next month" style={navBtn2}><Icon icon={ChevronRight} size={14} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {WD.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 'var(--text-micro-size)', fontWeight: 600, color: 'var(--text-secondary)', padding: '2px 0' }}>{w}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toISO(d);
          const isSel = iso === value;
          const isToday = iso === todayISO;
          return (
            <button key={i} onClick={() => onPick(iso)} className="num"
              style={{ height: 28, borderRadius: 'var(--r-sm)', border: isToday && !isSel ? '1px solid var(--line-3)' : '1px solid transparent', background: isSel ? 'var(--ink)' : 'transparent', color: isSel ? 'var(--paper-2)' : isToday ? 'var(--ink)' : 'var(--ink-2)', fontSize: 'var(--text-caption-size)', fontWeight: isSel || isToday ? 600 : 400, cursor: 'pointer' }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--line-2)' }}>
        <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>Clear</button>
        <button onClick={() => onPick(todayISO)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--ink-2)' }}>Today</button>
      </div>
    </div>
  );
}

function DateChip({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const face = <><Icon icon={CalendarIcon} size={12} />{value ? fmtDue(value) : 'Due'}</>;
  return (
    <ChipPop title="Due date" width={240} face={face} faceStyle={value ? { ...chipSolid, color: 'var(--ink-2)' } : chipGhost}>
      {(close) => <Calendar value={value} onPick={(d) => { onPick(d); close(); }} onClear={() => { onPick(''); close(); }} />}
    </ChipPop>
  );
}

function OptRow({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: active ? 'var(--nav-active-bg)' : 'transparent', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 'var(--text-caption-size)', color: active ? 'var(--text-primary)' : 'var(--ink-2)', fontWeight: active ? 500 : 400, textAlign: 'left' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

function PriorityChip({ value, onPick }: { value: WeekTask['priority']; onPick: (p: WeekTask['priority']) => void }) {
  const p = PRIO[value];
  const face = <><span style={{ width: 3, height: 10, borderRadius: 2, background: value === 'low' ? 'var(--text-muted)' : p.bar }} />{p.label}</>;
  return (
    <ChipPop title="Priority" face={face} faceStyle={value === 'low' ? chipGhost : { ...chipSolid, color: p.text }}>
      {(close) => (['high', 'med', 'low'] as const).map((k) => (
        <OptRow key={k} active={k === value} onClick={() => { if (k !== value) onPick(k); close(); }}>
          <span style={{ width: 3, height: 12, borderRadius: 2, background: k === 'low' ? 'var(--text-muted)' : PRIO[k].bar }} />{PRIO[k].label}
        </OptRow>
      ))}
    </ChipPop>
  );
}

function EstimateChip({ value, onPick }: { value: number | null; onPick: (m: number | null) => void }) {
  const face = <span className="num">{value == null ? 'Estimate' : fmtDur(value)}</span>;
  return (
    <ChipPop title="Estimate" face={face} faceStyle={value == null ? chipGhost : { ...chipSolid, color: 'var(--text-secondary)' }}>
      {(close) => EST_OPTS.map((m) => (
        <OptRow key={String(m)} active={m === value} onClick={() => { if (m !== value) onPick(m); close(); }}>
          <span className="num">{m == null ? 'No estimate' : fmtDur(m)}</span>
        </OptRow>
      ))}
    </ChipPop>
  );
}

function ProjectChip({ value, project, projects, onPick }: { value: string | null; project?: WeekProject | null; projects: WeekProject[]; onPick: (id: string | null) => void }) {
  const face = (
    <>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: project?.color || 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project?.name ?? 'Project'}</span>
    </>
  );
  return (
    <ChipPop title="Project" face={face} faceStyle={project ? { ...chipSolid, color: 'var(--ink-2)' } : chipGhost}>
      {(close) => (
        <>
          <OptRow active={value == null} onClick={() => { if (value != null) onPick(null); close(); }}>No project</OptRow>
          {projects.map((p) => (
            <OptRow key={p.id} active={p.id === value} onClick={() => { if (p.id !== value) onPick(p.id); close(); }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color || 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </OptRow>
          ))}
        </>
      )}
    </ChipPop>
  );
}

// ── Task card ────────────────────────────────────────────────────────────────
function Card({ task, project, sub, days, projects, onToggle, onMove, onUpdate, onHighlight, onDelete, overlay }: {
  task: WeekTask; project?: WeekProject | null; sub?: { done: number; total: number };
  days: WeekDay[]; projects?: WeekProject[]; onToggle?: (id: string) => void; onMove?: (id: string, target: string) => void;
  onUpdate?: (id: string, patch: Partial<Pick<WeekTask, 'priority' | 'project_id' | 'estimate_minutes'>>) => void;
  onHighlight?: (id: string) => void; onDelete?: (id: string) => void; overlay?: boolean;
}) {
  const sortable = useSortable({ id: task.id, disabled: overlay });
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [hover, setHover] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!menuBtnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const onScroll = () => setMenu(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('keydown', onKey); };
  }, [menu]);
  const openMenu = () => {
    if (menu) { setMenu(false); return; }
    const r = menuBtnRef.current!.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 180, window.innerWidth - 192)) });
    setMenu(true);
  };

  const ring = task.priority === 'high' ? 'var(--red)' : task.priority === 'med' ? 'var(--amber)' : 'color-mix(in srgb, var(--ink) 28%, transparent)';
  const editable = !overlay && !!onUpdate;
  const hasMeta = editable || !!project || task.priority !== 'low' || task.estimate_minutes != null || (sub && sub.total > 0) || task.highlight;
  const here = task.is_inbox ? 'inbox' : task.scheduled_date;

  const rootStyle: React.CSSProperties = {
    position: 'relative',
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
    zIndex: sortable.isDragging ? 1 : undefined,
  };
  return (
    <div ref={overlay ? undefined : sortable.setNodeRef} style={rootStyle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 12px', background: 'var(--paper-2)', border: `1px solid ${menu ? 'color-mix(in srgb, var(--ink) 22%, transparent)' : 'var(--line)'}`, borderRadius: 'var(--r-lg)', opacity: task.done ? 0.55 : 1, boxShadow: overlay ? 'var(--shadow-lg)' : hover || menu ? 'var(--shadow-md)' : 'var(--shadow-sm)', transition: 'border-color 140ms, box-shadow 140ms' }}>
        <button onClick={() => onToggle?.(task.id)} onPointerDown={(e) => e.stopPropagation()} aria-label={task.done ? 'Mark incomplete' : 'Complete'}
          style={{ width: 17, height: 17, marginTop: 1, flexShrink: 0, borderRadius: '50%', padding: 0, cursor: 'pointer', border: task.done ? 'none' : `1.5px solid ${ring}`, background: task.done ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {task.done && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--paper-2)' }} />}
        </button>

        {/* Drag handle = the body */}
        <div {...(overlay ? {} : sortable.listeners)} {...(overlay ? {} : sortable.attributes)} style={{ flex: 1, minWidth: 0, cursor: overlay ? 'grabbing' : 'grab', touchAction: 'none' }}>
          <div style={{ fontSize: 'var(--text-small-size)', lineHeight: 1.4, fontWeight: 500, color: task.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: task.done ? 'line-through' : 'none', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</div>
          {hasMeta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {editable ? (
                <>
                  <PriorityChip value={task.priority} onPick={(p) => onUpdate!(task.id, { priority: p })} />
                  <ProjectChip value={task.project_id} project={project} projects={projects ?? []} onPick={(id) => onUpdate!(task.id, { project_id: id })} />
                  <EstimateChip value={task.estimate_minutes} onPick={(m) => onUpdate!(task.id, { estimate_minutes: m })} />
                </>
              ) : (
                <>
                  {task.priority !== 'low' && <span style={{ ...chipSolid, cursor: 'default', color: PRIO[task.priority].text }}><span style={{ width: 3, height: 10, borderRadius: 2, background: PRIO[task.priority].bar }} />{PRIO[task.priority].label}</span>}
                  {project && <span style={{ ...chipSolid, cursor: 'default', color: 'var(--ink-2)' }}><span style={{ width: 9, height: 9, borderRadius: 3, background: project.color || 'var(--text-secondary)', flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</span></span>}
                  {task.estimate_minutes != null && <span className="num" style={{ fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)' }}>{fmtDur(task.estimate_minutes)}</span>}
                </>
              )}
              {sub && sub.total > 0 && <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)' }}><Icon icon={ListChecks} size={12} />{sub.done}/{sub.total}</span>}
              {task.recurrence?.freq && <Icon icon={Repeat} size={12} style={{ color: 'var(--text-secondary)' }} />}
              {task.highlight && <Icon icon={Flame} size={12} style={{ color: 'var(--text-secondary)' }} />}
            </div>
          )}
        </div>

        {!overlay && (
          <button ref={menuBtnRef} onClick={(e) => { e.stopPropagation(); openMenu(); }} onPointerDown={(e) => e.stopPropagation()} title="Actions"
            style={{ flexShrink: 0, width: 22, height: 22, marginTop: -1, marginRight: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text-secondary)', opacity: hover || menu ? 1 : 0, transition: 'opacity 120ms' }}>
            <Icon icon={Ellipsis} size={16} />
          </button>
        )}
      </div>

      {menu && menuPos && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 184, zIndex: 200, background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, animation: 'zb-pop-in var(--dur-base) var(--ease-out)' }}>
          <OptRow onClick={() => { setMenu(false); onToggle?.(task.id); }}>
            <Icon icon={task.done ? Circle : Check} size={14} style={{ color: 'var(--text-secondary)' }} />{task.done ? 'Mark incomplete' : 'Mark complete'}
          </OptRow>
          <OptRow onClick={() => { setMenu(false); onHighlight?.(task.id); }}>
            <Icon icon={Star} size={14} style={{ color: task.highlight ? 'var(--ink)' : 'var(--text-secondary)' }} />{task.highlight ? 'Remove highlight' : 'Highlight'}
          </OptRow>
          <div style={{ height: 1, background: 'var(--line-2)', margin: '4px 6px' }} />
          <div style={{ fontSize: 'var(--text-micro-size)', letterSpacing: '0.08em', color: 'var(--text-secondary)', padding: '4px 8px 2px' }}>MOVE TO</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 6px 4px' }}>
            {days.filter((d) => !d.past && d.id !== here).map((d) => (
              <button key={d.id} onClick={() => { setMenu(false); onMove?.(task.id, d.id); }}
                style={{ padding: '3px 8px', fontSize: 'var(--text-label-size)', borderRadius: 'var(--r-sm)', background: 'var(--paper-3)', border: '1px solid var(--line-2)', cursor: 'pointer', color: 'var(--ink-2)' }}>
                {d.today ? 'Today' : d.label}
              </button>
            ))}
            {here !== 'inbox' && (
              <button onClick={() => { setMenu(false); onMove?.(task.id, 'inbox'); }}
                style={{ padding: '3px 8px', fontSize: 'var(--text-label-size)', borderRadius: 'var(--r-sm)', background: 'transparent', border: '1px dashed var(--line)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Inbox
              </button>
            )}
          </div>
          <div style={{ height: 1, background: 'var(--line-2)', margin: '4px 6px' }} />
          <OptRow onClick={() => { setMenu(false); onDelete?.(task.id); }}>
            <Icon icon={Trash2} size={14} style={{ color: 'var(--red-text)' }} /><span style={{ color: 'var(--red-text)' }}>Delete task</span>
          </OptRow>
        </div>, document.body)}
    </div>
  );
}

// ── Inline composer ────────────────────────────────────────────────────────────
type AddSpec = { title: string; priority: WeekTask['priority']; estimateMinutes: number | null; projectId: string | null; dueDate: string | null };

function Composer({ projects, onAdd, prominent }: { projects: WeekProject[]; onAdd: (spec: AddSpec) => void; prominent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [prio, setPrio] = useState<WeekTask['priority']>('low');
  const [est, setEst] = useState<number | null>(null);
  const [proj, setProj] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setDraft(''); setPrio('low'); setEst(null); setProj(null); setDue(''); };
  const close = () => { setOpen(false); reset(); };
  const submit = () => {
    const spec = parseQuick(draft, projects);
    if (!spec.title) { close(); return; }
    onAdd({
      title: spec.title,
      priority: prio !== 'low' ? prio : (spec.priority ?? 'low'),
      estimateMinutes: est ?? spec.estimateMinutes,
      projectId: proj ?? spec.projectId,
      dueDate: due || null,
    });
    reset();
    requestAnimationFrame(() => inputRef.current?.focus()); // keep open for rapid entry
  };

  if (!open) {
    return prominent ? (
      <button onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 13px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', fontWeight: 500, textAlign: 'left' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--ink-2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
        <Icon icon={Plus} size={16} style={{ color: 'var(--text-secondary)' }} /> Add a task
      </button>
    ) : (
      <button onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', background: 'transparent', border: '1px dashed transparent', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-caption-size)', textAlign: 'left' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
        <Icon icon={Plus} size={14} /> Add a task
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)', boxShadow: 'var(--shadow-sm)', overflow: 'visible' }}>
      <input ref={inputRef} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') close(); }}
        placeholder="Add a task" autoComplete="off" data-1p-ignore data-lpignore="true"
        style={{ width: '100%', border: 'none', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', padding: '10px 12px 6px', fontSize: 'var(--text-small-size)', outline: 'none', background: 'transparent', color: 'var(--ink)', boxSizing: 'border-box' }} />
      {/* Same branded popovers as the card chips. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '4px 10px 8px' }}>
        <PriorityChip value={prio} onPick={setPrio} />
        <EstimateChip value={est} onPick={setEst} />
        <ProjectChip value={proj} project={proj ? projects.find((p) => p.id === proj) : null} projects={projects} onPick={setProj} />
        <DateChip value={due} onPick={setDue} />
        <span style={{ flex: 1 }} />
        <button onClick={close} title="Close" style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={X} size={14} /></button>
      </div>
    </div>
  );
}

// ── Column shell (droppable) ─────────────────────────────────────────────────
function Column({ id, width, today, last, isInbox, header, footer, children }: {
  id: string; width: number; today?: boolean; last?: boolean; isInbox?: boolean;
  header: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: last ? 'none' : '1px solid var(--line)', background: isOver ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : today ? 'var(--fill-whisper)' : 'transparent', outline: isOver ? '2px solid var(--accent)' : 'none', outlineOffset: -2, transition: 'background 120ms, outline-color 120ms' }}>
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      {footer}
    </div>
  );
}

// Group pre-sorted tasks into ordered id lists per column. Tasks arrive sorted by
// (sort_order, created_at), so push order = display order.
function groupOrder(tasks: WeekTask[], days: WeekDay[]): Record<string, string[]> {
  const o: Record<string, string[]> = { inbox: [] };
  for (const d of days) o[d.id] = [];
  for (const t of tasks) {
    const c = !t.is_inbox && t.scheduled_date && o[t.scheduled_date] !== undefined ? t.scheduled_date : 'inbox';
    o[c].push(t.id);
  }
  return o;
}

export function WeekView({ days, initialTasks, projects, subByParent, rangeLabel, offset, viewSwitch }: {
  days: WeekDay[]; initialTasks: WeekTask[]; projects: Record<string, WeekProject>;
  subByParent: Record<string, { done: number; total: number }>; rangeLabel: string; offset: number; viewSwitch?: React.ReactNode;
}) {
  const router = useRouter();
  const projectList = Object.values(projects);
  // Two-part state: `byId` holds task data; `order` holds the ordered id list per
  // column ('inbox' + each day id). Drag updates `order` (and `byId` for the moved
  // task's day), then persists day + sort_order via reorderTasks.
  const [byId, setById] = useState<Record<string, WeekTask>>(() => Object.fromEntries(initialTasks.map((t) => [t.id, t])));
  const [order, setOrder] = useState<Record<string, string[]>>(() => groupOrder(initialTasks, days));
  useEffect(() => {
    setById(Object.fromEntries(initialTasks.map((t) => [t.id, t])));
    setOrder(groupOrder(initialTasks, days));
  }, [initialTasks, days]);
  const orderRef = useRef(order); orderRef.current = order;
  const snapshot = useRef<{ order: Record<string, string[]>; byId: Record<string, WeekTask> } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containers = ['inbox', ...days.map((d) => d.id)];
  const findContainer = (id: string) => (order[id] !== undefined ? id : containers.find((c) => (order[c] ?? []).includes(id)));
  const applyOrder = (next: Record<string, string[]>) => { orderRef.current = next; setOrder(next); };

  const scheduledTasks = Object.values(byId).filter((t) => !t.is_inbox);
  const openCount = scheduledTasks.filter((t) => !t.done).length;
  const doneCount = scheduledTasks.filter((t) => t.done).length;
  const committedMin = scheduledTasks.filter((t) => !t.done).reduce((a, t) => a + (t.estimate_minutes ?? 0), 0);
  const inboxOpen = (order['inbox'] ?? []).filter((id) => byId[id] && !byId[id].done).length;

  async function toggle(id: string) {
    const t = byId[id]; if (!t) return;
    const nd = !t.done;
    setById((m) => ({ ...m, [id]: { ...m[id], done: nd } }));
    signalTaskToggle(nd);
    const res = await toggleTask(id, nd);
    if ('error' in res) setById((m) => ({ ...m, [id]: { ...m[id], done: !nd } }));
  }
  async function update(id: string, patch: Partial<Pick<WeekTask, 'priority' | 'project_id' | 'estimate_minutes'>>) {
    const prev = byId[id]; if (!prev) return;
    setById((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
    const res = await updateTask(id, patch);
    if ('error' in res) setById((m) => ({ ...m, [id]: prev }));
  }
  async function highlight(id: string) {
    const t = byId[id]; if (!t) return;
    const nh = !t.highlight;
    setById((m) => ({ ...m, [id]: { ...m[id], highlight: nh } }));
    const res = await setHighlight(id, nh);
    if ('error' in res) setById((m) => ({ ...m, [id]: { ...m[id], highlight: !nh } }));
  }
  async function del(id: string) {
    const snapO = order, snapB = byId;
    const c = findContainer(id);
    if (c) applyOrder({ ...order, [c]: order[c].filter((x) => x !== id) });
    setById((m) => { const n = { ...m }; delete n[id]; return n; });
    const res = await deleteTask(id);
    if ('error' in res) { applyOrder(snapO); setById(snapB); }
  }
  async function add(container: string, spec: AddSpec) {
    const tempId = 'temp-' + Date.now();
    const isInbox = container === 'inbox';
    const ids = order[container] ?? [];
    const sortOrder = ids.reduce((mx, tid) => Math.max(mx, byId[tid]?.sort_order ?? 0), 0) + 1;
    const temp: WeekTask = { id: tempId, title: spec.title, done: false, priority: spec.priority, highlight: false, estimate_minutes: spec.estimateMinutes, scheduled_date: isInbox ? null : container, is_inbox: isInbox, project_id: spec.projectId, parent_task_id: null, sort_order: sortOrder, recurrence: null };
    setById((m) => ({ ...m, [tempId]: temp }));
    applyOrder({ ...order, [container]: [...ids, tempId] });
    const res = await addTask({ title: spec.title, priority: spec.priority, estimateMinutes: spec.estimateMinutes, scheduledDate: isInbox ? null : container, isInbox, projectId: spec.projectId, dueDate: spec.dueDate, sortOrder });
    if ('id' in res) {
      const realId = res.id;
      setById((m) => { const n = { ...m }; const t = n[tempId]; if (t) { delete n[tempId]; n[realId] = { ...t, id: realId }; } return n; });
      applyOrder({ ...orderRef.current, [container]: (orderRef.current[container] ?? []).map((x) => (x === tempId ? realId : x)) });
    } else {
      setById((m) => { const n = { ...m }; delete n[tempId]; return n; });
      applyOrder({ ...orderRef.current, [container]: (orderRef.current[container] ?? []).filter((x) => x !== tempId) });
    }
  }
  // Write a column's day + 0..n sort_order to the DB (optimistic; rolls the whole
  // drag back to the pre-drag snapshot on failure).
  async function persistContainer(container: string, ord: Record<string, string[]>) {
    const isInbox = container === 'inbox';
    const ids = ord[container] ?? [];
    setById((m) => { const n = { ...m }; ids.forEach((tid, i) => { if (n[tid]) n[tid] = { ...n[tid], is_inbox: isInbox, scheduled_date: isInbox ? null : container, sort_order: i }; }); return n; });
    const updates = ids.map((tid, i) => ({ id: tid, scheduledDate: isInbox ? null : container, isInbox, sortOrder: i })).filter((u) => !u.id.startsWith('temp-'));
    if (!updates.length) return;
    const res = await reorderTasks(updates);
    if ('error' in res && snapshot.current) { applyOrder(snapshot.current.order); setById(snapshot.current.byId); }
  }
  // ••• "Move to" — append to the target column.
  function move(id: string, target: string) {
    const from = findContainer(id); if (!from || from === target) return;
    snapshot.current = { order, byId };
    const next = { ...order, [from]: (order[from] ?? []).filter((x) => x !== id), [target]: [...(order[target] ?? []), id] };
    applyOrder(next);
    persistContainer(target, next);
  }
  function onDragStart(e: DragStartEvent) { snapshot.current = { order, byId }; setActiveId(String(e.active.id)); }
  function onDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const from = findContainer(active);
    const to = orderRef.current[over] !== undefined ? over : findContainer(over);
    if (!from || !to || from === to) return;
    const fromArr = [...orderRef.current[from]];
    const toArr = [...orderRef.current[to]];
    const fi = fromArr.indexOf(active); if (fi < 0) return;
    fromArr.splice(fi, 1);
    const oi = toArr.indexOf(over);
    toArr.splice(oi >= 0 ? oi : toArr.length, 0, active);
    applyOrder({ ...orderRef.current, [from]: fromArr, [to]: toArr });
  }
  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!over) { if (snapshot.current) { applyOrder(snapshot.current.order); setById(snapshot.current.byId); } return; }
    const container = orderRef.current[over] !== undefined ? over : findContainer(over);
    if (!container) return;
    const arr = [...(orderRef.current[container] ?? [])];
    const from = arr.indexOf(active);
    let to = arr.indexOf(over);
    if (to < 0) to = arr.length - 1;
    const next = from === to || from < 0 ? orderRef.current : { ...orderRef.current, [container]: arrayMove(arr, from, to) };
    applyOrder(next);
    persistContainer(container, next);
  }
  const activeTask = activeId ? byId[activeId] ?? null : null;

  const Dot = () => <span style={{ color: 'var(--text-muted)' }}>·</span>;
  const Stat = ({ n, label }: { n: number | string; label: string }) => (
    <span><span className="num" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{n}</span> {label}</span>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', animation: 'fadein 220ms', minHeight: 0 }}>
      {/* Slim toolbar — week range + stats + navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px var(--view-px) 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--text-h3-size)', margin: 0, letterSpacing: '-0.015em' }}>{offset === 0 ? 'This week' : 'Week'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span>{rangeLabel}</span><Dot />
          <Stat n={openCount} label="open" />
          <Stat n={doneCount} label="done" />
          <Stat n={inboxOpen} label="unscheduled" /><Dot />
          <Stat n={fmtDur(committedMin)} label="planned" />
        </div>
        <span style={{ flex: 1 }} />
        {viewSwitch}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => router.push(`/tasks?view=week&w=${offset - 1}`)} aria-label="Previous week" style={navBtn}><Icon icon={ChevronLeft} size={16} /></button>
          {offset !== 0 && <button onClick={() => router.push('/tasks?view=week')} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 'var(--text-caption-size)', fontWeight: 500 }}>This week</button>}
          <button onClick={() => router.push(`/tasks?view=week&w=${offset + 1}`)} aria-label="Next week" style={navBtn}><Icon icon={ChevronRight} size={16} /></button>
        </div>
      </div>

      <DndContext id="week-board" sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ display: 'flex', height: '100%', minWidth: COL_INBOX + COL_DAY * days.length }}>
            {/* Inbox / Unscheduled — first */}
            <Column id="inbox" width={COL_INBOX} isInbox header={
              <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', background: 'var(--ink-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon icon={Inbox} size={14} style={{ color: 'var(--paper-2)' }} />
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Inbox</span>
                  <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{inboxOpen}</span>
                </div>
                <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 4 }}>Unscheduled · drag onto a day</div>
              </div>
            }>
              <Composer projects={projectList} prominent onAdd={(spec) => add('inbox', spec)} />
              <SortableContext items={order['inbox'] ?? []} strategy={verticalListSortingStrategy}>
                {(order['inbox'] ?? []).map((id) => byId[id] && <Card key={id} task={byId[id]} project={byId[id].project_id ? projects[byId[id].project_id!] : null} sub={subByParent[id]} days={days} projects={projectList} onToggle={toggle} onMove={move} onUpdate={update} onHighlight={highlight} onDelete={del} />)}
              </SortableContext>
              {(order['inbox'] ?? []).length === 0 && <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Inbox zero. Enjoy it.</div>}
            </Column>

            {/* Day columns */}
            {days.map((d, i) => {
              const ids = order[d.id] ?? [];
              const committed = ids.reduce((a, id) => a + (byId[id] && !byId[id].done ? (byId[id].estimate_minutes ?? 0) : 0), 0);
              const over = committed > DAY_CAP;
              return (
                <Column key={d.id} id={d.id} width={COL_DAY} today={d.today} last={i === days.length - 1}
                  header={
                    <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${d.today ? 'var(--line-3)' : 'var(--line-2)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{WEEKDAY_FULL[d.label] ?? d.label}</span>
                        {d.today && <span style={{ fontSize: 'var(--text-micro-size)', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontWeight: 600 }}>TODAY</span>}
                      </div>
                      <div style={{ fontSize: 'var(--text-caption-size)', color: d.past ? 'var(--text-muted)' : 'var(--text-secondary)', marginTop: 3 }}>{d.date}</div>
                    </div>
                  }
                  footer={
                    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, height: 4, borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (committed / DAY_CAP) * 100)}%`, background: over ? 'var(--red)' : 'var(--green)' }} />
                      </span>
                      <span className="num" style={{ fontSize: 'var(--text-micro-size)', color: over ? 'var(--red-text)' : 'var(--text-secondary)', minWidth: 30, textAlign: 'right' }}>{fmtDur(committed)}</span>
                    </div>
                  }
                >
                  {!d.past && <Composer projects={projectList} onAdd={(spec) => add(d.id, spec)} />}
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((id) => byId[id] && <Card key={id} task={byId[id]} project={byId[id].project_id ? projects[byId[id].project_id!] : null} sub={subByParent[id]} days={days} projects={projectList} onToggle={toggle} onMove={move} onUpdate={update} onHighlight={highlight} onDelete={del} />)}
                  </SortableContext>
                  {ids.length === 0 && <div style={{ padding: '10px 8px', textAlign: 'center', fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>{d.weekend ? 'Rest.' : 'Open.'}</div>}
                </Column>
              );
            })}
          </div>
        </div>
        <DragOverlay>{activeTask ? <div style={{ width: COL_DAY - 28 }}><Card task={activeTask} project={activeTask.project_id ? projects[activeTask.project_id] : null} sub={subByParent[activeTask.id]} days={days} overlay /></div> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

const WEEKDAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const navBtn: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--paper-2)', cursor: 'pointer', color: 'var(--text-secondary)' };
