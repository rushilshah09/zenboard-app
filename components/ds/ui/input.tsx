import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";
import { useFieldProps } from "./field";

// design-system.md §4.12 + Zenboard handoff — Text input. Resting: raised (ivory)
// fill, hairline border-default, radius-md. Hover firms the border to strong.
// Error mirrors focus in the danger family. Filled is not a state.
//
// FOCUS — the recipe was `focus:border-berry-500 focus:ring-[3px]
// focus:ring-berry-100`, and it rendered **nothing**: measured on a live field,
// a focused input reported `box-shadow: none` with its border colour unchanged.
// Tailwind v4's `ring-*` utilities need the ring custom properties, and `berry`
// is not in that namespace, so the declarations compiled away — the same failure
// mode as the z-index registry and the header tokens. Every text input in the
// app therefore had NO visible focus state: modals, settings, every create form.
// (`berry` is also a legacy Paper-OS accent; this app is monochrome.)
// `focus-ring` is the one recipe the rest of the app uses, and it keys off
// `:focus-visible`, so it no longer fires on a mouse click either.
export const inputBox = cva(
  "w-full rounded-sm border text-ink-900 placeholder:text-ink-500 " +
    "transition-colors duration-instant focus-ring " +
    "aria-[invalid=true]:border-danger-500 " +
    "disabled:bg-surface-disabled disabled:text-ink-500 disabled:border-transparent " +
    "read-only:bg-surface-sunken read-only:border-transparent read-only:text-ink-700",
  {
    variants: {
      // ── TONE (2026-09-25) ────────────────────────────────────────────────
      // `soft` is the default because a field is not a card: it is a place to
      // put something, and a recessed wash says that more quietly than a box
      // drawn around nothing. Measured off the user's reference: the resting
      // field is #F2F1EB on a #FAF9F5 sheet — 1.05:1, exactly what
      // surface-sunken measures on a white card here — and it has NO edge until
      // you touch it, at which point it lifts to the card's own fill and takes
      // an accent edge. The focus RING is untouched (`focus-ring`, keyboard
      // only); the accent border is what a mouse click gets, so both pointers
      // see the field answer.
      tone: {
        // A WASH, not a tone. `bg-surface-sunken` is one absolute colour, and a field does not
        // live on one ground: swept across twelve screens, six of them had a field sitting on a
        // band or an inset of the SAME tone — 1.00:1, a field you cannot see. `surface-fill` is
        // 6% of the theme's own ink, so it composites a step down from whatever is behind it, on
        // a card, a band, a popover or a sheet, in both themes. Same reasoning as "state is a
        // wash, never an elevation" (app/theme-bridge.test.ts), applied to a resting fill.
        soft:
          "bg-surface-fill border-transparent hover:wash-over " +
          "focus:bg-transparent focus:border-[var(--accent)]",
        // The bordered field, kept for a field that sits ON a wash — where a
        // recessed fill would have nothing to be recessed from. EDGE TIER
        // (2026-09-08): `border-line` is the divider tier, and on a white card
        // a white field with that edge measured 1.13:1 — no visible field at
        // all. -strong is the field tier (>=1.6:1); hover firms to -control.
        outline: "bg-surface-raised border-line-strong hover:border-line-control",
      },
      size: {
        // THE CONTROL LADDER, the same three heights a Button takes (28 · 32 · 36),
        // so a field and the button beside it line up. They were 32 · 36 · 44 — every
        // form put a 36px field next to a 32px button.
        sm: "h-7 px-2.5 text-ui", // 28px · toolbars, filters, inline
        md: "h-8 px-3 text-ui",   // 32px · default (= Button md)
        lg: "h-9 px-3 text-ui",   // 36px · prominent
      },
    },
    defaultVariants: { size: "md", tone: "soft" },
  },
);

