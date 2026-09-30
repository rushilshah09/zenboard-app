// Zenboard AI tools — what the assistant can look at. SERVER ONLY.
//
// Every read runs through the signed-in user's Supabase client, so RLS is the
// security boundary: the model can only ever see the caller's own rows. There
// are no write tools. `propose_tasks` only hands suggestions back to the UI,
// where the user adds them with a tap (MASTER_PRODUCT_PLAN §7Q: Zenboard AI
// never creates, schedules, or files anything on its own).
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';
import type { ProposedTask } from '@/lib/ai/chat-protocol';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ToolContext = {
  supabase: Supabase;
  spaceId: string;
  today: string; // the user's local ISO date
};

export type ToolOutcome = {
  /** What goes back to the model as the tool_result. */
  result: string;
  isError?: boolean;
  /** Suggestions to render as tappable cards (propose_tasks only). */
  proposals?: ProposedTask[];
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const GetTasks = z.object({
  view: z.enum(['today', 'overdue', 'inbox', 'upcoming', 'recently_completed', 'search']),
  query: z.string().optional(),
  project_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
const GetProjects = z.object({ include_inactive: z.boolean().optional() });
const GetCalendar = z.object({ from: isoDate, to: isoDate });
const GetFinance = z.object({});
const ProposeTasks = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    notes: z.string().max(2000).optional(),
    priority: z.enum(['low', 'med', 'high']).optional(),
    scheduled_date: isoDate.optional(),
    due_date: isoDate.optional(),
    project_id: z.string().optional(),
  })).min(1).max(12),
});

// Small inputs throughout, so eager input streaming costs nothing and keeps the
// stream lively; every input is still validated with zod before it runs.
export const CHAT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_tasks',
    description:
      "Read the user's tasks in the active space. Views: today (scheduled for today, not done), overdue (scheduled or due before today, not done), inbox (captured, not yet triaged), upcoming (next 14 days), recently_completed (done in the last 7 days), search (title/notes match `query`). Optionally filter by project_id. Returns id, title, priority, dates, project and done state.",
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['today', 'overdue', 'inbox', 'upcoming', 'recently_completed', 'search'] },
        query: { type: 'string', description: 'Text to search for (view=search).' },
        project_id: { type: 'string', description: 'Only tasks in this project.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 40.' },
      },
      required: ['view'],
    },
  },
  {
    name: 'get_projects',
    description: "List the user's projects in the active space with open-task counts. Active projects only unless include_inactive is true.",
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: { include_inactive: { type: 'boolean' } },
    },
  },
  {
    name: 'get_calendar',
    description: "Read calendar events between two dates (inclusive, YYYY-MM-DD). Use for scheduling questions and day planning.",
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_finance_summary',
    description: 'Summarize invoices: totals by status (draft, sent, overdue, paid), amounts still outstanding, and the invoices past due.',
    eager_input_streaming: true,
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'propose_tasks',
    description:
      "Suggest new tasks for the user. This does NOT create anything — each suggestion appears as a card the user can add with one tap. Use it whenever your answer implies concrete to-dos (a plan, next steps, a checklist). Use project_id values from get_projects.",
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short, verb-first.' },
              notes: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'med', 'high'] },
              scheduled_date: { type: 'string', description: 'YYYY-MM-DD — the day to work on it.' },
              due_date: { type: 'string', description: 'YYYY-MM-DD — the deadline.' },
              project_id: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
      required: ['tasks'],
    },
  },
];

