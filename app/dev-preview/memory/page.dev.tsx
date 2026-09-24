'use client';
// Dev-only harness for the Memory panel (§7X M1, migration 0029). 404s in prod.
//
// WHY IT HAS TO EXIST: the panel is gated on 0029, which is not applied, and it
// reads through the browser client, which returns nothing without a session. So
// on the real app this feature is correctly invisible and there is no way to
// look at it. This feeds rows straight in through the `memories` seed and
// exercises every shape the panel can render.
//
// It mounts its own <Toaster/> because dev-preview pages render OUTSIDE AppShell
// (which owns the app's single Toaster — a second mount inside the shell would
// double every toast).
//
// THE WRITE PATH IS REAL, and deliberately not stubbed: pressing Enter in the
// capture field calls the actual server action, which refuses without a session.
// That is the case worth seeing — the field must show the refusal in place and
// come back, rather than sitting disabled with the sentence trapped inside it.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Toaster } from '@/components/ds/ui';
import { MemoryPanel } from '@/components/memory/memory-panel';
import { MemoryHome } from '@/components/memory/memory-home';
import { QuickCapture, CAPTURE_EVENT } from '@/components/shell/quick-capture';
import type { MemoryHome as HomeData } from '@/lib/memory-data';
import type { ProposalView } from '@/lib/memory-suggest';
import { BlockEditor } from '@/components/documents/block-editor';
import type { Block } from '@/lib/blocks';
import { BODY_MAX, type Memory } from '@/lib/memory';

const CLIENT = '11111111-2222-3333-4444-555555555555';

const m = (over: Partial<Memory> & { id: string; body: string }): Memory => ({
  kind: 'fact',
  subject_type: 'client',
  subject_id: CLIENT,
  origin: 'told',
  source_type: null,
  source_id: null,
  anchor: null,
  valid_from: '2026-06-01T09:00:00.000Z',
  invalid_from: null,
  superseded_by: null,
  confidence: 1,
  pinned: false,
  archived_at: null,
  last_recalled_at: null,
  recall_count: 0,
  ...over,
});

// The case the module exists for: what you'd have gone digging for about a
// client, in the order `sortMemories` puts it.
const CLIENT_FACTS: Memory[] = [
  m({ id: '1', body: 'Pays on the 1st, and only once a PO number is on the invoice.', kind: 'preference', pinned: true }),
  m({ id: '2', body: 'Ravi signs off, not Meera — sending it to Meera adds about a week.', kind: 'person' }),
  m({
    id: '3',
    body: 'Has gone over the agreed scope in three of the last four projects.',
    kind: 'pattern', origin: 'derived', confidence: 0.6,
  }),
  m({
    id: '4',
    body: 'Wants the deck as a PDF, never a link — their firewall blocks Figma.',
    // A receipt that links back: this one was marked from a selection in a doc.
    origin: 'marked', source_type: 'doc', source_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  }),
  m({ id: '5', body: 'Their financial year ends in March.' }),
];

// The long one — it must WRAP rather than truncate, because a fact you cannot
// read is not a fact. 274 characters, just inside the cap.
const LONG: Memory[] = [
  m({
    id: 'long',
    body:
      'They will not sign anything until legal has seen it, legal takes ten working days, '
      + 'and the ten days start when the contract lands in the shared inbox rather than when '
      + 'it is sent to a person — so anything that has to be signed this month needs to go in '
      + 'by the middle of it.',
  }),
];

/**
 * The second capture gesture: select text in a document and the inline toolbar
 * offers Remember. The host supplies the subject (a real doc infers its client);
 * here it is stubbed so the FIELD can be exercised — its hint must always name
 * where the fact is going.
 */
