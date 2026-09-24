import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { CalendarDays as CalendarIcon, ChevronLeft, ChevronRight } from "@/components/ds/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";
import { IconButton } from "./icon-button";
import { MENU_PANEL_CLASS } from "./menu";
import { Button } from "./button";
import { formatDay, formatMonthYear, formatWeekday, isoDateIn, WEEK_STARTS_ON } from "@/lib/date";
import { loadNaturalDate, naturalDateParser, parseNaturalDate } from "@/lib/natural-date";

// design-system.md §4.23 — the input ACCEPTS TYPING ("tomorrow", "next fri",
// "in 3 days"), parsed with Chrono, which loads when the field is first focused
// (lib/natural-date.ts). Presets are used 10× more than the grid.
// The grid is ONE tab stop; cells announce the full date.

// All three used to be `new Intl.DateTimeFormat(undefined, …)` — the ambient
// locale, which is the same defect the date vocabulary exists to stop, just
// spelled with `Intl` instead of `toLocaleDateString` (which is how it hid from
// the guard in lib/date-vocabulary.test.ts). A date typed into this picker
// rendered "Sep 4" while the same date in a task row rendered "4 Sep", and a
// `'use client'` component is server-rendered first, so it also mismatched on
// hydration.
const fmt = (d: Date) => formatDay(d, { year: true }) ?? "";
const fmtFull = (d: Date) => formatDay(d, { weekday: "long", long: true, year: true }) ?? "";
const fmtMonth = (d: Date) => formatMonthYear(d, { long: true }) ?? "";

const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());


/**
 * A calendar date, `YYYY-MM-DD`, in and out.
 *
 * It used to hand `Date` objects across the boundary, and every caller paid for
 * it: `new Date(iso + 'T00:00:00')` going in and a hand-rolled `dateToISO`
 * coming back. That helper existed FOUR times — `lib/date`'s `isoDateIn`,
 * `lib/calendar`'s `localISODate`, and a private copy each in
 * projects-workspace and new-project-modal — which is exactly the shape of the
 * UTC-date bug this codebase has already paid for once: `toISOString()` on a
 * local Date is the previous day for anyone west of UTC.
 *
 * A calendar date is not an instant. Strings are what the database, the URL and
 * `lib/date` already speak, so the picker speaks them too and the conversions
 * disappear. `''` means no date, matching the field it replaces.
 */
export interface DatePickerProps {
  value: string | null;
  onValueChange: (iso: string) => void;
  placeholder?: string;
  /** Accessible name. Required when no visible <label> is attached via Field. */
  "aria-label"?: string;
  /**
   * Render the caller's own control instead of the text field, keeping the same
   * popover. For the places a date is edited from a DISPLAY rather than a field:
   * a task's date chip, a database grid cell, a document property, a triage
   * button. All four had reached for the same hack — an invisible
   * `<input type="date">` stretched over the element with `opacity-0` — which
   * opened the BROWSER's calendar from inside our UI, and could not be styled,
   * keyboard-driven or made to agree with the picker one row above.
   *
   * The trade is real and deliberate: a trigger has nowhere to type, so this
   * form loses the "next friday" parsing. The presets rail carries most of that
   * weight, and a chip has no room for a text field anyway.
   */
  trigger?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
}

const fromISO = (iso: string | null): Date | null => (iso ? new Date(`${iso}T00:00:00`) : null);
const toISO = (d: Date | null): string => (d ? isoDateIn(d) ?? "" : "");

