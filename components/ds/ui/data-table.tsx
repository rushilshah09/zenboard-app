"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Checkbox } from "./checkbox";
import { Skeleton } from "./skeleton";
import { cardClass } from "./card";
import { rowState } from "./row-state";

// ── THE TABLE ──────────────────────────────────────────────────────────────
//
// design-system.md §4.49 — a real <table>, sentence-case headers, NO zebra striping, the empty
// state INSIDE the body with the header still visible.
//
// ── WHY NOTHING USED IT, AND WHAT CHANGED (2026-09-24) ─────────────────────
// Measured: zero modules imported this, and `--row-table` (44px) — the row token it exists to
// serve — was used zero times. Every tabular screen built its own instead; Finance built two.
// It was not neglect. This table was worse than the hand-rolled ones it should have replaced:
//
//   · a row OPENED on `<tr onClick>` — no keyboard path, no cmd-click, no prefetch. Finance's
//     own rows were real `<Link>`s and had all three; adopting this would have taken them away;
//   · numbers were set in MONO, which the house rules keep for IDs (`INV-001`) alone;
//   · rows were 40px against its own 44px token, selected rows were `bg-berry-100` where every
//     other row in the app uses `bg-surface-selected`, and the frame was hand-spelled instead of
//     the one card recipe.
//
// So a module that adopted the DS table would have LOST quality — which is exactly why none did,
// and why the product grew a table per module. The fix is to make this the best table in the
// app, then move the others onto it.
//
// ── A ROW IS A LINK ────────────────────────────────────────────────────────
// With `rowHref`, the primary cell holds a real Next `<Link>` whose `::after` is stretched over
// the whole row: the entire row is the hit area, AND it is a link — Tab reaches it, Enter opens
// it, cmd-click opens a new tab, hovering prefetches. That is how a Linear row behaves. Any other
// interactive cell (the selection checkbox) is lifted above the stretch; the lift is LOCAL to the
// row (`isolate`), so it is a stacking order inside one row, not a layer in the z registry.

export interface Column<T> {
  key: string;
  header: string;
  /** A quantity: right-aligned with tabular figures, in the UI face (never mono). */
  numeric?: boolean;
  /** An identifier (`INV-001`) — the one kind of text the house sets in mono. */
  mono?: boolean;
  width?: string;
  cell: (row: T) => React.ReactNode;
  /** Sort accessor; omit = not sortable. */
  sortBy?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  /** Visually hidden, for screen readers. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rows that NAVIGATE become real links (keyboard, cmd-click, prefetch). Return null to opt a row out. */
  rowHref?: (row: T) => string | null;
  /** Rows that open something IN PLACE (a panel). Keyboard-reachable: Enter or Space. */
  onRowOpen?: (row: T) => void;
  /** An optimistic row that is not saved yet: dimmed, and not openable until it is. */
  isPending?: (row: T) => boolean;
  /** Below this width the table scrolls sideways rather than crushing its columns on a phone. */
  minWidth?: string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  /**
   * The table INSIDE a document — an invoice's line items — rather than a table that is its own
   * object. No card (a card on a sheet is a fill on a fill), no sticky head, and the first and last
   * columns sit on the document's own edges instead of 16px in from a card that is not there.
   */
  flush?: boolean;
  className?: string;
}

const EMPTY: Set<string> = new Set();

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  onRowOpen,
  isPending,
  minWidth,
  selectable,
  selected = EMPTY,
  onSelectedChange,
  loading,
  empty,
  flush = false,
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

  // A document's columns end ON its margins; a card's start 16px inside its edge.
  const pad = flush ? "px-3 first:ps-0 last:pe-0" : "px-4";
  const cellClass = (c: Column<T>) =>
    cn(
      pad,
      "text-ui",
      c.numeric ? "text-end tabular-nums" : "text-start",
      c.mono && "font-mono text-caption text-ink-500",
    );

  return (
    <div className={flush ? cn("min-w-0", className) : cardClass(cn("overflow-hidden", className))}>
      <div className="overflow-x-auto overflow-y-hidden">
        {/* `border-collapse` is deliberately NOT spelled: the browser default is already
            `collapse`, and a utility here is a decision a skin could never revise. */}
        <table className="w-full" style={minWidth ? { minWidth } : undefined} aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className={flush ? "border-b border-line" : cn("sticky top-0 z-sticky bg-surface-raised", "border-b border-line-soft")}>
              {selectable && (
                <th scope="col" className="h-9 w-10 px-4">
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
                    // Column heads are LABELS, so they take the label role the whole app uses.
                    className={cn("h-9 text-overline font-normal text-ink-500", pad, c.numeric ? "text-end" : "text-start")}
                  >
                    {c.sortBy ? (
                      <button
                        type="button"
                        onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                        className={cn("focus-ring group inline-flex items-center gap-1 rounded-xs", c.numeric && "flex-row-reverse")}
                      >
                        {c.header}
                        {/* Not `reveal-on-hover`: the `active` branch overrides opacity, and an
                            explicit class keeps that unambiguous. On touch it is simply visible. */}
                        <span className={cn("text-ink-500 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100", active && "text-ink-800 opacity-100")} aria-hidden>
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
                  <tr key={i} className="h-[var(--row-table)] border-b border-line-soft last:border-b-0">
                    {selectable && <td className="px-4"><Skeleton shape="line" className="size-4" /></td>}
                    {columns.map((c) => (
                      <td key={c.key} className="px-4">
                        <Skeleton shape="line" className={c.numeric ? "ms-auto w-14" : "w-3/4"} />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((row, index) => {
                  const id = rowKey(row);
                  const isSel = selected.has(id);
                  const pending = isPending?.(row) ?? false;
                  const href = pending ? null : rowHref?.(row) ?? null;
                  const opens = !pending && !href && !!onRowOpen;
                  const last = index === sorted.length - 1;
                  return (
                    <tr
                      key={id}
                      // `isolate` makes the stretched link's stacking LOCAL to this row.
                      className={cn(
                        "relative isolate h-[var(--row-table)]",
                        rowState({ selected: isSel, last, interactive: !!(href || opens || selectable) }),
                        (href || opens) && "cursor-pointer",
                        // Keyboard focus lands on the row's link; the ROW shows it, the way it shows a
                        // hover — so a keyboard user sees a focused row, not a ring round one word.
                        href && "has-[a:focus-visible]:bg-surface-hover",
                        // An unsaved row is shown, but visibly not yet real.
                        pending && "opacity-60",
                        opens && "focus-ring",
                      )}
                      // A row that opens in place is a control, so the keyboard can reach it too.
                      tabIndex={opens ? 0 : undefined}
                      onClick={opens ? () => onRowOpen!(row) : undefined}
                      onKeyDown={
                        opens
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onRowOpen!(row);
                              }
                            }
                          : undefined
                      }
                    >
                      {selectable && (
                        // Lifted above the stretched link, so ticking a row never opens it.
                        <td className="relative z-[1] px-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox aria-label="Select row" checked={isSel} onCheckedChange={() => toggleOne(id)} />
                        </td>
                      )}
                      {columns.map((c, ci) => (
                        <td key={c.key} className={cellClass(c)} data-numeric={c.numeric || undefined}>
                          {href && ci === 0 ? (
                            <Link
                              href={href}
                              // The whole row is the target; the link is what makes it a link.
                              className="focus-ring rounded-xs after:absolute after:inset-0 after:content-['']"
                            >
                              {c.cell(row)}
                            </Link>
                          ) : (
                            c.cell(row)
                          )}
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
    </div>
  );
}
