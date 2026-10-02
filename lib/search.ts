// Search v2 (master plan §7J) — cross-entity search that looks INSIDE things.
//
// Phase 4 ends when "a week's notes, briefs & lists live in Docs; **search finds
// everything**". Until now search matched titles only, so a note called
// "Untitled" whose body discussed the Meridian rebrand was unfindable — the exact
// case Docs is supposed to win. This adds body matching for documents and notes
// matching for tasks, and returns the matching LINE, not just the record.
//
// Two-stage by design:
//   1. the database does a coarse pre-filter (a jsonb `ilike` over the whole
//      content blob, which also matches block ids and type names — noisy);
//   2. `snippetAround` re-checks the real visible text client-side and DROPS the
//      hit if the term only ever appeared in JSON scaffolding.
// So false positives from stage 1 never reach the user, and stage 1 can be
// swapped for a proper FTS index (0028, drafted) without touching stage 2.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { recordHref, statusMeta, type EntityType } from '@/lib/connected';
import { formatDay } from '@/lib/date';

type DB = SupabaseClient<Database>;

export type SearchHit = {
  key: string;
  type: EntityType;
  id: string;
  title: string;
  /** The matching line from the body, when the match wasn't in the title. */
  snippet?: string;
  meta?: string;
  href?: string;
};

/** How much context to keep either side of a body match. */
const SNIPPET_RADIUS = 42;

/**
 * Flatten a page's stored content to the plain visible text a person actually
 * typed. Mirrors the block model in lib/blocks.ts: `text` is always plain, tables
 * keep their cells, and the legacy `{ text }` prose shape still reads.
 * Pure — exported for tests.
 */
export function docText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const c = content as { blocks?: unknown; text?: unknown };
  if (typeof c.text === 'string') return c.text;           // legacy prose page
  if (!Array.isArray(c.blocks)) return '';

  const lines: string[] = [];
  for (const raw of c.blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as { text?: unknown; rows?: unknown };
    if (typeof b.text === 'string' && b.text.trim()) lines.push(b.text);
    if (Array.isArray(b.rows)) {
      for (const row of b.rows) {
        if (Array.isArray(row)) {
          const cells = row.filter((x): x is string => typeof x === 'string' && !!x.trim());
          if (cells.length) lines.push(cells.join(' · '));
        }
      }
    }
  }
  return lines.join('\n');
}

/**
 * The one line containing `term`, trimmed to a readable window with ellipses.
 * Returns undefined when the term isn't genuinely present — which is how coarse
 * database pre-filter hits get discarded. Pure; exported for tests.
 */
export function snippetAround(body: string, term: string): string | undefined {
  if (!body || !term) return undefined;
  const at = body.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return undefined;

  // Prefer the matching LINE — a snippet that spans a paragraph break reads as
  // two unrelated fragments glued together.
  const lineStart = body.lastIndexOf('\n', at) + 1;
  const lineEndRaw = body.indexOf('\n', at);
  const lineEnd = lineEndRaw === -1 ? body.length : lineEndRaw;
  const line = body.slice(lineStart, lineEnd);
  const inLine = at - lineStart;

  if (line.length <= SNIPPET_RADIUS * 2) return line.trim();

  const from = Math.max(0, inLine - SNIPPET_RADIUS);
  const to = Math.min(line.length, inLine + term.length + SNIPPET_RADIUS);
  return `${from > 0 ? '…' : ''}${line.slice(from, to).trim()}${to < line.length ? '…' : ''}`;
}

// Never let one failing source (a table behind an unapplied migration, a jsonb
// filter an older PostgREST rejects) take down the whole search.
async function safe<T>(run: () => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try {
    const { data } = await run();
    return data ?? [];
  } catch {
    return [];
  }
}

const hit = (type: EntityType, id: string, title: string, extra: Partial<SearchHit> = {}): SearchHit => ({
  key: `${type}:${id}`,
  type, id,
  title: title?.trim() || 'Untitled',
  href: recordHref(type, id),
  ...extra,
});

export type SearchResults = {
  hits: SearchHit[];
  /** True when body matching ran — false means titles only (jsonb filter unsupported). */
  deep: boolean;
};

