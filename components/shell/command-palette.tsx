'use client';
// Command palette (⌘K) — navigate, run rituals/actions, and search across tasks,
// projects, clients, docs, goals, forms and invoices (RLS-scoped browser client).
// Keyboard-driven. Ported from the prototype command.jsx. Mounted once in the shell.
//
// Destinations come from `recordHref` (lib/connected.ts) — the one function that
// knows how to address a record — so a search result and a Connected panel row
// always land in the same place. Before that, clients searched fine and then
// dumped you on `/clients` with no idea which one you'd picked.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, House, Flame, Calendar, Target, Kanban, Users, MessageCircle, Landmark, BookOpen, Forms, Timer, Moon, Repeat, Plus, Search, Sparkles, ListChecks, Inbox, type IconType } from '@/components/ds/icons';
import { Icon } from "@/components/ds/ui";
import { Kbd } from '@/components/ds/ui';
import { createClient } from '@/lib/supabase/client';
import { addTask } from '@/lib/actions/tasks';
import { parseTask, chipSummary } from '@/lib/task-parse';
import { ENTITY_TYPES, type EntityType } from '@/lib/connected';
import { RECORD_FACE } from '@/components/ds/record-face';
import { openAsk } from '@/components/ask/ask-panel';
import { searchRecords } from '@/lib/search';
import { recallMemory } from '@/lib/actions/memory';
import { useChanged } from '@/lib/use-changed';

// `hint` is a short trailing note (a status, "Inbox") and stays on the row.
// `snippet` is the matching line from a body search — a sentence, so it gets its
// own line under the title. Sharing one field would let a snippet squeeze the
// title down to an ellipsis.
type Item = { id: string; group: string; label: string; icon: IconType; href?: string; run?: () => void;
  /** A side effect that accompanies opening the row, rather than replacing it.
   *  `run` and `href` are alternatives; this fires alongside either. */
  onSelect?: () => void;
  color?: string | null; kbd?: string; hint?: string; snippet?: string };

// How each searched type presents itself in the palette: its heading, its
// glyph, and the hub it falls back to when the type has no record-level route
// yet. That fallback lives HERE rather than inside `recordHref` so the latter's
// contract survives — the Connected panel relies on `undefined` meaning "not
// addressable" so it can render an unlinked row instead of a link that lands on
// a list. The @-mention picker draws the same types with the same glyphs; a
// record has one face in this product.
// The HEADING each type sits under here. The glyph and the fallback hub moved to
// `components/ds/record-face.ts` when Ask needed the same ones — they are facts
// about the record, and this is a fact about this list, which is why only this
// half stayed. `RECORD_FACE` carries the note about types with no route yet.
//
// ⌘K RECALL (§7X §5.1) is the `memory` line. The plan asked for "a Recall
// section in the command palette"; because `searchRecords` is the ONE index, a
// group name is the entire integration. A second search box is on the
// never-list, and this is what honouring that looks like in practice.
const GROUP: Record<EntityType, string> = {
  task: 'Tasks', project: 'Projects', client: 'Clients', doc: 'Docs', invoice: 'Finance',
  form: 'Forms', goal: 'Goals', memory: 'Recall', content: 'Content', event: 'Calendar',
  meeting: 'Calendar', request: 'Clients', feedback: 'Clients',
};

const GROUPS: Record<EntityType, { group: string; icon: IconType; hub: string }> = Object.fromEntries(
  ENTITY_TYPES.map((t) => [t, { group: GROUP[t], ...RECORD_FACE[t] }]),
) as Record<EntityType, { group: string; icon: IconType; hub: string }>;

/**
 * The fixed rows, identical on every page.
 *
 * This used to take a `pathname` it never read. The obvious use — hiding "Go to
 * Tasks" while you are on Tasks — is deliberately NOT taken: a keyboard palette
 * earns its speed from muscle memory, and a list that reorders itself by
 * location means the third row is a different command depending on where you
 * were. Linear keeps the current page listed for the same reason.
 */
