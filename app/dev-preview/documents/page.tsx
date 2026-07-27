'use client';
// Dev-only harness for the Documents redesign (rail · filter toolbar · well grid ·
// card language), rendered with staged data so it can be verified without a
// session. 404s in prod, like the other dev-preview routes.
import { notFound } from 'next/navigation';
import { DocumentsView, type Folder, type Page } from '@/components/documents/documents-view';

const FOLDERS: Folder[] = [
  { id: 'f1', name: 'Life', parent_folder_id: null, sort_order: 0 },
  { id: 'f2', name: 'Folder name', parent_folder_id: null, sort_order: 1 },
  { id: 'f3', name: 'Folder name 2', parent_folder_id: null, sort_order: 2 },
];

const BODY = {
  blocks: [
    { id: 'b1', type: 'h3', text: 'How to use this template' },
    { id: 'b2', type: 'p', text: 'A freelancer portfolio is a collection of your professional work, abilities, and experiences that you can show to potential clients or employers. This template can help you create a portfolio of your own that showcases your skills and experiences.' },
    { id: 'b3', type: 'p', text: 'Go through the template and add your own information.' },
    { id: 'b4', type: 'h2', text: 'Kickoff agenda' },
    { id: 'b5', type: 'p', text: 'Introductions, project scope, timelines and deliverables.' },
    { id: 'b6', type: 'h2', text: 'Decisions' },
    { id: 'b7', type: 'p', text: 'Weekly sync every Tuesday. Invoices sent at month end.' },
    { id: 'b8', type: 'h3', text: 'Next steps' },
    { id: 'b9', type: 'p', text: 'Send the July invoice to TechSpark and share the portal link.' },
  ],
};

const monthsAgo = (n: number) => new Date(Date.now() - n * 2592000000).toISOString();

const DEMO_DB = {
  collection: {
    id: 'demo-col', page_id: 'pDb', name: 'Projects tracker',
    props: [
      { id: 'title', name: 'Name', type: 'title' as const },
      { id: 'status', name: 'Status', type: 'status' as const, options: [
        { id: 'not_started', name: 'Not started', color: 'gray' as const },
        { id: 'in_progress', name: 'In progress', color: 'blue' as const },
        { id: 'done', name: 'Done', color: 'green' as const },
      ] },
      { id: 'tags', name: 'Tags', type: 'multi_select' as const, options: [
        { id: 'design', name: 'Design', color: 'purple' as const },
        { id: 'dev', name: 'Dev', color: 'orange' as const },
      ] },
      { id: 'due', name: 'Due', type: 'date' as const },
      { id: 'hours', name: 'Hours', type: 'number' as const },
    ],
    views: [
      { id: 'v1', name: 'Table', kind: 'table' as const },
      { id: 'v2', name: 'Board', kind: 'board' as const, groupBy: 'status' },
      { id: 'v3', name: 'Gallery', kind: 'gallery' as const },
    ],
  },
  rows: [
    { id: 'r1', title: 'Portfolio site', data: { status: 'in_progress', tags: ['design'], due: '2026-07-20', hours: '12' }, sort_index: 1, created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r2', title: 'Client onboarding kit', data: { status: 'not_started', tags: ['design', 'dev'], hours: '6' }, sort_index: 2, created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r3', title: 'Invoice automation', data: { status: 'done', tags: ['dev'], due: '2026-06-30', hours: '20' }, sort_index: 3, created_at: monthsAgo(2), updated_at: monthsAgo(1) },
  ],
};

const PAGES: Page[] = [
  // Demo database — verifies Table / Board / Gallery without a session
  { id: 'pDb', folder_id: null, title: 'Projects tracker', type: 'database', content: { demoDb: DEMO_DB }, tags: [], updated_at: new Date(Date.now() - 120000).toISOString(), icon: '🗂' },
  // Empty page (no tags) — verifies "Empty page" body alignment
  { id: 'pEmpty', folder_id: null, title: 'Untitled', type: 'note', content: { blocks: [] }, tags: [], updated_at: new Date(Date.now() - 60000).toISOString(), icon: '☀️' },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: 'p' + i,
    folder_id: i >= 3 ? 'f1' : null,
    title: 'Meeting notes - Client kickoff',
    type: 'note',
    content: i === 0
      ? { ...BODY, cover: 'ruri', props: [{ id: 'pr1', name: 'Status', value: 'In progress' }], resources: [{ id: 'r1', url: 'https://linear.app', label: 'linear.app' }] }
      : BODY,
    tags: ['Client Meeting', 'TechSpark'],
    updated_at: monthsAgo(4),
    icon: i === 0 ? '🎯' : undefined,
  })),
];

export default function DocumentsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ height: '100dvh', background: 'var(--canvas)', padding: 8 }}>
      <div style={{ height: '100%', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <DocumentsView initialFolders={FOLDERS} initialPages={PAGES} userInitial="R" userName="Rushil Shah" />
      </div>
    </div>
  );
}
