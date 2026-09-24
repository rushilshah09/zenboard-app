// What Zenboard does automatically — master plan §7P, the doctrine page's data.
//
// ── WHY THIS IS A FILE AND NOT A LIST IN A COMPONENT ────────────────────────
// §7P's promise is that every automatic behaviour is "built, documented,
// toggleable, with visible provenance" — and that there is **no rule builder**,
// because automation builders create haunted houses: rules someone wrote in
// March firing mysteriously in November. The deal Zenboard offers instead is
// that the list of things it does behind your back is short, fixed, and
// written down.
//
// A promise like that is only kept if the written-down list is TRUE. The
// version this replaced was not: it listed four §7Q *clerk* moments (triage
// suggestions, drafts, Recall, digest) under an §7P heading and marked every
// one "Planned" — including the morning digest, which had shipped that morning,
// and while six behaviours that really do run were not mentioned at all.
//
// So the list lives here, next to the code it describes, and every entry names
// the function that implements it. When a behaviour moves, the reference moves
// with it; when one is added, this file is the obvious place it is missing from.
//
// ── STATUS IS THREE-VALUED ON PURPOSE ───────────────────────────────────────
// `gated` is not a synonym for planned. A gated behaviour is fully built and
// runs the moment its migration is applied — telling someone it is "planned"
// would be as wrong as telling them it is on. The app already knows the
// difference (that is what the capability probes are for); this makes the
// doctrine page know it too.

export type AutomationStatus =
  /** Built, always on. */
  | 'on'
  /** Built, waiting on a migration — runs by itself once applied. */
  | 'gated'
  /** Not built. Named here because §7P says the roadmap is part of the promise. */
  | 'planned';

export type Automation = {
  id: string;
  title: string;
  /** What sets it off, in the user's words — never "on task.update". */
  trigger: string;
  /** What it does, and what it deliberately does NOT do. */
  body: string;
  status: AutomationStatus;
  /** The migration a `gated` one waits for. */
  needs?: string;
  /**
   * The FILE the behaviour lives in — paths only, so a test can walk them and
   * fail when one moves. Function names go in `fn`; mixing the two into one
   * string is what made the first version of that test unable to check itself.
   */
  source: string;
  /** The entry point inside `source`, when naming it helps a reader. */
  fn?: string;
};

/**
 * §7P's designed behaviours, in the order the plan lists them.
 *
 * Every `on` entry below was verified against the code on 2026-08-06 — the
 * point of this file is that it is not a wish list.
 */
export const AUTOMATIONS: Automation[] = [
  {
    id: 'recurrence',
    title: 'Repeating tasks',
    trigger: 'When you complete one',
    body: 'The next occurrence appears with its dates moved on. Only ever one ahead — Zenboard never fills your calendar with a year of copies, and never back-fills the ones you missed.',
    status: 'on',
    source: 'lib/recurrence.ts · lib/actions/tasks.ts',
    fn: 'nextOccurrence',
  },
  {
    id: 'request-accept',
    title: 'Client requests become tasks',
    trigger: 'When you approve one in the portal',
    body: 'The request turns into a task on that project and stays linked to the thread, so the client can see it moving without you telling them.',
    status: 'on',
    source: 'lib/actions/portal.ts',
    fn: 'approveRequest',
  },
  {
    id: 'timebox-twin',
    title: 'Timeboxes and their tasks stay in step',
    trigger: 'When you drag a task onto the calendar',
    body: 'The block and the task are two views of one thing: finish either and both are done. Twins never sync out to Google — they are your plan, not a meeting.',
    status: 'gated',
    needs: '0030',
    source: 'lib/actions/timebox.ts · lib/timebox.ts',
    fn: 'timeboxTask',
  },
  {
    id: 'closeout',
    title: 'Closing a project asks the two questions',
    trigger: 'When you mark a project complete',
    body: 'Unbilled time gets one prompt before it disappears, and you get one line to say how it went. Neither is required.',
    status: 'on',
    source: 'components/projects/projects-workspace.tsx',
  },
  {
    id: 'goal-rollup',
    title: 'Goals settle at review time',
    trigger: 'When you start the weekly review',
    body: 'Progress is recomputed from the work actually linked to each goal — once, at review, rather than a number that twitches all week.',
    status: 'on',
    source: 'lib/goal-rollup.ts · lib/actions/goals.ts',
    fn: 'recomputeGoalProgress',
  },
  {
    id: 'reminders',
    title: 'Reminders arrive once',
    trigger: 'At the time you set',
    body: 'Whether Zenboard is open or closed, and no matter how many tabs or devices you have, exactly one of them tells you.',
    status: 'gated',
    needs: '0031',
    source: 'lib/reminders.ts · app/api/cron/reminders',
  },
  {
    id: 'digest',
    title: 'Morning digest',
    trigger: 'Once a morning, if you switch it on',
    body: 'Today, what is late, and anything your clients sent overnight — in one email, and none at all on a morning with nothing to say.',
    status: 'on',
    source: 'lib/digest.ts · app/api/cron/digest',
  },
  {
    id: 'acceptance',
    title: 'An accepted proposal starts the work',
    trigger: 'When a client signs',
    body: 'The signature is recorded as a fact, and the project and its first invoice follow from it.',
    status: 'gated',
    needs: '0034',
    source: 'lib/actions/acceptance.ts',
  },
  {
    id: 'invoice-reminders',
    title: 'Invoice nudges to the client',
    trigger: 'When an invoice goes past due',
    body: 'A polite reminder on a schedule you choose, addressed to them rather than to you — chasing is the part of freelancing everyone hates.',
    status: 'planned',
    source: 'lib/money.ts',
  },
];

/** The clerk (§7Q) — a different doctrine, and deliberately listed apart. */
export const CLERK_MOMENTS: { title: string; body: string }[] = [
  { title: 'Filing suggestions', body: 'New captures get a suggested list — as a suggestion you confirm, never a silent move.' },
  { title: 'Drafts at six defined moments', body: 'A follow-up after a meeting, an invoice from logged time — drafted for your review, never sent.' },
  { title: 'Recall in the command bar', body: 'Ask “what did I decide about this?” and get the answer with a link to where you said it.' },
];

export const STATUS_LABEL: Record<AutomationStatus, string> = {
  on: 'On',
  gated: 'Ready',
  planned: 'Planned',
};

/** How many of the designed behaviours are actually running right now. */
export function liveCount(list: Automation[] = AUTOMATIONS): number {
  return list.filter((a) => a.status === 'on').length;
}
