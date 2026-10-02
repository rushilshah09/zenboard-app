'use client';
import { useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ds/ui';
import { MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SEPARATOR_CLASS } from '@/components/ds/ui/menu';
import { cn } from '@/lib/cn';

// ── A database's panels: the DS popover, anchored where it is rendered ──
// EVERY panel in a database opens through here — a column header's menu, view
// settings, filter rules, colour rules, a select cell's options. Render it inside
// the element it belongs to (which must be `relative`); it hangs under that element.
//
// It was a hand-positioned portal with its own outside-click and Escape handling,
// wearing the popovers' old outline: the user put a database's panel beside the
// app's "New ▾" menu (2026-09-15) — "database uses old styling with outline, we have
// to use new styling". It is the DS Popover now, so it wears the one overlay chrome
// (OVERLAY_CLASS) and gets Radix's layering for free: a menu opened INSIDE a panel
// (a MenuSelect) no longer reads as a click outside it, and Escape inside a panel on
// a page open in a peek closes the panel, not the page.
//
// Kept from before: the panel is portalled (a table's scroll box cannot clip it), it
// flips and shifts to stay on screen, scrolls inside itself when tall, and closes when
// its anchor scrolls out of sight. Focus goes into it on open, and back to what opened
// it when it closes — unless the person clicked somewhere else, which keeps its focus.
export function Pop({ children, onClose, width = 230, right }: { children: React.ReactNode; onClose: () => void; width?: number; right?: boolean }) {
  // What had focus when the panel opened — the button that opened it. Read once, while
  // rendering the first time, before the panel takes focus.
  const [opener] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  const clickedAway = useRef(false);
  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        align={right ? 'end' : 'start'}
        sideOffset={4}
        flush
        hideWhenDetached
        className="max-h-[min(var(--radix-popover-content-available-height),70vh)] overflow-y-auto p-1"
        style={{ width }}
        // Focus goes to the panel itself, not its first field: a view's name selected the
        // moment its settings opened was one keystroke from gone. A field the panel is FOR
        // (an option search, a rule's value) says so — `autoFocus` on a MenuField marks it
        // `data-autofocus` — and is focused here. React's own autoFocus is not enough: inside a
        // dialog (an item's page) the dialog takes that focus back before this panel is open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const panel = e.currentTarget as HTMLElement | null;
          (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel)?.focus();
        }}
        onInteractOutside={() => { clickedAway.current = true; }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // Radix hands focus back a tick after the panel goes. By then a panel this one
          // opened (a filter's condition, from the filter list) may already hold it — and
          // taking it back would read to that panel as a click away, and shut it.
          const free = !document.activeElement || document.activeElement === document.body;
          if (!clickedAway.current && free && opener?.isConnected) opener.focus();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A row in a panel — the DS menu item's metrics (32px, 8px corner, 14px text). Pair it
 * with `zb-press`, which is its hover wash (one wash, never two).
 */
export const POP_ROW = cn(MENU_ITEM_CLASS, 'border-0 bg-transparent');
/** A panel's section heading ("Filter by", "Then group by"). */
export const POP_LABEL = MENU_LABEL_CLASS;
/** A line between a panel's sections. */
export const POP_SEPARATOR = MENU_SEPARATOR_CLASS;
