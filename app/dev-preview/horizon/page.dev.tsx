'use client';
// Dev-only harness for the Horizon (Goals) view — confirms the rolled-up display:
// a goal LINKED TO A PROJECT shows its progress glyph + "N/M tasks" from that
// project's task completion (previously it fell back to a 0% stored value), while
// a steps-only goal still reads "N/M steps". Interactions error without a session
// (expected) — scripts/verify/verify-goals.mjs answers them instead. 404s in prod.
import { notFound, useSearchParams } from 'next/navigation';
import { HorizonView, type Goal, type GoalProject } from '@/components/horizon/horizon-view';
import { Toaster } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';

const projects: Record<string, GoalProject> = {
  p1: { id: 'p1', name: 'Ridgeline rebrand', color: '#B4166B' },
};

const GOALS: Goal[] = [
  {
    id: 'g1', title: 'Ship the rebrand', note: 'The quarter’s headline outcome.',
    horizon: 'quarter', target_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    status: 'active', progress: 0.6, project_id: 'p1',
    milestones: [], linkedDone: 3, linkedTotal: 5, // ← from the linked project's tasks
  },
  {
    id: 'g2', title: 'Grow the newsletter to 1,000', note: null,
    horizon: 'quarter', target_date: null, status: 'active', progress: 0.5, project_id: null,
    milestones: [
      { id: 'm1', title: 'Set up the signup page', done: true },
      { id: 'm2', title: 'Write the welcome sequence', done: false },
    ],
    linkedDone: 0, linkedTotal: 0, // ← no tasks/project → falls back to "N/M steps"
  },
  {
    id: 'g3', title: 'Reach $120k booked', note: null,
    horizon: 'year', target_date: new Date(Date.now() + 200 * 86400_000).toISOString().slice(0, 10),
    status: 'active', progress: 0.25, project_id: null,
    milestones: [], linkedDone: 0, linkedTotal: 0, // ← nothing linked → stored 25%
  },
];

export default function HorizonPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?v2=1 simulates migration 0026 (unlocks the retro line on "Mark done"). Read through the router — a mount effect
  // copying `location.search` into state rendered twice (react-hooks/set-state-in-effect).
  const goalsV2 = useSearchParams()?.get('v2') === '1';
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--canvas)' }}>
      <HorizonView initialGoals={GOALS} projects={projects} goalsV2={goalsV2} />
      {/* Its own <Toaster/> and failure net: dev-preview renders outside AppShell, which owns the app's single ones —
          without them a refused save here put the goal back SILENTLY (found verifying Goals, 2026-09-22). */}
      <Toaster />
      <ActionFailureNet />
    </div>
  );
}
