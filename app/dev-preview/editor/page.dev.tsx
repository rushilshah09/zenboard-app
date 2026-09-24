'use client';
// Dev-only harness for the block editor — staged mixed-type blocks in a
// scrollable column so cross-block drag selection, ⌘A, and edge auto-scroll
// can be exercised without a session. 404s in prod.
import { useEffect, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import type { Acceptance } from '@/lib/acceptance';
// Its own <Toaster/>: dev-preview renders OUTSIDE AppShell, which owns the
// app's single one. "Copy link to block" reports through it, so without this
// the action would look like it did nothing.
import { Toaster } from '@/components/ds/ui';
import { BlockEditor, type CommentsHook } from '@/components/documents/block-editor';
import { DocThreads } from '@/components/documents/comment-thread';
import { genId, type Block } from '@/lib/blocks';
import {
  toThreads, openThreadsByAnchor, archivedThreads, normalizeBody, PAGE_ANCHOR,
  type Comment,
} from '@/lib/comments';
import { tempId } from '@/lib/temp-id';

// Inline SVG data-URL so the image block has a real src to preview/lightbox
// without an upload round-trip.
const demoImg = (label: string, from: string, to: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="320" y="200" font-family="sans-serif" font-size="52" fill="white" text-anchor="middle">${label}</text></svg>`,
  );

const seed = (): Block[] => [
  { id: genId(), type: 'h1', text: 'Selection playground' },
  { id: genId(), type: 'text', text: 'A paragraph with enough text to select partially before sweeping into the blocks below.' },
  // Links inside an idle block — the state where "a mention IS a link mark"
  // becomes visible. An internal one must navigate in-app on a PLAIN click; an
  // external one must open a new tab. Both used to need ⌘-click and did nothing
  // without it, which is the whole reason this row is staged.
  // A HOSTILE LINK, on purpose. Stored spans are untrusted — they arrive by
  // paste and by Notion import — and a `javascript:` href in a real <a> runs in
  // OUR origin with the reader's session, on a document the portal shows to
  // clients. `lib/safe-url.ts` must render this as WORDS, never as an anchor,
  // and this row is what keeps that true in a browser rather than only in a test.
  {
    id: genId(), type: 'text',
    text: 'Hostile: click me is not a link.',
    spans: [
      { text: 'Hostile: ' },
      { text: 'click me', link: 'javascript:alert(document.domain)' },
      { text: ' is not a link.' },
    ],
  },
  {
    id: genId(), type: 'text',
    text: 'Links: Acme rebrand is a record, prosemirror.net is not.',
    spans: [
      { text: 'Links: ' },
      { text: 'Acme rebrand', link: '/projects/9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d' },
      { text: ' is a record, ' },
      { text: 'prosemirror.net', link: 'https://prosemirror.net' },
      { text: ' is not.' },
    ],
  },
  { id: genId(), type: 'h2', text: 'A section heading' },
  { id: genId(), type: 'bullet', text: 'First bullet' },
  { id: genId(), type: 'bullet', text: 'Second bullet' },
  { id: genId(), type: 'todo', text: 'A checklist item', checked: false },
  { id: genId(), type: 'image', text: 'Indigo gradient', src: demoImg('IMAGE 1', '#6366f1', '#a855f7') },
  { id: genId(), type: 'image', text: 'Amber gradient', src: demoImg('IMAGE 2', '#f59e0b', '#ef4444'), width: 60 },
  // A STORED image (0033): the block holds an attachment id, not bytes. The
  // harness has no session, so the signature never mints — which is exactly the
  // state worth staging: it must hold a labelled frame, not a torn-image glyph.
  { id: genId(), type: 'image', text: '', fileId: '00000000-0000-4000-8000-000000000001', fileName: 'quarterly-report.webp' },
  // Link blocks with and without a note — the pair that shows the difference.
  // The unfurl endpoint needs a session, so in the harness both cards fall back
  // to hostname-only, which is exactly the case the note exists for: when the
  // web tells you nothing, YOUR sentence is the whole card.
  { id: genId(), type: 'bookmark', text: 'Final logos — use these, not the old folder', src: 'https://drive.google.com/drive/folders/demo' },
  { id: genId(), type: 'bookmark', text: '', src: 'https://www.figma.com/file/demo' },
  // §7M line items — the block that turns a Doc into a proposal. Seeded with a
  // fractional rate on purpose: the Amount column and the Total must reconcile,
  // and the Rate must read as money at rest rather than as a bare float.
  { id: genId(), type: 'lineitems', text: '', items: [
    { id: 'li1', description: 'Brand identity', quantity: 1, unitAmount: 4000 },
    { id: 'li2', description: 'Guidelines', quantity: 2, unitAmount: 750.5 },
  ] },
  // §7M accept — the terms only. The editor never shows it signed, because a
  // signature is a row the CLIENT writes through the portal (lib/acceptance.ts).
  { id: 'accept-demo', type: 'accept', text: '', accept: {} },
  // The settled state, with §7M's crossing already fired — so the signed block
  // and its invoice provenance line are both visible in one pass.
  { id: 'accept-signed', type: 'accept', text: '', accept: { label: 'Sign' } },
  { id: genId(), type: 'quote', text: 'A quote block in the middle of the flow.' },
  { id: genId(), type: 'collection', text: '', colId: 'demo' },
  // Second view of the SAME collection — exercises the shared engine store:
  // edits made in either block must appear in both instantly.
  { id: genId(), type: 'collection', text: '', colId: 'demo' },
  { id: genId(), type: 'callout', text: 'A callout — selections should sweep straight through.' },
  { id: genId(), type: 'code', text: 'const x = 42;', lang: 'ts' },
  // Block links (v2.3 §2): a target folded inside a COLLAPSED toggle. Arriving
  // at it has to open the toggle first — scrolling to a row that is not
  // rendered is the failure this staging exists to catch.
  { id: 'b-toggle', type: 'toggle', text: 'A collapsed toggle', collapsed: true },
  { id: 'b-folded', type: 'text', text: 'Folded away — reachable only by opening the toggle above.', indent: 1 },
  // Deterministic ids so `#block-b-filler-28` addresses something far enough
  // down the page that a scroll is unambiguous.
  ...Array.from({ length: 30 }, (_, i) => ({ id: `b-filler-${i + 1}`, type: 'text' as const, text: `Filler paragraph ${i + 1} — long documents need smooth auto-scroll while dragging.` })),
];

// Any uuid: the harness has no database, and the editor only needs a page id to
// know it HAS a page — which is what turns "Copy link to block" on.
const DEMO_PAGE = '9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d';

// §7H comments, staged in memory. The harness has no session, so the server
// actions cannot run — but every rule (`lib/comments.ts`) and every component
// is the real one, which is the part worth exercising here. Seeded with the
// three states that are hard to reach by hand: an open thread with a reply, a
// RESOLVED thread, and one anchored to a block that no longer exists.
const SEED_COMMENTS: Comment[] = [
  { id: 'k1', threadId: 'th-open', blockId: 'b-filler-2', body: 'Is this still the right framing?', authorName: 'Ada', createdAt: '2026-08-06T09:00:00Z', resolvedAt: null },
  { id: 'k2', threadId: 'th-open', blockId: 'b-filler-2', body: 'I think so — leaving it for now.', authorName: 'Ada', createdAt: '2026-08-06T09:12:00Z', resolvedAt: null },
  { id: 'k3', threadId: 'th-done', blockId: 'b-filler-4', body: 'Fixed the numbers here.', authorName: 'Ada', createdAt: '2026-08-05T14:00:00Z', resolvedAt: '2026-08-05T14:30:00Z' },
  { id: 'k4', threadId: 'th-orphan', blockId: 'b-block-that-was-deleted', body: 'This paragraph is gone now.', authorName: 'Ada', createdAt: '2026-08-04T08:00:00Z', resolvedAt: null },
  { id: 'k5', threadId: 'th-page', blockId: null, body: 'Overall this reads well.', authorName: 'Ada', createdAt: '2026-08-06T08:00:00Z', resolvedAt: null },
];

// §7M: one signed acceptance, with the invoice the crossing drafted from it.
const DEMO_ACCEPTANCES: Acceptance[] = [{
  id: 'acp-1', blockId: 'accept-signed', signerName: 'Priya Raman',
  signerEmail: 'priya@northwind.co', acceptedAt: '2026-08-01T09:20:00Z',
  statement: 'By typing my name below, I agree to the scope and prices set out in this document.',
  contentHash: 'seed', amount: 5501, invoiceId: 'inv-1',
}];
const DEMO_INVOICES = { 'inv-1': { number: 'INV-004', status: 'draft' } };

export default function EditorPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
   
  const [blocks, setBlocks] = useState<Block[]>(seed);
  // Perf harness: ?n=2000 pads the doc with filler paragraphs after mount
  // (client-side so SSR markup stays deterministic).
   
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('n')) || 0;
    if (!n) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks((bs) => bs.length >= n ? bs : [
      ...bs,
      ...Array.from({ length: n - bs.length }, (_, i) => ({
        id: genId(), type: 'text' as const,
        text: `Perf filler ${i + 1} — enough copy that rows wrap realistically and layout has genuine work to do at scale.`,
      })),
    ]);
  }, []);
  const comments = useFakeComments(blocks);
  return (
    <div id="scroller" style={{ height: '100dvh', overflowY: 'auto', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 56px 120px' }}>
        <DocThreads
          open={comments.byBlock.get(null) ?? []}
          archived={comments.archived}
          composing={comments.composingFor === PAGE_ANCHOR}
          actions={comments.actions}
          onCloseComposer={comments.close}
        />
        <BlockEditor blocks={blocks} onChange={setBlocks} pageId={DEMO_PAGE} comments={comments}
          acceptances={DEMO_ACCEPTANCES} docHashes={["seed"]} acceptInvoices={DEMO_INVOICES}
          onWithdrawAccept={() => {}} onCreateAcceptInvoice={() => {}} />
      </div>
      <Toaster />
    </div>
  );
}

/** The real rules and the real components over an in-memory store — everything
 *  `useDocComments` does except the round trip it cannot make without a session. */
function useFakeComments(blocks: Block[]): CommentsHook & { archived: ReturnType<typeof archivedThreads> } {
  const [rows, setRows] = useState<Comment[]>(SEED_COMMENTS);
  const [composingFor, setComposingFor] = useState<string | null>(null);
  const blockIds = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);
  const threads = useMemo(() => toThreads(rows, blockIds), [rows, blockIds]);
  const byBlock = useMemo(() => openThreadsByAnchor(threads), [threads]);
  const archived = useMemo(() => archivedThreads(threads), [threads]);
  return {
    byBlock,
    archived,
    composingFor,
    open: (blockId: string) => setComposingFor(blockId),
    close: () => setComposingFor(null),
    actions: {
      post: (blockId, raw) => {
        const body = normalizeBody(raw); if (!body) return;
        setRows((cur) => [...cur, { id: tempId(), threadId: tempId(), blockId, body, authorName: 'Ada', createdAt: new Date().toISOString(), resolvedAt: null }]);
      },
      reply: (threadId, raw) => {
        const body = normalizeBody(raw); if (!body) return;
        setRows((cur) => {
          const anchor = cur.find((c) => c.threadId === threadId)?.blockId ?? null;
          return [...cur, { id: tempId(), threadId, blockId: anchor, body, authorName: 'Ada', createdAt: new Date().toISOString(), resolvedAt: null }];
        });
      },
      remove: (comment) => setRows((cur) => cur.filter((c) => c.id !== comment.id)),
      setResolved: (threadId, resolved) => setRows((cur) => cur.map((c) => (
        c.threadId === threadId ? { ...c, resolvedAt: resolved ? new Date().toISOString() : null } : c
      ))),
    },
  };
}
