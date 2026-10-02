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
// the surface (paper) and the hairline (line) — so every new panel inherits the exact
// styling and any token change propagates everywhere. Dark mode follows automatically
// (the ring and surfaces are theme-aware tokens).
//
// ── THE CARD IS DUAL-TONE, IN BOTH THEMES (user direction 2026-09-29) ──────
// The shell is `bg-surface-band` and the body is `bg-paper`: a sunken wrap holding a raised
// sheet, so the header sits on one tone and the content on another. That is the structure, and it
// is what the user means by a card having body rather than being a white rectangle with a line in
// it — they sent light and dark side by side to show it: *"like dark mode i want 2 colour in white
// mode, single white looks like wireframe"*, then pointed at Ask's composer, which is the same
// recipe with the band at the bottom.
//
// I FLATTENED THIS TO ONE TONE EARLIER THE SAME DAY and was wrong. The measurement behind it was
// real — in light the band was L 94.20 against a page of L 96.29, so a card's own header was darker
// than the ground it lies on, which is why four stacked bands read as stripes. But the answer to
// that is not to delete the second tone; it is that light had no rung between the page (0.968) and
// the card (1.0) for the band to use. Removing it made Home a wireframe, which is the exact
// failure [[zenboard-home-cards]] already recorded: a card must have weight even when nearly empty.
//
// THE RUNG IS PAID (2026-09-29, same day). `--band` — light oklch(0.981 0.0030 68), dark the
// `--muted` that already worked — reaches this shell as `bg-surface-band`. Light now ascends like
// dark does: page L* 96.29 -> band 97.70 -> body 100, and the band->body CONTRAST is 1.059
// against dark's 1.058, which is the number the light value was solved for. The
// shell is no longer `bg-surface-sunken`, because a RECESS INSIDE a surface and a card's band are
// two jobs that only looked like one in the theme where both happened to point down.
//
// Dark needed no argument either way: there the band already sits ABOVE the card, because dark
// lifts as it rises while light steps down from white.

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
        "flex flex-col overflow-hidden rounded-panel bg-surface-band",
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
      // Marked so a SKIN can reach it. Paper needs a rule here: it removes the tinted panel
      // ground entirely (nothing on a printed page or an e-ink page is a flat grey fill), and
      // without that tint the header would have nothing separating it from the rows below.
      data-slot="panel-header"
      className={cn("flex min-h-11 w-full shrink-0 items-center justify-between gap-2 px-[var(--panel-px)] py-2", className)}
      {...props}
    >
      {canonical ? (
        <>
          <div className="flex min-w-0 items-center gap-2 text-ink-500 [&_svg]:size-4">
            {icon}
            {/* A heading, not a span: a card's title is a section of the page, and a screen-reader user moves by
                headings — Home's seven cards were absent from the outline (2026-09-22).
                THE HEADING WAS QUIETER THAN ITS OWN CONTENT (2026-09-30). It was `text-[14px] font-medium`
                inheriting `text-ink-500` from the row above — measured on Home, all seven card titles rendered
                14px/500 at 6.1:1 while the body they head measured 7-12.26:1. A heading that is fainter and the
                same size as its body is not a heading; that inversion, repeated on every card in the app, is the
                single biggest reason the product read as a wireframe. `text-h2` is the DS's own declared role for
                this job ("card/featured titles: 16/22/600", globals.css) and this component's doc comment above
                has always said 16px medium — the role existed and the component was not consuming it. The wrapper
                keeps ink-500 so the GLYPH stays quiet; only the title steps forward. */}
            {title != null && <h2 className="m-0 truncate text-h2 leading-none text-ink-900">{title}</h2>}
            {count != null && <Count value={count} />}
            {summary ? <span className="shrink-0 text-caption text-ink-500">{summary}</span> : null}
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
        className={cn("flex w-full flex-col overflow-hidden rounded-panel bg-paper-4 shadow-xs", className)}
        {...props}
      />
    );
  },
);
