'use client';
// THE canvas layout — a page whose BODY owns its own geometry.
//
// The third of the app's three page archetypes; the decision rule for choosing
// between them is at the top of `page-layout.tsx`.
//
// A calendar grid, a week board, a pipeline of stage columns: these are not a
// column of content you read down, so they get the panel rather than the
// reading column. What they still share with every other page is the header row
// above them, the full-height flex column that lets them claim the space under
// it, and one entrance — and those are the three things each of them had
// written out for itself, differently:
//
//     calendar   <div className="flex h-full flex-col bg-paper animate-fadein">
//     week       <div style={{ height:'100%', display:'flex', flexDirection:'column',
//                              animation:'fadein 220ms', minHeight:0 }}>
//     content    <div className="flex h-full flex-col">          ← no entrance at all
//
// Three answers, one of them missing, and two of them invisible to a guard that
// reads Tailwind classes because they are inline styles.
//
// ── WHY THE BODY GETS NO SCROLLER ───────────────────────────────────────────
// Deliberately none: a canvas's scrolling IS its geometry and genuinely differs.
// A week grid scrolls down under a pinned day header; a stage board scrolls
// sideways and not down; a month grid does not scroll at all and must not be
// allowed to. So the body is a plain flex region and the page puts its own
// `scroll-region` where it belongs. That is a real per-canvas difference, not
// drift — which is exactly the distinction CONSISTENCY_PRINCIPLE.md draws
// between behaviour (shared) and composition (the screen's own).
import type { ReactNode } from 'react';
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';

export interface CanvasLayoutProps extends PageHeaderProps {
  /** Page-level overlays — modals, confirms — as siblings of the canvas. */
  overlays?: ReactNode;
  /** Classes for the body region. */
  className?: string;
  children: ReactNode;
}

const HEADER_KEYS = ['title', 'icon', 'subtitle', 'count', 'lead', 'tabs', 'actions', 'bare'] as const;

export function CanvasLayout({ overlays, className, children, ...rest }: CanvasLayoutProps) {
  const headerProps: PageHeaderProps = {};
  for (const k of HEADER_KEYS) {
    const v = rest[k];
    if (v !== undefined) (headerProps as Record<string, unknown>)[k] = v;
  }
  const hasHeader = Object.keys(headerProps).length > 0;

  return (
    <div className="zb-page-in relative flex h-full min-h-0 flex-col">
      {hasHeader && <PageHeader {...headerProps} />}
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
      {overlays}
    </div>
  );
}
