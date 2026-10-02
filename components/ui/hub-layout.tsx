'use client';
// THE hub layout — the archetype for a screen that is a RAIL beside a DETAIL.
//
// The second of the app's three page archetypes; read the decision rule at the
// top of `page-layout.tsx` for which one a new screen should be.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Clients and Projects had already converged on the same hub — not by sharing
// one, but by each writing it out. The two rail elements were character-for-
// character identical:
//
//     scroll-region w-full shrink-0 border-b border-line-soft p-3.5 max-h-[42vh]
//     md:h-full md:max-h-none md:w-60 md:border-b-0 md:border-r
//
// Two copies of a string that long are not a coincidence, they are a component
// that was never extracted — and they had already begun to differ in the way
// copies do. Both were also 10px WIDER than the app's other two rails: `w-60`
// is a Tailwind scale step, while Tasks and Documents sat on 230px citing the
// Figma sidebar panel. Extracting the copy would have canonised the wrong
// number, so the width now reads `--rail-w`, which is the sidebar's own. Projects wrapped its rail in `<aside>`; Clients used a bare
// `<div>`, so the same list of records was a navigation landmark on one screen
// and unlabelled scenery on the next. Nothing enforced the agreement, so the
// only thing keeping the two hubs alike was that nobody had touched one yet.
//
// ── WHAT THIS OWNS, AND WHAT IT DOES NOT ────────────────────────────────────
// Owns: the two-pane geometry, the responsive collapse (rail stacks ABOVE the
// detail below `md`, capped at 42vh so the detail is never pushed off screen),
// both scroll regions, the rail's landmark and accessible name, and the detail
// pane's column — which is the SAME `<ViewContainer>` + rhythm `<PageLayout>`
// gives a single-pane page, so a hub's detail and a plain page read as the same
// surface at the same insets.
//
// Does not own what goes IN either pane. A rail may be a flat list, a grouped
// one or a tree; a detail may be a record, a board or an empty state. That is
// composition, and CONSISTENCY_PRINCIPLE.md deliberately leaves composition to
// the screen — what has to match is the behaviour and the geometry, which is
// exactly what lives here.
'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { RailToggle } from '@/components/ds/ui/rail-toggle';
import { useViewWidth } from '@/components/shell/view-width';
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header';
import { ViewContainer, type ViewWidth } from '@/components/ui/view-container';
import { cn } from '@/lib/cn';

export interface HubLayoutProps extends PageHeaderProps {
  /** Show the rail's hide/show toggle in the header lead. On by default. */
  collapsibleRail?: boolean;
  /** The rail's contents — the list of records this hub selects between. */
  rail: ReactNode;
  /**
   * The rail's accessible name ("Projects", "Clients"). Required: the rail is a
   * `<nav>` landmark, and an unnamed landmark is worse than none — a screen
   * reader announces "navigation" with no way to tell it from the app sidebar
   * two landmarks away.
   */
  railLabel: string;
  /**
   * Replay the detail pane's entrance when this changes — pass the selected
   * record's id. Switching records inside a hub replaces everything in the
   * right-hand pane while the page around it holds still; without this the
   * swap is instant and silent, and a reader who clicked the wrong row gets no
   * confirmation that anything happened.
   */
  contentKey?: string | number;
  /** The detail column's natural width. `wide` — columns beside a rail — is the point of a hub. */
  width?: ViewWidth;
  /** Classes for the detail column. Layout-neutral only — never padding. */
  className?: string;
  /**
   * The detail pane owns its own geometry — a board, a grid, an editor — so it
   * gets the pane, not the reading column. Three hubs need this and none of
   * them is a special case: Tasks switches between a list and a board, Documents
   * between a gallery and an editor, Content between a board and a calendar. A
   * hub's detail is not always a column, so the layout says so rather than each
   * of them dropping out of it.
   */
  bleed?: boolean;
  /**
   * The rail brings its own padding. Default is the plain list inset used by a
   * rail that is just rows (Clients, Projects); Tasks and Documents build
   * collapsible sections with their own rhythm, and double-padding them would
   * push their group labels off the sidebar's axis.
   */
  railPadding?: boolean;
  /**
   * Page-level overlays that belong to the HUB rather than to either pane —
   * the create modal, an edit dialog, a confirm. They render as siblings of the
   * two panes, so nothing in them inherits a pane's width, scrolling or
   * entrance. (Not `children`: a modal is not the detail.)
   */
  overlays?: ReactNode;
  children: ReactNode;
}

