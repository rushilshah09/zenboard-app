'use server';
// ── THE SIX MOMENTS, AS FACTS ───────────────────────────────────────────────
//
// §7Q's *Draft*, assembled. lib/draft.ts holds the rules — what the model is told, how long, who is
// reading, and the check that refuses a draft claiming anything unrecorded. This file is the only
// part that touches the database, and all it does is turn rows into the RECORD: labelled lines a
// person could read as they stand.
//
// THE RECORD IS THE PRODUCT. A draft is only as good as the facts under it, and the facts are what
// Zenboard already holds and its competitors do not — the completions, the time entries, the
// invoice lines, the milestones. That is why every moment below is a query and a sentence, and why
// nothing here asks a model for a fact.
//
// NOTHING IS WRITTEN. Not the draft, not a placeholder, not a "drafted at" stamp. It goes back to
// the box the person was already typing in.

import { requireSession } from '@/lib/auth';
import { activeSpaceId } from '@/lib/active-space';
import { userTimezone } from '@/lib/user-tz';
import { addDaysISO, dayWindow, formatDay, formatMinutes, todayISO } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { generateJSON } from '@/lib/ai/gateway';
import { CLIENT_UPDATE } from '@/lib/updates';
import {
  DRAFT_MAX_TOKENS, DRAFT_MESSAGES, draftInput, draftSchema, draftSystem, enoughToDraft,
  verifyDraft, type DraftMoment, type DraftProblem, type Fact,
} from '@/lib/draft';

/** How many of the person's own past updates are shown as the voice. */
const VOICE_EXAMPLES = 3;
/** Lines per group. A record longer than this stops being a record and becomes a dump. */
const MAX_LINES = 12;

export type DraftAnswer = { draft: string } | { error: string; reason: DraftProblem };

const fail = (reason: DraftProblem): DraftAnswer => ({ error: DRAFT_MESSAGES[reason], reason });

type DB = Awaited<ReturnType<typeof requireSession>>['supabase'];

const titles = (rows: { title: string }[] | null) => (rows ?? []).slice(0, MAX_LINES).map((r) => r.title);

/** Everything the person finished, and what it cost them, between two instants. */
async function work(db: DB, spaceId: string, startISO: string, endISO: string): Promise<Fact[]> {
  const [done, time] = await Promise.all([
    db.from('tasks').select('title, project_id, projects(name)')
      .eq('space_id', spaceId).eq('done', true)
      .gte('completed_at', startISO).lt('completed_at', endISO)
      .order('completed_at', { ascending: true }).limit(MAX_LINES),
    db.from('time_entries').select('minutes, project_id, projects(name)')
      .gte('started_at', startISO).lt('started_at', endISO),
  ]);

  type Named = { name: string } | null;

  const finished = ((done.data as unknown as { title: string; projects: Named }[] | null) ?? [])
    .map((t) => (t.projects?.name ? `${t.title} (${t.projects.name})` : t.title));

  // Minutes are SUMMED PER PROJECT and written as this app writes a duration everywhere else.
  // The model is told never to calculate; that means the arithmetic has to be done here.
  const byProject = new Map<string, number>();
  for (const e of ((time.data as unknown as { minutes: number | null; projects: Named }[] | null) ?? [])) {
    const n = e.projects?.name ?? 'Unassigned';
    byProject.set(n, (byProject.get(n) ?? 0) + (Number(e.minutes) || 0));
  }
  const logged = [...byProject.entries()]
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LINES)
    .map(([n, m]) => `${formatMinutes(m, { long: true })} on ${n}`);

  return [
    { label: 'Finished', lines: finished },
    { label: 'Time logged', lines: logged },
  ];
}

/** The person's own past writing on this project, newest first — the voice, never a setting. */
async function voiceOf(db: DB, projectId: string): Promise<string[]> {
  const { data } = await db.from('project_activity')
    .select('body').eq('project_id', projectId).eq('type', CLIENT_UPDATE)
    .order('created_at', { ascending: false }).limit(VOICE_EXAMPLES);
  return ((data as { body: string | null }[] | null) ?? [])
    .map((r) => (r.body ?? '').trim()).filter(Boolean);
}

