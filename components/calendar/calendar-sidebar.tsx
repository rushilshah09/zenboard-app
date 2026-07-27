'use client';
// Calendar left rail — mini-month navigator + two collapsible calendar lists
// (PROJECTS · MY CALENDARS) with colored checkboxes that show/hide events, in the
// Notion-calendar idiom. The checkbox FILL is the calendar's own colour (user
// content — the one sanctioned inline-colour case); all geometry, typography, and
// state come from DS tokens. The rail is a bg-paper panel that collapses on narrow
// viewports and via the toolbar toggle.
import { useState } from 'react';
import { Check, ChevronDown, Search, Plus } from "@/components/ds/icons";
import { Icon, IconButton } from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { MiniMonth, type DateRange } from '@/components/calendar/mini-month';
import { MY_CALENDARS, type Cal } from '@/lib/calendar-cats';
import { palette, paletteFor } from '@/lib/palette';

export type RailProject = { id: string; name: string; color: string };

// A single colored calendar row: 18px checkbox in the item's hue + label.
function CalRow({ name, dot, on, onToggle }: { name: string; dot: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle}
      className="focus-ring flex h-[30px] w-full items-center gap-2 rounded-sm px-2 text-left transition-colors duration-fast hover:bg-surface-hover">
      <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-xs border transition-colors duration-fast"
        style={on ? { background: dot, borderColor: dot } : { borderColor: 'var(--color-line-strong)' }}>
        {on && <Icon icon={Check} size={12} weight="bold" className="text-white" />}
      </span>
      <span className="truncate text-ui text-ink-800">{name}</span>
    </button>
  );
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="focus-ring flex h-6 items-center gap-1.5 rounded-xs px-2 text-ink-600">
        <Icon icon={ChevronDown} size={12} weight="bold" className={cn('transition-transform duration-base', !open && '-rotate-90')} />
        <span className="text-overline uppercase">{title}</span>
      </button>
      {open && <div className="flex flex-col gap-px">{children}</div>}
    </div>
  );
}

export function CalendarSidebar({ selected, onPick, range, onSelectRange, projects, hidden, onToggle, onCreate }: {
  selected: Date;
  onPick: (d: Date) => void;
  range?: DateRange | null;
  onSelectRange?: (start: Date, end: Date) => void;
  projects: RailProject[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto px-2 pb-4 pt-2.5">
      {/* Rail-top actions — canonical IconButton (DS §4.3) */}
      <div className="flex items-center gap-1 px-0.5">
        <span className="flex-1" />
        <IconButton icon={<Icon icon={Search} size={16} />} label="Search events" size="sm" variant="ghost" />
        <IconButton icon={<Icon icon={Plus} size={16} />} label="New event" size="sm" variant="ghost" onClick={onCreate} />
      </div>

      <MiniMonth selected={selected} onPick={onPick} range={range} onSelectRange={onSelectRange} />

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((p) => {
            const dot = p.color || paletteFor(p.id).dot;
            return <CalRow key={p.id} name={p.name} dot={dot} on={!hidden.has(p.id)} onToggle={() => onToggle(p.id)} />;
          })}
        </Section>
      )}

      <Section title="My calendars">
        {MY_CALENDARS.map((c: Cal) => (
          <CalRow key={c.id} name={c.name} dot={palette(c.hue).dot} on={!hidden.has(c.id)} onToggle={() => onToggle(c.id)} />
        ))}
      </Section>
    </div>
  );
}
