'use client';
import * as React from 'react';
import { ChevronDown } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

// THE heading of a collapsible group in a rail — the sidebar's "Pinned", the Tasks rail's "Projects" and
// "Lists", the Calendar's "My calendars".
//
// Three rails spelled it three ways (2026-10-02 consistency pass): the sidebar put a 14px chevron BEFORE the
// label at a 4px gap in an 8px-padded box; Tasks a 12px caret before it at 6px; Calendar a bold 12px chevron
// before it at 6px in a 24px row. One grammar now, Linear's: the label starts at the rail's row inset (so it
// sits on the same x as the glyphs below it), the chevron FOLLOWS the word at the 12px glyph's 4px gap, and
// the heading is a 28px row — shorter and quieter than the 32px rows it heads, so it reads as a container,
// not as a destination.
export function RailSectionHeading({ label, open, onToggle, action, className }: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** A trailing control on the heading's own line — an "Add" icon button. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-7 shrink-0 items-center gap-1 px-[var(--nav-px,8px)]', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring group/heading -mx-1 flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-left text-ink-500 transition-colors duration-fast hover:text-ink-700"
      >
        <span className="truncate text-overline leading-none">{label}</span>
        <Icon icon={ChevronDown} size={12}
          className={cn('shrink-0 transition-transform duration-fast ease-standard', !open && '-rotate-90')} />
      </button>
      {action && <span className="ms-auto flex shrink-0 items-center">{action}</span>}
    </div>
  );
}
