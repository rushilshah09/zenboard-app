import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff, Loader2, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";

// design-system.md §4.12 + Zenboard handoff — Text input. Resting: raised (ivory)
// fill, hairline border-default, radius-md. Hover firms the border to strong.
// Focus = border-berry-500 + a 3px berry-100 halo with NO offset (the one
// sanctioned ring deviation: an offset ring on a bordered field shows a paper gap).
// Error mirrors it in the danger family. Filled is not a state.
export const inputBox = cva(
  "w-full rounded-md border bg-surface-raised text-ink-900 placeholder:text-ink-500 " +
    "transition-colors duration-instant " +
    "border-line hover:border-line-strong " +
    "focus:border-berry-500 focus:outline-none focus:ring-[3px] focus:ring-berry-100 " +
    "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:ring-danger-100 " +
    "disabled:bg-surface-disabled disabled:text-ink-300 disabled:border-transparent " +
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
            <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-400 [&_svg]:size-4" aria-hidden>
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
            {loading && <Loader2 className="size-3.5 animate-spin text-ink-400" aria-hidden />}
            {unit && !loading && <span className="font-mono text-mono-sm text-ink-600">{unit}</span>}
            {onClear && current.length > 0 && !loading && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setUncontrolled("");
                  onClear();
                }}
                className="focus-ring grid size-6 place-items-center rounded-xs text-ink-400 hover:text-ink-700"
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
                className="focus-ring grid size-6 place-items-center rounded-xs text-ink-400 hover:text-ink-700"
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