/**
 * Search documents and tasks by title AND body. Other entity types are matched by
 * name in the command palette, which owns their per-type limits and glyphs; this
 * module exists for the two that have prose worth looking inside.
 */
export async function searchDeep(db: DB, term: string, limit = 5): Promise<SearchResults> {
  const q = term.trim();
  if (q.length < 2) return { hits: [], deep: false };
  const like = `%${q}%`;

  // The jsonb pre-filter is the part most likely to be unsupported, so it is its
  // own query: if it fails we still return title matches rather than nothing.
  //
  // `database_id is null` keeps DOCUMENTS out of the same result list as database
  // rows. Since 0028 a row is also a `pages` row, and a search for "invoice" was
  // returning every row of a tracker alongside the docs — the same string, two
  // meanings. Rows will get their own result kind once the reader migration lands.
  const [byTitle, byBody, taskNotes] = await Promise.all([
    safe<{ id: string; title: string | null; content: unknown }>(() =>
      db.from('pages').select('id,title,content').ilike('title', like)
        .is('archived_at', null).is('database_id', null).order('updated_at', { ascending: false }).limit(limit)),
    safe<{ id: string; title: string | null; content: unknown }>(() =>
      db.from('pages').select('id,title,content').ilike('content->>blocks', like)
        .is('archived_at', null).is('database_id', null).order('updated_at', { ascending: false }).limit(limit * 3)),
    safe<{ id: string; title: string; notes: string | null }>(() =>
      db.from('tasks').select('id,title,notes').ilike('notes', like)
        .eq('done', false).order('updated_at', { ascending: false }).limit(limit)),
  ]);

  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const p of byTitle) {
    seen.add(p.id);
    hits.push(hit('doc', p.id, p.title ?? 'Untitled'));
  }

  // Stage 2: keep only the pre-filter hits whose VISIBLE text really matches.
  for (const p of byBody) {
    if (seen.has(p.id) || hits.length >= limit * 2) continue;
    const snippet = snippetAround(docText(p.content), q);
    if (!snippet) continue;                     // matched JSON scaffolding only
    seen.add(p.id);
    hits.push(hit('doc', p.id, p.title ?? 'Untitled', { snippet }));
  }

  for (const t of taskNotes) {
    hits.push(hit('task', t.id, t.title, { snippet: snippetAround(t.notes ?? '', q) }));
  }

  return { hits, deep: byBody.length > 0 || hits.some((h) => h.snippet !== undefined) };
}

// ── Record search: find a THING by its name ─────────────────────────────────
//
// `searchDeep` above answers "where did I write this?". This answers "which
// record do I mean?" — the question the ⌘K palette and the @-mention picker
// both ask, and which each of them used to answer with its own copy of the same
// seven queries. One copy means a new entity type lights up in both at once,
// and that a result row in the palette and a mention row agree about what a
// record is called.
//
// Presentation stays with the caller: the palette groups by heading and routes
// tasks to a drawer over the current page; the mention picker renders glyph
// rows and inserts a link. Only the fetching and the ordering live here.

export type RecordHit = {
  key: string;
  type: EntityType;
  id: string;
  title: string;
  /** Short trailing note — a status, never a sentence. */
  meta?: string;
  /** The matching line from a body search; renders on its own line. */
  snippet?: string;
  /** `recordHref`, or undefined when the type has no record route yet (§7J). */
  href?: string;
  color?: string | null;
  /** Recency, used for ordering. Not for display — `shortDate` is a UI concern. */
  updatedAt?: string;
};

/**
 * The types an @-mention can address. Deliberately the set with a `recordHref`:
 * a mention IS an internal link (lib/mentions.ts), so a type with no route
 * could only produce a dead link and no backlink. Goals, meetings, client
 * requests and feedback join this list the moment they get record routes —
 * which is one line in `recordHref` and nothing here.
 */
export const MENTIONABLE_TYPES: EntityType[] = ['doc', 'task', 'project', 'client', 'invoice', 'form', 'content', 'meeting'];

export type RecordSearchOptions = {
  /** Restrict to these types. Default: everything this function knows how to fetch. */
  types?: EntityType[];
  /** Rows per type. The caller caps the combined list itself. */
  limit?: number;
  /** Also match document bodies and task notes (the `searchDeep` pass). Default true. */
  deep?: boolean;
};

