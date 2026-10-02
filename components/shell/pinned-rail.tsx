'use client';
// THE pinned section of the sidebar.
//
// This slot used to be a hard-coded list of active PROJECTS. A project is not a
// special kind of record though — the thing you want one click away is whatever
// you are living in this month, and that is as often a brief, an invoice you
// keep checking, or one task you cannot forget. So the slot pins ANY record.
//
// What it pins is `EntityType` (lib/connected.ts), which is the same vocabulary
// `recordHref` can address and `ENTITY_GLYPH` can draw — so a pin needs no new
// concept, no new icon map and no new route. It is a reference into the fabric.
//
// ── THE THREE THINGS THE USER ASKED FOR ────────────────────────────────────
// REORDER by drag, with a keyboard equivalent, because a list you cannot
//   rearrange is a list that decays into whatever order things were pinned.
// SCROLL, because the count is not capped at a screenful (lib/pins.ts caps it
//   at 200, which is a guard on the JSON column, not a product limit).
// ANY TYPE, which is why the row draws its glyph from the entity map rather
//   than hard-coding a folder.
//
// Optimistic throughout: a drag lands instantly and the write follows. If the
// write fails the list snaps back and says so, because a reorder that silently
// did not save is worse than one that visibly refused.
import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from '@/components/ds/icons';
import { Icon, toast } from '@/components/ds/ui';
import { ENTITY_GLYPH } from '@/components/connected/entity-icons';
import { recordHref } from '@/lib/connected';
import { movePin, pinKey, removePin, type Pin } from '@/lib/pins';
import { setPins } from '@/lib/actions/pins';
import { useServerState } from '@/lib/use-server-state';
import { cn } from '@/lib/cn';
import { RAIL_MOTION, railFade } from '@/components/shell/rail-motion';
import { navRowStyle, NAV_GLYPH_SLOT } from '@/components/shell/shell-parts';
import { RailSectionHeading } from '@/components/ui/rail-section-heading';

