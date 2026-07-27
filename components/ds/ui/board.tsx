import * as React from "react";
import { MoreHorizontal, Plus } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Card } from "./card";
import { IconButton } from "./icon-button";

// design-system.md §4.50 — Kanban. Columns are paper-2 wells with their own
// scroll; a WIP limit informs (warning tint), never blocks. The dashed
// "+ New task" inline-add is how you add ten tasks in twenty seconds.
export interface BoardCardData {
  id: string;
  title: string;
  meta?: React.ReactNode;
}

export interface BoardColumnData {
  id: string;
  name: string;
  dotClass: string; // e.g. "bg-info-500"
  cards: BoardCardData[];
  wipLimit?: number;
}

export interface BoardProps {
  columns: BoardColumnData[];
  onAdd?: (columnId: string, title: string) => void;
  onOpen?: (cardId: string) => void;
  className?: string;
}

function InlineAdd({ onCommit }: { onCommit: (title: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong text-ui text-ink-600 transition-colors duration-instant hover:border-ink-300 hover:text-ink-800"
      >
        <Plus className="size-3.5" aria-hidden /> New task
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={title}
      placeholder="Task title"
      aria-label="New task title"
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        setEditing(false);
        setTitle("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && title.trim()) {
          onCommit(title.trim());
          setTitle(""); // Enter commits and opens another (§4.50)
        }
        if (e.key === "Escape") {
          setEditing(false);
          setTitle("");
        }
      }}
      className="h-9 w-full rounded-md border border-berry-500 bg-paper px-3 text-ui text-ink-900 outline-none ring-2 ring-berry-alpha-20"
    />
  );
}

export function Board({ columns, onAdd, onOpen, className }: BoardProps) {
  return (
    <div className={cn("flex gap-3 overflow-x-auto pb-2", className)}>
      {columns.map((col) => {
        const over = col.wipLimit !== undefined && col.cards.length > col.wipLimit;
        return (
          <section key={col.id} aria-label={col.name} className="flex w-[300px] shrink-0 flex-col rounded-lg bg-paper-2 p-2">
            <header className={cn("sticky top-0 flex h-9 items-center gap-2 rounded-sm px-1", over && "bg-warning-100")}>
              <span aria-hidden className={cn("size-2 rounded-full", col.dotClass)} />
              <span className="text-body font-medium text-ink-900">{col.name}</span>
              <span className={cn("text-ui", over ? "font-medium text-warning-600" : "text-ink-500")} data-numeric>
                {col.cards.length}
                {col.wipLimit !== undefined && `/${col.wipLimit}`}
              </span>
              <span className="flex-1" />
              <IconButton label={`${col.name} options`} icon={<MoreHorizontal className="size-3.5" />} size="xs" />
            </header>
            <div className="flex min-h-24 flex-col gap-2 overflow-y-auto p-1 [overscroll-behavior:contain]">
              {col.cards.length === 0 && (
                <div className="grid h-24 place-items-center rounded-md border border-dashed border-line-strong text-ui text-ink-600">
                  Drop tasks here
                </div>
              )}
              {col.cards.map((c) => (
                <Card
                  key={c.id}
                  on="paper-2"
                  interactive
                  className="gap-2 p-3"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen?.(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen?.(c.id)}
                >
                  <p className="text-body text-ink-800">{c.title}</p>
                  {c.meta && <div className="flex items-center gap-2 text-meta text-ink-500">{c.meta}</div>}
                </Card>
              ))}
              {onAdd && <InlineAdd onCommit={(t) => onAdd(col.id, t)} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
