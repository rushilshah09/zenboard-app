'use client';
// The board — one database's pages cut into columns by a property, drawn the way
// Notion draws it (the user, 2026-09-15, with screenshots: "board view same to same
// Notion … cards draggable like content … user can enter page").
//
// What it is made of, and where each rule lives:
//   - which columns, in what order, where a carried card lands, what it becomes and
//     the order key that keeps it there — lib/board.ts, pure and tested;
//   - the column, card and slot geometry — `BOARD_COLUMN.database` in the DS;
//   - the colours — the option palette, with `--pal-*-wash` for a coloured column;
//   - "which column is the pointer over?" — lib/board-drag.ts, shared with the
//     content pipeline, whose drag this one follows: the card you hold is flat and
//     shadowed, its origin dims in place, a dashed slot shows where it will land.
//
// A card is a page. Clicking it opens the page the way the view says (T6); dragging
// it moves it; its ⋯ menu does both without a pointer (open · move to · delete).
import { Fragment, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { dropSettle } from '@/lib/drop-settle';
import { Eye, EyeOff, MoreHorizontal, Palette, Pencil, Plus } from '@/components/ds/icons';
import {
  BOARD_COLUMN, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Icon, IconButton,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  OPTION_COLORS, optionTokens, type DbRow, type OptionColor, type PropDef, type PropOption, type ViewDef,
} from '@/lib/collections';
import type { RowGroup } from '@/lib/db-engine';
import {
  boardColumns, groupPreset, landingFromPointer, moveToGroup, reorderKeys, sortedLanding,
} from '@/lib/board';
import { columnUnderPointer } from '@/lib/board-drag';
import { bleed } from '@/lib/bleed';
import { orderBetween } from '@/lib/row-order';
import { useLatest } from '@/lib/use-latest';
import { OptionChip } from './option-chip';
import { CardContent, CardMenu } from './db-card';

const DB = BOARD_COLUMN.database;
const COLOR_LABEL = (c: OptionColor) => c[0].toUpperCase() + c.slice(1);

export type BoardRowPatch = { title?: string; data?: Record<string, unknown>; order?: string };

export interface DatabaseBoardProps {
  /** The view's rows — filtered, sorted and searched — in display order. */
  rows: DbRow[];
  props: PropDef[];
  view: ViewDef;
  /** The property the board is grouped by (`boardGroupProp`). */
  prop: PropDef;
  onOpen: (rowId: string) => void;
  /** Make a page in a column: its name, its column's value and, from the top, its place. */
  onAdd: (input: { title: string; data: Record<string, unknown>; order?: string }) => void;
  onPatchRow: (rowId: string, patch: BoardRowPatch) => void;
  onDelete: (rowId: string) => void;
  onPatchView: (patch: Partial<ViewDef>) => void;
  /** Rename or recolour one of the grouped property's options. */
  onPatchOption: (optionId: string, patch: Partial<Pick<PropOption, 'name' | 'color'>>) => void;
  /** A conditional colour for a card, from the view's rules. */
  tint?: (row: DbRow) => string | undefined;
}

type Held = { id: string; rowId: string; from: string; height: number };
type Landing = { key: string; index: number };

// A drag's id is the COLUMN and the row: a multi-select page sits in several
// columns at once, and each of its cards is carried out of one of them.
const dragId = (key: string, rowId: string) => `${key}::${rowId}`;
const splitDragId = (id: string) => { const at = id.indexOf('::'); return { key: id.slice(0, at), rowId: id.slice(at + 2) }; };

/** A column's colour: its option's, and grey where there is no option to take it from. */
const toneOf = (g: RowGroup) => optionTokens(g.option?.color ?? 'gray');

export function DatabaseBoard({
  rows, props, view, prop, onOpen, onAdd, onPatchRow, onDelete, onPatchView, onPatchOption, tint,
}: DatabaseBoardProps) {
  const { shown, hidden } = useMemo(() => boardColumns(rows, view, props, prop), [rows, view, props, prop]);
  const colored = view.colorColumns !== false;
  const sorted = (view.sorts?.length ?? 0) > 0;
  const hiddenProps = view.hidden ?? [];
  const [adding, setAdding] = useState<{ key: string; at: 'top' | 'bottom' } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────
  const dndId = useId();
  const [held, setHeld] = useState<Held | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const overRef = useRef<string | null>(null);
  const pointerY = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  // The scroller is both measured (the drag) and bled to the page's edges (T5); one
  // stable callback ref does both, so a re-render never re-attaches its observer.
  const setBoard = useCallback((el: HTMLDivElement | null) => { boardRef.current = el; return bleed(el); }, []);
  // Each column's cards, by their RESTING middles measured when the drag began:
  // once the slot opens, the cards under it move down, and hit-testing against
  // where they are drawn would make the slot chase the pointer.
  const middles = useRef(new Map<string, number[]>());
  // A press must travel 4px before it is a drag, so a click still opens the page;
  // a finger holds for a beat, so a swipe still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  const columnRows = useCallback((key: string) => shown.find((g) => g.key === key)?.rows ?? [], [shown]);

  /** Where the held card would land over `key`, or null when that is where it already is. */
  const landingOver = useCallback((key: string, h: Held): Landing | null => {
    const inColumn = columnRows(key);
    const others = inColumn.filter((r) => !(key === h.from && r.id === h.rowId));
    const row = rows.find((r) => r.id === h.rowId);
    if (!row) return null;
    let index: number;
    if (sorted) {
      const moved = { ...row, data: key === h.from ? row.data : moveToGroup(row, prop, h.from, key) };
      index = sortedLanding(others, moved, view.sorts, props);
    } else {
      const body = boardRef.current?.querySelector<HTMLElement>(`[data-board-body="${CSS.escape(key)}"]`);
      const top = body?.getBoundingClientRect().top ?? 0;
      index = landingFromPointer(middles.current.get(key) ?? [], pointerY.current - top);
    }
    if (key === h.from && index === inColumn.findIndex((r) => r.id === h.rowId)) return null;
    return { key, index };
  }, [columnRows, rows, sorted, prop, view.sorts, props]);

  // While a card is held, follow the pointer itself: dnd-kit's delta leaves out a
  // page that auto-scrolls under the drag, and the slot must stay under the finger.
  useEffect(() => {
    if (!held) return;
    let frame = 0;
    const onMove = (e: PointerEvent | TouchEvent) => {
      pointerY.current = 'touches' in e ? (e.touches[0]?.clientY ?? pointerY.current) : e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const key = overRef.current;
        const next = key ? landingOver(key, held) : null;
        setLanding((prev) => (prev?.key === next?.key && prev?.index === next?.index ? prev : next));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onMove);
    };
  }, [held, landingOver]);

  const onDragStart = (e: DragStartEvent) => {
    const { key, rowId } = splitDragId(String(e.active.id));
    const id = String(e.active.id);
    const act = e.activatorEvent as PointerEvent | TouchEvent | null;
    pointerY.current = act && 'touches' in act ? (act.touches[0]?.clientY ?? 0) : (act as PointerEvent | null)?.clientY ?? 0;
    // Measure every column once, with nothing moved yet — the carried card too, so
    // the slot it opens is its own height (dnd-kit's own rect is not measured yet
    // when this fires).
    const height = boardRef.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`)?.getBoundingClientRect().height ?? 40;
    const map = new Map<string, number[]>();
    boardRef.current?.querySelectorAll<HTMLElement>('[data-board-body]').forEach((body) => {
      const top = body.getBoundingClientRect().top;
      const mids: number[] = [];
      body.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
        if (card.dataset.card === id) return;
        const r = card.getBoundingClientRect();
        mids.push(r.top + r.height / 2 - top);
      });
      map.set(body.dataset.boardBody!, mids);
    });
    middles.current = map;
    overRef.current = key;
    setHeld({ id, rowId, from: key, height });
    setLanding(null);
  };

  const onDragOver = (e: DragOverEvent) => {
    overRef.current = e.over ? String(e.over.id) : null;
    if (held) setLanding(overRef.current ? landingOver(overRef.current, held) : null);
  };

  /** Put a row in column `to` at `index` among its other cards — one undoable step. */
  const place = (rowId: string, from: string, to: string, index: number | null) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const data = to === from ? undefined : moveToGroup(row, prop, from, to);
    if (sorted || index === null) {
      if (data) onPatchRow(rowId, { data });
      return;
    }
    const others = columnRows(to).filter((r) => r.id !== rowId);
    const keys = reorderKeys(others, rowId, index);
    onPatchRow(rowId, { ...(data ? { data } : {}), order: keys.get(rowId) });
    for (const [id, order] of keys) if (id !== rowId) onPatchRow(id, { order });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const h = held;
    const to = e.over ? String(e.over.id) : null;
    const final = h && to ? landingOver(to, h) : null;
    setHeld(null);
    setLanding(null);
    overRef.current = null;
    if (!h || !to || !final) return;
    place(h.rowId, h.from, to, final.index);
  };

  const onDragCancel = () => { setHeld(null); setLanding(null); overRef.current = null; };

  // The value a new page starts with in a column, and — from the header's + — a key
  // that puts it above every card already there.
  const addIn = (key: string, at: 'top' | 'bottom', title: string) => {
    const first = columnRows(key)[0];
    onAdd({ title, data: groupPreset(prop, key), order: at === 'top' && first?.order ? orderBetween(null, first.order) : undefined });
  };

  const allGroups = useMemo(() => [...shown, ...hidden], [shown, hidden]);
  // Stable for the cards, which are memoised: a drag re-renders the board on every
  // column it crosses, and a card that is not moving must not re-render with it.
  const placeLatest = useLatest(place);
  const moveCard = useCallback((rowId: string, from: string, to: string) => placeLatest.current(rowId, from, to, null), [placeLatest]);
  const heldRow = held ? rows.find((r) => r.id === held.rowId) : undefined;
  // Spoken with names, never ids (dnd-kit's defaults read "__none__::3f9a…").
  const cardName = (id: string | number) => rows.find((r) => r.id === splitDragId(String(id)).rowId)?.title || 'Untitled';
  const columnName = (id: string | number | undefined) => allGroups.find((g) => g.key === String(id))?.label ?? 'no column';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${cardName(active.id)}.`,
    onDragOver: ({ active, over }) => `${cardName(active.id)} is over ${columnName(over?.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `${cardName(active.id)} dropped in ${columnName(over.id)}.` : `${cardName(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${cardName(active.id)} cancelled.`,
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={columnUnderPointer}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements }}
    >
      <div ref={setBoard} className="bleed-x scrollbar-quiet flex items-start gap-3 overflow-x-auto pb-4">
        {shown.map((g) => {
          const tone = toneOf(g);
          const isAdding = adding?.key === g.key;
          const slotAt = landing?.key === g.key ? landing.index : null;
          let k = 0; // cards drawn so far, not counting the one being carried
          return (
            <BoardColumnDrop key={g.key} id={g.key} label={`${g.label}, ${g.rows.length} ${g.rows.length === 1 ? 'page' : 'pages'}`}
              style={colored ? { background: tone.wash } : undefined}>
              <header className={DB.header}>
                {renaming === g.key && g.option ? (
                  <RenameOption option={g.option} onDone={(name) => { setRenaming(null); if (name && name !== g.option!.name) onPatchOption(g.option!.id, { name }); }} />
                ) : g.option ? (
                  <OptionChip opt={g.option} status={prop.type === 'status'} size="md" />
                ) : (
                  <span className="truncate px-1 text-ui font-medium text-ink-600">{g.label}</span>
                )}
                <span className="text-ui tabular-nums text-ink-500">{g.rows.length}</span>
                <span className="reveal-on-hover ml-auto flex items-center">
                  <ColumnMenu
                    group={g}
                    onHide={() => onPatchView({ hiddenGroups: [...(view.hiddenGroups ?? []), g.key] })}
                    onRename={g.option ? () => setRenaming(g.key) : undefined}
                    onColor={g.option ? (color) => onPatchOption(g.option!.id, { color }) : undefined}
                  />
                  <IconButton size="xs" label="New page" icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding({ key: g.key, at: 'top' })} />
                </span>
              </header>
              <div data-board-body={g.key} className={DB.body}>
                {isAdding && adding.at === 'top' && (
                  <NewCard onCommit={(title) => addIn(g.key, 'top', title)} onClose={() => setAdding(null)} />
                )}
                {g.rows.map((r) => {
                  const id = dragId(g.key, r.id);
                  const carried = held?.id === id;
                  const slot = !carried && slotAt === k;
                  if (!carried) k++;
                  return (
                    <Fragment key={id}>
                      {slot && <div aria-hidden className={DB.landing} style={{ height: held?.height }} />}
                      <BoardCard
                        id={id} row={r} props={props} hiddenProps={hiddenProps} groupPropId={prop.id} tint={tint?.(r)}
                        dim={carried} columnKey={g.key} groups={allGroups}
                        onOpen={onOpen} onDelete={onDelete} onMove={moveCard}
                      />
                    </Fragment>
                  );
                })}
                {slotAt !== null && slotAt >= k && <div aria-hidden className={DB.landing} style={{ height: held?.height }} />}
                {isAdding && adding.at === 'bottom' && (
                  <NewCard onCommit={(title) => addIn(g.key, 'bottom', title)} onClose={() => setAdding(null)} />
                )}
              </div>
              {!(isAdding && adding.at === 'bottom') && (
                <button type="button" onClick={() => setAdding({ key: g.key, at: 'bottom' })}
                  className={cn('focus-ring mt-1', DB.add, !colored && 'text-ink-500')}
                  style={colored ? { color: tone.text } : undefined}>
                  <Icon icon={Plus} size={16} className="shrink-0" /> New page
                </button>
              )}
            </BoardColumnDrop>
          );
        })}
        {hidden.length > 0 && (
          <section aria-label="Hidden groups" className={cn(DB.column, DB.widthClass)}>
            <header className={DB.header}>
              <span className="px-1 text-ui font-medium text-ink-500">Hidden groups</span>
            </header>
            <div className="flex flex-col">
              {hidden.map((g) => (
                <button key={g.key} type="button" title="Show group"
                  onClick={() => onPatchView({ hiddenGroups: (view.hiddenGroups ?? []).filter((x) => x !== g.key) })}
                  className="focus-ring group flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-left transition-colors duration-fast hover:bg-surface-hover">
                  {g.option ? <OptionChip opt={g.option} status={prop.type === 'status'} /> : <span className="truncate text-ui text-ink-600">{g.label}</span>}
                  <span className="text-ui tabular-nums text-ink-500">{g.rows.length}</span>
                  <Icon icon={Eye} size={16} className="reveal-on-hover ml-auto text-ink-600" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      {/* The card under the pointer: the card itself, flat, lifted by its shadow and
          exactly as wide as the slot it will drop into (the content board's rules). */}
      <DragOverlay dropAnimation={dropSettle()}>
        {held && heldRow ? (
          <div className={cn(DB.cardWidthClass, 'cursor-grabbing rounded-lg shadow-lift-2')}>
            <CardFace row={heldRow} props={props} hiddenProps={hiddenProps} groupPropId={prop.id} tint={tint?.(heldRow)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumnDrop({ id, label, style, children }: { id: string; label: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={label} className={cn(DB.column, DB.widthClass)} style={style}>
      {children}
    </section>
  );
}

// ── A card ─────────────────────────────────────────────────────────────────
const BoardCard = memo(function BoardCard({ id, row, props, hiddenProps, groupPropId, tint, dim, columnKey, groups, onOpen, onDelete, onMove }: {
  id: string; row: DbRow; props: PropDef[]; hiddenProps: string[]; groupPropId: string; tint?: string; dim: boolean;
  /** The column this card is drawn in, and every column it could be moved to. */
  columnKey: string; groups: RowGroup[];
  onOpen: (rowId: string) => void; onDelete: (rowId: string) => void;
  onMove: (rowId: string, from: string, to: string) => void;
}) {
  const moveTargets = groups.filter((g) => g.key !== columnKey);
  const { listeners, setNodeRef } = useDraggable({ id });
  const title = row.title || 'Untitled';
  return (
    <div className="group relative" data-card={id}>
      {/* `listeners` only, as on the content board: dnd-kit's `attributes` would
          announce "press space to pick up", a gesture there is no keyboard sensor
          for. The keyboard's way to move a card is its menu. */}
      <div
        ref={setNodeRef}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={() => onOpen(row.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(row.id); } }}
        className={cn('focus-ring block w-full cursor-pointer touch-manipulation rounded-lg text-left', dim && 'opacity-40')}
      >
        <CardFace row={row} props={props} hiddenProps={hiddenProps} groupPropId={groupPropId} tint={tint} />
      </div>
      {/* Beside the card, not inside it: a button inside a role="button" is two
          controls fighting for one tab stop, and outside the drag listeners a press
          here opens the menu instead of lifting the card. */}
      <div className="reveal-on-hover absolute right-1.5 top-1.5">
        <CardMenu onOpen={() => onOpen(row.id)} onDelete={() => onDelete(row.id)}>
          {moveTargets.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {moveTargets.map((g) => (
                  <DropdownMenuItem key={g.key} onSelect={() => onMove(row.id, columnKey, g.key)}>
                    {g.option ? <OptionChip opt={g.option} status={props.find((p) => p.id === groupPropId)?.type === 'status'} /> : g.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </CardMenu>
      </div>
    </div>
  );
});

/**
 * What a card shows: the page glyph when the page has something in it, the name,
 * then each visible property that has a value, one per line — never the property
 * the board is grouped by, which the column already says.
 */
function CardFace({ row, props, hiddenProps, groupPropId, tint }: {
  row: DbRow; props: PropDef[]; hiddenProps: string[]; groupPropId: string; tint?: string;
}) {
  return (
    <div className={DB.card} style={tint ? { background: tint } : undefined}>
      <CardContent row={row} props={props} hiddenProps={hiddenProps} exclude={groupPropId} />
    </div>
  );
}

// ── Making a page in a column ───────────────────────────────────────────────
// A card-shaped field where the next card will be. Enter makes the page and leaves
// the field open for another (§4.50: ten pages in twenty seconds); Escape, or
// leaving it empty, puts it away; leaving it with a name keeps the page.
function NewCard({ onCommit, onClose }: { onCommit: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  return (
    <div className={cn(DB.card, 'focus-within:border-line-strong')}>
      <input
        autoFocus
        value={title}
        placeholder="Type a name…"
        aria-label="New page name"
        data-chromeless
        data-owns-escape
        autoComplete="off" data-1p-ignore data-lpignore="true"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (title.trim()) { onCommit(title.trim()); setTitle(''); } else onClose();
          }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
        onBlur={() => { if (title.trim()) onCommit(title.trim()); onClose(); }}
        className="block w-full border-0 bg-transparent p-0 text-ui font-medium text-ink-900 outline-none placeholder:text-ink-500"
      />
    </div>
  );
}

// ── A column's own menu ─────────────────────────────────────────────────────
function ColumnMenu({ group, onHide, onRename, onColor }: {
  group: RowGroup;
  onHide: () => void;
  onRename?: () => void;
  onColor?: (color: OptionColor) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="xs" label={`${group.label} options`} icon={<Icon icon={MoreHorizontal} size={16} />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onRename && <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={onRename}>Rename</DropdownMenuItem>}
        {onColor && group.option && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Icon icon={Palette} size={16} />Color</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {OPTION_COLORS.map((c) => (
                <DropdownMenuItem key={c} active={group.option!.color === c} onSelect={() => onColor(c)}
                  icon={<span aria-hidden className="size-3.5 rounded-xs" style={{ background: optionTokens(c).bg, boxShadow: `inset 0 0 0 1px ${optionTokens(c).dot}` }} />}>
                  {COLOR_LABEL(c)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {(onRename || onColor) && <DropdownMenuSeparator />}
        <DropdownMenuItem icon={<Icon icon={EyeOff} size={16} />} onSelect={onHide}>Hide group</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameOption({ option, onDone }: { option: PropOption; onDone: (name: string) => void }) {
  const done = useRef(false);
  const finish = (name: string) => { if (done.current) return; done.current = true; onDone(name.trim()); };
  return (
    <input
      autoFocus
      defaultValue={option.name}
      aria-label={`Rename ${option.name}`}
      data-chromeless
      data-owns-escape
      autoComplete="off" data-1p-ignore data-lpignore="true"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => finish(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value);
        if (e.key === 'Escape') finish(option.name);
      }}
      className="h-6 min-w-0 flex-1 rounded-xs border-0 bg-surface-hover px-1.5 text-ui font-medium text-ink-900 outline-none"
    />
  );
}
