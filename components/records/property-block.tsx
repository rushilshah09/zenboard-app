'use client';
// A record's property block, as something the READER arranges.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// A project header states seven facts. The user called the page cluttered; a
// pass cut the block to three; the next directive was "this information is
// gone — I want it back as it was." Both are true, and no number of rows
// satisfies both — seven facts are noise to someone who reads a project by its
// progress and reference to someone who bills by its dates. So the app stops
// choosing. Notion hides any page property and reports the rest as "N hidden";
// Linear's project properties work the same way. lib/property-layout.ts holds
// the rules and explains why the choice lives on the profile.
//
// ── WHY IT IS NOT IN components/ds/ui ───────────────────────────────────────
// The DS owns the row's SHAPE — `PROPERTY_ROW`, imported below, is the one
// definition of the 124px label column and the 32px row, and this file uses it
// rather than restating it. What this file adds is not a primitive: it is a
// primitive plus a stored preference plus a drag library plus a persistence
// call, which is a PATTERN. The same boundary the DS `Board` keeps — it draws
// columns, and tasks-board brings the dnd-kit — and it is what keeps dnd-kit
// out of the ds/ui barrel that half the app imports.
//
// ── ONE COPY, TWO RECORDS ───────────────────────────────────────────────────
// Projects and Clients both open with this block, and each carried its own
// hand-written rows before the DS row existed. Two copies is the state just
// before a divergence, so the behaviour lives here once and each record
// declares only what is true about it: its keys, its glyphs, its values.
import { useId, useState, type ReactNode } from 'react';
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronUp, ChevronDown, Eye, EyeOff, GripVertical, RotateCcw, type IconType } from '@/components/ds/icons';
import {
  Icon, PROPERTY_ROW, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ds/ui';
import { useServerState } from '@/lib/use-server-state';
import { cn } from '@/lib/cn';
import {
  arrangeProps, moveProp, reorderProps, hideProp, showProp, isArranged, resetPropLayout,
  type PropLayout, type PropSet,
} from '@/lib/property-layout';

/** One property, declared by the record. `key` is what gets persisted — it must
 *  never be the label, or renaming a row would lose everyone's arrangement. */
export type RecordProperty = {
  key: string;
  icon: IconType;
  label: string;
  /** The value: a badge, a link, a progress bar. */
  value: ReactNode;
};

function Row({ prop, hidden, canUp, canDown, arranged, on }: {
  prop: RecordProperty;
  hidden?: boolean;
  canUp: boolean;
  canDown: boolean;
  arranged: boolean;
  on: {
    move: (key: string, delta: -1 | 1) => void;
    hide: (key: string) => void;
    show: (key: string) => void;
    reset: () => void;
  };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: prop.key, disabled: hidden });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={cn('group relative', PROPERTY_ROW.row)}
    >
      {/* The handle shares the property glyph's slot and swaps in on hover —
          the arrangement the pinned rail already uses — rather than the gutter
          it first shipped in. That gutter pulled the row 24px left of the
          page's inset, and the inset is FLUID (`--view-px`: 18–40px, 14–28px in
          compact density), so below ~800px wide, and nearly always in compact,
          the handle sat partly outside the scroll region and was cut off:
          seven clipped stubs down a phone's left edge, where touch showed them
          permanently. A slot inside the row cannot clip at any width, and the
          swap costs nothing — the label beside the glyph already says what the
          property is.

          Touch gets no handle. There is no hover to reveal it, a drag inside a
          scrolling page fights the scroll, and the label's menu moves the row
          just as well. `hidden` rather than transparent, because an invisible
          button over the glyph would still catch the tap. For the same reason
          the handle is not a Tab stop: the menu is the keyboard path, and a
          header you tab THROUGH many times a day should not charge seven extra
          stops for an act done once a month. The pinned rail keeps its handle
          tabbable — there, the handle IS the only keyboard path.

          Its ink is a CONTROL's, not a decoration's. It shipped at ink-300 and
          measured 1.90:1 on white and 1.75:1 on the dark card — and the handle
          is the only sign a row can be dragged, so WCAG 1.4.11 asks 3:1 of it.
          ink-400 is 2.6:1 in both themes; ink-500 is 6.1:1, and it is what the
          app's other handle, the pinned rail's, already used.

          A hidden row has nowhere to move to, so it gets no handle. */}
      {!hidden && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          // After the spread, so it wins over dnd-kit's own `tabIndex: 0`.
          tabIndex={-1}
          aria-label={`Reorder ${prop.label}`}
          className="focus-ring absolute -left-0.5 top-1/2 grid size-5 -translate-y-1/2 cursor-grab place-items-center rounded-xs text-ink-500 opacity-0 transition-opacity duration-fast hover:text-ink-800 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing [@media(pointer:coarse)]:hidden"
        >
          <Icon icon={GripVertical} size={14} aria-hidden />
        </button>
      )}

      <DropdownMenu>
        {/* The LABEL is the trigger. The thing you want to act on is the thing
            you click — the same reasoning that made the project's icon tile its
            own picker button, rather than growing a second control beside it. */}
        <DropdownMenuTrigger
          aria-label={`${prop.label} options`}
          className={cn(
            // The DS owns the column's geometry, including what it becomes when
            // the label is a trigger. Restating 124px here is how the manageable
            // header and the plain one would come to sit on two grids.
            PROPERTY_ROW.labelTrigger,
            'h-7 cursor-pointer text-left transition-colors duration-fast',
            'hover:bg-surface-hover focus-ring data-[state=open]:bg-surface-hover',
          )}
        >
          {/* Steps aside while the handle holds its slot. Tailwind v4 gates
              `hover` on `(hover: hover)`, so on touch the glyph never leaves.

              `pointer-events-none` is load-bearing. A transparent element is
              still hit-testable, and anything below opacity 1 paints in the
              positioned layer — AFTER the handle, in tree order. Without it the
              invisible glyph sat on top of the visible handle and took the
              press, so the handle could be seen but not grabbed: how this
              first shipped, caught only by hit-testing the slot. */}
          <Icon icon={prop.icon} size={PROPERTY_ROW.iconSize} strokeWidth={1.75} aria-hidden
            className={cn('pointer-events-none shrink-0 text-ink-500 transition-opacity duration-fast', !hidden && 'group-hover:opacity-0')} />
          <span className="truncate">{prop.label}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {hidden ? (
            <DropdownMenuItem icon={<Icon icon={Eye} size={14} />} onSelect={() => on.show(prop.key)}>
              Show
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem icon={<Icon icon={ChevronUp} size={14} />} disabled={!canUp}
                onSelect={() => on.move(prop.key, -1)}>Move up</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={ChevronDown} size={14} />} disabled={!canDown}
                onSelect={() => on.move(prop.key, 1)}>Move down</DropdownMenuItem>
              <DropdownMenuItem icon={<Icon icon={EyeOff} size={14} />} onSelect={() => on.hide(prop.key)}>
                Hide
              </DropdownMenuItem>
            </>
          )}
          {/* Only once there is an arrangement to undo. An offer to reset what
              you have not changed is a control that does nothing. */}
          {arranged && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Icon icon={RotateCcw} size={14} />} onSelect={on.reset}>
                Reset properties
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className={cn(PROPERTY_ROW.value, hidden && 'text-ink-500')}>{prop.value}</div>
    </div>
  );
}

