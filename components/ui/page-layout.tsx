'use client';
// THE page layout — the archetype every single-pane screen is built from.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// `<PageHeader>` settled what a header row looks like and `<ViewContainer>`
// settled how wide a column is, but nothing owned the SHAPE THEY MAKE TOGETHER,
// so all thirteen screens composed it by hand:
//
//     <>
//       <PageHeader … />
//       <ViewContainer width={full ? 'full' : 'wide'} className="pb-16 pt-8"
//                      style={{ animation: 'fadein 180ms' }}>
//
// and every hand-composition re-decided the parts that are not the page's to
// decide. Measured across the thirteen call sites before this file existed:
//
//   top padding      0 · 24 · 28 · 32px          (four answers)
//   bottom padding   0 · 24 · 40 · 64 · 80px     (five answers)
//   entrance         none · fadein 180ms · fadein 220ms   (three answers)
//   width preference honoured on 4 pages, silently ignored on the other 9
//
// None of that variety meant anything. It is the "same problem solved twice,
// differently, for no reason" that CONSISTENCY_PRINCIPLE.md calls a defect —
// the drift you get when a shape is a convention rather than a component.
//
// So the shape becomes the component. A page now declares only what is
// genuinely its own — what the header says, and which of the three widths its
// content wants — and this file answers everything else identically for all of
// them.
//
// ── WHICH RESOLUTION EACH DRIFT GOT, AND WHY ────────────────────────────────
// Vertical rhythm → `--view-pt` / `--view-pb`, not the hard-coded `pt-8`/`pb-16`
//   that more than half the call sites used. Not because the token was there
//   first: the token is BETTER. It steps down under the compact density setting
//   (28→20px) and a literal `pt-8` cannot. Consolidating onto the worse copy is
//   a real failure mode — `--view-px` was flat 40px until the hand-rolled
//   `clamp(18px,3vw,40px)` it was replacing turned out to be the better rule and
//   the token took the clamp instead.
// Entrance → ONE opacity fade at `--duration-base`, and never a transform. The
//   global `fadein` keyframe also translates 4px, which is movement on every
//   navigation; `zb-page-in` is opacity only, so the page arrives without the
//   content shifting under a reader who is already looking at it. Reduced
//   motion is covered by the global reset in globals.css.
// Width preference → applied HERE, so it applies everywhere. "Full width"
//   (Settings → Appearance, `useViewWidth`) used to be read by the four pages
//   that happened to remember it; on Habits, Memory, Forms, Settings and Tasks
//   the switch moved and nothing happened. A device preference that works on
//   some screens is worse than one that works on none, because the reader
//   cannot tell which they are looking at.
//
// ── THE DECISION RULE: WHICH LAYOUT AM I BUILDING? ──────────────────────────
// Ask what the page IS, not what it contains. There are three answers, and a
// new screen must be one of them:
//
//   PageLayout    ONE pane you read down. A header row, then a centred column
//                 that scrolls in the shell's own scroll region.
//                 → Home, Tasks list, Finance, Settings, Habits, Memory, Forms,
//                   Inbox, an invoice.
//   HubLayout     TWO panes — a rail that lists records beside a detail for the
//                 selected one. Each pane scrolls independently.
//                 → Clients, Projects, Documents, Content.
//   CanvasLayout  ONE pane that owns its own geometry: a grid, a board, an
//                 editor. The header stays; the body is full-bleed and does its
//                 own scrolling.
//                 → Calendar, Week, Horizon, the document editor.
//
// If a new screen does not fit, that is a finding, not a licence to hand-roll:
// say which archetype it departs from and why, in a comment beside the code
// (CONSISTENCY_PRINCIPLE.md, "how a divergence is allowed to happen"). Reach
// for a fourth archetype only when a second screen needs the same one — one
// screen's exception is a special case, two is a missing layout.
import type { CSSProperties, ReactNode } from 'react';
import { useViewWidth } from '@/components/shell/view-width';
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header';
import { ViewContainer, type ViewWidth } from '@/components/ui/view-container';
import { cn } from '@/lib/cn';

export interface PageLayoutProps extends PageHeaderProps {
  /**
   * The width this page's content NATURALLY wants — `reading` (978px, one
   * column you read down) · `wide` (1200px, columns beside a rail) · `full`
   * (no cap). Read `<ViewContainer>` for what each is for.
   *
   * This is the page's own answer, not the reader's: the device-wide "Full
   * width" preference is applied on top of it here, so no page writes
   * `full ? 'full' : 'wide'` for itself.
   */
  width?: ViewWidth;
  /**
   * Opt out of the "Full width" preference. Only for a page whose content
   * cannot be widened at all — and say why in a comment. There are none today.
   */
  fixedWidth?: boolean;
  /** Classes for the content column. Layout-neutral things only — never padding. */
  className?: string;
  /** Escape hatch for a bespoke header row. Prefer the header props. */
  header?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
}

// The header props this component forwards. Listing them explicitly (rather
// than spreading the rest) keeps a new PageHeader prop from silently becoming a
// PageLayout prop without anyone deciding it should be.
const HEADER_KEYS = ['title', 'icon', 'subtitle', 'count', 'lead', 'tabs', 'actions', 'bare'] as const;

export function PageLayout({
  width = 'reading', fixedWidth, className, header, style, children, ...rest
}: PageLayoutProps) {
  const { full } = useViewWidth();
  const resolved: ViewWidth = !fixedWidth && full ? 'full' : width;

  // A page with nothing to put in its header gets no header row, rather than an
  // empty 48px band above its content. Settings is the standing example: it has
  // no page-level actions, and the band would be a hairline under nothing.
  // Same shape as PageHeader's own `hasScope` test, one level up.
  const headerProps: PageHeaderProps = {};
  for (const k of HEADER_KEYS) {
    const v = rest[k];
    if (v !== undefined) (headerProps as Record<string, unknown>)[k] = v;
  }
  const hasHeader = Object.keys(headerProps).length > 0;

  return (
    <>
      {header ?? (hasHeader ? <PageHeader {...headerProps} /> : null)}
      <ViewContainer
        width={resolved}
        style={style}
        className={cn('zb-page-in page-rhythm', className)}
      >
        {children}
      </ViewContainer>
    </>
  );
}
