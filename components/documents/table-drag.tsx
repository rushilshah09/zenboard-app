'use client';
// Moving a table's rows and columns by hand (database plan T12, after Notion).
//
//   · A ROW moves by the ⋮⋮ in the margin to its left, shown while the row is
//     hovered. Drag it; click it for the row's menu (Open · Move up · Move down ·
//     Delete); from the keyboard, focus it and press ⌥↑ / ⌥↓, or Enter for the menu.
//   · A COLUMN moves by its header: drag it sideways. A click still opens the
//     header's own menu, because a press only becomes a drag after 4px.
//
// Nothing in the table shifts while something is carried. The DS drop line marks
// the gap it will land in — the gap nearest the pointer (lib/table-drag.ts) — and
// the DS ghost under the pointer names it: the same two marks a block dragged in a
// document draws. What a drop MEANS (a new order key, a new group value, a sort to
// clear first) is the table's to decide; this only says where.
import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NO_SETTLE } from '@/lib/drop-settle';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useSensor, useSensors, type Announcements, type DragStartEvent } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, GripVertical, Maximize2, Trash2, type IconType } from '@/components/ds/icons';
import {
  DragGhost, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropLine, Icon,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { keyGlyph } from '@/lib/platform';
import { columnGaps, moveBefore, nearestGap, rowGaps, rowLanding, type SectionBox } from '@/lib/table-drag';

type CarriedRow = { kind: 'row'; section: string; rowId: string; index: number; label: string };
type CarriedColumn = { kind: 'column'; id: string; label: string; icon: IconType };
type Carried = CarriedRow | CarriedColumn;
type RowTarget = { kind: 'row'; section: string; index: number };
type ColumnTarget = { kind: 'column'; beforeId: string | null };

// Hoisted: an inline options object defeats useSensor's memo.
const POINTER = { activationConstraint: { distance: 4 } };
/** How far outside the table a pointer may wander and still drop. */
const REACH = 48;

const DragState = createContext<{ carried: Carried | null; droppedAt: React.RefObject<number> }>({ carried: null, droppedAt: { current: 0 } });

export function TableDrag({ columns, onDropRow, onDropColumn, className, style, children }: {
  /** The shown columns' ids, in order — a column dropped where it already is is no move. */
  columns: string[];
  onDropRow: (rowId: string, from: { section: string; index: number }, to: { section: string; index: number }) => void;
  onDropColumn: (id: string, beforeId: string | null) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, POINTER));
  const root = useRef<HTMLDivElement>(null);
  const [carried, setCarried] = useState<Carried | null>(null);
  const [line, setLine] = useState<{ vertical: boolean; at: number } | null>(null);
  const target = useRef<RowTarget | ColumnTarget | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const droppedAt = useRef(0);
  // Whether the carried thing was last over a place it can go — read by the spoken
  // end of the drag, whichever order dnd-kit tells the drop and the words in.
  const willMove = useRef(false);

  // While something is carried, follow the pointer — and the page, which may scroll
  // under a still pointer — and put the line in the nearest gap. Rows and columns stay
  // put, so their live positions are the geometry.
  useEffect(() => {
    if (!carried) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const { x, y } = pointer.current;
      const away = x < box.left - REACH || x > box.right + REACH || y < box.top - REACH || y > box.bottom + REACH;
      let next: { vertical: boolean; at: number } | null = null;
      let aim: RowTarget | ColumnTarget | null = null;
      if (!away && carried.kind === 'row') {
        const gap = nearestGap(rowGaps(measureSections(root.current!)), y, (g) => g.y);
        const landing = gap && rowLanding(gap, carried);
        if (gap && landing) { next = { vertical: false, at: gap.y - box.top }; aim = { kind: 'row', ...landing }; }
      }
      if (!away && carried.kind === 'column') {
        const cells = [...root.current!.querySelectorAll<HTMLElement>('[data-column-cell]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.columnCell!, left: r.left, right: r.right };
        });
        const gap = nearestGap(columnGaps(cells), x, (g) => g.x);
        if (gap && moveBefore(columns, carried.id, gap.beforeId)) { next = { vertical: true, at: gap.x - box.left }; aim = { kind: 'column', beforeId: gap.beforeId }; }
      }
      target.current = aim;
      willMove.current = !!aim;
      setLine((prev) => (prev?.vertical === next?.vertical && prev?.at === next?.at ? prev : next));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    const onMove = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; schedule(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', schedule, { capture: true });
    };
  }, [carried, columns]);

  const onDragStart = (e: DragStartEvent) => {
    const act = e.activatorEvent as PointerEvent | null;
    pointer.current = { x: act?.clientX ?? 0, y: act?.clientY ?? 0 };
    target.current = null;
    willMove.current = false;
    setCarried((e.active.data.current as Carried | undefined) ?? null);
  };
  const finish = (drop: boolean) => {
    const was = carried;
    const aim = target.current;
    setCarried(null);
    setLine(null);
    target.current = null;
    droppedAt.current = Date.now();
    if (!drop || !was || !aim) return;
    if (was.kind === 'row' && aim.kind === 'row') onDropRow(was.rowId, { section: was.section, index: was.index }, { section: aim.section, index: aim.index });
    if (was.kind === 'column' && aim.kind === 'column') onDropColumn(was.id, aim.beforeId);
  };

  // Spoken in names; a pointer drag is the only drag here, so it says where it went.
  const nameOf = (data: unknown) => (data as Carried | undefined)?.label || 'Untitled';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.data.current)}.`,
    onDragOver: () => undefined,
    onDragMove: () => undefined,
    onDragEnd: ({ active }) => (willMove.current ? `${nameOf(active.data.current)} moved.` : `${nameOf(active.data.current)} put back.`),
    onDragCancel: ({ active }) => `Moving ${nameOf(active.data.current)} cancelled.`,
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onDragStart} onDragEnd={() => finish(true)} onDragCancel={() => finish(false)}
      // The page scrolls only in a row's direction, and only near its edge: dnd-kit's
      // default fifth of the screen scrolled a table away under a row aimed at its end.
      autoScroll={{ threshold: carried?.kind === 'column' ? { x: 0.1, y: 0 } : { x: 0, y: 0.08 } }}
      accessibility={{ announcements }}>
      <DragState.Provider value={{ carried, droppedAt }}>
        <div ref={root} className={cn('relative', className)} style={style} data-table-drag>
          {children}
          {line && (line.vertical
            ? <DropLine orientation="vertical" style={{ left: line.at - 1, top: 0, bottom: 0 }} />
            : <DropLine style={{ top: line.at - 1, left: 0, right: 0 }} />)}
        </div>
      </DragState.Provider>
      {/* What you hold here is a DragGhost chip naming the row or column, not
          the row itself — see NO_SETTLE. */}
      <DragOverlay dropAnimation={NO_SETTLE}>
        {carried && (
          <DragGhost label={carried.label || 'Untitled'}
            icon={<Icon icon={carried.kind === 'row' ? GripVertical : carried.icon} size={14} />} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * The table's rows as drawn, in sections: every element marked `data-section-head`
 * opens one (its bottom is where its rows start), every `data-row` belongs to the
 * section it names.
 */
function measureSections(root: HTMLElement): SectionBox[] {
  const sections: SectionBox[] = [];
  const byKey = new Map<string, SectionBox>();
  root.querySelectorAll<HTMLElement>('[data-section-head], [data-row]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (el.dataset.sectionHead !== undefined) {
      const s: SectionBox = { key: el.dataset.sectionHead, top: r.bottom, rows: [], collapsed: el.dataset.collapsed === 'true', count: Number(el.dataset.count ?? 0) };
      sections.push(s);
      byKey.set(s.key, s);
      return;
    }
    byKey.get(el.dataset.section ?? '')?.rows.push({ id: el.dataset.row!, top: r.top, bottom: r.bottom });
  });
  return sections;
}

/** The ⋮⋮ beside a row: drag it to move the row, click it for the row's menu. */
export function RowHandle({ section, rowId, index, count, label, onOpen, onMove, onDelete }: {
  section: string; rowId: string;
  /** Its place in its section, and how many rows the section has. */
  index: number; count: number;
  label: string;
  onOpen: () => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { carried, droppedAt } = useContext(DragState);
  const data: CarriedRow = { kind: 'row', section, rowId, index, label };
  const { setNodeRef, setActivatorNodeRef, listeners } = useDraggable({ id: `row:${section}:${rowId}`, data });
  const [menuOpen, setMenuOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const move = (by: -1 | 1) => {
    onMove(by);
    // The row may be re-inserted in its new place; the keyboard stays on its handle.
    requestAnimationFrame(() => button.current?.focus());
  };
  const moving = carried?.kind === 'row' && carried.rowId === rowId && carried.section === section;
  return (
    // In the margin left of the row (`bleed-x-handles` makes the room); a phone has none to give.
    <div data-row-handle data-carried={moving || undefined}
      className={cn('absolute bottom-0 right-full top-0 flex w-7 items-center justify-center max-sm:hidden', moving || menuOpen ? 'opacity-100' : 'reveal-on-hover')}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={(el) => { button.current = el; setNodeRef(el); setActivatorNodeRef(el); }}
            type="button"
            aria-label={`${label || 'Untitled'}: move or open actions`}
            title="Drag to move · click for actions"
            {...listeners}
            // The press is the drag's; the menu opens on a click that did not drag.
            onPointerDown={(e) => { listeners?.onPointerDown?.(e); e.preventDefault(); }}
            onClick={() => { if (Date.now() - droppedAt.current > 300) setMenuOpen(true); }}
            onKeyDown={(e) => {
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const by = e.key === 'ArrowUp' ? -1 : 1;
                if (index + by >= 0 && index + by < count) move(by);
              }
            }}
            className="focus-ring grid h-6 w-5 cursor-grab touch-none place-items-center rounded-xs text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-700 active:cursor-grabbing data-[state=open]:bg-surface-active data-[state=open]:text-ink-800"
          >
            <Icon icon={GripVertical} size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem icon={<Icon icon={Maximize2} size={16} />} onSelect={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem icon={<Icon icon={ArrowUp} size={16} />} keys={[keyGlyph('alt'), '↑']} disabled={index <= 0} onSelect={() => move(-1)}>Move up</DropdownMenuItem>
          <DropdownMenuItem icon={<Icon icon={ArrowDown} size={16} />} keys={[keyGlyph('alt'), '↓']} disabled={index >= count - 1} onSelect={() => move(1)}>Move down</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} onSelect={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * A header cell that moves its column: the header's own button is the handle, so a
 * press that travels is a drag and a press that does not is the header's click.
 * `label` is the button's face; `children` follow it (the header's menu).
 */
export function ColumnDragCell({ id, name, icon, style, buttonStyle, title, onClick, label, children }: {
  id: string; name: string; icon: IconType;
  style?: CSSProperties; buttonStyle?: CSSProperties; title?: string;
  onClick: () => void;
  label: ReactNode;
  children?: ReactNode;
}) {
  const { carried, droppedAt } = useContext(DragState);
  const data: CarriedColumn = { kind: 'column', id, label: name, icon };
  const { setNodeRef, setActivatorNodeRef, listeners } = useDraggable({ id: `column:${id}`, data });
  const isCarried = carried?.kind === 'column' && carried.id === id;
  return (
    <div ref={setNodeRef} data-column-cell={id} style={style}>
      <button ref={setActivatorNodeRef} type="button" {...listeners} title={title} data-carried={isCarried || undefined}
        // A drop that ends over the header it started on is not a click on it.
        onClick={() => { if (Date.now() - droppedAt.current > 300) onClick(); }}
        className="zb-press" style={{ ...buttonStyle, touchAction: 'none', ...(isCarried ? { background: 'var(--color-surface-active)' } : {}) }}>
        {label}
      </button>
      {children}
    </div>
  );
}