function SelectionCapture() {
  // Literal ids, not `genId()`: it is random, so generating blocks during render
  // gives the server and the client different ids and React refuses to hydrate —
  // and generating them in a mount effect only trades that for a setState the
  // lint rule (correctly) rejects. Fixed ids need neither.
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 'hb-head', type: 'h2', text: 'Kickoff notes' },
    {
      id: 'hb-body', type: 'text',
      text: 'Ravi mentioned in passing that they will not process an invoice without a PO '
        + 'number on it, which is why the last one sat for three weeks.',
    },
    { id: 'hb-hint', type: 'text', text: 'Select part of that sentence to see the toolbar.' },
  ]);
  const [saved, setSaved] = useState<string[]>([]);

  return (
    <div>
      <div className="rounded-lg border border-line-soft bg-surface-raised p-5">
        <BlockEditor
          blocks={blocks}
          onChange={setBlocks}
          remember={{
            subjectLabel: 'Meridian Studio',
            max: BODY_MAX,
            // Stubbed: the real hook calls `remember()` and toasts with Undo.
            // What is being verified here is the field, its hint and its cap.
            onSave: async (body) => {
              setSaved((s) => [...s, body]);
              return null;
            },
          }}
        />
      </div>
      {saved.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {saved.map((s, i) => (
            <li key={i} className="text-caption text-ink-500">Would remember: “{s}”</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The /memory home (M2). "About you" must lead however late it arrives in the
// data — `groupBySubject` owns that rule and this is the rendered proof.
const HOME: HomeData = {
  supported: true,
  total: 6,
  groups: [
    { key: 'client:1', subject: { type: 'client', id: CLIENT }, label: 'Meridian Studio', href: `/clients?c=${CLIENT}`, items: CLIENT_FACTS.slice(0, 3) },
    { key: 'self:', subject: { type: 'self', id: null }, label: 'About you', items: [
      m({ id: 's1', body: 'You plan about twice as much as you finish on a Monday.', subject_type: 'self', subject_id: null, kind: 'pattern', origin: 'derived', confidence: 0.5 }),
      m({ id: 's2', body: 'You do your best writing before 11am — meetings after 2pm.', subject_type: 'self', subject_id: null }),
    ] },
    { key: 'project:gone', subject: { type: 'project', id: 'deleted-id' }, label: 'Deleted', tombstone: true, items: [
      m({ id: 'g1', body: 'The handover deck was agreed as PDF-only.', subject_type: 'project', subject_id: 'deleted-id', kind: 'decision' }),
    ] },
  ],
  archived: [
    m({ id: 'a1', body: 'They were on net-45 before the 2025 renewal.', archived_at: '2026-07-01T00:00:00.000Z' }),
  ],
  // §5.4 — a fact nobody has needed in a long while. The band ASKS rather than
  // archiving behind the user's back; zero surprise outranks tidiness.
  fading: [
    m({ id: 'f1', body: 'They prefer a Tuesday kickoff call.', valid_from: '2024-02-01T00:00:00.000Z', confidence: 0.5 }),
  ],
  // M4 — a fact that has changed twice. The chain is what makes "superseded,
  // never overwritten" something you can SEE rather than something we claim.
  history: {
    [CLIENT_FACTS[0].id]: [
      m({ id: 'h1', body: 'Pays on net-45.', valid_from: '2025-01-01T00:00:00.000Z', invalid_from: '2025-09-01T00:00:00.000Z', superseded_by: 'h2' }),
      m({ id: 'h2', body: 'Pays on net-30, no PO needed.', valid_from: '2025-09-01T00:00:00.000Z', invalid_from: '2026-03-01T00:00:00.000Z', superseded_by: CLIENT_FACTS[0].id }),
    ],
  },
};

// M3 — what the detectors actually produce, one per subject type. The evidence
// line is the part that matters: an inference about your client that you cannot
// check is the thing that makes this feel like surveillance.
const PROPOSALS: ProposalView[] = [
  {
    key: `payment-rhythm:${CLIENT}`,
    subject: { type: 'client', id: CLIENT },
    body: 'Meridian Studio pays about 6 days late.',
    kind: 'pattern', confidence: 0.72,
    evidence: '6 of 7 settled invoices, measured from the due date.',
    subjectLabel: 'Meridian Studio', href: `/clients?c=${CLIENT}`,
  },
  {
    key: 'estimate-accuracy:p1',
    subject: { type: 'project', id: 'p1' },
    body: 'Work on Acme rebrand takes about 40% longer than estimated.',
    kind: 'pattern', confidence: 0.64,
    evidence: '9 tasks with both an estimate and tracked time.',
    subjectLabel: 'Acme rebrand', href: '/projects/p1',
  },
  {
    key: 'working-hours:self',
    subject: { type: 'self', id: null },
    body: 'You finish most of your work between 09:00 and 13:00.',
    kind: 'pattern', confidence: 0.58,
    evidence: '61% of 140 completed tasks landed in that window.',
    subjectLabel: 'About you',
  },
];

function CaptureHarness() {
  return (
    <div>
      <QuickCapture />
      <button
        onClick={() => window.dispatchEvent(new Event(CAPTURE_EVENT))}
        className="focus-ring rounded-md border border-line-strong px-3 py-1.5 text-ui text-ink-800 hover:bg-surface-hover"
      >
        Open quick capture
      </button>
      <p className="mt-2 max-w-[52ch] text-caption text-ink-500">
        One field, no mode. Enter saves a task; ⌥Enter (or the Remember button) commits the
        same words as a fact about you. The footer says which is which.
      </p>
    </div>
  );
}

export default function MemoryHarness() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <div className="min-h-screen bg-paper p-10">
      <Toaster />
      <h1 className="mb-8 text-h2 text-ink-900">Memory panel</h1>

      <div className="grid max-w-[1100px] gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-overline text-ink-500">A client, five facts</h2>
          <p className="mb-4 text-caption text-ink-500">
            Three shown, the rest behind “Show 2 more” (§5.3). Pinned first, then confidence —
            the derived pattern sits below what you stated. Hover a row for its menu.
          </p>
          <div className="rounded-lg border border-line-soft bg-surface-raised p-5">
            <MemoryPanel subject={{ type: 'client', id: CLIENT }} memories={CLIENT_FACTS} canAdd />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-overline text-ink-500">Nothing known yet</h2>
          <p className="mb-4 text-caption text-ink-500">
            One line and one affordance — no billboard, no icon in a circle.
          </p>
          <div className="rounded-lg border border-line-soft bg-surface-raised p-5">
            <MemoryPanel subject={{ type: 'client', id: 'empty' }} memories={[]} canAdd />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-overline text-ink-500">A long fact</h2>
          <p className="mb-4 text-caption text-ink-500">
            274 characters — wraps, never truncates.
          </p>
          <div className="rounded-lg border border-line-soft bg-surface-raised p-5">
            <MemoryPanel subject={{ type: 'client', id: 'long' }} memories={LONG} canAdd />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-overline text-ink-500">Read-only, and empty</h2>
          <p className="mb-4 text-caption text-ink-500">
            A task or a doc with no facts renders NOTHING at all — the box below is empty on
            purpose. An empty “Memory” heading on every record is chrome asking to be fed.
          </p>
          <div className="rounded-lg border border-line-soft bg-surface-raised p-5">
            <MemoryPanel subject={{ type: 'task', id: 'none' }} memories={[]} />
          </div>
        </section>
      </div>

      <section className="mt-12 max-w-[1100px]">
        <h2 className="mb-3 text-overline text-ink-500">Remember this, from a selection</h2>
        <p className="mb-4 max-w-[52ch] text-caption text-ink-500">
          Select part of the paragraph. The inline toolbar gains one action after a separator —
          everything left of it changes how the selection looks, this one takes it somewhere else.
        </p>
        <SelectionCapture />
      </section>

      <section className="mt-12 max-w-[1100px]">
        <h2 className="mb-3 text-overline text-ink-500">Quick capture — one field, two commits</h2>
        <CaptureHarness />
      </section>

      <section className="mt-12">
        <h2 className="mb-3 text-overline text-ink-500">The /memory home, with M3’s Noticed band</h2>
        <p className="mb-4 max-w-[52ch] text-caption text-ink-500">
          Review, not browsing: grouped by what each fact is ABOUT, “About you” first
          because it is the only subject with no other page. No search field — ⌘K is the
          one search. Archived is a disclosure, not a list.
        </p>
        <div className="rounded-lg border border-line-soft bg-surface-raised">
          <MemoryHome data={HOME} proposals={PROPOSALS} />
        </div>
      </section>
    </div>
  );
}
