import { cn } from "@/lib/cn";

/**
 * A COUNT — the small number beside a label ("Inbox 4", "Projects 2").
 *
 * Named in the user's UI audit: *"counts styled ad-hoc (needs one `Count`
 * primitive)"*. Measured across eight pages afterwards — 33 counts, FIVE
 * distinct styles. Most were already consistent because `PanelHeader` owned
 * them, which is the point: the ones that drifted were the ones written by hand.
 *
 * The drift that actually mattered was not size, it was **`tabular-nums`**. Seven
 * counts on Content rendered proportional, so `4 → 5` changes the glyph width
 * and the number shifts the row as it updates. That is the whole reason
 * CLAUDE.md says "numbers in stats and tables: tabular-nums", and it is why this
 * component exists rather than a documented class string: a class string can be
 * copied without the part that matters.
 *
 * `text-caption` is the 12px/400 role. It replaced a literal `text-[12px]` that
 * had the same value but bypassed the type scale, so a change to the scale would
 * have missed it.
 *
 * NOT for a headline metric — a StatCard's big figure is a different thing at a
 * different size and keeps its own role.
 */
export function Count({
  value,
  className,
  ...props
}: {
  /** Rendered as-is. Pass a preformatted string for anything above 999. */
  value: number | string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('shrink-0 text-caption tabular-nums text-ink-500', className)}
      {...props}
    >
      {value}
    </span>
  );
}
