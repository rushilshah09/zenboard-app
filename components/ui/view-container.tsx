import { cn } from '@/lib/cn';
import type { CSSProperties, ReactNode } from 'react';

// The one page-content container — the responsive layout primitive. It centers a
// reading-width column within WHATEVER workspace it's dropped into: the full
// viewport on single-pane pages (Home, Inbox), or the area left of a secondary
// sidebar on two-pane pages (Tasks), because `mx-auto` centers within the parent,
// not the viewport. No page hand-rolls margins to fake centering anymore.
//
//  - width caps at `--view-maxw` (the Home reading column) and centers via mx-auto
//  - horizontal gutters come from `--view-px` (responsive: 40px desktop / 28px ≤tablet)
//  - `full` opts out of the max-width for canvas/workspace pages (Calendar, boards,
//    editors) that legitimately want the whole available width
//  - vertical padding stays per-view (pass via className) since headers, scroll
//    regions, and sticky bars differ page to page
export function ViewContainer({ full = false, className, style, children }: {
  full?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cn('mx-auto w-full px-[var(--view-px)]', !full && 'max-w-[var(--view-maxw)]', className)}
    >
      {children}
    </div>
  );
}
