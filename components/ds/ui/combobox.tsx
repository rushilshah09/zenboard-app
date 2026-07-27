import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useFieldProps } from "./field";
import { Tag } from "./tag";
import type { LabelColor } from "@/lib/labelColor";

// design-system.md §4.15 — Select + search; the workhorse for assignees,
// projects, clients, tags. The trigger IS the input; the list opens on focus.
// Filtering is ranked: prefix > word-start > substring > fuzzy; matches are
// BOLDED, not colour-highlighted. "Create 'foo'" is always the last row.

export interface ComboOption {
  value: string;
  label: string;
  color?: LabelColor;
  disabled?: boolean;
}

// Ranked match (§4.15). Returns rank (lower = better) + matched span, or null.
// Shared with the command menu (§4.33) — same prefix > word > substring > fuzzy.
export function rank(query: string, label: string): { score: number; start: number; len: number } | null {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (!q) return { score: 4, start: 0, len: 0 };
  const idx = l.indexOf(q);
  if (idx === 0) return { score: 0, start: 0, len: q.length };
  if (idx > 0 && /\s/.test(l[idx - 1])) return { score: 1, start: idx, len: q.length };
  if (idx > 0) return { score: 2, start: idx, len: q.length };
  // fuzzy: all chars in order
  let li = 0;
  for (const ch of q) {
    li = l.indexOf(ch, li);
    if (li === -1) return null;
    li++;
  }
  return { score: 3, start: -1, len: 0 };
}

function Highlight({ label, start, len }: { label: string; start: number; len: number }) {
  if (start < 0 || len === 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, start)}
      <span className="font-medium text-ink-900">{label.slice(start, start + len)}</span>
      {label.slice(start + len)}
    </>
  );
}

interface ComboboxBaseProps {
  options: ComboOption[];
  placeholder?: string;
  /** Allow "Create 'x'" when no exact match (§4.15). */
  onCreate?: (label: string) => void;
  /** Async options are loading — show three skeleton rows, never a spinner. */
  loading?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

export interface ComboboxProps extends ComboboxBaseProps {
  multiple?: false;
  value: string | null;
  onValueChange: (v: string | null) => void;
}
export interface MultiComboboxProps extends ComboboxBaseProps {
  multiple: true;
  value: string[];
  onValueChange: (v: string[]) => void;
}

export function Combobox(props: ComboboxProps | MultiComboboxProps) {
  const { options, placeholder = "Search…", onCreate, loading, disabled, className } = props;
  const fieldProps = useFieldProps({ id: props.id });
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];

  const results = React.useMemo(() => {
    const ranked = options
      .map((o) => ({ o, m: rank(query, o.label) }))
      .filter((r): r is { o: ComboOption; m: NonNullable<ReturnType<typeof rank>> } => r.m !== null)
      .sort((a, b) => a.m.score - b.m.score || a.o.label.localeCompare(b.o.label));
    return ranked;
  }, [options, query]);

