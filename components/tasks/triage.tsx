'use client';
// Triage — the Inbox processed one thought at a time (Linear's triage, sized
// for one person). A full-screen calm layer: the current item is the only thing
// on screen, every decision is a single key, and the queue drains to a quiet
// reward state. Keys: F file (suggested) · E done · T today · S schedule ·
// P project · L label · D delete · Enter keep · Z undo last · Esc back/exit.
// Every decision is reversible (Z steps back and reverts it) — triage is fully
// undoable (§6.3).
//
// ── THE CLERK, WHEN ASKED (MASTER_PRODUCT_PLAN §7Q, *File*) ─────────────────
// "Suggest where these go" reads the whole queue once and proposes a project —
// and a date, when the thought itself named one — for as many as it can
// (lib/inbox-file.ts for the rules, lib/inbox-ai.ts for the residue).
//
// NOTHING IS FETCHED UNTIL IT IS PRESSED, which is what "off by default" means
// here. A settings toggle would be a weaker promise than this: opening triage
// would spend a shared free pool on somebody who only wanted to clear six
// thoughts by hand.
//
// A proposal is ONE MORE KEY, never a different flow. F applies everything the
// clerk proposed for this thought at once, because triage's own footer promises
// one decision per thought and splitting the answer across two keys would make
// the assisted path slower than the unassisted one. Every proposal shows the
// receipt it rests on, above the decision row, always — a suggestion you cannot
// check against your own data is one you have to take on faith.
import { useCallback, useEffect, useMemo, useRef, useState, forwardRef} from 'react';
import { Check, Sun, Calendar, Kanban, Trash2, CornerDownLeft, X, Tag, RotateCcw, Sparkles, TriangleAlert } from "@/components/ds/icons";
import { Icon, Button, IconButton, Kbd, PriorityBars, FullScreenLayer, DatePicker, cardClass } from "@/components/ds/ui";
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/date';
import { scopeFill } from '@/lib/entity-color';
import type { FileProposals } from '@/lib/inbox-file';

// The queue's item shape. These used to be declared by the standalone /inbox
// page and imported back up into here; that page is gone — the Inbox is a view
// inside Tasks now — so triage owns the contract its callers implement.
// `created_at` is load-bearing: the queue drains oldest-first, and the card
// shows how long a thought has been waiting.
export type InboxTask = { id: string; title: string; priority: 'low' | 'med' | 'high'; done: boolean; is_inbox: boolean; created_at: string; project_id: string | null };
export type InboxProject = { id: string; name: string; color: string | null };
export type InboxLabel = { id: string; name: string };
export type UndoKind = 'complete' | 'schedule' | 'project' | 'delete';

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

/**
 * One triage action: a labelled button with its shortcut.
 *
 * This was a function that RETURNED JSX and took a `key` — a component written
 * as a call, which hides it from reconciliation and means every handler passed
 * to it is, as far as the compiler can tell, invoked during render. That last
 * part is not academic: it is why reading `dateRef` inside one of these
 * handlers was reported as a ref access during render.
 */
// forwardRef + rest-spread so this can be a Radix trigger (`asChild` hands the
// child a ref and its own handlers). `onClick` is optional for the same reason:
// as a trigger, the popover supplies the open behaviour.
const ActBtn = forwardRef<HTMLButtonElement, {
  label: string; shortcut: string; icon: typeof Sun; onClick?: () => void; disabled?: boolean;
}>(function ActBtn({ label, shortcut, icon, onClick, disabled = false, ...rest }, ref) {
  return (
    <Button ref={ref} size="md" variant="secondary" disabled={disabled} onClick={onClick} icon={<Icon icon={icon} size={14} />} {...rest}>
      {label}<Kbd keys={[shortcut]} className="ml-0.5" />
    </Button>
  );
});

/** What asking the clerk comes back with. The host never throws; a failure is a sentence. */
export type TriageSuggestResult = { proposals: FileProposals[]; modelFailed: boolean } | { error: string };

/** Nothing asked · asking · an answer · a reason there is none. */
type Reading =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'ready'; by: Map<string, FileProposals>; count: number; modelFailed: boolean }
  | { status: 'failed'; error: string };

