'use client';
// Dev-only harness for the block editor — staged mixed-type blocks in a
// scrollable column so cross-block drag selection, ⌘A, and edge auto-scroll
// can be exercised without a session. 404s in prod.
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { BlockEditor } from '@/components/documents/block-editor';
import { genId, type Block } from '@/lib/blocks';

// Inline SVG data-URL so the image block has a real src to preview/lightbox
// without an upload round-trip.
const demoImg = (label: string, from: string, to: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="320" y="200" font-family="sans-serif" font-size="52" fill="white" text-anchor="middle">${label}</text></svg>`,
  );

const seed = (): Block[] => [
  { id: genId(), type: 'h1', text: 'Selection playground' },
  { id: genId(), type: 'text', text: 'A paragraph with enough text to select partially before sweeping into the blocks below.' },
  { id: genId(), type: 'h2', text: 'A section heading' },
  { id: genId(), type: 'bullet', text: 'First bullet' },
  { id: genId(), type: 'bullet', text: 'Second bullet' },
  { id: genId(), type: 'todo', text: 'A checklist item', checked: false },
  { id: genId(), type: 'image', text: 'Indigo gradient', src: demoImg('IMAGE 1', '#6366f1', '#a855f7') },
  { id: genId(), type: 'image', text: 'Amber gradient', src: demoImg('IMAGE 2', '#f59e0b', '#ef4444'), width: 60 },
  { id: genId(), type: 'quote', text: 'A quote block in the middle of the flow.' },
  { id: genId(), type: 'collection', text: '', colId: 'demo' },
  // Second view of the SAME collection — exercises the shared engine store:
  // edits made in either block must appear in both instantly.
  { id: genId(), type: 'collection', text: '', colId: 'demo' },
  { id: genId(), type: 'callout', text: 'A callout — selections should sweep straight through.' },
  { id: genId(), type: 'code', text: 'const x = 42;', lang: 'ts' },
  ...Array.from({ length: 30 }, (_, i) => ({ id: genId(), type: 'text' as const, text: `Filler paragraph ${i + 1} — long documents need smooth auto-scroll while dragging.` })),
];

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
  return (
    <div id="scroller" style={{ height: '100dvh', overflowY: 'auto', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 56px 120px' }}>
        <BlockEditor blocks={blocks} onChange={setBlocks} />
      </div>
    </div>
  );
}
