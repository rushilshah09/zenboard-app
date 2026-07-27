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
import type { IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { cx } from './primitives';
import { Check } from "@/components/ds/icons";

// ── Popover ──────────────────────────────────────────────────
// bg --paper-2 · 1px --line-pop ring · --shadow-lg (overlay) · entrance per
// §4.7 (fade + 4px rise + 0.98 scale, --dur-base). `variant`:
//   menu  → radius --r-md, 4px body padding (plain dropdowns)
//   rich  → radius --r-lg, no padding (headers/sections pad themselves)
// Max-height 60vh with internal scroll (§5.24).
export function Popover({ variant = 'menu', width, className, style, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'menu' | 'rich'; width?: number | string;
}) {
  return (
    <div
      className={cx(
        // Canonical overlay chrome — matches DS MenuPanel/DropdownMenu/Popover
        // (surface-raised lifted gray, line-strong, rounded-lg, shadow-lift-2).
        'bg-surface-raised border border-line-strong shadow-lift-2 overflow-y-auto max-h-[60vh] rounded-lg',
        'animate-[zb-pop-in_var(--dur-base)_var(--ease-out)]',
        variant === 'menu' ? 'p-1.5' : '',
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
        'flex items-center gap-2 w-full h-8 px-2 rounded-sm text-left text-[13px] cursor-pointer',
        'bg-transparent border-0 transition-colors [transition-duration:var(--dur-instant)]',
        destructive ? 'text-(--red-text) hover:bg-(--red-bg)' : 'text-ink-2 hover:bg-hover',
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
  return <div aria-hidden className="h-px bg-line-2 my-1 -mx-1" />;
}

// micro uppercase group label (§5.12/§5.16).
export function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-micro uppercase text-ink-5">
      {children}
    </div>
  );
}

// ── Modal (DS §5.20) ─────────────────────────────────────────
// Centered panel: sm 400 / md 520 / lg 680 · --paper-3 · radius --r-lg ·
// --shadow-lg (overlay) · scrim rgba(21,19,17,0.4) fading in over --dur-base,
// panel scaling 0.97→1 over --dur-slow. Esc + scrim click close.
const MODAL_W = { sm: 400, md: 520, lg: 680 } as const;

export function Modal({ size = 'md', onClose, scrimClose = true, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  size?: keyof typeof MODAL_W; onClose?: () => void; scrimClose?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center pt-[18vh] px-4 bg-(--scrim) animate-[fadein_var(--dur-base)_var(--ease-out)]"
      style={{ ['--scrim' as string]: 'rgba(21,19,17,0.4)' }}
      onMouseDown={(e) => { if (scrimClose && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cx(
          'bg-paper-3 rounded-lg shadow-(--shadow-lg) w-full max-h-[70vh] overflow-y-auto',
          'animate-[zb-modal-in_var(--dur-slow)_var(--ease-out)]',
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
