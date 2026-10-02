'use client';
// Content: the product's own Content workspace, in its demo mode — the studio's pipeline of posts and
// videos from idea to published, one of them being filmed today (the same shoot Home shows). Link
// previews are primed from here with pictures drawn inline, so nothing is fetched from anywhere.
import * as React from 'react';
import { ContentWorkspace } from '@/components/content/content-workspace';
import type { Block } from '@/lib/blocks';
import { readContent, type Piece } from '@/lib/content';
import { primeLinkMeta } from '@/lib/use-link-meta';
import { dayFromToday } from '../fixtures';

// Module scope, as the harness learned: a new object each render is a new REFERENCE, and the view's
// server-state hook snaps back to its prop whenever the reference changes.
const STAGE_LABELS = {} as const;
const PROJECTS = [{ id: 'p-ridgeline', name: 'Ridgeline rebrand' }, { id: 'p-studio', name: 'Studio marketing' }];

const art = (from: string, to: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/></svg>`,
)}`;
primeLinkMeta('https://studio.example/work', { url: 'https://studio.example/work', title: 'Selected work, a studio case-study layout', siteName: 'studio.example', image: art('#e7e5e4', '#78716c') });
primeLinkMeta('https://video.example/rebrand', { url: 'https://video.example/rebrand', title: 'The rebrand nobody asked for', siteName: 'YouTube', image: art('#1e3a8a', '#9333ea') });

const piece = (id: string, title: string, pipeline: Record<string, unknown>, extra: Partial<Piece> = {}): Piece =>
  ({ id, title, meta: readContent({ blocks: [], pipeline }), ...extra });

function pieces(): Piece[] {
  const today = dayFromToday(0);
  return [
    piece('c-tour', 'Studio tour, part one', { stage: 'shoot', format: 'video', channel: 'YouTube', shootAt: today, publishAt: dayFromToday(12), callTime: '16:00', location: 'Studio' }),
    piece('c-brief', 'The 3-question client brief', { stage: 'script', format: 'short', channel: 'Instagram', publishAt: dayFromToday(8), shootAt: dayFromToday(2), callTime: '11:00', location: 'Rooftop' }),
    piece('c-pricing', 'How we price a rebrand', { stage: 'edit', format: 'video', channel: 'YouTube', publishAt: dayFromToday(5) }),
    piece('c-spotlight', 'Client spotlight, Ridgeline', { stage: 'review', format: 'post', channel: 'LinkedIn', publishAt: dayFromToday(3) },
      { projectId: 'p-ridgeline', approval: { id: 'ap-spotlight', status: 'awaiting', createdAt: dayFromToday(-1) } }),
    piece('c-fonts', 'Five fonts we keep coming back to', { stage: 'scheduled', format: 'carousel', channel: 'Instagram', publishAt: dayFromToday(1) }),
    piece('c-idea', 'Why most studio websites fail', { stage: 'idea', format: 'video', channel: 'YouTube' }),
    piece('c-rebrand', 'The rebrand nobody asked for', { stage: 'published', format: 'video', channel: 'YouTube', publishAt: dayFromToday(-11), liveUrl: 'https://video.example/rebrand' }),
    piece('n-hooks', 'Idea: the pricing video nobody makes', { bucket: 'inbox' }),
    piece('r-layout', 'A brilliant case-study layout', { bucket: 'reference', sourceUrl: 'https://studio.example/work', note: 'Problem, process, result, in that order.' }, { createdOn: dayFromToday(-3) }),
  ];
}

const shot = (id: string, text: string, checked = false): Block => ({ id, type: 'todo', text, checked });
const SCRIPTS: Record<string, Block[]> = {
  'c-tour': [
    { id: 'sc-1', type: 'h2', text: 'Opening' },
    shot('sc-2', 'Wide of the studio from the door', true),
    shot('sc-3', 'Slow push in on the desk'),
    { id: 'sc-4', type: 'text', text: 'Talk through how the week is planned.' },
    shot('sc-5', 'Cutaway: swatch book, shallow depth'),
  ],
};

export default function ContentDemo() {
  const list = React.useMemo(() => pieces(), []);
  return <ContentWorkspace initialPieces={list} projects={PROJECTS} todayISO={dayFromToday(0)} stageLabels={STAGE_LABELS} demoScripts={SCRIPTS} demo />;
}
