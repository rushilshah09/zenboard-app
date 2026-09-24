'use client';
// THE page header — one row, one structure, every screen.
//
// Before this, every page invented its own: Finance floated a "New invoice"
// button at one height, Goals put "Weekly review · New goal" at another, Habits
// a third, and the "•••" page menu was a SHELL OVERLAY absolutely positioned on
// top of all of them — so it never lined up with the actions it sat beside. Ten
// screens, ten header layouts.
//
// Structure (layout borrowed from Cloudflare's two-row chrome, dressed in
// Zenboard's own language — the app's 44px top bar is the breadcrumb row, this
// is the page row):
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ [lead] Title  subtitle  count        [actions…]  [•••]           │  ← --page-header-h
//   ├──────────────────────────────────────────────────────────────────┤  ← hairline
//
//   LEFT   the page's most specific label — "Inbox" inside Tasks, "July 2026"
//          inside Calendar, the project's name inside Projects — plus an
//          optional `lead` control (a back arrow, a date stepper) and an inline
//          `subtitle` for secondary context ("Week 31").
//   RIGHT  the page's own actions, in a fixed 8px rhythm, ending with the
//          page's primary. Nothing global lives here.
//
// Everything dimensional comes from tokens (`--page-header-h`, `--view-px`,
// `--page-header-gap`), so the row is retuned in globals.css — never per page.
// Nothing here is page-aware: pages pass content, not layout.
import { type IconType } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

// The canonical page title. Standalone use is rare — prefer <PageHeader> — but
// exported for surfaces with a bespoke header row (e.g. the client portal).
export function PageTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h1
      className="truncate"
      style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--text-h4-size, 15px)',
        margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--ink)', ...style,
      }}
    >
      {children}
    </h1>
  );
}

export interface PageHeaderProps {
  /**
   * A SCOPE within the page — "Inbox" inside Tasks, "July 2026" inside Calendar,
   * a project's name inside Projects.
   *
   * NOT the page name. The global app header already says "Finance"; repeating
   * it here 40px lower is the duplication this component exists to remove. Most
   * pages pass no title at all and this becomes a pure actions row, which is
   * exactly the point — the actions land in the same place whether or not a
   * page has a scope to name.
   *
   * NOT the selected record in a master/detail hub either (Clients, Documents).
   * There the rail already highlights the selection and the detail pane leads
   * with it as an H1 — a third copy in the header is noise, and it shoves the
   * module switcher off the left edge where every other module starts it.
   */
  title?: string;
  /** Optional glyph before the scope. Use the route's own nav glyph (icon seam rule #3). */
  icon?: IconType;
  /** Secondary context, inline after the scope: "Week 31", "3 of 12 done". */
  subtitle?: React.ReactNode;
  /** A count badge after the title — tabular, muted, hidden at zero. */
  count?: number;
  /** A control that belongs BEFORE the title: a back arrow, a ‹ › date stepper. */
  lead?: React.ReactNode;
  /**
   * The LEFT lane: WHERE YOU ARE. A module switcher (Clients · Pipeline ·
   * Feedback), the section tabs of the record on screen (Build · Settings ·
   * Responses), a horizon (Week · Month · Year) — anything that swaps what the
   * page is showing you. Rendered on the SAME line as the actions, which is
   * what makes the row scan: where you are, then what you can do, without a
   * second header band eating another 48px.
   *
   * NOT a filter, and NOT a layout switch. Both of those are settings ON the
   * current view rather than a move to a different one, and both belong in
   * `actions` — see the note there. The lane scrolls inside itself so a long
   * set never pushes the actions off screen.
   */
  tabs?: React.ReactNode;
  /**
   * The RIGHT lane, in this order: controls that shape the current view
   * (Filter, the layout switch), then the page's own verbs, ending with its
   * primary. Nothing is appended after them.
   *
   * The filter used to live in `tabs` on the theory that bunching it against
   * the primary button would make a navigation control read as a verb. In
   * practice the opposite happened. Once the scope label came out of the left
   * cluster — the rail already highlights the open view, so the header was
   * naming it twice — the filter was left alone against the far-left edge with
   * nothing to belong to, while every other control sat 1200px away on the
   * right. Two lonely clusters, not a balanced row. Filter and layout are both
   * "how am I looking at this", so they group with each other, and the row now
   * has one cluster of controls where the eye already goes.
   */
  actions?: React.ReactNode;
  /** Hide the hairline — only for a header that sits directly above its own bordered surface. */
  bare?: boolean;
  className?: string;
}

