'use client';
// The task drawer's chip row — the pill triggers under a task's title and the
// small panel each one opens. Extracted from task-detail-drawer.tsx so that a
// chip added later (Remind, 0031) reuses the exact geometry and behaviour of
// the six that were already there instead of forking a seventh look.
//
// WHY THIS IS NOT `<DropdownMenu>`. The DS menu is the right primitive for a
// list of commands, and everything shell-shaped uses it. These panels are not
// that: one holds a colour palette, one a scrolling time list, one a text input
// for creating a label. Radix's menu takes ownership of focus and typeahead in
// ways those fight. Converting the row wholesale is its own piece of work; what
// this file does is make sure there is exactly ONE implementation of the
// row-and-panel in the meantime, and that it is keyboard-operable.
import * as React from 'react';
import { OVERLAY_CLASS } from '@/components/ds/ui/menu';
import { Icon } from '@/components/ds/ui/icon';
import { Check } from '@/components/ds/icons';
import { cn } from '@/lib/cn';

export type PopTriggerProps = {
  ref: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
};

/**
 * A chip and the panel it opens.
 *
 * Keyboard grammar, which the hand-rolled original had none of:
 *   Enter/Space on the chip  → open, focus moves to the first control
 *   ↓ / ↑ inside             → move between the panel's controls
 *   Escape                   → close, focus returns to the chip
 *   choosing something       → close, focus returns to the chip
 *
 * Focus RETURNING is the part that matters: without it, dismissing a panel
 * drops focus on <body> and the next Tab restarts from the top of the drawer,
 * which is how a keyboard user loses their place.
 */
export function Pop({
  trigger,
  children,
  width = 200,
  label,
}: {
  trigger: (open: boolean, props: PopTriggerProps) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  width?: number;
  /** Accessible name for the panel — what the chip is for ("Reminder"). */
  label: string;
}) {
  // One piece of state carrying both the panel and what its last transition
  // MEANT. `restore` is state rather than a ref on purpose: `close` is handed
  // to `children` during render, so anything it touches has to be safe to touch
  // during render — a ref is not (react-hooks/refs), and a stale one would send
  // focus to the wrong place, which is exactly the bug refs-in-render causes.
  const [state, setState] = React.useState({ open: false, restore: false });
  const { open } = state;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  /** Chose something, or pressed Escape — focus belongs back on the chip. */
  const close = React.useCallback(() => setState({ open: false, restore: true }), []);
  /** Clicked elsewhere — whatever was clicked has focus, and should keep it. */
  const dismiss = React.useCallback(() => setState({ open: false, restore: false }), []);

  React.useEffect(() => {
    if (!state.open) {
      if (state.restore) triggerRef.current?.focus();
      return;
    }
    // rAF, not a layout effect: the panel is only in the DOM after paint, and
    // focusing a node that is still being positioned scrolls the drawer.
    const id = requestAnimationFrame(() => {
      place(panelRef.current, triggerRef.current);
      focusables(panelRef.current)[0]?.focus();
    });
    const onResize = () => place(panelRef.current, triggerRef.current);
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); };
  }, [state]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger(open, {
        ref: triggerRef,
        onClick: () => setState((s) => ({ open: !s.open, restore: false })),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
      })}
      {open && (
        <>
          {/* Click-away. Not focusable and hidden from assistive tech — Escape
              is the keyboard's way out, and a bare scrim in the tab order is a
              stop that does nothing. */}
          <div aria-hidden onClick={dismiss} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label={label}
            // Escape here closes THIS panel. Radix's own listener on the task's panel runs first (capture, on the
            // document) and closed the whole task instead — so the panel says it owns the key (page-view.tsx).
            data-owns-escape
            className={`${OVERLAY_CLASS} zb-enter`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              // A text input owns its own arrow keys (caret to start/end).
              if ((e.target as HTMLElement).tagName === 'INPUT') return;
              e.preventDefault();
              const items = focusables(panelRef.current);
              if (!items.length) return;
              const i = items.indexOf(document.activeElement as HTMLElement);
              const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
              items[(next + items.length) % items.length].focus();
            }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 'var(--z-dropdown)', width,
              // Edge, fill, corner and shadow are the one overlay chrome (className).
              padding: 4, transformOrigin: 'top left',
              animation: 'zb-pop-in var(--duration-base) var(--ease-out-quiet)',
            }}
          >
            {children(close)}
          </div>
        </>
      )}
    </span>
  );
}

