'use client';
// Today's Schedule on Home — a card (the user's call, 2026-09-22: Home is cards) holding an agenda: each entry a row
// (time in its own column, then the name), and a live "now" marker woven in chronologically in the calendar's own
// accent. Full management retained: add (inline field with time + all-day), rename (inline), delete
// (InlineConfirm). Optimistic with rollback.
//
// Inside the card it was a "Today Tue 22 ⌄" row whose caret opened nothing, and ~100px entries carrying a
// calendar-coloured rail, a duration pill and a "Google Calendar" chip that also labelled Zenboard's own timeboxes.
// The range already says how long a thing is; which calendar it came from is the Calendar's business.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, X } from "@/components/ds/icons";
import { cn } from '@/lib/cn';
import { Icon, Button, Checkbox, AnchorRow, IconButton, InlineConfirm, TimePicker, addLine, inlineEdit, inlineEditProps, toastReverted } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { HOME_SECTION, homeRow } from '@/components/today/home-rows';
import { addEvent, updateEvent, deleteEvent } from '@/lib/actions/events';
import { formatClock, formatClockRange } from '@/lib/date';
import type { TodayEvent } from '@/components/today/today-view';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';

// The house clock, via the shared range formatter — NOT a private 12-hour one.
// This file used to carry `9:00 – 9:30pm` "like the HiFi", which put a 12-hour
// time in a list sitting directly under a 24-hour picker and directly beside a
// 24-hour calendar. See `formatClockRange` in lib/date.ts.
const fmtRange = (e: TodayEvent) => formatClockRange(e.starts_at, e.ends_at) ?? '';
// The user's *local* calendar date (yyyy-mm-dd) — not UTC, so events land on the
// right local day for the Schedule query window.
function localDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoFor(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}
function byStart(a: TodayEvent, b: TodayEvent) {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1; // all-day first
  return a.starts_at.localeCompare(b.starts_at);
}

