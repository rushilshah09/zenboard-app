import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { ListFilter, Search, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";

// design-system.md §4.26 — the bar above every list. Chips ARE the state; each
// segment is editable in place. "+ Filter" is a 3-step wizard in ONE popover
// that pushes forward — never three nested menus. Filters persist in the URL.

export interface FilterProperty {
  id: string;
  label: string;
  operators: string[];
  values: { value: string; label: string }[];
}

export interface ActiveFilter {
  property: string;
  operator: string;
  value: string;
}

/** URL persistence (§4.26 — non-negotiable): `?f=prop.op.value&f=…`. */
export function serializeFilters(filters: ActiveFilter[]): string[] {
  return filters.map((f) => [f.property, f.operator, f.value].map(encodeURIComponent).join("."));
}
export function parseFilters(params: string[]): ActiveFilter[] {
  return params
    .map((p) => p.split(".").map(decodeURIComponent))
    .filter((p) => p.length === 3)
    .map(([property, operator, value]) => ({ property, operator, value }));
}

function WizardList({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { value: string; label: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex w-56 flex-col p-1">
      <span className="px-2 py-1 text-overline uppercase text-ink-500">{title}</span>
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onPick(i.value)}
          className="focus-ring flex h-8 items-center rounded-sm px-2 text-start text-ui text-ink-800 hover:bg-paper-3 hover:text-ink-900"
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// The 3-step wizard: property → operator → value, sliding forward (dur-base).
function FilterWizard({
  properties,
  initial,
  onDone,
  onOpenChange,
  open,
  anchorOnly,
  children,
}: {
  properties: FilterProperty[];
  initial?: Partial<ActiveFilter>;
  onDone: (f: ActiveFilter) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Chip wrappers aren't buttons — anchor to them instead of making them a
      Trigger (which would stamp button ARIA onto a span). */
  anchorOnly?: boolean;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = React.useState<Partial<ActiveFilter>>(initial ?? {});
  React.useEffect(() => {
    if (open) setDraft(initial ?? {});
  }, [open, initial]);

  const step = draft.property === undefined ? 0 : draft.operator === undefined ? 1 : 2;
  const prop = properties.find((p) => p.id === draft.property);

  return (
    <RP.Root open={open} onOpenChange={onOpenChange}>
      {anchorOnly ? <RP.Anchor asChild>{children}</RP.Anchor> : <RP.Trigger asChild>{children}</RP.Trigger>}
      <RP.Portal>
        <RP.Content
          align="start"
          sideOffset={4}
          className={cn(
            "z-dropdown overflow-hidden rounded-md border border-line bg-paper shadow-lift-2",
            "data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top-left",
          )}
        >
          <div
            className="flex transition-transform duration-base ease-out-quiet motion-reduce:transition-none"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            <div className="w-full shrink-0">
              <WizardList
                title="Filter by"
                items={properties.map((p) => ({ value: p.id, label: p.label }))}
                onPick={(v) => setDraft({ property: v })}
              />
            </div>
            <div className="w-full shrink-0">
              {prop && (
                <WizardList
                  title={prop.label}
                  items={prop.operators.map((o) => ({ value: o, label: o }))}
                  onPick={(v) => setDraft((d) => ({ ...d, operator: v }))}
                />
              )}
            </div>
            <div className="w-full shrink-0">
              {prop && (
                <WizardList
                  title={`${prop.label} ${draft.operator ?? ""}`}
                  items={prop.values}
                  onPick={(v) => {
                    onDone({ property: prop.id, operator: draft.operator!, value: v });
                    onOpenChange(false);
                  }}
                />
              )}
            </div>
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}

export interface FilterBarProps {
  properties: FilterProperty[];
  filters: ActiveFilter[];
  onFiltersChange: (f: ActiveFilter[]) => void;
  search: string;
  onSearchChange: (s: string) => void;
  /** Result count, announced politely on change ("12 tasks"). */
  resultLabel?: string;
  className?: string;
}

export function FilterBar({ properties, filters, onFiltersChange, search, onSearchChange, resultLabel, className }: FilterBarProps) {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);

  const label = (f: ActiveFilter) => {
    const p = properties.find((x) => x.id === f.property);
    return {
      prop: p?.label ?? f.property,
      value: p?.values.find((v) => v.value === f.value)?.label ?? f.value,
    };
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-3.5 text-ink-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          aria-label="Search"
          className={cn(
            "h-7 w-44 rounded-sm border border-transparent bg-paper-3 ps-8 pe-2 text-ui text-ink-900",
            "placeholder:text-ink-500 transition-colors duration-instant hover:bg-paper-4",
            "focus:border-berry-500 focus:bg-paper focus:outline-none focus:ring-2 focus:ring-berry-alpha-20",
          )}
        />
      </div>

      {/* + Filter */}
      <FilterWizard
        properties={properties}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onDone={(f) => onFiltersChange([...filters, f])}
      >
        <Button variant="ghost" size="sm" icon={<ListFilter className="size-3.5" />}>
          Filter
        </Button>
      </FilterWizard>

      {/* Active chips — each segment edits in place */}
      {filters.map((f, i) => {
        const l = label(f);
        return (
          <FilterWizard
            key={`${f.property}-${i}`}
            properties={properties}
            anchorOnly
            open={editing === i}
            onOpenChange={(o) => setEditing(o ? i : null)}
            initial={{ property: f.property, operator: f.operator }}
            onDone={(nf) => onFiltersChange(filters.map((x, xi) => (xi === i ? nf : x)))}
          >
            <span
              className={cn(
                "inline-flex h-7 items-center overflow-hidden rounded-sm border text-ui",
                "border-berry-300 bg-berry-050 text-ink-800",
              )}
            >
              <button
                type="button"
                onClick={() => setEditing(i)}
                className="focus-ring flex h-full items-center gap-1 ps-2 pe-1 hover:bg-berry-100"
              >
                <span className="text-ink-600">{l.prop}</span>
                <span className="text-ink-500">{f.operator}</span>
                <span className="font-medium text-ink-900">{l.value}</span>
              </button>
              <button
                type="button"
                aria-label={`Remove filter ${l.prop} ${f.operator} ${l.value}`}
                onClick={() => onFiltersChange(filters.filter((_, xi) => xi !== i))}
                className="focus-ring grid h-full w-6 place-items-center border-s border-berry-300/50 text-ink-500 hover:bg-berry-100 hover:text-ink-800"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          </FilterWizard>
        );
      })}

      {/* Clear all — only when ≥1 filter (§4.26) */}
      {filters.length > 0 && (
        <Button variant="quiet" size="sm" onClick={() => onFiltersChange([])}>
          Clear all
        </Button>
      )}

      <span role="status" aria-live="polite" className="ms-auto text-meta text-ink-500">
        {resultLabel}
      </span>
    </div>
  );
}
