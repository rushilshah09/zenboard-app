import * as React from "react";
import * as RT from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import type { IconType } from "@/components/ds/icons";
import { ScrollArea } from "./scroll-area";

// design-system.md §4.30 — views of the same object, not page navigation. The
// 2px berry underline hugs the LABEL's width (not the padded width) and slides
// between tabs. Tab state lives in the URL — the consumer owns value/onChange.

export interface TabItem {
  value: string;
  label: string;
  /** Optional leading glyph (e.g. list/board/calendar view switchers). */
  icon?: IconType;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (v: string) => void;
  /** manual = activate on Enter/Space (expensive panels); auto = on focus (§4.30). */
  activation?: "automatic" | "manual";
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Tabs({ items, value, onValueChange, activation = "automatic", className, children, ...aria }: TabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [bar, setBar] = React.useState<{ x: number; w: number } | null>(null);

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const label = list.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"] [data-label]`);
    if (!label) return setBar(null);
    const listRect = list.getBoundingClientRect();
    const rect = label.getBoundingClientRect();
    setBar({ x: rect.left - listRect.left + list.scrollLeft, w: rect.width });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <RT.Root value={value} onValueChange={onValueChange} activationMode={activation} className={className}>
      <ScrollArea axis="x" fade hideScrollbar className="border-b border-line">
        <RT.List ref={listRef} aria-label={aria["aria-label"]} className="relative flex w-max min-w-full gap-1">
          {items.map((t) => (
            <RT.Trigger
              key={t.value}
              value={t.value}
              disabled={t.disabled}
              data-value={t.value}
              className={cn(
                // Inactive tab labels bumped ink-600→ink-700 (hover→ink-900) to
                // match the SegmentedControl contrast pass — one legible system.
                "focus-ring group flex h-9 items-center gap-2 rounded-t-md px-3 text-ui font-medium text-ink-700 transition-colors duration-instant",
                "hover:bg-surface-hover hover:text-ink-900",
                "data-[state=active]:text-ink-900",
                "disabled:pointer-events-none disabled:text-ink-300",
              )}
            >
              {t.icon && <Icon icon={t.icon} size={14} className="shrink-0" />}
              <span data-label>{t.label}</span>
              {t.count !== undefined && (
                <span className="rounded-xs bg-paper-4 px-1 text-caption text-ink-700 group-data-[state=active]:text-ink-900" data-numeric>
                  {t.count}
                </span>
              )}
            </RT.Trigger>
          ))}
          {/* The sliding underline — flush to the strip's bottom edge, sitting on
              the container's border-b (§4.30). bottom-0 (not -1px) so it is never
              clipped now that the cross-axis is `overflow-y: hidden`. */}
          {bar && (
            <span
              aria-hidden
              className="absolute bottom-0 h-0.5 rounded-full bg-berry-500 transition-[transform,width] duration-base ease-out-quiet motion-reduce:transition-none"
              style={{ width: bar.w, transform: `translateX(${bar.x}px)` }}
            />
          )}
        </RT.List>
      </ScrollArea>
      {children}
    </RT.Root>
  );
}

export const TabPanel = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof RT.Content>>(
  function TabPanel({ className, ...props }, ref) {
    return <RT.Content ref={ref} tabIndex={0} className={cn("focus-ring rounded-sm pt-4 outline-none", className)} {...props} />;
  },
);
