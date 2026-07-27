'use client';
// M0 spike — foundation gates for the Documents rebuild (PRD §16 Q2).
//   Gate A: click any of 2,000 static blocks → PM mounts at the exact caret
//           point, zero layout shift, keystroke-to-paint < 16ms p95.
//   Gate B: one app-level undo stack across typing runs, markdown converts
//           (literal restore), and structural moves.
// Drive via window.__spike (see spike-editor.tsx). 404s in prod.
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { SpikeEditor, SpikeHud } from '@/components/documents/spike/spike-editor';
import { mdToSpans, sid, type SpikeBlock } from '@/components/documents/spike/rich';

function seed(n: number): SpikeBlock[] {
  const out: SpikeBlock[] = [
    { id: sid(), type: 'h1', spans: mdToSpans(`Spike — ${n.toLocaleString()} block hydration test`) },
    { id: sid(), type: 'text', spans: mdToSpans('Click anywhere. The focused block swaps to a live editor; everything else stays static HTML.') },
    { id: sid(), type: 'text', spans: [] }, // empty block: the worst CLS case
  ];
  for (let i = out.length; i < n; i++) {
    if (i % 40 === 0) out.push({ id: sid(), type: 'h2', spans: mdToSpans(`Section ${i / 40}`) });
    else if (i % 7 === 3) out.push({ id: sid(), type: 'bullet', spans: mdToSpans(`Bullet ${i} with a **bold tail**`) });
    else if (i % 5 === 0) out.push({ id: sid(), type: 'text', spans: mdToSpans(`Paragraph ${i} carrying **bold**, *italic*, \`code\`, ~~strike~~ and a [link](https://example.com/${i}) lifted from the legacy markdown-in-string encoding.`) });
    else out.push({ id: sid(), type: 'text', spans: mdToSpans(`Paragraph ${i} — plain filler so the document reaches Notion-scale length without repeating itself visually.`) });
  }
  return out;
}

export default function SpikePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [blocks, setBlocks] = useState<SpikeBlock[] | null>(null);
  useEffect(() => {
    // URL → state sync at mount: block count comes from ?n= (dev harness only).
    // Seeding client-side (not in the initializer) keeps SSR/CSR markup identical.
    const n = Number(new URLSearchParams(window.location.search).get('n')) || 2000;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks(seed(n));
  }, []);
  return (
    <div id="scroller" style={{ height: '100dvh', overflowY: 'auto', background: 'var(--paper)', color: 'var(--ink)' }}>
      <style>{`
        .sp-tb{white-space:pre-wrap;word-break:break-word}
        .sp-pm .ProseMirror{outline:none;white-space:pre-wrap;word-break:break-word}
        .sp-p{margin:0;padding:0}
        .sp-b{font-weight:600}
        .sp-i{font-style:italic}
        .sp-u{text-decoration:underline}
        .sp-s{text-decoration:line-through}
        .sp-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:85%;background:color-mix(in srgb,var(--ink,#111) 8%,transparent);border-radius:4px;padding:1px 4px}
        .sp-link{color:inherit;text-decoration:underline;text-underline-offset:2px}
        strong.sp-b{font-weight:600}
      `}</style>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 56px 60vh' }}>
        {blocks ? <SpikeEditor initial={blocks} /> : <div style={{ opacity: 0.5, fontSize: 14 }}>Seeding blocks…</div>}
      </div>
      {blocks && <SpikeHud />}
    </div>
  );
}
