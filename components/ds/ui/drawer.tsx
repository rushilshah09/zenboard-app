import * as React from "react";
import * as RDlg from "@radix-ui/react-dialog";
import { PanelResizeHandle } from "./panel-resize";
import { X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { MIN_WIDTH, MAX_WIDTH } from "@/lib/page-view-mode";
import { IconButton } from "./icon-button";
import { useChanged } from "@/lib/use-changed";

// design-system.md §4.37 — a panel that slides from the right.
//
// SCOPE: use <Drawer> ONLY for a MODAL create/config form (share a project,
// edit a habit's settings) — a decision the user commits with a footer button.
// For opening a RECORD (its detail, its editor) use <PageView>, the one detail
// shell (side/center/full · persisted width & mode). This drawer deliberately
// mirrors PageView's chrome — same radius, header height, resize handle and
// width bounds — so the two never look like two different panels (§2.11).
//
// A MODAL drawer gets a scrim + focus trap; a non-modal one leaves the list
// behind clickable. Inset by the shell's 4px margin: it sits on the desk, all
// four corners rounded, never breaking the frame.

const WIDTH = { sm: 360, md: 480, lg: 640, xl: 800 } as const;
// Resize bounds are PageView's, exactly — a drawer and a side peek clamp to the
// same MIN/MAX, so neither can be dragged to a width the other can't reach.
const RESIZE_MIN = MIN_WIDTH;

export interface DrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  size?: keyof typeof WIDTH;
  /** modal = scrim + focus trap (create flows). Non-modal = detail views. */
  modal?: boolean;
  title: string;
  /** Header actions (⋮, expand). × is built in. */
  actions?: React.ReactNode;
  /** Footer only if there's a commit action; detail drawers auto-save (§4.37). */
  footer?: React.ReactNode;
  /** Auto-save stamp, e.g. "Saved just now" — shown when there's no footer. */
  savedStamp?: string;
  resizable?: boolean;
  /**
   * A COMPANION works alongside whatever is open rather than over it — Ask's panel, which is
   * usually asked about the page beneath it. A modal layer beneath (a full-page PageView) does two
   * things to anything outside it, and both are wrong for a companion:
   *   · a press inside it reads as a press OUTSIDE the layer, which dismisses the layer. PageView
   *     exempts `[data-companion]` for that, as it exempts toasts;
   *   · its scroll lock cancels every wheel and touch-move outside the layer (react-remove-scroll,
   *     which has no opt-out), so the companion could not scroll. A companion's own wheel and
   *     touch-moves stop at its edge instead, before the document listener that cancels them —
   *     and the browser scrolls it natively, as it would anywhere else.
   */
  companion?: boolean;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onOpenChange,
  size = "md",
  modal = false,
  title,
  actions,
  footer,
  savedStamp,
  resizable = true,
  companion = false,
  children,
}: DrawerProps) {
  const [width, setWidth] = React.useState<number>(WIDTH[size]);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  // The content element as STATE, not a ref: it mounts through a portal a render after `open`
  // flips, so an effect reading a ref ran while it was still null and never ran again — the
  // companion's listener was simply never attached (found by the must-fail control, 2026-09-29).
  const [content, setContent] = React.useState<HTMLDivElement | null>(null);

  // See `companion`. Passive: only propagation is stopped, never the scroll itself.
  React.useEffect(() => {
    if (!companion || !content) return;
    const stop = (e: Event) => e.stopPropagation();
    content.addEventListener("wheel", stop, { passive: true });
    content.addEventListener("touchmove", stop, { passive: true });
    return () => {
      content.removeEventListener("wheel", stop);
      content.removeEventListener("touchmove", stop);
    };
  }, [companion, content]);

  if (useChanged(size)) setWidth(WIDTH[size]);

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <RDlg.Portal>
        {modal && (
          <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] zb-enter data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout" />
        )}
        <RDlg.Content
          ref={setContent}
          data-companion={companion ? "" : undefined}
          onOpenAutoFocus={(e) => {
            // Non-modal drawers move focus to the heading, not trap (§4.37).
            e.preventDefault();
            headingRef.current?.focus();
          }}
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          className={cn(
            // Inset by the shell's 4px margin — floats on the desk, so all four
            // corners are rounded (matches PageView's side peek, §2.11).
            "fixed bottom-1 end-1 top-1 z-modal flex flex-col overflow-hidden",
            "rounded-lg border border-line bg-paper shadow-lift-3",
            "zb-enter data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
          )}
          style={{ width: `min(${width}px, calc(100vw - 64px))` }}
        >
          {/* Resize handle on the inner edge — identical to PageView's (§2.11):
              ink (never accent), keyboard-operable, focus-ringed, same bounds. */}
          {resizable && <PanelResizeHandle width={width} min={RESIZE_MIN} max={MAX_WIDTH} onWidth={setWidth} />}

          <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-4 py-2.5">
            <RDlg.Title asChild>
              <h2 ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-title-4 text-ink-900 outline-none">
                {title}
              </h2>
            </RDlg.Title>
            {actions}
            <RDlg.Close asChild>
              <IconButton label="Close" tooltip="Close · Esc" icon={<X className="size-4" />} variant="ghost" size="sm" />
            </RDlg.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 [overscroll-behavior:contain]">{children}</div>

          {footer ? (
            <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft bg-paper-2 px-4 py-3">{footer}</footer>
          ) : (
            savedStamp && (
              <footer className="shrink-0 border-t border-line-soft px-4 py-2 text-end text-meta text-ink-500" role="status">
                {savedStamp}
              </footer>
            )
          )}
        </RDlg.Content>
      </RDlg.Portal>
    </RDlg.Root>
  );
}

