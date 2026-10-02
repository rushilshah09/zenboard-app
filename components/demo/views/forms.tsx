'use client';
// Forms: the product's own Forms hub — briefs and feedback forms, each tied to a project or a client.
import * as React from 'react';
import { FormsHub } from '@/components/forms/forms-hub';
import type { FormHubItem } from '@/lib/forms';

const iso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const PROJECTS = [{ id: 'p-ridgeline', name: 'Ridgeline rebrand' }, { id: 'p-beacon', name: 'Beacon Health site' }, { id: 'p-copper', name: 'Copper Row menus' }];
const CLIENTS = [{ id: 'c-ridgeline', name: 'Ridgeline' }, { id: 'c-beacon', name: 'Beacon Health' }, { id: 'c-copper', name: 'Copper Row' }];

export default function FormsDemo() {
  const items = React.useMemo<FormHubItem[]>(() => [
    { id: 'f-feedback', title: 'Design feedback, round 2', status: 'live', shareToken: 'demo-feedback', updatedAt: iso(1), responses: 12, partials: 3, context: { kind: 'project', id: 'p-ridgeline', name: 'Ridgeline rebrand' } },
    { id: 'f-kickoff', title: 'Project kickoff brief', status: 'live', shareToken: 'demo-kickoff', updatedAt: iso(4), responses: 1, partials: 0, context: { kind: 'project', id: 'p-beacon', name: 'Beacon Health site' } },
    { id: 'f-intake', title: 'New client intake', status: 'draft', shareToken: null, updatedAt: iso(9), responses: 0, partials: 0, context: { kind: 'client', id: 'c-copper', name: 'Copper Row' } },
    { id: 'f-testimonial', title: 'How did we do?', status: 'closed', shareToken: 'demo-closed', updatedAt: iso(30), responses: 5, partials: 0, context: { kind: 'client', id: 'c-ridgeline', name: 'Ridgeline' } },
  ], []);
  return <FormsHub items={items} projects={PROJECTS} clients={CLIENTS} />;
}
