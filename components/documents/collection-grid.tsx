'use client';
// A Collection's items as a masonry (COLLECTION_PLAN K4 and K8, COLLECTION_ITEM_BRIEF §4).
//
// Cards keep their own heights (lib/masonry.ts places them row by row into the shortest column), so
// the reading order, the tab order and the order items arrived in all agree. A click opens an item;
// ⌘/Ctrl-click adds it to the selection, and Shift-click selects everything from the last one picked.
//
// A card can also be carried to a new place in the manual order (§29). Nothing moves under the pointer
// while it is carried — a line shows the gap it will drop into, as a table's rows and columns do — and
// the masonry settles once, on the drop. Every drag has a twin that needs no pointer: ⌥← and ⌥→ on a
// focused card, and Move left / Move right in its menu.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Checkbox, DragGhost, DropLine, copyText } from '@/components/ds/ui';
import { itemName, resolveTags, type CardSize, type CollectionItem, type CollectionTag, type CollectionView } from '@/lib/collection';
import { cellsInView, dropIndex, masonryColumns, masonryLanding, placeMasonry, type CardBox } from '@/lib/masonry';
import type { LinkMeta } from '@/lib/unfurl';
import { useLatest } from '@/lib/use-latest';
import { CollectionCard, ItemActions, noteTitle, tileShape } from './collection-card';

const GAP = 12;
/** What a card size means: the narrowest a column may be before the masonry drops one (§28). */
const CARD_MIN: Record<CardSize, number> = { small: 150, medium: 220, large: 320 };
/** How far a pointer travels before it is carrying a card rather than clicking one. */
const CARRY = 5;
/**
 * A Collection can hold hundreds of things (§45). Past this many, only the cards near the screen are drawn —
 * each one signs a URL for its upload and may ask a link what it is, so an undrawn card costs nothing at all.
 * Below it, drawing everything is cheaper than watching the scroll.
 */
const DRAW_ALL_UNDER = 60;
/** How much beyond the screen is drawn anyway, so a scroll never shows a hole. */
const OVERSCAN = 800;
/** The window is only moved when it has moved by this much: a render per scroll event is a render too many. */
const WINDOW_STEP = 200;

