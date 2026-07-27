'use client';
// Calendar — a native Day / Week / Month calendar over calendar_events in the
// Notion-calendar idiom: a left rail (mini-month + colored calendar lists) beside
// the white grid canvas, a compact toolbar (month · week no. · Today · view · nav),
// and a rich floating event composer. Colored "calendars" come from the semantic
// palette; the rail's checkboxes show/hide events. Create/edit/delete go through
// the events server actions; Google-synced events are editable (edits write back).
// `demoEvents` renders the whole tool on staged local data (dev playground).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, PanelLeft } from "@/components/ds/icons";
import { Icon, Button, IconButton, ButtonGroup, SegmentedControl } from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';
import { addEvent, updateEvent, deleteEvent } from '@/lib/actions/events';
import { syncGoogleCalendar } from '@/lib/actions/google-calendar';
import {
  type CalEvent, MONTHS, monthCells, weekDays, addDays, addMonths,
  startOfDay, localISODate, isoFromLocal, weekNumber,
} from '@/lib/calendar';
import { calendarOf } from '@/lib/calendar-cats';
import { DEFAULT_EVENT_COLOR } from '@/lib/event-color';
import { MonthGrid } from '@/components/calendar/month-grid';
import { WeekGrid } from '@/components/calendar/week-grid';
import { CalendarSidebar, type RailProject } from '@/components/calendar/calendar-sidebar';
import type { DateRange } from '@/components/calendar/mini-month';
import { EventComposer, type EditorValues } from '@/components/calendar/event-composer';

const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

type View = 'day' | 'week' | 'month';
const VIEWS: { id: View; label: string }[] = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }];
type Editing =
  | { mode: 'create'; values: EditorValues }
  | { mode: 'edit'; id: string; readOnly: boolean; values: EditorValues };

const DEMO_PROJECTS: RailProject[] = [
  { id: 'life', name: 'Life', color: '#D1453E' },
  { id: 'aurora', name: 'Aurora', color: '#3F82D6' },
];

