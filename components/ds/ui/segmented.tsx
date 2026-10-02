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
  /** accent = the thumb takes the brand fill: a MODE you are IN, not a view you are looking at (Focus).
   *  It spends the view one filled-accent, so a screen using it should carry no primary button. */
  tone?: "neutral" | "accent";
  /**
   * `sm` (default) is the toolbar switch — 28px, the height of a small button, right when the
   * control sits in a header row among other controls.
   *
   * `lg` is the control that IS the decision on the page: Home's Dashboard/Ask, where the toggle
   * is the second thing the eye reaches after the greeting and a 28px switch reads as a setting
   * someone left there. 36px, which is the app's own large-button height rather than a number
   * picked to look bigger (user, 2026-09-30, with ChatGPT's Chat/Work toggle: "i want toggle like
   * this bit large but in our styling not rounded").
   *
   * **Not rounded**, deliberately and at the user's word: the reference is a pill, and this house
   * does not draw pills — a fully-rounded track at 36px would be the one shape in the product
   * with no corner. It takes `--r-lg` (12) with the thumb at `--r-md` (8), which is concentric
   * against the 4px inset (12 − 4 = 8) and is the same corner language as every panel.
   */
  size?: "sm" | "lg";
  className?: string;
}

/** The two sizes, as one table — so the track, its inset, the thumb and the item can never disagree. */
const SIZES = {
  sm: { track: "rounded-md p-0.5", item: "h-6 rounded-sm px-2.5 text-ui", thumb: "top-0.5 bottom-0.5 rounded-sm" },
  lg: { track: "rounded-lg p-1", item: "h-7 rounded-md px-4 text-ui", thumb: "top-1 bottom-1 rounded-md" },
} as const;

export function SegmentedControl({ options, value, onValueChange, fit = "equal", variant = "well", tone = "neutral", size = "sm", className, ...aria }: SegmentedControlProps) {
  const S = SIZES[size];
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
    console.warn("SegmentedControl: max 5 options (§4.19). Use Tabs instead.");
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
      data-tone={tone}
      style={{ ["--focus-offset" as string]: "var(--color-surface-well)", boxShadow: "inset 0 0 0 1px var(--color-border-soft)" }}
      className={cn(
        // A clean, compact shadcn-style segmented container: a subtle dark well
        // (paper-5) with a soft edge and a rounded rectangle; the active thumb (a
        // lighter-gray fill below) carries the signal, inactive tabs blend in.
        "relative isolate grid grid-flow-col bg-paper-5",
        S.track,
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
          className={cn("absolute -z-10 transition-[transform,width] duration-base ease-out-quiet motion-reduce:transition-none", S.thumb)}
          style={{
            width: thumb.w,
            // thumb.x is the active item's offsetLeft (already includes the p-0.5
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
            background: 'var(--seg-thumb, var(--color-surface-thumb))',
            boxShadow: 'inset 0 0 0 1px var(--color-border-soft), var(--shadow-sm)',
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
          // WEIGHT STAYS PUT. Choosing used to add `font-semibold`, and a weight
          // is a WIDTH: measured on Home (Dashboard/Ask, fit="content"), switching
          // took the item from 114px to 112px, the control itself from 184.32 to
          // 183.48, and moved BOTH labels sideways — so the thumb spent its 150ms
          // sliding toward a target that was still moving, and the row twitched
          // under the cursor every time. The `tabs` variant above already says
          // this in its own comment; the well forgot it. The lifted thumb and the
          // ink step are the signal, which is the whole point of a thumb.
          //
          // No `transition-colors` either: the global `button:not(.zb-nopress)`
          // rule in globals.css is UNLAYERED and carries the whole shorthand, so
          // it already inks this at --duration-fast on --ease-hover — measured,
          // the `duration-instant` written here never applied. A class that
          // cannot win is a note that lies to the next reader.
          // AND IT HAS TO CENTRE ITS OWN LABEL (user, 2026-09-30: "top padding is off and i want
          // equel padding", with the control zoomed). The track's own geometry was already exact —
          // measured 2px of grey above, below, left and right of the thumb — so the complaint was
          // not the padding, it was the LABEL sitting inside it: `h-6` on a `display: block`
          // button puts a 20px line at the top of a 24px box, and Radix's Item is a plain button
          // with no centring of its own. Measured on Home: 0.5px above the label, 3.5px below.
          // Three pixels of the pill's slack, all of it at the bottom, on a control the eye reads
          // as a single object — which is exactly how it looks "off" without looking wrong.
          // `flex items-center justify-center` puts the slack back where it belongs, 2 and 2, and
          // `justify-center` matters for `fit="equal"`, where the item is wider than its words.
          className={cn(
            "focus-ring z-0 flex items-center justify-center font-medium",
            S.item,
            "text-ink-700 hover:text-ink-900 data-[state=checked]:text-ink-900",
            "disabled:cursor-not-allowed disabled:text-ink-500",
          )}
        >
          {o.label}
        </RR.Item>
      ))}
    </RR.Root>
  );
}
