'use client';
// Today — the app home. A single calm scroll column built entirely on real hub
// data: highlights, the day's plan (quick-add + tasks), today's schedule, and
// habits. Each section handles its own empty/error state so one gap never blanks
// the page. Mutations go through shared server actions; lists update optimistically.
//
// Presentation is built on the canonical design system (@/components/ds) — DS
// Panel / Button / IconButton / EmptyState / Icon. B&G monochrome: the page's
// ONE filled primary is the quick-add "Add"; every other control is
// secondary/ghost ink. Type comes off the ds-theme scale (title-2/lead/ui/meta).
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus, Moon, Check, ChevronDown, Play, ChevronRight, EllipsisVertical, X, Folder, Star, Sun, Flame } from "@/components/ds/icons";
import { Button, Icon, IconButton, Mark, EmptyState, TooltipProvider } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { Panel, PanelHeader, PanelBody, FigmaTag } from '@/components/ui/panels';
import { ParsedChips } from '@/components/ui/parsed-chips';
import { ViewContainer } from '@/components/ui/view-container';
import { parseTask, type ChipKind } from '@/lib/task-parse';
import { addTask, toggleTask, setHighlight } from '@/lib/actions/tasks';
import { signalTaskToggle } from '@/lib/sound';
import { TaskRow, fmtDur } from '@/components/tasks/task-row';
import { HabitsSection } from '@/components/today/habits-section';
import { ScheduleSection } from '@/components/today/schedule-section';
import { useViewWidth } from '@/components/shell/view-width';

export type TodayTask = {
  id: string; title: string; done: boolean;
  priority: 'low' | 'med' | 'high'; highlight: boolean;
  estimate_minutes: number | null; elapsed_minutes: number;
  scheduled_date: string | null; project_id: string | null;
  parent_task_id: string | null; completed_at: string | null;
  created_at: string; sort_order: number;
};
export type ProjectChip = { id: string; name: string; color: string | null };
export type TodayHabit = { id: string; title: string; doneToday: boolean; streak: number };
export type TodayEvent = { id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean; source?: string | null };

