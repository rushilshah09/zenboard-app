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
  /**
   * A control that belongs ON the bar — a view switcher for the panel
   * underneath (List / Board / Calendar). Beside the tabs when the bar has room,
   * on its own line below them when it does not.
   *
   * It lived OVER the bar, absolutely positioned at its right end, and at 375px
   * that switcher sat on top of Docs, Files and Money: measured, three of six
   * sections could not be tapped on a phone. As a sibling in the bar's own
   * flow it can never cover a tab at any width — between the stacking
   * threshold and the tabs' natural width the list scrolls under its fade
   * instead. The threshold is a CONTAINER width, not a viewport one, because
   * the same bar can sit beside a rail on a laptop.
   */
  end?: React.ReactNode;
}

export function Tabs({ items, value, onValueChange, activation = "automatic", className, children, end, ...aria }: TabsProps) {
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

  const list = (
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
                "disabled:pointer-events-none disabled:text-ink-500",
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
  );

  return (
    <RT.Root value={value} onValueChange={onValueChange} activationMode={activation} className={cn(end != null && "@container", className)}>
      {end != null ? (
        // 37.5rem is MEASURED, not estimated: six tabs 405px + the 12px gap +
        // a three-way switcher 185px = 602px. The first guess, 38rem (608px),
        // stacked the switcher on a 604px bar where it fit — re-adding the
        // very band Phase 1 removed. At 600–602px the list gives up ≤2px under
        // its fade, which nobody can see. Below it the switcher takes its own
        // line; above it the two share ONE hairline — moved from the list to
        // this row, so it runs under the switcher too and the sliding
        // underline still sits on it.
        <div className="flex flex-col @min-[37.5rem]:flex-row @min-[37.5rem]:items-end @min-[37.5rem]:border-b @min-[37.5rem]:border-line">
          <ScrollArea axis="x" fade hideScrollbar className="min-w-0 border-b border-line @min-[37.5rem]:flex-1 @min-[37.5rem]:border-b-0">
            {list}
          </ScrollArea>
          <div className="flex justify-end pt-3 @min-[37.5rem]:shrink-0 @min-[37.5rem]:pb-1.5 @min-[37.5rem]:ps-3 @min-[37.5rem]:pt-0">{end}</div>
        </div>
      ) : (
        <ScrollArea axis="x" fade hideScrollbar className="border-b border-line">
          {list}
        </ScrollArea>
      )}
      {children}
    </RT.Root>
  );
}

export const TabPanel = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof RT.Content>>(
  function TabPanel({ className, ...props }, ref) {
    return <RT.Content ref={ref} tabIndex={0} className={cn("focus-ring rounded-sm pt-4 outline-none", className)} {...props} />;
  },
);
