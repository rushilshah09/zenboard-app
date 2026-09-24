import * as React from "react";
import { cn } from "@/lib/cn";
import { Count } from "./count";

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
  /** Optional count shown after the title (muted). A COUNT — a number.
   *
   *  It was typed `ReactNode`, which let anything through, and TWO callers were
   *  passing a prose summary instead ("3 things, 1 overdue", "Filming at 09:00
   *  · 1 going out"). One prop was quietly doing two jobs, and they do not want
   *  the same typography: a count is `tabular-nums` so the row does not shift
   *  when 9 becomes 10, while tabular figures inside a SENTENCE read as
   *  mechanical. Narrowed here; prose moved to `summary` below. */
  count?: number | string;
  /** A short prose note after the title — "3 things, 1 overdue". Proportional
   *  figures on purpose; see the note on `count`. Pass one or the other. */
  summary?: string | null;
  /** Right-aligned action(s) — e.g. an Add button or a kebab. */
  action?: React.ReactNode;
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { icon, title, count, summary, action, className, children, ...props },
  ref,
) {
  const canonical = title != null || icon != null || action != null;
  return (
    <div
      ref={ref}
      className={cn("flex min-h-11 w-full shrink-0 items-center justify-between gap-2 px-[var(--panel-px)] py-2", className)}
      {...props}
    >
      {canonical ? (
        <>
          <div className="flex min-w-0 items-center gap-1 text-ink-500 [&_svg]:size-4">
            {icon}
            {/* A heading, not a span: a card's title is a section of the page, and a screen-reader user moves by
                headings — Home's seven cards were absent from the outline (2026-09-22). Looks exactly as it did. */}
            {title != null && <h2 className="m-0 truncate text-[14px] font-medium leading-none">{title}</h2>}
            {count != null && <Count value={count} className="ms-0.5" />}
            {summary ? <span className="ms-0.5 shrink-0 text-caption text-ink-500">{summary}</span> : null}
          </div>
          {action}
        </>
      ) : (
        children
      )}
    </div>
  );
});

/** The inset every direct child of a panel shares with the panel's header.
 *
 *  `PanelBody` deliberately does NOT pad itself — a row needs full-bleed hover
 *  and selection, so the padding belongs to the row, not the container. But
 *  "the consumer owns it" (what this comment used to say) meant each consumer
 *  picked: measured on Home, headers at 16px above rows at 12 and 14, so a
 *  header and its own rows were misaligned by 2 and 4px inside one card.
 *  The container still doesn't pad; it just says what the number is. */
export const PANEL_PX = "px-[var(--panel-px)]";

// Inner body — B&G (Figma 1:799/1:821): a #303030 card with its own 12px radius
// floating inside the #1E1E1E shell, separated by surface contrast (no border).
// The shell still clips the bottom. Rows pad themselves, with PANEL_PX.
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