export function PageHeader({
  title, icon, subtitle, count, lead, tabs, actions, bare, className,
}: PageHeaderProps) {
  // THE alignment invariant: the first content box in this row starts exactly
  // `--app-header-px` from the panel edge — the same inset the global app
  // header uses for ITS first box. That only holds if the left cluster is
  // absent when it has nothing to show: an empty cluster still contributed its
  // own 8px of lead padding plus the row gap, pushing the switcher 20px right
  // of where every other header starts. Rendering nothing is the fix, and it
  // fixes every page at once because they all come through here.
  const hasScope = Boolean(lead || icon || title || subtitle || (count != null && count > 0));

  return (
    <header
      // Marks the row as a real page header. The shell used to float a ••• for
      // pages that had none and hide it off this attribute; both are gone, but
      // the marker stays as the hook for measuring the alignment invariant.
      data-page-header=""
      className={cn('shrink-0', !bare && 'border-b border-line', className)}
    >
      {/* Full panel width, not the reading column. This row is the PAGE's chrome
          — the band the page hangs from — so it spans the content panel edge to
          edge on every screen, so the last action lands in the same pixel
          everywhere.
          The body below still centres in its reading column; that contrast is
          what makes the header read as chrome rather than as content.
          `--app-header-px` is the SAME inset the global app header uses, so the
          page's last action sits on the same vertical axis as the app bar's
          "+ New". */}
      {/* Every dimension here reads its token WITH A FALLBACK. A `var(--x)` with
          no fallback silently computes to nothing if the token is ever missing,
          and this row degrades catastrophically when that happens: padding 0,
          min-height 0, gap 0 — the header collapses onto the panel edge and the
          controls touch. That is not hypothetical; it shipped that way, because
          the tokens are newer than the CSS bundle that was being served. The
          fallbacks are the same numbers globals.css declares, so the token still
          governs — it just can no longer take the layout down with it. */}
      {/* WRAPS BELOW `sm`, and that is the whole narrow-width story. The actions
          cluster is `shrink-0` by design — a page's verbs must not be squeezed
          into unreadable stubs — but with `overflow: visible` on the row, a
          cluster wider than the viewport simply left the screen: measured on
          Documents at 420px, the row wanted 442px in a 402px box and "New doc"
          sat 40px past the right edge, unreachable at any scroll position.
          Wrapping gives the actions their own line on a phone, which is what a
          two-line header is for. Above `sm` nothing changes — `flex-wrap` costs
          nothing when everything already fits. */}
      <div
        className="flex w-full flex-wrap items-center sm:flex-nowrap"
        style={{
          minHeight: 'var(--page-header-h, 48px)',
          gap: 'var(--app-header-cluster-gap, 16px)',
          paddingInline: 'var(--app-header-px, 12px)',
        }}
      >
        {/* Left cluster carries the app header's extra 4px lead pad, so a scope
            label starts on the same axis as the app header's page name.
            Rendered only when there IS a scope — see the invariant above. */}
        {hasScope && (
          <div className="flex min-w-0 items-center gap-2" style={{ paddingInline: 'var(--app-header-lead-px, 4px)' }}>
            {lead && <span className="flex shrink-0 items-center gap-1">{lead}</span>}

            {icon && <Icon icon={icon} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}

            {title && <PageTitle>{title}</PageTitle>}

            {subtitle && (
              <span className="hidden truncate text-meta text-ink-500 sm:inline">{subtitle}</span>
            )}
            {count != null && count > 0 && (
              <span className="shrink-0 tabular-nums text-meta text-ink-500">{count}</span>
            )}
          </div>
        )}

        {/* Left lane: where you can GO — section tabs, or a filter segmented.
            Scrolls inside itself so a long set never pushes the actions off
            screen; the page itself must never scroll sideways. */}
        {/* No edge-fade mask here: it dims the first pill even when nothing
            overflows, which reads as a disabled control. Plain overflow only. */}
        {tabs && (
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex w-max items-center">{tabs}</div>
          </div>
        )}

        {/* The spacer is always present, so actions sit hard right whether or not
            the page has a subtitle — that is what keeps the actions in one place.
            With tabs on screen the tab lane already flexes, so this collapses. */}
        <span className={tabs ? 'shrink-0' : 'min-w-0 flex-1'} />

        {/* The row ends with the PAGE's own actions. It used to end with a
            ••• that held exactly one item — a device-wide "Full width" toggle —
            which put a tertiary, page-independent preference in the most
            valuable slot on every screen, pushed the page's real action inboard,
            and sat 30px from Documents' own ⋮. The preference moved to
            Settings → Appearance beside the other device preferences. */}
        {actions && (
          <div
            // `ms-auto` keeps the cluster right-aligned once it wraps onto its
            // own line, so the actions stay where the eye already looks for them.
            className="ms-auto flex shrink-0 items-center"
            // The same inset the lead carries, so both ends of the row land on
            // one grid rather than 16px in on the left and 12px on the right.
            style={{ gap: 'var(--page-header-gap, 8px)', paddingInline: 'var(--app-header-lead-px, 4px)' }}
          >
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
