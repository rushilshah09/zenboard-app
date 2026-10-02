'use client';
// Today's Habits — check-off + streak, plus full management: add (inline
// composer), rename (inline edit), delete (InlineConfirm). Owns its own list
// state, re-syncing whenever the server sends fresh data (realtime / refresh).
// All mutations are optimistic with rollback. Built on the canonical DS —
// the check is the DS Checkbox (square, draw-in tick, monochrome via the
// berry→ink remap); type/color resolve through the ds-theme scale.
import { useEffect, useRef, useState } from 'react';
import { Flame, Plus, Pencil, Trash2 } from "@/components/ds/icons";
import { Icon, Button, Checkbox, AnchorRow, IconButton, InlineConfirm, addLine, inlineEdit, inlineEditProps, toastReverted } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { HOME_SECTION, homeRow } from '@/components/today/home-rows';
import { toggleHabit, addHabit, renameHabit, deleteHabit } from '@/lib/actions/habits';
import { cn } from '@/lib/cn';
import type { TodayHabit } from '@/components/today/today-view';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';

export function HabitsSection({ initialHabits, error }: { initialHabits: TodayHabit[]; error: boolean }) {
  const [habits, setHabits] = useServerState(initialHabits);

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
    if ('error' in res) {
      setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, doneToday: !nextDone, streak: target.streak } : x)));
      toastReverted(res.error);
    }
  }

  async function add() {
    const title = newTitle.trim();
    if (!title) { setAdding(false); return; }
    setNewTitle('');
    const tmp = tempId();
    setHabits((hs) => [...hs, { id: tmp, title, doneToday: false, streak: 0 }]);
    const res = await addHabit(title);
    if ('id' in res) setHabits((hs) => hs.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
    else setHabits((hs) => hs.filter((x) => x.id !== tmp));
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
    if ('error' in res) { setHabits((hs) => hs.map((x) => (x.id === id ? { ...x, title: prev.title } : x))); toastReverted(res.error); }
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = habits;
    setHabits((hs) => hs.filter((x) => x.id !== id));
    const res = await deleteHabit(id);
    if ('error' in res) { setHabits(prev); toastReverted(res.error); }
  }

  return (
    <section className={HOME_SECTION}>
      <Panel frame="shadow">
      <PanelHeader
        icon={<Icon icon={Flame} size={20} />}
        title="Habits"
        count={habits.length > 0 ? habits.length : undefined}
        action={!error && !adding && (
          <Button variant="ghost" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>Add</Button>
        )}
      />
      <PanelBody>

      {/* The add row is the house add line in its FIELD shape — the + on the checkboxes' vertical, the caret where
          the names start (components/ds/ui/add-line.tsx). Escape or an empty blur puts it away. */}
      {adding && (
        <label className={cn(addLine({ as: 'field', lead: 'checkbox' }), 'border-b border-line-soft')}>
          <Icon icon={Plus} size={14} className="mx-px shrink-0" />
          <input ref={addRef} value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
            onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
            placeholder="New habit, e.g. Morning walk" aria-label="New habit" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
          {/* Secondary, not primary — the page's one filled primary is the plan's "Add". */}
          {newTitle.trim() && <Button variant="secondary" size="sm" onClick={add}>Add</Button>}
        </label>
      )}

      {error ? (
        <p className="px-[var(--panel-px)] py-3.5 text-ui text-danger-600">Couldn’t load your habits. Try refreshing.</p>
      ) : habits.length === 0 ? (
        !adding && (
          // A SECTION of a populated page, so `<EmptyLine>` — see states.tsx. The action stays,
          // because unlike the other three this one starts something that exists nowhere else on
          // the page; it just sits IN the sentence rather than under a 180px centred column.
          <AnchorRow
            className="px-[var(--panel-px)] py-3.5"
            icon={<Icon icon={Flame} size={16} />}
            title="Start a habit"
            description="Build a rhythm: small things, done daily."
            trailing={<Button variant="secondary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>Add a habit</Button>}
          />
        )
      ) : (
        <div>
          {habits.map((hb, i) => {
            const editing = editId === hb.id;
            const confirming = confirmId === hb.id;
            const row = homeRow(i === habits.length - 1);
            return (
              <div key={hb.id} className={row.outer}>
                <div className={row.wash}>
                  <Checkbox
                    size="md"
                    checked={hb.doneToday}
                    onCheckedChange={() => toggle(hb.id)}
                    aria-label={hb.doneToday ? `Uncheck ${hb.title}` : `Check ${hb.title}`}
                    className="shrink-0"
                  />

                  {editing ? (
                    <input ref={editRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                      aria-label="Habit name" autoComplete="off" data-1p-ignore data-lpignore="true"
                      {...inlineEditProps} className={cn(inlineEdit({ as: 'ui' }), 'min-w-0 flex-1')} />
                  ) : (
                    <span className={cn('min-w-0 flex-1 truncate text-ui', hb.doneToday ? 'text-ink-500' : 'text-ink-800')}>{hb.title}</span>
                  )}

                  {confirming ? (
                    <InlineConfirm onConfirm={() => remove(hb.id)} onCancel={() => setConfirmId(null)} />
                  ) : (
                    <>
                      {/* `reveal-on-hover`: quiet until the row is hovered or focused, and always on under a finger
                          (a hand-rolled opacity-0 group-hover pair was unreachable on a phone). */}
                      <span className="reveal-on-hover inline-flex items-center gap-0.5">
                        <IconButton label="Rename" size="xs" icon={<Icon icon={Pencil} size={14} />} onClick={() => startEdit(hb)} />
                        <IconButton label="Delete" size="xs" icon={<Icon icon={Trash2} size={14} />} onClick={() => setConfirmId(hb.id)} />
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-caption tabular-nums text-ink-500" title={`${hb.streak}-day streak`}>
                        <Icon icon={Flame} size={12} />{hb.streak}
                      </span>
                    </>
                  )}
                </div>
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
