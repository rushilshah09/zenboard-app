import * as React from "react";
import * as RR from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

// design-system.md §4.19 — one of 2–5 views/modes. The paper thumb SLIDES
// between positions (translateX + width, dur-base, ease-out-quiet) — never a
// background-colour swap. One tab stop; ←→ moves and activates. Max 5.
export interface SegmentedControlProps {
  /** `aria-label` gives icon-only items an accessible name (label has no text). */
  options: { value: string; label: React.ReactNode; disabled?: boolean; "aria-label"?: string }[];
  value: string;
  onValueChange: (v: string) => void;
  "aria-label": string;
  /** Equal widths by default; content-width when labels vary wildly. */
  fit?: "equal" | "content";
  className?: string;
}

export function SegmentedControl({ options, value, onValueChange, fit = "equal", className, ...aria }: SegmentedControlProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = React.useState<{ x: number; w: number } | null>(null);

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
    if (!el) return setThumb(null);
    setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [measure]);

  if (options.length > 5 && process.env.NODE_ENV !== "production") {
    console.warn("SegmentedControl: max 5 options (§4.19) — use Tabs instead.");
  }

  return (
    <RR.Root
      ref={listRef}
      value={value}
      onValueChange={onValueChange}
      orientation="horizontal"
      // The items' focus ring offsets in this paper-5 well, not on paper (§2.11.2).
      // A SOFT hairline inset edge (line-soft) gives the container just enough
      // definition without the heavy outlined look — a reliable box-shadow, since
      // Tailwind ring-* colours don't resolve the token here.
      style={{ ["--focus-offset" as string]: "var(--color-surface-well)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}
      className={cn(
        // A clean, compact shadcn-style segmented container: a subtle dark well
        // (paper-5) with a soft edge and a rounded rectangle; the active thumb (a
        // lighter-gray fill below) carries the signal, inactive tabs blend in.
        "relative isolate grid grid-flow-col rounded-lg bg-paper-5 p-1",
        fit === "equal" && "auto-cols-fr",
        className,
      )}
      {...aria}
    >
      {/* The sliding thumb — under the items, over the track. Notion-style: a
          genuinely LIFTED solid fill (paper-4 sits well above the paper-5 well)
          plus a soft drop shadow — no border. The fill IS the signal. */}
      {thumb && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 -z-10 rounded-md transition-[transform,width] duration-base ease-out-quiet motion-reduce:transition-none"
          style={{
            width: thumb.w,
            // thumb.x is the active item's offsetLeft (already includes the p-1
            // inset); the abspos thumb's static origin is the padding-box edge, so
            // translate by the full offsetLeft to sit exactly on the item.
            transform: `translateX(${thumb.x}px)`,
            // A clean lighter-gray key that reads clearly above the well (fill IS the
            // signal), with a SUBTLE hairline border and a SOFT shadow — the polished
            // shadcn-style active thumb, not a heavy floating box.
            background: 'color-mix(in srgb, var(--ink) 12%, var(--paper-4))',
            boxShadow: 'inset 0 0 0 1px var(--line-soft), 0 1px 2px rgb(0 0 0 / 0.20), 0 1px 3px rgb(0 0 0 / 0.12)',
          }}
        />
      )}
      {options.map((o) => (
        <RR.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          aria-label={o["aria-label"]}
          data-value={o.value}
          className={cn(
            "focus-ring z-0 h-7 rounded-md px-3 text-ui font-medium transition-colors duration-instant",
            "text-ink-700 hover:text-ink-900 data-[state=checked]:font-semibold data-[state=checked]:text-ink-900",
            "disabled:cursor-not-allowed disabled:text-ink-300",
          )}
        >
          {o.label}
        </RR.Item>
      ))}
    </RR.Root>
  );
}
