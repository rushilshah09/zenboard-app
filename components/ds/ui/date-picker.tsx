import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import * as chrono from "chrono-node";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";
import { IconButton } from "./icon-button";
import { Button } from "./button";

// design-system.md §4.23 — the input ACCEPTS TYPING ("tomorrow", "next fri",
// "in 3 days"), parsed with Chrono. Presets are used 10× more than the grid.
// The grid is ONE tab stop; cells announce the full date.

const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtFull = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function weekStart(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = (new Intl.Locale(navigator.language) as any).getWeekInfo?.() ?? (new Intl.Locale(navigator.language) as any).weekInfo;
    return info?.firstDay === 7 ? 0 : 1; // 1 = Monday default
  } catch {
    return 1;
  }
}

export interface DatePickerProps {
  value: Date | null;
  onValueChange: (d: Date | null) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({ value, onValueChange, placeholder = "tomorrow, next fri, 12/3…", id, disabled, className }: DatePickerProps) {
  const fieldProps = useFieldProps({ id });
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [view, setView] = React.useState(() => startOfDay(value ?? new Date()));
  const [focused, setFocused] = React.useState<Date>(() => startOfDay(value ?? new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const ws = React.useMemo(weekStart, []);

  const commit = (d: Date | null, close = true) => {
    onValueChange(d ? startOfDay(d) : null);
    setDraft("");
    if (d) {
      setView(startOfDay(d));
      setFocused(startOfDay(d));
    }
    if (close) setOpen(false);
  };

  const parseDraft = () => {
    if (!draft.trim()) return;
    const parsed = chrono.parseDate(draft);
    if (parsed) commit(parsed);
  };

  // Build the visible 6×7 grid.
  const cells = React.useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() - ws + 7) % 7;
    const start = new Date(first);
    start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view, ws]);

  const dayNames = React.useMemo(() => {
    const base = new Date(2026, 5, 7 + ws); // a Sunday + offset
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(d);
    });
  }, [ws]);

  const moveFocus = (days: number) => {
    const next = new Date(focused);
    next.setDate(focused.getDate() + days);
    setFocused(next);
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const gridKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") moveFocus(1);
    else if (k === "ArrowLeft") moveFocus(-1);
    else if (k === "ArrowDown") moveFocus(7);
    else if (k === "ArrowUp") moveFocus(-7);
    else if (k === "PageDown") {
      const n = new Date(focused);
      e.shiftKey ? n.setFullYear(n.getFullYear() + 1) : n.setMonth(n.getMonth() + 1);
      setFocused(n);
      setView(new Date(n.getFullYear(), n.getMonth(), 1));
    } else if (k === "PageUp") {
      const n = new Date(focused);
      e.shiftKey ? n.setFullYear(n.getFullYear() - 1) : n.setMonth(n.getMonth() - 1);
      setFocused(n);
      setView(new Date(n.getFullYear(), n.getMonth(), 1));
    } else if (k === "Home" || k === "End") {
      const n = new Date(focused);
      const dow = (n.getDay() - ws + 7) % 7;
      n.setDate(n.getDate() + (k === "Home" ? -dow : 6 - dow));
      setFocused(n);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      commit(focused);
      return;
    } else return;
    e.preventDefault();
  };

  const presets: { label: string; get: () => Date | null }[] = [
    { label: "Today", get: () => new Date() },
    { label: "Tomorrow", get: () => new Date(Date.now() + 864e5) },
    { label: "This weekend", get: () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d; } },
    { label: "Next week", get: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; } },
    { label: "No date", get: () => null },
  ];

  return (
    <RP.Root open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <input
          {...fieldProps}
          disabled={disabled}
          value={draft || (value ? fmt.format(value) : "")}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={parseDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); parseDraft(); }
            if (e.key === "ArrowDown") setOpen(true);
          }}
          className={cn(
            "h-8 w-full rounded-sm border border-line-strong bg-paper px-2.5 pe-9 text-body text-ink-900",
            "placeholder:text-ink-500 transition-colors duration-instant hover:border-ink-300",
            "focus:border-berry-500 focus:outline-none focus:ring-2 focus:ring-berry-alpha-20",
            "disabled:border-transparent disabled:bg-surface-disabled disabled:text-ink-300",
          )}
        />
        <span className="absolute inset-y-0 end-1 flex items-center">
          <RP.Trigger asChild disabled={disabled}>
            <IconButton label="Open calendar" icon={<CalendarIcon className="size-4" />} variant="ghost" size="sm" tooltipDisabled />
          </RP.Trigger>
        </span>
      </div>
      <RP.Portal>
        <RP.Content
          align="end"
          sideOffset={4}
          className={cn(
            "z-dropdown flex overflow-hidden rounded-md border border-line bg-paper shadow-lift-2",
            "data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top",
          )}
        >
          {/* Presets rail (§4.23 — used 10× more than the grid) */}
          <div className="flex w-32 flex-col gap-0.5 border-e border-line-soft p-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => commit(p.get())}
                className="focus-ring rounded-sm px-2 py-1.5 text-start text-ui text-ink-700 hover:bg-paper-3 hover:text-ink-900"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col p-3">
            {/* Month header */}
            <div className="mb-2 flex items-center justify-between">
              <IconButton
                label="Previous month"
                icon={<ChevronLeft className="size-4" />}
                size="sm"
                tooltipDisabled
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              />
              <span className="text-body font-medium text-ink-900" aria-live="polite">
                {fmtMonth.format(view)}
              </span>
              <IconButton
                label="Next month"
                icon={<ChevronRight className="size-4" />}
                size="sm"
                tooltipDisabled
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              />
            </div>

            {/* Grid — ONE tab stop */}
            <div
              ref={gridRef}
              role="grid"
              aria-label={fmtMonth.format(view)}
              tabIndex={0}
              onKeyDown={gridKeyDown}
              className="focus-ring grid grid-cols-7 gap-y-0.5 rounded-sm outline-none"
            >
              {dayNames.map((n, i) => (
                <span key={i} className="grid size-8 place-items-center text-caption font-medium uppercase text-ink-500" aria-hidden>
                  {n}
                </span>
              ))}
              {cells.map((d, i) => {
                const isToday = sameDay(d, today);
                const isSel = sameDay(d, value);
                const isFocus = sameDay(d, focused);
                const otherMonth = d.getMonth() !== view.getMonth();
                return (
                  <span key={i} role="gridcell" aria-selected={isSel || undefined}>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={fmtFull.format(d)}
                      onClick={() => commit(d)}
                      className={cn(
                        "relative grid size-8 place-items-center rounded-sm text-ui transition-colors duration-instant",
                        otherMonth ? "text-ink-400" : "text-ink-800",
                        isToday && "font-medium text-ink-900",
                        !isSel && "hover:bg-paper-3",
                        isSel && "bg-berry-500 font-medium text-onsolid",
                        isFocus && !isSel && "ring-2 ring-berry-500 ring-offset-1 ring-offset-paper",
                      )}
                    >
                      {d.getDate()}
                      {isToday && !isSel && (
                        <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-berry-500" />
                      )}
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-2 flex justify-between border-t border-line-soft pt-2">
              <Button variant="quiet" size="sm" onClick={() => commit(null)}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={() => commit(new Date())}>
                Today
              </Button>
            </div>
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
