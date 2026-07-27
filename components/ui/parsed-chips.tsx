// The confirmation layer for the unified NL parser (lib/task-parse). Every
// recognized token renders as a chip; dismissing one returns its words to the
// title (the caller adds the kind to its `ignore` set). ONE shared component so
// Quick Capture, Today, Tasks and the command palette never drift — the parser
// is unified, so its surface must be too (constitution §7: extend, don't duplicate).
import { Sun, Calendar, Flag, Timer, Kanban, Repeat, Inbox, X, type IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import type { ParsedChip, ChipKind } from "@/lib/task-parse";

const CHIP_ICON: Record<ChipKind, IconType> = { when: Sun, due: Calendar, priority: Flag, estimate: Timer, project: Kanban, repeat: Repeat, inbox: Inbox };

export function ParsedChips({ chips, onDismiss, className }: {
  chips: ParsedChip[];
  /** When provided, each chip gets an × that returns its words to the title. */
  onDismiss?: (kind: ChipKind) => void;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c) => (
        <span key={c.kind} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-paper-3 pl-2 pr-1 text-label text-ink-700">
          <Icon icon={CHIP_ICON[c.kind]} size={11} className="text-accent-text" />
          {c.label}
          {onDismiss && (
            <button type="button" onClick={() => onDismiss(c.kind)} aria-label={`Keep “${c.label}” as text`} title="Keep as text"
              className="focus-ring grid size-4 place-items-center rounded-full text-ink-400 transition-colors hover:text-ink-700">
              <Icon icon={X} size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
