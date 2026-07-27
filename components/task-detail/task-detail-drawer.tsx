'use client';
// Task detail — right-side drawer driven by ?task=<id>. Nested infinite-depth
// subtasks (walk into any node, breadcrumb keeps you oriented) + a chat-style
// comments/activity dock posting to the selected node. Reads via the browser
// client (RLS); writes via shared server actions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X, ChevronRight, Plus, Check, Timer, Sun, MessageCircle, Send, Repeat, Tag, Folder } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';
import { addSubtask, addComment, updateTask, toggleTask, rescheduleTask } from '@/lib/actions/tasks';
import { createLabel, setLabelColor, setTaskLabel, setTaskSection } from '@/lib/actions/labels';
import { ColorPalette } from '@/components/ds/ui';
import { type LabelColor } from '@/lib/labelColor';
import { signalTaskToggle } from '@/lib/sound';

type Row = {
  id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high';
  estimate_minutes: number | null; scheduled_date: string | null; is_inbox: boolean;
  notes: string | null; parent_task_id: string | null; recurrence: { freq?: string } | null;
  project_id: string | null; section_id?: string | null;
};
type Label = { id: string; name: string; color?: string | null };
type Section = { id: string; project_id: string; name: string };
type Node = Row & { subtasks: Node[] };
type FeedItem = { id: string; kind: 'comment' | 'event'; mine: boolean; body: string; at: string };

