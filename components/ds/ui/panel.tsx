import * as React from "react";
import { cn } from "@/lib/cn";

// Framed panel — the app's primary CARD pattern (Figma "zb-highlight-card", node
// 23:7480). A sunken paper shell that frames a raised inner body, used for the Home
// cards (highlight / plan / schedule) and any "titled container" screen.
//
// Border architecture (one visual line at every edge):
//   · the SHELL owns the single outer border — its "Shadow 1" ring (frame="shadow")
//     or a hairline (frame="border") — and clips the body's bottom to the radius.
//   · the BODY draws ONLY the header divider (border-top); it never repeats a
//     side/bottom border, so edges never double up.
//
// Everything is token-driven — radius (--radius-panel), elevation (--shadow-panel),
// surfaces (surface-sunken / surface-raised) and the hairline (line) — so every new
// panel inherits the exact styling and any token change propagates everywhere.
// Dark mode follows automatically (the ring and surfaces are theme-aware tokens).

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** shadow = the elevated "Shadow 1" lift (default); border = a flat hairline (banners). */
  frame?: "shadow" | "border";
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { frame = "shadow", className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col overflow-hidden rounded-panel bg-surface-sunken",
        frame === "shadow" ? "shadow-panel" : "border border-line",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// Header strip on the shell — 44px min height, 8/16 padding. The CANONICAL card
// title lives here so every card header is identical by construction: an 18px
// leading glyph + a 16px medium title in header-ink + an optional muted count, with
// actions pinned right. Pass `icon`/`title`/`count`/`action` (never restyle a title
// per screen). `children` is a fallback for fully custom header content.
export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Leading glyph — pass a bare <Icon/> (no colour); the header inks it to match the title. */
  icon?: React.ReactNode;
  /** Canonical title text — 16px medium, header ink. */
  title?: React.ReactNode;
  /** Optional count/badge shown after the title (muted). */
  count?: React.ReactNode;
  /** Right-aligned action(s) — e.g. an Add button or a kebab. */
  action?: React.ReactNode;
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { icon, title, count, action, className, children, ...props },
  ref,
) {
  const canonical = title != null || icon != null || action != null;
  return (
    <div
      ref={ref}
      className={cn("flex min-h-11 w-full shrink-0 items-center justify-between gap-2 px-4 py-2", className)}
      {...props}
    >
      {canonical ? (
        <>
          <div className="flex min-w-0 items-center gap-1 text-ink-500 [&_svg]:size-[18px]">
            {icon}
            {title != null && <span className="truncate text-[14px] font-medium leading-none">{title}</span>}
            {count != null && <span className="ms-0.5 shrink-0 text-[12px] tabular-nums text-ink-400">{count}</span>}
          </div>
          {action}
        </>
      ) : (
        children
      )}
    </div>
  );
});

// Inner body — B&G (Figma 1:799/1:821): a #303030 card with its own 12px radius
// floating inside the #1E1E1E shell, separated by surface contrast (no border).
// The shell still clips the bottom. Consumers own the content padding.
export const PanelBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function PanelBody({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex w-full flex-col overflow-hidden rounded-panel bg-paper-4 shadow-lift-1", className)}
        {...props}
      />
    );
  },
);
