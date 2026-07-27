'use client';
// Command palette (⌘K) — navigate, run rituals/actions, and search across tasks,
// projects, clients, pages, goals, and forms (RLS-scoped browser client). Keyboard-driven.
// Ported from the prototype command.jsx. Mounted once in the app shell.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, House, Flame, Calendar, Target, Kanban, Users, Landmark, BookOpen, Forms, Timer, Moon, Repeat, Plus, Search, SquareCheck, SquarePen, FileText, ListChecks, Inbox, type IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { Kbd } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { addTask } from '@/lib/actions/tasks';
import { parseTask, chipSummary } from '@/lib/task-parse';

type Item = { id: string; group: string; label: string; icon: IconType; href?: string; run?: () => void; color?: string | null; kbd?: string; hint?: string };

function staticItems(pathname: string): Item[] {
  return [
    { id: 'n-today', group: 'Navigate', label: 'Go to Home', icon: House, href: '/today', kbd: 'G T' },
    { id: 'n-inbox', group: 'Navigate', label: 'Go to Inbox', icon: Inbox, href: '/inbox', kbd: 'G I' },
    { id: 'n-tasks', group: 'Navigate', label: 'Go to Tasks', icon: ListChecks, href: '/tasks', kbd: 'G K' },
    { id: 'n-calendar', group: 'Navigate', label: 'Go to Calendar', icon: Calendar, href: '/calendar' },
    { id: 'n-week', group: 'Navigate', label: 'Tasks — Week view', icon: ListChecks, href: '/tasks?view=week', kbd: 'G W' },
    { id: 'n-horizon', group: 'Navigate', label: 'Go to Goals', icon: Target, href: '/horizon', kbd: 'G H' },
    { id: 'n-habits', group: 'Navigate', label: 'Go to Habits', icon: Flame, href: '/habits', kbd: 'G B' },
    { id: 'n-projects', group: 'Navigate', label: 'Go to Projects', icon: Kanban, href: '/projects', kbd: 'G P' },
    { id: 'n-clients', group: 'Navigate', label: 'Go to Clients', icon: Users, href: '/clients', kbd: 'G C' },
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

  useEffect(() => { if (open) { setQ(''); setSel(0); setResults([]); setTimeout(() => inputRef.current?.focus(), 40); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);

  // Active project names once per open — lets the "New task" row honor #tags.
  useEffect(() => {
    if (!open || projects.length) return;
    let gone = false;
    createClient().from('projects').select('id, name').eq('status', 'active').limit(50)
      .then(({ data }) => { if (!gone && data) setProjects(data); });
    return () => { gone = true; };
  }, [open, projects.length]);

  // debounced cross-entity search (RLS scopes results to the user)
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const sb = createClient();
      const like = `%${term}%`;
      const [tasks, projects, clients, pages, goals, forms] = await Promise.all([
        sb.from('tasks').select('id, title').ilike('title', like).limit(5),
        sb.from('projects').select('id, name, color').ilike('name', like).limit(4),
        sb.from('clients').select('id, name').ilike('name', like).limit(4),
        sb.from('pages').select('id, title').ilike('title', like).limit(4),
        sb.from('goals').select('id, title').ilike('title', like).limit(4),
        sb.from('forms').select('id, title').ilike('title', like).limit(4),
      ]);
      if (cancelled) return;
      const out: Item[] = [];
      (tasks.data ?? []).forEach((r) => out.push({ id: 'task-' + r.id, group: 'Tasks', label: r.title, icon: SquareCheck, href: `${pathname}?task=${r.id}` }));
      (projects.data ?? []).forEach((r) => out.push({ id: 'proj-' + r.id, group: 'Projects', label: r.name, icon: Kanban, href: `/projects/${r.id}`, color: r.color }));
      (clients.data ?? []).forEach((r) => out.push({ id: 'cli-' + r.id, group: 'Clients', label: r.name, icon: Users, href: '/clients' }));
      (pages.data ?? []).forEach((r) => out.push({ id: 'page-' + r.id, group: 'Docs', label: r.title || 'Untitled', icon: FileText, href: `/documents?page=${r.id}` }));
      (goals.data ?? []).forEach((r) => out.push({ id: 'goal-' + r.id, group: 'Goals', label: r.title, icon: Target, href: '/horizon' }));
      // `forms` errors (table absent until 0020) come back as data:null — harmless.
      (forms.data ?? []).forEach((r) => out.push({ id: 'form-' + r.id, group: 'Forms', label: r.title, icon: SquarePen, href: `/forms/${r.id}` }));
      setResults(out);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, pathname]);

  const items = useMemo(() => {
    const statics = staticItems(pathname);
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
    return out;
  }, [q, results, pathname, projects, router]);

  const run = useCallback((it: Item) => { setOpen(false); if (it.run) it.run(); else if (it.href) router.push(it.href); }, [router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) run(it); }
  };

  if (!open) return null;

  const groups: Record<string, (Item & { i: number })[]> = {};
  items.forEach((it, i) => { (groups[it.group] ??= []).push({ ...it, i }); });

  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'color-mix(in srgb, var(--scrim-color) 36%, transparent)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, animation: 'fadein 160ms' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: '70vh', background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp var(--dur-slow) var(--ease)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Icon icon={Search} size={16} style={{ color: 'var(--text-secondary)' }} />
          <input ref={inputRef} value={q} autoComplete="off" data-1p-ignore data-lpignore="true" onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search, navigate, or jump…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-h2-size)', lineHeight: 1.3, color: 'var(--ink)' }} />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>No matches for “{q}”.</div>}
          {Object.entries(groups).map(([gname, gitems]) => (
            <div key={gname} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 'var(--text-micro-size)', color: 'var(--text-secondary)', padding: '8px 12px 4px', letterSpacing: '0.08em' }}>{gname.toUpperCase()}</div>
              {gitems.map((it) => {
                const active = it.i === sel;
                return (
                  <div key={it.id} onMouseEnter={() => setSel(it.i)} onClick={() => run(it)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-md)', background: active ? 'var(--paper-3)' : 'transparent', cursor: 'pointer', color: 'var(--ink-2)' }}>
                    {it.color ? <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color, flexShrink: 0 }} /> : <Icon icon={it.icon} size={14} style={{ color: 'var(--text-secondary)' }} />}
                    <span style={{ flex: 1, fontSize: 'var(--text-small-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                    {it.hint && <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.hint}</span>}
                    {it.kbd && <Kbd>{it.kbd}</Kbd>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper-3)', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>↑↓</Kbd> navigate</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>↵</Kbd> select</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>⌘K</Kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
