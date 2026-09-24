'use client';
// THE time picker — every "what time?" in Zenboard, in one component.
//
// ── WHY THIS WAS REBUILT ────────────────────────────────────────────────────
// Zenboard had THREE answers to "pick a time", and the one users actually met
// most often was not ours at all:
//
//   1. this file — Radix popover, text-first parsing, and ZERO importers. Built,
//      documented against design-system.md §4.24, never wired to anything.
//   2. components/calendar/time-picker.tsx — a second custom picker, used only
//      by the event composer, positioned by hand (`absolute top-[30px]`).
//   3. a raw <input type="time"> on Home's Schedule, in Settings (×3), in
//      Content and in Onboarding.
//
// (3) is what the bug report was about. A native time input renders the
// BROWSER's picker — three columns, hard blue selection, `--:--` empty state —
// from UA shadow DOM that our CSS cannot reach. So the blue was never a
// Zenboard token going wrong; it was Chrome's, and no amount of restyling could
// have fixed it. It also formats to the OS LOCALE, which is why that field read
// "09:00 AM" while `formatClock` pins a 24-hour house clock and the calendar
// gutter beside it reads 13, 14, 15 — a format split that differs per machine.
//
// Neither of our two pickers was simply better, so this takes the better half of
// each rather than crowning one:
//   from (1)  Radix Popover + Portal — collision handling, viewport flipping,
//             z-index and scroll behaviour come from the primitive every other
//             menu in the app uses, instead of one screen's `top-[30px]`.
//   from (1)  a TEXT FIELD first: "3pm", "15:30", "9", "9:05am" all parse. A
//             list alone makes a keyboard user scroll for 14:45.
//   from (2)  `durationFrom` — an end-time list shows what each row MEANS
//             ("1h 45m"), so choosing a length is one glance rather than
//             arithmetic.
//   from (2)  tabular-nums. This file used to set the rows in `font-mono`,
//             which the design rules allow only for IDs and invoice numbers.
//
// ── WHAT IT INHERITS, RATHER THAN RESTATES ──────────────────────────────────
// Panel chrome and row metrics come from `MENU_PANEL_CLASS` / `MENU_ITEM_CLASS`
// (menu.tsx), so this popover is pixel-identical to every dropdown, select and
// menu in the app — that is the whole complaint about it "not belonging".
// The selected row matches DS `Select`'s selected option deliberately: this IS a
// select, and the standing accent rule (2026-07-19) is accent for data-entry
// controls — checkbox, radio, switch, slider — and INK for chrome, which lists
// select explicitly. Picking the accent here would have made the time picker
// disagree with the Select six pixels away, which is the same failure in a new
// colour.
import * as React from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import * as RP from '@radix-ui/react-popover';
import { Clock } from '@/components/ds/icons';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/date';
import { MENU_PANEL_CLASS } from './menu';
import { useFieldProps } from './field';
import { IconButton } from './icon-button';

const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

/**
 * The house clock, 24-hour and PINNED — see the format note in lib/date.ts.
 * Never `toLocaleTimeString` with the ambient locale: a `'use client'` component
 * is server-rendered first, so the server answers with ITS locale and the
 * browser re-renders with the user's, and the picker would contradict every
 * other time in the app besides.
 */
function label(min: number): string {
  return formatClock(new Date(2026, 0, 1, Math.floor(min / 60), min % 60)) ?? '';
}

/** "3pm" · "15:30" · "9" · "9:05am" → minutes from midnight. */
export function parseTime(raw: string): number | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === 'pm' && h !== 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + min;
}

