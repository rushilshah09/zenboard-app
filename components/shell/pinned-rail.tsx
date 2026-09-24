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
import { ChevronDown, GripVertical, X } from '@/components/ds/icons';
import { Icon, toast } from '@/components/ds/ui';
import { ENTITY_GLYPH } from '@/components/connected/entity-icons';
import { recordHref } from '@/lib/connected';
import { movePin, pinKey, removePin, type Pin } from '@/lib/pins';
import { setPins } from '@/lib/actions/pins';
import { useServerState } from '@/lib/use-server-state';
import { cn } from '@/lib/cn';
import { RAIL_MOTION, railFade } from '@/components/shell/rail-motion';

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
      <span className={cn('grid size-[18px] shrink-0 place-items-center transition-opacity', !collapsed && 'group-hover/pin:opacity-0 group-focus-within/pin:opacity-0')}>
        <Icon icon={ENTITY_GLYPH[pin.type]} size={20} weight={active ? 'fill' : 'regular'}
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
          className="focus-ring absolute left-2 top-1/2 grid size-[18px] -translate-y-1/2 place-items-center rounded-xs text-ink-500 opacity-0 transition-opacity hover:text-ink-800 group-hover/pin:opacity-100 focus-visible:opacity-100"
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
            position: 'relative', display: 'flex', alignItems: 'center', gap: 4, height: 'var(--row-nav)',
            // The nav row's collapse (components/shell/rail-motion.ts): the row stretches
            // to its column, so in the rail it is the 32px square, and only its inset
            // glides — to the module rows' inset exactly. The 20px glyph overflows its
            // 18px slot from the slot's start (measured), so the two glyphs share a line.
            flexShrink: 0, overflow: 'hidden',
            padding: 8, paddingLeft: collapsed ? 'var(--nav-rail-px, 6px)' : 8,
            // Room for the hover × so a long name truncates BEFORE it, never under it.
            paddingRight: 28,
            justifyContent: 'flex-start',
            borderRadius: active ? 8 : 6, textDecoration: 'none',
            background: active ? 'var(--color-surface-selected)' : undefined,
            color: active ? 'var(--color-ink-900)' : 'var(--color-text-secondary)',
            fontSize: 14, lineHeight: 1, fontWeight: active ? 500 : 400,
            transition: `padding-left ${RAIL_MOTION}, background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover)`,
          }}
        >
          {body}
        </Link>
      ) : (
        <span className="zb-nav-item" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 'var(--row-nav)', padding: 8, color: 'var(--color-ink-500)' }}>{body}</span>
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          tabIndex={collapsed ? -1 : undefined}
          className="focus-ring flex shrink-0 items-center gap-1 rounded-xs p-2 text-left"
        >
          {/* The section-label role, not a hand-set 12px in `ink-300` — that
              measured 1.75:1 on the dark rail and 1.90:1 on the light one, so
              the heading of the pinned list was close to invisible in both
              themes. `ink-500` is the faintest step that is TEXT; the chevron
              carries the open/closed state, so it takes the same ink. */}
          <Icon icon={ChevronDown} size={14}
            className={cn('text-ink-500 transition-transform duration-fast ease-standard', !open && '-rotate-90')} />
          <span className="text-overline leading-none text-ink-500">Pinned</span>
        </button>
        </div>
      </div>
      {open && (
        // `scroll-region` reserves the scrollbar gutter, so the rail does not
        // narrow by 6px the moment the list outgrows the space.
        <div className="scroll-region" style={{
          display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0,
          // The indent glides out with the collapse; it used to vanish on frame 0. In
          // the rail the reserved gutter is released: 6px of it clipped every pinned
          // pill to 26px beside the module rows' 32px squares.
          paddingLeft: collapsed ? 0 : 12, alignItems: 'stretch', transition: `padding-left ${RAIL_MOTION}`,
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
