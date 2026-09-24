'use client';
// Dragging a card between pipeline stages.
//
// ── WHY THIS IS NOT IN components/ds ───────────────────────────────────────
// Because the DS barrel is imported by dozens of files, and a primitive that
// drags is a primitive that costs every one of them — this app ships to a
// Cloudflare Worker with a 3 MiB ceiling. `property-block.test.ts` guards the
// boundary ("the DS draws shapes; features bring the drag") and caught the
// first version of this work inside `ds/ui/board.tsx`. So the DS draws a
// kanban and this file makes one draggable, through the two shells the DS
// asks for.
//
// ── THE LANDING MARKER, AND WHY IT IS NOT UNDER THE CURSOR ─────────────────
// Notion draws an insertion line where you are pointing, because in Notion you
// really are choosing the position. A content column is a QUEUE SORTED BY DATE:
// dropping a card decides its stage, and its publish date decides where in the
// column it sits. A line under the cursor would promise a choice that does not
// exist — you would aim at the bottom of a column and the card would appear at
// the top. So the slot opens at the index the DATE gives it, which `landingIndex`
// computes by asking `board()` with the move already applied. The marker and the
// outcome cannot disagree, because they are the same function.
import { createContext, useCallback, useContext, useId, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { dropSettle } from '@/lib/drop-settle';
import { columnUnderPointer } from '@/lib/board-drag';
import { Board, BOARD_COLUMN, type BoardCardShell, type BoardColumnShell, type BoardProps } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export type PipelineBoardProps = Omit<BoardProps, 'ColumnShell' | 'CardShell' | 'landingAt'> & {
  /** Commit the move. Called once, on drop, and never for a card put back. */
  onMoveCard: (cardId: string, columnId: string) => void;
  /** Where the card will really land — see the header. */
  landingIndex?: (cardId: string, columnId: string) => number | null;
  /** A card's face for the copy under the cursor. */
  renderDragged?: (cardId: string) => React.ReactNode;
};

/**
 * Both shells are MODULE-LEVEL, and must stay that way. Built inside the
 * component they would get a new identity whenever the drag state changed,
 * which remounts every column and card in the middle of a drag — losing
 * dnd-kit's measured rects and every layout animation with them. Neither needs
 * the drag state anyway: `isOver` and `isDragging` are only ever true during
 * one.
 */
/**
 * The column the held card came from. A drop there is not a move, so that
 * column must not answer "drop here" — it did, with an outline, the whole time a
 * card was being dragged out of it. Context rather than a shell prop because the
 * shells are module-level and the DS decides what props they receive.
 */
const HeldFrom = createContext<string | null>(null);

const ColumnShell: BoardColumnShell = ({ id, label, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const from = useContext(HeldFrom);
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      // The column under the cursor says so. Tint AND a ring, because a tint
      // alone is invisible against six identical wells at a glance.
      className={cn(className, isOver && id !== from && BOARD_COLUMN.over)}
    >
      {children}
    </section>
  );
};

const CardShell: BoardCardShell = ({ id, title, onOpen, children }) => {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      // `listeners` only — dnd-kit's `attributes` are DELIBERATELY not spread.
      // They carry `aria-roledescription="draggable"` and an `aria-describedby`
      // telling a screen-reader user to press space to pick the card up. Space
      // cannot work here: this element's own `onKeyDown` owns Enter (open the
      // card), and there is no KeyboardSensor for the reason above. Announcing
      // a gesture we do not really offer is worse than not announcing it.
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(); }}
      className="focus-ring block w-full cursor-grab rounded-lg text-left active:cursor-grabbing"
    >
      {/* The original stays in place and dims — a card that VANISHES from its
          column while you hold it destroys the one thing you are judging,
          which is where it came from relative to where it is going. */}
      {children(isDragging)}
    </div>
  );
};

export function DraggableBoard({ onMoveCard, landingIndex, renderDragged, ...board }: PipelineBoardProps) {
  // Module-level counters inside dnd-kit make a server id and a client id
  // disagree; every DndContext in this app carries its own (zenboard-dnd-kit-ids).
  const dndId = useId();
  const [held, setHeld] = useState<{ id: string; from: string } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // How many times each card has been DROPPED. It becomes part of the card's
  // animation identity (`cardLayoutKey`), so a card you carried lands with a key
  // its previous self never had — nothing to fly from, no replay of the journey.
  const [drops, setDrops] = useState<Record<string, number>>({});
  const cardLayoutKey = useCallback((id: string) => `${id}:${drops[id] ?? 0}`, [drops]);
  // 4px, so a press that was meant as a click still opens the card. No
  // KeyboardSensor: dnd-kit's arrow step is 25px, which is thirteen presses per
  // 312px column — an accessible path in name only. The keyboard path is the
  // card's own ⋯ menu, which lists every stage and moves in two keystrokes.
  // That is the "menu twin" rule, and here the twin is better than the gesture.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // The slot: the hovered column's honest index, `-1` when no position can be
  // promised, and nothing at all over the card's own column — a slot cannot mark
  // a move that is not happening.
  const landingAt = useCallback((columnId: string): number | null => {
    if (!held || overId !== columnId || held.from === columnId) return null;
    if (!landingIndex) return Number.MAX_SAFE_INTEGER;
    const at = landingIndex(held.id, columnId);
    return at === null ? -1 : at;
  }, [held, overId, landingIndex]);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={columnUnderPointer}
      onDragStart={(e: DragStartEvent) => {
        const id = String(e.active.id);
        const from = board.columns.find((c) => c.cards.some((k) => k.id === id))?.id ?? '';
        setHeld({ id, from });
        setOverId(from);
      }}
      onDragOver={(e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null)}
      onDragEnd={(e: DragEndEvent) => {
        const to = e.over ? String(e.over.id) : null;
        const moved = held;
        setHeld(null);
        setOverId(null);
        // Dropping a card back where it started is not a move, and firing one
        // would cost a round trip to change nothing.
        if (moved && to && to !== moved.from) {
          // Renew BEFORE the move, in the same batch, so the render that puts
          // the card in its new column is also the one with its new key.
          setDrops((d) => ({ ...d, [moved.id]: (d[moved.id] ?? 0) + 1 }));
          onMoveCard(moved.id, to);
        }
      }}
      onDragCancel={() => { setHeld(null); setOverId(null); }}
    >
      <HeldFrom.Provider value={held?.from ?? null}>
        <Board {...board} ColumnShell={ColumnShell} CardShell={CardShell} landingAt={landingAt} cardLayoutKey={cardLayoutKey} />
      </HeldFrom.Provider>
      {/* The card under the cursor. 284 = the 300px column less its 2×8 padding,
          so what you are holding is the width of the slot it will drop into. */}
      <DragOverlay dropAnimation={dropSettle()}>
        {held ? (
          // Fully opaque. It was `opacity-95`, and a held card passes OVER other
          // cards — at 95% the one underneath read through it, two titles on top
          // of each other ("Untitled" over "ewcweewcww", in a user's recording).
          // Rounded like the card, so its lift shadow follows the card's corners
          // — the wrapper was square (0px against the card's 12px) and its shadow
          // notched every corner. And straight: the 1° tilt made each edge cross
          // the board's straight lines at an angle and resampled the title soft.
          // Notion carries a card flat.
          <div className={cn(BOARD_COLUMN.cardWidthClass, "cursor-grabbing rounded-lg shadow-lift-2")}>
            {renderDragged?.(held.id)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
