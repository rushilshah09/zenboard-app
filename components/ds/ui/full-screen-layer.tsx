'use client';
import * as React from "react";
import { useFocusReturn } from '@/lib/use-focus-return';
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

// The layer the design system was missing.
//
// `<Modal>` is a card: a decision or a short form, 400–720px, with a title bar
// and a ×. Four surfaces in this app are not that — they take the WHOLE screen
// because the screen is the point: the triage queue (one thought, big type), the
// ritual flow (a calm guided sequence), the client-portal preview (a framed copy
// of what someone else sees), the image lightbox. Forcing those into a 560px
// card would destroy each one, so each hand-rolled `position: fixed` instead —
// and each arrived at a different subset of the same contract:
//
//   layer            z         role/label   Esc   focus in   focus back   scroll lock
//   ritual flow      100       ✗            ✗     ✗          ✗            ✗
//   triage           190       ✓            ✓     ✓          ✗            ✗
//   portal preview   z-modal   ✗            ✓     ✗          ✗            ✗
//   image lightbox   200       ✓            ✓     ✗          ✗            ✓
//
// Three raw z-values for one layer, one screen reader announcement out of four,
// and nobody gave focus back on close — so dismissing any of them dropped the
// keyboard user at the top of the document. This owns all six columns once.
//
// It is deliberately NOT Radix Dialog: a Radix focus trap fights triage's
// window-level key grammar and the lightbox's arrow-key paging, both of which
// have to keep working while focus sits on the layer root itself.

export interface FullScreenLayerProps {
  /** Accessible name. Every layer says what it is — three of the four didn't. */
  label: string;
  onClose: () => void;
  /**
   * `canvas` — an opaque surface; the app is *gone* and this is a mode (triage,
   * rituals). `scrim` — the app dims behind, you're looking at something over
   * your work (the portal preview). `dark` — a viewer, where the surroundings
   * should disappear so the content reads (the image lightbox).
   */
  surface?: "canvas" | "scrim" | "dark";
  /** Backdrop click closes. Only meaningful with `scrim`/`dark`. */
  dismissOnBackdrop?: boolean;
  /**
   * Escape closes. Turn OFF when the layer runs its own Escape ladder — triage
   * steps back out of a sub-panel first and only then exits.
   */
  closeOnEscape?: boolean;
  /**
   * How it arrives. `fade` is the default; `blur` is the slower, softer entrance
   * the ritual flow uses, where the whole point is to slow the user down. Two
   * named entrances, both from the motion system — not a `style` escape hatch.
   */
  enter?: "fade" | "blur";
  className?: string;
  children: React.ReactNode;
}

const SURFACE: Record<NonNullable<FullScreenLayerProps["surface"]>, string> = {
  canvas: "bg-canvas",
  scrim: "bg-[var(--color-scrim)] backdrop-blur-[2px]",
  dark: "bg-black/80 backdrop-blur-[2px]",
};

// Nothing to subscribe to — the value never changes after hydration.
const subscribeNever = () => () => {};

const ENTER = {
  fade: "zb-enter animate-fadein",
  blur: "zb-enter [animation:blurin_var(--duration-slow)_var(--ease-out-quiet)]",
} as const;

export function FullScreenLayer({
  label,
  onClose,
  surface = "canvas",
  dismissOnBackdrop = false,
  closeOnEscape = true,
  enter = "fade",
  className,
  children,
}: FullScreenLayerProps) {
  // Mounted only while the layer is up; its close hands focus back.
  useFocusReturn();
  const rootRef = React.useRef<HTMLDivElement>(null);
  // `createPortal` needs a real `document`. Most layers only mount on a click so
  // SSR never sees them — but the ritual flow renders straight off its route, so
  // it does. `useSyncExternalStore` is the hydration-safe way to ask "am I on
  // the client yet": it returns the server snapshot during hydration and then
  // re-renders, with no mismatch and no setState-in-an-effect.
  const mounted = React.useSyncExternalStore(subscribeNever, () => true, () => false);

  // Focus in on mount, and — the part every one of them forgot — back to
  // whatever opened the layer on the way out. Without it, closing triage drops
  // a keyboard user at the top of the document with no idea where they are.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // The page behind must not scroll under the layer. Only the lightbox did this.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  React.useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEscape, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={dismissOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      className={cn("fixed inset-0 z-fullscreen outline-none", ENTER[enter], SURFACE[surface], className)}
    >
      {children}
    </div>,
    document.body,
  );
}
