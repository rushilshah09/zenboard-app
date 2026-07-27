import * as React from "react";
import * as RSel from "@radix-ui/react-select";
import { Check, ChevronDown } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";

// design-system.md §4.14 — ONE value from a known, short list (≤12; beyond that,
// Combobox). Trigger looks exactly like a Text Input. Selected item carries a
// check — the colour-independent signal. Never a Select for 2 options.
export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}
export interface SelectGroup {
  label?: string;
  options: SelectOption[];
}

export interface SelectProps {
  groups: SelectGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

const TRIGGER_SIZE = { sm: "h-8 px-3 text-ui", md: "h-9 px-3 text-ui", lg: "h-11 px-3 text-ui" };

export function Select({ groups, placeholder = "Select…", size = "md", className, id, "aria-label": ariaLabel, ...props }: SelectProps) {
  const fieldProps = useFieldProps({ id });
  if (process.env.NODE_ENV !== "production" && groups.reduce((n, g) => n + g.options.length, 0) > 12) {
    console.warn("Select: more than 12 options (§4.14) — use a Combobox.");
  }
  return (
    <RSel.Root {...props}>
      <RSel.Trigger
        id={fieldProps.id}
        aria-label={ariaLabel}
        aria-describedby={fieldProps["aria-describedby"]}
        aria-invalid={fieldProps["aria-invalid"]}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-md border bg-surface-raised text-start text-ink-900",
          "border-line transition-colors duration-instant hover:border-line-strong",
          "focus:border-berry-500 focus:outline-none focus:ring-[3px] focus:ring-berry-100",
          "aria-[invalid=true]:border-danger-500",
          "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:text-ink-300",
          "data-[placeholder]:text-ink-500",
          TRIGGER_SIZE[size],
          className,
        )}
      >
        <span className="truncate">
          <RSel.Value placeholder={placeholder} />
        </span>
        <RSel.Icon asChild>
          <ChevronDown
            className="size-3.5 shrink-0 text-ink-500 transition-transform duration-fast group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </RSel.Icon>
      </RSel.Trigger>
      <RSel.Portal>
        <RSel.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-dropdown max-h-80 min-w-[var(--radix-select-trigger-width)] max-w-[calc(var(--radix-select-trigger-width)*2)]",
            "overflow-hidden rounded-md border border-line bg-paper shadow-lift-2",
            "data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top",
          )}
        >
          <RSel.Viewport className="p-1">
            {groups.map((g, gi) => (
              <RSel.Group key={gi}>
                {gi > 0 && <RSel.Separator className="my-1 h-px bg-line-soft" />}
                {g.label && (
                  <RSel.Label className="px-2 py-1 text-overline uppercase text-ink-500">{g.label}</RSel.Label>
                )}
                {g.options.map((o) => (
                  <RSel.Item
                    key={o.value}
                    value={o.value}
                    disabled={o.disabled}
                    className={cn(
                      "flex h-8 cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 text-ui text-ink-800 outline-none",
                      "data-[highlighted]:bg-paper-3 data-[highlighted]:text-ink-900",
                      "data-[state=checked]:bg-berry-100 data-[state=checked]:text-berry-700",
                      "data-[disabled]:pointer-events-none data-[disabled]:text-ink-300",
                    )}
                  >
                    <RSel.ItemText>{o.label}</RSel.ItemText>
                    <RSel.ItemIndicator>
                      <Check className="size-3.5" aria-hidden />
                    </RSel.ItemIndicator>
                  </RSel.Item>
                ))}
              </RSel.Group>
            ))}
          </RSel.Viewport>
        </RSel.Content>
      </RSel.Portal>
    </RSel.Root>
  );
}
