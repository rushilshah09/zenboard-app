import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { Divider } from "./divider";
import { Tooltip } from "./tooltip";

// design-system.md §4.43 — the audit trail on an object. Chronological,
// immutable. A 1px ink-050 rail; avatars sit ON the rail with a paper ring.
// Diffs: old value ink-400 strikethrough → new value ink-800.

export type ActivityEntry =
  | { kind: "action"; actor: string; verb: string; object?: string; time: string; absoluteTime?: string }
  | { kind: "diff"; actor: string; property: string; from: string; to: string; time: string; absoluteTime?: string }
  | { kind: "comment"; actor: string; body: string; time: string; absoluteTime?: string }
  | { kind: "day"; label: string };

export function ActivityFeed({ entries, className }: { entries: ActivityEntry[]; className?: string }) {
  return (
    <div className={cn("relative flex flex-col gap-4", className)}>
      {/* The rail */}
      <span aria-hidden className="absolute bottom-2 start-4 top-2 w-px bg-[var(--color-ink-050)]" />
      {entries.map((e, i) => {
        if (e.kind === "day") {
          return <Divider key={i} label={e.label} className="relative z-10 -ms-1" />;
        }
        const time = (
          <Tooltip content={e.absoluteTime ?? e.time} disabled={!e.absoluteTime}>
            <span className="shrink-0 cursor-default font-mono text-mono-sm text-ink-400">{e.time}</span>
          </Tooltip>
        );
        return (
          <div key={i} className="relative flex items-start gap-3">
            <span className="relative z-10 ms-1.5 mt-0.5 rounded-full ring-2 ring-paper">
              <Avatar name={e.actor} size="xs" decorative />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <div className="flex items-baseline gap-2">
                <p className="min-w-0 flex-1 text-ui text-ink-600">
                  <span className="font-medium text-ink-900">{e.actor}</span>{" "}
                  {e.kind === "action" && (
                    <>
                      {e.verb}
                      {e.object && <span className="text-ink-800"> {e.object}</span>}
                    </>
                  )}
                  {e.kind === "diff" && (
                    <>
                      changed {e.property}:{" "}
                      <span className="text-ink-400 line-through">{e.from}</span>{" "}
                      <span aria-hidden>→</span>
                      <span className="sr-only">to</span>{" "}
                      <span className="text-ink-800">{e.to}</span>
                    </>
                  )}
                  {e.kind === "comment" && "commented"}
                </p>
                {time}
              </div>
              {e.kind === "comment" && (
                <div className="rounded-md bg-paper-3 p-3 text-body text-ink-800">{e.body}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
