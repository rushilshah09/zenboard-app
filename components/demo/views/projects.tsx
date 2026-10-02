'use client';
// Projects: the product's own Projects workspace, open on the Ridgeline rebrand — its workstreams, the
// tasks on its board, what the client asked for, what is waiting on their sign-off, the time not yet
// billed, and the portal they see. The other projects sit in the list beside it.
import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  ProjectsWorkspace, type PActivity, type PApproval, type PDoc, type PMilestone, type PProject, type PRequest,
  type PRequestMessage, type PSection, type PTask, type PTime,
} from '@/components/projects/projects-workspace';
import { dayFromToday } from '../fixtures';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function data() {
  const project = (id: string, name: string, color: string, client: string | null, over: Partial<PProject> = {}): PProject => ({
    id, name, color, status: 'active', client_id: client, created_at: daysAgo(40), updated_at: daysAgo(1), ...over,
  });
  const projects: PProject[] = [
    project('p-ridgeline', 'Ridgeline rebrand', 'plum', 'c-ridgeline', {
      deadline: dayFromToday(30), deadline_label: 'Launch',
      portal_enabled: true, portal_token: 'demo-ridgeline-portal',
      share_progress: true, share_open_tasks: true, share_completed_tasks: true, share_timeline: true, share_files: true, share_invoices: true, allow_requests: true,
    }),
    project('p-beacon', 'Beacon Health site', 'blue', 'c-beacon', { deadline: dayFromToday(12), deadline_label: 'Beta' }),
    project('p-copper', 'Copper Row menus', 'amber', 'c-copper'),
    project('p-life', 'Life', 'sage', null),
  ];
  const task = (id: string, project_id: string, title: string, over: Partial<PTask> = {}): PTask => ({
    id, title, done: false, priority: 'med', estimate_minutes: null, elapsed_minutes: 0, scheduled_date: null, highlight: false,
    completed_at: null, project_id, parent_task_id: null, created_at: daysAgo(8), ...over,
  });
  const tasks: PTask[] = [
    task('t-interviews', 'p-ridgeline', 'Stakeholder interviews', { section_id: 's-discovery', done: true, completed_at: daysAgo(12) }),
    task('t-audit', 'p-ridgeline', 'Brand audit', { section_id: 's-discovery', done: true, completed_at: daysAgo(9) }),
    task('t-routes', 'p-ridgeline', 'Three logo routes', { section_id: 's-design', done: true, completed_at: daysAgo(5) }),
    task('t-logo', 'p-ridgeline', 'Finish the logo presentation', { section_id: 's-design', estimate_minutes: 120, elapsed_minutes: 35, scheduled_date: dayFromToday(0) }),
    task('t-dark', 'p-ridgeline', 'Dark-mode logo variants', { section_id: 's-design', priority: 'high', scheduled_date: dayFromToday(2) }),
    task('t-type', 'p-ridgeline', 'Type and color system', { section_id: 's-design', scheduled_date: dayFromToday(4) }),
    task('t-guidelines', 'p-ridgeline', 'Brand guidelines, first draft', { section_id: 's-rollout', scheduled_date: dayFromToday(9) }),
    task('t-social', 'p-ridgeline', 'Social sizes of the logo', { section_id: 's-rollout', priority: 'low' }),
    task('t-invoice', 'p-ridgeline', 'Send the Ridgeline invoice', { priority: 'high', highlight: true, estimate_minutes: 15, scheduled_date: dayFromToday(0) }),
    task('t-sitemap', 'p-beacon', 'Sitemap v3', { estimate_minutes: 90, scheduled_date: dayFromToday(1) }),
    task('t-scope', 'p-beacon', 'Reply to Beacon about scope', { priority: 'low', estimate_minutes: 20, scheduled_date: dayFromToday(0) }),
    task('t-careers', 'p-beacon', 'Careers page wireframe', { priority: 'low' }),
    task('t-menu', 'p-copper', 'Shot list for the new menu', { priority: 'low', estimate_minutes: 30, scheduled_date: dayFromToday(0) }),
    task('t-brief', 'p-copper', 'Draft the Copper Row brief'),
  ];
  const sections: PSection[] = [
    { id: 's-discovery', project_id: 'p-ridgeline', name: 'Discovery', sort_order: 0, client_visible: true, due_date: dayFromToday(-8), status: null },
    { id: 's-design', project_id: 'p-ridgeline', name: 'Design', sort_order: 1, client_visible: true, due_date: dayFromToday(6), status: null },
    { id: 's-rollout', project_id: 'p-ridgeline', name: 'Rollout', sort_order: 2, client_visible: false, due_date: dayFromToday(20), status: null },
  ];
  const milestones: PMilestone[] = [
    { id: 'm-kickoff', project_id: 'p-ridgeline', title: 'Kickoff call', done: true, due_date: dayFromToday(-20), sort_order: 0 },
    { id: 'm-signoff', project_id: 'p-ridgeline', title: 'Design sign-off', done: false, due_date: dayFromToday(2), sort_order: 1 },
    { id: 'm-launch', project_id: 'p-ridgeline', title: 'Public launch', done: false, due_date: dayFromToday(30), sort_order: 2 },
  ];
  const times: PTime[] = [
    { id: 'tl-1', project_id: 'p-ridgeline', task_id: 't-logo', minutes: 150, started_at: daysAgo(1), billed: false },
    { id: 'tl-2', project_id: 'p-ridgeline', task_id: 't-routes', minutes: 90, started_at: daysAgo(4), billed: false },
    { id: 'tl-3', project_id: 'p-ridgeline', task_id: 't-audit', minutes: 240, started_at: daysAgo(10), billed: true },
  ];
  const req = (id: string, body: string, status: PRequest['status'], over: Partial<PRequest> = {}): PRequest => ({
    id, project_id: 'p-ridgeline', name: 'Priya Nair', title: null, body, status, client_id: 'c-ridgeline', task_id: null,
    resolution_note: null, created_at: daysAgo(1), ...over,
  });
  const requests: PRequest[] = [
    req('r-social', 'Could we get social sizes of the logo?', 'pending', { created_at: daysAgo(0) }),
    req('r-swatch', 'Could you send the brand colors as a swatch file?', 'needs_info', { created_at: daysAgo(1) }),
    req('r-dark', 'Please prioritize the dark-mode variants for our app launch.', 'approved', { task_id: 't-dark', created_at: daysAgo(3) }),
  ];
  const messages: PRequestMessage[] = [
    { id: 'rm-1', request_id: 'r-swatch', author: 'team', body: 'Happy to. Is this for print, screen, or both?', client_facing: true, created_at: daysAgo(1) },
  ];
  const docs: PDoc[] = [
    { id: 'd-brief', project_id: 'p-ridgeline', title: 'Ridgeline, brand brief', type: 'doc', client_visible: true, updated_at: daysAgo(3) },
    { id: 'd-direction', project_id: 'p-ridgeline', title: 'Logo, final direction', type: 'doc', client_visible: true, updated_at: daysAgo(1) },
    { id: 'd-scope', project_id: 'p-ridgeline', title: 'Internal scope notes', type: 'doc', client_visible: false, updated_at: daysAgo(6) },
  ];
  const approvals: PApproval[] = [
    { id: 'ap-logo', project_id: 'p-ridgeline', page_id: 'd-direction', title: 'Logo, final direction', status: 'awaiting', note: null, created_at: daysAgo(2) },
  ];
  const activity: PActivity[] = [
    { id: 'a-1', project_id: 'p-ridgeline', type: 'note', body: 'Priya loved route B. Dark-mode variants next, then the guidelines.', created_at: daysAgo(1) },
    { id: 'a-2', project_id: 'p-ridgeline', type: 'note', body: 'Sent the three logo routes.', created_at: daysAgo(5) },
  ];
  return { projects, tasks, sections, milestones, times, requests, messages, docs, approvals, activity };
}

const LAYOUT = { order: [], hidden: [] };

export default function ProjectsDemo() {
  const d = React.useMemo(() => data(), []);
  // `/projects/<id>` opens that project, as the app's route passes it in.
  const open = usePathname()?.split('/')[2] || 'p-ridgeline';
  return (
    <ProjectsWorkspace
      projects={d.projects}
      tasks={d.tasks}
      times={d.times}
      requests={d.requests}
      messages={d.messages}
      approvals={d.approvals}
      docs={d.docs}
      activity={d.activity}
      sections={d.sections}
      clientNames={{ 'c-ridgeline': 'Ridgeline', 'c-beacon': 'Beacon Health', 'c-copper': 'Copper Row' }}
      sectionsSupported
      iconSupported
      taskVisible={{ 't-logo': true, 't-dark': true, 't-routes': true }}
      milestones={d.milestones}
      milestonesSupported
      portalSupported
      activitySupported
      propertyLayout={LAYOUT}
      initialProjectId={open}
    />
  );
}
