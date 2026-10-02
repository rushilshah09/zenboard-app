import * as React from "react";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";

// design-system.md §4.13 — Text area. Auto-grow 3 rows → max-h-64 then scrolls,
// via a hidden mirror (not JS height measurement per keystroke). resize-y only.
// ⌘Enter submits the surrounding form; Enter newlines (inverted only in chat).
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
  showCount?: boolean;
  /**
   * Start at ONE line instead of three, and grow from there — a message composer. A chat box that
   * opens three lines tall reads as a form to fill in, not a line to type on; Slack's opens at one.
   */
  compact?: boolean;
  /**
   * The DS's fourth edge tier, DECLARED: this field deliberately has no box of its own, because
   * something around it is the surface. Without it a composer inside a card is a bordered field
   * inside a bordered card, which is the double-border fault the design audit already named.
   *
   * The wrapper then owns the focus ring (`focus-within:`), or the field loses its focus state
   * entirely — which is why this is a prop and not a className the caller guesses at.
   */
  chromeless?: boolean;
  /**
   * `soft` (the default) is the house field — a recessed wash with no edge until it is touched —
   * and it is TextInput's default too. The text area had been left drawing the older bordered box,
   * so a form put a filled one-line field directly above an outlined paragraph field and the two
   * read as different products (found 2026-10-01 on the public form). `outline` keeps the drawn
   * box, for the field that sits on a wash, exactly as TextInput's `outline` does.
   */
  tone?: "soft" | "outline";
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autoGrow = true, showCount, compact = false, chromeless = false, tone = "soft", className, value, defaultValue, maxLength, onKeyDown, onInput, ...props },
  ref,
) {
  const fieldProps = useFieldProps(props);
  const [mirror, setMirror] = React.useState(String(value ?? defaultValue ?? ""));
  const current = value !== undefined ? String(value) : mirror;
  const remaining = maxLength !== undefined ? maxLength - current.length : undefined;
  const showCounter = showCount && remaining !== undefined && remaining <= 20;

  const shared = cn(
    // TextInput's radius and inset, so a paragraph field and a line field are one family.
    "w-full rounded-sm px-3 py-2 text-body",
    chromeless ? "border-0" : "border",
    className,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative grid">
        {/* The mirror sits in the same grid cell and sets the height. */}
        {autoGrow && (
          <div aria-hidden className={cn(shared, "invisible max-h-64 whitespace-pre-wrap break-words [grid-area:1/1]", compact ? (chromeless ? "min-h-5" : "min-h-8") : "min-h-20")}>
            {current + "\n"}
          </div>
        )}
        <textarea
          ref={ref}
          data-chromeless={chromeless ? "" : undefined}
          rows={compact ? 1 : 3}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          maxLength={maxLength}
          onInput={(e) => {
            if (value === undefined) setMirror(e.currentTarget.value);
            onInput?.(e);
          }}
          onKeyDown={(e) => {
            // ⌘Enter / Ctrl-Enter submits the surrounding form (§4.13).
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.currentTarget.form?.requestSubmit();
            }
            onKeyDown?.(e);
          }}
          className={cn(
            shared,
            "text-ink-900 placeholder:text-ink-500 transition-colors duration-instant",
            chromeless && "bg-transparent outline-none focus-visible:outline-none",
            // The same two tones as TextInput (input.tsx `inputBox`), spelled the same way.
            !chromeless && tone === "soft" && "bg-surface-fill border-transparent hover:wash-over focus:bg-transparent focus:border-[var(--accent)]",
            // Hover firms to the control tier — one rule for every field, so
            // a textarea, an input and a select behave identically. Was
            // `border-ink-300`, a SOLID at roughly the same value as the
            // resting edge, so hovering changed almost nothing.
            !chromeless && tone === "outline" && "bg-paper border-line-strong hover:border-line-control",
            // One focus recipe app-wide; the berry ring compiled to nothing (see input.tsx).
            // A chromeless field is the exception, and a DECLARED one: the wrapper rings instead.
            !chromeless && "focus-ring",
            "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:bg-danger-100/40",
            "disabled:bg-surface-disabled disabled:text-ink-500 disabled:border-transparent",
            // A chromeless field has no box to grey out: its wrapper shows the state.
            chromeless && "disabled:bg-transparent",
            "read-only:bg-paper-3 read-only:border-transparent read-only:text-ink-700",
            autoGrow
              ? "max-h-64 resize-none overflow-y-auto [grid-area:1/1]"
              : "resize-y",
            compact ? (chromeless ? "min-h-5" : "min-h-8") : "min-h-20",
          )}
          {...props}
          {...fieldProps}
        />
      </div>
      {showCounter && (
        <span className={cn("self-end text-meta", remaining === 0 ? "text-danger-600" : "text-ink-500")} aria-live="polite">
          {remaining} left
        </span>
      )}
    </div>
  );
});
