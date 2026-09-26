'use client';
// ── ZENBOARD, THE WHOLE OF IT ───────────────────────────────────────────────
//
// The user, 2026-09-26, of the Home preview that stood here: "this is still a basic dashboard, I want
// the full dashboard", with a screenshot of the real app's Today; and before it, "a full interactive
// app demo, where the visitor can experience all the interactions". So the second section is the
// product as it opens in the morning, laid out the way the app lays it out: the sidebar with search
// and every place, your projects under them; the day's greeting, the highlight and the plan; and the
// rail beside it with the schedule, the money, the habits and the clients.
//
// And it WORKS, on a sample studio, with nothing saved (a reload puts the morning back):
//   · tick a task, make another the highlight, add one to today, file the inbox into today;
//   · every place in the sidebar opens (Projects, Docs, Calendar, Clients and Money are the page's own
//     working demos, in the frame they live in); search opens the command palette, and ⌘K does too
//     while the pointer or the keyboard is in the preview;
//   · "Start focus" starts a real focus session, no account needed (guest-focus.tsx), about the task
//     it was pressed on.
//
// The parts are the product's own (Panel, Checkbox, Badge, PriorityBadge, Avatar, Button), so this is
// the product's grammar, not a drawing of it. The names are a made-up studio's: never a real client.

import * as React from 'react';
import {
  Calendar as CalendarIcon, Check, FileText, Flame, Folder, Highlight, Inbox, Landmark, Play, Plus, Search, Sun,
  SquareCheck, Timer, Users, type IconType,
} from '@/components/ds/icons';
import {
  Avatar, Badge, Button, Checkbox, Icon, IconButton, Kbd, Logo, Mark, Panel, PanelBody, PanelHeader, PriorityBadge,
  cardClass, type PriorityLevel,
} from '@/components/ds/ui';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ds/ui/command';
import { cn } from '@/lib/cn';
import { formatDayWithWeekday } from '@/lib/date';
import { openGuestFocus } from '@/lib/guest-focus';
import { BoardDemo, DocDemo, InvoiceDemo, TimeboxDemo } from './demos';
import { FACES } from './faces';
import { PortalView } from './portal-spotlight';

type View = 'today' | 'inbox' | 'tasks' | 'projects' | 'docs' | 'calendar' | 'clients' | 'money' | 'habits';
type ProjectId = 'ridgeline' | 'beacon' | 'copper' | 'life';
type Task = { id: string; title: string; project: ProjectId; priority?: PriorityLevel; when: 'today' | 'inbox' | 'later'; done: boolean; est?: string };

const PROJECTS: Record<ProjectId, { name: string; dot: string }> = {
  ridgeline: { name: 'Ridgeline rebrand', dot: 'bg-accent' },
  beacon: { name: 'Beacon Health site', dot: 'bg-info-600' },
  copper: { name: 'Copper Row menus', dot: 'bg-warning-600' },
  life: { name: 'Life', dot: 'bg-success-600' },
};

const START: Task[] = [
  { id: 'invoice', title: 'Send the Ridgeline invoice', project: 'ridgeline', priority: 'high', when: 'today', done: false, est: '15m' },
  { id: 'logo', title: 'Finish the logo presentation', project: 'ridgeline', priority: 'med', when: 'today', done: false, est: '2h' },
  { id: 'scope', title: 'Reply to Beacon about scope', project: 'beacon', when: 'today', done: false, est: '20m' },
  { id: 'review', title: 'Weekly review', project: 'life', when: 'today', done: true, est: '30m' },
  { id: 'brief', title: 'Draft the Copper Row brief', project: 'copper', priority: 'med', when: 'inbox', done: false },
  { id: 'sitemap', title: 'Sitemap notes from Beacon', project: 'beacon', when: 'inbox', done: false },
  { id: 'receipts', title: 'File September receipts', project: 'life', when: 'inbox', done: false },
  { id: 'type', title: 'Type and color system', project: 'ridgeline', priority: 'med', when: 'later', done: false },
  { id: 'menu', title: 'Photograph the new menu', project: 'copper', when: 'later', done: false },
];

const NAV: { id: View | 'focus'; label: string; icon: IconType }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'tasks', label: 'Tasks', icon: SquareCheck },
  { id: 'projects', label: 'Projects', icon: Folder },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'money', label: 'Money', icon: Landmark },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'focus', label: 'Focus', icon: Timer },
];
const TITLE: Record<View, string> = {
  today: 'Today', inbox: 'Inbox', tasks: 'Tasks', projects: 'Ridgeline rebrand', docs: 'Ridgeline, brand brief',
  calendar: 'Calendar', clients: 'Ridgeline', money: 'Money', habits: 'Habits',
};