export function CollectionGrid({
  items, vocabulary, view, selected, onOpen, onToggle, onDelete, onLearn, onShape, onMove, onRename, onToggleTag, reorderable = false,
}: {
  items: CollectionItem[];
  /** The Collection's tags, which the cards' tag ids name. */
  vocabulary?: readonly CollectionTag[];
  /** How this Collection shows itself (§28) — the same for everyone who opens it. */
  view: Required<CollectionView>;
  selected: ReadonlySet<string>;
  onOpen: (id: string) => void;
  /** A modified click: the item joins or leaves the selection — or, with Shift, a run of items does. */
  onToggle: (id: string, range: boolean) => void;
  onDelete: (id: string) => void;
  onLearn: (id: string, url: string, meta: LinkMeta | null) => void;
  onShape: (id: string, shape: number) => void;
  /** An item put at `index` among the others — a carry, a key or a menu. */
  onMove?: (id: string, index: number) => void;
  /** Only the manual order, with nothing hidden, is an order a drag can rearrange. */
  reorderable?: boolean;
  /** The item's name, changed on the card itself (§15). */
  onRename?: (id: string, title: string) => void;
  /** The Collection's own words, put on an item from its card's menu. */
  onToggleTag?: (id: string, tagId: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  // One card at a time is having its name changed, from its own menu.
  const [naming, setNaming] = useState<string | null>(null);
  // Where the screen is, in the grid's own coordinates. Null while everything is drawn.
  const [window_, setWindow] = useState<{ from: number; to: number } | null>(null);
  const many = items.length > DRAW_ALL_UNDER;
  const root = useRef<HTMLDivElement | null>(null);

  // Measured through a callback ref, so the box is measured whenever it appears.
  const measure = useCallback((el: HTMLDivElement | null) => {
    root.current = el;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0]?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onHeight = useCallback((id: string, h: number) => {
    setHeights((cur) => (cur[id] === h ? cur : { ...cur, [id]: h }));
  }, []);

  const columns = masonryColumns(width, CARD_MIN[view.size], GAP);
  const columnWidth = width > 0 ? (width - GAP * (columns - 1)) / columns : 0;
  // A card not measured yet stands at a likely height, corrected once it reports its own.
  // The same guess the card itself draws before its picture answers, so a card scrolled into view for the
  // first time settles where it was expected rather than pushing everything under it.
  const estimate = (item: CollectionItem) =>
    columnWidth * (view.fit === 'original' ? item.shape ?? tileShape(item.kind) : 0.75) + (view.titles && item.kind !== 'note' ? 64 : 0);
  const { positions, height } = placeMasonry(items.map((i) => heights[i.id] ?? estimate(i)), columns, GAP);
  const boxes: CardBox[] = items.map((item, i) => ({
    id: item.id,
    left: positions[i].column * (columnWidth + GAP),
    top: positions[i].top,
    width: columnWidth,
    height: heights[item.id] ?? estimate(item),
  }));

  // ── Carrying a card ──
  const [carry, setCarry] = useState<{ id: string; label: string; landing: number; x: number; y: number } | null>(null);
  const held = useRef<{ id: string; label: string; from: number; startX: number; startY: number; moved: boolean; landing: number } | null>(null);
  // A carry ends in a click the card must not answer.
  const carried = useRef(false);
  const latest = useLatest({ boxes, onMove });

  // Which part of the grid the screen is over. Whatever scrolls — the pane, the window, a peek — is caught by
  // listening in the capture phase, and the answer is read from the grid's own box rather than any scroller's.
  useEffect(() => {
    if (!many) return;
    let frame = 0;
    const measure = () => {
      const el = root.current;
      if (!el) return;
      const top = -el.getBoundingClientRect().top;
      const next = { from: top, to: top + window.innerHeight };
      setWindow((cur) => (cur && Math.abs(cur.from - next.from) < WINDOW_STEP && Math.abs(cur.to - next.to) < WINDOW_STEP ? cur : next));
    };
    const soon = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    soon();
    window.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [many]);

  useEffect(() => {
    const track = (e: PointerEvent) => {
      const grab = held.current;
      const box = root.current?.getBoundingClientRect();
      if (!grab || !box) return;
      if (!grab.moved) {
        if (Math.hypot(e.clientX - grab.startX, e.clientY - grab.startY) < CARRY) return;
        // Only now is it a carry rather than a click: the ghost and the line appear together.
        grab.moved = true;
        carried.current = true;
      }
      grab.landing = masonryLanding(latest.current.boxes, { x: e.clientX - box.left, y: e.clientY - box.top });
      setCarry({ id: grab.id, label: grab.label, landing: grab.landing, x: e.clientX, y: e.clientY });
    };
    const drop = () => {
      const grab = held.current;
      held.current = null;
      setCarry(null);
      if (!grab?.moved) return;
      const to = dropIndex(grab.landing, grab.from);
      if (to !== null) latest.current.onMove?.(grab.id, to);
    };
    window.addEventListener('pointermove', track);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', drop);
    };
  }, [latest]);

  /** One place earlier or later in the Collection's own order — ⌥← and ⌥→, and the menu's twins. */
  const moveBy = (index: number, delta: number) => {
    const to = index + delta;
    if (!onMove || to < 0 || to >= items.length) return;
    onMove(items[index].id, to);
  };

  // A window measured when the Collection was long is simply ignored once it is short again.
  const drawn = many && window_ ? cellsInView(boxes, window_.from, window_.to, OVERSCAN) : boxes.map((_, i) => i);
  const line = carry ? (boxes[Math.min(carry.landing, boxes.length - 1)] ?? null) : null;
  const atEnd = !!carry && carry.landing >= boxes.length;

  return (
    <div ref={measure} className="relative w-full" style={{ height: width > 0 ? height : undefined }} data-collection-grid>
      {width > 0 && drawn.map((i) => {
        const item = items[i];
        return (
        <Cell key={item.id} id={item.id} width={columnWidth} left={boxes[i].left} top={boxes[i].top} onHeight={onHeight}>
          <CollectionCard item={item} tags={resolveTags(vocabulary, item.tags)} selected={selected.has(item.id)} onLearn={onLearn} onShape={onShape}
            fit={view.fit} titles={view.titles}
            renaming={naming === item.id} onRename={(title) => onRename?.(item.id, title)} onRenamed={() => setNaming(null)}
            select={(
              // A box picks an item with no modifier held (§16) — Shift still takes the run between.
              <Checkbox checked={selected.has(item.id)} aria-label={`Select ${itemName(item)}`}
                className="bg-surface-raised"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggle(item.id, e.shiftKey); }} />
            )}
            menu={<ItemActions item={item} onOpen={onOpen} onDelete={onDelete}
              onMove={reorderable && onMove ? (delta) => moveBy(i, delta) : undefined}
              canMove={{ back: i > 0, forward: i < items.length - 1 }}
              onRename={onRename ? setNaming : undefined}
              vocabulary={vocabulary} onToggleTag={onToggleTag}
              onCopyLink={(id) => { const url = items.find((x) => x.id === id)?.url; if (url) copyText(url); }} />}
            gestures={{
              role: 'button',
              'aria-pressed': selected.size ? selected.has(item.id) : undefined,
              className: carry?.id === item.id ? 'opacity-40' : undefined,
              // A touch drag scrolls the page: on a touch screen the menu's twins do this instead.
              onPointerDown: (e) => {
                // A carry that ended anywhere but on a card left its mark: a new press clears it.
                carried.current = false;
                if (!reorderable || !onMove || e.button !== 0 || e.pointerType === 'touch' || e.metaKey || e.ctrlKey || e.shiftKey) return;
                if ((e.target as HTMLElement).closest('button, a, input, video')) return;
                held.current = { id: item.id, label: itemName(item), from: i, startX: e.clientX, startY: e.clientY, moved: false, landing: i };
              },
              onClick: (e) => {
                if (carried.current) { carried.current = false; e.preventDefault(); return; }
                if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); onToggle(item.id, e.shiftKey); return; }
                onOpen(item.id);
              },
              onKeyDown: (e) => {
                if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                  if (!reorderable || !onMove) return;
                  e.preventDefault();
                  moveBy(i, e.key === 'ArrowLeft' ? -1 : 1);
                  return;
                }
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onOpen(item.id);
              },
              title: item.kind === 'note' ? noteTitle(item.note) : undefined,
            }} />
        </Cell>
        );
      })}

      {/* Where it will land: the gap before the card nearest the pointer, or after the last one. */}
      {line && (
        <DropLine orientation="vertical" style={{ left: atEnd ? line.left + line.width + GAP / 2 - 1 : line.left - GAP / 2 - 1, top: line.top, height: line.height }} />
      )}
      {carry && (
        <div className="pointer-events-none fixed z-50" style={{ left: carry.x + 12, top: carry.y + 12 }}>
          <DragGhost label={carry.label} />
        </div>
      )}
    </div>
  );
}

/** One placed card. It measures itself, so the grid never reads a ref during render. */
function Cell({ id, width, left, top, onHeight, children }: {
  id: string; width: number; left: number; top: number;
  onHeight: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      onHeight(id, Math.round(box ? box.blockSize : el.offsetHeight));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, onHeight]);
  return (
    <div ref={ref} className="absolute left-0 top-0" style={{ width, transform: `translate(${left}px, ${top}px)` }}>
      {children}
    </div>
  );
}
