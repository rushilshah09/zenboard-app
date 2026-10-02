'use client';
// Clients: the product's own Clients view — the three clients, the pipeline of leads, their meetings and
// the feedback they give. Two of its actions read something back, so they are answered here in the shape
// the view expects: the meeting clerk's suggested action items (drawn from the notes it was given, the
// way the server's verifier insists), and the number a new feedback item gets.
import * as React from 'react';
import { ClientsView, type ClientCard, type Lead } from '@/components/clients/clients-view';
import type { FeedbackItem } from '@/components/feedback/feedback-board';
import type { MeetingItem } from '@/components/meetings/meeting-panel';
import type { MeetingTaskRow } from '@/lib/meeting-actions';
import type { MeetingNotes } from '@/lib/meeting-notes';
import { registerAnswerer } from '../sandbox';

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const KICKOFF_NOTES = [
  'Call with Priya, Ridgeline: logo direction',
  'Priya: We loved route B, but the green feels too corporate.',
  'Me: Got it. I’ll send two warmer palettes by Thursday.',
  'Priya: Can the mark work on our app icon? It gets very small.',
  'Me: Good point. I’ll test the mark at small sizes this week.',
  'Priya: Could you also quote for packaging? Not urgent.',
  'Me: Sure, I’ll put a packaging quote together next week.',
].join('\n');
// The write-up the clerk would produce for KICKOFF_NOTES (MEETINGS_PLAN.md M2). Staged, because the
// demo has no session and no pool; every line here is quoted from the notes above, exactly as
// `verifyNotes` would require of a real one.
const WRITTEN: MeetingNotes = {
  v: 1,
  kind: 'kickoff',
  summary: 'We went through the logo direction. The palette needs to be warmer, so two warmer options are coming by Thursday, and the mark still has to be tested at small sizes.',
  details: [],
  decisions: [],
  mine: [
    { key: 'send two warmer palettes by thursday', text: 'Send two warmer palettes by Thursday', evidence: 'I’ll send two warmer palettes by Thursday.' },
    { key: 'test the mark at small sizes', text: 'Test the mark at small sizes', evidence: 'I’ll test the mark at small sizes this week.' },
    { key: 'send a packaging quote next week', text: 'Send a packaging quote next week', evidence: 'I’ll put a packaging quote together next week.' },
  ],
  theirs: [],
  asks: [{ key: 'quote for packaging', text: 'Quote for packaging', evidence: 'Could you also quote for packaging? Not urgent.' }],
  questions: [],
  dismissed: [],
  truncated: false,
  at: new Date().toISOString(),
};

