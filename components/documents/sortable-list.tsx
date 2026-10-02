'use client';
// A short list a person arranges by hand — a database's views, a view's properties,
// a board's groups. Notion gives every such list the same ⋮⋮ handle, and so does
// Zenboard: ONE list, so the handle, the lift, the keyboard and the words a screen
// reader hears are the same wherever a list can be re-ordered.
//
//   · The handle lifts its row; the rest of the row stays the row's own (a name to
//     click, an eye, a menu), because a whole-row drag steals every click.
//   · The keyboard moves one too: focus a handle, Space to lift, arrows to move,
//     Space to drop, Escape to put it back — a list is exactly what dnd-kit's
//     sortable keyboard is good at.
//   · Spoken in the items' names: dnd-kit's defaults read out ids, and a screen
//     reader said "draggable item done was dropped over droppable area __none__".
//
// dnd-kit stays out of components/ds (the drag seam, design-system.test.ts), which
// is why this lives here rather than beside the DS list row.
import { useId, type ReactNode } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export type SortableItem = { id: string; name: string };

// Hoisted: inline option objects defeat useSensor's memo and churn every row.
const POINTER = { activationConstraint: { distance: 4 } };
const KEYBOARD = { coordinateGetter: sortableKeyboardCoordinates };

export function SortableList<T extends SortableItem>({ items, noun, onReorder, disabled, rowClassName, renderRow }: {
  items: T[];
  /** What one item is called, for the instructions a screen reader hears ("view", "property"). */
  noun: string;
  onReorder: (ids: string[]) => void;
  /** Draw no handles — a list filtered by a search has no order of its own to change. */
  disabled?: boolean;
  /** The row's box — its height, gap and padding — or, per item, a row that is chosen. */
  rowClassName?: string | ((item: T) => string);
  /** Everything in the row after its handle. `handle` is the ⋮⋮, to place first. */
  renderRow: (item: T, handle: ReactNode) => ReactNode;
}) {
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, POINTER), useSensor(KeyboardSensor, KEYBOARD));
  const ids = items.map((i) => i.id);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  const name = (id: string | number) => items.find((i) => i.id === String(id))?.name || 'Untitled';
  const place = (id: string | number) => `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}, ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} moved to ${place(over.id)}.` : `${name(active.id)} is not over the list.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} dropped at ${place(over.id)}.` : `${name(active.id)} put back.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} cancelled.`,
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: `To move a ${noun}, press space, use the arrow keys, then press space again to drop it or escape to cancel.` } }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        {items.map((item) => (
          <SortableRow key={item.id} item={item} disabled={disabled} renderRow={renderRow}
            className={typeof rowClassName === 'function' ? rowClassName(item) : rowClassName} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow<T extends SortableItem>({ item, disabled, className, renderRow }: {
  item: T; disabled?: boolean; className?: string;
  renderRow: (item: T, handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  const handle = disabled ? (
    // The handle's width stays, so a search never shifts the names sideways.
    <span aria-hidden className="block h-6 w-5 shrink-0" />
  ) : (
    <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Move ${item.name || 'Untitled'}`}
      className="focus-ring grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-xs text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-700 active:cursor-grabbing">
      <Icon icon={GripVertical} size={16} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && 'relative z-10 bg-surface-raised shadow-lift-1')}>
      {renderRow(item, handle)}
    </div>
  );
}