const HEADER_KEYS = ['title', 'icon', 'subtitle', 'count', 'lead', 'tabs', 'actions', 'bare'] as const;

/**
 * THE rail rule, exported because Documents still draws its own rail and must
 * not invent a second answer to "what happens to a 230px rail at 400px wide?".
 *
 * Below `md` the rail stops being a column: it goes full width, stacks above
 * the detail, and is capped at 42vh so a long list cannot push the record you
 * just opened off screen. Documents hand-rolled `width: var(--rail-w)` with
 * `flexShrink: 0` and no narrow branch at all, so at 420px it held 230px of a
 * 420px viewport and the gallery beside it was crushed to 142px — narrower
 * than one card.
 */
export const HUB_RAIL_CLASS =
  // A RAIL'S RULES MEET ITS EDGES (2026-10-02, user: "divider lines should connect properly to the
  // edges … instead of looking randomly inset"). `scroll-region` reserves a scrollbar gutter, and on
  // any machine with classic scrollbars that reservation inset every full-bleed divider: first a
  // notch on one side (`stable`), then an equal 6px hairline on both (`stable both-edges`) — still a
  // rule that stops short of the rail's own border. No gutter is reserved now, and the bar is thin:
  // a rail rarely overflows, and when it does the list narrows by a thin bar's width rather than
  // every rule in every rail living 6px from its edge.
  'scroll-region [scrollbar-gutter:auto] [scrollbar-width:thin] flex w-full shrink-0 flex-col border-b border-line-soft max-h-[42vh] ' +
  'md:h-full md:max-h-none md:w-[var(--rail-w)] md:border-b-0 md:border-r';

export function HubLayout({
  rail, railLabel, contentKey, width = 'wide', className, overlays, bleed, railPadding = true,
  collapsibleRail = true, children, ...rest
}: HubLayoutProps) {
  const { full } = useViewWidth();
  const resolved: ViewWidth = full ? 'full' : width;

  // A rail is collapsible BY CONSTRUCTION, not by whoever remembered. Documents
  // had a toggle and Projects did not — the same hub shape, one with a way to
  // reclaim the width and one without. Owning it here means every hub gets it,
  // and gets the same one. Only below `md` is it pointless: there the rail is
  // already a stacked strip rather than a column stealing width.
  const [railHidden, setRailHidden] = React.useState(false);

  const headerProps: PageHeaderProps = {};
  for (const k of HEADER_KEYS) {
    const v = rest[k];
    if (v !== undefined) (headerProps as Record<string, unknown>)[k] = v;
  }
  // The toggle goes in the header's LEAD, never in the rail: a control that
  // vanishes with the thing it controls cannot bring it back.
  if (collapsibleRail && rail) {
    headerProps.lead = (
      <>
        <RailToggle hidden={railHidden} onToggle={() => setRailHidden((v) => !v)} />
        {headerProps.lead}
      </>
    );
  }
  const hasHeader = Object.keys(headerProps).length > 0;

  return (
    // The root is part of the geometry, so it lives here: `h-full` + a flex
    // column is what lets the pane row below claim the space under the header,
    // and a hub that forgets it gets two panes with no height. Both hubs had
    // written it out, and had drifted to a THIRD entrance animation
    // (`animate-fadein`) in the process — one page, one fade, same as every
    // other screen.
    <div className="zb-page-in relative flex h-full min-h-0 flex-col">
      {hasHeader && <PageHeader {...headerProps} />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Below `md` the rail stacks above the detail and is capped at 42vh, so
            a long list cannot push the record you just opened off the screen. */}
        {!railHidden && (
          <nav
            aria-label={railLabel}
            className={cn(HUB_RAIL_CLASS, railPadding && 'p-[var(--nav-inset,8px)]')}
          >
            {rail}
          </nav>
        )}
        {/* The detail scrolls independently of the rail: picking the next record
            must not mean scrolling the list back to where you were. */}
        {bleed ? (
          // The pane itself, with no column and no rhythm: a board sets its own
          // gutters and scrolls sideways inside them, and a reading column would
          // just be a narrower box to do that in.
          <div key={contentKey} className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
            {children}
          </div>
        ) : (
          <div className="scroll-region min-w-0 flex-1">
            <ViewContainer
              key={contentKey}
              width={resolved}
              className={cn('zb-page-in page-rhythm', className)}
            >
              {children}
            </ViewContainer>
          </div>
        )}
      </div>
      {overlays}
    </div>
  );
}
