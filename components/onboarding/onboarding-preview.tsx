'use client';
// ── WHAT YOU ARE BUILDING, WHILE YOU BUILD IT ──────────────────────────────
//
// The reference the user sent (Adaline, 2026-09-24) puts the product beside the form and lets it
// answer what you type. Zenboard's version goes further, because Zenboard's onboarding does not
// collect facts — it BUILDS the first day (a project, today's tasks, the first one starred, a
// day-end time). So the preview is Home itself, drawn with the app's own Panel, rows, checkbox and
// star, filling in as the answers arrive. Nothing here is a mock-up of a component: it is the
// component, holding what you just typed, which is why it cannot drift from the product.
//
// ── IT IS THE APP, IN ITS COLLAPSED FORM (2026-09-25) ──────────────────────
// User, with a screenshot of the real Tasks screen: "we can use this collapsed view on half on
// onboarding and real time updating according to client input". Two decisions in one line, and
// both are right:
//
//   · A column of panels is not a product. The preview wears the app's CHROME now — the icon rail
//     and the header row — so what is beside the questions is recognisably Zenboard.
//   · It wears the COLLAPSED rail, not the full sidebar, because this half is narrow and the thing
//     that has to be readable here is the part that changes as you type. The app already has this
//     state and its own width token (`--sidebar-w-collapsed`); the preview borrows it rather than
//     inventing a narrow sidebar of its own.
//
// Drawn from the app's TOKENS rather than by importing AppShell: the real shell carries the
// router, the workspace and every module, and none of that belongs in the bundle of a screen you
// see once. The tokens are the shared source of truth.
//
// It is furniture: `aria-hidden`, no pointer events, no tab stop. A screen reader hears the form.
import { Sun, Flame, Moon, Folder, Highlight, Check, Users, Wallet, FileText, Calendar as CalendarIcon } from '@/components/ds/icons';
import { Icon, Mark, Checkbox, Panel, PanelHeader, PanelBody, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export type PreviewState = {
  step: number;
  name: string;
  role: string | null;
  projectName: string;
  tasks: string[];
  dayEnd: string;
  /** The hour, from the SERVER. Reading the clock during render makes the server and the client
   *  disagree about the time of day, and React throws the whole tree away — this preview blanked
   *  the page exactly that way. Home has always taken the hour as a prop for this reason
   *  (`today-view.tsx`); the rule is one rule. */
  nowHour?: number;
};

/** The greeting Home opens with, in Home's own words. */
function greeting(name: string, nowHour?: number) {
  const h = nowHour ?? 9;
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}${name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}.`;
}

const ROW = 'flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)]';

/** The rail's places, in the app's own order. Home is where a new account lands. */
const RAIL = [
  { icon: Sun, label: 'Home', here: true },
  { icon: Check, label: 'Tasks' },
  { icon: CalendarIcon, label: 'Calendar' },
  { icon: Folder, label: 'Projects' },
  { icon: Users, label: 'Clients' },
  { icon: Wallet, label: 'Finance' },
  { icon: FileText, label: 'Documents' },
];

export function OnboardingPreview({ state }: { state: PreviewState }) {
  const { step, name, projectName, tasks, dayEnd, nowHour } = state;
  const filled = tasks.map((t) => t.trim()).filter(Boolean);
  const rows = filled;
  const initial = name.trim() ? name.trim()[0].toUpperCase() : 'Z';

  return (
    <aside
      aria-hidden
      // The DESK, and the app lying on it: the questions are the page, and this is the one
      // thing raised beside them. It runs off the right and the bottom of the window, because
      // you are looking at part of a screen.
      className="relative hidden min-w-0 overflow-hidden ps-2 pt-10 select-none lg:block"
    >
      {/* The app at a real measure, anchored left, so the sheet cuts the window rather than
          shrinking it. */}
      {/* The same composition as the sign-up still: the app at its real measure, scaled up from
          the top-left and cut by the window, so first run and sign-up are one screen in two
          halves. A little less scale here (1.2 against 1.3), because this half has a job beyond
          looking like the product: what you type has to stay readable in it. */}
      <div
        className="pointer-events-none absolute inset-y-0 start-2 top-10 flex w-[860px] origin-top-left gap-[var(--app-gutter)]"
        style={{ transform: 'scale(1.2)' }}
        tabIndex={-1}
      >
        {/* ── The rail, collapsed ── one 32px square per place, the current one washed. */}
        {/* Each pane is THE card recipe — the app's panels are cards lying on the desk, and a
            picture of them that spells its own edge and fill would drift the moment the card does. */}
        <nav
          className={cardClass('flex shrink-0 flex-col items-center gap-1 py-2')}
          style={{ width: 'var(--sidebar-w-collapsed)' }}
        >
          <span className="grid h-[var(--row-nav)] w-[var(--row-nav)] place-items-center">
            <Mark size={20} tone="brand" />
          </span>
          <span className="my-1 h-px w-6 bg-line" />
          {RAIL.map((r) => (
            <span
              key={r.label}
              className={cn(
                'grid h-[var(--row-nav)] w-[var(--row-nav)] place-items-center rounded-sm',
                r.here ? 'bg-surface-selected text-ink-900' : 'text-ink-600',
              )}
            >
              <Icon icon={r.icon} size={16} weight={r.here ? 'fill' : undefined} />
            </span>
          ))}
          <span className="flex-1" />
          <span className="grid size-6 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-[var(--on-accent)]">
            {initial}
          </span>
        </nav>

        {/* ── The page ── */}
        <div className={cardClass('flex min-w-0 flex-1 flex-col')}>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
            <span className="text-ui font-medium text-ink-900">Today</span>
            <span className="flex-1" />
            <span className="rounded-md bg-surface-sunken px-2 py-1 text-caption text-ink-500">⌘K</span>
          </div>

          <div className="min-w-0 flex-1 px-7 pt-7">
            {/* The greeting: their name is in it from the first keystroke. */}
            <div className="mb-5 flex items-center gap-1.5">
              <Mark size={22} />
              <p className="font-editorial text-title-2 leading-none font-medium text-ink-800">{greeting(name, nowHour)}</p>
            </div>
            <p className="-mt-3 mb-5 text-ui text-ink-500">
              {rows.length
                ? <>You’ve committed to <b className="font-medium text-ink-800">{rows.length} {rows.length === 1 ? 'task' : 'tasks'}</b> today.</>
                : 'Your day, as soon as you tell it what you are working on.'}
            </p>

            {/* Today's plan: the tasks they are typing, in the row the app really draws. */}
            <Panel frame="shadow">
              <PanelHeader
                icon={<Icon icon={Sun} size={20} />}
                title="Today’s plan"
                count={rows.length || undefined}
              />
              <PanelBody>
                {rows.length === 0 ? (
                  <div className={cn(ROW, 'text-ui text-ink-500')}>Your plan for the day lands here</div>
                ) : (
                  rows.map((t, i) => (
                    <div key={`${t}-${i}`} className={cn(ROW, i < rows.length - 1 && 'border-b border-line-soft')}>
                      <Checkbox checked={false} tabIndex={-1} />
                      <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{t}</span>
                      {projectName.trim() && (
                        <span className="flex shrink-0 items-center gap-1 text-caption text-ink-500">
                          <Icon icon={Folder} size={12} />{projectName.trim()}
                        </span>
                      )}
                      {/* The first one is the highlight, which is exactly what `finish()` writes. */}
                      {i === 0 && <Icon icon={Highlight} size={14} weight="fill" className="shrink-0 text-[var(--accent)]" />}
                    </div>
                  ))
                )}
              </PanelBody>
            </Panel>

            {/* The day's end only appears on the step that asks for it: the preview follows the
                question, so the screen is never explaining something you are not being asked. */}
            {step >= 2 && (
              <div className="mt-5">
                <Panel frame="shadow">
                  <PanelHeader icon={<Icon icon={Moon} size={20} />} title="Shutdown" summary={`Around ${dayEnd}`} />
                  <PanelBody>
                    <div className={cn(ROW, 'gap-2 text-ui text-ink-700')}>
                      <Icon icon={Flame} size={16} className="text-ink-500" />
                      Three minutes to close the day
                    </div>
                  </PanelBody>
                </Panel>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