function staticItems(): Item[] {
  return [
    { id: 'n-today', group: 'Navigate', label: 'Go to Home', icon: House, href: '/today', kbd: 'G T' },
    { id: 'n-inbox', group: 'Navigate', label: 'Go to Inbox', icon: Inbox, href: '/tasks?view=inbox', kbd: 'G I' },
    { id: 'n-tasks', group: 'Navigate', label: 'Go to Tasks', icon: ListChecks, href: '/tasks', kbd: 'G K' },
    { id: 'n-calendar', group: 'Navigate', label: 'Go to Calendar', icon: Calendar, href: '/calendar' },
    { id: 'n-week', group: 'Navigate', label: 'Tasks, Week view', icon: ListChecks, href: '/tasks?view=week', kbd: 'G W' },
    { id: 'n-horizon', group: 'Navigate', label: 'Go to Goals', icon: Target, href: '/horizon', kbd: 'G H' },
    { id: 'n-habits', group: 'Navigate', label: 'Go to Habits', icon: Flame, href: '/habits', kbd: 'G B' },
    // "Go to Memory" removed with the nav row (2026-09-07). The `memory` entry in
    // the Recall map above is left wired: it only fires on a search hit, and with
    // no way into the module there are none — but it costs nothing and restoring
    // the module should not mean re-deriving this.
    { id: 'n-projects', group: 'Navigate', label: 'Go to Projects', icon: Kanban, href: '/projects', kbd: 'G P' },
    { id: 'n-clients', group: 'Navigate', label: 'Go to Clients', icon: Users, href: '/clients', kbd: 'G C' },
    { id: 'n-messages', group: 'Navigate', label: 'Go to Messages', icon: MessageCircle, href: '/messages' },
    { id: 'n-forms', group: 'Navigate', label: 'Go to Forms', icon: Forms, href: '/forms' },
    { id: 'n-documents', group: 'Navigate', label: 'Go to Docs', icon: BookOpen, href: '/documents', kbd: 'G D' },
    { id: 'n-money', group: 'Navigate', label: 'Go to Finance', icon: Landmark, href: '/money', kbd: 'G M' },
    { id: 'n-automations', group: 'Navigate', label: 'Go to Automations', icon: Repeat, href: '/automations' },
    { id: 'a-focus', group: 'Actions', label: 'Enter focus mode', icon: Timer, href: '/focus', kbd: 'F' },
    { id: 'r-plan', group: 'Rituals', label: 'Start daily planning', icon: Sun, href: '/rituals?type=daily_plan' },
    { id: 'r-shutdown', group: 'Rituals', label: 'Start daily shutdown', icon: Moon, href: '/rituals?type=daily_shutdown' },
    { id: 'r-weekly', group: 'Rituals', label: 'Start weekly review', icon: Repeat, href: '/rituals?type=weekly_review' },
    { id: 'c-task', group: 'Create', label: 'New task', icon: Plus, href: '/today' },
    { id: 'c-invoice', group: 'Create', label: 'New invoice', icon: Plus, href: '/money' },
    { id: 'c-page', group: 'Create', label: 'New document', icon: Plus, href: '/documents' },
  ];
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Escape used to leave focus on <body>; the Search button gets it back.
  useFocusReturn(open);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [results, setResults] = useState<Item[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // global ⌘K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    // open from the top-bar Search button
    const onOpen = () => setOpen(true);
    window.addEventListener('zb:open-command', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('zb:open-command', onOpen); };
  }, []);

  // The reset happens during render so reopening never paints the last search;
  // focusing is a real side effect and stays in an effect.
  if (useChanged(open) && open) { setQ(''); setSel(0); setResults([]); }
  useEffect(() => { if (open) { const t = setTimeout(() => inputRef.current?.focus(), 40); return () => clearTimeout(t); } }, [open]);
  if (useChanged(q)) setSel(0);

  // Active project names once per open — lets the "New task" row honor #tags.
  useEffect(() => {
    if (!open || projects.length) return;
    let gone = false;
    createClient().from('projects').select('id, name').eq('status', 'active').limit(50)
      .then(({ data }) => { if (!gone && data) setProjects(data); });
    return () => { gone = true; };
  }, [open, projects.length]);

  // Debounced cross-entity search (RLS scopes results to the user).
  //
  // The queries live in `searchRecords` (lib/search.ts) — the ONE record-search
  // projection, shared with the editor's @-mention picker. Before that they were
  // written out twice, which is how a new entity type ends up findable in one
  // place and invisible in the other. What stays here is presentation: the
  // group a row lands in, its glyph, and where it navigates.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      // Docs and task notes are searched by BODY as well as title: a note called
      // "Untitled" whose text discusses the Meridian rebrand is exactly the
      // thing Docs has to be able to find. (The @-picker asks for names only —
      // it writes the name into your sentence.)
      const hits = await searchRecords(createClient(), term, { limit: 4 });
      if (cancelled) return;
      setResults(hits.map((h) => {
        const row = GROUPS[h.type];
        return {
          id: `${h.type}-${h.id}`,
          group: row.group,
          label: h.title,
          icon: row.icon,
          // A task opens its drawer OVER the current page — the palette
          // shouldn't navigate you away from what you were doing. Everything
          // else is a real destination and goes through `recordHref`, the one
          // addressing function, so a search result and a Connected row agree.
          href: h.type === 'task' ? `${pathname}?task=${h.id}` : (h.href ?? row.hub),
          // RECALL IS THE DECAY SIGNAL (§7X §5.4). Opening a fact from here is
          // the app's only evidence that a memory is still earning its place,
          // and without it every fact fades at the same rate whether you lean on
          // it daily or have never looked at it twice. Fire-and-forget: the
          // navigation must not wait on a bookkeeping write.
          onSelect: h.type === 'memory' ? () => { recallMemory(h.id); } : undefined,
          // `hint` is a short trailing note; `snippet` is the matching line, so
          // a body hit shows WHY it matched when the title doesn't contain the
          // term anywhere.
          hint: h.type === 'invoice' ? h.meta : undefined,
          snippet: h.snippet,
          color: h.color,
        };
      }));
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, pathname]);

  const items = useMemo(() => {
    const statics = staticItems();
    if (!q.trim()) return statics;
    const ql = q.toLowerCase();
    const out = [...statics.filter((i) => i.label.toLowerCase().includes(ql)), ...results];
    // Anything typed can become a task — one calm create row, parsed grammar
    // shown as a quiet summary so nothing is applied silently.
    const parsed = parseTask(q, projects);
    if (parsed.title) {
      out.push({
        id: 'create-task', group: 'Create', label: `New task “${parsed.title}”`, icon: Plus,
        hint: chipSummary(parsed) || 'Inbox',
        run: async () => {
          await addTask({
            title: parsed.title,
            isInbox: !parsed.scheduledDate,
            scheduledDate: parsed.scheduledDate,
            dueDate: parsed.dueDate,
            priority: parsed.priority ?? undefined,
            estimateMinutes: parsed.estimateMinutes,
            projectId: parsed.projectId,
            recurrence: parsed.recurrence,
          });
          router.refresh();
        },
      });
    }
    // ── THE FALL-THROUGH TO ASK ─────────────────────────────────────────────
    // Anything typed can become a task; anything typed can also be a SENTENCE. This row is what
    // means nobody has to learn which box to use: you start in the fast one (a list, no model, no
    // latency) and fall through to the patient one carrying your words, instead of closing this,
    // finding the other, and typing it again.
    //
    // It is ALWAYS last and always present, never "only when nothing matched". This palette earns
    // its speed from muscle memory — the same reason `staticItems` refuses to reorder itself by
    // page — and a row that comes and goes depending on your results is one nobody can aim at.
    if (q.trim()) {
      out.push({
        id: 'ask', group: 'Ask', label: `Ask “${q.trim()}”`, icon: Sparkles,
        hint: 'A',
        run: () => openAsk(q.trim()),
      });
    }

    return out;
    // `pathname` is gone from the deps with `staticItems`' parameter — this memo
    // no longer reads it, so keeping it here would rebuild every row on every
    // navigation for nothing.
  }, [q, results, projects, router]);

  const run = useCallback((it: Item) => {
    setOpen(false);
    // Before the navigation, not after: `router.push` can unmount this tree, and
    // a bookkeeping call queued behind it would never be made.
    it.onSelect?.();
    if (it.run) it.run(); else if (it.href) router.push(it.href);
  }, [router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) run(it); }
  };

  if (!open) return null;

  const groups: Record<string, (Item & { i: number })[]> = {};
  items.forEach((it, i) => { (groups[it.group] ??= []).push({ ...it, i }); });

  // NO entrance animation, deliberately. This opens on ⌘K, dozens of times a
  // day, and animation on a keyboard-initiated surface reads as lag however
  // short it is — Raycast opens instantly for the same reason. The scrim used
  // to fade over 160ms, so the two halves of one surface disagreed.
  //
  // ── AND THE PANEL WAS STILL ANIMATING WHILE THIS COMMENT SAID IT WAS NOT ──
  // The line below carried `animation: 'slideUp var(--duration-slow) …'` —
  // a 12px rise and a fade, 200ms, on every ⌘K. Measured with
  // `html[data-input="keyboard"]` set, to be sure the modality switch was not
  // catching it: it was not, and it could not. That switch is
  // `html[data-input="keyboard"] .zb-enter { animation: none !important }`
  // (globals.css), and it needs the CLASS; this panel is styled inline and
  // carries none, so the one rule written to stop exactly this could never
  // reach it. Three things agreed it should not animate — CLAUDE.md
  // ("nothing a keyboard opens animates: ⌘K … never do"), Emil's frequency
  // table (100+/day → no animation, ever), and this comment — and it animated
  // anyway for want of a class nobody noticed was missing.
  // The fix is not to add `zb-enter`: that would only make it instant for the
  // keyboard and keep the rise for a pointer, and this surface is the keyboard's
  // either way. It simply does not animate. Guarded in app/design-system.test.ts.
  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'color-mix(in srgb, var(--scrim-color) 36%, transparent)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: '70vh', background: 'var(--color-surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift-3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Icon icon={Search} size={16} style={{ color: 'var(--text-secondary)' }} />
          <input ref={inputRef} value={q} autoComplete="off" data-1p-ignore data-lpignore="true" onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search, navigate, or jump…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-h2-size)', lineHeight: 1.3, color: 'var(--ink)' }} />
          <Kbd keys={['Esc']} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>No matches for “{q}”.</div>}
          {Object.entries(groups).map(([gname, gitems]) => (
            <div key={gname} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)', padding: '8px 12px 4px' }}>{gname}</div>
              {gitems.map((it) => {
                const active = it.i === sel;
                return (
                  <div key={it.id} onMouseEnter={() => setSel(it.i)} onClick={() => run(it)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-md)', background: active ? 'var(--color-surface-hover)' : 'transparent', cursor: 'pointer', color: 'var(--ink-2)' }}>
                    {it.color ? <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color, flexShrink: 0 }} /> : <Icon icon={it.icon} size={14} style={{ color: 'var(--text-secondary)' }} />}
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 'var(--text-small-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                      {/* The matching line, so a body hit explains itself rather than
                          showing a title that doesn't contain the search term. */}
                      {it.snippet && <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.snippet}</span>}
                    </span>
                    {it.hint && <span style={{ fontSize: 'var(--text-label-size)', color: active ? 'var(--color-ink-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{it.hint}</span>}
                    {it.kbd && <Kbd keys={[it.kbd]} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper-3)', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd keys={['ArrowUp', 'ArrowDown']} /> navigate</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd keys={['Enter']} /> select</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd keys={['Meta', 'K']} /> toggle</span>
        </div>
      </div>
    </div>
  );
}
