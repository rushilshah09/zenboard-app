'use client';
// Dev-only harness for the client portal document — confirms the DS Badge
// (migrated off the retired zen layer) + the doc sections render. 404s in prod.
import { notFound } from 'next/navigation';
import { PortalDocument } from '@/components/portal/portal-document';
import type { PortalView } from '@/lib/portal';
import type { PortalRequestStatus } from '@/lib/request-status';

const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const VIEW: PortalView = {
  studio: 'Meridian Studio',
  projectName: 'Brand identity',
  status: 'active',
  intro: 'Here’s where things stand on the rebrand. Everything current lives on this page — no login needed.',
  allowRequests: true,
  progress: { done: 7, total: 12, pct: 58 },
  completed: [
    { id: 'c1', title: 'Discovery workshop' },
    { id: 'c2', title: 'Moodboards approved' },
  ],
  open: [
    { id: 'o1', title: 'Logo exploration — 3 routes' },
    { id: 'o2', title: 'Type system' },
  ],
  timeline: [
    { at: iso(2), title: 'Shared the logo directions' },
    { at: iso(6), title: 'Kickoff call' },
  ],
  docs: [
    { id: 'd1', title: 'Creative brief', text: 'The north star for the rebrand: calm, premium, unmistakably Meridian.', updated_at: iso(2) },
  ],
  invoices: [
    { id: 'i1', number: 'INV-002', status: 'sent', total: 2800, dueDate: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10) },
    { id: 'i2', number: 'INV-001', status: 'paid', total: 3500, dueDate: iso(20).slice(0, 10) },
  ],
  forms: [
    { id: 'pf1', title: 'Design feedback — round 2', description: 'Two minutes on what’s working and what isn’t.', token: 'demoFormToken1234567' },
  ],
  approvals: [
    { id: 'a1', title: 'Logo — final direction', status: 'awaiting', note: null },
    { id: 'a2', title: 'Brand guidelines v1', status: 'changes_requested', note: 'Love it — can the accent be a touch warmer, and add a mono logo variant?' },
    { id: 'a3', title: 'Moodboard', status: 'approved', note: null },
  ],
};

const DEMO_STATUSES: PortalRequestStatus[] = [
  {
    id: 'r-inprogress', title: 'Add a dark-mode version of the logo', label: 'In progress',
    resolutionNote: null, createdAt: iso(3), canReply: false, messages: [],
  },
  {
    id: 'r-needsinfo', title: 'Send the updated brand colors as a swatch file', label: 'Needs your input',
    resolutionNote: null, createdAt: iso(1), canReply: true,
    messages: [{ author: 'team', body: 'Happy to — which screens is this for, and do you have hex values in mind?', createdAt: iso(1) }],
  },
  {
    id: 'r-declined', title: 'Full packaging design system', label: 'Declined',
    resolutionNote: 'That’s outside the rebrand scope — happy to quote it as a separate project once this ships.',
    createdAt: iso(5), canReply: false, messages: [],
  },
];

export default function PortalPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)' }}>
      {/* No `preview` here: the harness shows the buttons in their real enabled
          state (they're inert without a token). "Preview as client" still passes
          `preview` to disable actions for the owner. */}
      <PortalDocument view={VIEW} demoStatuses={DEMO_STATUSES} />
    </div>
  );
}
