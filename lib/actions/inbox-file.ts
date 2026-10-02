'use server';
// ── "WHERE DOES THIS GO?", ANSWERED FOR THE WHOLE INBOX ──────────────────────
//
// §7Q's *File*, assembled: the rules first (lib/inbox-file.ts), a model only for what they could
// not place (lib/inbox-ai.ts), and NOTHING WRITTEN either way. A proposal becomes a filing when the
// person presses the key they would have pressed anyway, through the mutations triage already has.
//
// ON DEMAND, NEVER ON LOAD. The Tasks route is deliberately one wave of queries (see its header),
// and reading four more tables to decorate a screen nobody has asked to triage would put a model's
// latency in front of the Inbox. So this is an action: pressed, not arrived at.
//
// The reads are one wave of their own, and every one of them is scoped by RLS to the caller.

import { requireSession } from '@/lib/auth';
import { activeSpaceId } from '@/lib/active-space';
import { userTimezone } from '@/lib/user-tz';
import { generateJSON } from '@/lib/ai/gateway';
import {
  INBOX_FILE_MAX_TOKENS, INBOX_FILE_SYSTEM, MAX_PROJECTS, MAX_THOUGHTS, EXAMPLES_PER_PROJECT,
  filingInput, inboxFilingSchema, verifyFilings,
} from '@/lib/inbox-ai';
import {
  proposeAll, unplaced, FILE_MESSAGES,
  type FileFailure, type FileLabel, type FileProject, type FileProposals, type FiledTask, type FiledUnder, type Thought,
} from '@/lib/inbox-file';

/**
 * How much filing history the scorer learns from. Every filed task is one short title, so this is
 * a few tens of kilobytes at worst — and a person with more than this has years of habits, of which
 * the most recent are the ones that describe how they file TODAY.
 */
const HISTORY_LIMIT = 800;

/** THIS FILE EXPORTS ASYNC FUNCTIONS AND NOTHING ELSE. `FileFailure` and `FILE_MESSAGES` were
 *  declared here and are now in `lib/inbox-file.ts`: Next validates a `'use server'` module's
 *  exports when the module evaluates, so the one `export const` object took down every route that
 *  imported this file — the Tasks page rendered "A 'use server' file can only export async
 *  functions, found object." A type is erased and survives; a value does not. Don't re-export them
 *  from here either, for the same reason. */
type FileAnswer = {
  proposals: FileProposals[];
  /** A model was asked and could not answer. The rules' proposals are still here and still good. */
  modelFailed: boolean;
};

type Row = { id: string; title: string; project_id: string | null; is_inbox: boolean };

/**
 * Read the Inbox and say where each thought could go.
 *
 * The rules run over everything; the model is asked once, about the residue, and only when there is
 * a residue AND something to choose between. Its failure is not the feature's failure — the rules'
 * proposals are returned either way, which is the whole reason they come first.
 */
export async function suggestFiling(): Promise<{ error: string; reason: FileFailure } | FileAnswer> {
  const { supabase, user } = await requireSession();
  const spaceId = await activeSpaceId(supabase, user.id);

  // One wave. `open` is every unfinished task, which is both the filing history (the ones with a
  // project) and what a thought might duplicate (all of them) — one read, two uses. The label pair
  // is the same history read a second way: which labels this person puts on tasks worded how.
  const [openRes, projectRes, labelRes, taskLabelRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, project_id, is_inbox')
      .eq('space_id', spaceId).eq('done', false).is('parent_task_id', null)
      .order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
    supabase.from('projects')
      .select('id, name, status, clients(name)')
      .eq('space_id', spaceId).order('updated_at', { ascending: false }),
    supabase.from('labels').select('id, name').eq('space_id', spaceId).order('name'),
    supabase.from('task_labels').select('task_id, label_id'),
  ]);

  const rows = (openRes.data as Row[] | null) ?? [];
  const thoughts: Thought[] = rows.filter((r) => r.is_inbox && !r.project_id).map((r) => ({ id: r.id, title: r.title }));
  if (thoughts.length === 0) return { error: FILE_MESSAGES.empty, reason: 'empty' };

  type ProjectRow = { id: string; name: string; status: string | null; clients: { name: string } | { name: string }[] | null };
  const projects: FileProject[] = ((projectRes.data as ProjectRow[] | null) ?? [])
    // An archived project is not somewhere new work goes. Filing into one is a suggestion that
    // takes a thought OUT of the Inbox and hides it, which is the opposite of triage.
    .filter((p) => p.status !== 'archived')
    .map((p) => ({
      id: p.id,
      name: p.name,
      client: (Array.isArray(p.clients) ? p.clients[0]?.name : p.clients?.name) ?? null,
    }));

  const filed: FiledTask[] = rows
    .filter((r): r is Row & { project_id: string } => Boolean(r.project_id))
    .map((r) => ({ title: r.title, projectId: r.project_id }));
  const open = rows.map((r) => ({ id: r.id, title: r.title }));

  const labels = ((labelRes.data as FileLabel[] | null) ?? []);
  // Only the labelled tasks matter, and only the ones whose titles were loaded — a label on a task
  // outside this window has no words here to learn from.
  const titleById = new Map(rows.map((r) => [r.id, r.title]));
  const labelled: FiledUnder[] = ((taskLabelRes.data as { task_id: string; label_id: string }[] | null) ?? [])
    .flatMap((tl) => {
      const title = titleById.get(tl.task_id);
      // A thought still in the Inbox is what we are trying to label; learning from it would make
      // every already-labelled inbox item vote for its own label.
      return title && !thoughts.some((t) => t.id === tl.task_id) ? [{ title, bucketId: tl.label_id }] : [];
    });

  const proposals = proposeAll(thoughts, projects, filed, open, { filed: labelled, all: labels });
  const rest = unplaced(proposals, thoughts).slice(0, MAX_THOUGHTS);

  // Nothing to ask about, or nothing to choose between. One project is not a decision.
  if (rest.length === 0 || projects.length < 2) return { proposals, modelFailed: false };

  const examples = new Map<string, string[]>();
  for (const f of filed) {
    const eg = examples.get(f.projectId) ?? [];
    if (eg.length < EXAMPLES_PER_PROJECT) { eg.push(f.title); examples.set(f.projectId, eg); }
  }

  const res = await generateJSON({
    feature: 'inbox-file',
    system: INBOX_FILE_SYSTEM,
    input: filingInput(rest, projects.slice(0, MAX_PROJECTS), examples),
    schema: inboxFilingSchema,
    maxTokens: INBOX_FILE_MAX_TOKENS,
    userId: user.id,
    timeZone: await userTimezone(),
  });
  if (!res.ok) return { proposals, modelFailed: true };

  const fromModel = verifyFilings(res.data, rest, projects.slice(0, MAX_PROJECTS));
  return {
    proposals: proposals.map((p) => {
      const guess = !p.project && fromModel.get(p.thoughtId);
      return guess ? { ...p, project: guess } : p;
    }),
    modelFailed: false,
  };
}