const ALL_RECORD_TYPES: EntityType[] = ['doc', 'task', 'project', 'client', 'invoice', 'form', 'goal', 'memory', 'content', 'meeting'];

const record = (type: EntityType, id: string, title: string, extra: Partial<RecordHit> = {}): RecordHit => ({
  key: `${type}:${id}`,
  type,
  id,
  title: title?.trim() || 'Untitled',
  href: recordHref(type, id),
  ...extra,
});

/**
 * Order results the way a person reads them: an exact name first, then names
 * that START with what was typed, then names containing it, then records that
 * only matched somewhere in their body. Recency breaks every tie, which is also
 * the whole ordering when there is no term at all (the "Recent" list a bare `@`
 * shows).
 *
 * Pure — this is the half of record search worth testing directly.
 */
export function rankRecordHits(hits: RecordHit[], term: string): RecordHit[] {
  const q = term.trim().toLowerCase();
  const recency = (h: RecordHit) => h.updatedAt ?? '';
  const score = (h: RecordHit): number => {
    if (!q) return 0;
    const t = h.title.toLowerCase();
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    // A word-start match: "rebrand" should find "Acme rebrand" above a record
    // that merely contains the letters mid-word.
    if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 2;
    if (t.includes(q)) return 3;
    return 4; // body/notes match only
  };
  return [...hits].sort((a, b) => score(a) - score(b) || recency(b).localeCompare(recency(a)));
}

/**
 * Find records by name across the workspace. RLS scopes everything to the user.
 *
 * An empty `term` is not an error — it means "the most recently touched
 * records", which is what a bare `@` shows. That is deliberately a server
 * answer rather than a localStorage one: the slash menu can remember recent
 * BLOCK TYPES locally because there are twenty of them and they never change,
 * but a remembered record can be renamed or deleted, and a picker that offers a
 * record that no longer exists is worse than one that offers nothing.
 *
 * Every source is fetched independently and failures are swallowed per-source
 * (the `safe` doctrine above): a picker missing invoices because that table
 * predates a migration is useful; one that throws is not.
 */
