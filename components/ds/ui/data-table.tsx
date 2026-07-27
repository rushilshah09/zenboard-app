import * as React from "react";
import { ChevronDown, ChevronUp } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";

// design-system.md §4.49 — real <table>, sticky paper-2 header, sentence-case
// headers, NO zebra striping. Numeric cells right-aligned mono tabular. Empty
// state renders INSIDE the body with the header still visible.
export interface Column<T> {
  key: string;
  header: string;
  numeric?: boolean;
  width?: string;
  cell: (row: T) => React.ReactNode;
  /** Sort accessor; omit = not sortable. */
  sortBy?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  caption: string; // visually hidden, for SRs
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowOpen?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  selectable,
  selected = new Set(),
  onSelectedChange,
  loading,
  empty,
  onRowOpen,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortBy!(a), bv = col.sortBy!(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));
  const someChecked = rows.some((r) => selected.has(rowKey(r)));

  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allChecked ? new Set() : new Set(rows.map(rowKey)));
  };
  const toggleOne = (id: string) => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  return (
    <div className={cn("overflow-x-auto rounded-md border border-line", className)}>
      <table className="w-full border-collapse" aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="sticky top-0 z-sticky border-b border-line bg-paper-2">
            {selectable && (
              <th scope="col" className="h-9 w-10 px-3">
                <Checkbox
                  aria-label="Select all rows"
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                  style={{ width: c.width }}
                  className={cn("h-9 px-3 text-caption font-semibold text-ink-600", c.numeric ? "text-end" : "text-start")}
                >
                  {c.sortBy ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                      className={cn("focus-ring group inline-flex items-center gap-1 rounded-xs", c.numeric && "flex-row-reverse")}
                    >
                      {c.header}
                      <span className={cn("text-ink-400 opacity-0 group-hover:opacity-100", active && "text-ink-800 opacity-100")} aria-hidden>
                        {active && sort!.dir === -1 ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b border-line-soft">
                  {selectable && <td className="h-10 px-3"><Skeleton shape="line" className="size-4" /></td>}
                  {columns.map((c) => (
                    <td key={c.key} className="h-10 px-3">
                      <Skeleton shape="line" className={c.numeric ? "ms-auto w-14" : "w-3/4"} />
                    </td>
                  ))}
                </tr>
              ))
            : sorted.map((row) => {
                const id = rowKey(row);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowOpen?.(row)}
                    className={cn(
                      "border-b border-line-soft transition-colors duration-instant last:border-b-0",
                      onRowOpen && "cursor-pointer",
                      isSel ? "bg-berry-100" : "hover:bg-paper-3",
                    )}
                  >
                    {selectable && (
                      <td className="h-10 px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label="Select row" checked={isSel} onCheckedChange={() => toggleOne(id)} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn("h-10 px-3 text-ui text-ink-800", c.numeric && "text-end font-mono")}
                        data-numeric={c.numeric || undefined}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
