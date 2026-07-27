import * as React from "react";
import { cn } from "@/lib/cn";

// design-system.md §4.11 — Zenboard scrollbars + edge affordances on any overflow
// region. Native scrolling underneath (never JS-driven — that breaks momentum,
// ⌘F, and a11y). overscroll-behavior: contain; 24px fade only on edges that have
// content beyond them.
export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  axis?: "y" | "x";
  /** 24px fade masks on overflowing edges (§4.11). */
  fade?: boolean;
  /** Hide the native scrollbar visually while keeping scroll + fade (e.g. tab strips). */
  hideScrollbar?: boolean;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { axis = "y", fade, hideScrollbar, className, children, style, onScroll, ...props },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const ref = (forwardedRef as React.RefObject<HTMLDivElement>) ?? innerRef;
  const [edge, setEdge] = React.useState({ start: false, end: false });
  // A scrollable region with no focusable children must itself be keyboard
  // scrollable (WCAG 2.1.1 / §4.11) — give it tabindex 0 only in that case.
  const [selfFocusable, setSelfFocusable] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el || !fade) return;
    if (axis === "x") {
      setEdge({ start: el.scrollLeft > 0, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    } else {
      setEdge({ start: el.scrollTop > 0, end: el.scrollTop + el.clientHeight < el.scrollHeight - 1 });
    }
  }, [axis, fade, ref]);

  React.useEffect(() => {
    measure();
    const el = ref.current;
    if (el) {
      const focusable = el.querySelector('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      setSelfFocusable(!focusable);
    }
  }, [measure, children, ref]);

  const maskDir = axis === "x" ? "to right" : "to bottom";
  const maskImage = fade
    ? `linear-gradient(${maskDir}, ${edge.start ? "transparent" : "#000"} 0, #000 24px, #000 calc(100% - 24px), ${edge.end ? "transparent" : "#000"} 100%)`
    : undefined;

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        measure();
        onScroll?.(e);
      }}
      tabIndex={selfFocusable ? 0 : undefined}
      role={selfFocusable ? "group" : undefined}
      className={cn(
        "focus-ring rounded-[inherit] [overscroll-behavior:contain]",
        // Pin the cross-axis to `hidden` explicitly. Setting only one axis to
        // `auto` lets CSS coerce the other (specified `visible`) axis to `auto`
        // too — which produces spurious nested scrollbars whenever content
        // sub-pixel-overflows the cross axis. `hidden`+`auto` never coerces.
        axis === "x" ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto overflow-x-hidden",
        hideScrollbar && "zb-no-scrollbar",
        className,
      )}
      style={{ ...style, maskImage, WebkitMaskImage: maskImage }}
      {...props}
    >
      {children}
    </div>
  );
});
