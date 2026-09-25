'use client';
// ── HOME, LIVE ──────────────────────────────────────────────────────────────
//
// The hero's picture is not a picture. It is Zenboard's Home, drawn with the app's own parts, and it
// WORKS: tick a task and it settles into done; press the mark beside another and it becomes today's
// highlight. A visitor learns the product's two most important verbs before reading a word about
// them (Emil: let people touch the product before they use it).
//
// Only what the product itself does happens here — the same checkbox, the same highlight toggle with
// the same labels, the same "reveal on hover" rule. Nothing is saved: it is a sample studio, and a
// reload puts the morning back.

import * as React from 'react';
import {
  Calendar as CalendarIcon, FileText, Flame, Folder, Highlight, House, Landmark, MessageCircle, SquarePen, Users,
} from '@/components/ds/icons';
import { Avatar, Badge, Checkbox, Icon, IconButton, Logo, Mark, Panel, PanelBody, PanelHeader } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

type Task = { id: string; title: string; where: string; est: string; done: boolean };

const START: Task[] = [
  { id: 'invoice', title: 'Send the Ridgeline invoice', where: 'Finance', est: '15m', done: false },
  { id: 'logo', title: 'Finish the logo presentation', where: 'Ridgeline rebrand', est: '2h', done: false },
  { id: 'scope', title: 'Reply to Beacon about scope', where: 'Beacon Health site', est: '20m', done: false },
  { id: 'review', title: 'Weekly review', where: 'Done 9:40', est: '30m', done: true },
];

const NAV = [
  { label: 'Home', icon: House, on: true },
  { label: 'Tasks', icon: SquarePen },
  { label: 'Calendar', icon: CalendarIcon },
  { label: 'Projects', icon: Folder },
  { label: 'Clients', icon: Users },
  { label: 'Documents', icon: FileText },
  { label: 'Messages', icon: MessageCircle },
  { label: 'Finance', icon: Landmark },
];

const DAY = [
  { when: '09:00', what: 'Deep work: logo presentation' },
  { when: '11:30', what: 'Ridgeline call', now: true },
  { when: '14:00', what: 'Beacon Health, sitemap review' },
  { when: '16:30', what: 'Invoices and admin' },
];

/** `rail`: the sidebar beside Home. Left out where the picture is half a screen wide: it is the least
    readable part of a narrow picture, and Home is what the visitor is invited to use.
    `fluid`: as wide as its place, up to the app's real measure, rather than cut by it. */