function Row({ pin, collapsed, onNavigate, onUnpin }: {
  pin: Pin; collapsed?: boolean; onNavigate?: () => void; onUnpin: (p: Pin) => void;
}) {
  const pathname = usePathname();
  const href = recordHref(pin.type, pin.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pinKey(pin) });
  // The row is active when you are already looking at it. `recordHref` returns a
  // path with a search param for most types, so compare the path only.
  const active = !!href && pathname === href.split('?')[0];

  const body = (
    <>
      {/* The glyph slot is 18px and the grip takes the SAME slot on hover — the
          two never coexist, so neither overlaps the other and the label never
          shifts. The first version put the grip at `left-0` over this icon,
          which is exactly the overlap it was reported for. A 230px rail has no
          gutter to spare for a permanent handle, and the type glyph is the one
          thing you do not need while you are dragging the row. */}
      {/* Only a row that HAS a grip hands its slot over: in the collapsed rail there is
          no grip, and the glyph used to fade to nothing under the pointer. */}
      {/* The glyph sits in the sidebar's ONE glyph column (shell-parts.tsx `NAV_GLYPH_SLOT`) at the
          record size (16), so a pinned record's label starts at the same x as every module's. */}
      <span className={cn('transition-opacity', !collapsed && 'group-hover/pin:opacity-0 group-focus-within/pin:opacity-0')} style={NAV_GLYPH_SLOT}>
        <Icon icon={ENTITY_GLYPH[pin.type]} size={16} state={active}
          style={{ color: 'currentColor' }} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, ...railFade(collapsed) }}>
        {pin.label}
      </span>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="group/pin relative"
    >
      {/* The GRIP is the drag handle, not the whole row: a row you cannot click
          without starting a drag is a row you cannot navigate with. It sits in
          the glyph's slot (left: 8px = the row's own padding) and fades in as
          the glyph fades out, so a resting sidebar stays quiet and nothing ever
          sits on top of anything else. */}
      {!collapsed && (
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${pin.label}`}
          className="focus-ring absolute left-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-xs text-ink-500 opacity-0 transition-opacity hover:text-ink-800 group-hover/pin:opacity-100 focus-visible:opacity-100"
          style={{ cursor: 'grab' }}
        >
          <Icon icon={GripVertical} size={16} />
        </button>
      )}
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          aria-label={collapsed ? pin.label : undefined}
          aria-current={active ? 'page' : undefined}
          className="zb-nav-item"
          style={{
            // THE NAV ROW, exactly (shell-parts.tsx): same height, inset, gap, radius and
            // selected state as a module row — a pinned record is a place in the same list.
            // It used to be its own row: a 4px gap, an 8px corner when selected, and a 12px
            // indent, so its label started 6px right of every module label above it.
            ...navRowStyle(active, collapsed),
            overflow: 'hidden',
            // Room for the hover × so a long name truncates BEFORE it, never under it.
            paddingRight: collapsed ? 'var(--nav-rail-px, 6px)' : 28,
          }}
        >
          {body}
        </Link>
      ) : (
        <span className="zb-nav-item" style={{ ...navRowStyle(false, collapsed), color: 'var(--color-ink-500)' }}>{body}</span>
      )}
      {!collapsed && (
        <button
          onClick={() => onUnpin(pin)}
          aria-label={`Unpin ${pin.label}`}
          className="focus-ring absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-xs text-ink-500 opacity-0 transition-opacity hover:bg-surface-hover hover:text-ink-900 group-hover/pin:opacity-100 focus-visible:opacity-100"
        >
          <Icon icon={X} size={12} />
        </button>
      )}
    </div>
  );
}

export function PinnedRail({ pins: initial, collapsed, onNavigate }: {
  pins: Pin[]; collapsed?: boolean; onNavigate?: () => void;
}) {
  // The SERVER owns this list — a pin made on another screen has to show up
  // here. `useServerState` reconciles that during render; the effect I reached
  // for first is the pattern lib/use-server-state.ts exists to stop, and its
  // guard test caught it.
  const [pins, setLocal] = useServerState(initial);
  const [open, setOpen] = useState(true);
  // dnd-kit derives the drag description's element id from this. Given none, it
  // falls back to a MODULE-LEVEL COUNTER — which keeps counting on the server
  // and restarts at 0 in the browser, so the markup hydrates with
  // `aria-describedby="DndDescribedBy-1"` against a client expecting `-0`, and
  // React throws the whole subtree away. `useId` is the primitive for exactly
  // this: stable across server and client, and unique per instance, which a
  // hard-coded string is not the moment two of these mount at once.
  const dndId = useId();

  const sensors = useSensors(
    // 6px of slop so a click on the grip is still a click, not a 1px drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = async (next: Pin[], previous: Pin[]) => {
    setLocal(next);
    const res = await setPins(next);
    if ('error' in res) { setLocal(previous); toast({ message: res.error, variant: 'error' }); }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = pins.findIndex((p) => pinKey(p) === active.id);
    const to = pins.findIndex((p) => pinKey(p) === over.id);
    const next = movePin(pins, from, to);
    if (next !== pins) void commit(next, pins);
  };

  if (pins.length === 0) return null;

  return (
    <>
      {/* The heading FOLDS away with the collapse instead of unmounting, so the pins
          below it rise with the rail rather than jumping up on its first frame. The
          4px pad-and-pull keeps the clip clear of the focus ring. */}
      <div aria-hidden={collapsed || undefined} style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: `grid-template-rows ${RAIL_MOTION}` }}>
        <div style={{ minHeight: 0, overflow: 'hidden', padding: 4, margin: -4, ...railFade(collapsed) }}>
        <RailSectionHeading label="Pinned" open={open} onToggle={() => setOpen((v) => !v)} />
        </div>
      </div>
      {open && (
        // `scroll-region` reserves the scrollbar gutter, so the rail does not
        // narrow by 6px the moment the list outgrows the space.
        <div className="scroll-region" style={{
          // The module rows' rhythm (row and gap), and NO indent: these are places in the same
          // list, not children of the heading. In the rail the reserved gutter is released: 6px
          // of it clipped every pinned pill to 26px beside the module rows' 32px squares.
          display: 'flex', flexDirection: 'column', gap: 'var(--nav-row-gap, 6px)', minHeight: 0,
          alignItems: 'stretch',
          scrollbarGutter: collapsed ? 'auto' : undefined,
        }}>
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pins.map(pinKey)} strategy={verticalListSortingStrategy}>
              {pins.map((p) => (
                <Row key={pinKey(p)} pin={p} collapsed={collapsed} onNavigate={onNavigate}
                  onUnpin={(x) => void commit(removePin(pins, x), pins)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
}
