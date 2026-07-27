import * as React from "react";
import * as RDlg from "@radix-ui/react-dialog";
import { X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

// design-system.md §4.37 — a panel that slides from the right and keeps the
// context visible. A MODAL drawer (create-new) gets a scrim; a DETAIL drawer
// does not — the list behind stays clickable. Inset by the shell's 4px margin:
// the drawer sits on the desk, never breaks the frame.

const WIDTH = { sm: 360, md: 480, lg: 640, xl: 800 } as const;

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
  children,
}: DrawerProps) {
  const [width, setWidth] = React.useState<number>(WIDTH[size]);
  const [dragging, setDragging] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => setWidth(WIDTH[size]), [size]);

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <RDlg.Portal>
        {modal && (
          <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-fadein" />
        )}
        <RDlg.Content
          onOpenAutoFocus={(e) => {
            // Non-modal drawers move focus to the heading, not trap (§4.37).
            e.preventDefault();
            headingRef.current?.focus();
          }}
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          className={cn(
            // Inset by the shell's 4px margin — on the desk, inner corners only.
            "fixed bottom-1 end-1 top-1 z-modal flex flex-col overflow-hidden",
            "rounded-s-lg border border-line bg-paper shadow-lift-3",
            "data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
          )}
          style={{ width: `min(${width}px, calc(100vw - 64px))` }}
        >
          {/* Resize handle on the inner edge (§4.37) */}
          {resizable && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                setDragging(true);
              }}
              onPointerMove={(e) => {
                if (!dragging) return;
                setWidth(Math.min(960, Math.max(320, window.innerWidth - e.clientX - 4)));
              }}
              onPointerUp={(e) => {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                setDragging(false);
              }}
              className="group absolute inset-y-0 start-0 z-10 w-2 cursor-col-resize"
            >
              <span
                className={cn(
                  "absolute inset-y-2 start-0.5 w-0.5 rounded-full transition-colors",
                  dragging ? "bg-berry-500" : "bg-transparent group-hover:bg-berry-500",
                )}
              />
            </div>
          )}

          <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-4 py-3">
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
// Grabber + detents (peek 40 / half 60 / full 100−24px). Drag between them;
// >25% downward past the lowest detent dismisses.
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  detent?: "peek" | "half" | "full";
  children: React.ReactNode;
}

const DETENTS = { peek: 0.4, half: 0.6, full: 1 } as const;

export function BottomSheet({ open, onOpenChange, title, detent: initial = "half", children }: BottomSheetProps) {
  const [detent, setDetent] = React.useState(initial);
  const [dragY, setDragY] = React.useState(0);
  const start = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (open) setDetent(initial);
  }, [open, initial]);

  const heightFor = (d: keyof typeof DETENTS) =>
    d === "full" ? "calc(100dvh - 24px)" : `${DETENTS[d] * 100}dvh`;

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDragY(Math.max(0, e.clientY - start.current));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    const h = window.innerHeight * DETENTS[detent];
    if (dragY > h * 0.25) {
      // past 25% → next detent down, or dismiss from the lowest
      if (detent === "full") setDetent("half");
      else if (detent === "half") setDetent("peek");
      else onOpenChange(false);
    } else if (dragY < -h * 0.15) {
      if (detent === "peek") setDetent("half");
      else if (detent === "half") setDetent("full");
    }
    setDragY(0);
    start.current = null;
  };

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange}>
      <RDlg.Portal>
        <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] data-[state=open]:animate-fadein" />
        <RDlg.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-modal flex flex-col rounded-t-lg border border-b-0 border-line bg-paper shadow-lift-3",
            "data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
            !dragY && "transition-[height] duration-base ease-standard",
          )}
          style={{ height: heightFor(detent), transform: dragY ? `translateY(${dragY}px)` : undefined }}
        >
          {/* Grabber — 32×4 ink-300, the drag handle (§4.38) */}
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
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
