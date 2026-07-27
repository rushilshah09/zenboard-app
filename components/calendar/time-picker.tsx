'use client';
// Custom time picker — a Zenboard-native replacement for the browser's default
// <input type="time"> popover, in Notion's idiom: a pill trigger opens a single
// scrolling list of 15-minute times. For an end time (`durationFrom` set), each
// row also shows the resulting duration ("1h 45min"), so picking a length is
// one glance. Tokens throughout: paper-2 surface, neutral selected rows, calm
// hover. Value is HH:MM (24-hour).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from "@/lib/cn";
import { fmtMinTime } from '@/lib/calendar';

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

function durLabel(delta: number): string {
  let d = delta; if (d <= 0) d += 1440; // wrap past midnight (overnight events)
  const h = Math.floor(d / 60), m = d % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Every 15 minutes across the day.
const OPTIONS = Array.from({ length: 96 }, (_, i) => i * 15);

export function TimePicker({ value, disabled, onChange, durationFrom }: {
  value: string; disabled?: boolean; onChange: (t: string) => void; durationFrom?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cur = toMin(value);
  const startMin = durationFrom != null ? toMin(durationFrom) : null;

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('mousedown', fn);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('mousedown', fn); window.removeEventListener('keydown', key, true); };
  }, [open]);

  // Center the current value when opening.
  useLayoutEffect(() => {
    if (!open) return;
    const el = list.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    if (el && list.current) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + 15;
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-flex">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className={cn(
          'focus-ring inline-flex h-[26px] items-center rounded-sm border bg-paper-2 px-2 tabular-nums transition-colors duration-fast',
          open ? 'border-ink-400' : 'border-line-strong',
          disabled ? 'cursor-default' : 'cursor-pointer',
        )}>
        <span className="whitespace-nowrap text-meta text-ink-900">{fmtMinTime(cur)}</span>
      </button>
      {open && (
        <div ref={list} className="absolute left-0 top-[30px] z-40 max-h-[244px] overflow-y-auto rounded-lg border border-line-strong bg-paper-2 p-2 shadow-lift-2 animate-emerge"
          style={{ width: startMin != null ? 176 : 132 }}>
          {OPTIONS.map((min) => {
            const on = min === cur;
            return (
              <button key={min} type="button" data-active={on} onClick={() => { onChange(hhmm(min)); setOpen(false); }}
                className={cn('flex h-[30px] w-full items-center gap-2 rounded-sm px-2', on ? 'bg-ink-900' : 'hover:bg-surface-hover')}>
                <span className={cn('flex-1 text-left text-meta tabular-nums', on ? 'font-semibold text-onsolid' : 'text-ink-800')}>{fmtMinTime(min)}</span>
                {startMin != null && <span className={cn('text-caption', on ? 'text-onsolid opacity-70' : 'text-ink-500')}>{durLabel(min - startMin)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