export async function searchRecords(
  db: DB,
  term: string,
  opts: RecordSearchOptions = {},
): Promise<RecordHit[]> {
  const q = term.trim();
  const want = new Set(opts.types ?? ALL_RECORD_TYPES);
  const limit = opts.limit ?? 5;
  const like = `%${q}%`;
  // Two characters is where an `ilike '%a%'` stops being a search and starts
  // being a table scan the user has to read.
  const deep = opts.deep !== false && q.length >= 2;

  // Every source is `filter by name, newest first` — or, when there is no term,
  // just `newest first`. Written out per table rather than behind a generic
  // helper: Supabase's builder is typed per table, and the generic version cost
  // more casts than the repetition costs lines.
  const none = <T>() => Promise.resolve([] as T[]);
  const recent = <T>(on: boolean, run: () => PromiseLike<{ data: T[] | null }>) => (on ? safe(run) : none<T>());

  const [tasks, projects, clients, forms, invoices, goals, docs, contentPages, meetingRows, memories, bodies] = await Promise.all([
    recent(want.has('task'), () => {
      const b = db.from('tasks').select('id,title,done,updated_at');
      return (q ? b.ilike('title', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    recent(want.has('project'), () => {
      const b = db.from('projects').select('id,name,color,status,updated_at');
      return (q ? b.ilike('name', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    recent(want.has('client'), () => {
      const b = db.from('clients').select('id,name,status,updated_at');
      return (q ? b.ilike('name', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    recent(want.has('form'), () => {
      const b = db.from('forms').select('id,title,status,updated_at');
      return (q ? b.ilike('title', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    // Invoices are found by the string anyone actually remembers — "INV-014" —
    // not by a title they do not have.
    recent(want.has('invoice'), () => {
      const b = db.from('invoices').select('id,number,status,updated_at');
      return (q ? b.ilike('number', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    recent(want.has('goal'), () => {
      const b = db.from('goals').select('id,title,updated_at');
      return (q ? b.ilike('title', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    // `database_id is null` keeps DOCUMENTS out of the list: since 0028 a
    // database ROW is also a `pages` row, and the two are different things
    // wearing the same table.
    recent(want.has('doc'), () => {
      // `neq('type','content')` for the same reason as `database_id is null`
      // above: a content piece is also a `pages` row, and finding it here would
      // send you to /documents for something that lives in Content.
      const b = db.from('pages').select('id,title,updated_at')
        .is('archived_at', null).is('database_id', null).neq('type', 'content');
      return (q ? b.ilike('title', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    // CONTENT (PRODUCT_CONTEXT §19: search is how you navigate the graph, so a
    // piece has to be findable AS a piece — with its own glyph and its own
    // route — rather than as a document that happens to be a script).
    recent(want.has('content'), () => {
      const b = db.from('pages').select('id,title,updated_at')
        .eq('type', 'content').is('archived_at', null);
      return (q ? b.ilike('title', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    // MEETINGS became findable the moment they became addressable: a record you
    // can link to but cannot search for is half a record. `safe()` swallows the
    // table when 0016 is absent, like every other source here.
    recent(want.has('meeting'), () => {
      const b = db.from('meetings').select('id,title,met_at');
      return (q ? b.ilike('title', like) : b).order('met_at', { ascending: false }).limit(limit);
    }),
    // MEMORY (§7X §5.1 — "memories join that one index; it does not gain a
    // sibling"). No `searchDeep` pass and no title/body split: a memory has no
    // title, it IS one line, so an `ilike` over `body` is the whole search.
    //
    // Only what is currently TRUE and unarchived. Recall is for what you know
    // now — a superseded fact surfacing beside its replacement is how a memory
    // system starts contradicting itself. History has its own surface (M4).
    //
    // `safe()` swallows the missing table, so this degrades to nothing before
    // migration 0029 exactly like every other source here.
    recent(want.has('memory'), () => {
      const b = db.from('memories').select('id,body,kind,updated_at')
        .is('invalid_from', null).is('archived_at', null);
      return (q ? b.ilike('body', like) : b).order('updated_at', { ascending: false }).limit(limit);
    }),
    deep && (want.has('doc') || want.has('task'))
      ? searchDeep(db, q, limit).then((r) => r.hits)
      : none<SearchHit>(),
  ]);

  const hits: RecordHit[] = [];
  const seen = new Set<string>();
  const push = (h: RecordHit) => { if (!seen.has(h.key)) { seen.add(h.key); hits.push(h); } };

  for (const r of docs) push(record('doc', r.id, r.title ?? 'Untitled', { updatedAt: r.updated_at }));
  for (const r of contentPages) push(record('content', r.id, r.title ?? 'Untitled', { updatedAt: r.updated_at }));
  for (const r of meetingRows) push(record('meeting', r.id, r.title, { meta: formatDay(r.met_at), updatedAt: r.met_at }));
  for (const r of tasks) push(record('task', r.id, r.title, { meta: r.done ? 'Done' : undefined, updatedAt: r.updated_at }));
  for (const r of projects) push(record('project', r.id, r.name, { meta: statusMeta(r.status), color: r.color, updatedAt: r.updated_at }));
  for (const r of clients) push(record('client', r.id, r.name, { meta: statusMeta(r.status), updatedAt: r.updated_at }));
  for (const r of invoices) push(record('invoice', r.id, r.number, { meta: statusMeta(r.status), updatedAt: r.updated_at }));
  for (const r of forms) push(record('form', r.id, r.title, { meta: statusMeta(r.status), updatedAt: r.updated_at }));
  for (const r of goals) push(record('goal', r.id, r.title, { updatedAt: r.updated_at }));
  // The fact is the title. `kind` rides along as the trailing note so a recalled
  // line says what sort of claim it is without spending a second row.
  for (const r of memories) push(record('memory', r.id, r.body, { meta: statusMeta(r.kind), updatedAt: r.updated_at }));
  // Body matches last, and only for records the name pass didn't already find —
  // otherwise a doc whose title matches would appear twice, once with a snippet
  // that repeats what the title already said.
  for (const h of bodies) {
    if (!want.has(h.type)) continue;
    push({ ...h, key: `${h.type}:${h.id}` });
  }

  return rankRecordHits(hits, q);
}
