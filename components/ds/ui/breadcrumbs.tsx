import { Ellipsis } from "@/lib/icons";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";

// design-system.md §4.29 — `Projects / Q3 Retainer / Kickoff notes`. Zenboard
// uses "/" (quieter; matches the path metaphor). >4 levels → Root / … / Parent /
// Current, with … opening a menu of the hidden middle. Never truncate the
// current page or its direct parent.

export interface Crumb {
  label: string;
  href?: string;
  onNavigate?: () => void;
}

function CrumbLink({ crumb, className }: { crumb: Crumb; className?: string }) {
  return (
    <a
      href={crumb.href ?? "#"}
      onClick={(e) => {
        if (!crumb.href) e.preventDefault();
        crumb.onNavigate?.();
      }}
      className={cn(
        "focus-ring max-w-48 truncate rounded-xs text-ui text-ink-500 transition-colors duration-instant hover:text-ink-800 hover:underline",
        className,
      )}
    >
      {crumb.label}
    </a>
  );
}

function Slash() {
  return (
    <span aria-hidden className="select-none text-ui text-ink-300">
      /
    </span>
  );
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  const current = items[items.length - 1];
  const collapse = items.length > 4;
  const head = collapse ? [items[0]] : items.slice(0, -1);
  const hidden = collapse ? items.slice(1, -2) : [];
  const tail = collapse ? [items[items.length - 2]] : [];

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        {head.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            <CrumbLink crumb={c} />
            <Slash />
          </li>
        ))}
        {collapse && (
          <li className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${hidden.length} more levels`}
                className="focus-ring grid size-5 place-items-center rounded-xs text-ink-500 hover:bg-paper-3 hover:text-ink-800"
              >
                <Ellipsis className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {hidden.map((c, i) => (
                  <DropdownMenuItem key={i} onSelect={() => c.onNavigate?.()}>
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Slash />
          </li>
        )}
        {tail.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            <CrumbLink crumb={c} />
            <Slash />
          </li>
        ))}
        <li className="min-w-0">
          <span aria-current="page" className="block truncate text-ui font-medium text-ink-900">
            {current.label}
          </span>
        </li>
      </ol>
    </nav>
  );
}
