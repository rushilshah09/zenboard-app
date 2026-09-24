import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

// THE section heading — the quiet sentence-case title that leads a block of
// content inside a detail view ("Update", "Milestones", "Key tasks", "Notes").
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// It did not, and five call sites on ONE screen proved the cost. Measured on the
// project Overview, all nominally the same heading:
//
//     Update      h3  15px  margin-bottom 10px
//     Milestones  h3  15px  margin-bottom  0px
//     Key tasks   h3  15px  margin-bottom  0px
//     Activity    h3  15px  margin-bottom 12px
//     Memory      h3  12px  margin-bottom  0px
//
// Three different gaps and one different size for one idea — and across modules
// there were four recipes (`mb-2 font-display …ink-600`, `mb-2.5 …ink-900`,
// `mb-3 …ink-900`, and no margin at all). That is what "looks generated" means
// in practice: every instance locally plausible, the set incoherent.
//
// Worse, Clients wrote its section titles as `<span>`, so those sections did not
// exist in the document outline at all — a screen-reader user could not navigate
// by heading. A component fixes the semantics once instead of asking every
// module to remember.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// One size (`text-h4`, 15/500), one ink, and the space BELOW belongs to the
// heading. Space ABOVE belongs to the section (`mt-10` on the block), because a
// heading should sit closer to what it introduces than to what it follows —
// which is the whole reason the inconsistent 0px versions read as broken.
export function SectionHeading({ children, count, summary, action, className, as: As = 'h3' }: {
  children: ReactNode;
  /** A quiet tally after the title — "Milestones 1/5", "Key tasks 3". Figures, so tabular. */
  count?: ReactNode;
  /**
   * A quiet SENTENCE after the title — "3 things, 1 overdue", "Filming at 09:00 · 1 going out". Its own slot
   * because prose and a tally want opposite type: tabular figures inside a sentence read as mechanical (the same
   * split Panel makes; app/design-system.test.ts).
   */
  summary?: string | null;
  /** Right-aligned control on the heading's own line. */
  action?: ReactNode;
  className?: string;
  /** `h3` by default. Drop a level only where the outline genuinely needs it. */
  as?: 'h2' | 'h3' | 'h4';
}) {
  return (
    <div className={cn('mb-2.5 flex min-h-6 items-center gap-2', className)}>
      <As className="text-h4 text-ink-900">{children}</As>
      {count != null && <span className="text-caption tabular-nums text-ink-500">{count}</span>}
      {summary && <span className="min-w-0 truncate text-caption text-ink-500">{summary}</span>}
      {action && <span className="ms-auto flex items-center">{action}</span>}
    </div>
  );
}
