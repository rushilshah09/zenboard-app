'use client';
// Dev-only harness for the "Waiting for" chip (§7B, migration 0032). The chip
// lives in the task drawer, which needs a session, so this drives it directly
// with props and exercises every state: nothing set, blocked, satisfied, and at
// the cap. Refusal reasons are exercised too — the picker refuses for the same
// reasons the server does, and those are pure (lib/task-links.ts), so they can
// be shown here without a database.
//
// The task SEARCH inside the picker is the one part that needs a session; it
// degrades to "No tasks match", which is the honest empty state. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { BlockersChip, type Blocker } from '@/components/task-detail/blockers-chip';
import { MAX_BLOCKERS, type TaskLink } from '@/lib/task-links';

const link = (task: string, blockedBy: string): TaskLink => ({ task_id: task, blocked_by_task_id: blockedBy });

function Case({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--paper-2)' }}>
      <div style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>{note}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>{children}</div>
    </div>
  );
}

export default function BlockersPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <BlockersPreview />;
}

function BlockersPreview() {
  const [empty, setEmpty] = useState<Blocker[]>([]);
  const blockedLinks = [link('me', 'b1'), link('me', 'b2')];
  const cappedLinks = Array.from({ length: MAX_BLOCKERS }, (_, i) => link('cap', `c${i}`));

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 'var(--text-stat-size)', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--ink)' }}>Waiting for</h1>

        <Case title="Nothing set" note="Quiet chip, hollow glyph. The panel is just the search field.">
          <BlockersChip taskId="me" blockers={empty} links={[]}
            onAdd={(b) => setEmpty((bs) => [...bs, b])}
            onRemove={(id) => setEmpty((bs) => bs.filter((b) => b.id !== id))} />
        </Case>

        <Case title="Blocked" note="Two prerequisites, one still open — so the count is the OPEN one, and the dot is danger.">
          <BlockersChip taskId="me" links={blockedLinks}
            blockers={[{ id: 'b1', title: 'Sign off the brief', done: true }, { id: 'b2', title: 'Client sends the assets', done: false }]}
            onAdd={() => {}} onRemove={() => {}} />
        </Case>

        <Case title="Satisfied" note="Every prerequisite landed. Not “Blocked by 0” — the dependency still exists, it just isn’t holding anything up.">
          <BlockersChip taskId="me" links={blockedLinks}
            blockers={[{ id: 'b1', title: 'Sign off the brief', done: true }, { id: 'b2', title: 'Client sends the assets', done: true }]}
            onAdd={() => {}} onRemove={() => {}} />
        </Case>

        <Case title="At the cap" note={`${MAX_BLOCKERS} prerequisites. A task waiting on this many is a project nobody has split up yet.`}>
          <BlockersChip taskId="cap" links={cappedLinks}
            blockers={cappedLinks.map((l, i) => ({ id: l.blocked_by_task_id, title: `Prerequisite ${i + 1}`, done: i < 3 }))}
            onAdd={() => {}} onRemove={() => {}} />
        </Case>
      </div>
    </div>
  );
}