function data() {
  const clients: ClientCard[] = [
    {
      id: 'c-ridgeline', name: 'Ridgeline', role: 'Head of Brand', contact: 'Priya Nair', email: 'priya@ridgeline.example',
      status: 'active', health: 'good', since: 'Jun 2026', next_step: 'Send the logo presentation', created_at: day(110),
      notes: [{ id: 'cn-1', client_id: 'c-ridgeline', body: 'They want the rebrand live before their app launch.', created_at: day(2) }],
      projects: [{ id: 'p-ridgeline', name: 'Ridgeline rebrand', color: 'plum', client_id: 'c-ridgeline', status: 'active', open: 6, total: 9 }],
      invoices: [
        { id: 'in-021', number: 'INV-021', client_id: 'c-ridgeline', status: 'paid', amount: 4200 },
        { id: 'in-022', number: 'INV-022', client_id: 'c-ridgeline', status: 'draft', amount: 450 },
      ],
      forms: [{ id: 'f-feedback', title: 'Design feedback, round 2', status: 'live', shareToken: 'demo-feedback', updatedAt: day(1), responses: 12, partials: 3 }],
    },
    {
      id: 'c-beacon', name: 'Beacon Health', role: 'Marketing lead', contact: 'Daniel Okafor', email: 'daniel@beacon.example',
      status: 'active', health: 'attention', since: 'Aug 2026', next_step: 'Agree the sitemap', created_at: day(50),
      notes: [], projects: [{ id: 'p-beacon', name: 'Beacon Health site', color: 'blue', client_id: 'c-beacon', status: 'active', open: 3, total: 5 }],
      invoices: [{ id: 'in-020', number: 'INV-020', client_id: 'c-beacon', status: 'sent', amount: 3600 }], forms: [],
    },
    {
      id: 'c-copper', name: 'Copper Row', role: 'Owner', contact: 'Maya Chen', email: 'maya@copperrow.example',
      status: 'active', health: 'attention', since: 'Mar 2026', next_step: 'Chase INV-018', created_at: day(200),
      notes: [{ id: 'cn-2', client_id: 'c-copper', body: 'New menu launches next month. Photography in two weeks.', created_at: day(6) }],
      projects: [{ id: 'p-copper', name: 'Copper Row menus', color: 'amber', client_id: 'c-copper', status: 'active', open: 2, total: 2 }],
      invoices: [{ id: 'in-018', number: 'INV-018', client_id: 'c-copper', status: 'overdue', amount: 2800 }], forms: [],
    },
  ];
  const leads: Lead[] = [
    { id: 'l-harbor', name: 'Harbor & Pine', contact: 'Sam Porter', value: 8000, stage: 'lead', source: 'Referral', note: 'Intro from Priya.', created_at: day(3) },
    { id: 'l-tidewater', name: 'Tidewater Books', contact: 'Jo Park', value: 5000, stage: 'contacted', source: 'Website', note: null, created_at: day(6) },
    { id: 'l-lumen', name: 'Lumen Dental', contact: 'Ana Ruiz', value: 12000, stage: 'proposal', source: 'Referral', note: 'Proposal sent Tuesday.', created_at: day(10) },
  ];
  const meetings: MeetingItem[] = [
    { id: 'mt-direction', client_id: 'c-ridgeline', title: 'Logo direction call', notes: KICKOFF_NOTES, met_at: day(0), created_at: day(0) },
    { id: 'mt-kickoff', client_id: 'c-ridgeline', title: 'Kickoff', notes: null, met_at: day(20), created_at: day(20) },
  ];
  const meetingTasks: MeetingTaskRow[] = [];
  const deal = (ids: string[]) => leads.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, name: l.name, value: l.value }));
  const feedback: FeedbackItem[] = [
    { id: 'fb-1', number: 12, title: 'A printable one-page brand sheet', body: null, status: 'open', source: 'meeting', client_id: 'c-ridgeline', meeting_id: 'mt-kickoff', task_id: null, created_at: day(4), deals: deal(['l-lumen']) },
    { id: 'fb-2', number: 11, title: 'Invoices in the client’s currency', body: null, status: 'planned', source: 'client', client_id: 'c-beacon', meeting_id: null, task_id: null, created_at: day(9), deals: deal(['l-harbor']) },
    { id: 'fb-3', number: 9, title: 'Menu specials, updated weekly', body: null, status: 'in_progress', source: 'portal', client_id: 'c-copper', meeting_id: null, task_id: null, created_at: day(15), deals: [] },
  ];
  return { clients, leads, meetings, meetingTasks, feedback };
}

export default function ClientsDemo() {
  const d = React.useMemo(() => data(), []);
  React.useEffect(() => {
    let n = 0;
    return registerAnswerer(([a, b]) => {
      // The clerk: a meeting id and its notes → suggested action items, after a moment's thought.
      if (typeof a === 'string' && typeof b === 'string' && b.includes('\n')) return new Promise((r) => setTimeout(() => r({ notes: WRITTEN, kept: true }), 1200));
      // An ask turned into a feedback item gets the next number.
      if (a && typeof a === 'object' && 'title' in a && 'meetingId' in a) { n += 1; return { id: `fb-demo-${n}`, number: 12 + n }; }
      return undefined;
    });
  }, []);
  return (
    <ClientsView
      initialClients={d.clients}
      initialLeads={d.leads}
      initialFeedback={d.feedback}
      initialMeetings={d.meetings}
      initialMeetingTasks={d.meetingTasks}
      meetingTasksSupported
    />
  );
}
