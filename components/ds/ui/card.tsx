import * as React from "react"
import { cn } from "@/lib/cn"

/**
 * THE card — one recipe, every card in the app.
 *
 * It was spelled five ways for one job, and two of them were WRONG in a theme nobody audited:
 *
 * | spelling | fill in dark | where |
 * |---|---|---|
 * | `bg-paper` | **L12.3**, on an L8.7 canvas | Documents' gallery + Collection Index cards |
 * | `bg-surface-raised` / `bg-paper-3` / `bg-card` | L21.2 | Goals, the portal, databases, boards |
 *
 * In LIGHT all three names are pure white, which is why every audit missed it: Documents' cards
 * were a different object from the rest of the app only after dark. The edge split the same way —
 * `border-line-soft` is ink at 7%, which measures **1.01:1 against the light canvas**, the exact
 * failure that once made a gallery read as "a white strip with a hole under it" (docs/master.md;
 * the Documents contrast entry in PROGRESS).
 *
 * So: `border-line` (the decorative tier, 1.13:1 on the canvas) and `bg-surface-raised`, at
 * `rounded-lg`. A card SITS in the layout — it does not float — so it carries no shadow;
 * elevation belongs to overlays and to the thing being dragged. It does carry `surface-edge`,
 * which is not elevation: one pixel of light along the top in dark, where a real surface would
 * catch the room (in light it is a transparent no-op). Anything a card needs beyond its
 * identity (padding, `overflow-hidden`, a grid span) is the call site's, and goes in `className`.
 */
export const CARD_CLASS = "rounded-lg border border-line bg-surface-raised surface-edge"

/**
 * A card you can open. One hover language: a WASH over the fill, never a border that thickens or a
 * lift (`wash-over` layers it as a background-image, because the card already owns `background`).
 */
export const CARD_INTERACTIVE_CLASS = `${CARD_CLASS} focus-ring cursor-pointer transition-colors hover:wash-over`

/** The card recipe plus whatever this card is. */
export function cardClass(className?: string) {
  return cn(CARD_CLASS, className)
}

/** The openable card plus whatever this card is. */
export function cardInteractiveClass(className?: string) {
  return cn(CARD_INTERACTIVE_CLASS, className)
}

export interface CardProps extends React.ComponentProps<"div"> {
  /** Hover lift + pointer + keyboard focusability (role="button"). */
  interactive?: boolean
  /** Chosen — e.g. a selected kanban card. */
  selected?: boolean
  /** Removes the resting shadow — for a card nested inside another card. */
  flat?: boolean
  /** Override the default padding (CSS length). */
  padding?: string
  /** Parent-surface hint — retained for call-site compatibility. */
  on?: "paper" | "paper-2"
  header?: React.ReactNode
  footer?: React.ReactNode
}

// The registry Card is a plain container meant to be composed with the
// CardHeader/CardContent/CardFooter parts below — which is what the sign-in and
// sign-up screens use. The props above are Zenboard's, and they are kept because
// ~100 call sites (the kanban card, settings panels) pass them; dropping them to
// take the registry version verbatim would have been a rewrite of those screens,
// not a component swap. Everything they add is ADDITIVE — the registry's own
// classes are still the base, so a card with no extra props is the registry card.
function Card({
  className, interactive, selected, flat, padding, on: _on, header, footer, children, style, ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={padding ? { padding, ...style } : style}
      className={cn(
        // The component draws the SAME card as `cardClass` — it was the registry's `bg-card`
        // (= `--card`, the dark-murky L12.3) with a resting `shadow-sm`, so the handful of screens
        // built from the component were a third card again.
        CARD_CLASS, "flex flex-col gap-6 py-6 text-card-foreground",
        flat && "shadow-none",
        interactive &&
          "focus-ring cursor-pointer transition-[box-shadow,transform,border-color] duration-slow ease-standard " +
            "hover:-translate-y-px hover:border-line hover:shadow-lift-2 active:translate-y-0 active:shadow-lift-1",
        selected && "border-berry-300 bg-berry-050",
        className
      )}
      {...props}
    >
      {header && <div className="flex items-start justify-between gap-2">{header}</div>}
      {children}
      {footer && <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3">{footer}</div>}
    </div>
  )
}

/**
 * The auto-filling grid these cards sit in. Not a registry concept; ours.
 *
 * `auto-fill` + `minmax(min, 1fr)` is the whole point: the columns respond to
 * the CONTAINER, not to the viewport, and the cards GROW to fill the row. The
 * alternative — a `flex-wrap` of fixed-width cards — is what the Documents
 * gallery used, and it left 156px of dead space on every row of a 616px
 * container because a 220px card cannot become 298px. It also needed a
 * `!important` media query to survive narrow widths, which is the tell that
 * the layout was fighting itself rather than describing itself.
 *
 * `min` is a named size, not a free number, so a gallery cannot quietly invent
 * a third column width.
 */
/** The rule itself, for callers that must own their wrapper element. */
export function cardGridClass(min: "sm" | "md" | "lg" = "md", className?: string) {
  return cn(
    "grid items-stretch gap-4",
    min === "sm" && "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
    min === "md" && "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
    min === "lg" && "grid-cols-[repeat(auto-fill,minmax(360px,1fr))]",
    className,
  )
}

export function CardGrid({
  className, min = "md", ...props
}: React.ComponentProps<"div"> & { min?: "sm" | "md" | "lg" }) {
  return <div className={cardGridClass(min, className)} {...props} />
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
