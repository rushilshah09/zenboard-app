'use client';
// Today's Schedule — a DS Panel: header row (calendar · Schedule · Add) over a
// card holding a day header, event blocks (calendar rail · title + duration ·
// time range · source chip) and a live "Now" marker woven chronologically. Full
// management retained: add (inline composer with time + all-day), rename
// (inline), delete (InlineConfirm). Optimistic with rollback.
//
// Token rules: every color/size/radius resolves through the DS scale (ui/meta/
// caption, line-soft, ink steps). The ONLY inline styles left are the two
// runtime-dynamic calendar colors (rail + duration chip) — a wired feature of
// the colored-calendar model, chosen per event source at render time.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Plus, Pencil, Trash2, X } from "@/components/ds/icons";
import { Icon, Button, Checkbox, EmptyState, IconButton, InlineConfirm } from '@/components/ds/ui';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panels';
import { addEvent, updateEvent, deleteEvent } from '@/lib/actions/events';
import type { TodayEvent } from '@/components/today/today-view';

// "9:00 – 9:30pm" — meridiem only on the end (or start when no end), like the HiFi.
function fmtClock(d: Date, withMeridiem: boolean) {
  const h12 = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const base = m === 0 ? `${h12}:00` : `${h12}:${String(m).padStart(2, '0')}`;
  return withMeridiem ? base + (d.getHours() < 12 ? 'am' : 'pm') : base;
}
function fmtRange(e: TodayEvent) {
  const s = new Date(e.starts_at);
  if (!e.ends_at) return fmtClock(s, true);
  const en = new Date(e.ends_at);
  const sameMeridiem = (s.getHours() < 12) === (en.getHours() < 12);
  return `${fmtClock(s, !sameMeridiem)} – ${fmtClock(en, true)}`;
}
// Compact duration: 15min · 1hr · 1hr 30m · 2hr
function fmtSpan(e: TodayEvent): string | null {
  if (e.all_day || !e.ends_at) return null;
  const mins = Math.round((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}hr ${m}m` : `${h}hr`;
}

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

// Native time inputs, tokened: 28px control, hairline border, tabular digits
// (numbers get tabular-nums, never mono — mono is for invoice IDs only).
const TIME_INPUT = 'h-7 rounded-sm border border-line bg-paper px-2 text-meta tabular-nums text-ink-900';

export function ScheduleSection({ initialEvents, error }: { initialEvents: TodayEvent[]; error: boolean }) {
  const [events, setEvents] = useState<TodayEvent[]>(initialEvents);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
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
  const nowLabel = fmtClock(new Date(nowMs), true);
  // "Now" marker (Figma 472:14884): ink-solid chip with right-rounded corners
  // bleeding from the panel's left edge + a 1px ink rule across. B&G: the chip is
  // the primary-button treatment (ink-900 fill, onsolid label) — never white-on-ink.
  const nowRow = (
    <div aria-hidden className="-mx-3 flex items-center">
      <span className="inline-flex shrink-0 items-center rounded-e-xs bg-ink-900 px-2 py-1 text-caption leading-none font-medium text-onsolid">Now {nowLabel}</span>
      <span className="h-px flex-1 bg-ink-900" />
    </div>
  );

  const dayLabel = useMemo(() => {
    const d = new Date();
    return `Today ${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  function resetComposer() { setTitle(''); setAllDay(false); setStart('09:00'); setEnd(''); }

  async function add() {
    const t = title.trim();
    if (!t) { setAdding(false); return; }
    const startsAt = allDay ? isoFor(today, '00:00') : isoFor(today, start);
    const endsAt = !allDay && end ? isoFor(today, end) : null;
    resetComposer();
    const tempId = 'temp-' + Date.now();
    setEvents((es) => [...es, { id: tempId, title: t, starts_at: startsAt, ends_at: endsAt, all_day: allDay }]);
    const res = await addEvent({ title: t, startsAt, endsAt, allDay });
    if ('id' in res) setEvents((es) => es.map((e) => (e.id === tempId ? { ...e, id: res.id } : e)));
    else setEvents((es) => es.filter((e) => e.id !== tempId));
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
    if ('error' in res) setEvents((es) => es.map((e) => (e.id === id ? { ...e, title: prev.title } : e)));
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = events;
    setEvents((es) => es.filter((e) => e.id !== id));
    const res = await deleteEvent(id);
    if ('error' in res) setEvents(prev);
  }

  return (
    <section className="mb-8">
      {/* Figma zb-schedule-panel (472:15457): Shadow-1 shell · header (calendar
          18 · "Schedule" · Add) · body with day header row. */}
      <Panel frame="shadow">
        <PanelHeader
          icon={<Icon icon={CalendarDays} size={18} />}
          title="Schedule"
          action={!error && (
            <Button variant="ghost" size="sm" icon={<Icon icon={adding ? X : Plus} size={16} />} onClick={() => { setAdding((v) => !v); resetComposer(); }}>
              {adding ? 'Cancel' : 'Add'}
            </Button>
          )}
        />

        <PanelBody>
        {adding && (
          <div className="flex flex-col gap-2 border-b border-line-soft px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Icon icon={CalendarDays} size={16} className="shrink-0 text-ink-500" />
              <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); resetComposer(); } }}
                placeholder="Event title — e.g. Client call" autoComplete="off" data-1p-ignore data-lpignore="true"
                className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-ui text-ink-900 outline-none placeholder:text-ink-400" />
              {/* Secondary, not primary — the page's one filled primary is the quick-add "Add". */}
              {title.trim() && <Button variant="secondary" size="sm" onClick={add}>Add</Button>}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pl-6">
              <Checkbox size="sm" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} label="All day" />
              {!allDay && (
                <span className="inline-flex items-center gap-1.5">
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" className={TIME_INPUT} />
                  <span className="text-meta text-ink-500">to</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time (optional)" className={TIME_INPUT} />
                  <span className="text-caption text-ink-400">end optional</span>
                </span>
              )}
            </div>
          </div>
        )}

        {error ? (
          <div className="px-4 py-3.5 text-body text-danger-600">Couldn’t load your calendar. Try refreshing.</div>
        ) : (
          <>
            {/* Day header row (Figma 469:13468): meta label · caret · border-b */}
            <div className="flex w-full items-center gap-1 border-b border-line-soft px-3 py-2">
              <span className="text-meta text-ink-500">{dayLabel}</span>
              <Icon icon={ChevronDown} size={16} className="text-icon-quiet" />
            </div>

            {sorted.length === 0 ? (
              <EmptyState
                size="inline"
                illustration={<Icon icon={CalendarDays} size={20} />}
                title="Nothing scheduled"
                description="A clear calendar is a feature. Add an event when you need one."
                primary={adding ? undefined : <Button variant="secondary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>Add an event</Button>}
              />
            ) : (
              <div className="flex w-full flex-col gap-3 p-3">
                {sorted.map((e, i) => {
                  const editing = editId === e.id;
                  const confirming = confirmId === e.id;
                  const synced = !!e.source && e.source !== 'manual';
                  const span = fmtSpan(e);
                  // Colored-calendar model: rail + chip take the calendar's color
                  // (Google = blue, manual = purple) — runtime-dynamic token pair.
                  const railColor = synced ? 'var(--blue-dot)' : 'var(--purple-dot)';
                  const chipBg = synced ? 'var(--blue-bg)' : 'var(--purple-bg)';
                  return (
                    <Fragment key={e.id}>
                      {hasTimed && i === nowAt && nowRow}
                      {i > 0 && <div aria-hidden className="h-px shrink-0 bg-line-soft" />}
                      <div className="group/event relative flex gap-2 rounded-sm p-2">
                        <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ background: railColor }} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {editing ? (
                                <input ref={editRef} value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(ev) => { if (ev.key === 'Enter') commitEdit(); if (ev.key === 'Escape') setEditId(null); }}
                                  autoComplete="off" data-1p-ignore data-lpignore="true"
                                  className="min-w-0 flex-1 border-0 border-b border-line bg-transparent py-px text-ui text-ink-700 outline-none" />
                              ) : (
                                <span className="truncate text-ui text-ink-700">{e.title}</span>
                              )}
                              {span && !editing && (
                                <span className="inline-flex shrink-0 items-center rounded-xs p-1 text-caption leading-none" style={{ background: chipBg, color: railColor }}>{span}</span>
                              )}
                            </div>
                            {/* ink-400 replaces the old ink-500 + opacity 0.72 — quiet via token */}
                            <div className="num text-meta text-ink-400">{e.all_day ? 'All day' : fmtRange(e)}</div>
                          </div>
                          {synced && (
                            <span className="inline-flex items-center gap-1 self-start rounded-tag bg-surface-selected p-1 text-meta leading-none font-medium text-ink-700">
                              <span className="size-1.5 rounded-full bg-[var(--blue-dot)]" /> Google Calendar
                            </span>
                          )}
                        </div>

                        {confirming ? (
                          <InlineConfirm className="self-start" onConfirm={() => remove(e.id)} onCancel={() => setConfirmId(null)} />
                        ) : (
                          /* Row actions stay quiet until hover — still keyboard-focusable. */
                          <span className="inline-flex items-center gap-0.5 self-start opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover/event:opacity-100">
                            <IconButton label="Rename" size="xs" icon={<Icon icon={Pencil} size={14} />} onClick={() => startEdit(e)} />
                            <IconButton label="Delete" size="xs" icon={<Icon icon={Trash2} size={14} />} onClick={() => setConfirmId(e.id)} />
                          </span>
                        )}
                      </div>
                    </Fragment>
                  );
                })}
                {hasTimed && nowAt === sorted.length && nowRow}
              </div>
            )}
          </>
        )}
        </PanelBody>
      </Panel>
    </section>
  );
}