const SCHEDULE = [
  { at: '09:00', what: 'Standup with the studio', bar: 'bg-field-sky' },
  { at: '11:30', what: 'Ridgeline call', bar: 'bg-accent', now: true },
  { at: '14:00', what: 'Beacon Health, sitemap review', bar: 'bg-field-apricot' },
  { at: '16:30', what: 'Invoices and admin', bar: 'bg-field-sage' },
];
const START_HABITS = [
  { id: 'walk', label: 'Morning walk', streak: 12, done: true, week: [1, 1, 1, 0, 1, 1] },
  { id: 'inbox', label: 'Inbox to zero', streak: 4, done: false, week: [1, 0, 1, 1, 1, 0] },
  { id: 'read', label: 'Read 20 minutes', streak: 0, done: false, week: [0, 1, 0, 0, 1, 0] },
];
const CLIENTS = [
  { name: 'Priya Nair', company: 'Ridgeline', face: FACES.priya, status: 'Active', tone: 'success' as const },
  { name: 'Daniel Okafor', company: 'Beacon Health', face: undefined, status: 'Waiting', tone: 'info' as const },
  { name: 'Copper Row', company: 'Copper Row', face: undefined, status: 'Overdue', tone: 'danger' as const },
];

const never = () => () => {};
/** The part of the visitor's day it is, read on their machine (the server says morning). */
function useGreeting() {
  const read = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };
  return React.useSyncExternalStore(never, read, () => 'Good morning');
}
/** The visitor's own weekday and date, for the page header, in the product's one date vocabulary
    (the server leaves it out). */
function useToday() {
  return React.useSyncExternalStore(never, () => formatDayWithWeekday(new Date()) ?? '', () => '');
}

function ProjectChip({ id }: { id: ProjectId }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-ink-500">
      <span className={cn('size-2 rounded-xs', PROJECTS[id].dot)} />
      {PROJECTS[id].name}
    </span>
  );
}

/** One task, the way every list in the app draws it. */
function Row({ t, highlighted, onToggle, onHighlight, first }: {
  t: Task; highlighted?: boolean; onToggle: () => void; onHighlight?: () => void; first?: boolean;
}) {
  return (
    <div className={cn('group flex h-[var(--row-task)] w-full items-center gap-3 px-[var(--panel-px)]', !first && 'border-t border-line-soft')}>
      <Checkbox checked={t.done} onCheckedChange={onToggle} aria-label={t.done ? `Mark “${t.title}” as not done` : `Complete “${t.title}”`} />
      <span className={cn('min-w-0 flex-1 truncate text-ui transition-colors duration-[var(--site-hover)] ease-hover', t.done ? 'text-ink-500 line-through' : 'text-ink-900')}>{t.title}</span>
      <span className="hidden items-center gap-3 sm:flex">
        {t.priority && !t.done && <PriorityBadge level={t.priority} />}
        <ProjectChip id={t.project} />
      </span>
      {onHighlight && !t.done && (
        <IconButton
          size="xs"
          variant="ghost"
          selected={highlighted}
          onClick={onHighlight}
          label={highlighted ? 'Today’s highlight' : 'Highlight this task'}
          className={cn('[@media(pointer:coarse)]:after:w-6', highlighted ? 'bg-transparent text-accent hover:bg-surface-hover' : 'reveal-on-hover')}
          icon={<Icon icon={Highlight} size={14} weight={highlighted ? 'fill' : 'regular'} />}
        />
      )}
    </div>
  );
}

