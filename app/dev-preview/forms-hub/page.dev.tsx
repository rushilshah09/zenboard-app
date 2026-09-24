'use client';
// Dev-only harness for the global Forms hub (/forms). Seeds forms across a project
// and a client so the context chips, status filter, rows, and New-form modal can be
// verified without a session. Actions error without auth (expected). 404s in prod.
import { notFound } from 'next/navigation';
import { FormsHub } from '@/components/forms/forms-hub';
import type { FormHubItem } from '@/lib/forms';

const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const ITEMS: FormHubItem[] = [
  { id: 'f1', title: 'Design feedback — round 2', status: 'live', shareToken: 'demoToken1234567', updatedAt: iso(1), responses: 12, partials: 3, context: { kind: 'project', id: 'p1', name: 'Balluji rebrand' } },
  { id: 'f2', title: 'Project kickoff brief', status: 'live', shareToken: 'demoToken7654321', updatedAt: iso(4), responses: 1, partials: 0, context: { kind: 'project', id: 'p1', name: 'Balluji rebrand' } },
  { id: 'f3', title: 'New client intake', status: 'draft', shareToken: null, updatedAt: iso(9), responses: 0, partials: 0, context: { kind: 'client', id: 'c1', name: 'Meridian Studio' } },
  { id: 'f4', title: 'Testimonial request', status: 'closed', shareToken: 'demoToken0000001', updatedAt: iso(30), responses: 5, partials: 0, context: { kind: 'client', id: 'c1', name: 'Meridian Studio' } },
];

const PROJECTS = [{ id: 'p1', name: 'Balluji rebrand' }, { id: 'p2', name: 'Website refresh' }];
const CLIENTS = [{ id: 'c1', name: 'Meridian Studio' }, { id: 'c2', name: 'Acme Co' }];

export default function FormsHubPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)' }}>
      <FormsHub items={ITEMS} projects={PROJECTS} clients={CLIENTS} />
    </div>
  );
}
