import * as React from "react";
import { GripVertical, MoreHorizontal } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Checkbox } from "./checkbox";
import { Tag } from "./tag";
import { Avatar } from "./avatar";
import { IconButton } from "./icon-button";
import type { LabelColor } from "@/lib/labelColor";

// design-system.md §4.48 — the densest unit in Zenboard. Density is a LIST
// setting via data-density, not a per-row prop. Overdue turns the DATE red,
// never the whole row. Completed keeps its height.
export interface ListRowProps {
  title: string;
  icon?: React.ReactNode;
  tags?: { label: string; color: LabelColor }[];
  meta?: string;
  assignee?: string;
  due?: string;
  overdue?: boolean;
  completed?: boolean;
  selected?: boolean;
  checked?: boolean;
  onCheck?: (v: boolean) => void;
  onOpen?: () => void;
  onMenu?: () => void;
  className?: string;
}

export function ListRow({
  title,
  icon,
  tags = [],
  meta,
  assignee,
  due,
  overdue,
  completed,
  selected,
  checked,
  onCheck,
  onOpen,
  onMenu,
  className,
}: ListRowProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-2",
        "h-10 data-[density=compact]:h-8 [@media(pointer:coarse)]:h-11",
        "rounded-sm transition-colors duration-instant hover:bg-paper-3",
        selected && "bg-berry-100 hover:bg-berry-100",
        className,
      )}
    >
      <span aria-hidden className="-ms-1 cursor-grab text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <GripVertical className="size-3.5" />
      </span>
      {onCheck && (
        <Checkbox checked={completed ?? checked} onCheckedChange={(v) => onCheck(Boolean(v))} aria-label={`Complete ${title}`} />
      )}
      {icon && <span className="shrink-0 text-ink-500 [&_svg]:size-4">{icon}</span>}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "focus-ring min-w-0 flex-1 truncate rounded-xs text-start text-body",
          completed ? "text-ink-400 line-through" : "text-ink-800",
        )}
      >
        {title}
      </button>
      <span className="hidden shrink-0 gap-1 sm:flex">
        {tags.slice(0, 2).map((t) => (
          <Tag key={t.label} color={t.color} size="sm">
            {t.label}
          </Tag>
        ))}
      </span>
      {meta && <span className="hidden shrink-0 font-mono text-mono-sm text-ink-500 md:inline">{meta}</span>}
      {assignee && <Avatar name={assignee} size="sm" />}
      {due && (
        <span className={cn("shrink-0 font-mono text-mono-sm", overdue ? "font-medium text-danger-600" : "text-ink-500")}>
          {due}
        </span>
      )}
      <span className={cn("opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100")}>
        <IconButton label="More actions" icon={<MoreHorizontal className="size-4" />} size="sm" onClick={onMenu} />
      </span>
      {/* Separator inset to align with the title (§4.48) */}
      <span aria-hidden className="absolute inset-x-2 bottom-0 h-px bg-line-soft group-last:hidden" />
    </div>
  );
}

/** List container — owns density (§4.48) and the group divider behaviour. */
export function List({ density = "comfortable", className, children }: { density?: "comfortable" | "compact"; className?: string; children: React.ReactNode }) {
  return (
    <div data-density={density === "compact" ? "compact" : undefined} className={cn("flex flex-col [&>*]:data-[density=compact]:h-8", className)}>
      {children}
    </div>
  );
}
