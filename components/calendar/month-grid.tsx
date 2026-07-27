'use client';
// Month view — a 6×7 grid of day cells with event chips, on the white panel
// canvas. Pointer interactions mirror the time grid: press an empty day →
// create; press a chip → open; drag a chip onto another day → move it there
// (preserving time-of-day, duration, and all-day-ness). A click is
// distinguished from a drag by whether the pointer crossed into another cell.
//
// Color semantic (consistent app-wide): plum accent = Zenboard events,
// blue = synced Google events.
import { useRef, useState } from 'react';
import { cn } from "@/lib/cn";
import { type CalEvent, WEEKDAYS, monthCells, localISODate, isToday, fmtTime, addDays } from '@/lib/calendar';
import { eventTokens } from '@/lib/event-color';

type Drag =
  | { kind: 'create'; key: string }
  | { kind: 'move'; e: CalEvent; fromKey: string; overKey: string };

export function MonthGrid({ anchor, events, onCreateOn, onMove, onOpen, onMore }: {
  anchor: Date;
  events: CalEvent[];
  onCreateOn: (date: string) => void;
  onMove: (id: string, startsAt: string, endsAt: string | null, allDay: boolean) => void;
  onOpen: (e: CalEvent) => void;
  onMore?: (date: string) => void;
}) {
  const cells = monthCells(anchor);
  const month = anchor.getMonth();

  // Bucket events by local date; sort all-day first, then by start.
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = localISODate(new Date(e.starts_at));
    const arr = byDate.get(key) ?? [];
    arr.push(e);
    byDate.set(key, arr);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => (a.all_day !== b.all_day ? (a.all_day ? -1 : 1) : a.starts_at.localeCompare(b.starts_at)));
  }

  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const moved = useRef(false);
  const set = (d: Drag | null) => { dragRef.current = d; setDrag(d); };

  const keyAt = (x: number, y: number): string | null => {
    for (const k in cellRefs.current) {
      const el = cellRefs.current[k];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return k;
    }
    return null;
  };

  function begin(d: Drag) {
    moved.current = false;
    set(d);
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
  }
  function onWinMove(ev: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const k = keyAt(ev.clientX, ev.clientY);
    if (d.kind === 'create') {
      if (k && k !== d.key) moved.current = true;
    } else {
      if (k && k !== d.overKey) {
        if (k !== d.fromKey) moved.current = true;
        set({ ...d, overKey: k });
      }
    }
  }
  function onWinUp() {
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    const d = dragRef.current;
    set(null);
    if (!d) return;
    if (d.kind === 'create') {
      if (!moved.current) onCreateOn(d.key);
    } else if (moved.current && d.overKey !== d.fromKey) {
      const delta = Math.round(
        (new Date(`${d.overKey}T00:00:00`).getTime() - new Date(`${d.fromKey}T00:00:00`).getTime()) / 86400000,
      );
      const ns = addDays(new Date(d.e.starts_at), delta);
      const ne = d.e.ends_at ? addDays(new Date(d.e.ends_at), delta) : null;
      onMove(d.e.id, ns.toISOString(), ne ? ne.toISOString() : null, d.e.all_day);
    } else {
      onOpen(d.e);
    }
  }

  const overKey = drag?.kind === 'move' ? drag.overKey : null;
  const dragId = drag?.kind === 'move' ? drag.e.id : null;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', drag && 'select-none')}>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-line-strong">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-3 pb-1.5 pt-2 text-left text-overline uppercase text-ink-600">{w.toUpperCase()}</div>
        ))}
      </div>
      {/* 6 weeks */}
      <div className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto" style={{ gridAutoRows: 'minmax(104px, 1fr)' }}>
        {cells.map((d, i) => {
          const key = localISODate(d);
          const inMonth = d.getMonth() === month;
          const today = isToday(d);
          const dayEvents = byDate.get(key) ?? [];
          const shown = dayEvents.slice(0, 3);
          const extra = dayEvents.length - shown.length;
          const isOver = overKey === key && overKey !== (drag?.kind === 'move' ? drag.fromKey : null);
          return (
            <div key={key} ref={(el) => { cellRefs.current[key] = el; }}
              onPointerDown={(e) => { if (e.button !== 0) return; begin({ kind: 'create', key }); }}
              className={cn(
                'flex min-h-[104px] cursor-pointer flex-col gap-[3px] overflow-hidden px-1.5 pb-2 pt-1.5 transition-colors duration-instant',
                i % 7 !== 6 && 'border-r border-line-soft',
                i >= 7 && 'border-t border-line-soft',
                isOver ? 'bg-surface-selected ring-[1.5px] ring-inset ring-ink-500'
                  : today ? 'bg-surface-row'
                  : inMonth ? 'hover:bg-surface-hover'
                  : 'bg-paper-3/60 hover:bg-surface-hover',
              )}>
              <div className="flex justify-end pb-px">
                <span className={cn('grid h-[22px] min-w-[22px] place-items-center rounded-full text-meta tabular-nums',
                  today ? 'bg-ink-900 font-semibold text-onsolid' : inMonth ? 'font-medium text-ink-800' : 'font-medium text-ink-500')}>{d.getDate()}</span>
              </div>
              {shown.map((e) => (
                <Chip key={e.id} e={e} dragging={e.id === dragId}
                  onPointerDown={(ev) => { if (ev.button !== 0) return; ev.stopPropagation(); begin({ kind: 'move', e, fromKey: key, overKey: key }); }} />
              ))}
              {extra > 0 && (
                <button type="button"
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => { ev.stopPropagation(); onMore?.(key); }}
                  className="focus-ring self-start rounded-xs px-1.5 py-px text-caption font-medium text-ink-600 transition-colors hover:bg-paper-3 hover:text-ink-800">
                  +{extra} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ e, dragging, onPointerDown }: { e: CalEvent; dragging: boolean; onPointerDown: (ev: React.PointerEvent) => void }) {
  const c = eventTokens(e.color); // the event's own color (brand default), like the week grid
  return (
    <button type="button" onPointerDown={onPointerDown} title={e.title}
      className={cn('flex w-full cursor-grab items-center gap-1.5 overflow-hidden rounded-sm py-[2.5px] pl-1.5 pr-1.5 text-left text-caption font-medium transition-[filter] duration-fast hover:brightness-95', dragging && 'opacity-35')}
      style={{ borderLeft: `3px solid ${c.bar}`, background: c.bg, color: c.text }}>
      {!e.all_day && <span className="shrink-0 text-caption tabular-nums opacity-70">{fmtTime(e.starts_at).replace(':00', '').replace(' ', '').toLowerCase()}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}
