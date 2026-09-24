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
  /**
   * `well` (default): a recessed track with a sliding thumb — a mode switch.
   * `tabs`: no track; the chosen option is a quiet pill and the rest are plain
   * labels — Notion's database views, which are a row of named places rather than
   * a two-way switch, and can run to many (the user asked for Notion's database
   * chrome "same to same", 2026-09-15). The row scrolls rather than wrapping.
   */
  variant?: "well" | "tabs";
  className?: string;
}

export function SegmentedControl({ options, value, onValueChange, fit = "equal", variant = "well", className, ...aria }: SegmentedControlProps) {
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

  if (variant === "well" && options.length > 5 && process.env.NODE_ENV !== "production") {
    console.warn("SegmentedControl: max 5 options (§4.19) — use Tabs instead.");
  }

  if (variant === "tabs") {
    return (
      <RR.Root
        value={value}
        onValueChange={onValueChange}
        orientation="horizontal"
        data-slot="segmented"
        data-variant="tabs"
        className={cn("zb-no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto", className)}
        {...aria}
      >
        {options.map((o) => (
          <RR.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            aria-label={o["aria-label"]}
            data-slot="segmented-item"
            data-value={o.value}
            className={cn(
              "focus-ring h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-ui transition-colors duration-fast",
              // The chosen view is a pill of the active wash; the others are labels
              // that wash on hover. Weight stays put, so choosing never shifts the row.
              "text-ink-600 hover:bg-surface-hover hover:text-ink-800",
              "data-[state=checked]:bg-surface-active data-[state=checked]:text-ink-900",
              "disabled:cursor-not-allowed disabled:text-ink-500",
            )}
          >
            {o.label}
          </RR.Item>
        ))}
      </RR.Root>
    );
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
      data-slot="segmented"
      data-variant="well"
      style={{ ["--focus-offset" as string]: "var(--color-surface-well)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}
      className={cn(
        // A clean, compact shadcn-style segmented container: a subtle dark well
        // (paper-5) with a soft edge and a rounded rectangle; the active thumb (a
        // lighter-gray fill below) carries the signal, inactive tabs blend in.
        "relative isolate grid grid-flow-col rounded-md bg-paper-5 p-0.5",
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
          data-slot="segmented-thumb"
          className="absolute top-0.5 bottom-0.5 -z-10 rounded-sm transition-[transform,width] duration-base ease-out-quiet motion-reduce:transition-none"
          style={{
            width: thumb.w,
            // thumb.x is the active item's offsetLeft (already includes the p-1
            // inset); the abspos thumb's static origin is the padding-box edge, so
            // translate by the full offsetLeft to sit exactly on the item.
            transform: `translateX(${thumb.x}px)`,
            // The thumb is a control LIFTED OUT of the track, so it takes the
            // raised surface — not a wash. It used to be `12% ink over paper-4`,
            // which reasons in dark: ink is light there, so the mix lands above
            // the well. In light the same expression is 12% BLACK over white =
            // #e0e0e0, against a #e1e1e1 track — the selected tab was the same
            // colour as the thing it sat in, and read as unselected (user
            // screenshot). One token, resolved per theme, and the relationship
            // (thumb above track) holds in both.
            background: 'var(--color-surface-thumb)',
            boxShadow: 'inset 0 0 0 1px var(--line-soft), var(--shadow-sm)',
          }}
        />
      )}
      {options.map((o) => (
        <RR.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          aria-label={o["aria-label"]}
          data-slot="segmented-item"
          data-value={o.value}
          className={cn(
            "focus-ring z-0 h-6 rounded-sm px-2.5 text-ui font-medium transition-colors duration-instant",
            "text-ink-700 hover:text-ink-900 data-[state=checked]:font-semibold data-[state=checked]:text-ink-900",
            "disabled:cursor-not-allowed disabled:text-ink-500",
          )}
        >
          {o.label}
        </RR.Item>
      ))}
    </RR.Root>
  );
}
