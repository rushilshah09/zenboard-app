'use client';
// Dev-only harness for the database ROW peek after its migration from <Drawer>
// to <PageView> (INTERACTION_STANDARDS §2.11). Open a row: it must peek from the
// right with the universal toolbar (full-page · view-mode · ⋯ · close), the table
// behind must stay visible (non-modal side peek), editing a cell must NOT close
// the peek, and Delete now lives in the ⋯ menu. 404s in prod.
import { DatabasePage } from '@/components/documents/database-view';

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
    { id: 'r1', title: 'Portfolio site', data: { status: 'in_progress', tags: ['design'], due: '2026-07-20', hours: '12' }, order: 'a1', created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r2', title: 'Client onboarding kit', data: { status: 'not_started', tags: ['design', 'dev'], hours: '6' }, order: 'a2', created_at: monthsAgo(1), updated_at: monthsAgo(0) },
    { id: 'r3', title: 'Invoice automation', data: { status: 'done', tags: ['dev'], due: '2026-06-30', hours: '20' }, order: 'a3', created_at: monthsAgo(2), updated_at: monthsAgo(1) },
  ],
};

export default function DbRowHarness() {
  return (
    <div className="min-h-screen bg-paper p-6">
      <h1 className="mb-3 text-title-3 text-ink-900">Database row peek harness</h1>
      <DatabasePage pageId="pDb" demoDb={DEMO_DB} />
    </div>
  );
}