export function CalendarView({ connected = false, spaceId, demoEvents }: { connected?: boolean; spaceId?: string; demoEvents?: CalEvent[] }) {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [projects, setProjects] = useState<RailProject[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [composerAnchor, setComposerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [rangeSel, setRangeSel] = useState<DateRange | null>(null); // custom range from the mini-month
  const demo = !!demoEvents;

  // Track the pointer so the composer can open anchored near the click.
  const ptr = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => { ptr.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', onMove, true);
    return () => window.removeEventListener('pointerdown', onMove, true);
  }, []);

  // Collapse the rail on narrow viewports (still user-toggleable).
  useEffect(() => {
    const apply = () => setRailOpen(window.innerWidth >= 1040);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // A selected range overrides the day/week/month view with a custom N-day grid.
  const rangeDays = rangeSel
    ? (() => { const out: Date[] = []; let d = startOfDay(rangeSel.start); const end = startOfDay(rangeSel.end); while (d.getTime() <= end.getTime()) { out.push(d); d = addDays(d, 1); } return out; })()
    : null;
  const isMonth = view === 'month' && !rangeSel;
  const days = rangeDays ?? (view === 'day' ? [anchor] : view === 'week' ? weekDays(anchor) : []);

  const range = rangeSel
    ? { start: startOfDay(rangeSel.start), end: addDays(startOfDay(rangeSel.end), 1) }
    : view === 'month'
      ? (() => { const c = monthCells(anchor); return { start: c[0], end: addDays(c[41], 1) }; })()
      : view === 'week'
        ? (() => { const w = weekDays(anchor); return { start: w[0], end: addDays(w[6], 1) }; })()
        : { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };

  const load = useCallback(async () => {
    if (demoEvents) {
      const s = range.start.getTime(), e = range.end.getTime();
      setEvents(demoEvents.filter((ev) => { const t = new Date(ev.starts_at).getTime(); return t >= s && t < e; }));
      return;
    }
    const sb = createClient();
    const query = (cols: string) => {
      let q = sb.from('calendar_events').select(cols)
        .gte('starts_at', range.start.toISOString())
        .lt('starts_at', range.end.toISOString());
      if (spaceId) q = q.eq('space_id', spaceId);
      return q.order('starts_at');
    };
    // Select `color`; gracefully fall back if the column isn't migrated yet.
    let { data, error } = await query('id, title, starts_at, ends_at, all_day, source, color');
    if (error && /color/i.test(error.message)) ({ data, error } = await query('id, title, starts_at, ends_at, all_day, source'));
    if (!error) setEvents((data as unknown as CalEvent[]) ?? []);
  }, [range.start.getTime(), range.end.getTime(), spaceId, demoEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Rail's PROJECTS list — the user's active projects (or demo samples).
  useEffect(() => {
    if (demo) { setProjects(DEMO_PROJECTS); return; }
    (async () => {
      const sb = createClient();
      let q = sb.from('projects').select('id, name, color').eq('status', 'active');
      if (spaceId) q = q.eq('space_id', spaceId);
      const { data } = await q.order('created_at');
      if (data) setProjects(data.map((p) => ({ id: p.id as string, name: p.name as string, color: (p.color as string) ?? '' })));
    })();
  }, [demo, spaceId]);

  // Pull Google → Zenboard. Runs once on open (if connected) and on demand.
  async function syncNow() {
    if (demo) return;
    setSyncing(true);
    try { await syncGoogleCalendar(); } finally { await load(); setSyncing(false); }
  }
  const didSync = useRef(false);
  useEffect(() => {
    if (!connected || demo || didSync.current) return;
    didSync.current = true;
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Visible events = not hidden by a calendar toggle.
  const visible = useMemo(() => events.filter((e) => !hidden.has(calendarOf(e).id)), [events, hidden]);
  const toggleCal = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const fmtMD = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  const heading = rangeSel
    ? (rangeSel.start.getMonth() === rangeSel.end.getMonth() ? `${MONTHS[rangeSel.start.getMonth()]} ${rangeSel.start.getFullYear()}` : `${fmtMD(rangeSel.start)} – ${fmtMD(rangeSel.end)}`)
    : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const caption = rangeSel
    ? `${fmtMD(rangeSel.start)} – ${fmtMD(rangeSel.end)} · ${(rangeDays?.length ?? 0)} days`
    : view === 'day'
      ? anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      : view === 'week'
        ? `Week ${weekNumber(anchor)}`
        : null;

  // Navigation / view switches exit a custom range back to the normal grid.
  const pickView = (v: View) => { setRangeSel(null); setView(v); };
  const goToday = () => { setRangeSel(null); setAnchor(startOfDay(new Date())); };
  const step = (dir: number) => { setRangeSel(null); setAnchor((d) => (view === 'month' ? addMonths(d, dir) : view === 'week' ? addDays(d, dir * 7) : addDays(d, dir))); };

  // ── Editor openers ──
  const openCreate = (date: string, time?: string, allDay = false, endTime?: string) => {
    const start = time ?? '09:00';
    const [h, m] = start.split(':').map(Number);
    const end = endTime ?? `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setComposerAnchor({ ...ptr.current });
    setEditing({ mode: 'create', values: { title: '', date, start, end, allDay, color: DEFAULT_EVENT_COLOR } });
  };
  const openEvent = (e: CalEvent) => {
    const sd = new Date(e.starts_at);
    const ed = e.ends_at ? new Date(e.ends_at) : new Date(sd.getTime() + 3600000);
    setComposerAnchor({ ...ptr.current });
    setEditing({ mode: 'edit', id: e.id, readOnly: false,
      values: { title: e.title, date: localISODate(sd), start: hm(sd), end: hm(ed), allDay: e.all_day, color: e.color ?? DEFAULT_EVENT_COLOR } });
  };
  // Instant recolor while editing (optimistic + persist), like Google Calendar.
  async function recolor(id: string, color: string) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, color } : e)));
    if (demo) return;
    const res = await updateEvent(id, { color });
    if ('error' in res) setFlash(res.error);
  }

  // ── Mutations (optimistic-ish: act, then refetch; demo mutates locally) ──
  async function save(v: EditorValues) {
    const startsAt = isoFromLocal(v.date, v.allDay ? '00:00' : v.start);
    const endsAt = v.allDay ? null : isoFromLocal(v.date, v.end);
    const cur = editing;
    setEditing(null);
    const color = v.color ?? DEFAULT_EVENT_COLOR;
    if (cur?.mode === 'create') {
      if (demo) { setEvents((es) => [...es, { id: `demo-${Date.now()}`, title: v.title, starts_at: startsAt, ends_at: endsAt, all_day: v.allDay, source: null, color }]); return; }
      const res = await addEvent({ title: v.title, startsAt, endsAt, allDay: v.allDay, color });
      if ('error' in res) setFlash(res.error); else load();
    } else if (cur?.mode === 'edit') {
      if (demo) { setEvents((es) => es.map((e) => (e.id === cur.id ? { ...e, title: v.title, starts_at: startsAt, ends_at: endsAt, all_day: v.allDay, color } : e))); return; }
      const res = await updateEvent(cur.id, { title: v.title, startsAt, endsAt, allDay: v.allDay, color });
      if ('error' in res) setFlash(res.error); else load();
    }
  }
  async function remove() {
    const cur = editing;
    setEditing(null);
    if (cur?.mode === 'edit') {
      setEvents((es) => es.filter((e) => e.id !== cur.id)); // optimistic
      if (demo) return;
      const res = await deleteEvent(cur.id);
      if ('error' in res) { setFlash(res.error); load(); }
    }
  }

  async function moveEvent(id: string, startsAt: string, endsAt: string | null, allDay = false) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, starts_at: startsAt, ends_at: endsAt, all_day: allDay } : e)));
    if (demo) return;
    const res = await updateEvent(id, { startsAt, endsAt, allDay });
    if ('error' in res) { setFlash(res.error); load(); }
  }

  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t); } }, [flash]);

  return (
    // Fills the shell's rounded content container directly (no nested panel /
    // outer padding) so the calendar aligns flush with its frame. Right padding
    // clears the shell's floating page-options (•••) menu.
    <div className="flex h-full flex-col bg-paper animate-ds-fadein">
      {/* ── Toolbar ── */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-line-soft py-2 pl-3 pr-[52px]">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton size="md" variant="ghost" onClick={() => setRailOpen((v) => !v)} label={railOpen ? 'Hide sidebar' : 'Show sidebar'} icon={<Icon icon={PanelLeft} size={16} />} />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="whitespace-nowrap text-lead font-semibold tracking-[-0.01em] text-ink-900">{heading}</span>
            {caption && <span className="whitespace-nowrap text-meta font-medium tabular-nums text-ink-600">{caption}</span>}
          </div>
        </div>
        {flash && <span className="ml-1 text-meta text-danger-600">{flash}</span>}
        <span className="min-w-2 flex-1" />

        <div className="inline-flex flex-wrap items-center gap-2">
          {connected && !demo && (
            <IconButton size="md" variant="ghost" onClick={syncNow} disabled={syncing} label="Sync with Google Calendar"
              icon={<Icon icon={RefreshCw} size={16} className={syncing ? 'motion-safe:animate-spin' : undefined} />} />
          )}
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>

          {/* View switch (Day / Week / Month) — the one DS toggle pattern */}
          <SegmentedControl
            aria-label="Calendar view"
            value={view}
            onValueChange={(v) => pickView(v as View)}
            options={VIEWS.map((vw) => ({ value: vw.id, label: vw.label }))}
          />

          {/* Grouped ‹ › nav */}
          <ButtonGroup>
            <Button size="sm" variant="outline" iconOnly aria-label="Previous" onClick={() => step(-1)} icon={<Icon icon={ChevronLeft} size={14} />} />
            <Button size="sm" variant="outline" iconOnly aria-label="Next" onClick={() => step(1)} icon={<Icon icon={ChevronRight} size={14} />} />
          </ButtonGroup>
        </div>
      </div>

      {/* ── Body: rail + white grid canvas ── */}
      <div className="flex min-h-0 flex-1">
        {railOpen && (
          <aside className="w-[232px] shrink-0 border-r border-line-soft">
            <CalendarSidebar selected={anchor} range={rangeSel}
              onPick={(d) => { setRangeSel(null); setAnchor(startOfDay(d)); if (view === 'month') setView('week'); }}
              onSelectRange={(s, e) => { setRangeSel({ start: startOfDay(s), end: startOfDay(e) }); setAnchor(startOfDay(s)); }}
              projects={projects} hidden={hidden} onToggle={toggleCal} onCreate={() => openCreate(localISODate(anchor))} />
          </aside>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper-2">
          {isMonth
            ? <MonthGrid anchor={anchor} events={visible} onCreateOn={(d) => openCreate(d)} onMove={moveEvent} onOpen={openEvent}
                onMore={(d) => { setAnchor(startOfDay(new Date(`${d}T00:00:00`))); setView('day'); }} />
            : <WeekGrid days={days} events={visible} onCreateAt={(d, t) => openCreate(d, t)} onCreateRange={(d, s, e) => openCreate(d, s, false, e)} onCreateAllDay={(d) => openCreate(d, undefined, true)} onMove={moveEvent} onOpen={openEvent} />}
        </div>
      </div>

      {editing && (
        <EventComposer
          mode={editing.mode}
          readOnly={editing.mode === 'edit' && editing.readOnly}
          initial={editing.values}
          anchor={composerAnchor}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
          onColorChange={editing.mode === 'edit' ? (c) => recolor(editing.id, c) : undefined}
        />
      )}
    </div>
  );
}
