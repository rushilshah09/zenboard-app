import * as React from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Select } from "./select";

// design-system.md §4.31 — Zenboard prefers "Load more" over pagination, and
// pagination over infinite scroll (banned for primary data, §2.13).

export interface LoadMoreProps {
  /** How many the next click loads — say the number (§4.31). */
  batch: number;
  loaded: number;
  total: number;
  loading?: boolean;
  onLoadMore: () => void;
  /** Noun for the announcement, e.g. "tasks". */
  noun?: string;
  className?: string;
}

export function LoadMore({ batch, loaded, total, loading, onLoadMore, noun = "items", className }: LoadMoreProps) {
  const remaining = total - loaded;
  const done = remaining <= 0;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!done && (
        <Button variant="secondary" size="md" className="w-full" loading={loading} onClick={onLoadMore}>
          Load {Math.min(batch, remaining)} more
        </Button>
      )}
      <span role="status" aria-live="polite" className="text-center text-meta text-ink-500" data-numeric>
        {loaded} of {total} {noun}
      </span>
    </div>
  );
}

// ── Pagination — Money-grade, where "page 4 of 12" is meaningful ────────────
export interface PaginationProps {
  page: number; // 1-based
  pageCount: number;
  onPageChange: (p: number) => void;
  /** Rows-per-page select (25/50/100) — omit to hide. */
  pageSize?: number;
  onPageSizeChange?: (n: number) => void;
  /** Range readout, e.g. totalItems=1204 → "101–150 of 1,204". */
  totalItems?: number;
  className?: string;
}

function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>([1, count, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, pageCount, onPageChange, pageSize, onPageSizeChange, totalItems, className }: PaginationProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(), []);
  const rangeStart = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const rangeEnd = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : undefined;

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <nav aria-label="Pagination">
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="focus-ring grid h-8 min-w-8 place-items-center rounded-sm text-ink-600 hover:bg-paper-3 hover:text-ink-900 disabled:pointer-events-none disabled:text-ink-300"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </li>
          {pageList(page, pageCount).map((p, i) => (
            <li key={i}>
              {p === "…" ? (
                <span aria-hidden className="grid h-8 min-w-8 place-items-center text-ui text-ink-500">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    "focus-ring grid h-8 min-w-8 place-items-center rounded-sm px-1 text-ui transition-colors duration-instant",
                    p === page
                      ? "bg-paper-4 font-medium text-ink-900"
                      : "text-ink-600 hover:bg-paper-3 hover:text-ink-900",
                  )}
                  data-numeric
                >
                  {p}
                </button>
              )}
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
              className="focus-ring grid h-8 min-w-8 place-items-center rounded-sm text-ink-600 hover:bg-paper-3 hover:text-ink-900 disabled:pointer-events-none disabled:text-ink-300"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </li>
        </ul>
      </nav>

      {pageSize !== undefined && onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-meta text-ink-500">Rows per page</span>
          <Select
            aria-label="Rows per page"
            size="sm"
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            groups={[{ options: ["25", "50", "100"].map((v) => ({ value: v, label: v })) }]}
            className="w-20"
          />
        </div>
      )}

      {rangeStart !== undefined && rangeEnd !== undefined && totalItems !== undefined && (
        <span role="status" aria-live="polite" className="ms-auto text-meta text-ink-500" data-numeric>
          {nf.format(rangeStart)}–{nf.format(rangeEnd)} of {nf.format(totalItems)}
        </span>
      )}
    </div>
  );
}