export function TodayView({
  name, initialTasks, projects, subByParent, initialHabits, events, errors, nowHour,
}: {
  name: string;
  initialTasks: TodayTask[];
  projects: Record<string, ProjectChip>;
  subByParent: Record<string, { done: number; total: number }>;
  initialHabits: TodayHabit[];
  events: TodayEvent[];
  errors: { tasks: boolean; habits: boolean; events: boolean };
  /** Override the current hour to stage the time-of-day phase (§7V). Prod leaves it undefined. */
  nowHour?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { full } = useViewWidth();
  const openTask = (id: string) => router.push(`${pathname}?task=${id}`);

  const [tasks, setTasks] = useState<TodayTask[]>(initialTasks);
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  const [val, setVal] = useState('');
  const [focused, setFocused] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [ignored, setIgnored] = useState<Set<ChipKind>>(new Set());

  // The composer speaks the ONE unified grammar (lib/task-parse) — dates,
  // projects, priority, estimate, recurrence — with chips as confirmation.
  const projectRefs = useMemo(() => Object.values(projects).map((p) => ({ id: p.id, name: p.name })), [projects]);
  const parsed = useMemo(() => parseTask(val, projectRefs, ignored), [val, projectRefs, ignored]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const dayTasks = tasks.filter((t) => t.scheduled_date === todayISO);
  const open = dayTasks.filter((t) => !t.done);
  const done = dayTasks.filter((t) => t.done);
  const highlights = tasks.filter((t) => t.highlight && !t.done).slice(0, 3);

  const estOpen = open.reduce((a, t) => a + (t.estimate_minutes ?? 0), 0);
  // Capacity (§7V): planned focus work + today's meeting load, measured against a
  // working day. When it runs over, the line turns into a quiet Watch nudge —
  // never a red alarm (calm by default).
  const meetingMin = events.reduce((a, e) => (!e.all_day && e.ends_at ? a + Math.max(0, (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000) : a), 0);
  const plannedMin = estOpen + meetingMin;
  const DAY_BUDGET = 8 * 60;
  const overloaded = open.length > 0 && plannedMin > DAY_BUDGET;

  const h = nowHour ?? new Date().getHours();
  const greeting = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const topHighlight = highlights[0] ?? null;

  async function add() {
    const spec = parsed;
    if (!spec.title) return;
    // "Add to today" is the default; an explicit date token (a `when` chip) wins.
    const sched = spec.scheduledDate ?? todayISO;
    setVal('');
    setIgnored(new Set());
    const tempId = 'temp-' + Date.now();
    setTasks((ts) => [...ts, { id: tempId, title: spec.title, done: false, priority: spec.priority ?? 'low', highlight: false, estimate_minutes: spec.estimateMinutes, elapsed_minutes: 0, scheduled_date: sched, project_id: spec.projectId, parent_task_id: null, completed_at: null, created_at: new Date().toISOString(), sort_order: 9999 }]);
    const res = await addTask({
      title: spec.title,
      scheduledDate: sched,
      dueDate: spec.dueDate,
      priority: spec.priority ?? undefined,
      estimateMinutes: spec.estimateMinutes,
      projectId: spec.projectId,
      recurrence: spec.recurrence,
    });
    if ('id' in res) setTasks((ts) => ts.map((t) => (t.id === tempId ? { ...t, id: res.id } : t)));
    else setTasks((ts) => ts.filter((t) => t.id !== tempId));
  }

  async function toggle(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: nextDone, completed_at: nextDone ? new Date().toISOString() : null } : t)));
    signalTaskToggle(nextDone);
    const res = await toggleTask(id, nextDone);
    if ('error' in res) setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !nextDone } : t)));
  }

  async function toggleHl(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextHl = !target.highlight;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, highlight: nextHl } : t)));
    const res = await setHighlight(id, nextHl);
    if ('error' in res) setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, highlight: !nextHl } : t)));
  }

  const chipFor = (t: TodayTask) => (t.project_id ? projects[t.project_id] ?? null : null);

  return (
    <TooltipProvider>
    <ViewContainer full={full} className="pb-[var(--view-pb)] pt-8">
      {/* ── Greeting (Figma 494:12474): mark 24 · title-2 medium ink-800 ·
             ui subtitle with medium ink-800 emphasis · inset 9 vs panels ── */}
      <header className="mb-8 pl-[9px]">
        <div className="mb-2 flex items-center gap-1.5">
          <Mark size={24} />
          <h1 className="text-title-2 leading-none font-medium text-balance text-ink-800">
            {greeting}, {name}.
          </h1>
        </div>
        <p className="text-ui text-ink-500">
          You’ve committed to{' '}
          <b className="font-medium text-ink-800">{open.length} {open.length === 1 ? 'task' : 'tasks'}</b>.
          {topHighlight && (
            <>
              {' '}Highlight:{' '}
              <button
                onClick={() => openTask(topHighlight.id)}
                className="focus-ring rounded-xs font-medium text-ink-800 underline-offset-2 hover:underline"
              >
                {topHighlight.title}.
              </button>
            </>
          )}
        </p>

        {/* Capacity line (§7V): the day's load at a glance; turns into a quiet
            Watch nudge when the plan runs past a working day. */}
        {open.length > 0 && (
          <p className="mt-2 text-ui text-ink-500">
            <span className="tabular-nums text-ink-800">{fmtDur(estOpen)}</span> of focused work
            {meetingMin > 0 && <> plus <span className="tabular-nums text-ink-800">{fmtDur(meetingMin)}</span> in meetings</>}
            {' — '}
            {overloaded
              ? <span className="text-warning-600">that runs past a typical day; consider moving something to tomorrow.</span>
              : <>a manageable day.</>}
          </p>
        )}
      </header>

      {/* ── Shutdown banner (B&G Figma 1:793): flat borderless #1E1E1E wrap ·
             header strip · #303030 inner card with copy + 12%-fill button ── */}
      {bannerOpen && (
        <Panel frame="shadow" className="mb-6">
          <PanelHeader
            icon={<Icon icon={Moon} size={18} />}
            title="Wrap up your day"
            action={<IconButton label="Dismiss" size="sm" icon={<Icon icon={X} size={16} />} onClick={() => setBannerOpen(false)} />}
          />
          <PanelBody>
            <div className="flex w-full items-start justify-between gap-4 p-4">
              {/* ink-500 replaces the old opacity-70 ink-800 — quiet via token, never opacity-faded text */}
              <p className="max-w-[600px] py-1 text-ui font-medium text-ink-500">
                {done.length} done, {open.length} still open. A 3-minute shutdown decides what carries over and lets you actually stop.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                icon={<Icon icon={Moon} size={16} />}
                iconRight={<Icon icon={ChevronRight} size={16} />}
                onClick={() => router.push('/rituals?type=daily_shutdown')}
              >
                Shutdown
              </Button>
            </div>
          </PanelBody>
        </Panel>
      )}

      {/* ── Today's highlight ("Zenboard — design" zb-highlight-card 23:7480):
             Shadow-1 shell · 40px header strip (Fire 18 · Medium 14 ink-500 ·
             kebab p-6) · paper-3 body: p-12 hero row + border-t p-16 actions ── */}
      <section className="mb-8">
        <Panel frame="shadow">
          <PanelHeader
            icon={<Icon icon={Flame} size={18} />}
            title="Today’s highlight — Do this first"
            action={<IconButton label="View all tasks" size="sm" icon={<Icon icon={EllipsisVertical} size={16} />} onClick={() => router.push('/tasks')} />}
          />
          <PanelBody className="relative">
            {!topHighlight ? (
              <EmptyState
                size="inline"
                illustration={<Icon icon={Star} size={20} />}
                title="No priority set"
                description="Star a task to make it today’s focus — it’ll surface here to tackle first."
                primary={<Button variant="secondary" size="sm" onClick={() => router.push('/tasks')}>Browse tasks</Button>}
              />
            ) : (() => {
              const t = topHighlight;
              const chip = chipFor(t);
              return (
                <>
                  <div className="flex w-full flex-col gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => openTask(t.id)}
                        className="focus-ring min-w-0 flex-1 rounded-xs text-left text-lead leading-5 text-ink-700"
                      >
                        {t.title}
                      </button>
                      <IconButton label="Open task" size="sm" className="shrink-0" icon={<Icon icon={EllipsisVertical} size={16} />} onClick={() => openTask(t.id)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {chip && (
                        <FigmaTag icon={<Icon icon={Folder} size={12} weight="fill" style={{ color: chip.color ?? 'var(--yellow-dot)' }} />}>
                          {chip.name}
                        </FigmaTag>
                      )}
                      {t.priority !== 'low' && (
                        <FigmaTag priority={t.priority === 'high' ? 'var(--red-dot)' : 'var(--orange-dot)'}>
                          {t.priority === 'high' ? 'High' : 'Medium'}
                        </FigmaTag>
                      )}
                      {t.estimate_minutes != null && (
                        <span className="ms-1 text-meta tabular-nums text-ink-500">{fmtDur(t.estimate_minutes)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-3 border-t border-line-soft p-4">
                    <Button variant="secondary" icon={<Icon icon={Play} size={16} />} onClick={() => router.push('/focus')}>Start focus</Button>
                    <Button variant="ghost" icon={<Icon icon={Check} size={16} />} onClick={() => toggle(t.id)}>Mark done</Button>
                    <Button variant="ghost" iconRight={<Icon icon={ChevronRight} size={16} />} onClick={() => openTask(t.id)}>Details</Button>
                  </div>
                  {/* Decorative scroll-thumb affordance on the body's right edge (node 23:7249) */}
                  <span aria-hidden className="absolute right-0 bottom-0 flex h-[144px] items-start px-1 py-2">
                    <span className="h-[72px] w-[5px] rounded-full" style={{ background: 'var(--color-surface-selected)' }} />
                  </span>
                </>
              );
            })()}
          </PanelBody>
        </Panel>
      </section>

      {/* ── Today's plan — same framed-panel language, quick-add as the inner
             card's first row ── */}
      <section className="mb-8">
        <Panel frame="shadow">
          <PanelHeader
            icon={<Icon icon={Sun} size={18} />}
            title="Today’s plan"
            count={open.length > 0 ? open.length : undefined}
          />
          <PanelBody>
          {errors.tasks ? (
            <div className="px-4 py-3.5 text-body text-danger-600">Couldn’t load your tasks. Try refreshing.</div>
          ) : (
            <>
              <div
                className={cn(
                  'flex items-center gap-2 border-b border-line-soft py-1 pe-1.5 ps-3.5 transition-colors',
                  focused ? 'bg-surface-row' : 'bg-transparent',
                )}
              >
                <Icon icon={Plus} size={16} className={focused ? 'text-ink-900' : 'text-ink-500'} />
                <input
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder='Add to today — try "Call Sam #acme !high 30m"'
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-body text-ink-900 outline-none placeholder:text-ink-400"
                />
                {parsed.title && (
                  <Button variant="primary" size="sm" onClick={add}>Add</Button>
                )}
              </div>
              {/* Parsed chips — the confirmation layer (§7A). One shared surface. */}
              {parsed.chips.length > 0 && (
                <div className="border-b border-line-soft px-3.5 py-2">
                  <ParsedChips chips={parsed.chips} onDismiss={(k) => setIgnored((s) => new Set(s).add(k))} />
                </div>
              )}
              {open.length === 0 ? (
                <EmptyState
                  size="inline"
                  illustration={<Icon icon={Sun} size={20} />}
                  title="Nothing on the plate"
                  description="Capture a task above to start shaping your day."
                />
              ) : (
                open.map((t, i) => (
                  <TaskRow key={t.id} task={t} sub={subByParent[t.id]} project={chipFor(t)} last={i === open.length - 1}
                    onToggle={() => toggle(t.id)} onOpen={() => openTask(t.id)} onHighlight={() => toggleHl(t.id)}
                    showHighlightBadge={false} showHighlightToggle />
                ))
              )}
            </>
          )}
          </PanelBody>
        </Panel>

        {done.length > 0 && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon={Check} size={16} />}
              iconRight={<Icon icon={ChevronDown} size={16} className={showDone ? 'rotate-180 transition-transform' : 'transition-transform'} />}
              onClick={() => setShowDone((s) => !s)}
            >
              {done.length} completed
            </Button>
            {/* No container opacity — done rows are muted by TaskRow's own token treatment */}
            {showDone && (
              <div className="mt-2 overflow-hidden rounded-md border border-line bg-paper-2">
                {done.map((t, i) => (
                  <TaskRow key={t.id} task={t} sub={subByParent[t.id]} project={chipFor(t)} last={i === done.length - 1}
                    onToggle={() => toggle(t.id)} onOpen={() => openTask(t.id)} showHighlightBadge={false} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Schedule ── */}
      <ScheduleSection initialEvents={events} error={errors.events} />

      {/* ── Habits ── */}
      <HabitsSection initialHabits={initialHabits} error={errors.habits} />
    </ViewContainer>
    </TooltipProvider>
  );
}
