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
  // Client-facing workstreams (0040). A fourth, "Internal QA", deliberately
  // is not here: the projection never fetches an internal stream, so the
  // harness must not invent a way for one to arrive either.
  streams: [
    {
      id: 's1', name: 'Packaging', pct: 33,
      open: [{ id: 'p1', title: 'Dieline for the 250ml carton' }, { id: 'p2', title: 'Print-ready artwork' }],
      completed: [{ id: 'p3', title: 'Material study' }],
    },
    {
      id: 's2', name: 'Brand guidelines', pct: 0,
      open: [{ id: 'g1', title: 'Logo usage rules' }],
      completed: [],
    },
  ],
  // Authored updates (S2). The private note the studio also wrote — "chase the
  // unpaid invoice" — is deliberately absent: the projection never fetches a
  // `note` row, so the harness must not invent a way for one to arrive.
  updates: [
    { id: 'u1', at: iso(1), body: 'Three logo routes are with you for review.\n\nHave a look when you get a moment — pick the one that feels closest and we’ll refine it into the final mark next week. No rush before Thursday.' },
    { id: 'u2', at: iso(7), body: 'Discovery is wrapped. Everything you told us in the workshop is reflected in the brief under Documents.' },
  ],
  timeline: [
    { at: iso(2), title: 'Shared the logo directions' },
    { at: iso(6), title: 'Kickoff call' },
  ],
  docs: [
    { id: 'd1', title: 'Creative brief', text: 'The north star for the rebrand: calm, premium, unmistakably Meridian.', updated_at: iso(2), items: null, accepts: [] },
    // §7M: a proposal is a Doc with paperwork blocks. Unsigned, so the harness
    // shows the state the client actually lands on.
    {
      id: 'd2', title: 'Proposal — brand identity', updated_at: iso(1),
      text: 'Scope\n\nDiscovery, three logo routes, and a type system. Two rounds of revisions at each stage.',
      items: [
        { id: 'li1', description: 'Discovery & strategy', quantity: 1, unitAmount: 1800 },
        { id: 'li2', description: 'Logo design — 3 routes', quantity: 1, unitAmount: 4000 },
        { id: 'li3', description: 'Brand guidelines', quantity: 2, unitAmount: 750.5 },
      ],
      accepts: [{ blockId: 'acc1', terms: {}, acceptance: null }],
    },
    // The settled state, so both halves of the block are visible in one pass.
    {
      id: 'd3', title: 'Retainer agreement', updated_at: iso(9), text: 'Monthly design retainer, rolling three-month term.',
      items: null,
      accepts: [{
        blockId: 'acc2', terms: { label: 'Sign' },
        acceptance: {
          id: 'acp1', blockId: 'acc2', signerName: 'Priya Raman', signerEmail: 'priya@northwind.co',
          acceptedAt: iso(9), statement: 'By typing my name below, I agree to the scope and prices set out in this document.',
          contentHash: 'seed', amount: 2400, invoiceId: null,
        },
      }],
    },
  ],
  invoices: [
    { id: 'i1', number: 'INV-002', status: 'sent', total: 2800, dueDate: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10) },
    { id: 'i2', number: 'INV-001', status: 'paid', total: 3500, dueDate: iso(20).slice(0, 10) },
  ],
  forms: [
    { id: 'pf1', title: 'Design feedback — round 2', description: 'Two minutes on what’s working and what isn’t.', token: 'demoFormToken1234567' },
  ],
  // Uploaded deliverables (0039), shown alongside written documents because to
  // a client they are the same errand.
  files: [
    { id: 'f1', filename: 'meridian-logo-pack.zip', size: 8_400_000, kind: 'file' },
    { id: 'f2', filename: 'moodboard-final.pdf', size: 2_100_000, kind: 'pdf' },
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
