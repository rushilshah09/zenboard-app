import * as React from "react";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";

// design-system.md §4.13 — Text area. Auto-grow 3 rows → max-h-64 then scrolls,
// via a hidden mirror (not JS height measurement per keystroke). resize-y only.
// ⌘Enter submits the surrounding form; Enter newlines (inverted only in chat).
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
  showCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autoGrow = true, showCount, className, value, defaultValue, maxLength, onKeyDown, onInput, ...props },
  ref,
) {
  const fieldProps = useFieldProps(props);
  const [mirror, setMirror] = React.useState(String(value ?? defaultValue ?? ""));
  const current = value !== undefined ? String(value) : mirror;
  const remaining = maxLength !== undefined ? maxLength - current.length : undefined;
  const showCounter = showCount && remaining !== undefined && remaining <= 20;

  const shared = cn(
    "w-full rounded-sm border px-2.5 py-2 text-body",
    className,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative grid">
        {/* The mirror sits in the same grid cell and sets the height. */}
        {autoGrow && (
          <div aria-hidden className={cn(shared, "invisible max-h-64 min-h-20 whitespace-pre-wrap break-words [grid-area:1/1]")}>
            {current + "\n"}
          </div>
        )}
        <textarea
          ref={ref}
          rows={3}
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
            "bg-paper text-ink-900 placeholder:text-ink-500 transition-colors duration-instant",
            "border-line-strong hover:border-ink-300",
            "focus:border-berry-500 focus:outline-none focus:ring-2 focus:ring-berry-alpha-20",
            "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:bg-danger-100/40",
            "disabled:bg-surface-disabled disabled:text-ink-300 disabled:border-transparent",
            "read-only:bg-paper-3 read-only:border-transparent read-only:text-ink-700",
            autoGrow
              ? "max-h-64 min-h-20 resize-none overflow-y-auto [grid-area:1/1]"
              : "min-h-20 resize-y",
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