// ── Bottom sheet (§4.38, touch) ──────────────────────────────────────────────
// Grabber + detents (peek 40 / half 60 / full 100−24px). The drag follows Emil
// Kowalski's gesture rules, which is where this sheet used to fall short:
//   · a FLICK acts regardless of distance — velocity over 0.11px/ms is intent,
//     and making someone drag a quarter of the screen to dismiss is friction;
//   · pulling UP past the top meets friction instead of a wall (it was clamped
//     at zero, which also left the swipe-up-to-expand branch unreachable);
//   · one finger drives: a second pointer mid-drag is ignored rather than
//     re-anchoring the sheet under a different finger;
//   · the drag writes `transform` straight to the element, not React state per
//     pointermove, and the release eases home on the drawer curve.
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  detent?: "peek" | "half" | "full";
  children: React.ReactNode;
}

const DETENTS = { peek: 0.4, half: 0.6, full: 1 } as const;
type Detent = keyof typeof DETENTS;

/** Emil's flick threshold, in px per millisecond. */
export const FLICK_VELOCITY = 0.11;

/**
 * iOS-style rubber band: past an edge the sheet still moves, less and less the
 * further it is pulled, and never more than `dim`.
 */
export function rubberBand(dist: number, dim: number, c = 0.55): number {
  if (dist <= 0 || dim <= 0) return 0;
  return (1 - 1 / ((dist * c) / dim + 1)) * dim;
}

/**
 * What a released drag means. Pure, so the gesture rules are tested rather than
 * felt out on a phone: `dy` is the finger's travel (+ is down), `ms` how long the
 * drag lasted, `height` the sheet's height at this detent.
 */
export function sheetRelease(dy: number, ms: number, height: number): "down" | "up" | "stay" {
  const velocity = dy / Math.max(1, ms);
  // A tap that jitters a few pixels is not a flick, however fast it measures.
  const flick = Math.abs(dy) > 8 && Math.abs(velocity) > FLICK_VELOCITY;
  if (dy > height * 0.25 || (flick && velocity > 0)) return "down";
  if (dy < -height * 0.15 || (flick && velocity < 0)) return "up";
  return "stay";
}

export function BottomSheet({ open, onOpenChange, title, detent: initial = "half", children }: BottomSheetProps) {
  const [detent, setDetent] = React.useState<Detent>(initial);
  const [dragging, setDragging] = React.useState(false);
  const sheet = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ id: number; y0: number; t0: number; dy: number } | null>(null);

  if (useChanged(open) && open) setDetent(initial);

  const heightFor = (d: Detent) =>
    d === "full" ? "calc(100dvh - 24px)" : `${DETENTS[d] * 100}dvh`;

  // Straight to the element: a React render per pointermove recalculates the
  // whole sheet's subtree sixty times a second for a value only the GPU needs.
  const place = (px: number) => { if (sheet.current) sheet.current.style.transform = px ? `translateY(${px}px)` : ""; };

  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current) return;                       // one finger drives the sheet
    drag.current = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = e.clientY - d.y0;
    const h = window.innerHeight * DETENTS[detent];
    place(d.dy >= 0 ? d.dy : -rubberBand(-d.dy, h));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const move = sheetRelease(d.dy, performance.now() - d.t0, window.innerHeight * DETENTS[detent]);
    if (move === "down") {
      if (detent === "full") setDetent("half");
      else if (detent === "half") setDetent("peek");
      else onOpenChange(false);
    } else if (move === "up") {
      if (detent === "peek") setDetent("half");
      else if (detent === "half") setDetent("full");
    }
    setDragging(false);
    place(0);
  };

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange}>
      <RDlg.Portal>
        <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] zb-enter data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout" />
        <RDlg.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-modal flex flex-col rounded-t-lg border border-b-0 border-line bg-paper shadow-lift-3",
            "zb-enter data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
            // Released, it eases home or on to the next detent on the drawer curve;
            // held, it tracks the finger exactly, with no transition in the way.
            !dragging && "transition-[height,transform] duration-slow ease-drawer",
          )}
          ref={sheet}
          style={{ height: heightFor(detent) }}
        >
          {/* Grabber — 32×4 ink-300, the drag handle (§4.38) */}
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span aria-hidden className="h-1 w-8 rounded-full bg-ink-300" />
          </div>
          <RDlg.Title className="border-b border-line-soft px-4 pb-3 text-title-4 text-ink-900">{title}</RDlg.Title>
          <div className={cn("min-h-0 flex-1 p-4", detent === "full" ? "overflow-y-auto [overscroll-behavior:contain]" : "overflow-hidden")}>
            {children}
          </div>
        </RDlg.Content>
      </RDlg.Portal>
    </RDlg.Root>
  );
}
