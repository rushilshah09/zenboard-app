import * as React from "react";
import * as RDlg from "@radix-ui/react-dialog";
import { Plus, Search } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";
import { rank } from "./combobox";

// design-system.md §4.33 — the keyboard spine of Zenboard. Not a search box:
// THE interface for daily users. Active row is paper-4, never berry (a berry
// flash on every arrow press is exhausting). Recents show before typing —
// that's where 40% of its use happens. Dead-end searches offer creation.

export type CommandMode = "actions" | "people" | "tags" | "sections" | null;
const MODE_PREFIX: Record<string, Exclude<CommandMode, null>> = {
  ">": "actions",
  "@": "people",
  "#": "tags",
  "/": "sections",
};
const MODE_LABEL: Record<Exclude<CommandMode, null>, string> = {
  actions: "Actions",
  people: "People",
  tags: "Tags",
  sections: "Sections",
};

export interface CommandItem {
  id: string;
  group: string; // "Actions" | "Recent" | "Tasks" | …
  title: string;
  context?: string; // "in Q3 Retainer"
  icon?: React.ReactNode;
  keys?: string[];
  mode?: Exclude<CommandMode, null>; // which prefix-mode this item belongs to
  onSelect: () => void;
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CommandItem[];
  /** Shown before any typing — the empty state IS the recents (§4.33). */
  recentIds?: string[];
  /** Create-fallbacks for dead-end searches: label builder + handler. */
  creators?: { label: (q: string) => string; onCreate: (q: string) => void }[];
}

/** Global ⌘K toggle. Returns [open, setOpen]. */
export function useCommandMenu(): [boolean, (o: boolean) => void] {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [open, setOpen];
}