// ── inlineEdit — the FOURTH edge tier: no boundary, on purpose ──────────────
//
// A doc title, a form's heading, a task title typed in place. The text IS the
// content, so a box around it would be a lie about what you are editing —
// Notion's page title is the reference, and it has no field either.
//
// This exists because the pattern was already everywhere and had no name:
// ~50 occurrences of `border-0 bg-transparent … outline-none` across 12 files,
// each hand-spelled, so nothing distinguished "deliberately chromeless" from
// "a field that lost its border" — including to the contrast audit, which
// reported all of them as failures with no way to tell which were real.
//
// `data-chromeless` is the declaration. It costs nothing at runtime and makes
// the intent legible to a sweep, a reviewer, and the next person who wonders
// why this input has no box.
//
// The trade is genuine and accepted: there is no resting affordance, so the
// PLACEHOLDER is doing the work of the border. Never render one of these
// without a placeholder or an adjacent label.
export const inlineEdit = cva(
  "w-full border-0 bg-transparent p-0 outline-none placeholder:text-ink-500 " +
    // A chromeless editor is as tall as its text - 20px for a label - which a
    // finger misses. The floor is a min-height, not the `touch-min` ::after: an
    // input cannot own a pseudo-element at all.
    "[@media(pointer:coarse)]:min-h-6 " +
    "focus-visible:outline-none",
  {
    variants: {
      as: {
        title: "font-display text-h1 text-ink-900",   // a doc / form heading
        subtitle: "text-body-lg leading-relaxed text-ink-700",
        label: "text-body font-medium text-ink-900 placeholder:font-normal",
        body: "text-body text-ink-800",
        // A one-line field at control size — the add-a-row line, a message box — set like the rows around it.
        ui: "text-ui text-ink-900",
      },
    },
    defaultVariants: { as: "body" },
  },
);

/** Props every chromeless editor carries, so the exemption is declared once. */
export const inlineEditProps = { "data-chromeless": "" } as const;

// ── GrowText — a chromeless editor exactly as big as its words ───────────────
//
// A question typed into a form builder wraps onto two lines in the published form,
// so it has to wrap where it is typed too, or the builder is lying about the page.
// `field-sizing: content` does this in one declaration, and only Chromium has it:
// in Firefox and older Safari a field keeps its default size, and a long question
// scrolls sideways inside a 20-character box. So the box takes its size from an
// invisible copy of its own text laid in the same grid cell — the long-standing way
// to grow a field to fit that works in every browser.
//
// `inline` hugs the words (a label with "Optional" after it); otherwise it fills the
// line. `singleLine` keeps Enter for the caller (next question) and folds pasted
// newlines into spaces, for text that is one line wherever it is shown.
export interface GrowTextProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "rows"> {
  value: string;
  /** The `inlineEdit` role the words take — title, subtitle, label, body, ui. */
  as?: VariantProps<typeof inlineEdit>["as"];
  inline?: boolean;
  singleLine?: boolean;
  /** Typography and colour, given to the field AND its measuring copy so the two agree to the pixel. */
  textClassName?: string;
}

