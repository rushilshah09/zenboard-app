// Automations — the doctrine page (MASTER_PRODUCT_PLAN §7P): Zenboard ships
// named, designed behaviors instead of an automation builder. This page is the
// living list of everything the app does on its own, and the promises about
// what it never will. Static content, standard reading column; the top bar
// titles the route, so no in-page h1.

const BEHAVIORS: { name: string; what: string; where: string }[] = [
  {
    name: 'Repeating tasks',
    what: 'Completing a repeating task schedules the next occurrence — once. "every" keeps a fixed cadence ("every friday" stays on Fridays, even if you finish late); "every!" restarts the count from the day you finished. Missed days are never back-filled, so an overdue repeat never stacks.',
    where: 'The repeat chip on the task',
  },
  {
    name: 'Invoices settle themselves',
    what: 'Recording a payment that covers the balance marks the invoice paid. Partial payments leave it outstanding with the remaining balance shown.',
    where: 'Finance, on the invoice',
  },
  {
    name: 'Billed time leaves Unbilled',
    what: 'When time entries become invoice lines, those entries are marked billed — the Unbilled number is always exactly the work you have not invoiced yet.',
    where: 'Finance overview',
  },
  {
    name: 'Overdue is computed, not flipped',
    what: 'A sent invoice past its due date reads as overdue. No status changes behind your back — it is the same invoice, read honestly against today.',
    where: 'Finance, invoice list and detail',
  },
  {
    name: 'Project changes log themselves',
    what: 'Changing a project’s status writes a line into that project’s activity, so the record of an engagement stays complete without note-taking.',
    where: 'Project overview, activity',
  },
];

const NEVERS: { name: string; what: string }[] = [
  {
    name: 'No automatic rollover',
    what: 'Unfinished tasks stay where they are. The evening shutdown asks what to do with each one — reschedule, move to tomorrow, or drop.',
  },
  {
    name: 'No auto-scheduling',
    what: 'Nothing places work on your calendar or plans your day for you. You put things where they go; Zenboard makes placing them effortless.',
  },
  {
    name: 'No silent AI',
    what: 'AI in Zenboard suggests and drafts. It never creates, files, schedules, or sends anything without a tap from you.',
  },
  {
    name: 'No rules builder',
    what: 'There is no trigger-and-action builder to set up in March and be haunted by in November. When a real pattern shows up, we design the behavior, name it, and ship it to everyone — on this page.',
  },
];

const sectionLabel = 'text-caption font-medium tracking-[0.02em] text-ink-500';

export function AutomationsView() {
  return (
    <div style={{ padding: 'var(--view-pt) var(--view-px) var(--view-pb)', maxWidth: 680, margin: '0 auto' }}>
      <p className="text-body-lg text-ink-800 text-pretty" style={{ maxWidth: '58ch' }}>
        Zenboard has no automation builder. It ships a small set of designed
        behaviors — each one named, documented here, and visible in the thing it
        touched.
      </p>

      <section className="mt-8">
        <div className={sectionLabel}>What happens on its own</div>
        <div className="mt-2">
          {BEHAVIORS.map((b) => (
            <div key={b.name} className="border-t border-line-soft py-4 first:border-t-0">
              <div className="text-body font-medium text-ink-800">{b.name}</div>
              <p className="text-body text-ink-500 mt-1 text-pretty" style={{ maxWidth: '62ch' }}>{b.what}</p>
              <div className="text-caption text-ink-500 mt-1.5">Shown in: {b.where}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className={sectionLabel}>What never happens on its own</div>
        <div className="mt-2">
          {NEVERS.map((n) => (
            <div key={n.name} className="border-t border-line-soft py-4 first:border-t-0">
              <div className="text-body font-medium text-ink-800">{n.name}</div>
              <p className="text-body text-ink-500 mt-1 text-pretty" style={{ maxWidth: '62ch' }}>{n.what}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
