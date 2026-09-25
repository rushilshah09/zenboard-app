'use client';
// ── WHAT YOU ARE BUILDING, WHILE YOU BUILD IT ──────────────────────────────
//
// The reference the user sent (Adaline, 2026-09-24) puts the product beside the form and lets it
// answer: type your name and a "Name — Alex Smith" card appears in the app behind the questions;
// add a photo and it lands in that card. The form stops being a form and becomes a first use.
//
// Zenboard's version goes further, because Zenboard's onboarding does not collect facts — it
// BUILDS the first day (a project, today's tasks, the first one starred, a day-end time). So the
// preview is Home itself, drawn with the app's own Panel, rows, checkbox and star, filling in as
// the answers arrive. Nothing here is a mock-up of a component: it is the component, holding what
// you just typed, which is why it cannot drift from the product.
//
// It is furniture: `aria-hidden`, no pointer events, no tab stop. A screen reader hears the form.
import { Sun, Flame, Moon, Folder, Highlight } from '@/components/ds/icons';
import { Icon, Checkbox, Panel, PanelHeader, PanelBody } from '@/components/ds/ui';
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

export function OnboardingPreview({ state }: { state: PreviewState }) {
  const { step, name, projectName, tasks, dayEnd, nowHour } = state;
  const filled = tasks.map((t) => t.trim()).filter(Boolean);
  // Placeholders are the SHAPE of the answer, never a fake answer: they sit at the quiet ink so a
  // glance can tell what is theirs and what is still waiting.
  const rows = filled.length ? filled : [];

  return (
    <aside aria-hidden
      className="relative hidden min-w-0 select-none items-center justify-center overflow-hidden border-s border-line bg-background px-10 lg:flex">
      <div className="pointer-events-none flex w-full max-w-[460px] flex-col gap-4">
        {/* The greeting — it has their name in it from the first keystroke. */}
        <div className="px-1">
          <p className="text-title-3 font-medium text-ink-900">{greeting(name, nowHour)}</p>
          <p className="mt-1 text-ui text-ink-500">
            {rows.length
              ? `${rows.length} ${rows.length === 1 ? 'thing' : 'things'} on today’s plan.`
              : 'Your day, as soon as you tell it what you are working on.'}
          </p>
        </div>

        {/* Today's plan — the tasks they are typing, in the row the app really draws. */}
        <Panel frame="shadow">
          <PanelHeader
            icon={<Icon icon={Sun} size={20} />}
            title="Today’s plan"
            count={rows.length || undefined}
          />
          <PanelBody>
            {rows.length === 0 ? (
              <div className={cn(ROW, 'text-ui text-ink-500')}>Nothing here yet</div>
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
                  {/* The first one is the highlight — which is exactly what `finish()` writes. */}
                  {i === 0 && <Icon icon={Highlight} size={14} weight="fill" className="shrink-0 text-[var(--accent)]" />}
                </div>
              ))
            )}
          </PanelBody>
        </Panel>

        {/* The day's end only appears on the step that asks for it — the preview follows the
            question, so the screen is never explaining something you are not being asked. */}
        {step >= 2 && (
          <Panel frame="shadow">
            <PanelHeader icon={<Icon icon={Moon} size={20} />} title="Shutdown" summary={`Around ${dayEnd}`} />
            <PanelBody>
              <div className={cn(ROW, 'gap-2 text-ui text-ink-700')}>
                <Icon icon={Flame} size={16} className="text-ink-500" />
                Three minutes to close the day
              </div>
            </PanelBody>
          </Panel>
        )}
      </div>
    </aside>
  );
}