export function LiveHome({ className, rail = true, fluid = false }: { className?: string; rail?: boolean; fluid?: boolean }) {
  const [tasks, setTasks] = React.useState(START);
  const [highlightId, setHighlightId] = React.useState('invoice');
  const highlight = tasks.find((t) => t.id === highlightId) ?? tasks[0];
  const open = tasks.filter((t) => !t.done).length;

  const toggle = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <div role="group" aria-label="A working preview of Zenboard’s Home" className={cn('sheet flex overflow-hidden', fluid ? 'w-full' : rail ? 'w-[1180px]' : 'w-[948px]', className)}>
      {/* The sidebar is scenery: the page beside it is the part you can use. On a phone it is left out —
          Home is what a thumb should see first, the same call the app makes at that width. */}
      {rail && <nav aria-hidden inert className="flex w-[232px] shrink-0 select-none flex-col gap-0.5 border-e border-line-soft bg-sidebar px-3 py-4 max-sm:hidden">
        <div className="mb-4 px-2"><Logo height={22} /></div>
        {NAV.map((n) => (
          <span
            key={n.label}
            className={cn('flex h-[var(--row-nav)] items-center gap-2.5 rounded-md px-2.5 text-ui', n.on ? 'bg-surface-active font-medium text-ink-900' : 'text-ink-700')}
          >
            <Icon icon={n.icon} size={16} className={n.on ? 'text-ink-900' : 'text-ink-500'} />
            {n.label}
          </span>
        ))}
      </nav>}

      <div className="min-w-0 flex-1 px-6 pb-12 pt-8 sm:px-10 sm:pt-9">
        <header>
          <div className="mb-2 flex items-center gap-2">
            <Mark size={24} tone="brand" />
            <h2 className="font-editorial text-title-2 leading-none font-medium text-ink-900">Good morning, Alex.</h2>
          </div>
          {/* Polite, so a screen reader hears the day change as the visitor changes it. */}
          <p aria-live="polite" className="text-ui text-ink-500">
            {open === 0 ? (
              <>Everything on today’s plan is done. <b className="font-medium text-ink-800">Close the day</b> whenever you’re ready.</>
            ) : (
              <>
                <b className="font-medium text-ink-800">{open} {open === 1 ? 'task' : 'tasks'}</b> to go. Highlight:{' '}
                <span className="font-medium text-ink-800">{highlight.title}.</span>
              </>
            )}
          </p>
        </header>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={Flame} size={20} className="text-accent" />} title="Today’s highlight" summary={highlight.done ? 'Done' : 'Do this first'} />
              <PanelBody>
                {/* Keyed on the task, so a new highlight ARRIVES rather than the words changing in place. */}
                <div key={highlight.id} className="site-swap zb-enter flex w-full flex-col gap-2 px-[var(--panel-px)] py-4">
                  <span className={cn('text-title-3 font-medium', highlight.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{highlight.title}</span>
                  <span className="flex items-center gap-3 text-caption text-ink-500">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-xs bg-accent" />{highlight.where}</span>
                    <span>{highlight.est}</span>
                  </span>
                </div>
              </PanelBody>
            </Panel>

            <Panel frame="shadow">
              <PanelHeader title="Plan" summary={`${tasks.length - open} of ${tasks.length} done`} />
              <PanelBody>
                {tasks.map((t, i) => {
                  const on = t.id === highlightId;
                  return (
                    <div key={t.id} className={cn('group flex h-[var(--row-task)] w-full items-center gap-3 px-[var(--panel-px)]', i > 0 && 'border-t border-line-soft')}>
                      <Checkbox checked={t.done} onCheckedChange={() => toggle(t.id)} aria-label={t.done ? `Mark “${t.title}” as not done` : `Complete “${t.title}”`} />
                      <span className={cn('min-w-0 flex-1 truncate text-ui transition-colors duration-fast ease-hover', t.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{t.title}</span>
                      <span className="hidden shrink-0 text-caption text-ink-500 sm:inline">{t.where}</span>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        selected={on}
                        onClick={() => setHighlightId(t.id)}
                        label={on ? 'Today’s highlight' : 'Highlight this task'}
                        className={cn('[@media(pointer:coarse)]:after:w-6', on ? 'bg-transparent text-ink-700 hover:bg-surface-hover active:bg-surface-hover' : 'reveal-on-hover')}
                        icon={<Icon icon={Highlight} size={14} weight={on ? 'fill' : 'regular'} />}
                      />
                    </div>
                  );
                })}
              </PanelBody>
            </Panel>
          </div>

          <div aria-hidden inert className="flex min-w-0 select-none flex-col gap-5 max-lg:hidden">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={CalendarIcon} size={20} className="text-ink-500" />} title="Schedule" summary="Thursday" />
              <PanelBody>
                {DAY.map((d, i) => (
                  <div key={d.when} className={cn('flex h-[var(--row-task)] w-full items-center gap-3 px-[var(--panel-px)]', i > 0 && 'border-t border-line-soft')}>
                    <span className="w-11 shrink-0 text-caption tabular-nums text-ink-500">{d.when}</span>
                    <span className={cn('min-w-0 flex-1 truncate text-ui', d.now ? 'font-medium text-ink-900' : 'text-ink-800')}>{d.what}</span>
                    {d.now && <Badge status="info">Now</Badge>}
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel frame="shadow">
              <PanelHeader title="Waiting on" summary="Their move" />
              <PanelBody>
                <div className="flex w-full items-center gap-3 px-[var(--panel-px)] py-3">
                  <Avatar name="Daniel Okafor" size="sm" decorative />
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-800">Beacon · sign-off on the sitemap</span>
                  <span className="shrink-0 text-caption text-ink-500">2 days</span>
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
