// Rituals — daily planning / shutdown / weekly review guided flows.
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { RitualFlow, type RitualType, type RTask, type RGoal, type RProject, type RHabit } from '@/components/rituals/ritual-flow';
import { recomputeGoalProgress } from '@/lib/actions/goals';

export const dynamic = 'force-dynamic';

const TYPES: RitualType[] = ['daily_plan', 'daily_shutdown', 'weekly_review'];

export default async function RitualsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const type: RitualType = TYPES.includes(sp.type as RitualType) ? (sp.type as RitualType) : 'daily_plan';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sid = await activeSpaceId(supabase, user!.id);
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const tomorrowISO = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, done, highlight, estimate_minutes')
    .eq('space_id', sid)
    .eq('scheduled_date', todayISO)
    .order('sort_order');
  // Settle goal progress at the start of the weekly review (the spec's "at
  // review time, not live") so the goals glance below shows fresh numbers.
  if (type === 'weekly_review') await recomputeGoalProgress();

  const { data: goals } = await supabase.from('goals').select('id, title, behind, progress').eq('space_id', sid).order('created_at');

  // Daily-plan extra: the day's habits (+ whether each is already done today), so
  // the morning ritual and Habits are one cadence instead of two (§5.3 / §7G).
  let habits: RHabit[] = [];
  if (type === 'daily_plan') {
    const { data: hs } = await supabase.from('habits').select('id, title').eq('space_id', sid).eq('active', true).order('created_at');
    const rows = (hs as { id: string; title: string }[]) ?? [];
    if (rows.length) {
      const { data: logs } = await supabase.from('habit_logs').select('habit_id').eq('log_date', todayISO).eq('done', true).in('habit_id', rows.map((h) => h.id));
      const doneSet = new Set(((logs as { habit_id: string }[]) ?? []).map((l) => l.habit_id));
      habits = rows.map((h) => ({ id: h.id, title: h.title, done: doneSet.has(h.id) }));
    }
  }

  // Weekly-review extras: inbox depth + each active project's open-task count,
  // so the review can walk "clear the inbox" and "what needs a next action?".
  let inboxCount = 0;
  let projects: RProject[] = [];
  if (type === 'weekly_review') {
    const [inboxRes, projRes, openRes] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('space_id', sid).eq('is_inbox', true).eq('done', false),
      supabase.from('projects').select('id, name').eq('space_id', sid).eq('status', 'active').order('created_at'),
      supabase.from('tasks').select('project_id').eq('space_id', sid).eq('done', false).not('project_id', 'is', null),
    ]);
    inboxCount = inboxRes.count ?? 0;
    const openByProject = new Map<string, number>();
    for (const r of (openRes.data as { project_id: string }[]) ?? []) openByProject.set(r.project_id, (openByProject.get(r.project_id) ?? 0) + 1);
    projects = ((projRes.data as { id: string; name: string }[]) ?? []).map((p) => ({ id: p.id, name: p.name, openCount: openByProject.get(p.id) ?? 0 }));
  }

  return (
    <RitualFlow
      type={type}
      todayTasks={(tasks as RTask[]) ?? []}
      goals={(goals as RGoal[]) ?? []}
      habits={habits}
      todayISO={todayISO}
      tomorrowISO={tomorrowISO}
      inboxCount={inboxCount}
      projects={projects}
    />
  );
}