export function PropertyBlock({ set, properties, layout: incoming, onSave }: {
  /** Which record kind's preference this is. One arrangement per KIND, not per
   *  record — see lib/property-layout.ts. */
  set: PropSet;
  properties: RecordProperty[];
  layout: PropLayout;
  /**
   * Persist. Optional: without it the block renders as plain rows, which is the
   * right degradation for a surface with no signed-in profile to save to (the
   * client portal) rather than controls that quietly fail.
   */
  onSave?: (set: PropSet, next: PropLayout) => Promise<{ ok: true } | { error: string }>;
}) {
  // The SERVER owns this — arranging a project's header on one screen has to be
  // true on the next. Reconciled during render, never in an effect.
  const [layout, setLayout] = useServerState(incoming);
  const [openHidden, setOpenHidden] = useState(false);
  // dnd-kit derives the drag description's element id from this. Given none, it
  // falls back to a MODULE-LEVEL COUNTER — which keeps counting on the server
  // and restarts at 0 in the browser, so the markup hydrates with
  // `aria-describedby="DndDescribedBy-1"` against a client expecting `-0`, and
  // React throws the whole subtree away. `useId` is the primitive for exactly
  // this: stable across server and client, and unique per instance, which a
  // hard-coded string is not the moment two of these mount at once.
  const dndId = useId();

  const sensors = useSensors(
    // 6px of slop, so a click on the handle is still a click and not a 1px drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { visible, hidden } = arrangeProps(properties, layout);

  const commit = async (next: PropLayout) => {
    if (next === layout) return;
    const previous = layout;
    setLayout(next);
    if (!onSave) return;
    const res = await onSave(set, next);
    // A rearrangement that silently did not save is worse than one that visibly
    // refused — you would find out days later, on another machine.
    if ('error' in res) { setLayout(previous); toast({ message: res.error, variant: 'error' }); }
  };

  const on = {
    move: (key: string, delta: -1 | 1) => void commit(moveProp(layout, properties, key, delta)),
    hide: (key: string) => void commit(hideProp(layout, properties, key)),
    show: (key: string) => void commit(showProp(layout, key)),
    reset: () => { setOpenHidden(false); void commit(resetPropLayout()); },
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = visible.findIndex((p) => p.key === active.id);
    const to = visible.findIndex((p) => p.key === over.id);
    void commit(reorderProps(layout, properties, from, to));
  };

  if (properties.length === 0) return null;

  // No profile to save to: the plain block, exactly as it was.
  if (!onSave) {
    return (
      <div className="flex flex-col gap-px">
        {visible.map((p) => (
          <div key={p.key} className={PROPERTY_ROW.row}>
            <span className={PROPERTY_ROW.label}>
              <Icon icon={p.icon} size={PROPERTY_ROW.iconSize} className="shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden />
              {p.label}
            </span>
            <div className={PROPERTY_ROW.value}>{p.value}</div>
          </div>
        ))}
      </div>
    );
  }

  const arranged = isArranged(layout);
  const rowProps = (p: RecordProperty, i: number, isHidden?: boolean) => ({
    prop: p, hidden: isHidden, arranged, on,
    canUp: i > 0, canDown: i < visible.length - 1,
  });

  return (
    <div className="flex flex-col gap-px">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((p) => p.key)} strategy={verticalListSortingStrategy}>
          {visible.map((p, i) => <Row key={p.key} {...rowProps(p, i)} />)}
        </SortableContext>
      </DndContext>

      {hidden.length > 0 && (
        <>
          {/* The way back. It counts only what is actually on this record right
              now — hiding Sharing and then turning the portal off must not leave
              a control that restores nothing.

              Drawn as the list's LAST ROW, because that is what it is: its glyph
              in the glyphs' column and its words in the labels' type, with the
              same 4px chip inset the label triggers use, so its text sits on
              the label axis rather than floating beside it. */}
          <button
            type="button"
            onClick={() => setOpenHidden((v) => !v)}
            aria-expanded={openHidden}
            className="focus-ring -ms-1 mt-1 flex h-7 items-center gap-2 self-start rounded-sm px-1 text-ui text-ink-500 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800"
          >
            <Icon icon={openHidden ? Eye : EyeOff} size={PROPERTY_ROW.iconSize} strokeWidth={1.75} aria-hidden />
            {hidden.length} hidden
          </button>
          {/* Shown WITH their values, so you can see what you would be getting
              back before you decide — the reason this is a disclosure and not a
              menu of names. */}
          {openHidden && hidden.map((p) => <Row key={p.key} {...rowProps(p, -1, true)} />)}
        </>
      )}
    </div>
  );
}
