"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * THE resize handle on a panel's inner edge — PageView's side peek and the DS
 * Drawer (§2.11). Ink, never accent; focus-ringed; keyboard-operable, because a
 * pointer-only handle is not a control (the arrows move it 24px).
 *
 * The pointer drives the ELEMENT, and the width is committed once, on release
 * (Emil Kowalski: write the element directly during a drag, not state per move).
 * Both handles used to commit on every pointermove, and they were two copies of
 * one control: PageView wrote localStorage and re-rendered the whole open page per
 * move — measured, 40 moves made 40 synchronous storage writes, 3.7ms median and
 * 14.8ms worst per move on a light page — and the Drawer re-rendered its content.
 *
 * The panel must size itself with `width: min(<w>px, calc(100vw - 64px))`, the same
 * expression written here, so the commit re-renders to exactly where the drag left it.
 */
export function PanelResizeHandle({ width, min, max, onWidth }: {
  width: number;
  min: number;
  max: number;
  onWidth: (w: number) => void;
}) {
  const drag = React.useRef<{ id: number; panel: HTMLElement; w: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const clamp = (w: number) => Math.min(max, Math.max(min, Math.round(w)));

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    onWidth(d.w);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); onWidth(clamp(width + 24)); }
        if (e.key === "ArrowRight") { e.preventDefault(); onWidth(clamp(width - 24)); }
      }}
      onPointerDown={(e) => {
        const panel = e.currentTarget.parentElement;
        if (drag.current || !panel) return;          // one pointer drives the handle
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, panel, w: width };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        d.w = clamp(window.innerWidth - e.clientX - 4);
        d.panel.style.width = `min(${d.w}px, calc(100vw - 64px))`;
        e.currentTarget.setAttribute("aria-valuenow", String(d.w));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      className="focus-ring group absolute inset-y-0 start-0 z-10 w-2 cursor-col-resize rounded-xs"
    >
      <span
        className={cn(
          "absolute inset-y-2 start-0.5 w-0.5 rounded-full transition-colors duration-fast",
          dragging ? "bg-ink-500" : "bg-transparent group-hover:bg-ink-400",
        )}
      />
    </div>
  );
}
