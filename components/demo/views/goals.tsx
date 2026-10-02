'use client';
// Goals: the product's own Goals view. The first goal is linked to a project, so its progress is that
// project's tasks (lib/goal-rollup.ts); the others count their own steps, or what was recorded.
import * as React from 'react';
import { HorizonView, type Goal, type GoalProject } from '@/components/horizon/horizon-view';
import { dayFromToday } from '../fixtures';

const PROJECTS: Record<string, GoalProject> = { 'p-ridgeline': { id: 'p-ridgeline', name: 'Ridgeline rebrand', color: 'plum' } };

export default function GoalsDemo() {
  const goals = React.useMemo<Goal[]>(() => [
    { id: 'g-rebrand', title: 'Ship the Ridgeline rebrand', note: 'The quarter’s headline outcome.', horizon: 'quarter', target_date: dayFromToday(30), status: 'active', progress: 0.6, project_id: 'p-ridgeline', milestones: [], linkedDone: 8, linkedTotal: 13 },
    { id: 'g-newsletter', title: 'Grow the newsletter to 1,000', note: null, horizon: 'quarter', target_date: null, status: 'active', progress: 0.5, project_id: null,
      milestones: [{ id: 'gm-1', title: 'Set up the sign-up page', done: true }, { id: 'gm-2', title: 'Write the welcome sequence', done: false }, { id: 'gm-3', title: 'Publish every other Thursday', done: false }],
      linkedDone: 0, linkedTotal: 0 },
    { id: 'g-booked', title: 'Reach $120k booked', note: null, horizon: 'year', target_date: dayFromToday(200), status: 'active', progress: 0.42, project_id: null, milestones: [], linkedDone: 0, linkedTotal: 0 },
  ], []);
  return <HorizonView initialGoals={goals} projects={PROJECTS} goalsV2 />;
}
