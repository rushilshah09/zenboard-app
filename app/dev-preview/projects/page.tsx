'use client';
// Dev-only harness for the Projects hub — staged project + unbilled time logs so
// the Time tab's "Create invoice" affordance and its optimistic billed-move can
// be verified without a session. The server action errors without auth (that's
// expected here); the UI affordance + optimistic state are what's under test.
// 404s in prod.
import { notFound } from 'next/navigation';
import { ProjectsWorkspace, type PProject, type PTask, type PTime, type PRequest, type PRequestMessage, type PApproval, type PDoc, type PActivity, type PSection } from '@/components/projects/projects-workspace';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();
const todayPlus = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

const PROJECTS: PProject[] = [
  { id: 'p1', name: 'Balluji rebrand', color: '#9A1B6F', status: 'active', client_id: 'c1', created_at: daysAgo(30), updated_at: daysAgo(1) },
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

const SECTIONS: PSection[] = [
  { id: 's1', project_id: 'p1', name: 'Discovery', sort_order: 0 },
  { id: 's2', project_id: 'p1', name: 'Design', sort_order: 1 },
];

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
];

const APPROVALS: PApproval[] = [
  { id: 'ap1', project_id: 'p1', page_id: 'pg1', title: 'Logo — final direction', status: 'awaiting', note: null, created_at: daysAgo(1) },
  { id: 'ap2', project_id: 'p1', page_id: 'pg2', title: 'Brand guidelines v1', status: 'changes_requested', note: 'Love it — can the accent be a touch warmer, and add a mono logo variant?', created_at: daysAgo(2) },
];

export default function ProjectsPreviewPage() {
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
        sectionsSupported
        portalSupported
        activitySupported
        weekStart={daysAgo(7)}
        initialProjectId="p1"
        initialTab="tasks"
      />
    </div>
  );
}