function TodayView({ tasks, highlightId, onToggle, onHighlight, onAdd, name }: {
  tasks: Task[]; highlightId: string; onToggle: (id: string) => void; onHighlight: (id: string) => void; onAdd: (title: string) => void; name: string;
}) {
  const greeting = useGreeting();
  const [draft, setDraft] = React.useState('');
  const today = tasks.filter((t) => t.when === 'today');
  const open = today.filter((t) => !t.done);
  const done = today.filter((t) => t.done);
  const highlight = open.find((t) => t.id === highlightId) ?? open[0];
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft('');
  };

  return (
    <div role="group" aria-label="A working preview of Zenboard’s Home" className="flex min-w-0 flex-col gap-5">
      <header>
        <div className="mb-2 flex items-center gap-2">
          <Mark size={24} tone="brand" />
          <h3 className="font-editorial text-title-2 font-medium leading-none text-ink-900">{greeting}, {name}.</h3>
        </div>
        {/* Polite, so a screen reader hears the day change as the visitor changes it. */}
        <p aria-live="polite" className="text-ui text-ink-500">
          {open.length === 0 ? (
            <>Everything on today’s plan is done. <b className="font-medium text-ink-800">Close the day</b> whenever you’re ready.</>
          ) : (
            <>
              You’ve committed to <b className="font-medium text-ink-800">{open.length} {open.length === 1 ? 'task' : 'tasks'}</b>.
              {highlight && <> Highlight: <span className="font-medium text-ink-800">{highlight.title}.</span></>}
            </>
          )}
        </p>
      </header>

      <Panel frame="shadow">
        <PanelHeader icon={<Icon icon={Flame} size={20} className="text-accent" />} title="Today’s highlight" summary={highlight ? 'Do this first' : 'Nothing left'} />
        <PanelBody>
          {highlight ? (
            <div key={highlight.id} className="site-swap zb-enter w-full">
              <div className="flex w-full flex-col gap-2 px-[var(--panel-px)] py-4">
                <span className="text-title-3 font-medium text-ink-900">{highlight.title}</span>
                <span className="flex flex-wrap items-center gap-3">
                  <ProjectChip id={highlight.project} />
                  {highlight.priority && <PriorityBadge level={highlight.priority} />}
                  {highlight.est && <span className="text-caption tabular-nums text-ink-500">{highlight.est}</span>}
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-line-soft px-[var(--panel-px)] py-3">
                <Button variant="brand" size="sm" icon={<Icon icon={Play} size={16} weight="fill" />} onClick={() => openGuestFocus(highlight.title)}>Start focus</Button>
                <Button variant="ghost" size="sm" icon={<Icon icon={Check} size={16} />} onClick={() => onToggle(highlight.id)}>Mark done</Button>
              </div>
            </div>
          ) : (
            <p className="px-[var(--panel-px)] py-4 text-ui text-ink-500">The plan is clear. Pick a highlight from the inbox, or close the day.</p>
          )}
        </PanelBody>
      </Panel>

      <Panel frame="shadow">
        <PanelHeader icon={<Icon icon={Sun} size={20} />} title="Today’s plan" count={open.length > 0 ? open.length : undefined} />
        <PanelBody>
          <label className="flex h-[var(--row-task)] w-full items-center gap-3 border-b border-line-soft px-[var(--panel-px)] text-ink-500">
            <Icon icon={Plus} size={14} className="mx-px shrink-0" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              data-chromeless
              placeholder="Add to today"
              aria-label="Add a task to today"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="min-w-0 flex-1 bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500"
            />
            {draft.trim() && <Button variant="secondary" size="xs" onClick={add}>Add</Button>}
          </label>
          {open.map((t, i) => (
            <Row key={t.id} t={t} first={i === 0} highlighted={t.id === highlight?.id} onToggle={() => onToggle(t.id)} onHighlight={() => onHighlight(t.id)} />
          ))}
          {done.length > 0 && (
            <>
              <p className="border-t border-line-soft px-[var(--panel-px)] pb-1 pt-3 text-caption text-ink-500">Completed · {done.length}</p>
              {done.map((t) => <Row key={t.id} t={t} first onToggle={() => onToggle(t.id)} />)}
            </>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function RailPanel({ title, count, onOpen, children }: { title: string; count?: string; onOpen?: () => void; children: React.ReactNode }) {
  return (
    <section className={cardClass('p-3.5')}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="focus-ring rounded-xs text-caption font-medium text-ink-500 transition-colors duration-[var(--site-hover)] ease-hover hover:text-ink-900">{title}</button>
        ) : <p className="text-caption font-medium text-ink-500">{title}</p>}
        {count && <span className="text-caption tabular-nums text-ink-500">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Rail({ go }: { go: (v: View) => void }) {
  const [habits, setHabits] = React.useState(START_HABITS);
  const kept = habits.filter((h) => h.done).length;
  return (
    <aside aria-label="Your day at a glance" className="flex w-[17.5rem] shrink-0 flex-col gap-3 border-s border-line-soft p-4 max-xl:hidden">
      <RailPanel title="Schedule" onOpen={() => go('calendar')}>
        <ul className="flex flex-col gap-2">
          {SCHEDULE.map((s) => (
            <li key={s.at} className="flex items-center gap-2.5">
              <span className={cn('h-5 w-1 shrink-0 rounded-xs', s.bar)} />
              <span className={cn('min-w-0 flex-1 truncate text-ui', s.now ? 'font-medium text-ink-900' : 'text-ink-800')}>{s.what}</span>
              {s.now ? <Badge status="info">Now</Badge> : <span className="text-caption tabular-nums text-ink-500">{s.at}</span>}
            </li>
          ))}
        </ul>
      </RailPanel>

      <RailPanel title="Money" onOpen={() => go('money')}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-caption text-ink-500">Outstanding</p>
            <p className="mt-0.5 text-title-3 font-medium tabular-nums text-ink-900">$4,300</p>
          </div>
          <div>
            <p className="text-caption text-ink-500">Paid this month</p>
            <p className="mt-0.5 text-title-3 font-medium tabular-nums text-ink-900">$6,000</p>
          </div>
        </div>
      </RailPanel>

      <RailPanel title="Habits" count={`${kept}/${habits.length}`} onOpen={() => go('habits')}>
        <ul className="flex flex-col gap-1.5">
          {habits.map((h) => (
            <li key={h.id} className="flex items-center gap-2.5">
              <Checkbox
                checked={h.done}
                onCheckedChange={() => setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, done: !x.done, streak: x.streak + (x.done ? -1 : 1) } : x)))}
                aria-label={h.done ? `Undo “${h.label}” for today` : `Done “${h.label}” today`}
              />
              <span className={cn('min-w-0 flex-1 truncate text-ui', h.done ? 'text-ink-900' : 'text-ink-700')}>{h.label}</span>
              <span className="text-caption tabular-nums text-ink-500">{h.streak}</span>
            </li>
          ))}
        </ul>
      </RailPanel>

      <RailPanel title="Clients" onOpen={() => go('clients')}>
        <ul className="flex flex-col gap-2.5">
          {CLIENTS.map((c) => (
            <li key={c.name} className="flex items-center gap-2.5">
              <Avatar name={c.name} src={c.face} size="sm" decorative />
              <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{c.company}</span>
              <Badge status={c.tone}>{c.status}</Badge>
            </li>
          ))}
        </ul>
      </RailPanel>
    </aside>
  );
}

