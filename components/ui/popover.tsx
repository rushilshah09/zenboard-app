'use client';
// Canonical overlay primitives (DS §5.24 Popover · §5.16 Dropdown/Menu ·
// §5.20 Modal). Every floating surface in the app — dropdowns, context menus,
// property selectors, pickers, dialogs — composes from these so radius,
// ring, shadow, spacing, animation, and hover language can never drift.
//
// Positioning stays with the caller (the codebase anchors popovers inline,
// usually absolute within a relative wrapper); these components own the
// surface itself.
import { useEffect, useRef } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import type { IconType } from "@/components/ds/icons";
import { Icon, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SEPARATOR_CLASS, OVERLAY_CLASS } from "@/components/ds/ui";
import { cx } from './primitives';
import { Check } from "@/components/ds/icons";

// ── Popover ──────────────────────────────────────────────────
// The one overlay chrome (OVERLAY_CLASS) · entrance per §4.7 (fade +
// 0.98 scale, --duration-base). `variant`:
//   menu  → radius --r-md, 4px body padding (plain dropdowns)
//   rich  → radius --r-lg, no padding (headers/sections pad themselves)
// Max-height 60vh with internal scroll (§5.24).
export function Popover({ variant = 'menu', width, className, style, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'menu' | 'rich'; width?: number | string;
}) {
  // Mounted only while open, so the cleanup is the close: focus goes back to
  // whatever opened this panel instead of falling to <body>.
  useFocusReturn();
  return (
    <div
      className={cx(
        // The one overlay chrome (OVERLAY_CLASS, components/ds/ui/menu.tsx).
        OVERLAY_CLASS, 'overflow-y-auto max-h-[60vh]',
        'origin-top zb-enter animate-[zb-pop-in_var(--duration-base)_var(--ease-out-quiet)]',
        variant === 'menu' ? 'p-1' : '',
        className,
      )}
      style={{ width, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

// 36px --paper-3 header strip (the DS v3 popover anatomy): 13/500 ink-3 title.
export function PopoverHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center h-9 px-3 bg-paper-3 text-[13px] font-medium text-ink-3 shrink-0', className)}>
      {children}
    </div>
  );
}

// ── Menu parts (DS §5.16) ────────────────────────────────────
// Rows: 32px pitch, radius --r-sm, 16px ink-5 icon, 13px ink-2 label, warm
// hover wash; destructive rows use the red chip pair; `selected` shows a
// trailing accent check.
export function MenuList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('p-1', className)}>{children}</div>;
}

export function MenuRow({ icon: Lead, selected, destructive, trailing, disabled, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconType; selected?: boolean; destructive?: boolean; trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        MENU_ITEM_CLASS,
        'bg-transparent border-0 transition-colors [transition-duration:var(--duration-fast)]',
        destructive ? 'text-(--red-text) hover:bg-(--red-bg)' : 'hover:bg-surface-hover',
        disabled && 'pointer-events-none text-disabled-text',
        className,
      )}
      {...props}
    >
      {Lead && <Icon icon={Lead} size={16} className={destructive ? undefined : 'text-ink-5'} />}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {selected && <Icon icon={Check} size={16} className="text-accent" />}
      {trailing}
    </button>
  );
}

export function MenuSeparator() {
  return <div aria-hidden className={MENU_SEPARATOR_CLASS} />;
}

// Micro group label (§5.12/§5.16) — the text-overline role, sentence case.
export function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={MENU_LABEL_CLASS}>
      {children}
    </div>
  );
}

// ── Modal (DS §5.20) ─────────────────────────────────────────
// Centered panel: sm 400 / md 520 / lg 680 · --paper-3 · radius --r-lg ·
// --shadow-lg (overlay) · scrim rgba(21,19,17,0.4) fading in over --duration-base,
// panel scaling 0.97→1 over --duration-slow. Esc + scrim click close.
const MODAL_W = { sm: 400, md: 520, lg: 680 } as const;

export function Modal({ size = 'md', onClose, scrimClose = true, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  size?: keyof typeof MODAL_W; onClose?: () => void; scrimClose?: boolean;
}) {
  useFocusReturn();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center pt-[18vh] px-4 bg-(--scrim) zb-enter animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]"
      style={{ ['--scrim' as string]: 'rgba(21,19,17,0.4)' }}
      onMouseDown={(e) => { if (scrimClose && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cx(
          'bg-paper-3 rounded-lg shadow-(--shadow-lg) w-full max-h-[70vh] overflow-y-auto',
          'zb-enter animate-[zb-modal-in_var(--duration-slow)_var(--ease-out-quiet)]',
          className,
        )}
        style={{ maxWidth: MODAL_W[size] }}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

// Header/body/footer per §5.20: title h3-ish 16/600, 20px padding rhythm,
// footer right-aligns its buttons.
export function ModalHeader({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5">
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function ModalBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 px-5 pb-5">{children}</div>;
}
