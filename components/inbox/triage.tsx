'use client';
// Triage — the Inbox processed one thought at a time (Linear's triage, sized
// for one person). A full-screen calm layer: the current item is the only thing
// on screen, every decision is a single key, and the queue drains to a quiet
// reward state. Keys: E done · T today · S schedule · P project · L label ·
// D delete · Enter keep · Z undo last · Esc back/exit. Every decision is
// reversible (Z steps back and reverts it) — triage is fully undoable (§6.3).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Sun, Calendar, Kanban, Trash2, CornerDownLeft, X, Tag, RotateCcw } from "@/components/ds/icons";
import { Icon, Button, IconButton, Kbd, PriorityBars } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import type { InboxTask, InboxProject, InboxLabel, UndoKind } from '@/components/inbox/inbox-view';

const isoOf = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const nextMonday = () => { const d = new Date(); return addDays(((8 - d.getDay()) % 7) || 7); };

function age(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return 'captured just now';
  if (mins < 60 * 24) return `captured ${Math.round(mins / 60)}h ago`;
  return `captured ${Math.round(mins / (60 * 24))}d ago`;
}

const PRIO_LABEL: Record<string, string> = { high: 'High', med: 'Medium', low: 'Low' };
type Panel = null | 'schedule' | 'project' | 'label';
type HistoryEntry = { task: InboxTask; kind: UndoKind | 'label'; pos: number; labelId?: string };

