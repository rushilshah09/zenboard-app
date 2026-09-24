import { cn } from '@/lib/cn';
import type { CSSProperties, ReactNode } from 'react';

// THE one page-content container — the responsive layout primitive. It centers a
// column within WHATEVER workspace it's dropped into: the full viewport on
// single-pane pages (Home, Inbox), or the area left of a secondary sidebar on
// two-pane pages (Tasks), because `mx-auto` centers within the parent, not the
// viewport.
//
// ── THREE WIDTHS, BECAUSE THE APP HAS THREE KINDS OF PAGE ───────────────────
// This used to offer one width plus a `full` escape hatch, and the consequence
// was that the hubs needing the middle one re-derived it by hand:
//
//     cn('px-[clamp(18px,3vw,40px)] pb-16 pt-8', !full && 'mx-auto max-w-[1200px]')
//
// — the same line, three times, across Clients and Projects, hard-coding a
// width and a gutter that tokens already express, and re-implementing this
// component's own `full` opt-out along the way. Three copies of one idea is
// exactly the duplication CONSISTENCY_PRINCIPLE.md forbids, and this file's
// comment claimed "no page hand-rolls margins to fake centering anymore" while
// three of them did.
//
// The fix is not to force everything to one number. 1200 was not arbitrary: a
// two-pane hub's detail pane holds two columns of content BESIDE a rail, and
// the 978px reading column is genuinely too tight for that. So the second width
// is named and put in the system, which is what "the layout adapts when the use
// case requires it, while following the same rules" means in practice.
//
//   reading  --view-maxw (978px) · one column you read down. Home, Tasks,
//            Forms, Habits, Memory, Money, Settings.
//   wide     --view-maxw-wide (1200px) · a detail pane that lays content out in
//            columns beside a rail. Clients, Projects.
//   full     no cap · canvas and workspace pages that legitimately want every
//            pixel. Calendar, boards, editors.
//
// Horizontal gutters come from `--view-px`, which is FLUID
// (`clamp(18px, 3vw, 40px)`). It was a flat 40px until these hubs were merged
// in — their hand-rolled clamp turned out to be the better rule, so the token
// took it rather than the hubs taking the 40. `--view-px` also steps down under
// the compact density setting. (An older comment here claimed "40px desktop /
// 28px ≤tablet"; that 28 is the DENSITY value, not a breakpoint, and the claim
// was wrong.)
//
// Vertical padding stays per-view (pass via className): headers, scroll regions
// and sticky bars differ page to page, and pretending otherwise is how a
// primitive grows a prop per screen.
export type ViewWidth = 'reading' | 'wide' | 'full';

const MAXW: Record<ViewWidth, string | false> = {
  reading: 'max-w-[var(--view-maxw)]',
  wide: 'max-w-[var(--view-maxw-wide)]',
  full: false,
};

export function ViewContainer({ width = 'reading', className, style, children }: {
  /** Which of the app's three page widths this is. Defaults to the reading column. */
  width?: ViewWidth;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cn('mx-auto w-full px-[var(--view-px)]', MAXW[width], className)}
    >
      {children}
    </div>
  );
}
