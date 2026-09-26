'use client';
// ── THE DETAILS ─────────────────────────────────────────────────────────────
//
// The small things that add up, each on a card of its own. Every one is a real feature, named the way
// the app names it, and the shortcuts are the app's own (components/shell). The command palette card
// WORKS: type, move with the arrow keys, press Enter.

import * as React from 'react';
import { Calendar as CalendarIcon, Check, Keyboard, Mail, Plug, Search, Timer, Upload, type IconType } from '@/components/ds/icons';
import { Icon, Kbd, cardClass } from '@/components/ds/ui';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ds/ui/command';
import { cn } from '@/lib/cn';
import { Cell, IconTile, type Hue } from './visual';

const COMMANDS = [
  { label: 'New task', keys: ['C'], done: 'A new task is waiting for its title.' },
  { label: 'Go to Projects', keys: ['G', 'P'], done: 'Projects is open.' },
  { label: 'Go to Finance', keys: ['G', 'M'], done: 'Finance is open.' },
  { label: 'Go to Documents', keys: ['G', 'D'], done: 'Documents is open.' },
  { label: 'Focus mode', keys: ['F'], done: 'Everything else is out of the way.' },
  { label: 'Triage inbox', keys: ['⇧', 'T'], done: 'Your inbox, one item at a time.' },
];

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Command palette' },
  { keys: ['C'], label: 'Quick capture' },
  { keys: ['H'], label: 'Highlight a task' },
  { keys: ['E'], label: 'Complete a task' },
  { keys: ['F'], label: 'Focus mode' },
  { keys: ['G', 'P'], label: 'Go to Projects' },
];

/** One cell of the grid: its glyph, a title that says what it is, a line that says why, and the thing itself. */
function Card({ className, icon, hue, title, body, children }: { className?: string; icon: IconType; hue: Hue; title: string; body: string; children?: React.ReactNode }) {
  return (
    <Cell className={cn('flex flex-col gap-6 p-6 sm:p-8', className)}>
      <div className="site-reveal flex items-start gap-4">
        <IconTile icon={icon} hue={hue} />
        <div className="min-w-0 pt-[7px]">
          <p className="text-body-lg font-medium leading-snug text-ink-900">{title}</p>
          <p className="mt-1.5 max-w-[42ch] text-ui text-ink-600">{body}</p>
        </div>
      </div>
      {children}
    </Cell>
  );
}

function CommandDemo() {
  const [ran, setRan] = React.useState<string | null>(null);
  // THE PAGE MUST NOT JUMP TO THIS. cmdk scrolls its selected item into view whenever it mounts or
  // selects, with `scrollIntoView`, which scrolls every ancestor up to the window: a first visit
  // landed 5,773px down the page, on this card. So nothing is selected until the visitor reaches
  // the palette (a pointer over it, or focus in it); with nothing selected there is nothing to scroll
  // to, and once they are here a "nearest" scroll has nothing left to move.
  const [value, setValue] = React.useState('');
  const here = React.useRef(false);
  const arrive = () => { here.current = true; };
  return (
    <div className="flex flex-1 flex-col gap-3" onPointerEnter={arrive} onFocusCapture={arrive}>
      <Command
        className={cardClass('shadow-panel')}
        loop
        value={value}
        onValueChange={(v) => { if (here.current) setValue(v); }}
      >
        <CommandInput placeholder="Type a command…" className="text-ui text-ink-900 placeholder:text-ink-500" aria-label="Command" />
        <CommandList className="max-h-[15rem] p-1">
          <CommandEmpty className="py-6 text-center text-ui text-ink-500">No command by that name.</CommandEmpty>
          {COMMANDS.map((c) => (
            <CommandItem
              key={c.label}
              value={c.label}
              onSelect={() => setRan(c.label)}
              className="h-8 rounded-md px-2.5 text-ui text-ink-800 data-[selected=true]:bg-surface-hover data-[selected=true]:text-ink-900"
            >
              {c.label}
              <CommandShortcut className="ms-auto"><Kbd keys={c.keys} /></CommandShortcut>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
      <p aria-live="polite" className="min-h-5 text-caption text-ink-500">
        {ran ? <span key={ran} className="site-swap zb-enter inline-flex items-center gap-1.5"><Icon icon={Check} size={14} className="text-success-600" />{COMMANDS.find((c) => c.label === ran)?.done}</span> : 'Arrow keys to move, Enter to run.'}
      </p>
    </div>
  );
}

/** The cells of the details row: they sit straight in the page's grid (a Row's subgrid), not in a box of their own. */
export function Bento() {
  return (
    <>
      <Card
        className="lg:col-span-6 lg:row-span-2"
        icon={Search}
        hue="periwinkle"
        title="Everything is a few keys away"
        body="The command palette opens with ⌘K. Try it here: type, move with the arrow keys, press Enter."
      >
        <CommandDemo />
      </Card>

      <Card className="lg:col-span-6" icon={Keyboard} hue="periwinkle" title="Shortcuts you learn once" body="The keys follow the words: H highlights, E completes, G then P goes to Projects.">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-ui text-ink-800 transition-colors duration-fast ease-hover hover:bg-surface-hover">
              {s.label}<Kbd keys={s.keys} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-6" icon={Timer} hue="periwinkle" title="Focus mode" body="One task on screen, a timer, and nothing else until you come back.">
        <div className="mt-auto flex items-center gap-4 rounded-lg bg-surface-fill px-4 py-3">
          <span className="text-title-3 tabular-nums text-ink-900">24:12</span>
          <span className="min-w-0 flex-1 truncate text-ui text-ink-700">Finish the logo presentation</span>
          <Kbd keys={['F']} />
        </div>
      </Card>

      <Card className="lg:col-span-4" icon={CalendarIcon} hue="periwinkle" title="Your calendar, beside your tasks" body="Connect Google Calendar and your meetings sit on the same day as your plan.">
        <ul className="mt-auto flex flex-col gap-1.5 text-ui">
          <li className="flex items-center gap-3 rounded-md bg-surface-fill px-3 py-2"><span className="tabular-nums text-caption text-ink-500">11:30</span><span className="truncate text-ink-800">Ridgeline call</span></li>
          <li className="flex items-center gap-3 rounded-md border border-line px-3 py-2"><span className="tabular-nums text-caption text-ink-500">14:00</span><span className="truncate text-ink-900">Type and color system</span></li>
        </ul>
      </Card>

      <Card className="lg:col-span-4" icon={Mail} hue="periwinkle" title="Your day, in your inbox" body="A short email each morning: the highlight, the plan, and what is waiting on others.">
        <div className={cardClass('mt-auto px-4 py-3 text-ui')}>
          <p className="text-caption text-ink-500">Zenboard · 7:30</p>
          <p className="mt-1 font-medium text-ink-900">Thursday: 4 tasks, 2 meetings</p>
          <p className="mt-0.5 truncate text-ink-600">Highlight: Send the Ridgeline invoice</p>
        </div>
      </Card>

      <Card className="lg:col-span-4" icon={Plug} hue="periwinkle" title="Bring your work with you" body="Import your pages from Notion. Connect an AI assistant through Zenboard’s MCP server.">
        <ul className="mt-auto flex flex-col gap-1.5 text-ui text-ink-800">
          <li className="flex items-center gap-2.5"><Icon icon={Upload} size={16} weight="fill" className="text-ink-500" />Import from Notion</li>
          <li className="flex items-center gap-2.5"><Icon icon={Plug} size={16} weight="fill" className="text-ink-500" />MCP server for AI assistants</li>
        </ul>
      </Card>
    </>
  );
}
