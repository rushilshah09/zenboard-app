'use client';
// The timeline — a database's pages as bars across time (database brief §6, after
// Notion's Timeline view; plan T9). A bar runs from a page's start date to its end
// date; drag it to move the page in time, drag an edge to change one date, click it
// to open the page the way the view opens pages (side peek).
//
// The arithmetic — days, the axis, where a bar sits, what a drag writes — is
// lib/timeline.ts, pure and tested. This file draws it and follows the pointer.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Plus } from '@/components/ds/icons';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Icon,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { fmtCellDate, type DbRow, type PropDef, type ViewDef } from '@/lib/collections';
import { dayKeyOf } from '@/lib/calendar-grid';
import { formatMonth, formatMonthYear } from '@/lib/date';
import { bleed } from '@/lib/bleed';
import { hasBody } from '@/lib/blocks';
import {
  DAY_PX, TIMELINE_ZOOMS, ZOOM_LABEL, axisTicks, barBox, dayAt, dayFromNumber, dayNumber, dragSpan, rowSpan,
  spanPatch, timelineProps, timelineRange, type TimelineZoom,
} from '@/lib/timeline';

type Span = { start: number; end: number };
type Grip = 'move' | 'start' | 'end';
type Drag = { rowId: string; span: Span; grip: Grip; x0: number; moved: boolean; delta: number };

const ROW_H = 40;
const AXIS_H = 48;
/** A bar narrower than this carries its name beside it rather than inside. */
const NAME_INSIDE_MIN = 96;

export interface DatabaseTimelineProps {
  rows: DbRow[];
  props: PropDef[];
  view: ViewDef;
  onOpen: (rowId: string) => void;
  onPatchRow: (rowId: string, patch: { data: Record<string, unknown> }) => void;
  onPatchView: (patch: Partial<ViewDef>) => void;
  /** Make a page, dated today. */
  onAdd: (data: Record<string, unknown>) => void;
  /** A database with no date property yet: add one and read the timeline by it. */
  onAddDate: () => void;
  tint?: (row: DbRow) => string | undefined;
}

