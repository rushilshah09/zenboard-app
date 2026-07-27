'use client';
// Time grid (Day or Week) — Zenboard's calm reinterpretation of the classic
// hour grid. All-day lane on top, hour rows below, timed events positioned by
// start/end with overlap lanes. A live "now" line (with a time chip in the
// gutter) marks the current time and the grid auto-scrolls to it.
//
// Pointer interactions: click empty slot → create (1h); drag empty → create a
// ranged event; click an event → open; drag an event → move (across time + days);
// drag an event's bottom handle → resize. A click is distinguished from a drag by
// whether the pointer actually moved.
//
// Color semantic (consistent app-wide): plum accent = Zenboard events,
// blue = synced Google events.
import { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/cn";
import { type CalEvent, WEEKDAYS, localISODate, isToday, fmtTime, fmtMinTime, minutesOfDay, hhmm, isoFromLocal } from '@/lib/calendar';
import { eventTokens } from '@/lib/event-color';

const HOUR_H = 80; // px per hour (approved design 501:16578: 80px hour rows)
const DAY_H = HOUR_H * 24;
const SNAP = 15;   // minutes
const GUTTER = 80; // px, hour-label rail ("GMT" / "1 AM") — design 501:16578

function endMinutes(e: CalEvent): number {
  const start = minutesOfDay(e.starts_at);
  if (!e.ends_at) return Math.min(1440, start + 60);
  const end = new Date(e.ends_at);
  const sameLocalDay = localISODate(end) === localISODate(new Date(e.starts_at));
  return sameLocalDay ? end.getHours() * 60 + end.getMinutes() : 1440;
}

function layoutDay(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => minutesOfDay(a.starts_at) - minutesOfDay(b.starts_at));
  const out: { e: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const ev of cluster) {
      const s = minutesOfDay(ev.starts_at);
      let placed = false;
      for (let l = 0; l < laneEnds.length; l++) {
        if (s >= laneEnds[l]) { laneEnds[l] = endMinutes(ev); laneOf.set(ev.id, l); placed = true; break; }
      }
      if (!placed) { laneOf.set(ev.id, laneEnds.length); laneEnds.push(endMinutes(ev)); }
    }
    for (const ev of cluster) out.push({ e: ev, lane: laneOf.get(ev.id)!, lanes: laneEnds.length });
    cluster = [];
  };
  for (const ev of sorted) {
    if (cluster.length && minutesOfDay(ev.starts_at) >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, endMinutes(ev));
  }
  if (cluster.length) flush();
  return out;
}

// Every event uses its own color — the brand accent by default, or the user's
// pick — so the drag preview, created card, and edited card are identical.
const evColor = (e: CalEvent) => eventTokens(e.color);

// Now-chip / hour-gutter language, 12-hour uppercase to match the HiFi grid.
const fmtNow = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

type Drag =
  | { kind: 'create'; dayIdx: number; aMin: number; bMin: number }
  | { kind: 'move'; id: string; dayIdx: number; aMin: number; durMin: number; grabOffset: number }
  | { kind: 'resize'; id: string; dayIdx: number; topMin: number; bMin: number };

