'use client';
// Dev-only harness for the app shell (sidebar + top bar + content), rendered with
// staged data so the nav/layout can be verified without a session. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Button, Icon, SegmentedControl } from '@/components/ds/ui';
import { Plus } from '@/components/ds/icons';

const SPACES = [{ id: 's1', name: "Rushil shah's workspace", emoji: '✦', color: '#9A1B6F', tag: 'WORK' as const }];

const TABS = [
  { value: 'clients', label: 'Clients' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'feedback', label: 'Feedback' },
];

export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <AppShell name="Rushil shah" email="designdotrushil@gmail.com" spaces={SPACES} pins={[
      { type: 'project', id: 'p1', label: 'Balluji rebrand' },
      { type: 'doc', id: 'd1', label: 'Q3 brief' },
      { type: 'task', id: 't1', label: 'Chase the contract signature' },
      { type: 'invoice', id: 'i1', label: 'INV-018 · TechSpark' },
    ] as const} activeSpaceId="s1">
      <Body />
    </AppShell>
  );
}

// The shell used to be harnessed with a static breadcrumb, which meant the ONE
// alignment that matters between the two header rows — app header above, page
// header below — could not be measured anywhere: every page-header harness
// renders outside AppShell, so there was no top bar to compare against. This
// puts both rows in one tree.
//
// The invariant (globals.css `--app-header-px`): the first content box in each
// row starts at the same inset from the panel edge, and the LAST box ends at it.
function Body() {
  const [tab, setTab] = useState('clients');
  return (
    <>
      <PageHeader
        tabs={<SegmentedControl aria-label="Section" options={TABS} value={tab} onValueChange={setTab} fit="content" />}
        actions={<Button size="sm" variant="primary" icon={<Icon icon={Plus} size={16} />}>New client</Button>}
      />
      <div style={{ padding: '32px 40px', color: 'var(--ink-3)', fontSize: 'var(--text-body-size)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-4)', fontSize: 'var(--text-small-size)' }}>
          <span>🔒 Private</span><span>›</span><span>Life</span><span>›</span><span>New page</span>
        </div>
      </div>
    </>
  );
}
