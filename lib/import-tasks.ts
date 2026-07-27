// Import parsers — principle 11's other half (§7S): "switching cost is the real
// competitor", so bring tasks IN as cleanly as export lets them OUT. Pure +
// tested (lib/import-tasks.test.ts). Supports Todoist's and TickTick's CSV
// exports and a generic header-mapped CSV (covers Things / any spreadsheet). The
// import UI + a batch create action consume ImportedTask[]; nothing here touches
// the DB. Together these three cover the Phase-2 cancelled-subscription test.

export type ImportedTask = {
  title: string;
  notes: string | null;
  priority: 'low' | 'med' | 'high';
  scheduledDate: string | null; // ISO yyyy-mm-dd (local)
  dueDate: string | null;
  projectName: string | null;
  done: boolean;
};

export type ImportFormat = 'todoist' | 'ticktick' | 'generic';
export type ImportResult = { format: ImportFormat; tasks: ImportedTask[]; skipped: number };

const norm = (s: string) => s.trim().toLowerCase();

// RFC-4180 reader: honors quoted fields, embedded commas/newlines, and doubled
// quotes. The inverse of export.ts's csvEscape.
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, ''); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

type Getter = (row: string[], ...names: string[]) => string;
function indexer(headers: string[]): Getter {
  const map = new Map(headers.map((h, i) => [norm(h), i] as const));
  return (row, ...names) => {
    for (const n of names) {
      const i = map.get(n);
      if (i != null && row[i] != null) return row[i].trim();
    }
    return '';
  };
}

export function detectFormat(headers: string[]): ImportFormat {
  const set = new Set(headers.map(norm));
  if (set.has('type') && set.has('content') && set.has('priority')) return 'todoist';
  if (set.has('title') && set.has('list name') && set.has('status')) return 'ticktick';
  return 'generic';
}

// Accept a real calendar date (ISO or anything Date can parse); reject recurring
// phrases ("every day") and empties → null. Output is local yyyy-mm-dd.
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Todoist CSV: rows are TYPE=task|section|note|''; only tasks import. PRIORITY is
// 1–4 where 4 is highest (app p1). No per-row project (Todoist exports one file
// per project) → projectName null; the import UI can assign one.
function todoistRow(get: Getter, row: string[]): ImportedTask | null {
  if (norm(get(row, 'type')) !== 'task') return null;
  const title = get(row, 'content');
  if (!title) return null;
  const p = get(row, 'priority');
  const priority = p === '4' ? 'high' : p === '3' ? 'med' : 'low';
  return {
    title,
    notes: get(row, 'description') || null,
    priority,
    scheduledDate: null,
    dueDate: parseDate(get(row, 'date')),
    projectName: null,
    done: false,
  };
}

// TickTick CSV: a metadata preamble (Date/Version/…) precedes a wide header
// (List Name, Title, Content, Priority, Status, Due Date, …). PRIORITY is
// 0/1/3/5 where 5 is highest. STATUS is 0=normal, 2=completed, -1=won't-do
// (skipped — never resurrect an abandoned task). List Name → project.
function ticktickRow(get: Getter, row: string[]): ImportedTask | null {
  const title = get(row, 'title');
  if (!title) return null;
  const status = get(row, 'status');
  if (status === '-1') return null;
  const p = get(row, 'priority');
  const priority = p === '5' ? 'high' : p === '3' ? 'med' : 'low';
  return {
    title,
    notes: get(row, 'content') || null,
    priority,
    scheduledDate: parseDate(get(row, 'start date')),
    dueDate: parseDate(get(row, 'due date')),
    projectName: get(row, 'list name', 'folder name') || null,
    done: status === '2',
  };
}

function genericRow(get: Getter, row: string[]): ImportedTask | null {
  const title = get(row, 'title', 'name', 'task', 'content', 'subject', 'todo', 'item');
  if (!title) return null;
  const prio = norm(get(row, 'priority', 'prio', 'importance'));
  const priority = /high|urgent|p1/.test(prio) ? 'high' : /med|normal|p2/.test(prio) ? 'med' : 'low';
  const doneRaw = norm(get(row, 'done', 'completed', 'complete', 'status'));
  const done = ['x', 'yes', 'true', 'done', 'completed', '1'].includes(doneRaw) || doneRaw.includes('done') || doneRaw.includes('complet');
  return {
    title,
    notes: get(row, 'notes', 'description', 'note', 'details') || null,
    priority,
    scheduledDate: parseDate(get(row, 'scheduled', 'start', 'start date', 'when', 'do date')),
    dueDate: parseDate(get(row, 'due', 'due date', 'deadline', 'date')),
    projectName: get(row, 'project', 'list', 'area', 'folder') || null,
    done,
  };
}

export function parseTasksCsv(text: string): ImportResult {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length < 2) return { format: 'generic', tasks: [], skipped: 0 };
  // Find the header row. Most exports put it first, but TickTick prepends a
  // metadata preamble (Date/Version/…) — scan the first rows for a known
  // signature before falling back to row 0 (generic).
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (detectFormat(rows[i]) !== 'generic') { headerIdx = i; break; }
  }
  const headers = rows[headerIdx];
  const format = detectFormat(headers);
  const get = indexer(headers);
  const map = format === 'todoist' ? todoistRow : format === 'ticktick' ? ticktickRow : genericRow;
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const t = map(get, r);
    if (t) tasks.push(t);
    else skipped++;
  }
  return { format, tasks, skipped };
}