  const exact = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());
  const canCreate = Boolean(onCreate && query.trim() && !exact);
  const rowCount = results.length + (canCreate ? 1 : 0);

  // Debounced polite count announcement (§4.15 — never per keystroke).
  const [announce, setAnnounce] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setAnnounce(`${results.length} result${results.length === 1 ? "" : "s"}`), 500);
    return () => clearTimeout(t);
  }, [results.length, open]);

  React.useEffect(() => setActive(0), [query, open]);

  const commit = (opt: ComboOption) => {
    if (props.multiple) {
      const has = props.value.includes(opt.value);
      props.onValueChange(has ? props.value.filter((v) => v !== opt.value) : [...props.value, opt.value]);
      setQuery("");
      inputRef.current?.focus();
    } else {
      props.onValueChange(opt.value);
      setQuery("");
      setOpen(false);
    }
  };

  const doCreate = () => {
    onCreate?.(query.trim());
    setQuery("");
    if (!props.multiple) setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < results.length) commit(results[active].o);
      else if (canCreate) doCreate();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && props.multiple && query === "" && props.value.length > 0) {
      props.onValueChange(props.value.slice(0, -1));
    }
  };

  const single = !props.multiple ? options.find((o) => o.value === props.value) : undefined;

  return (
    <RP.Root open={open} onOpenChange={setOpen}>
      <RP.Anchor asChild>
        <div
          className={cn(
            "flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-sm border bg-paper px-1.5 py-1",
            "border-line-strong transition-colors duration-instant hover:border-ink-300",
            "focus-within:border-berry-500 focus-within:ring-2 focus-within:ring-berry-alpha-20",
            props.multiple && "max-h-24 overflow-y-auto",
            disabled && "pointer-events-none border-transparent bg-surface-disabled",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {props.multiple &&
            props.value.map((v) => {
              const o = options.find((x) => x.value === v);
              if (!o) return null;
              return (
                <Tag key={v} color={o.color ?? "stone"} size="sm" onRemove={() => commit(o)} removeLabel={`Remove ${o.label}`}>
                  {o.label}
                </Tag>
              );
            })}
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && rowCount > 0 ? `${listId}-${active}` : undefined}
            aria-label={props["aria-label"]}
            id={fieldProps.id}
            aria-describedby={fieldProps["aria-describedby"]}
            aria-invalid={fieldProps["aria-invalid"]}
            disabled={disabled}
            value={query}
            placeholder={props.multiple ? (props.value.length ? "" : placeholder) : (single?.label ?? placeholder)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              "h-6 min-w-16 flex-1 bg-transparent text-body text-ink-900 outline-none",
              single && !query ? "placeholder:text-ink-900" : "placeholder:text-ink-500",
            )}
          />
          <ChevronDown
            className={cn("me-1 size-3.5 shrink-0 text-ink-500 transition-transform duration-fast", open && "rotate-180")}
            aria-hidden
          />
        </div>
      </RP.Anchor>
      <span className="sr-only" role="status" aria-live="polite">
        {open ? announce : ""}
      </span>
      <RP.Portal>
        <RP.Content
          asChild
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => setOpen(false)}
        >
          <div
            id={listId}
            role="listbox"
            aria-multiselectable={props.multiple || undefined}
            className={cn(
              "z-dropdown max-h-80 w-[var(--radix-popover-trigger-width,16rem)] min-w-56 overflow-y-auto rounded-md border border-line bg-paper p-1 shadow-lift-2",
              "data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top",
            )}
          >
            {loading ? (
              <div className="flex flex-col gap-1 p-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded-sm bg-paper-5" />
                ))}
              </div>
            ) : (
              <>
                {results.length === 0 && !canCreate && (
                  <p className="py-6 text-center text-body text-ink-500">
                    {query ? `No matches for “${query}”` : "No options"}
                  </p>
                )}
                {results.map(({ o, m }, i) => {
                  const isSel = selected.includes(o.value);
                  return (
                    <div
                      key={o.value}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isSel}
                      data-active={i === active || undefined}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => !o.disabled && commit(o)}
                      className={cn(
                        "flex h-8 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 text-ui text-ink-800",
                        "data-[active]:bg-paper-3 data-[active]:text-ink-900",
                        isSel && "bg-berry-100 text-berry-700 data-[active]:bg-berry-100",
                        o.disabled && "pointer-events-none text-ink-300",
                      )}
                    >
                      <span className="truncate">
                        <Highlight label={o.label} start={m.start} len={m.len} />
                      </span>
                      {isSel && <Check className="size-3.5 shrink-0" aria-hidden />}
                    </div>
                  );
                })}
                {canCreate && (
                  <div
                    id={`${listId}-${results.length}`}
                    role="option"
                    aria-selected={false}
                    data-active={active === results.length || undefined}
                    onMouseEnter={() => setActive(results.length)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={doCreate}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-ui text-berry-600 data-[active]:bg-paper-3"
                  >
                    <Plus className="size-3.5 shrink-0" aria-hidden />
                    Create “{query.trim()}”
                  </div>
                )}
              </>
            )}
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
