'use client';
// Dev-only harness for the Clients hub — staged data so the memory-surface
// detail, pipeline board, and modals can be verified without a session.
// 404s in prod.
import { notFound } from 'next/navigation';
import { ClientsView, type ClientCard, type Lead } from '@/components/clients/clients-view';
import { type FeedbackItem } from '@/components/feedback/feedback-board';
import { type MeetingItem } from '@/components/meetings/meeting-panel';

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const CLIENTS: ClientCard[] = [
  {
    id: 'c1', name: 'Meridian Studio', role: 'Head of Brand', contact: 'Sarah Chen', email: 'sarah@meridian.co',
    status: 'active', health: 'good', since: 'Mar 2025', next_step: 'Send the Q3 retainer proposal', created_at: day(140),
    notes: [
      { id: 'n1', client_id: 'c1', body: 'Kickoff call — they want the rebrand live before the September launch.', created_at: day(2) },
      { id: 'n2', client_id: 'c1', body: 'Logged a touch.', created_at: day(9) },
    ],
    projects: [
      { id: 'p1', name: 'Brand identity', color: '#9A1B6F', client_id: 'c1', open: 5, total: 12 },
      { id: 'p2', name: 'Website rebuild', color: '#2B5CB0', client_id: 'c1', open: 3, total: 8 },
    ],
    invoices: [
      { id: 'i1', number: 'INV-014', client_id: 'c1', status: 'paid', amount: 4200 },
      { id: 'i2', number: 'INV-018', client_id: 'c1', status: 'sent', amount: 2800 },
    ],
    forms: [
      { id: 'fm1', title: 'Project kickoff brief', status: 'live', shareToken: 'demoTokenForPreview123', updatedAt: day(1), responses: 12, partials: 3 },
      { id: 'fm2', title: 'Testimonial request', status: 'draft', shareToken: null, updatedAt: day(9), responses: 0, partials: 0 },
    ],
  },
  {
    id: 'c2', name: 'Fernwood Hotels', role: null, contact: 'Marco Diaz', email: null,
    status: 'active', health: 'attention', since: null, next_step: null, created_at: day(60),
    notes: [], projects: [], invoices: [{ id: 'i3', number: 'INV-020', client_id: 'c2', status: 'overdue', amount: 1500 }], forms: [],
  },
  {
    id: 'c3', name: 'Atlas Coffee', role: 'Founder', contact: 'Priya Raman', email: 'priya@atlas.coffee',
    status: 'past', health: 'good', since: 'Jan 2024', next_step: null, created_at: day(400),
    notes: [{ id: 'n3', client_id: 'c3', body: 'Wrapped the packaging project. Great to work with.', created_at: day(120) }],
    projects: [{ id: 'p3', name: 'Packaging', color: '#C88A3B', client_id: 'c3', open: 0, total: 6 }],
    invoices: [{ id: 'i4', number: 'INV-009', client_id: 'c3', status: 'paid', amount: 3600 }], forms: [],
  },
];

const LEADS: Lead[] = [
  { id: 'l1', name: 'Northwind Ltd', contact: 'Dana Wu', value: 8000, stage: 'lead', source: 'Referral', note: 'Warm intro from Sarah.', created_at: day(3) },
  { id: 'l2', name: 'Coastal Realty', contact: 'Sam Poole', value: 5000, stage: 'contacted', source: 'Website', note: null, created_at: day(6) },
  { id: 'l3', name: 'Brightline', contact: 'Jo Park', value: 12000, stage: 'proposal', source: 'Referral', note: 'Proposal sent Tuesday.', created_at: day(10) },
];

const D = (ids: string[]) => LEADS.filter((l) => ids.includes(l.id)).map((l) => ({ id: l.id, name: l.name, value: l.value }));
const MEETINGS: MeetingItem[] = [
  { id: 'm1', client_id: 'c1', title: 'Q3 planning call', notes: 'Sarah walked through the September launch. Wants the rebrand live before then. Asked about usage-based pricing for their tier, and flagged that recurring invoices would save her finance team hours each month.', met_at: day(1), created_at: day(1) },
  { id: 'm2', client_id: 'c1', title: 'Kickoff', notes: null, met_at: day(9), created_at: day(9) },
];

const FEEDBACK: FeedbackItem[] = [
  { id: 'f1', number: 34, title: 'Add usage-based pricing', body: null, status: 'open', source: 'meeting', client_id: 'c1', meeting_id: 'm1', task_id: null, created_at: day(1), deals: D(['l3', 'l2']) },
  { id: 'f2', number: 33, title: 'Bulk CSV import for contacts', body: null, status: 'open', source: 'client', client_id: null, meeting_id: null, task_id: null, created_at: day(4), deals: D(['l1']) },
  { id: 'f3', number: 31, title: 'Slack alerts on deal stage change', body: null, status: 'planned', source: 'meeting', client_id: null, meeting_id: null, task_id: null, created_at: day(8), deals: D(['l3']) },
  { id: 'f4', number: 28, title: 'Dark mode', body: null, status: 'open', source: 'portal', client_id: null, meeting_id: null, task_id: null, created_at: day(12), deals: [] },
  { id: 'f5', number: 25, title: 'Recurring invoices', body: null, status: 'in_progress', source: 'meeting', client_id: 'c1', meeting_id: 'm1', task_id: 't1', created_at: day(15), deals: D(['l2']) },
  { id: 'f6', number: 22, title: 'Two-way calendar sync', body: null, status: 'shipped', source: 'meeting', client_id: 'c1', meeting_id: null, task_id: 't2', created_at: day(30), deals: D(['l1']) },
];

export default function ClientsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--paper)' }}>
      <ClientsView initialClients={CLIENTS} initialLeads={LEADS} initialFeedback={FEEDBACK} initialMeetings={MEETINGS} />
    </div>
  );
}