function durLabel(delta: number): string {
  let d = delta;
  if (d <= 0) d += 1440;                       // an end before the start is overnight
  const h = Math.floor(d / 60), m = d % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Every 15 minutes across the day. */
const SLOTS = Array.from({ length: 96 }, (_, i) => i * 15);

export interface TimePickerProps {
  /**
   * "HH:MM", 24-hour — the shape the database, the calendar and every existing
   * caller already store. `null` (or "") is the EMPTY state, which is a real
   * value here: an end time is optional, so the field has to be able to say "not
   * set" without inventing a time.
   */
  value: string | null;
  onValueChange: (value: string) => void;
  /**
   * Show each row's distance from this time ("1h 45m"). Set it on an END field
   * and pass the start.
   */
  durationFrom?: string | null;
  /** Placeholder for the empty state. Defaults to the format hint. */
  placeholder?: string;
  /** Accessible name. Required when no visible <label> is attached via Field. */
  'aria-label'?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({
  value, onValueChange, durationFrom, placeholder, disabled, id, className, ...rest
}: TimePickerProps) {
  const fieldProps = useFieldProps({ id });
  const [open, setOpen] = React.useState(false);
  useFocusReturn(open);
  const [draft, setDraft] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const cur = value ? toMin(value) : null;
  const startMin = durationFrom ? toMin(durationFrom) : null;

  const commit = () => {
    if (draft == null) return;
    const min = parseTime(draft);
    if (min != null) onValueChange(hhmm(min));
    setDraft(null);                            // an unparseable draft reverts to the real value
  };

  // Centre the nearest slot when opening. Without this a 14:45 user opens at
  // 00:00 and scrolls, which is most of why a list-only picker feels slow.
  React.useEffect(() => {
    if (!open) return;
    const min = cur ?? new Date().getHours() * 60;
    const idx = Math.min(Math.round(min / 15), SLOTS.length - 1);
    requestAnimationFrame(() => {
      (listRef.current?.children[idx] as HTMLElement | undefined)
        ?.scrollIntoView({ block: 'center' });
    });
  }, [open, cur]);

  return (
    <RP.Root open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
      <div className={cn('relative', className)}>
        <input
          {...fieldProps}
          aria-label={rest['aria-label']}
          disabled={disabled}
          // The draft is what you are TYPING; the value is what is set. Keeping
          // them separate is what lets a half-typed "9:" survive a re-render
          // without being committed as 09:00.
          value={draft ?? (value ? label(toMin(value)) : '')}
          placeholder={placeholder ?? '15:00'}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); setOpen(false); }
            if (e.key === 'Escape' && draft != null) { e.stopPropagation(); setDraft(null); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
          }}
          className={cn(
            // Matches DS TextInput's `sm` field exactly — this is a text field
            // that happens to open a list, not a control of its own kind.
            'h-8 w-full rounded-md border border-line-strong bg-surface-raised ps-2.5 pe-8',
            'text-ui tabular-nums text-ink-900 placeholder:text-ink-500',
            'transition-colors duration-instant hover:border-ink-300 focus-ring',
            'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-ink-500',
          )}
        />
        <span className="absolute inset-y-0 end-0.5 flex items-center">
          <RP.Trigger asChild disabled={disabled}>
            <IconButton label="Choose time" icon={<Clock className="size-4" />} variant="ghost" size="sm" tooltipDisabled />
          </RP.Trigger>
        </span>
      </div>
      <RP.Portal>
        <RP.Content
          align="start"
          sideOffset={4}
          // Radix owns flipping, shifting and viewport collision. That is the
          // point of using it: the picker near the bottom of a scrolled pane
          // behaves like every other menu instead of like this one screen.
          collisionPadding={8}
          className={cn(MENU_PANEL_CLASS, 'z-dropdown max-h-64 overflow-y-auto', startMin != null ? 'w-44' : 'w-32')}
        >
          <div ref={listRef} role="listbox" aria-label="Time">
            {SLOTS.map((min) => {
              const on = min === cur;
              return (
                <button
                  key={min}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onValueChange(hhmm(min)); setDraft(null); setOpen(false); }}
                  className={cn(
                    'flex min-h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5',
                    'text-left text-ui tabular-nums outline-none',
                    on ? 'bg-surface-fill font-medium text-ink-900' : 'text-ink-800 hover:bg-surface-hover',
                  )}
                >
                  <span className="flex-1">{label(min)}</span>
                  {startMin != null && (
                    <span className={cn('text-caption tabular-nums', on ? 'text-ink-600' : 'text-ink-500')}>
                      {durLabel(min - startMin)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
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
  if (parts && (parts[1] || parts[2])) return (parseInt(parts[1] ?? '0', 10) || 0) * 60 + (parseInt(parts[2] ?? '0', 10) || 0);
  return null;
}