export function DatePicker({ value: isoValue, onValueChange, placeholder = "tomorrow, next fri, 12/3…", id, disabled, className, trigger, ...rest }: DatePickerProps) {
  const value = React.useMemo(() => fromISO(isoValue), [isoValue]);
  const fieldProps = useFieldProps({ id });
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  // The text as last typed, for a parse that finishes after later keystrokes.
  const draftRef = React.useRef("");
  const [view, setView] = React.useState(() => startOfDay(value ?? new Date()));
  const [focused, setFocused] = React.useState<Date>(() => startOfDay(value ?? new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  // Monday. One week start for the whole app: `getWeekDays` in lib/date.ts is
  // Monday-first, so a Sunday-first picker would disagree with the Week view
  // beside it. This used to read `navigator.language` — undefined on the
  // server, so it rendered Monday there and Sunday in a US browser: a
  // hydration mismatch AND two calendars.
  const ws = WEEK_STARTS_ON;

  const commit = (d: Date | null, close = true) => {
    onValueChange(toISO(d ? startOfDay(d) : null));
    draftRef.current = "";
    setDraft("");
    if (d) {
      setView(startOfDay(d));
      setFocused(startOfDay(d));
    }
    if (close) setOpen(false);
  };

  // The parser started loading when the field was focused, so it is almost
  // always here by now. When it is not, read the text once it arrives, unless
  // it has been edited or committed in the meantime.
  const parseDraft = () => {
    const text = draft;
    if (!text.trim()) return;
    const chrono = naturalDateParser();
    if (chrono) {
      const parsed = chrono.parseDate(text);
      if (parsed) commit(parsed);
      return;
    }
    void parseNaturalDate(text).then((parsed) => {
      if (parsed && draftRef.current === text) commit(parsed);
    });
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
      return (formatWeekday(d) ?? "").charAt(0);
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
    <RP.Root open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
      {trigger ? (
        <RP.Trigger asChild disabled={disabled}>{trigger}</RP.Trigger>
      ) : (
      <div className={cn("relative", className)}>
        <input
          {...fieldProps}
          disabled={disabled}
          aria-label={rest["aria-label"]}
          value={draft || (value ? fmt(value) : "")}
          placeholder={placeholder}
          onChange={(e) => { draftRef.current = e.target.value; setDraft(e.target.value); }}
          onFocus={() => { void loadNaturalDate(); }}
          onBlur={parseDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); parseDraft(); }
            if (e.key === "ArrowDown") setOpen(true);
          }}
          // CHARACTER FOR CHARACTER the <TimePicker> field. The two sit side by
          // side in the event composer and in every scheduling row, and they had
          // drifted apart on radius (sm vs md), surface (paper vs surface-raised)
          // and type size (body vs ui) — a date box and a time box that were
          // visibly not the same control.
          className={cn(
            "h-8 w-full rounded-md border border-line-strong bg-surface-raised ps-2.5 pe-8",
            "text-ui tabular-nums text-ink-900 placeholder:text-ink-500",
            "transition-colors duration-instant hover:border-ink-300 focus-ring",
            "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-ink-500",
          )}
        />
        <span className="absolute inset-y-0 end-0.5 flex items-center">
          <RP.Trigger asChild disabled={disabled}>
            <IconButton label="Open calendar" icon={<CalendarIcon className="size-4" />} variant="ghost" size="sm" tooltipDisabled />
          </RP.Trigger>
        </span>
      </div>
      )}
      <RP.Portal>
        <RP.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className={cn(MENU_PANEL_CLASS, "z-dropdown flex overflow-hidden p-0")}
        >
          {/* Presets rail (§4.23 — used 10× more than the grid) */}
          <div className="flex w-32 flex-col gap-0.5 border-e border-line-soft p-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => commit(p.get())}
                className="focus-ring rounded-md px-2.5 py-1.5 text-start text-ui text-ink-800 hover:bg-surface-hover hover:text-ink-900"
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
                {fmtMonth(view)}
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
              aria-label={fmtMonth(view)}
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
                      aria-label={fmtFull(d)}
                      onClick={() => commit(d)}
                      className={cn(
                        "relative grid size-8 place-items-center rounded-sm text-ui transition-colors duration-instant",
                        otherMonth ? "text-ink-500" : "text-ink-800",
                        isToday && "font-medium text-ink-900",
                        // Selection is INK and TODAY is ACCENT — the same split
                        // the calendar grid uses, and the same one the standing
                        // accent rule draws: accent marks what is live, ink
                        // marks what is chosen. These read `berry-500`, which is
                        // remapped to ink and so rendered correctly while naming
                        // a colour the app does not have.
                        !isSel && "hover:bg-surface-hover",
                        isSel && "bg-ink-900 font-medium text-onsolid",
                        isFocus && !isSel && "ring-2 ring-ink-500 ring-offset-1 ring-offset-surface-raised",
                      )}
                    >
                      {d.getDate()}
                      {isToday && !isSel && (
                        <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-[var(--accent)]" />
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