const fmtDur = (m: number | null) => (m == null ? null : m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`);
const PRI = { high: { c: 'var(--red)', t: 'High' }, med: { c: 'var(--amber)', t: 'Medium' }, low: { c: 'var(--text-secondary)', t: 'Low' } } as const;
const REC: Record<string, string> = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function buildTree(rows: Row[], rootId: string): Node | null {
  const byParent = new Map<string | null, Row[]>();
  for (const r of rows) { const k = r.parent_task_id; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(r); }
  const root = rows.find((r) => r.id === rootId);
  if (!root) return null;
  const attach = (r: Row): Node => ({ ...r, subtasks: (byParent.get(r.id) ?? []).map(attach) });
  return attach(root);
}
function findNode(n: Node, id: string): Node | null {
  if (n.id === id) return n;
  for (const k of n.subtasks) { const f = findNode(k, id); if (f) return f; }
  return null;
}
function pathTo(n: Node, id: string, acc: Node[] = []): Node[] | null {
  const next = [...acc, n];
  if (n.id === id) return next;
  for (const k of n.subtasks) { const f = pathTo(k, id, next); if (f) return f; }
  return null;
}
const progress = (n: Node) => ({ done: n.subtasks.filter((s) => s.done).length, total: n.subtasks.length });

// tiny popover
function Pop({ trigger, children, width = 200 }: { trigger: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span onClick={() => setOpen((o) => !o)}>{trigger(open)}</span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 130 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 131, width, background: 'var(--paper-2)', border: '1px solid var(--line-pop)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, transformOrigin: 'top left', animation: 'zb-pop-in var(--dur-base) var(--ease-out)' }}>
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </span>
  );
}
const chip = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 'var(--r-full)',
  fontSize: 'var(--text-caption-size)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
  background: active ? 'var(--nav-active-bg)' : 'var(--paper-3)', color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  border: '1px solid var(--line)', transition: 'background var(--dur-fast) var(--ease)',
});
const popRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--text-small-size)', background: 'transparent', color: 'var(--ink-2)', border: 'none' };

function TreeRow({ node, depth, selectedId, expanded, onToggleExp, onSelect, onToggle, onAddChild }: {
  node: Node; depth: number; selectedId: string; expanded: Set<string>;
  onToggleExp: (id: string) => void; onSelect: (id: string) => void; onToggle: (id: string) => void; onAddChild: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const kids = node.subtasks;
  const prog = progress(node);
  const sel = node.id === selectedId;
  return (
    <>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => onSelect(node.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `6px 8px 6px ${8 + Math.min(depth, 6) * 18}px`, minHeight: 36, borderRadius: 'var(--r-md)', cursor: 'pointer', background: sel ? 'var(--nav-active-bg)' : hover ? 'var(--paper-3)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)' }}>
        {kids.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleExp(node.id); }} style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon icon={ChevronRight} size={14} style={{ transform: expanded.has(node.id) ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease)' }} />
          </button>
        ) : <span style={{ width: 18, flexShrink: 0 }} />}
        <button onClick={(e) => { e.stopPropagation(); onToggle(node.id); }} aria-label="toggle" style={{ width: 17, height: 17, flexShrink: 0, borderRadius: '50%', padding: 0, cursor: 'pointer', border: node.done ? 'none' : `1.5px solid ${node.priority !== 'low' ? PRI[node.priority].c : 'color-mix(in srgb, var(--ink) 28%, transparent)'}`, background: node.done ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur-fast) var(--ease)' }}>
          {node.done && <Icon icon={Check} size={12} strokeWidth={2.5} style={{ color: 'var(--paper-2)' }} />}
        </button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-small-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: node.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: node.done ? 'line-through' : 'none', fontWeight: sel ? 600 : 400 }}>{node.title}</span>
        {prog.total > 0 && <span style={{ fontSize: 'var(--text-label-size)', color: prog.done === prog.total ? 'var(--green-text)' : 'var(--text-secondary)' }}>{prog.done}/{prog.total}</span>}
        <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} title="Add subtask" style={{ width: 22, height: 22, border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'transparent', display: 'grid', placeItems: 'center', opacity: hover ? 1 : 0, transition: 'opacity var(--dur-fast) var(--ease)' }}>
          <Icon icon={Plus} size={14} />
        </button>
      </div>
      {expanded.has(node.id) && kids.map((k) => (
        <TreeRow key={k.id} node={k} depth={depth + 1} selectedId={selectedId} expanded={expanded} onToggleExp={onToggleExp} onSelect={onSelect} onToggle={onToggle} onAddChild={onAddChild} />
      ))}
    </>
  );
}

export function TaskDetailDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rootId = params.get('task');

  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [draftSub, setDraftSub] = useState('');
  const [comment, setComment] = useState('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [taskLabels, setTaskLabels] = useState<Record<string, string[]>>({});
  const [labelsSupported, setLabelsSupported] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsSupported, setSectionsSupported] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('stone');
  const [colorEditId, setColorEditId] = useState<string | null>(null);
  const meId = useRef<string | null>(null);

  const loadTree = useCallback(async (focusId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    meId.current = user?.id ?? null;
    const { data } = await supabase.from('tasks')
      .select('id, title, done, priority, estimate_minutes, scheduled_date, is_inbox, notes, parent_task_id, recurrence, project_id');
    let rows = (data as Row[]) ?? [];
    // Labels + sections (migration 0014) — probed separately so the critical
    // fetch above never depends on them; missing → the chips stay hidden.
    const [lab, tl, sec, ts] = await Promise.all([
      supabase.from('labels').select('id, name, color').order('sort_order').order('name'),
      supabase.from('task_labels').select('task_id, label_id'),
      supabase.from('sections').select('id, project_id, name').order('sort_order'),
      supabase.from('tasks').select('id, section_id').not('section_id', 'is', null),
    ]);
    setLabelsSupported(!lab.error);
    setLabels(!lab.error ? ((lab.data as Label[]) ?? []) : []);
    const tlMap: Record<string, string[]> = {};
    if (!tl.error) for (const r of (tl.data as { task_id: string; label_id: string }[]) ?? []) (tlMap[r.task_id] ??= []).push(r.label_id);
    setTaskLabels(tlMap);
    setSectionsSupported(!sec.error);
    setSections(!sec.error ? ((sec.data as Section[]) ?? []) : []);
    if (!ts.error) {
      const m = new Map((ts.data ?? []).map((r) => [r.id, r.section_id]));
      rows = rows.map((r) => ({ ...r, section_id: m.get(r.id) ?? null }));
    }
    setRows(rows);
    if (focusId) setSelectedId(focusId);
  }, [supabase]);

  // open / close on param change
  useEffect(() => {
    if (!rootId) { setRows([]); setSelectedId(null); setFeed([]); return; }
    setSelectedId(rootId);
    setExpanded(new Set([rootId]));
    loadTree();
  }, [rootId, loadTree]);

  // load feed when selection changes
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('task_comments').select('id, body, created_at, user_id').eq('task_id', selectedId).order('created_at'),
        supabase.from('task_activity').select('id, kind, meta, created_at').eq('task_id', selectedId).order('created_at'),
      ]);
      if (cancelled) return;
      const items: FeedItem[] = [
        ...((c as { id: string; body: string; created_at: string; user_id: string }[]) ?? []).map((x) => ({ id: 'c' + x.id, kind: 'comment' as const, mine: x.user_id === meId.current, body: x.body, at: time(x.created_at) })),
        ...((a as { id: string; kind: string; created_at: string }[]) ?? []).map((x) => ({ id: 'a' + x.id, kind: 'event' as const, mine: false, body: x.kind, at: time(x.created_at) })),
      ];
      setFeed(items);
    })();
    return () => { cancelled = true; };
  }, [selectedId, supabase]);

  const tree = useMemo(() => (rootId ? buildTree(rows, rootId) : null), [rows, rootId]);
  const node = tree && selectedId ? findNode(tree, selectedId) : null;
  const crumbs = tree && selectedId ? pathTo(tree, selectedId) ?? [] : [];

  if (!rootId) return null;

  const close = () => router.push(pathname);
  const patchLocal = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const onToggle = (id: string) => { const r = rows.find((x) => x.id === id); if (!r) return; patchLocal(id, { done: !r.done }); signalTaskToggle(!r.done); toggleTask(id, !r.done); };
  const commit = (id: string, p: Partial<Row>) => { patchLocal(id, p); updateTask(id, p as never); };
  const onSchedule = (id: string, target: string) => { patchLocal(id, target === 'inbox' ? { is_inbox: true, scheduled_date: null } : { is_inbox: false, scheduled_date: target }); rescheduleTask(id, target); };

  const toggleLabel = (taskId: string, labelId: string) => {
    const cur = taskLabels[taskId] ?? [];
    const on = !cur.includes(labelId);
    setTaskLabels((m) => ({ ...m, [taskId]: on ? [...cur, labelId] : cur.filter((x) => x !== labelId) }));
    setTaskLabel(taskId, labelId, on);
  };
  const addLabel = async (taskId: string) => {
    const name = newLabel.trim();
    if (!name) return;
    const color = newLabelColor;
    setNewLabel(''); setNewLabelColor('stone');
    const res = await createLabel(name, color);
    if ('id' in res) {
      setLabels((ls) => [...ls, { id: res.id, name, color }]);
      setTaskLabels((m) => ({ ...m, [taskId]: [...(m[taskId] ?? []), res.id] }));
      setTaskLabel(taskId, res.id, true);
    }
  };
  const recolorLabel = (labelId: string, color: LabelColor) => {
    setLabels((ls) => ls.map((l) => (l.id === labelId ? { ...l, color } : l)));
    setLabelColor(labelId, color);
  };
  const onSection = (taskId: string, sectionId: string | null) => { patchLocal(taskId, { section_id: sectionId }); setTaskSection(taskId, sectionId); };

  const addChild = async (parentId: string, title: string) => {
    const res = await addSubtask(parentId, title);
    if ('id' in res) { setExpanded((s) => new Set(s).add(parentId)); await loadTree(res.id); }
  };
  const send = async () => {
    const body = comment.trim(); if (!body || !selectedId) return;
    setComment('');
    setFeed((f) => [...f, { id: 'tmp' + Date.now(), kind: 'comment', mine: true, body, at: time(new Date().toISOString()) }]);
    await addComment(selectedId, body);
  };

  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--scrim-color) 26%, transparent)', zIndex: 79, animation: 'fadein var(--dur-mid) var(--ease)' }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(600px, 94vw)', background: 'var(--paper-2)', borderLeft: '1px solid var(--line)', boxShadow: 'var(--shadow-xl)', zIndex: 80, display: 'flex', flexDirection: 'column', animation: 'slideIn 240ms var(--ease)' }}>
        {/* header / breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--line)', minHeight: 52 }}>
          <button onClick={close} title="Close" style={{ width: 30, height: 30, border: 'none', background: 'var(--paper-3)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon icon={X} size={16} /></button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            {crumbs.map((n, i) => (
              <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {i > 0 && <Icon icon={ChevronRight} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                <button onClick={() => setSelectedId(n.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--text-caption-size)', fontWeight: i === crumbs.length - 1 ? 600 : 400, color: i === crumbs.length - 1 ? 'var(--ink)' : 'var(--text-secondary)', maxWidth: i === 0 ? 220 : 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</button>
              </span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {node && (
            <>
              {/* subject */}
              <div style={{ padding: '18px 22px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <button onClick={() => onToggle(node.id)} aria-label="toggle" style={{ marginTop: 4, width: 22, height: 22, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', border: node.done ? 'none' : '1.5px solid color-mix(in srgb, var(--ink) 30%, transparent)', background: node.done ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur-fast) var(--ease)' }}>
                    {node.done && <Icon icon={Check} size={14} strokeWidth={2.5} style={{ color: 'var(--paper-2)' }} />}
                  </button>
                  <textarea defaultValue={node.title} key={node.id + ':t'} rows={1} onBlur={(e) => e.target.value.trim() && e.target.value !== node.title && commit(node.id, { title: e.target.value.trim() })}
                    onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', resize: 'none', overflow: 'hidden', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--text-stat-size)', lineHeight: 1.2, letterSpacing: '-0.015em', color: node.done ? 'var(--text-secondary)' : 'var(--ink)', textDecoration: node.done ? 'line-through' : 'none', padding: 0 }} />
                </div>

                {/* meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 14 }}>
                  <Pop width={180} trigger={() => <button style={chip(!!node.scheduled_date || node.is_inbox)}><Icon icon={Sun} size={14} />{node.scheduled_date ?? (node.is_inbox ? 'Inbox' : 'Schedule')}</button>}>
                    {(close) => (<div>{[['today', 'Today'], ['inbox', 'Inbox']].map(([id, lbl]) => (
                      <button key={id} style={popRow} onClick={() => { onSchedule(node.id, id === 'today' ? new Date().toISOString().slice(0, 10) : 'inbox'); close(); }}>{lbl}</button>
                    ))}</div>)}
                  </Pop>
                  <Pop width={170} trigger={() => <button style={chip(node.priority !== 'low')}><span style={{ width: 3, height: 12, borderRadius: 2, background: PRI[node.priority].c }} />{PRI[node.priority].t}</button>}>
                    {(close) => (<div>{(['high', 'med', 'low'] as const).map((p) => (
                      <button key={p} style={popRow} onClick={() => { commit(node.id, { priority: p }); close(); }}><span style={{ width: 3, height: 13, borderRadius: 2, background: PRI[p].c }} />{PRI[p].t}</button>
                    ))}</div>)}
                  </Pop>
                  <Pop width={188} trigger={() => <button style={chip(node.estimate_minutes != null)}><Icon icon={Timer} size={14} />{fmtDur(node.estimate_minutes) ?? 'Estimate'}</button>}>
                    {(close) => (<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 4 }}>{[15, 30, 45, 60, 90, 120].map((m) => (
                      <button key={m} onClick={() => { commit(node.id, { estimate_minutes: m }); close(); }} style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--text-caption-size)', background: node.estimate_minutes === m ? 'var(--nav-active-bg)' : 'var(--paper-3)', color: node.estimate_minutes === m ? 'var(--text-primary)' : 'var(--ink-2)', border: '1px solid var(--line)' }}>{fmtDur(m)}</button>
                    ))}</div>)}
                  </Pop>
                  {!node.parent_task_id && (
                    <Pop width={180} trigger={() => <button style={chip(!!node.recurrence?.freq)}><Icon icon={Repeat} size={14} />{node.recurrence?.freq ? (REC[node.recurrence.freq] ?? node.recurrence.freq) : 'Repeat'}</button>}>
                      {(close) => (<div>{([['', 'No repeat'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] as const).map(([f, lbl]) => (
                        <button key={f || 'none'} style={popRow} onClick={() => { commit(node.id, { recurrence: f ? { freq: f } : null }); close(); }}>
                          <Icon icon={Repeat} size={12} style={{ color: f && node.recurrence?.freq === f ? 'var(--ink)' : 'var(--text-secondary)' }} />{lbl}
                        </button>
                      ))}</div>)}
                    </Pop>
                  )}
                  {labelsSupported && (() => {
                    const mine = (taskLabels[node.id] ?? []).map((id) => labels.find((l) => l.id === id)?.name).filter(Boolean) as string[];
                    const label = mine.length === 0 ? 'Labels' : mine.length <= 2 ? mine.join(', ') : `${mine.slice(0, 2).join(', ')} +${mine.length - 2}`;
                    return (
                      <Pop width={220} trigger={() => <button style={chip(mine.length > 0)}><Icon icon={Tag} size={14} />{label}</button>}>
                        {() => (
                          <div>
                            {labels.map((l) => {
                              const on = (taskLabels[node.id] ?? []).includes(l.id);
                              return (
                                <div key={l.id}>
                                  <div style={{ ...popRow, cursor: 'default' }}>
                                    <button onClick={() => setColorEditId((id) => (id === l.id ? null : l.id))} title="Change colour" style={{ border: 'none', background: 'transparent', padding: 2, margin: -2, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--color-label-${l.color ?? 'stone'})` }} />
                                    </button>
                                    <button onClick={() => toggleLabel(node.id, l.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
                                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                                      <Icon icon={Check} size={12} style={{ color: 'var(--ink)', opacity: on ? 1 : 0.15, flexShrink: 0 }} />
                                    </button>
                                  </div>
                                  {colorEditId === l.id && (
                                    <div style={{ padding: '2px 8px 6px' }}>
                                      <ColorPalette value={(l.color as LabelColor) ?? 'stone'} onValueChange={(c) => { recolorLabel(l.id, c); setColorEditId(null); }} aria-label="Label colour" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {labels.length === 0 && <div style={{ padding: '4px 8px 6px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>No labels yet.</div>}
                            <div style={{ borderTop: labels.length ? '1px solid var(--line-2)' : 'none', marginTop: labels.length ? 4 : 0, paddingTop: labels.length ? 4 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px' }}>
                                <Icon icon={Plus} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') addLabel(node.id); }}
                                  placeholder="New label…" autoComplete="off" data-1p-ignore data-lpignore="true"
                                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-small-size)', padding: '4px 0', color: 'var(--ink)' }} />
                              </div>
                              {newLabel.trim() && (
                                <div style={{ padding: '2px 8px 6px' }}>
                                  <ColorPalette value={newLabelColor} onValueChange={(c) => setNewLabelColor(c)} aria-label="New label colour" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                  {sectionsSupported && node.project_id && sections.some((s) => s.project_id === node.project_id) && (() => {
                    const projSections = sections.filter((s) => s.project_id === node.project_id);
                    const cur = projSections.find((s) => s.id === node.section_id);
                    return (
                      <Pop width={200} trigger={() => <button style={chip(!!cur)}><Icon icon={Folder} size={14} />{cur?.name ?? 'Section'}</button>}>
                        {(close) => (
                          <div>
                            {projSections.map((s) => (
                              <button key={s.id} style={popRow} onClick={() => { onSection(node.id, s.id === node.section_id ? null : s.id); close(); }}>
                                <Icon icon={Check} size={12} style={{ color: 'var(--ink)', opacity: s.id === node.section_id ? 1 : 0.15, flexShrink: 0 }} />{s.name}
                              </button>
                            ))}
                            <button style={popRow} onClick={() => { onSection(node.id, null); close(); }}>
                              <Icon icon={X} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />No section
                            </button>
                          </div>
                        )}
                      </Pop>
                    );
                  })()}
                </div>

                <textarea defaultValue={node.notes ?? ''} key={node.id + ':n'} placeholder="Add a description…" rows={node.notes ? 2 : 1}
                  onBlur={(e) => e.target.value !== (node.notes ?? '') && commit(node.id, { notes: e.target.value })}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                  style={{ width: '100%', marginTop: 14, border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'var(--font-editorial)', fontSize: 'var(--text-body-size)', lineHeight: 1.6, color: 'var(--ink-2)', padding: 0 }} />
              </div>

              {/* subtasks */}
              <div style={{ padding: '4px 14px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 8px' }}>
                  <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink-2)' }}>Subtasks</span>
                  {progress(node).total > 0 && <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{progress(node).done}/{progress(node).total} done</span>}
                </div>
                {node.subtasks.length > 0
                  ? node.subtasks.map((k) => (
                    <TreeRow key={k.id} node={k} depth={0} selectedId={selectedId!} expanded={expanded}
                      onToggleExp={(id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                      onSelect={setSelectedId} onToggle={onToggle} onAddChild={(id) => addChild(id, 'New subtask')} />
                  ))
                  : <div style={{ padding: '6px 10px', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>No subtasks yet — break this down below.</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 4px 26px' }}>
                  <Icon icon={Plus} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <input value={draftSub} onChange={(e) => setDraftSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draftSub.trim()) { addChild(node.id, draftSub.trim()); setDraftSub(''); } }}
                    placeholder="Add a subtask…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-small-size)', padding: '6px 0', minWidth: 0, color: 'var(--ink)' }} />
                </div>
              </div>

              {/* comments + activity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px 6px', borderTop: '1px solid var(--line-2)', marginTop: 6 }}>
                <Icon icon={MessageCircle} size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink-2)' }}>Comments &amp; activity</span>
              </div>
              <div style={{ padding: '4px 22px 18px' }}>
                {feed.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-small-size)', fontFamily: 'var(--font-editorial)', fontStyle: 'italic', padding: '24px 0' }}>No comments yet. Start the thread below.</div>}
                {feed.map((it) => it.kind === 'event' ? (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '6px 0' }}>
                    <span style={{ height: 1, flex: 1, maxWidth: 40, background: 'var(--line-2)' }} />
                    <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{it.body} · {it.at}</span>
                    <span style={{ height: 1, flex: 1, maxWidth: 40, background: 'var(--line-2)' }} />
                  </div>
                ) : (
                  <div key={it.id} style={{ display: 'flex', flexDirection: it.mine ? 'row-reverse' : 'row', margin: '6px 0' }}>
                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: it.mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{ padding: '8px 12px', borderRadius: 'var(--r-lg)', fontSize: 'var(--text-small-size)', lineHeight: 1.45, background: it.mine ? 'var(--neutral-fill)' : 'var(--paper-3)', color: it.mine ? 'var(--on-neutral-fill)' : 'var(--ink)', border: it.mine ? 'none' : '1px solid var(--line)', borderBottomRightRadius: it.mine ? 4 : 14, borderBottomLeftRadius: it.mine ? 14 : 4 }}>{it.body}</div>
                      <div style={{ fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)', marginTop: 3, padding: '0 3px' }}>{it.at}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* composer */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '12px 18px 14px', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-full)', padding: '4px 4px 4px 16px' }}>
            <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Leave a message…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-small-size)', padding: '6px 0', minWidth: 0, color: 'var(--ink)' }} />
            <button onClick={send} disabled={!comment.trim()} style={{ width: 34, height: 34, borderRadius: 'var(--r-full)', border: 'none', flexShrink: 0, background: comment.trim() ? 'var(--primary)' : 'color-mix(in srgb, var(--ink) 10%, transparent)', color: comment.trim() ? 'var(--on-primary)' : 'var(--text-secondary)', cursor: comment.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center', transition: 'background var(--dur-fast) var(--ease)' }}><Icon icon={Send} size={16} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