export function Triage({ items, projects, labels = [], onComplete, onSchedule, onProject, onFile, onLabel, onUnlabel, onDelete, onUndo, onSuggest, onClose }: {
  items: InboxTask[]; projects: InboxProject[]; labels?: InboxLabel[];
  onComplete: (task: InboxTask) => void; onSchedule: (task: InboxTask, dateISO: string) => void;
  onProject: (task: InboxTask, projectId: string) => void;
  /** Accept everything the clerk proposed for one thought, as one decision. */
  onFile?: (task: InboxTask, filing: { projectId?: string; date?: string }) => void;
  onLabel?: (id: string, labelId: string) => void; onUnlabel?: (id: string, labelId: string) => void;
  onDelete: (task: InboxTask) => void;
  onUndo: (task: InboxTask, kind: UndoKind) => Promise<InboxTask>;
  /** Ask the clerk to read the queue. Absent ⇒ nothing is offered here at all. */
  onSuggest?: () => Promise<TriageSuggestResult>;
  onClose: () => void;
}) {
  // Snapshot the queue oldest-first; acting removes the item globally, keeping
  // just advances. `idx` only moves forward, except Z (undo) which steps back.
  //
  // These two are STATE, not refs. They were refs, and the render body read
  // both — the queue to find the current card and print "3 of 12", the history
  // to decide whether Undo appears. A ref React cannot see changing is exactly
  // what it says on the tin: mutating one does not re-render, which is why a
  // dummy `bump` counter existed purely to force one after `undoLast` rewrote a
  // queue slot. That counter was the bug wearing a name — the values are render
  // state, so they are held as state and `bump` is gone.
  const [queue, setQueue] = useState<string[]>(
    () => [...items].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((t) => t.id),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [sel, setSel] = useState(0);
  const [reading, setReading] = useState<Reading>({ status: 'idle' });
  const rootRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(items.map((t) => [t.id, t])), [items]);
  // Skip ids whose rows were already acted on (they left `items`).
  let cur: InboxTask | undefined;
  let curPos = idx;
  while (curPos < queue.length && !(cur = byId.get(queue[curPos]))) curPos++;
  const total = queue.length;
  const done = cur === undefined;
  const canUndo = history.length > 0;

  // The clerk's answer for the card on screen, reduced to what can still be acted on: a project
  // that has since been deleted, or one the thought is already in, proposes nothing.
  const proposal = reading.status === 'ready' && cur ? reading.by.get(cur.id) : undefined;
  const suggested = (() => {
    if (!proposal || !onFile) return undefined;
    const p = proposal.project && projects.find((x) => x.id === proposal.project!.projectId);
    const projectId = p && cur?.project_id !== p.id ? p.id : undefined;
    const date = proposal.scheduled?.date ?? proposal.due?.date;
    if (!projectId && !date) return undefined;
    const day = date ? formatDay(date, { weekday: true }) : undefined;
    return {
      projectId, date,
      label: projectId && day ? `File in ${p!.name}, ${day}` : projectId ? `File in ${p!.name}` : `Schedule for ${day}`,
      // A thought filed somewhere is no longer in the Inbox; one only dated is still a schedule.
      kind: (projectId ? 'project' : 'schedule') as UndoKind,
    };
  })();

  // The receipts, in the order the card reads them. Every proposal shown has one.
  const receipts = proposal
    ? [proposal.project?.evidence, proposal.scheduled?.evidence ?? proposal.due?.evidence].filter(Boolean) as string[]
    : [];

  // A LABEL IS NOT A HOME, so it is not on F. It is marked inside the panel where labels are
  // already chosen, and named here so the person knows the panel has something in it — one press
  // agreeing to two different kinds of thing is what §7Q's one-tap-accept rules out.
  const labelHint = proposal?.label && labels.some((l) => l.id === proposal.label!.labelId)
    ? proposal.label
    : undefined;

  const advance = useCallback(() => { setPanel(null); setSel(0); setIdx(curPos + 1); }, [curPos]);
  // A data-changing decision: record it for undo, run it, then hold idx (the
  // acted row leaves `items`, so the same idx now points at the next survivor).
  const act = useCallback((kind: UndoKind, fn: () => void) => {
    if (cur) setHistory((h) => [...h, { task: cur, kind, pos: curPos }]);
    fn(); setPanel(null); setSel(0); setIdx(curPos);
  }, [cur, curPos]);
  const ask = useCallback(async () => {
    if (!onSuggest || reading.status === 'reading') return;
    setReading({ status: 'reading' });
    let res: TriageSuggestResult;
    try {
      res = await onSuggest();
    } catch {
      // The three rejection kinds are the shell's business; here the only useful thing to say is
      // that it did not happen and pressing again is allowed.
      setReading({ status: 'failed', error: 'Couldn\u2019t read your inbox. Try again.' });
      return;
    }
    if ('error' in res) { setReading({ status: 'failed', error: res.error }); return; }
    const by = new Map(res.proposals.map((p) => [p.thoughtId, p]));
    setReading({
      status: 'ready', by, modelFailed: res.modelFailed,
      count: res.proposals.filter((p) => p.project || p.scheduled || p.due).length,
    });
  }, [onSuggest, reading.status]);

  const labelAct = useCallback((l: InboxLabel) => {
    if (cur) setHistory((h) => [...h, { task: cur, kind: 'label', pos: curPos, labelId: l.id }]);
    onLabel?.(cur!.id, l.id); advance();
  }, [cur, curPos, onLabel, advance]);

  // `history.pop()` used to be the whole re-entrancy story: it removed and
  // returned the entry in one uninterruptible step, so holding Z could not undo
  // the same action twice. Reading state cannot be atomic that way — `undoLast`
  // awaits the server, and a second press lands before the re-render — so the
  // guard is explicit. A ref is the right tool HERE, because nothing renders
  // from it.
  const undoing = useRef(false);
  const undoLast = useCallback(async () => {
    if (undoing.current) return;
    const entry = history[history.length - 1];
    if (!entry) return;
    undoing.current = true;
    try {
      setHistory((h) => h.slice(0, -1));
      setPanel(null); setSel(0);
      if (entry.kind === 'label') { onUnlabel?.(entry.task.id, entry.labelId!); setIdx(entry.pos); return; }
      const restored = await onUndo(entry.task, entry.kind); // re-creating a deleted item yields a new id
      setQueue((q) => q.map((id, i) => (i === entry.pos ? restored.id : id)));
      setIdx(entry.pos);
    } finally {
      undoing.current = false;
    }
  }, [history, onUndo, onUnlabel]);

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
    else if (k === 'f' && suggested) {
      e.preventDefault();
      act(suggested.kind, () => onFile!(cur!, { projectId: suggested.projectId, date: suggested.date }));
    }
    else if (k === 'e') { e.preventDefault(); act('complete', () => onComplete(cur!)); }
    else if (k === 't') { e.preventDefault(); act('schedule', () => onSchedule(cur!, isoOf(new Date()))); }
    else if (k === 's') { e.preventDefault(); setPanel('schedule'); }
    else if (k === 'p') { e.preventDefault(); if (projects.length) setPanel('project'); }
    else if (k === 'l') { e.preventDefault(); if (labels.length && onLabel) setPanel('label'); }
    else if (k === 'd') { e.preventDefault(); act('delete', () => onDelete(cur!)); }
  };

  // Window-level so the grammar survives mouse clicks (a clicked button unmounts
  // and would otherwise swallow focus with it).
  // The listener is attached once, but `onKey` closes over state that changes
  // every render — so the ref carries the latest one. Writing it DURING render
  // is what the rule objects to (a render that is retried or discarded would
  // still have mutated it); an effect runs only for the render that committed.
  const keyRef = useRef(onKey);
  useEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // `markId` is the clerk's answer, MARKED WHERE IT ALREADY SITS. Moving it to the top would be the
  // obvious way to draw attention to it and the wrong one: the 1–9 keys are the whole point of this
  // panel, and a list that reorders itself when a suggestion arrives makes them unmemorisable.
  const pickerRow = (
    list: { id: string; name: string; color?: string | null; isLabel?: boolean }[],
    onPick: (i: number) => void,
    markId?: string,
  ) => (
    <div className={cardClass('zb-enter max-w-sm p-1')} style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>
      {list.slice(0, 9).map((it, i) => (
        <div key={it.id} onMouseEnter={() => setSel(i)} onClick={() => onPick(i)}
          className={cn('flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5', i === sel ? 'bg-surface-active' : 'hover:bg-surface-hover')}>
          {it.isLabel
            ? <Icon icon={Tag} size={12} className="shrink-0 text-ink-500" />
            : <span className="size-2.5 shrink-0 rounded-xs" style={{ background: scopeFill(it.color) }} />}
          <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{it.name}</span>
          {it.id === markId && (
            <span className="flex shrink-0 items-center gap-1 text-caption text-ink-500">
              <Icon icon={Sparkles} size={12} />Suggested
            </span>
          )}
          <Kbd keys={[String(i + 1)]} />
        </div>
      ))}
    </div>
  );

  return (
    // `closeOnEscape` is off because triage runs its OWN Escape ladder: the first
    // press backs out of a sub-panel, only the next one exits. Handing Escape to
    // the layer would collapse both steps into "quit".
    <FullScreenLayer label="Triage inbox" onClose={onClose} surface="canvas" closeOnEscape={false}
      className="flex flex-col items-center">
      <div ref={rootRef} tabIndex={-1} className="flex w-full flex-1 flex-col items-center outline-none">
      {/* Quiet header: progress left, undo + exit right */}
      <div className="flex w-full max-w-[640px] items-center gap-2 px-6 py-5">
        <span className="tabular-nums text-caption text-ink-500">{done ? 'Triage' : `${Math.min(curPos + 1, total)} of ${total}`}</span>
        <span className="flex-1" />
        {/* Asked once for the whole queue, and only when pressed. Gone once it has answered: the
            answers are on the cards, and a button that has done its job is clutter on a screen
            whose whole argument is that one thought is on it. */}
        {onSuggest && !done && (reading.status === 'idle' || reading.status === 'reading') && (
          <Button size="sm" variant="ghost" loading={reading.status === 'reading'}
            icon={<Icon icon={Sparkles} size={14} />} onClick={() => void ask()}>
            Suggest where these go
          </Button>
        )}
        {reading.status === 'failed' && (
          <Button size="sm" variant="ghost" icon={<Icon icon={Sparkles} size={14} />} onClick={() => void ask()}>
            Try again
          </Button>
        )}
        {canUndo && <Button size="sm" variant="ghost" icon={<Icon icon={RotateCcw} size={14} />} onClick={() => void undoLast()}>Undo<Kbd keys={['Z']} className="ml-0.5" /></Button>}
        <IconButton size="sm" variant="ghost" label="Exit triage" tooltip="Exit · Esc" icon={<Icon icon={X} size={16} />} onClick={onClose} />
      </div>

      <div className="flex w-full max-w-[640px] flex-1 flex-col justify-center px-6 pb-24">
        {done ? (
          /* The reward state — the only budgeted moment of delight. */
          <div className="text-center" style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>
            <div className="flex justify-center"><Icon icon={Check} size={24} className="text-accent-text" /></div>
            <div className="font-editorial mt-3 text-title-2 text-ink-900">Inbox is clear.</div>
            <div className="mt-1 text-ui text-ink-500">
              {canUndo ? <>Every thought has a home. <Kbd keys={['Z']} /> to undo · <Kbd keys={['Enter']} /> to close.</> : <>Every thought has a home. Press <Kbd keys={['Enter']} /> to close.</>}
            </div>
          </div>
        ) : cur && (
          // No entrance: a decision advances the queue dozens of times a sitting, by key or
          // click, and a card that rises in each time taxes the one thing triage is for.
          <div key={cur.id}>
            <div className="mb-2.5 flex items-center gap-2 text-caption text-ink-500">
              {age(cur.created_at)}
              {cur.priority !== 'low' && <span className="inline-flex items-center gap-1.5"><PriorityBars level={cur.priority} size={11} />{PRIO_LABEL[cur.priority]}</span>}
            </div>
            <div className="font-editorial text-title-1 leading-tight text-ink-900" style={{ overflowWrap: 'anywhere' }}>{cur.title}</div>

            {/* THE RECEIPTS. Always visible, never behind a hover — they are the difference between
                an inference you can check and one you have to take on faith. */}
            {(receipts.length > 0 || labelHint || proposal?.duplicate) && (
              <div className="mt-3 space-y-1">
                {receipts.map((r) => (
                  <p key={r} className="text-caption text-ink-500">{r}</p>
                ))}
                {labelHint && (
                  <p className="text-caption text-ink-500">
                    {labelHint.evidence} <Kbd keys={['L']} /> to label it {labelHint.labelName}.
                  </p>
                )}
                {proposal?.duplicate && (
                  <p className="flex items-start gap-1.5 text-caption text-ink-500">
                    <Icon icon={TriangleAlert} size={14} className="mt-px shrink-0 text-warning" />
                    <span>You already have <span className="text-ink-800">{proposal.duplicate.title}</span>.</span>
                  </p>
                )}
              </div>
            )}

            {/* Decision row / sub-panels */}
            <div className="mt-7 min-h-[76px]">
              {panel === null && (
                <div className="flex flex-wrap gap-2">
                  {/* The clerk's answer goes FIRST and is one key, so the assisted path is never
                      slower than the manual one it is assisting. */}
                  {suggested && (
                    <ActBtn label={suggested.label} shortcut="F" icon={Sparkles}
                      onClick={() => act(suggested.kind, () => onFile!(cur!, { projectId: suggested.projectId, date: suggested.date }))} />
                  )}
                  <ActBtn label="Done" shortcut="E" icon={Check} onClick={() => act('complete', () => onComplete(cur!))} />
                  <ActBtn label="Today" shortcut="T" icon={Sun} onClick={() => act('schedule', () => onSchedule(cur!, isoOf(new Date())))} />
                  <ActBtn label="Schedule" shortcut="S" icon={Calendar} onClick={() => setPanel('schedule')} />
                  <ActBtn label="Project" shortcut="P" icon={Kanban} onClick={() => setPanel('project')} disabled={projects.length === 0} />
                  {labels.length > 0 && onLabel && <ActBtn label="Label" shortcut="L" icon={Tag} onClick={() => setPanel('label')} />}
                  <ActBtn label="Delete" shortcut="D" icon={Trash2} onClick={() => act('delete', () => onDelete(cur!))} />
                  <ActBtn label="Keep" shortcut="↵" icon={CornerDownLeft} onClick={advance} />
                </div>
              )}
              {panel === 'schedule' && (
                <div className="zb-enter flex flex-wrap gap-2" style={{ animation: 'fade-rise var(--duration-base) var(--ease-out-quiet)' }}>
                  <ActBtn label="Today" shortcut="1" icon={Sun} onClick={() => act('schedule', () => onSchedule(cur!, isoOf(new Date())))} />
                  <ActBtn label="Tomorrow" shortcut="2" icon={Calendar} onClick={() => act('schedule', () => onSchedule(cur!, isoOf(addDays(1))))} />
                  <ActBtn label="Next week" shortcut="3" icon={Calendar} onClick={() => act('schedule', () => onSchedule(cur!, isoOf(nextMonday())))} />
                  {/* Our calendar, not the browser's. This used to call
                      `showPicker()` on an invisible native input pinned over the
                      button — a trick that opened Chrome's date UI from the
                      middle of a keyboard-driven triage flow. */}
                  <DatePicker
                    aria-label="Pick a date"
                    value={null}
                    onValueChange={(iso) => { if (iso) act('schedule', () => onSchedule(cur!, iso)); }}
                    trigger={<ActBtn label="Pick date" shortcut="4" icon={Calendar} />}
                  />
                  <ActBtn label="Back" shortcut="Esc" icon={X} onClick={() => setPanel(null)} />
                </div>
              )}
              {panel === 'label' && pickerRow(labels.map((l) => ({ ...l, isLabel: true })), (i) => { const l = labels[i]; if (l) labelAct(l); }, proposal?.label?.labelId)}
              {panel === 'project' && pickerRow(projects, (i) => { const p = projects[i]; if (p) act('project', () => onProject(cur!, p.id)); })}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint line */}
      <div className="w-full max-w-[640px] px-6 pb-5 text-caption text-ink-500">
        {done ? ' ' : panel ? 'Esc goes back' : reading.status === 'failed' ? reading.error
          : reading.status === 'ready'
            ? (reading.count === 0
                ? 'Nothing here was clear enough to suggest a home for.'
                : <>{reading.count} of {total} have a suggestion · nothing is filed until you press <Kbd keys={['F']} /></>)
            : <>One decision per thought · <Kbd keys={['Enter']} /> keeps it · <Kbd keys={['Z']} /> undoes · Esc exits</>}
      </div>
      </div>
    </FullScreenLayer>
  );
}
