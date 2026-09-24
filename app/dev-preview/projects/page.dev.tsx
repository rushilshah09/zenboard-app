'use client';
// Dev-only harness for the Projects hub — staged project + unbilled time logs so
// the Time tab's "Create invoice" affordance and its optimistic billed-move can
// be verified without a session. The server action errors without auth (that's
// expected here); the UI affordance + optimistic state are what's under test.
// 404s in prod.
import { notFound } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';
import type { PropLayout } from '@/lib/property-layout';
import { Toaster } from '@/components/ds/ui';
import { ProjectsWorkspace, type PMilestone, type PProject, type PTask, type PTime, type PRequest, type PRequestMessage, type PApproval, type PDoc, type PActivity, type PSection } from '@/components/projects/projects-workspace';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
// A milestone's `due_date` is a CALENDAR date, not an instant — so this must not
// be `daysAgo(...).slice(0,10)`, which is the UTC date (lib/date.ts). Built from
// local parts, like `localISODate`.
const dayOffset = (n: number) => {
  const d = new Date(Date.now() + n * 86400_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const todayPlus = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

// Share switches chosen so all three states of the client-facing control are
// on screen at once: Open tasks ON (a marked open task reads "Client"),
// Completed tasks OFF (a marked completed task reads marked-but-blocked), and
// everything unmarked reads "Internal".
const PROJECTS: PProject[] = [
  {
    id: 'p1', name: 'Balluji rebrand', color: '#9A1B6F', status: 'active', client_id: 'c1',
    created_at: daysAgo(30), updated_at: daysAgo(1),
    portal_enabled: true, portal_token: 'demoPortalToken12345',
    share_progress: true, share_open_tasks: true, share_completed_tasks: false,
    share_timeline: true, share_files: true, share_invoices: false, allow_requests: true,
  },
];

const mkTask = (id: string, title: string, over: Partial<PTask> = {}): PTask => ({
  id, title, done: false, priority: 'med', estimate_minutes: null, elapsed_minutes: 0,
  scheduled_date: null, highlight: false, completed_at: null, project_id: 'p1',
  parent_task_id: null, created_at: daysAgo(5), ...over,
});
const TASKS: PTask[] = [
  mkTask('t1', 'Finalize primary logotype', { highlight: true, scheduled_date: todayPlus(2), section_id: 's2' }),
  mkTask('t2', 'Dark-mode logo variants', { priority: 'high', scheduled_date: todayPlus(5), section_id: 's2' }),
  mkTask('t3', 'Stakeholder interviews', { section_id: 's1', scheduled_date: todayPlus(-3) }),
  mkTask('t4', 'Color palette accessibility pass', { done: true, completed_at: daysAgo(2) }),
  mkTask('t5', 'Kickoff notes shared with client', { done: true, completed_at: daysAgo(9) }),
];

// One client-facing workstream and one internal one — the whole point of 0040,
// and the pair that proves the header chip has two states.
// Staged so all three of 0040's columns are on screen at once: one stream
// dated and running, one dated and PAUSED, one with no date at all — which is
// the state the "Add a date" affordance has to be discoverable from.
const SECTIONS: PSection[] = [
  { id: 's1', project_id: 'p1', name: 'Discovery', sort_order: 0, client_visible: false, due_date: dayOffset(-2), status: null },
  { id: 's2', project_id: 'p1', name: 'Design', sort_order: 1, client_visible: true, due_date: dayOffset(9), status: null },
  { id: 's3', project_id: 'p1', name: 'Motion', sort_order: 2, client_visible: false, due_date: null, status: 'paused' },
];

// Which tasks the owner has pointed at the client. t4 is COMPLETED and marked,
// but the completed-tasks channel is off above — so it is the "you said share
// this and nothing is happening" case the chip has to make visible.
const TASK_VISIBLE: Record<string, boolean> = { t1: true, t4: true };

const ACTIVITY: PActivity[] = [
  { id: 'a1', project_id: 'p1', type: 'note', body: 'Client approved the primary mark. Waiting on their team to confirm the dark-mode direction before I finalize the guidelines — expecting word by Friday.', created_at: daysAgo(1) },
  { id: 'a2', project_id: 'p1', type: 'note', body: 'Sent the first logotype round.', created_at: daysAgo(6) },
];

const TIMES: PTime[] = [
  { id: 'te1', project_id: 'p1', task_id: null, minutes: 120, started_at: daysAgo(6), billed: false },
  { id: 'te2', project_id: 'p1', task_id: null, minutes: 90, started_at: daysAgo(4), billed: false },
  { id: 'te3', project_id: 'p1', task_id: null, minutes: 45, started_at: daysAgo(2), billed: false },
  { id: 'te4', project_id: 'p1', task_id: null, minutes: 60, started_at: daysAgo(12), billed: true },
];

const mkReq = (over: Partial<PRequest> & Pick<PRequest, 'id' | 'body' | 'status'>): PRequest => ({
  project_id: 'p1', name: 'Priya (Balluji)', title: null, client_id: 'c1', task_id: null,
  resolution_note: null, created_at: daysAgo(1), ...over,
});
const REQUESTS: PRequest[] = [
  mkReq({ id: 'r1', body: 'Can we add a dark-mode version of the logo?\nOur app is going dark-first next quarter.', status: 'pending', created_at: daysAgo(0) }),
  mkReq({ id: 'r2', body: 'Could you send the updated brand colors as a swatch file?', status: 'needs_info', created_at: daysAgo(1) }),
  mkReq({ id: 'r3', body: 'Please prioritize the dark-mode logo variants for our launch.', status: 'approved', task_id: 't2', created_at: daysAgo(3) }),
  mkReq({ id: 'r4', body: 'Can we also do a full packaging design system?', status: 'declined', resolution_note: 'That’s outside the rebrand scope — happy to quote it as a separate project once this ships.', created_at: daysAgo(5) }),
];

const MESSAGES: PRequestMessage[] = [
  { id: 'm1', request_id: 'r2', author: 'team', body: 'Happy to — which screens is this for, and do you have hex values in mind?', client_facing: true, created_at: daysAgo(1) },
  { id: 'm2', request_id: 'r3', author: 'team', body: 'Scoped into the dark-mode task — variants Thursday.', client_facing: false, created_at: daysAgo(2) },
];

const DOCS: PDoc[] = [
  { id: 'pg1', project_id: 'p1', title: 'Logo — final direction', type: 'doc', client_visible: true, updated_at: daysAgo(1) },
  { id: 'pg2', project_id: 'p1', title: 'Brand guidelines v1', type: 'doc', client_visible: true, updated_at: daysAgo(2) },
  { id: 'pg3', project_id: 'p1', title: 'Internal scope notes', type: 'doc', client_visible: false, updated_at: daysAgo(4) },
  // A CONTENT piece made from this project (the close-out offers exactly
  // this). It carries `project_id`, so the loader returns it here — and
  // until 2026-09-09 the Docs tab rendered it as though it were a document.
  // The fixture had no `content` row, which is why nobody saw it.
  { id: 'pg4', project_id: 'p1', title: 'Balluji rebrand — case study', type: 'content', client_visible: false, updated_at: daysAgo(3) },
];

const APPROVALS: PApproval[] = [
  { id: 'ap1', project_id: 'p1', page_id: 'pg1', title: 'Logo — final direction', status: 'awaiting', note: null, created_at: daysAgo(1) },
  { id: 'ap2', project_id: 'p1', page_id: 'pg2', title: 'Brand guidelines v1', status: 'changes_requested', note: 'Love it — can the accent be a touch warmer, and add a mono logo variant?', created_at: daysAgo(2) },
];


// §7E milestones, one per state so the Overview's ordering and the single
// colour (overdue) can both be checked at a glance.
const MILESTONES: PMilestone[] = [
  { id: 'm1', project_id: 'p1', title: 'Design sign-off', done: false, due_date: dayOffset(-3), sort_order: 0 },
  { id: 'm2', project_id: 'p1', title: 'Beta to client', done: false, due_date: dayOffset(0), sort_order: 1 },
  { id: 'm3', project_id: 'p1', title: 'Public launch', done: false, due_date: dayOffset(12), sort_order: 2 },
  { id: 'm4', project_id: 'p1', title: 'Retro written up', done: false, due_date: null, sort_order: 3 },
  { id: 'm5', project_id: 'p1', title: 'Kickoff call', done: true, due_date: dayOffset(-20), sort_order: 4 },
];

// `?hidden=started,sharing` previews an arranged header. The layout is a
// per-person preference the server reads off the profile; this harness has no
// session, so the URL stands in for it. Read through useSyncExternalStore with an
// empty SERVER snapshot, so hydration matches the server's markup and the
// arrangement lands one render later — the hydration-safe way to read `location`
// in a component that is server-rendered first. Saving still fails here (no
// auth), which is itself worth seeing: the toast, and the revert.
const noSubscribe = () => () => {};
function usePreviewLayout(): PropLayout {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => '');
  return useMemo(() => ({
    order: [],
    hidden: new URLSearchParams(search).get('hidden')?.split(',').filter(Boolean) ?? [],
  }), [search]);
}

export default function ProjectsPreviewPage() {
  const propertyLayout = usePreviewLayout();
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)', overflow: 'hidden' }}>
      <ProjectsWorkspace
        projects={PROJECTS}
        tasks={TASKS}
        times={TIMES}
        requests={REQUESTS}
        messages={MESSAGES}
        approvals={APPROVALS}
        docs={DOCS}
        activity={ACTIVITY}
        sections={SECTIONS}
        // The linked client's name, as the loader supplies it. Without it the
        // header falls back to "Linked" — the other state worth seeing.
        clientNames={{ c1: 'Balluji Foods' }}
        sectionsSupported
        iconSupported
        taskVisible={TASK_VISIBLE}
        milestones={MILESTONES}
        milestonesSupported
        portalSupported
        activitySupported
        propertyLayout={propertyLayout}
        initialProjectId="p1"
      />
      {/* Its own <Toaster/>, because dev-preview pages render OUTSIDE AppShell,
          which owns the app's single one. Without it every toast this harness
          raises is invisible — including the one that says a property
          arrangement failed to save, which is the only way that failure is
          ever reported. */}
      <Toaster />
    </div>
  );
}