/** Gutter kept between the panel and the edge of the window. */
const EDGE_MARGIN = 8;

/**
 * Keep the panel inside the window.
 *
 * A panel is left-aligned to its chip, which is right until the chip is far
 * enough right that 252px of panel does not fit beside it. Measured at 375px,
 * a chip at x=221 pushed the panel's right edge to 473 and made the whole
 * DOCUMENT scroll sideways — the failure the responsive rules exist to prevent,
 * and one every chip in this row had.
 *
 * Written to the DOM rather than held in state: this is an effect synchronising
 * an external system with a measurement, which is what effects are for, and it
 * avoids a second render for something the user must never see mid-flight.
 */
function place(panel: HTMLDivElement | null, trigger: HTMLElement | null) {
  if (!panel || !trigger) return;
  const vw = document.documentElement.clientWidth;   // excludes any scrollbar
  panel.style.maxWidth = `${vw - EDGE_MARGIN * 2}px`;
  const t = trigger.getBoundingClientRect();
  const w = panel.offsetWidth;
  let left = 0;
  // Pull it back in if it would leave the right edge…
  if (t.left + w > vw - EDGE_MARGIN) left = vw - EDGE_MARGIN - w - t.left;
  // …but never so far that it leaves the left one.
  if (t.left + left < EDGE_MARGIN) left = EDGE_MARGIN - t.left;
  panel.style.left = `${Math.round(left)}px`;
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])'))
    .filter((el) => !el.hasAttribute('disabled'));
}

/**
 * A property chip — the look of every control in the task panel's chip row. `active` means the chip CARRIES a
 * value (not hover).
 *
 * A chip with a value is filled; an empty one is a ghost — its word and glyph in secondary ink, a wash only
 * under the pointer or while its panel is open. Ten equal grey pills read as ten things set on the task, when
 * three were (user report 2026-09-21: "so much cluttered"). Fill marks the value; the empty control is the
 * outline of it — one control, recoloured by state, never two.
 *
 * Classes rather than a style object, because an empty chip needs a hover wash an inline style cannot give.
 * The metrics are `Button size="sm"`'s (28px, `px-2.5`, `text-ui`, 500). No transition class: every chip is a
 * `<button>`, and the global button rule (globals.css, unlayered) carries the press AND the hover curve — it
 * outranks any Tailwind transition utility, so one here would be dead weight that claims to be in charge.
 */
export const chipClass = (active: boolean): string => cn(
  'focus-ring inline-flex h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[var(--r-sm)] border-0 px-2.5 text-ui font-medium',
  active
    ? 'bg-surface-selected text-ink-900'
    : 'bg-transparent text-ink-600 hover:bg-surface-hover hover:text-ink-800 aria-expanded:bg-surface-hover aria-expanded:text-ink-800',
);

/**
 * Every panel row carries this alongside `popRow`. 32px is the right height
 * for a mouse and unusable for a thumb, so a coarse pointer gets 44px
 * (app/ds-theme.css). It travels next to the style object so the two cannot
 * drift apart at a call site.
 */
export const POP_ROW_CLASS = 'touch-row';

/** One row inside a panel. Pair with `POP_ROW_CLASS`. */
export const popRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px',
  borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--text-small-size)',
  background: 'transparent', color: 'var(--ink-2)', border: 'none',
};

/**
 * A panel row's selection mark. The slot is always there, so every name in the panel starts on one column; the
 * check is drawn only on the chosen row. It used to be drawn on EVERY row at 15% opacity — a faded mark, which the
 * colour rules forbid, and one that read as "all of these are ticked" at a glance (2026-09-21). The DS menus draw
 * their indicator the same way. Pair it with `aria-pressed` on the row (or `aria-checked` on a switch): the mark is
 * what an eye reads, the attribute is what a screen reader reads.
 */
export function SelectMark({ on }: { on: boolean }) {
  return <Icon icon={Check} size={12} aria-hidden style={{ flexShrink: 0, color: 'var(--ink)', visibility: on ? 'visible' : 'hidden' }} />;
}

/** A panel's section heading — matches DS `MenuLabel` in voice and scale. */
export const popLabel: React.CSSProperties = {
  display: 'block', padding: '4px 8px 2px', fontSize: 'var(--text-label-size)',
  fontWeight: 500, color: 'var(--text-secondary)',
};