async function facts(db: DB, spaceId: string, moment: DraftMoment, id: string | undefined, tz: string):
Promise<{ facts: Fact[]; voice: string[] } | null> {
  const today = todayISO(tz);

  if (moment === 'shutdown') {
    const { startISO, endISO } = dayWindow(today, tz);
    const [did, meetings] = await Promise.all([
      work(db, spaceId, startISO, endISO),
      db.from('meetings').select('title').gte('met_at', startISO).lt('met_at', endISO).limit(MAX_LINES),
    ]);
    return { facts: [...did, { label: 'Met with', lines: titles(meetings.data as { title: string }[] | null) }], voice: [] };
  }

  if (moment === 'weekly-review') {
    const { startISO } = dayWindow(addDaysISO(today, -6), tz);
    const { endISO } = dayWindow(today, tz);
    const [did, goals] = await Promise.all([
      work(db, spaceId, startISO, endISO),
      db.from('goals').select('title, behind, progress').eq('space_id', spaceId).eq('status', 'active').limit(MAX_LINES),
    ]);
    const goalLines = ((goals.data as { title: string; behind: boolean; progress: number }[] | null) ?? [])
      // Progress is a ratio in the database and a percentage nowhere else in this record; it is
      // written out here so the model never has to turn 0.4 into anything.
      .map((g) => `${g.title}: ${Math.round(Number(g.progress) * 100)}% done${g.behind ? ', behind' : ''}`);
    return { facts: [...did, { label: 'Goals', lines: goalLines }], voice: [] };
  }

  if (!id) return null;

  if (moment === 'client-update') {
    const { data: project } = await db.from('projects')
      .select('id, name, clients(name)').eq('id', id).maybeSingle();
    if (!project) return null;
    const p = project as unknown as { name: string; clients: { name: string } | null };
    const client = p.clients?.name ?? null;

    // Since the LAST thing they told this client — which is exactly the span an update covers.
    const { data: last } = await db.from('project_activity')
      .select('created_at').eq('project_id', id).eq('type', CLIENT_UPDATE)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const since = (last as { created_at: string } | null)?.created_at
      ?? dayWindow(addDaysISO(todayISO(tz), -14), tz).startISO;

    const [done, next, voice] = await Promise.all([
      db.from('tasks').select('title').eq('project_id', id).eq('done', true)
        .gte('completed_at', since).order('completed_at', { ascending: true }).limit(MAX_LINES),
      db.from('tasks').select('title').eq('project_id', id).eq('done', false)
        .order('scheduled_date', { ascending: true, nullsFirst: false }).limit(5),
      voiceOf(db, id),
    ]);
    return {
      facts: [
        { label: 'Project', lines: [client ? `${p.name}, for ${client}` : p.name] },
        { label: `Finished since ${formatDay(since) ?? 'the last update'}`, lines: titles(done.data as { title: string }[] | null) },
        { label: 'Coming up next', lines: titles(next.data as { title: string }[] | null) },
      ],
      voice,
    };
  }

  if (moment === 'invoice-note') {
    const { data: invoice } = await db.from('invoices')
      .select('id, number, due_date, clients(name), projects(name), invoice_items(description, quantity, unit_amount)')
      .eq('id', id).maybeSingle();
    if (!invoice) return null;
    type Item = { description: string; quantity: number | null; unit_amount: number | null };
    const inv = invoice as unknown as {
      number: string; due_date: string | null;
      clients: { name: string } | null;
      projects: { name: string } | null;
      invoice_items: Item[] | null;
    };
    const items = inv.invoice_items ?? [];
    // The total is arithmetic, so it is done here and written as money, once.
    const total = items.reduce((n, i) => n + (Number(i.quantity) || 0) * (Number(i.unit_amount) || 0), 0);
    return {
      facts: [
        { label: 'Invoice', lines: [`${inv.number} for ${formatMoney(total, { exact: true })}`] },
        { label: 'For', lines: [[inv.projects?.name, inv.clients?.name].filter(Boolean).join(', for ')].filter(Boolean) },
        { label: 'Lines', lines: items.slice(0, MAX_LINES).map((i) => i.description) },
        { label: 'Due', lines: inv.due_date ? [formatDay(inv.due_date, { weekday: true }) ?? inv.due_date] : [] },
      ],
      voice: [],
    };
  }

  if (moment === 'close-out') {
    const { data: project } = await db.from('projects').select('id, name, clients(name)').eq('id', id).maybeSingle();
    if (!project) return null;
    const p = project as unknown as { name: string; clients: { name: string } | null };
    const client = p.clients?.name ?? null;
    const [done, time, notes] = await Promise.all([
      db.from('tasks').select('title').eq('project_id', id).eq('done', true)
        .order('completed_at', { ascending: true }).limit(MAX_LINES),
      db.from('time_entries').select('minutes').eq('project_id', id),
      db.from('project_activity').select('body').eq('project_id', id).eq('type', 'note')
        .order('created_at', { ascending: false }).limit(5),
    ]);
    const minutes = ((time.data as { minutes: number | null }[] | null) ?? [])
      .reduce((n, e) => n + (Number(e.minutes) || 0), 0);
    return {
      facts: [
        { label: 'Project', lines: [client ? `${p.name}, for ${client}` : p.name] },
        { label: 'Delivered', lines: titles(done.data as { title: string }[] | null) },
        { label: 'Time on it', lines: minutes > 0 ? [formatMinutes(minutes, { long: true })] : [] },
        {
          label: 'Notes written along the way',
          lines: ((notes.data as { body: string | null }[] | null) ?? []).map((n) => (n.body ?? '').trim()).filter(Boolean),
        },
      ],
      voice: [],
    };
  }

  return null;
}

