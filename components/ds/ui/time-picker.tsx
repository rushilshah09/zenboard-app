import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { Clock } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";
import { IconButton } from "./icon-button";

// design-system.md §4.24 — text field first: "3pm", "15:30", "9", "9:05am" all
// parse. Dropdown of 15-minute increments scrolled to the nearest. Timezone
// shown whenever an event can be seen by someone else.

export interface TimeValue {
  hours: number; // 0–23
  minutes: number;
}

function parseTime(raw: string): TimeValue | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "pm" && h !== 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
  } else if (h > 23) return null;
  return { hours: h, minutes: min };
}

function uses12h(): boolean {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? true;
}

function fmtTime(t: TimeValue, h12: boolean): string {
  const d = new Date(2026, 0, 1, t.hours, t.minutes);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: h12 }).format(d);
}

function tzLabel(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offMin = -new Date().getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return `${tz.split("/").pop()?.replace("_", " ")} · GMT${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

export interface TimePickerProps {
  value: TimeValue | null;
  onValueChange: (t: TimeValue | null) => void;
  /** Show the timezone line (§4.24 — always, in anything collaborative). */
  showTimezone?: boolean;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({ value, onValueChange, showTimezone = true, id, disabled, className }: TimePickerProps) {
  const fieldProps = useFieldProps({ id });
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const h12 = React.useMemo(uses12h, []);
  const listRef = React.useRef<HTMLDivElement>(null);

  const slots = React.useMemo(
    () => Array.from({ length: 96 }, (_, i) => ({ hours: Math.floor(i / 4), minutes: (i % 4) * 15 })),
    [],
  );

  const commitDraft = () => {
    if (!draft.trim()) return;
    const t = parseTime(draft);
    if (t) {
      onValueChange(t);
      setDraft("");
    }
  };

  // Scroll the nearest slot into the centre when opening (§4.24).
  React.useEffect(() => {
    if (!open) return;
    const t = value ?? { hours: new Date().getHours(), minutes: 0 };
    const idx = t.hours * 4 + Math.round(t.minutes / 15);
    requestAnimationFrame(() => {
      const el = listRef.current?.children[Math.min(idx, 95)] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "center" });
    });
  }, [open, value]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <RP.Root open={open} onOpenChange={setOpen}>
        <div className="relative">
          <input
            {...fieldProps}
            disabled={disabled}
            value={draft || (value ? fmtTime(value, h12) : "")}
            placeholder={h12 ? "3pm, 9:05am…" : "15:00, 9:05…"}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitDraft(); }
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
              <IconButton label="Choose time" icon={<Clock className="size-4" />} variant="ghost" size="sm" tooltipDisabled />
            </RP.Trigger>
          </span>
        </div>
        <RP.Portal>
          <RP.Content
            align="end"
            sideOffset={4}
            className={cn(
              "z-dropdown w-36 overflow-hidden rounded-md border border-line bg-paper shadow-lift-2",
              "data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top",
            )}
          >
            <div ref={listRef} role="listbox" aria-label="Time" className="max-h-64 overflow-y-auto p-1 [overscroll-behavior:contain]">
              {slots.map((t, i) => {
                const isSel = value && value.hours === t.hours && value.minutes === t.minutes;
                return (
                  <button
                    key={i}
                    type="button"
                    role="option"
                    aria-selected={isSel || undefined}
                    onClick={() => {
                      onValueChange(t);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-7 w-full items-center rounded-sm px-2 font-mono text-mono-sm text-ink-800 hover:bg-paper-3",
                      isSel && "bg-berry-100 text-berry-700",
                    )}
                  >
                    {fmtTime(t, h12)}
                  </button>
                );
              })}
            </div>
          </RP.Content>
        </RP.Portal>
      </RP.Root>
      {showTimezone && <span className="text-meta text-ink-500">{tzLabel()}</span>}
    </div>
  );
}

/** Duration variant (§4.24): parses "90", "1.5h", "1:30", "1h 30m" → minutes. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  const dec = s.match(/^(\d+(?:\.\d+)?)h$/);
  if (dec) return Math.round(parseFloat(dec[1]) * 60);
  const parts = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (parts && (parts[1] || parts[2])) return (parseInt(parts[1] ?? "0", 10) || 0) * 60 + (parseInt(parts[2] ?? "0", 10) || 0);
  return null;
}
