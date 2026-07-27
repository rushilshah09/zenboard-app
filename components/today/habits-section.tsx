'use client';
// Today's Habits — check-off + streak, plus full management: add (inline
// composer), rename (inline edit), delete (InlineConfirm). Owns its own list
// state, re-syncing whenever the server sends fresh data (realtime / refresh).
// All mutations are optimistic with rollback. Built on the canonical DS —
// the check is the DS Checkbox (square, draw-in tick, monochrome via the
// berry→ink remap); type/color resolve through the ds-theme scale.
import { useEffect, useRef, useState } from 'react';
import { Flame, Plus, Pencil, Trash2, X } from "@/components/ds/icons";
import { Icon, Button, Checkbox, EmptyState, IconButton, InlineConfirm } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { toggleHabit, addHabit, renameHabit, deleteHabit } from '@/lib/actions/habits';
import { cn } from '@/lib/cn';
import type { TodayHabit } from '@/components/today/today-view';

export function HabitsSection({ initialHabits, error }: { initialHabits: TodayHabit[]; error: boolean }) {
  const [habits, setHabits] = useState<TodayHabit[]>(initialHabits);
  useEffect(() => { setHabits(initialHabits); }, [initialHabits]);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);
  useEffect(() => { if (editId) editRef.current?.focus(); }, [editId]);

  async function toggle(id: string) {
    const target = habits.find((x) => x.id === id);
    if (!target) return;
    const nextDone = !target.doneToday;
    setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, doneToday: nextDone, streak: Math.max(0, x.streak + (nextDone ? 1 : -1)) } : x)));
    const res = await toggleHabit(id, nextDone);
    if ('error' in res) setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, doneToday: !nextDone, streak: target.streak } : x)));
  }

  async function add() {
    const title = newTitle.trim();
    if (!title) { setAdding(false); return; }
    setNewTitle('');
    const tempId = 'temp-' + Date.now();
    setHabits((hs) => [...hs, { id: tempId, title, doneToday: false, streak: 0 }]);
    const res = await addHabit(title);
    if ('id' in res) setHabits((hs) => hs.map((x) => (x.id === tempId ? { ...x, id: res.id } : x)));
    else setHabits((hs) => hs.filter((x) => x.id !== tempId));
    addRef.current?.focus();
  }

  function startEdit(h: TodayHabit) { setConfirmId(null); setEditId(h.id); setEditTitle(h.title); }

  async function commitEdit() {
    const id = editId; const title = editTitle.trim();
    if (!id) return;
    setEditId(null);
    const prev = habits.find((x) => x.id === id);
    if (!prev || !title || title === prev.title) return;
    setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, title } : x)));
    const res = await renameHabit(id, title);
    if ('error' in res) setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, title: prev.title } : x)));
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = habits;
    setHabits((hs) => hs.filter((x) => x.id !== id));
    const res = await deleteHabit(id);
    if ('error' in res) setHabits(prev);
  }

  return (
    <section className="mb-8">
      <Panel frame="shadow">
        <PanelHeader
          icon={<Icon icon={Flame} size={18} />}
          title="Habits"
          count={habits.length > 0 ? habits.length : undefined}
          action={!error && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon={adding ? X : Plus} size={16} />}
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? 'Cancel' : 'Add'}
            </Button>
          )}
        />
        <PanelBody>
        {adding && (
          <div className="flex items-center gap-2 border-b border-line-soft py-1 pe-1.5 ps-3.5">
            <Icon icon={Flame} size={16} className="text-ink-500" />
            <input ref={addRef} value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
              placeholder="New habit — e.g. Morning walk" autoComplete="off" data-1p-ignore data-lpignore="true"
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-ui text-ink-900 outline-none placeholder:text-ink-400" />
            {/* Secondary, not primary — the page's one filled primary is the quick-add "Add". */}
            {newTitle.trim() && <Button variant="secondary" size="sm" onClick={add}>Add</Button>}
          </div>
        )}

        {error ? (
          <div className="px-4 py-3.5 text-body text-danger-600">Couldn’t load your habits. Try refreshing.</div>
        ) : habits.length === 0 ? (
          <EmptyState
            size="inline"
            illustration={<Icon icon={Flame} size={20} />}
            title="No habits yet"
            description="Build a rhythm — small things, done daily."
            primary={adding ? undefined : <Button variant="secondary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>Add a habit</Button>}
          />
        ) : (
          <div>
            {habits.map((hb, i) => {
              const editing = editId === hb.id;
              const confirming = confirmId === hb.id;
              return (
                <div key={hb.id} className={cn('group/habit flex items-center gap-3 px-4 py-3', i < habits.length - 1 && 'border-b border-line-soft')}>
                  <Checkbox
                    size="md"
                    checked={hb.doneToday}
                    onCheckedChange={() => toggle(hb.id)}
                    aria-label={hb.doneToday ? 'Uncheck habit' : 'Check habit'}
                  />

                  {editing ? (
                    <input ref={editRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                      autoComplete="off" data-1p-ignore data-lpignore="true"
                      className="min-w-0 flex-1 border-0 border-b border-line bg-transparent py-0.5 text-body text-ink-900 outline-none" />
                  ) : (
                    <span className={cn('min-w-0 flex-1 truncate text-body', hb.doneToday ? 'text-ink-500' : 'text-ink-900')}>{hb.title}</span>
                  )}

                  {confirming ? (
                    <InlineConfirm onConfirm={() => remove(hb.id)} onCancel={() => setConfirmId(null)} />
                  ) : (
                    <>
                      {/* Row actions stay quiet until hover — still keyboard-focusable. */}
                      <span className="inline-flex items-center gap-0.5 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover/habit:opacity-100">
                        <IconButton label="Rename" size="xs" icon={<Icon icon={Pencil} size={14} />} onClick={() => startEdit(hb)} />
                        <IconButton label="Delete" size="xs" icon={<Icon icon={Trash2} size={14} />} onClick={() => setConfirmId(hb.id)} />
                      </span>
                      <span className="inline-flex items-center gap-1 text-meta text-ink-500" title={`${hb.streak}-day streak`}>
                        <Icon icon={Flame} size={14} /><span className="num">{hb.streak}</span>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </PanelBody>
      </Panel>
    </section>
  );
}