export function Triage({ items, projects, labels = [], onComplete, onSchedule, onProject, onLabel, onUnlabel, onDelete, onUndo, onClose }: {
  items: InboxTask[]; projects: InboxProject[]; labels?: InboxLabel[];
  onComplete: (task: InboxTask) => void; onSchedule: (task: InboxTask, dateISO: string) => void;
  onProject: (task: InboxTask, projectId: string) => void;
  onLabel?: (id: string, labelId: string) => void; onUnlabel?: (id: string, labelId: string) => void;
  onDelete: (task: InboxTask) => void;
  onUndo: (task: InboxTask, kind: UndoKind) => Promise<InboxTask>;
  onClose: () => void;
}) {
  // Snapshot the queue oldest-first; acting removes the item globally, keeping
  // just advances. `idx` only moves forward, except Z (undo) which steps back.
  const queue = useRef<string[]>([...items].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((t) => t.id));
  const history = useRef<HistoryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [, bump] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [sel, setSel] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(items.map((t) => [t.id, t])), [items]);
  // Skip ids whose rows were already acted on (they left `items`).
  let cur: InboxTask | undefined;
  let curPos = idx;
  while (curPos < queue.current.length && !(cur = byId.get(queue.current[curPos]))) curPos++;
  const total = queue.current.length;
  const done = cur === undefined;
  const canUndo = history.current.length > 0;

  const advance = useCallback(() => { setPanel(null); setSel(0); setIdx(curPos + 1); }, [curPos]);
  // A data-changing decision: record it for undo, run it, then hold idx (the
  // acted row leaves `items`, so the same idx now points at the next survivor).
  const act = useCallback((kind: UndoKind, fn: () => void) => {
    if (cur) history.current.push({ task: cur, kind, pos: curPos });
    fn(); setPanel(null); setSel(0); setIdx(curPos);
  }, [cur, curPos]);
  const labelAct = useCallback((l: InboxLabel) => {
    if (cur) history.current.push({ task: cur, kind: 'label', pos: curPos, labelId: l.id });
    onLabel?.(cur!.id, l.id); advance();
  }, [cur, curPos, onLabel, advance]);

  const undoLast = useCallback(async () => {
    const entry = history.current.pop();
    if (!entry) return;
    setPanel(null); setSel(0);
    if (entry.kind === 'label') { onUnlabel?.(entry.task.id, entry.labelId!); setIdx(entry.pos); return; }
    const restored = await onUndo(entry.task, entry.kind); // re-creating a deleted item yields a new id
    queue.current[entry.pos] = restored.id;
    setIdx(entry.pos); bump((v) => v + 1);
  }, [onUndo, onUnlabel]);

  useEffect(() => { rootRef.current?.focus(); }, [panel, done]);

  const onKey = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return; // let the hidden date input keep its keys
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); if (panel) setPanel(null); else onClose(); return; }
    if (k === 'z' && canUndo) { e.preventDefault(); void undoLast(); return; }
    if (done) { if (e.key === 'Enter') { e.preventDefault(); onClose(); } return; }
    if (!cur) return;
    if (panel === 'project') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(projects.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); const p = projects[sel]; if (p) act('project', () => onProject(cur!, p.id)); }
      else if (/^[1-9]$/.test(k)) { e.preventDefault(); const p = projects[Number(k) - 1]; if (p) act('project', () => onProject(cur!, p.id)); }
      return;
    }
    if (panel === 'label') {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(labels.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); const l = labels[sel]; if (l) labelAct(l); }
      else if (/^[1-9]$/.test(k)) { e.preventDefault(); const l = labels[Number(k) - 1]; if (l) labelAct(l); }
      return;
    }
    if (panel === 'schedule') {
      if (k === '1') { e.preventDefault(); act('schedule', () => onSchedule(cur!, isoOf(new Date()))); }
      else if (k === '2') { e.preventDefault(); act('schedule', () => onSchedule(cur!, isoOf(addDays(1)))); }
      else if (k === '3') { e.preventDefault(); act('schedule', () => onSchedule(cur!, isoOf(nextMonday()))); }
      else if (k === '4') { e.preventDefault(); dateRef.current?.showPicker?.(); dateRef.current?.focus(); }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); advance(); }
    else if (k === 'e') { e.preventDefault(); act('complete', () => onComplete(cur!)); }
    else if (k === 't') { e.preventDefault(); act('schedule', () => onSchedule(cur!, isoOf(new Date()))); }
    else if (k === 's') { e.preventDefault(); setPanel('schedule'); }
    else if (k === 'p') { e.preventDefault(); if (projects.length) setPanel('project'); }
    else if (k === 'l') { e.preventDefault(); if (labels.length && onLabel) setPanel('label'); }
    else if (k === 'd') { e.preventDefault(); act('delete', () => onDelete(cur!)); }
  };

  // Window-level so the grammar survives mouse clicks (a clicked button unmounts
  // and would otherwise swallow focus with it).
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const actBtn = (label: string, key: string, icon: typeof Sun, onClick: () => void, disabled = false) => (
    <Button key={label} size="md" variant="secondary" disabled={disabled} onClick={onClick} icon={<Icon icon={icon} size={14} />}>
      {label}<Kbd keys={[key]} className="ml-0.5" />
    </Button>
  );

  const pickerRow = (list: { id: string; name: string; color?: string | null; isLabel?: boolean }[], onPick: (i: number) => void) => (
    <div className="max-w-sm rounded-lg border border-line-soft bg-surface-raised p-1" style={{ animation: 'fadein 120ms' }}>
      {list.slice(0, 9).map((it, i) => (
        <div key={it.id} onMouseEnter={() => setSel(i)} onClick={() => onPick(i)}
          className={cn('flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5', i === sel ? 'bg-surface-active' : 'hover:bg-surface-hover')}>
          {it.isLabel
            ? <Icon icon={Tag} size={13} className="shrink-0 text-ink-500" />
            : <span className="size-2.5 shrink-0 rounded-xs" style={{ background: it.color ?? 'var(--color-ink-400)' }} />}
          <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{it.name}</span>
          <Kbd keys={[String(i + 1)]} />
        </div>
      ))}
    </div>
  );

  return (
    <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Triage inbox"
      className="fixed inset-0 z-[190] flex flex-col items-center bg-canvas outline-none" style={{ animation: 'fadein 160ms' }}>
      {/* Quiet header: progress left, undo + exit right */}
      <div className="flex w-full max-w-[640px] items-center gap-2 px-6 py-5">
        <span className="tabular-nums text-caption text-ink-500">{done ? 'Triage' : `${Math.min(curPos + 1, total)} of ${total}`}</span>
        <span className="flex-1" />
        {canUndo && <Button size="sm" variant="ghost" icon={<Icon icon={RotateCcw} size={14} />} onClick={() => void undoLast()}>Undo<Kbd keys={['Z']} className="ml-0.5" /></Button>}
        <IconButton size="sm" variant="ghost" label="Exit triage" tooltip="Exit · Esc" icon={<Icon icon={X} size={16} />} onClick={onClose} />
      </div>

      <div className="flex w-full max-w-[640px] flex-1 flex-col justify-center px-6 pb-24">
        {done ? (
          /* The reward state — the only budgeted moment of delight. */
          <div className="text-center" style={{ animation: 'fadein 200ms' }}>
            <div className="flex justify-center"><Icon icon={Check} size={22} className="text-accent-text" /></div>
            <div className="mt-3 text-title-2 text-ink-900">Inbox is clear.</div>
            <div className="mt-1 text-ui text-ink-500">
              {canUndo ? <>Every thought has a home. <Kbd keys={['Z']} /> to undo · <Kbd keys={['Enter']} /> to close.</> : <>Every thought has a home. Press <Kbd keys={['Enter']} /> to close.</>}
            </div>
          </div>
        ) : cur && (
          <div key={cur.id} style={{ animation: 'fadein 140ms' }}>
            <div className="mb-2.5 flex items-center gap-2 text-caption text-ink-500">
              {age(cur.created_at)}
              {cur.priority !== 'low' && <span className="inline-flex items-center gap-1.5"><PriorityBars level={cur.priority} size={11} />{PRIO_LABEL[cur.priority]}</span>}
            </div>
            <div className="text-title-1 leading-tight text-ink-900" style={{ overflowWrap: 'anywhere' }}>{cur.title}</div>

            {/* Decision row / sub-panels */}
            <div className="mt-7 min-h-[76px]">
              {panel === null && (
                <div className="flex flex-wrap gap-2">
                  {actBtn('Done', 'E', Check, () => act('complete', () => onComplete(cur!)))}
                  {actBtn('Today', 'T', Sun, () => act('schedule', () => onSchedule(cur!, isoOf(new Date()))))}
                  {actBtn('Schedule', 'S', Calendar, () => setPanel('schedule'))}
                  {actBtn('Project', 'P', Kanban, () => setPanel('project'), projects.length === 0)}
                  {labels.length > 0 && onLabel && actBtn('Label', 'L', Tag, () => setPanel('label'))}
                  {actBtn('Delete', 'D', Trash2, () => act('delete', () => onDelete(cur!)))}
                  {actBtn('Keep', '↵', CornerDownLeft, advance)}
                </div>
              )}
              {panel === 'schedule' && (
                <div className="flex flex-wrap gap-2" style={{ animation: 'fadein 120ms' }}>
                  {actBtn('Today', '1', Sun, () => act('schedule', () => onSchedule(cur!, isoOf(new Date()))))}
                  {actBtn('Tomorrow', '2', Calendar, () => act('schedule', () => onSchedule(cur!, isoOf(addDays(1)))))}
                  {actBtn('Next week', '3', Calendar, () => act('schedule', () => onSchedule(cur!, isoOf(nextMonday()))))}
                  <span className="relative inline-flex">
                    {actBtn('Pick date', '4', Calendar, () => { dateRef.current?.showPicker?.(); dateRef.current?.focus(); })}
                    <input ref={dateRef} type="date" aria-label="Pick a date" tabIndex={-1}
                      onChange={(e) => { if (e.target.value) act('schedule', () => onSchedule(cur!, e.target.value)); }}
                      className="pointer-events-none absolute inset-0 opacity-0" />
                  </span>
                  {actBtn('Back', 'Esc', X, () => setPanel(null))}
                </div>
              )}
              {panel === 'label' && pickerRow(labels.map((l) => ({ ...l, isLabel: true })), (i) => { const l = labels[i]; if (l) labelAct(l); })}
              {panel === 'project' && pickerRow(projects, (i) => { const p = projects[i]; if (p) act('project', () => onProject(cur!, p.id)); })}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint line */}
      <div className="w-full max-w-[640px] px-6 pb-5 text-caption text-ink-400">
        {done ? ' ' : panel ? 'Esc goes back' : <>One decision per thought · <Kbd keys={['Enter']} /> keeps it · <Kbd keys={['Z']} /> undoes · Esc exits</>}
      </div>
    </div>
  );
}
