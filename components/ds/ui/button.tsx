import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "@/lib/icons";
import { cn } from "@/lib/cn";

// DESIGN_SYSTEM.md §5.1 — the most-used control. Reference-measured from the
// Notion "Continue"/"Share" and Attio "New" buttons: 28/32/40 heights, radius
// 6 (8 on large), 6px icon↔label gap, hover changes BACKGROUND ONLY (§6.1), no
// press-scale (§6.3). Eight states via variants/data-attrs; no lift, no shadow.
export const button = cva(
  // One focus system: the .focus-ring utility (surface-offset + grayscale ring — B&G
  // monochrome rule), NOT Tailwind ring-* — a single ring implementation to maintain (B1.3).
  "focus-ring relative inline-flex items-center justify-center font-medium whitespace-nowrap select-none " +
    // Motion: colors only, 100ms (--duration-fast) — inside the 100–150ms band the
    // constitution mandates (CLAUDE.md §Interaction). No scale/lift/shadow (§6.3).
    "transition-colors duration-fast ease-standard cursor-pointer " +
    // WCAG 2.5.5 target size: on coarse pointers a zero-ink ::after extends the hit
    // area to ≥44px tall (h-11) at the drawn width — VERTICAL only, so horizontally
    // adjacent members (ButtonGroup / SplitButton) never overlap. IconButton adds the
    // horizontal reach for square controls; `link` opts out (compoundVariant below).
    "[@media(pointer:coarse)]:after:content-[''] [@media(pointer:coarse)]:after:absolute " +
    "[@media(pointer:coarse)]:after:inset-x-0 [@media(pointer:coarse)]:after:top-1/2 " +
    "[@media(pointer:coarse)]:after:h-11 [@media(pointer:coarse)]:after:-translate-y-1/2 " +
    // Loading ≠ disabled (§5.1 / B1.1): inert via data-loading + pointer-events-none,
    // so the variant's fill/width/name survive. Real disabled keeps its own treatment,
    // with a transparent border so it doesn't read as a broken enabled control (B3.13).
    "disabled:pointer-events-none disabled:bg-surface-disabled disabled:text-ink-300 disabled:border-transparent " +
    // No transforms on click (§6.3) — pressed feedback is the variant's active: fill only.
    "data-[loading]:pointer-events-none data-[loading]:cursor-progress",
  {
    variants: {
      variant: {
        // B&G: no colorful buttons. Primary = the ink solid (#F2F1EB fill,
        // #121212 label) — at most one per view.
        primary: "bg-ink-900 text-onsolid hover:bg-ink-700 active:bg-ink-900",
        // B&G secondary (Figma 1:811): white-12% fill, no border, default ink label.
        secondary:
          "bg-surface-fill text-ink-800 hover:bg-surface-fill-hover hover:text-ink-900 active:bg-surface-fill",
        // Outline — the ONE bordered exception to the fills-only rule (button-spec §8).
        // Transparent + hairline (border-line-strong), for actions on an already-filled
        // surface where a 12% fill would read as a nested tile. Stays monochrome.
        outline:
          "border border-line-strong bg-transparent text-ink-800 hover:bg-surface-hover hover:text-ink-900 active:bg-surface-active",
        // Handoff ghost: transparent, secondary-ink label; hover = warm wash + ink-900.
        ghost: "text-ink-600 hover:bg-surface-hover hover:text-ink-900 active:bg-surface-active",
        quiet: "text-ink-500 hover:bg-surface-hover active:bg-surface-active",
        // LEGACY alias — in B&G the ink solid IS primary, so neutral ≡ primary.
        // Keep for old call sites; new code writes variant="primary".
        neutral: "bg-ink-900 text-onsolid hover:bg-ink-700 active:bg-ink-900",
        // B&G tinted: the neutral selected wash — no colored washes in chrome.
        tinted: "bg-surface-selected text-ink-900 hover:bg-surface-fill active:bg-surface-fill",
        // Solid red is reserved for confirm dialogs (§5.1); distinct pressed fill (B2.8).
        danger: "bg-danger-500 text-onsolid hover:bg-danger-600 active:bg-danger-700",
        // The DEFAULT destructive: ghost style, danger ink, pale-chip hover (§5.1).
        dangerGhost:
          "border border-transparent text-danger-600 hover:bg-danger-100 active:bg-danger-100",
        // B&G link: ink text with underline — color never carries meaning in chrome.
        link: "text-ink-800 underline underline-offset-2 hover:text-ink-900 active:text-ink-900",
      },
      size: {
        // B&G ladder = the app's control grid (28/32/36; --ctl-* in globals),
        // anchored to the Figma home CTAs (28px, radius 6, 10px pad).
        // xs (24) is the dense inline/editor-toolbar size below the grid.
        xs: "h-6 gap-1 rounded-xs px-2 text-meta",       // 24px · dense inline
        sm: "h-7 gap-1 rounded-sm px-2.5 text-ui",       // 28px · Figma 1:811/1:838
        md: "h-8 gap-1.5 rounded-md px-3 text-ui",       // 32px · default (= input height)
        lg: "h-9 gap-2 rounded-md px-4 text-ui",         // 36px · prominent
        // xl (40) is the hero/auth CTA — the only step above the grid.
        xl: "h-10 gap-2 rounded-md px-5 text-body-lg",
      },
      fullWidth: { true: "w-full" },
      iconOnly: { true: "aspect-square px-0" },
      // Toggle styling is opt-in, not baked into the base — a toggled primary must
      // never flip berry → paper-4 with unreadable text (B2.9). Pair with aria-pressed.
      toggle: { true: "aria-[pressed=true]:bg-paper-4 aria-[pressed=true]:text-ink-900" },
    },
    compoundVariants: [
      // A link is inline text, not a box: no height or padding, and no hit-area ::after.
      { variant: "link", class: "inline h-auto rounded-none p-0 align-baseline after:hidden" },
    ],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, iconOnly, toggle, asChild, loading, icon, iconRight, children, disabled, onClick, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size, fullWidth, iconOnly, toggle }), className)}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      // Loading stays inert WITHOUT `disabled`, so the fill/width/name survive
      // (§4.1). pointer-events-none blocks the mouse; nulling onClick blocks the
      // keyboard path — together that's the double-submit guard, minus the gray.
      disabled={asChild ? undefined : disabled || undefined}
      onClick={loading ? undefined : onClick}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_1.4s_linear_infinite]" />
        </span>
      )}
      {/* The label stays in the DOM and the a11y tree under opacity-0 (NOT
          visibility:hidden, which would drop the accessible name) so the width
          never shifts and screen readers keep announcing it (§4.1). gap:inherit
          reuses the button's own size-scaled gap. */}
      <span className={cn("inline-flex items-center [gap:inherit]", loading && "opacity-0")}>
        {icon}
        {children}
        {iconRight}
      </span>
    </Comp>
  );
});
