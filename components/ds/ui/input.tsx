import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff, Loader2, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
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
  "w-full rounded-md border bg-surface-raised text-ink-900 placeholder:text-ink-500 " +
    "transition-colors duration-instant " +
    // EDGE TIER (2026-09-08). `border-line` is `--border`, the same token that
    // draws a card edge and a divider — and on a white card a white field with
    // that edge measured **1.13:1**, i.e. no visible field at all. A static
    // surface and an interactive one are not the same job: -strong is the
    // field tier (>=1.6:1), and hover firms to the control tier (>=3:1), so
    // the hover is now something you can actually see. See app/tokens-light.css.
    "border-line-strong hover:border-line-control focus-ring " +
    "aria-[invalid=true]:border-danger-500 " +
    "disabled:bg-surface-disabled disabled:text-ink-500 disabled:border-transparent " +
    "read-only:bg-surface-sunken read-only:border-transparent read-only:text-ink-700",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-ui",   // 32px · handoff sm
        md: "h-9 px-3 text-ui",   // 36px · handoff default (control-x 12px pad)
        lg: "h-11 px-3 text-ui",  // 44px · handoff lg
      },
    },
    defaultVariants: { size: "md" },
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
  { size, icon, prefix, unit, onClear, reveal, loading, showCount, className, type, value, defaultValue, maxLength, ...props },
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
        {prefix && (
          <span className="flex items-center rounded-s-md border border-e-0 border-line bg-surface-sunken px-3 text-ui text-ink-600">
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
              inputBox({ size }),
              icon && "ps-9",
              hasTrailing && "pe-9",
              prefix && "rounded-s-none",
              className,
            )}
            {...props}
            {...fieldProps}
          />
          <span className="absolute inset-y-0 end-2 flex items-center gap-1">
            {loading && <Loader2 className="size-3.5 animate-spin text-ink-500" aria-hidden />}
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