export const GrowText = React.forwardRef<HTMLTextAreaElement, GrowTextProps>(function GrowText(
  { value, as = "body", inline = false, singleLine = false, textClassName, className, placeholder, onKeyDown, onChange, ...props },
  ref,
) {
  const text = cn(inlineEdit({ as }), textClassName);
  return (
    <span className={cn(inline ? "inline-grid max-w-full" : "grid w-full", "min-w-0", className)}>
      {/* The measure: same words, same type, never seen. A zero-width space keeps an empty
          field one line tall, and a trailing newline from typing Enter its own line. */}
      <span aria-hidden className={cn(text, "invisible col-start-1 row-start-1 whitespace-pre-wrap break-words")}>
        {(value || placeholder || "") + "\u200b"}
      </span>
      <textarea
        ref={ref}
        rows={1}
        // A textarea's default 20 columns would set the cell's minimum width, and an `inline`
        // field would never hug a short label. One column hands the sizing to the measure.
        cols={1}
        value={value}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (singleLine && e.key === "Enter") e.preventDefault();
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          if (singleLine && /[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/[\r\n]+/g, " ");
          onChange?.(e);
        }}
        className={cn(text, "col-start-1 row-start-1 h-full resize-none overflow-hidden whitespace-pre-wrap break-words")}
        {...inlineEditProps}
        {...props}
      />
    </span>
  );
});

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputBox> {
  /** Leading icon (icon-md, ink-400). */
  icon?: React.ReactNode;
  /** Inset prefix (currency/URL) — part of the field, paper-3 with a border-r. */
  prefix?: string;
  /** Trailing unit label in mono-sm ink-500 (e.g. "kg", "%"). */
  unit?: string;
  /** Show a trailing clear × when there's a value. */
  onClear?: () => void;
  /** Password field with a reveal toggle. */
  reveal?: boolean;
  /** Async-validation spinner (trailing). */
  loading?: boolean;
  /** Show "N left" once remaining ≤ 20 (needs maxLength). */
  showCount?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { size, tone, icon, prefix, unit, onClear, reveal, loading, showCount, className, type, value, defaultValue, maxLength, ...props },
  ref,
) {
  const fieldProps = useFieldProps(props);
  const [shown, setShown] = React.useState(false);
  const [uncontrolled, setUncontrolled] = React.useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : uncontrolled;
  const remaining = maxLength !== undefined ? maxLength - current.length : undefined;
  const showCounter = showCount && remaining !== undefined && remaining <= 20;
  const resolvedType = reveal ? (shown ? "text" : "password") : type;
  const hasTrailing = Boolean(onClear || reveal || loading || unit);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex w-full items-stretch">
        {/* The prefix is part of the FIELD, so it wears the field's own wash and no edge — a bordered
            box glued to a borderless wash read as two controls (Settings → hourly rate). */}
        {prefix && (
          <span className="flex items-center rounded-s-sm border border-e-0 border-transparent bg-surface-fill ps-3 pe-1 text-ui text-ink-600">
            {prefix}
          </span>
        )}
        <div className="relative flex-1">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-500 [&_svg]:size-4" aria-hidden>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            type={resolvedType}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            maxLength={maxLength}
            onInput={value === undefined ? (e) => setUncontrolled(e.currentTarget.value) : undefined}
            className={cn(
              inputBox({ size, tone }),
              icon && "ps-9",
              hasTrailing && "pe-9",
              prefix && "rounded-s-none",
              className,
            )}
            {...props}
            {...fieldProps}
          />
          <span className="absolute inset-y-0 end-2 flex items-center gap-1">
            {loading && <Spinner size={14} className="text-ink-500" />}
            {unit && !loading && <span className="font-mono text-mono-sm text-ink-600">{unit}</span>}
            {onClear && current.length > 0 && !loading && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setUncontrolled("");
                  onClear();
                }}
                className="focus-ring grid size-6 place-items-center rounded-xs text-ink-500 hover:text-ink-700"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
            {reveal && (
              <button
                type="button"
                aria-label={shown ? "Hide password" : "Show password"}
                aria-pressed={shown}
                onClick={() => setShown((s) => !s)}
                className="focus-ring grid size-6 place-items-center rounded-xs text-ink-500 hover:text-ink-700"
              >
                {shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              </button>
            )}
          </span>
        </div>
      </div>
      {showCounter && (
        <span className={cn("self-end text-meta", remaining === 0 ? "text-danger-600" : "text-ink-500")} aria-live="polite">
          {remaining} left
        </span>
      )}
    </div>
  );
});

/** Validate on blur, then on every keystroke AFTER first marked invalid (§4.12). */
export function useValidation<T = string>(validate: (value: T) => string | undefined) {
  const [error, setError] = React.useState<string>();
  const touched = React.useRef(false);
  return {
    error,
    onBlur: (value: T) => {
      touched.current = true;
      setError(validate(value));
    },
    onChange: (value: T) => {
      if (touched.current && error !== undefined) setError(validate(value));
    },
  };
}
