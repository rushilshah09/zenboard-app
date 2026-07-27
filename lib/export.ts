// Export serializers — principle 11: every object has an exit. Pure functions
// (tested in lib/export.test.ts); the /api/export routes fetch RLS-scoped rows,
// map them into these shapes, and stream the result as a download.
import { parseRecurrence, describeRecurrence } from './recurrence';

export type ExportTask = {
  title: string;
  notes: string | null;
  done: boolean;
  status: string | null;
  priority: string;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  recurrence: unknown;
  is_inbox: boolean;
  space: string | null;
  project: string | null;
  section: string | null;
  parent: string | null;
  labels: string[];
};

// A field is quoted whenever it could break the row; quotes double per RFC 4180.
export function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const cell = (v: string | number | boolean | null | undefined) =>
  v == null ? '' : csvEscape(String(v));

export function tasksToCsv(tasks: ExportTask[]): string {
  const header = [
    'Title', 'Status', 'Priority', 'Scheduled', 'Due', 'Estimate (min)',
    'Repeats', 'Space', 'Project', 'Section', 'Subtask of', 'Labels', 'Inbox',
    'Notes', 'Completed at', 'Created at',
  ];
  const lines = tasks.map((t) => {
    const rec = parseRecurrence(t.recurrence);
    return [
      cell(t.title),
      cell(t.status ?? (t.done ? 'done' : 'todo')),
      cell(t.priority),
      cell(t.scheduled_date),
      cell(t.due_date),
      cell(t.estimate_minutes),
      cell(rec ? describeRecurrence(rec) : ''),
      cell(t.space),
      cell(t.project),
      cell(t.section),
      cell(t.parent),
      cell(t.labels.join(', ')),
      cell(t.is_inbox ? 'yes' : ''),
      cell(t.notes),
      cell(t.completed_at),
      cell(t.created_at),
    ].join(',');
  });
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

export type ExportProject = {
  name: string;
  status: string;
  client: string | null;
  space: string | null;
  created_at: string;
  sections: { name: string; tasks: ExportProjectTask[] }[];
  /** Tasks with no section. */
  tasks: ExportProjectTask[];
};

export type ExportProjectTask = {
  title: string;
  done: boolean;
  notes: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  subtasks: ExportProjectTask[];
};

function mdTask(t: ExportProjectTask, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const meta = [
    t.scheduled_date ? `scheduled ${t.scheduled_date}` : null,
    t.due_date ? `due ${t.due_date}` : null,
    t.estimate_minutes ? `${t.estimate_minutes}m` : null,
  ].filter(Boolean).join(' · ');
  const lines = [`${pad}- [${t.done ? 'x' : ' '}] ${t.title}${meta ? ` (${meta})` : ''}`];
  if (t.notes?.trim()) {
    for (const n of t.notes.trim().split('\n')) lines.push(`${pad}  ${n}`);
  }
  for (const s of t.subtasks) lines.push(...mdTask(s, depth + 1));
  return lines;
}

export function projectsToMarkdown(projects: ExportProject[], exportedOnISO: string): string {
  const out: string[] = [`# Zenboard projects — exported ${exportedOnISO}`, ''];
  for (const p of projects) {
    out.push(`## ${p.name}`);
    const meta = [
      `Status: ${p.status}`,
      p.client ? `Client: ${p.client}` : null,
      p.space ? `Space: ${p.space}` : null,
    ].filter(Boolean).join(' · ');
    out.push(meta, '');
    for (const s of p.sections) {
      if (!s.tasks.length) continue;
      out.push(`### ${s.name}`, '');
      for (const t of s.tasks) out.push(...mdTask(t, 0));
      out.push('');
    }
    if (p.tasks.length) {
      if (p.sections.some((s) => s.tasks.length)) out.push('### Other tasks', '');
      for (const t of p.tasks) out.push(...mdTask(t, 0));
      out.push('');
    }
    if (!p.tasks.length && !p.sections.some((s) => s.tasks.length)) out.push('_No tasks._', '');
  }
  return out.join('\n');
}