export function DatabaseTimeline({ rows, props, view, onOpen, onPatchRow, onPatchView, onAdd, onAddDate, tint }: DatabaseTimelineProps) {
  const dateProps = props.filter((p) => p.type === 'date');
  const { start: startProp, end: endProp } = timelineProps(view, dateProps);
  const zoom: TimelineZoom = view.zoom ?? 'month';
  const px = DAY_PX[zoom];
  const today = dayNumber(dayKeyOf(new Date()))!;

  const placed = useMemo(() => rows.flatMap((r) => {
    const span = startProp ? rowSpan(r, startProp, endProp) : null;
    return span ? [{ row: r, span }] : [];
  }), [rows, startProp, endProp]);
  const undated = startProp ? rows.filter((r) => !rowSpan(r, startProp, endProp)) : [];
  const { origin, days } = useMemo(() => timelineRange(placed.map((p) => p.span), today, zoom), [placed, today, zoom]);
  const axis = useMemo(() => axisTicks(origin, days, zoom, (day) => formatMonth(day + 'T12:00:00') ?? ''), [origin, days, zoom]);

  // ── Scrolling: today in view on arrival and on zoom, the month under the eye named ──
  const scroller = useRef<HTMLDivElement | null>(null);
  const setScroller = useCallback((el: HTMLDivElement | null) => { scroller.current = el; return bleed(el); }, []);
  const [focusDay, setFocusDay] = useState(today);
  const inset = () => parseFloat(scroller.current ? getComputedStyle(scroller.current).paddingInlineStart : '0') || 0;
  const scrollToDay = useCallback((day: number, behavior: ScrollBehavior = 'auto') => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, (day - origin) * px - el.clientWidth * 0.3 + inset()), behavior });
  }, [origin, px]);
  const landed = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = `${view.id}:${zoom}`;
    if (landed.current === key) return;
    landed.current = key;
    scrollToDay(focusDay);
  }, [view.id, zoom, focusDay, scrollToDay]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) setFocusDay(dayAt(el.scrollLeft + el.clientWidth * 0.3 - inset(), origin, zoom));
  };

  // ── Dragging a bar ──
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ rowId: string; span: Span } | null>(null);
  const grab = (e: React.PointerEvent, row: DbRow, span: Span, grip: Grip) => {
    // A finger scrolls the timeline; dates are changed on the page itself.
    if (e.button !== 0 || e.pointerType === 'touch') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { rowId: row.id, span, grip, x0: e.clientX, moved: false, delta: 0 };
  };
  const follow = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    const delta = Math.round(dx / px);
    if (delta === d.delta && preview) return;
    d.delta = delta;
    setPreview({ rowId: d.rowId, span: dragSpan(d.span, delta, d.grip) });
  };
  const release = (row: DbRow) => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d || !startProp) return;
    if (!d.moved) { if (d.grip === 'move') onOpen(row.id); return; }
    if (d.delta !== 0) onPatchRow(row.id, { data: spanPatch(row, dragSpan(d.span, d.delta, d.grip), startProp, endProp) });
  };
  const nudge = (e: React.KeyboardEvent, row: DbRow, span: Span) => {
    if (!startProp || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    const grip: Grip = e.shiftKey && endProp ? 'end' : 'move';
    onPatchRow(row.id, { data: spanPatch(row, dragSpan(span, delta, grip), startProp, endProp) });
  };

  if (!startProp) {
    return (
      <div className="flex flex-wrap items-center gap-2 py-2 text-ui text-ink-500">
        A timeline places pages by a date.
        <Button variant="secondary" size="xs" onClick={onAddDate}>Add a date property</Button>
      </div>
    );
  }

  const width = days * px;
  return (
    <div>
      {/* The timeline's own bar: where you are, how much time shows, and the way home */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-ui font-medium text-ink-900">{formatMonthYear(dayFromNumber(focusDay) + 'T12:00:00', { long: true })}</span>
        <span className="flex-1" />
        {undated.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs">{undated.length} without {undated.length === 1 ? 'a date' : 'dates'}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {undated.map((r) => (
                <DropdownMenuItem key={r.id} icon={<Icon icon={FileText} size={16} />} onSelect={() => onOpen(r.id)}>{r.title || 'Untitled'}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" aria-label={`Zoom: ${ZOOM_LABEL[zoom]}`}>
              {ZOOM_LABEL[zoom]}<Icon icon={ChevronDown} size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {TIMELINE_ZOOMS.map((z) => (
              <DropdownMenuItem key={z} active={z === zoom} onSelect={() => { landed.current = null; onPatchView({ zoom: z }); }}>{ZOOM_LABEL[z]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="secondary" size="xs" onClick={() => scrollToDay(today, 'smooth')}>Today</Button>
      </div>

      <div ref={setScroller} onScroll={onScroll} className="bleed-x scrollbar-quiet overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width, minHeight: AXIS_H + Math.max(placed.length, 1) * ROW_H + ROW_H }} data-timeline>
          {/* Axis: the months, then the finer marks the zoom has room for */}
          <div className="relative border-b border-line-soft" style={{ height: AXIS_H }}>
            {axis.months.map((m) => (
              <span key={`m${m.day}`} className="absolute top-0 flex h-6 items-center truncate border-l border-line-soft pl-1.5 text-meta font-medium text-ink-700" style={{ left: m.left, width: m.width }}>
                {m.label}
              </span>
            ))}
            {axis.cells.map((c) => (
              <span key={`c${c.day}`} className={cn('absolute top-6 flex h-6 items-center text-meta', zoom === 'week' ? 'justify-center' : 'pl-1', c.day === today ? 'font-semibold text-ink-900' : 'text-ink-500')}
                style={{ left: c.left, width: c.width }}>
                {c.label}
              </span>
            ))}
          </div>
          {/* The ground: weekends at Week zoom, a hairline at each week or month */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: AXIS_H }}>
            {zoom === 'week'
              ? axis.cells.filter((c) => c.weekend).map((c) => <span key={c.day} className="absolute inset-y-0 bg-surface-hover" style={{ left: c.left, width: c.width }} />)
              : axis.cells.map((c) => <span key={c.day} className="absolute inset-y-0 border-l border-line-soft" style={{ left: c.left }} />)}
            <span className="absolute inset-y-0 w-px bg-accent" style={{ left: (today - origin) * px + px / 2 }} />
          </div>
          <span aria-hidden className="absolute size-2 -translate-x-1/2 rounded-full bg-accent" style={{ left: (today - origin) * px + px / 2 + 0.5, top: AXIS_H - 4 }} />

          {/* One row per dated page */}
          {placed.map(({ row, span }, i) => {
            const shown = preview?.rowId === row.id ? preview.span : span;
            const box = barBox(shown, origin, zoom);
            const dragging = preview?.rowId === row.id;
            const inside = box.width >= NAME_INSIDE_MIN;
            const title = row.title || 'Untitled';
            const label = `${title}, ${fmtCellDate(dayFromNumber(shown.start))}${shown.end !== shown.start ? ` to ${fmtCellDate(dayFromNumber(shown.end))}` : ''}`;
            return (
              <div key={row.id} className="absolute inset-x-0" style={{ top: AXIS_H + i * ROW_H, height: ROW_H }}>
                <button
                  type="button"
                  aria-label={label}
                  title={label}
                  data-timeline-bar={row.id}
                  onPointerDown={(e) => grab(e, row, span, 'move')}
                  onPointerMove={follow}
                  onPointerUp={() => release(row)}
                  onPointerCancel={() => { drag.current = null; setPreview(null); }}
                  onClick={(e) => { if (e.detail === 0) onOpen(row.id); }}
                  onKeyDown={(e) => nudge(e, row, span)}
                  className={cn(
                    'focus-ring group/bar absolute top-1.5 flex h-7 touch-manipulation items-center gap-1.5 rounded-md border border-line-soft bg-surface-raised px-2 text-left shadow-xs transition-shadow duration-fast hover:wash-over',
                    dragging ? 'z-10 cursor-grabbing shadow-lift-2' : 'cursor-grab',
                  )}
                  style={{ left: box.left, width: Math.max(box.width, px), ...(tint?.(row) ? { background: tint(row) } : {}) }}
                >
                  {inside && hasBody(row.content) && <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />}
                  {inside && <span className="min-w-0 truncate text-ui font-medium text-ink-900">{title}</span>}
                  {endProp && (
                    <>
                      <span aria-hidden onPointerDown={(e) => grab(e, row, span, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-s-md" />
                      <span aria-hidden onPointerDown={(e) => grab(e, row, span, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-e-md" />
                    </>
                  )}
                </button>
                {!inside && (
                  <span aria-hidden className="pointer-events-none absolute top-1.5 flex h-7 items-center truncate text-ui text-ink-700" style={{ left: box.left + Math.max(box.width, px) + 8, maxWidth: 240 }}>
                    {title}
                  </span>
                )}
              </div>
            );
          })}

          {/* New page, dated today — pinned to the left of what is on screen */}
          <div className="absolute" style={{ top: AXIS_H + placed.length * ROW_H + 4, left: 0, right: 0 }}>
            <button type="button" onClick={() => onAdd({ [startProp]: dayKeyOf(new Date()) })}
              className="focus-ring sticky flex h-8 items-center gap-1.5 rounded-md px-2 text-ui text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800"
              style={{ left: 'var(--bleed-start, 0px)' }}>
              <Icon icon={Plus} size={16} /> New page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