export function ScheduleSection({ initialEvents, error }: { initialEvents: TodayEvent[]; error: boolean }) {
  const [events, setEvents] = useServerState(initialEvents);
  const today = useMemo(() => localDate(), []);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) titleRef.current?.focus(); }, [adding]);
  useEffect(() => { if (editId) editRef.current?.focus(); }, [editId]);

  // Live "Now" pill — woven among today's timed events so you see where you are.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNowMs(Date.now()), 60000); return () => clearInterval(id); }, []);

  const sorted = [...events].sort(byStart);
  const hasTimed = sorted.some((e) => !e.all_day);
  const nowIdx = sorted.findIndex((e) => !e.all_day && new Date(e.starts_at).getTime() > nowMs);
  const nowAt = nowIdx === -1 ? sorted.length : nowIdx;
  const nowLabel = formatClock(new Date(nowMs));
  // The calendar's own "now": an accent chip on an accent line (components/calendar/week-grid.tsx), so the same
  // moment looks the same on Home and on the Calendar. It was a black "Now 14:00" slab across the card.
  // It takes its own 20px slot between two entries — drawn ON the boundary it covered the next entry's time.
  const nowRow = (
    <div aria-hidden className="flex h-5 items-center px-[var(--panel-px)]">
      <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 text-caption leading-4 font-semibold tabular-nums text-[var(--on-accent)]">{nowLabel}</span>
      <span className="h-px flex-1 bg-[var(--accent)]" />
    </div>
  );

  function resetComposer() { setTitle(''); setAllDay(false); setStart('09:00'); setEnd(''); }

  async function add() {
    const t = title.trim();
    if (!t) { setAdding(false); return; }
    const startsAt = allDay ? isoFor(today, '00:00') : isoFor(today, start);
    const endsAt = !allDay && end ? isoFor(today, end) : null;
    resetComposer();
    const tmp = tempId();
    setEvents((es) => [...es, { id: tmp, title: t, starts_at: startsAt, ends_at: endsAt, all_day: allDay }]);
    const res = await addEvent({ title: t, startsAt, endsAt, allDay });
    if ('id' in res) setEvents((es) => es.map((e) => (e.id === tmp ? { ...e, id: res.id } : e)));
    else setEvents((es) => es.filter((e) => e.id !== tmp));
    titleRef.current?.focus();
  }

  function startEdit(e: TodayEvent) { setConfirmId(null); setEditId(e.id); setEditTitle(e.title); }

  async function commitEdit() {
    const id = editId; const t = editTitle.trim();
    if (!id) return;
    setEditId(null);
    const prev = events.find((e) => e.id === id);
    if (!prev || !t || t === prev.title) return;
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, title: t } : e)));
    const res = await updateEvent(id, { title: t });
    if ('error' in res) { setEvents((es) => es.map((e) => (e.id === id ? { ...e, title: prev.title } : e))); toastReverted(res.error); }
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = events;
    setEvents((es) => es.filter((e) => e.id !== id));
    const res = await deleteEvent(id);
    if ('error' in res) { setEvents(prev); toastReverted(res.error); }
  }

  return (
    <section className={HOME_SECTION}>
      <Panel frame="shadow">
      <PanelHeader
        icon={<Icon icon={CalendarDays} size={20} />}
        title="Schedule"
        action={!error && !adding && (
          <Button variant="ghost" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => { resetComposer(); setAdding(true); }}>Add</Button>
        )}
      />
      <PanelBody>

      {adding && (
        <div className="flex flex-col gap-2 border-b border-line-soft pb-2.5 pe-2">
          <label className={addLine({ as: 'field', lead: 'checkbox' })}>
            <Icon icon={Plus} size={14} className="mx-px shrink-0" />
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); resetComposer(); } }}
              placeholder="Event title, e.g. Client call" aria-label="New event" autoComplete="off" data-1p-ignore data-lpignore="true"
              className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500" />
            {/* Secondary, not primary — the page's one filled primary is the plan's "Add". */}
            {title.trim() && <Button variant="secondary" size="sm" onClick={add}>Add</Button>}
            <IconButton label="Cancel" size="xs" icon={<Icon icon={X} size={14} />} onClick={() => { setAdding(false); resetComposer(); }} />
          </label>
          <div className="flex flex-wrap items-center gap-2.5 ps-[calc(var(--panel-px)+28px)]">
            <Checkbox size="sm" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} label="All day" />
            {/* All-day DISABLES the times, it does not delete them. Removing
                the fields made the row jump and threw away a start you had
                already picked, and it was also the second of two different
                answers in the app — the event composer swapped its time row
                for the word "All-day". Dimmed-and-inert is one answer, and it
                keeps what you typed if you tick the box by mistake. */}
            <span className="inline-flex items-center gap-1.5">
              <TimePicker aria-label="Start time" className="w-[104px]" disabled={allDay}
                value={start} onValueChange={setStart} />
              <span className="text-meta text-ink-500">to</span>
              <TimePicker aria-label="End time" className="w-[104px]" disabled={allDay}
                value={end} onValueChange={setEnd} durationFrom={start} placeholder="optional" />
            </span>
          </div>
        </div>
      )}

      {error ? (
        <p className="px-[var(--panel-px)] py-3.5 text-ui text-danger-600">Couldn’t load your calendar. Try refreshing.</p>
      ) : sorted.length === 0 ? (
        !adding && (
          // A SECTION of a populated page, so `<EmptyLine>` — see states.tsx. The header's own
          // "Add" is the action; the page-sized state spent 180px to repeat it.
          <AnchorRow
            className="px-[var(--panel-px)] py-3.5"
            icon={<Icon icon={CalendarDays} size={16} />}
            title="Nothing scheduled"
            description="Meetings and time blocks for today show here."
          />
        )
      ) : (
        // An agenda: the time in its own column, the name after it. Each entry used to be ~100px — a name, a
        // duration pill, a time line and a "Google Calendar" chip that also labelled Zenboard's own timeboxes
        // (`source !== 'manual'` counted a timebox as synced). The range already says how long it is.
        <div>
          {sorted.map((e, i) => {
            const editing = editId === e.id;
            const confirming = confirmId === e.id;
            // The marker is the divider where it falls: the entry above it draws no hairline of its own.
            const row = homeRow(i === sorted.length - 1 || (hasTimed && i + 1 === nowAt));
            return (
              <Fragment key={e.id}>
                {hasTimed && i === nowAt && nowRow}
                <div className={row.outer}>
                  <div className={row.wash}>
                    <span className="w-24 shrink-0 text-caption tabular-nums text-ink-500">{e.all_day ? 'All day' : fmtRange(e)}</span>
                    {editing ? (
                      <input ref={editRef} value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') commitEdit(); if (ev.key === 'Escape') setEditId(null); }}
                        aria-label="Event name" autoComplete="off" data-1p-ignore data-lpignore="true"
                        {...inlineEditProps} className={cn(inlineEdit({ as: 'ui' }), 'min-w-0 flex-1')} />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{e.title}</span>
                    )}
                    {confirming ? (
                      <InlineConfirm onConfirm={() => remove(e.id)} onCancel={() => setConfirmId(null)} />
                    ) : (
                      <span className="reveal-on-hover inline-flex items-center gap-0.5">
                        <IconButton label="Rename" size="xs" icon={<Icon icon={Pencil} size={14} />} onClick={() => startEdit(e)} />
                        <IconButton label="Delete" size="xs" icon={<Icon icon={Trash2} size={14} />} onClick={() => setConfirmId(e.id)} />
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          {/* After the last entry, the marker keeps a breath of room above the card's edge. */}
          {hasTimed && nowAt === sorted.length && <div className="pb-2">{nowRow}</div>}
        </div>
      )}
      </PanelBody>
      </Panel>
    </section>
  );
}