function InboxView({ tasks, onPlan }: { tasks: Task[]; onPlan: (id: string, when: Task['when']) => void }) {
  const inbox = tasks.filter((t) => t.when === 'inbox');
  return (
    <Panel frame="shadow">
      <PanelHeader icon={<Icon icon={Inbox} size={20} />} title="Inbox" count={inbox.length || undefined} summary={inbox.length ? null : 'Clear'} />
      <PanelBody>
        {inbox.length === 0 ? (
          <p className="px-[var(--panel-px)] py-4 text-ui text-ink-500">Inbox zero. Everything has a place.</p>
        ) : inbox.map((t, i) => (
          <div key={t.id} className={cn('site-swap zb-enter flex min-h-[var(--row-table)] w-full flex-wrap items-center gap-3 px-[var(--panel-px)] py-2', i > 0 && 'border-t border-line-soft')}>
            <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{t.title}</span>
            <ProjectChip id={t.project} />
            <span className="flex items-center gap-1.5">
              <Button size="xs" variant="secondary" onClick={() => onPlan(t.id, 'today')}>Today</Button>
              <Button size="xs" variant="ghost" onClick={() => onPlan(t.id, 'later')}>Later</Button>
            </span>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function TasksView({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {(Object.keys(PROJECTS) as ProjectId[]).map((p) => {
        const rows = tasks.filter((t) => t.project === p && t.when !== 'inbox');
        if (!rows.length) return null;
        return (
          <Panel key={p} frame="shadow">
            <PanelHeader icon={<span className={cn('size-2.5 rounded-xs', PROJECTS[p].dot)} />} title={PROJECTS[p].name} summary={`${rows.filter((t) => t.done).length} of ${rows.length} done`} />
            <PanelBody>
              {rows.map((t, i) => <Row key={t.id} t={t} first={i === 0} onToggle={() => onToggle(t.id)} />)}
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}

function HabitsView() {
  const [habits, setHabits] = React.useState(START_HABITS);
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  return (
    <Panel frame="shadow">
      <PanelHeader icon={<Icon icon={Flame} size={20} />} title="This week" summary={`${habits.filter((h) => h.done).length} of ${habits.length} today`} />
      <PanelBody>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[30rem] text-ui">
            <thead>
              <tr className="text-caption text-ink-500">
                <th className="px-[var(--panel-px)] py-2 text-start font-normal">Habit</th>
                {DAYS.map((d) => <th key={d} className="w-12 py-2 font-normal">{d}</th>)}
                <th className="w-16 px-[var(--panel-px)] py-2 text-end font-normal">Streak</th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
                <tr key={h.id} className="border-t border-line-soft">
                  <td className="px-[var(--panel-px)] py-2.5 text-ink-900">{h.label}</td>
                  {h.week.map((on, i) => (
                    <td key={i} className="py-2.5 text-center"><span className={cn('mx-auto block size-4 rounded-xs', on ? 'bg-success-600' : 'bg-surface-fill')} /></td>
                  ))}
                  <td className="py-2.5 text-center">
                    <Checkbox
                      checked={h.done}
                      onCheckedChange={() => setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, done: !x.done, streak: x.streak + (x.done ? -1 : 1) } : x)))}
                      aria-label={h.done ? `Undo “${h.label}” for today` : `Done “${h.label}” today`}
                    />
                  </td>
                  <td className="px-[var(--panel-px)] py-2.5 text-end tabular-nums text-ink-600">{h.streak} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelBody>
    </Panel>
  );
}

function MoneyView() {
  const STATS = [
    { label: 'Unbilled time', value: '$975' },
    { label: 'Outstanding', value: '$4,300' },
    { label: 'Paid this month', value: '$6,000' },
    { label: 'Overdue', value: '1' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className={cardClass('px-4 py-3')}>
            <p className="text-caption text-ink-500">{s.label}</p>
            <p className="mt-1 text-title-3 font-medium tabular-nums text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>
      <div className={cardClass('p-5 sm:p-6')}><InvoiceDemo /></div>
    </div>
  );
}

/** The page the sidebar opened, in the frame the app draws around every page. */
function Page({ view, children, aside }: { view: View; children: React.ReactNode; aside?: React.ReactNode }) {
  const date = useToday();
  return (
    <div className="flex min-w-0 flex-1">
      <div className="min-w-0 flex-1">
        <div className="flex h-12 items-center border-b border-line-soft px-6">
          <h2 className="truncate text-ui font-medium text-ink-900">{TITLE[view]}</h2>
          {view === 'today' && date && <span className="ms-2 text-caption text-ink-500">{date}</span>}
        </div>
        {/* Keyed on the view, so a page arrives as the app's pages do: a quiet cross-fade. */}
        <div key={view} className="site-view zb-enter px-6 pb-8 pt-6">{children}</div>
      </div>
      {aside}
    </div>
  );
}

/** ⌘K inside the preview: the product's palette, over the preview only. */
function Palette({ onClose, run }: { onClose: () => void; run: (v: View | 'focus') => void }) {
  return (
    <div className="absolute inset-0 z-[2] grid place-items-start justify-center bg-scrim/40 pt-20" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Command
        loop
        className={cardClass('w-[min(30rem,calc(100%-2rem))] rounded-xl shadow-popover')}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      >
        <CommandInput autoFocus placeholder="Search or jump to…" className="text-ui text-ink-900 placeholder:text-ink-500" aria-label="Search the preview" />
        <CommandList className="max-h-[18rem] p-1">
          <CommandEmpty className="py-6 text-center text-ui text-ink-500">Nothing by that name.</CommandEmpty>
          {NAV.map((n) => (
            <CommandItem key={n.id} value={n.id === 'focus' ? 'Start a focus session' : `Go to ${n.label}`} onSelect={() => run(n.id)} className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-ui text-ink-800 data-[selected=true]:bg-surface-hover data-[selected=true]:text-ink-900">
              <Icon icon={n.icon} size={16} className="text-ink-500" />
              {n.id === 'focus' ? 'Start a focus session' : `Go to ${n.label}`}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}

export function AppDemo({ className }: { className?: string }) {
  const [view, setView] = React.useState<View>('today');
  const [tasks, setTasks] = React.useState(START);
  const [highlightId, setHighlightId] = React.useState('invoice');
  const [palette, setPalette] = React.useState(false);
  const here = React.useRef(false);

  const toggle = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const plan = (id: string, when: Task['when']) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, when } : t)));
  const add = (title: string) => setTasks((ts) => [...ts, { id: `new-${ts.length}`, title, project: 'life', when: 'today', done: false }]);
  const go = (v: View | 'focus') => {
    setPalette(false);
    if (v === 'focus') {
      const hl = tasks.find((t) => t.id === highlightId && !t.done);
      openGuestFocus(hl?.title);
      return;
    }
    setView(v);
  };

  // ⌘K opens the palette while the visitor is IN the preview (the pointer over it, or focus inside it);
  // anywhere else on the page the keys are the browser's.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!here.current || e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setPalette((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const count = (v: View) => (v === 'inbox' ? tasks.filter((t) => t.when === 'inbox').length : v === 'tasks' ? tasks.filter((t) => !t.done && t.when !== 'inbox').length : 0);

  return (
    <div
      role="group"
      aria-label="A working preview of Zenboard"
      className={cn('sheet relative flex min-h-[40rem] w-full overflow-hidden', className)}
      onPointerEnter={() => { here.current = true; }}
      onPointerLeave={() => { here.current = false; }}
      onFocus={() => { here.current = true; }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) here.current = false; }}
    >
      <nav aria-label="Zenboard preview" className="flex w-[14.5rem] shrink-0 flex-col gap-0.5 border-e border-line-soft bg-sidebar px-3 py-4 max-md:hidden">
        <div className="mb-3 px-2"><Logo height={22} /></div>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="focus-ring mb-3 flex h-8 items-center gap-2 rounded-md border border-line bg-surface-raised px-2.5 text-ui text-ink-500 transition-colors duration-[var(--site-hover)] ease-hover hover:text-ink-800"
        >
          <Icon icon={Search} size={14} />
          <span className="flex-1 text-start">Search</span>
          <Kbd keys={['⌘', 'K']} />
        </button>
        {NAV.map((n) => {
          const on = n.id === view;
          const c = n.id === 'focus' ? 0 : count(n.id);
          return (
            <button
              key={n.id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => go(n.id)}
              className={cn(
                'focus-ring flex h-[var(--row-nav)] items-center gap-2.5 rounded-md px-2.5 text-ui transition-colors duration-[var(--site-hover)] ease-hover',
                on ? 'bg-surface-active font-medium text-ink-900' : 'text-ink-700 hover:text-ink-900',
              )}
            >
              <Icon icon={n.icon} size={16} className={on ? 'text-ink-900' : 'text-ink-500'} />
              <span className="flex-1 text-start">{n.label}</span>
              {c > 0 && <span className="text-caption tabular-nums text-ink-500">{c}</span>}
            </button>
          );
        })}
        <p className="mb-1 mt-5 px-2.5 text-caption font-medium text-ink-500">Projects</p>
        {(Object.keys(PROJECTS) as ProjectId[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p === 'ridgeline' ? 'projects' : 'tasks')}
            className="focus-ring flex h-[var(--row-nav)] items-center gap-2.5 rounded-md px-2.5 text-ui text-ink-700 transition-colors duration-[var(--site-hover)] ease-hover hover:text-ink-900"
          >
            <span className={cn('size-2.5 rounded-xs', PROJECTS[p].dot)} />
            <span className="truncate">{PROJECTS[p].name}</span>
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* On a phone the sidebar's places are a row of their own above the page. */}
        <div className="flex gap-1 overflow-x-auto border-b border-line-soft px-3 py-2 md:hidden">
          {NAV.filter((n) => n.id !== 'focus').map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={n.id === view ? 'page' : undefined}
              onClick={() => go(n.id)}
              className={cn('focus-ring shrink-0 rounded-md px-2.5 py-1.5 text-ui', n.id === view ? 'bg-surface-active font-medium text-ink-900' : 'text-ink-600')}
            >
              {n.label}
            </button>
          ))}
        </div>
        <Page view={view} aside={view === 'today' ? <Rail go={go} /> : undefined}>
          {view === 'today' && <TodayView tasks={tasks} highlightId={highlightId} onToggle={toggle} onHighlight={setHighlightId} onAdd={add} name="Alex" />}
          {view === 'inbox' && <InboxView tasks={tasks} onPlan={plan} />}
          {view === 'tasks' && <TasksView tasks={tasks} onToggle={toggle} />}
          {view === 'projects' && <BoardDemo />}
          {view === 'docs' && <div className="mx-auto max-w-[40rem]"><DocDemo /></div>}
          {view === 'calendar' && <TimeboxDemo />}
          {view === 'clients' && <div className="max-w-[40rem]"><PortalView initialSide="you" /></div>}
          {view === 'money' && <MoneyView />}
          {view === 'habits' && <HabitsView />}
        </Page>
      </div>

      {palette && <Palette onClose={() => setPalette(false)} run={go} />}
    </div>
  );
}