/** Status line shown in the UI while a tool runs. */
export function toolStatus(name: string): string {
  switch (name) {
    case 'get_tasks': return 'Looking at your tasks';
    case 'get_projects': return 'Checking your projects';
    case 'get_calendar': return 'Reading your calendar';
    case 'get_finance_summary': return 'Reviewing invoices';
    case 'propose_tasks': return 'Drafting tasks';
    default: return 'Working';
  }
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const invalid = (err: z.ZodError): ToolOutcome => ({
  result: `Invalid input: ${err.issues.map((i) => `${i.path.join('.') || 'input'} ${i.message}`).join('; ')}`,
  isError: true,
});

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const { supabase, spaceId, today } = ctx;
  switch (name) {
    case 'get_tasks': {
      const p = GetTasks.safeParse(input);
      if (!p.success) return invalid(p.error);
      const { view, query, project_id, limit = 40 } = p.data;
      let q = supabase
        .from('tasks')
        .select('id, title, notes, priority, done, scheduled_date, due_date, is_inbox, completed_at, project_id, projects(name)')
        .eq('space_id', spaceId)
        .is('parent_task_id', null)
        .limit(limit);
      if (project_id) q = q.eq('project_id', project_id);
      switch (view) {
        case 'today': q = q.eq('done', false).eq('scheduled_date', today); break;
        case 'overdue': q = q.eq('done', false).or(`scheduled_date.lt.${today},due_date.lt.${today}`); break;
        case 'inbox': q = q.eq('done', false).eq('is_inbox', true); break;
        case 'upcoming': q = q.eq('done', false).gt('scheduled_date', today).lte('scheduled_date', addDays(today, 14)).order('scheduled_date'); break;
        case 'recently_completed': q = q.eq('done', true).gte('completed_at', `${addDays(today, -7)}T00:00:00Z`).order('completed_at', { ascending: false }); break;
        case 'search': {
          const term = (query ?? '').replace(/[%,()]/g, ' ').trim();
          if (!term) return { result: 'Provide `query` for view=search.', isError: true };
          q = q.or(`title.ilike.%${term}%,notes.ilike.%${term}%`);
          break;
        }
      }
      const { data, error } = await q;
      if (error) return { result: `Could not read tasks: ${error.message}`, isError: true };
      type Row = { id: string; title: string; notes: string | null; priority: string; done: boolean; scheduled_date: string | null; due_date: string | null; is_inbox: boolean; projects: { name: string } | null };
      const rows = ((data ?? []) as unknown as Row[]).map((r) => {
        return {
          id: r.id, title: r.title, priority: r.priority, done: r.done,
          scheduled: r.scheduled_date, due: r.due_date, inbox: r.is_inbox,
          project: r.projects?.name ?? null,
          notes: r.notes ? r.notes.slice(0, 280) : null,
        };
      });
      return { result: JSON.stringify({ view, count: rows.length, tasks: rows }) };
    }

    case 'get_projects': {
      const p = GetProjects.safeParse(input ?? {});
      if (!p.success) return invalid(p.error);
      let q = supabase.from('projects').select('id, name, status').eq('space_id', spaceId).order('created_at');
      if (!p.data.include_inactive) q = q.eq('status', 'active');
      const [{ data: projects, error }, { data: open }] = await Promise.all([
        q,
        supabase.from('tasks').select('project_id').eq('space_id', spaceId).eq('done', false).not('project_id', 'is', null),
      ]);
      if (error) return { result: `Could not read projects: ${error.message}`, isError: true };
      const counts = new Map<string, number>();
      for (const t of open ?? []) if (t.project_id) counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1);
      return { result: JSON.stringify((projects ?? []).map((pr) => ({ ...pr, open_tasks: counts.get(pr.id) ?? 0 }))) };
    }

    case 'get_calendar': {
      const p = GetCalendar.safeParse(input);
      if (!p.success) return invalid(p.error);
      const { from, to } = p.data;
      if (to < from) return { result: '`to` must be on or after `from`.', isError: true };
      const { data, error } = await supabase
        .from('calendar_events')
        .select('title, starts_at, ends_at, all_day')
        .gte('starts_at', `${from}T00:00:00Z`)
        .lt('starts_at', `${addDays(to, 1)}T00:00:00Z`)
        .order('starts_at')
        .limit(200);
      if (error) return { result: `Could not read the calendar: ${error.message}`, isError: true };
      return { result: JSON.stringify({ from, to, events: data ?? [] }) };
    }

    case 'get_finance_summary': {
      const p = GetFinance.safeParse(input ?? {});
      if (!p.success) return invalid(p.error);
      const { data, error } = await supabase
        .from('invoices')
        .select('id, number, status, due_date, clients(name), invoice_items(quantity, unit_amount), payments(amount)')
        .neq('status', 'void')
        .limit(500);
      if (error) return { result: `Could not read invoices: ${error.message}`, isError: true };
      type Inv = { id: string; number: string; status: string; due_date: string | null; clients: { name: string } | null; invoice_items: { quantity: number; unit_amount: number }[]; payments: { amount: number }[] };
      const byStatus: Record<string, { count: number; total: number }> = {};
      const pastDue: { number: string; client: string | null; due: string | null; outstanding: number }[] = [];
      let outstanding = 0;
      for (const inv of (data ?? []) as unknown as Inv[]) {
        const total = inv.invoice_items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_amount), 0);
        const paid = inv.payments.reduce((s, x) => s + Number(x.amount), 0);
        const owed = Math.max(0, total - paid);
        const b = (byStatus[inv.status] ??= { count: 0, total: 0 });
        b.count += 1;
        b.total += total;
        if (inv.status === 'sent' || inv.status === 'overdue') {
          outstanding += owed;
          if (inv.due_date && inv.due_date < today && owed > 0) pastDue.push({ number: inv.number, client: inv.clients?.name ?? null, due: inv.due_date, outstanding: owed });
        }
      }
      return { result: JSON.stringify({ by_status: byStatus, outstanding, past_due: pastDue }) };
    }

    case 'propose_tasks': {
      const p = ProposeTasks.safeParse(input);
      if (!p.success) return invalid(p.error);
      const proposals: ProposedTask[] = p.data.tasks.map((t) => ({
        title: t.title.trim(),
        notes: t.notes?.trim() || null,
        priority: t.priority ?? null,
        scheduledDate: t.scheduled_date ?? null,
        dueDate: t.due_date ?? null,
        projectId: t.project_id ?? null,
      }));
      return {
        result: `Shown ${proposals.length} suggested task(s) to the user as cards. Nothing is created until they tap Add — don't claim the tasks exist.`,
        proposals,
      };
    }

    default:
      return { result: `Unknown tool: ${name}`, isError: true };
  }
}