/**
 * The first draft for one moment, or the reason there is none.
 *
 * `brief` is the person's own words, and only *proposal-scope* takes one — the app cannot know what
 * somebody is about to propose, and a model asked to invent a scope would invent the commitment
 * too. Every other moment reads the record and takes nothing.
 */
export async function draftFor(moment: DraftMoment, id?: string, brief?: string): Promise<DraftAnswer> {
  const { supabase, user } = await requireSession();
  const spaceId = await activeSpaceId(supabase, user.id);
  const tz = await userTimezone();

  let gathered: { facts: Fact[]; voice: string[] } | null;
  if (moment === 'proposal-scope') {
    const words = (brief ?? '').trim().slice(0, 2_000);
    if (words.length < 20) return fail('nothing');
    const { data: project } = id
      ? await supabase.from('projects').select('name, clients(name)').eq('id', id).maybeSingle()
      : { data: null };
    const p = project as unknown as { name: string; clients: { name: string } | null } | null;
    const client = p?.clients?.name ?? null;
    gathered = {
      facts: [
        { label: 'For', lines: p ? [client ? `${p.name}, for ${client}` : p.name] : [] },
        { label: 'What they asked for, in the freelancer’s own words', lines: words.split('\n').map((l) => l.trim()).filter(Boolean) },
      ],
      voice: [],
    };
  } else {
    gathered = await facts(supabase, spaceId, moment, id, tz);
  }

  if (!gathered || !enoughToDraft(gathered.facts)) return fail('nothing');

  const input = draftInput(gathered.facts, gathered.voice);
  const res = await generateJSON({
    feature: 'draft',
    system: draftSystem(moment),
    input,
    schema: draftSchema,
    maxTokens: DRAFT_MAX_TOKENS,
    userId: user.id,
    timeZone: tz,
  });
  if (!res.ok) return fail(res.reason);

  // Checked against the RECORD ONLY — never against the voice examples, which are the person's
  // older writing and name things that are no longer true.
  const checked = verifyDraft(res.data, input.slice(0, input.indexOf('</record>') + 9));
  return checked.ok ? { draft: checked.draft } : fail(checked.problem);
}