export function WeekGrid({ days, events, onCreateAt, onCreateRange, onCreateAllDay, onMove, onOpen }: {
  days: Date[];
  events: CalEvent[];
  onCreateAt: (date: string, time: string) => void;
  onCreateRange: (date: string, start: string, end: string) => void;
  onCreateAllDay: (date: string) => void;
  onMove: (id: string, startsAt: string, endsAt: string) => void;
  onOpen: (e: CalEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });

  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const moved = useRef(false);
  const set = (d: Drag | null) => { dragRef.current = d; setDrag(d); };

  useEffect(() => {
    const tick = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (nowMin / 60) * HOUR_H - HOUR_H * 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = localISODate(new Date(e.starts_at));
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(e);
  }
  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;
  const hasToday = days.some((d) => isToday(d));

  // One faint wash only: today gets a whisper of ink. (Weekend tints made the
  // canvas read banded/dirty — a calm calendar is an even surface.)
  const colWash = (d: Date) => (isToday(d) ? 'var(--color-surface-row)' : 'transparent');

  // ── Pointer geometry ──
  const minAt = (clientY: number, dayIdx: number) => {
    const rect = colRefs.current[dayIdx]?.getBoundingClientRect();
    if (!rect) return 0;
    const raw = ((clientY - rect.top) / HOUR_H) * 60;
    return Math.max(0, Math.min(1440, Math.round(raw / SNAP) * SNAP));
  };
  const dayIdxAtX = (clientX: number) => {
    for (let i = 0; i < days.length; i++) {
      const r = colRefs.current[i]?.getBoundingClientRect();
      if (r && clientX >= r.left && clientX <= r.right) return i;
    }
    return null;
  };

  function begin(d: Drag) {
    moved.current = false;
    set(d);
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
  }
  function onWinMove(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'create') {
      const m = minAt(e.clientY, d.dayIdx);
      if (m !== d.bMin) moved.current = true;
      set({ ...d, bMin: m });
    } else if (d.kind === 'move') {
      const ni = dayIdxAtX(e.clientX) ?? d.dayIdx;
      let top = minAt(e.clientY, ni) - d.grabOffset;
      top = Math.max(0, Math.min(1440 - d.durMin, Math.round(top / SNAP) * SNAP));
      if (ni !== d.dayIdx || top !== d.aMin) moved.current = true;
      set({ ...d, dayIdx: ni, aMin: top });
    } else {
      const m = Math.max(d.topMin + SNAP, minAt(e.clientY, d.dayIdx));
      if (m !== d.bMin) moved.current = true;
      set({ ...d, bMin: m });
    }
  }
  function onWinUp() {
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    const d = dragRef.current;
    set(null);
    if (!d) return;
    if (d.kind === 'create') {
      const key = localISODate(days[d.dayIdx]);
      if (moved.current) {
        const a = Math.min(d.aMin, d.bMin), b = Math.max(d.aMin, d.bMin);
        onCreateRange(key, hhmm(a), hhmm(Math.max(a + SNAP, b)));
      } else onCreateAt(key, hhmm(d.aMin));
    } else if (d.kind === 'move') {
      const ev = events.find((x) => x.id === d.id);
      if (moved.current) {
        const key = localISODate(days[d.dayIdx]);
        onMove(d.id, isoFromLocal(key, hhmm(d.aMin)), isoFromLocal(key, hhmm(d.aMin + d.durMin)));
      } else if (ev) onOpen(ev);
    } else {
      const ev = events.find((x) => x.id === d.id);
      if (moved.current && ev) {
        const key = localISODate(new Date(ev.starts_at));
        onMove(d.id, ev.starts_at, isoFromLocal(key, hhmm(d.bMin)));
      } else if (ev) onOpen(ev);
    }
  }

  const draggingId = drag?.kind === 'move' ? drag.id : drag?.kind === 'resize' ? drag.id : null;

  // Calm, Notion-style event hover: a subtle darken, no lift/scale/saturation.
  const EVENT_HOVER = 'transition-[filter] duration-fast hover:brightness-95 hover:z-[3]';

  return (
    <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto', drag && 'select-none')}>
      {/* Day headers — sticky inside the one shared scroller, so the header and
          grid columns share the same scrollbar and can never drift out of
          alignment. "Sun 5", today's date in an ink pill; GMT labels the gutter. */}
      <div className="sticky top-0 z-10 grid border-b border-line-strong bg-paper-2" style={{ gridTemplateColumns: cols }}>
        <div className="flex h-10 items-center justify-end border-r border-line-soft px-2 text-caption text-ink-500">GMT</div>
        {days.map((d, i) => {
          const today = isToday(d);
          return (
            <div key={localISODate(d)} className="flex h-10 items-center gap-1.5 px-3" style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--color-line-soft)', background: colWash(d) }}>
              <span className={cn('text-ui font-medium', today ? 'text-ink-900' : 'text-ink-600')}>{WEEKDAYS[d.getDay()]}</span>
              <span className={cn('inline-grid h-[22px] min-w-[22px] place-items-center rounded-full text-ui tabular-nums', today ? 'bg-ink-900 font-semibold text-onsolid' : 'font-medium text-ink-900')}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* All-day lane — sticky just below the header (top = header 40 + 1px border) */}
      <div className="sticky top-[41px] z-[9] grid min-h-8 border-b border-line-strong bg-paper-2" style={{ gridTemplateColumns: cols }}>
        <div className="border-r border-line-soft pr-2 pt-2 text-right text-caption text-ink-500">All day</div>
        {days.map((d, i) => {
          const key = localISODate(d);
          const allDay = (byDate.get(key) ?? []).filter((e) => e.all_day);
          return (
            <div key={key} onClick={() => onCreateAllDay(key)} className="flex cursor-pointer flex-col gap-[3px] p-[5px]" style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--color-line-soft)', background: colWash(d) }}>
              {allDay.map((e) => {
                const t = evColor(e);
                return (
                  <button key={e.id} onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
                    className={cn('relative cursor-pointer truncate rounded-md py-1 pl-3 pr-2 text-left text-meta font-medium', EVENT_HOVER)}
                    style={{ background: t.bg, color: t.text }}>
                    <span aria-hidden className="absolute inset-y-1 left-1 w-[3.5px] rounded-full" style={{ background: t.bar }} />
                    {e.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid" style={{ gridTemplateColumns: cols }}>
        {/* Hour gutter — labels sit on the hour lines; the label nearest the
            now chip yields so the two never collide. */}
        <div className="relative border-r border-line-soft" style={{ height: DAY_H }}>
          {Array.from({ length: 24 }, (_, h) => h > 0 && !(hasToday && Math.abs(h * 60 - nowMin) < 20) && (
            <div key={h} className="absolute right-2 whitespace-nowrap text-caption text-ink-500" style={{ top: h * HOUR_H - 8 }}>{`${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`}</div>
          ))}
          {/* Now chip — flush to the gutter's right edge so its right edge meets
              the now line at the same Y: the pill + line read as one connected
              marker (the Notion idiom). */}
          {hasToday && (
            <span className="absolute right-0 z-[5] whitespace-nowrap rounded-full bg-ink-900 px-1.5 py-0.5 text-caption font-semibold tabular-nums text-onsolid" style={{ top: (nowMin / 60) * HOUR_H - 10 }}>{fmtNow(nowMin)}</span>
          )}
        </div>
        {days.map((d, idx) => {
          const key = localISODate(d);
          const timed = (byDate.get(key) ?? []).filter((e) => !e.all_day);
          const laid = layoutDay(timed);
          const today = isToday(d);
          const ghost = drag && drag.dayIdx === idx
            ? (drag.kind === 'create'
                ? { top: Math.min(drag.aMin, drag.bMin), bottom: Math.max(drag.aMin, drag.bMin) }
                : drag.kind === 'move'
                  ? { top: drag.aMin, bottom: drag.aMin + drag.durMin }
                  : { top: drag.topMin, bottom: drag.bMin })
            : null;
          return (
            <div key={key} ref={(el) => { colRefs.current[idx] = el; }}
              onPointerDown={(e) => { if (e.button !== 0) return; const m = minAt(e.clientY, idx); begin({ kind: 'create', dayIdx: idx, aMin: m, bMin: m + SNAP }); }}
              className="relative cursor-pointer" style={{ height: DAY_H, borderLeft: idx === 0 ? 'none' : '1px solid var(--color-line-soft)', background: colWash(d) }}>
              {Array.from({ length: 24 }, (_, h) => h > 0 && (
                <div key={h} className="absolute inset-x-0 border-t border-line-soft" style={{ top: h * HOUR_H }} />
              ))}
              {laid.map(({ e, lane, lanes }) => {
                const top = (minutesOfDay(e.starts_at) / 60) * HOUR_H;
                const h = Math.max(22, ((endMinutes(e) - minutesOfDay(e.starts_at)) / 60) * HOUR_H - 2);
                const t = evColor(e);
                const w = 100 / lanes;
                return (
                  <div key={e.id}
                    onPointerDown={(ev) => {
                      if (ev.button !== 0) return;
                      ev.stopPropagation();
                      const s = minutesOfDay(e.starts_at);
                      begin({ kind: 'move', id: e.id, dayIdx: idx, aMin: s, durMin: endMinutes(e) - s, grabOffset: minAt(ev.clientY, idx) - s });
                    }}
                    title={e.title}
                    className={cn('absolute overflow-hidden rounded-md py-1 pl-3 pr-2 text-left', EVENT_HOVER)}
                    style={{ top, height: h, left: `calc(${lane * w}% + 2px)`, width: `calc(${w}% - 4px)`,
                      cursor: drag?.kind === 'move' ? 'grabbing' : 'grab',
                      background: t.bg, color: t.text,
                      boxShadow: '0 0 0 1.5px var(--color-paper-2)',
                      opacity: draggingId === e.id ? 0.35 : 1, zIndex: 2 }}>
                    <span aria-hidden className="absolute inset-y-1 left-1 w-[3.5px] rounded-full" style={{ background: t.bar }} />
                    <div className="truncate text-ui font-medium tracking-[-0.005em]">{e.title}</div>
                    {h > 36 && <div className="mt-px text-caption tabular-nums opacity-75">{fmtTime(e.starts_at)}{e.ends_at ? ` – ${fmtTime(e.ends_at)}` : ''}</div>}
                    {/* resize handle */}
                    <div onPointerDown={(ev) => { if (ev.button !== 0) return; ev.stopPropagation(); const s = minutesOfDay(e.starts_at); begin({ kind: 'resize', id: e.id, dayIdx: idx, topMin: s, bMin: endMinutes(e) }); }}
                      className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize" />
                  </div>
                );
              })}
              {/* Drag ghost — a real event card in the default color, so the
                  preview and the created event look identical. */}
              {ghost && (() => {
                const g = eventTokens(null);
                const gh = Math.max(22, ((ghost.bottom - ghost.top) / 60) * HOUR_H - 2);
                return (
                  <div className="absolute inset-x-0.5 z-[6] overflow-hidden rounded-md py-1 pl-3 pr-2"
                    style={{ top: (ghost.top / 60) * HOUR_H, height: gh, background: g.bg, color: g.text, boxShadow: '0 0 0 1.5px var(--color-paper-2), var(--shadow-lift-2)', pointerEvents: 'none' }}>
                    <span aria-hidden className="absolute inset-y-1 left-1 w-[3.5px] rounded-full" style={{ background: g.bar }} />
                    <div className="truncate text-ui font-medium">New event</div>
                    {gh > 36 && <div className="mt-px text-caption tabular-nums opacity-75">{fmtMinTime(ghost.top)} – {fmtMinTime(ghost.bottom)}</div>}
                  </div>
                );
              })()}
              {/* Now line — solid on today only, with a left-edge dot (the
                  Google/Notion calendar idiom; a cross-week line read as noise) */}
              {today && (
                <div className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-ink-900" style={{ top: (nowMin / 60) * HOUR_H - 1 }}>
                  <span aria-hidden className="absolute -left-1 -top-[3px] size-2 rounded-full bg-ink-900" />
                </div>
              )}
            </div>
          );
        })}
        {/* One continuous now-line across all day columns (subtle). With the
            gutter pill (left) and the stronger ink-900 segment + dot in today's
            column, the three read as a single marker spanning the whole grid —
            starting at the pill's right edge, exactly like the Notion reference. */}
        {hasToday && (
          <div className="pointer-events-none absolute z-[3] h-px" style={{ left: GUTTER - 1, right: 0, top: (nowMin / 60) * HOUR_H - 0.5, background: 'var(--color-ink-500)' }} />
        )}
      </div>
    </div>
  );
}
