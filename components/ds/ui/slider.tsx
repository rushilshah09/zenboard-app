import * as React from "react";
import * as RSl from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

// design-system.md §4.20 — h-1 track, berry fill, 16px paper thumb. Value shows
// above the thumb in a popover WHILE DRAGGING. ⇧←→ = 10 steps. Never a slider
// alone for a precise value — pair with a number input.
export interface SliderProps {
  value: number[];
  onValueChange: (v: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Human value for SR + drag popover, e.g. (v) => `${v}%` or "₹4,000". */
  format?: (v: number) => string;
  /** Tick dots — rendered only when total steps ≤ 10 (§4.20). */
  ticks?: boolean;
  /** Labels for multiple thumbs, e.g. ["Minimum","Maximum"]. */
  thumbLabels?: string[];
  "aria-label"?: string;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  format = String,
  ticks,
  thumbLabels,
  className,
  ...aria
}: SliderProps) {
  const [dragging, setDragging] = React.useState(false);
  const stepCount = (max - min) / step;
  const showTicks = ticks && stepCount <= 10;

  return (
    <RSl.Root
      value={value}
      onValueChange={(v) => {
        // ⇧ = 10 steps: Radix handles arrows at `step`; we scale on shift via
        // keydown below, so plain drag/arrow behaviour stays native.
        onValueChange(v);
      }}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={aria["aria-label"]}
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
    >
      <RSl.Track className="relative h-1 grow rounded-full bg-paper-5">
        {showTicks && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-between px-0.5">
            {Array.from({ length: stepCount + 1 }, (_, i) => (
              <span key={i} className="size-0.5 rounded-full bg-ink-300" />
            ))}
          </span>
        )}
        <RSl.Range className="absolute h-full rounded-full bg-[var(--accent)] data-[disabled]:bg-ink-300" />
      </RSl.Track>
      {value.map((v, i) => (
        <RSl.Thumb
          key={i}
          aria-label={thumbLabels?.[i] ?? aria["aria-label"]}
          aria-valuetext={format(v)}
          onKeyDown={(e) => {
            if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
              e.preventDefault();
              const dir = e.key === "ArrowRight" ? 1 : -1;
              const next = [...value];
              next[i] = Math.min(max, Math.max(min, v + dir * step * 10));
              onValueChange(next);
            }
          }}
          className={cn(
            "focus-ring relative block size-4 rounded-full border border-line-strong bg-paper shadow-lift-1",
            "transition-transform duration-instant hover:scale-110",
            "active:scale-115 active:ring-4 active:ring-berry-alpha-20",
            "data-[disabled]:border-transparent data-[disabled]:bg-ink-300 data-[disabled]:shadow-none",
          )}
        >
          {/* Value popover while dragging (§4.20) */}
          {dragging && !disabled && (
            <span
              aria-hidden
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xs bg-ink-900 px-2 py-1 font-mono text-caption text-paper shadow-lift-2"
            >
              {format(v)}
            </span>
          )}
        </RSl.Thumb>
      ))}
    </RSl.Root>
  );
}
