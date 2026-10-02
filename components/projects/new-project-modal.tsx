'use client';
// New-project create surface (§7E "new project: name → client? → template?").
// An editorial modal — big title, a row of property chips, then a browsable
// TEMPLATE GALLERY (cards grouped by category, searchable, with a real
// structural preview). Picking a template seeds its sections + dated tasks via
// createProjectFromTemplate; "Blank" is the default. All Zenboard DS + tokens:
// monochrome cards, ink selection, and the ONE berry primary on "Create project".
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, User, Check, Search } from '@/components/ds/icons';
import {
  Icon, Button, Modal, DatePicker, TextInput, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  EmptyLine,
} from '@/components/ds/ui';
import { addProject, createProjectFromTemplate, updateProject } from '@/lib/actions/projects';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '@/lib/project-templates';
import { cn } from '@/lib/cn';
import { useChanged } from '@/lib/use-changed';
import { SCOPE_COLORS } from '@/lib/task-scopes';
import { scopeFill } from '@/lib/entity-color';

// The one scope palette (lib/task-scopes.ts) — shared with lists, so a project
// dot and a list dot in the same rail can never come from different arrays.
const COLORS: readonly string[] = SCOPE_COLORS;
const chip = (active: boolean) =>
  cn('focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-line-soft px-2.5 text-ui transition-colors duration-fast hover:bg-surface-hover',
    active ? 'text-ink-900' : 'text-ink-600');

export function NewProjectModal({ open, onOpenChange, deadlineSupported = false }: {
  open: boolean; onOpenChange: (o: boolean) => void; deadlineSupported?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(''); // YYYY-MM-DD or ''
  const [templateKey, setTemplateKey] = useState(''); // '' = blank
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // Reset each time the modal opens; lazily pull the user's clients (RLS-scoped).
  // Clearing the form is state this component owns, so it happens during the
  // render that opens — not a paint later, with the previous project's name
  // still on screen. Fetching clients is I/O and stays an effect.
  if (useChanged(open) && open) {
    setName(''); setColor(COLORS[0]); setClientId(null); setDeadline(''); setTemplateKey(''); setQuery(''); setBusy(false);
  }
  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase.from('clients').select('id, name').order('name')
      .then(({ data }) => { if (alive) setClients((data as { id: string; name: string }[] | null) ?? []); });
    return () => { alive = false; };
  }, [open, supabase]);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? null;
  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    const byCat = new Map<string, ProjectTemplate[]>();
    for (const t of PROJECT_TEMPLATES) {
      if (q && !t.name.toLowerCase().includes(q) && !t.hint.toLowerCase().includes(q)) continue;
      const arr = byCat.get(t.category);
      if (arr) arr.push(t); else byCat.set(t.category, [t]);
    }
    return [...byCat.entries()];
  }, [q]);

  async function create() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const res = templateKey
      ? await createProjectFromTemplate({ name: n, color, clientId, deadline: deadline || null, templateKey })
      : await addProject({ name: n, color, clientId });
    if ('error' in res) { setBusy(false); toast({ message: res.error, variant: 'error' }); return; }
    if (!templateKey && deadline && deadlineSupported) await updateProject(res.id, { deadline });
    router.push(`/projects/${res.id}`); // navigation unmounts the modal
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title="New project" dirty={!!name.trim() || !!templateKey}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || busy} onClick={create}>Create project</Button>
        </>
      }>
      <div className="flex flex-col gap-5">
        {/* Hero: the name is the title (auto-focused first input). */}
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          placeholder="Project name" aria-label="Project name" autoComplete="off" data-1p-ignore data-lpignore="true"
          className="w-full bg-transparent text-[24px] font-semibold leading-8 tracking-[-0.01em] text-ink-900 outline-none placeholder:text-ink-500" />

        {/* Property chips: color · client · deadline */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 pr-1" role="radiogroup" aria-label="Project color">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => setColor(c)}
                className={cn('focus-ring size-5 rounded-xs border-2 transition-colors duration-fast', color === c ? 'border-ink-900' : 'border-transparent')}
                /* The token, never the stored value — see projects-workspace. */
                style={{ background: scopeFill(c) }} />
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={chip(!!clientId)}>
              <Icon icon={User} size={14} />{clientName ?? 'Client'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuItem onSelect={() => setClientId(null)} icon={clientId === null ? <Icon icon={Check} size={14} /> : undefined}>No client</DropdownMenuItem>
              {clients.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => setClientId(c.id)} icon={clientId === c.id ? <Icon icon={Check} size={14} /> : undefined}>{c.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {deadlineSupported && (
            <DatePicker aria-label="Deadline" value={deadline || null} onValueChange={setDeadline} placeholder="Deadline" className="h-8" />
          )}
        </div>

        <div className="h-px bg-line-soft" />

        {/* Template gallery */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium text-ink-500">Start from</span>
            {/* The DS field, not a hand-rolled one: that asked for `bg-surface`
                (never a token, so no fill) on a card-tier edge a field must not
                use. */}
            <div className="w-48">
              <TextInput size="sm" icon={<Icon icon={Search} />} value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates" aria-label="Search templates" autoComplete="off" data-1p-ignore data-lpignore="true" />
            </div>
          </div>

          {!q && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <BlankCard selected={templateKey === ''} onSelect={() => setTemplateKey('')} />
            </div>
          )}

          {categories.length === 0 ? (
            <EmptyLine className="py-4">No templates match “{query}”.</EmptyLine>
          ) : (
            categories.map(([cat, tpls]) => (
              <div key={cat}>
                <div className="mb-2 text-caption font-medium text-ink-500">{cat}</div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {tpls.map((t) => (
                    <TemplateCard key={t.key} template={t} selected={templateKey === t.key} onSelect={() => setTemplateKey(t.key)} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

const cardCls = (selected: boolean) =>
  cn('group/card focus-ring flex flex-col overflow-hidden rounded-lg border text-left transition-colors duration-fast',
    selected ? 'border-ink-900 bg-surface-active' : 'border-line-soft hover:border-line hover:bg-surface-hover');

// A tokenized structural preview — a couple of sections with a task line or two,
// so the card shows what the template actually creates (no image assets).
function TemplateCard({ template, selected, onSelect }: { template: ProjectTemplate; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cardCls(selected)}>
      <div className="flex h-24 flex-col gap-1.5 overflow-hidden border-b border-line-soft bg-surface-sunken p-2.5">
        {template.sections.slice(0, 2).map((s) => (
          <div key={s} className="min-w-0">
            <div className="truncate text-micro font-medium text-ink-500">{s}</div>
            {template.tasks.filter((t) => t.section === s).slice(0, 2).map((t, i) => (
              <div key={i} className="mt-1 flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-[3px] border border-line" />
                <span className="h-1 flex-1 rounded-full bg-line" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="p-2.5">
        <div className="truncate text-ui font-medium text-ink-900">{template.name}</div>
        <div className="truncate text-caption text-ink-500 group-hover/card:text-ink-700 group-aria-pressed/card:text-ink-700">{template.sections.length} sections · {template.tasks.length} tasks</div>
      </div>
    </button>
  );
}

function BlankCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cardCls(selected)}>
      <div className="flex h-24 items-center justify-center border-b border-line-soft bg-surface-sunken">
        <Icon icon={Plus} size={20} className="text-ink-500" />
      </div>
      <div className="p-2.5">
        <div className="text-ui font-medium text-ink-900">Blank project</div>
        <div className="truncate text-caption text-ink-500 group-hover/card:text-ink-700 group-aria-pressed/card:text-ink-700">Start from scratch</div>
      </div>
    </button>
  );
}
