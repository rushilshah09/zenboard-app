'use client';
// Mini-month navigator — jump to any date, or click-and-drag to select a
// continuous date range (forward or backward, across week rows). The range reads
// as one connected component: ink endpoints joined by a soft neutral bar with
// rounded ends. A plain click (no drag) selects a single day. Token spacing,
// balanced neutral indicator. Weekday order follows the main grid.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from "@/components/ds/icons";
import { Icon, IconButton } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { MONTHS, WEEKDAYS, monthCells, addMonths, addDays, startOfDay, localISODate, isToday, sameDay } from '@/lib/calendar';

export type DateRange = { start: Date; end: Date };
const MAX_RANGE = 21; // days — keeps the resulting range view usable
const dayNum = (d: Date) => startOfDay(d).getTime();

export function MiniMonth({ selected, onPick, range, onSelectRange }: {
  selected: Date;
  onPick: (d: Date) => void;
  range?: DateRange | null;
  onSelectRange?: (start: Date, end: Date) => void;
}) {
  const [month, setMonth] = useState<Date>(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  useEffect(() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); }, [selected]);

  const cells = monthCells(month);
  const m = month.getMonth();

  // ── Drag-to-select ──
  const [drag, setDrag] = useState<{ anchor: Date; head: Date } | null>(null);
  const dragRef = useRef<{ anchor: Date; head: Date } | null>(null);
  const moved = useRef(false);
  const cellRefs = useRef<Record<string, HTMLElement | null>>({});
  const set = (d: { anchor: Date; head: Date } | null) => { dragRef.current = d; setDrag(d); };

  const dayAt = (x: number, y: number): Date | null => {
    for (const k in cellRefs.current) {
      const el = cellRefs.current[k];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return new Date(`${k}T00:00:00`);
    }
    return null;
  };

  function onMove(e: PointerEvent) {
    const cur = dragRef.current;
    if (!cur) return;
    const d = dayAt(e.clientX, e.clientY);
    if (d && !sameDay(d, cur.head)) { moved.current = true; set({ ...cur, head: d }); }
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    const cur = dragRef.current;
    set(null);
    if (!cur) return;
    if (moved.current && onSelectRange) {
      let a = cur.anchor, b = cur.head;
      if (dayNum(a) > dayNum(b)) [a, b] = [b, a];
      const span = Math.round((dayNum(b) - dayNum(a)) / 86400000);
      if (span > MAX_RANGE - 1) b = addDays(a, MAX_RANGE - 1);
      onSelectRange(a, b);
    } else {
      onPick(cur.anchor);
    }
  }
  function begin(d: Date) {
    moved.current = false;
    set({ anchor: d, head: d });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Active range for rendering: a live drag wins over the persistent selection.
  const active: DateRange | null = drag
    ? (dayNum(drag.anchor) <= dayNum(drag.head) ? { start: drag.anchor, end: drag.head } : { start: drag.head, end: drag.anchor })
    : (range ?? null);
  const isRange = !!active && dayNum(active.start) !== dayNum(active.end);

  return (
    <div className={cn('w-full', drag && 'select-none')}>
      {/* Header */}
      <div className="mb-2.5 flex items-center gap-1">
        <IconButton size="xs" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} label="Previous month" icon={<Icon icon={ChevronLeft} size={14} weight="bold" />} />
        <div className="flex-1 whitespace-nowrap text-center text-ui font-semibold tracking-[-0.01em] text-ink-900">
          {MONTHS[m]} {month.getFullYear()}
        </div>
        <IconButton size="xs" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} label="Next month" icon={<Icon icon={ChevronRight} size={14} weight="bold" />} />
      </div>

      {/* Weekday labels */}
      <div className="mb-0.5 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-caption font-medium text-ink-500">{w.slice(0, 2)}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const iso = localISODate(d);
          const inMonth = d.getMonth() === m;
          const today = isToday(d);
          const col = d.getDay();
          const rng = !!active && dayNum(d) >= dayNum(active.start) && dayNum(d) <= dayNum(active.end);
          const isStart = !!active && sameDay(d, active.start);
          const isEnd = !!active && sameDay(d, active.end);
          const endpoint = isRange ? (isStart || isEnd) : (!!active && rng); // single-day range → the one dot
          const selSingle = !active && sameDay(d, selected);
          const dot = endpoint || selSingle;

          // Connecting bar geometry (only for a true multi-day range)
          const showBar = isRange && rng;
          const leftRound = isStart || col === 0;
          const rightRound = isEnd || col === 6;

          return (
            <button key={iso} type="button" ref={(el) => { cellRefs.current[iso] = el; }}
              onPointerDown={(e) => { if (e.button !== 0) return; begin(d); }}
              aria-label={d.toDateString()}
              className="group relative grid h-[30px] place-items-center">
              {showBar && (
                <span aria-hidden className="absolute inset-y-[3px] bg-surface-selected"
                  style={{ left: isStart ? '50%' : 0, right: isEnd ? '50%' : 0,
                    borderTopLeftRadius: leftRound ? '9999px' : 0, borderBottomLeftRadius: leftRound ? '9999px' : 0,
                    borderTopRightRadius: rightRound ? '9999px' : 0, borderBottomRightRadius: rightRound ? '9999px' : 0 }} />
              )}
              <span className={cn(
                'relative grid size-6 place-items-center rounded-full text-meta tabular-nums transition-colors duration-fast',
                dot || today ? 'font-semibold' : 'font-normal',
                dot ? 'bg-ink-900 text-onsolid' : rng ? 'text-ink-800' : !inMonth ? 'text-ink-500' : today ? 'text-ink-900' : 'text-ink-800',
                today && !dot && !rng && 'ring-[1.5px] ring-inset ring-line-strong',
                !dot && 'group-hover:bg-surface-hover',
              )}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