export function CommandMenu({ open, onOpenChange, items, recentIds = [], creators = [] }: CommandMenuProps) {
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<CommandMode>(null);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setMode(null);
      setActive(0);
    }
  }, [open]);

  // Mode prefix becomes a chip inside the input (§4.33).
  const onQueryChange = (raw: string) => {
    if (!mode && raw.length === 1 && MODE_PREFIX[raw]) {
      setMode(MODE_PREFIX[raw]);
      setQuery("");
      return;
    }
    setQuery(raw);
  };

  type Row =
    | { kind: "item"; item: CommandItem; match: { start: number; len: number } }
    | { kind: "create"; label: string; onCreate: () => void };

  const { groups, flat } = React.useMemo(() => {
    const pool = mode ? items.filter((i) => i.mode === mode) : items;
    let scored: { item: CommandItem; score: number; match: { start: number; len: number } }[];
    if (!query.trim()) {
      const recent = recentIds
        .map((id) => pool.find((i) => i.id === id))
        .filter((i): i is CommandItem => Boolean(i))
        .map((item) => ({ item: { ...item, group: "Recent" }, score: 0, match: { start: 0, len: 0 } }));
      const actions = pool.filter((i) => i.group === "Actions").map((item) => ({ item, score: 1, match: { start: 0, len: 0 } }));
      scored = [...recent, ...actions];
    } else {
      scored = pool
        .map((item) => ({ item, m: rank(query, item.title) }))
        .filter((r): r is { item: CommandItem; m: NonNullable<ReturnType<typeof rank>> } => r.m !== null)
        .map(({ item, m }) => ({ item, score: m.score, match: { start: m.start, len: m.len } }));
    }
    // Dynamic group order: the group with the best match floats to the top (§4.33).
    const byGroup = new Map<string, typeof scored>();
    for (const r of scored) {
      const g = byGroup.get(r.item.group) ?? [];
      g.push(r);
      byGroup.set(r.item.group, g);
    }
    const ordered = [...byGroup.entries()].sort(
      (a, b) => Math.min(...a[1].map((r) => r.score)) - Math.min(...b[1].map((r) => r.score)),
    );
    const groups: { name: string; rows: Row[] }[] = ordered.map(([name, rs]) => ({
      name,
      rows: rs.sort((a, b) => a.score - b.score).map((r) => ({ kind: "item" as const, item: r.item, match: r.match })),
    }));
    if (query.trim() && scored.length === 0 && creators.length) {
      groups.push({
        name: "Create",
        rows: creators.slice(0, 3).map((c) => ({ kind: "create" as const, label: c.label(query.trim()), onCreate: () => c.onCreate(query.trim()) })),
      });
    }
    return { groups, flat: groups.flatMap((g) => g.rows) };
  }, [items, query, mode, recentIds, creators]);

  React.useEffect(() => setActive(0), [query, mode]);

  // Debounced polite count (§4.33).
  const [announce, setAnnounce] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setAnnounce(`${flat.length} result${flat.length === 1 ? "" : "s"}`), 500);
    return () => clearTimeout(t);
  }, [flat.length, open]);

  const run = (row: Row) => {
    onOpenChange(false);
    if (row.kind === "item") row.item.onSelect();
    else row.onCreate();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(flat.length, 1)); // wraps (§4.33)
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + Math.max(flat.length, 1)) % Math.max(flat.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) run(flat[active]);
    } else if (e.key === "Tab") {
      // Tab completes to the highlighted item's text — never moves focus (§4.33).
      e.preventDefault();
      const row = flat[active];
      if (row?.kind === "item") setQuery(row.item.title);
    } else if (e.key === "Backspace" && query === "" && mode) {
      setMode(null);
    }
  };

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let rowIndex = -1;

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange}>
      <RDlg.Portal>
        <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-fadein" />
        <RDlg.Content
          aria-label="Command menu"
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[20vh] z-modal flex max-h-[440px] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden",
            "rounded-lg border border-line bg-paper shadow-lift-3",
            "data-[state=open]:animate-rise data-[state=closed]:animate-exit",
          )}
        >
          <RDlg.Title className="sr-only">Command menu</RDlg.Title>
          {/* Input row */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line-soft px-4">
            <Search className="size-4 shrink-0 text-ink-400" aria-hidden />
            {mode && (
              <span className="flex h-6 shrink-0 items-center rounded-xs bg-paper-4 px-1.5 text-ui font-medium text-ink-800">
                {MODE_LABEL[mode]}
              </span>
            )}
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode ? `Search ${MODE_LABEL[mode].toLowerCase()}…` : "Search or jump to…"}
              className="h-full min-w-0 flex-1 bg-transparent text-lead text-ink-900 outline-none placeholder:text-ink-500"
            />
            <Kbd keys={["esc"]} />
          </div>

          <span className="sr-only" role="status" aria-live="polite">
            {open ? announce : ""}
          </span>

          {/* Results */}
          <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2 [overscroll-behavior:contain]">
            {flat.length === 0 && (
              <p className="py-8 text-center text-body text-ink-500">No results for “{query}”</p>
            )}
            {groups.map((g) => (
              <div key={g.name} role="group" aria-label={g.name}>
                <div className="px-2 pb-1 pt-2 text-overline uppercase text-ink-500">{g.name}</div>
                {g.rows.map((row) => {
                  rowIndex++;
                  const i = rowIndex;
                  const isActive = i === active;
                  return (
                    <div
                      key={row.kind === "item" ? row.item.id : `create-${i}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(row)}
                      className={cn(
                        "flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2",
                        isActive && "bg-paper-4",
                      )}
                    >
                      {row.kind === "item" ? (
                        <>
                          <span className={cn("shrink-0 [&_svg]:size-4", isActive ? "text-ink-700" : "text-ink-500")} aria-hidden>
                            {row.item.icon}
                          </span>
                          <span className={cn("min-w-0 flex-1 truncate text-body", isActive ? "text-ink-900" : "text-ink-600")}>
                            {row.match.len > 0 && row.match.start >= 0 ? (
                              <>
                                {row.item.title.slice(0, row.match.start)}
                                <span className="font-medium text-ink-900">
                                  {row.item.title.slice(row.match.start, row.match.start + row.match.len)}
                                </span>
                                {row.item.title.slice(row.match.start + row.match.len)}
                              </>
                            ) : (
                              row.item.title
                            )}
                          </span>
                          {row.item.context && <span className="shrink-0 text-meta text-ink-500">{row.item.context}</span>}
                          {row.item.keys && <Kbd keys={row.item.keys} />}
                        </>
                      ) : (
                        <>
                          <Plus className="size-4 shrink-0 text-berry-600" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-body text-berry-600">{row.label}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer legend */}
          <div className="flex h-9 shrink-0 items-center gap-4 border-t border-line-soft bg-paper-2 px-4 text-meta text-ink-500">
            <span className="flex items-center gap-1"><Kbd keys={["↑"]} /><Kbd keys={["↓"]} /> navigate</span>
            <span className="flex items-center gap-1"><Kbd keys={["enter"]} /> open</span>
            <span className="flex items-center gap-1"><Kbd keys={["esc"]} /> close</span>
          </div>
        </RDlg.Content>
      </RDlg.Portal>
    </RDlg.Root>
  );
}
