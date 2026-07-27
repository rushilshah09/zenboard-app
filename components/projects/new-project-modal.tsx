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
import { Plus, User, Check, Search, Layout } from '@/components/ds/icons';
import {
  Icon, Button, Modal, DatePicker, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ds/ui';
import { addProject, createProjectFromTemplate, updateProject } from '@/lib/actions/projects';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '@/lib/project-templates';
import { cn } from '@/lib/cn';

const COLORS = ['#9A1B6F', '#7B8B5F', '#C88A3B', '#2B5CB0', '#5C4FB8'];
const dateToISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  useEffect(() => {
    if (!open) return;
    setName(''); setColor(COLORS[0]); setClientId(null); setDeadline(''); setTemplateKey(''); setQuery(''); setBusy(false);
    supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients((data as { id: string; name: string }[] | null) ?? []));
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
          className="w-full bg-transparent text-[24px] font-semibold leading-8 tracking-[-0.01em] text-ink-900 outline-none placeholder:text-ink-400" />

        {/* Property chips: color · client · deadline */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 pr-1" role="radiogroup" aria-label="Project color">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} onClick={() => setColor(c)}
                className={cn('focus-ring size-5 rounded-[5px] border-2 transition-colors duration-fast', color === c ? 'border-ink-900' : 'border-transparent')}
                style={{ background: c }} />
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
            <DatePicker value={deadline ? new Date(deadline + 'T00:00:00') : null} onValueChange={(d) => setDeadline(d ? dateToISO(d) : '')} placeholder="Deadline" className="h-8" />
          )}
        </div>

        <div className="h-px bg-line-soft" />

        {/* Template gallery */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium text-ink-500">Start from</span>
            <div className="relative w-48">
              <Icon icon={Search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates"
                autoComplete="off" data-1p-ignore data-lpignore="true"
                className="focus-ring h-8 w-full rounded-md border border-line-soft bg-surface pl-8 pr-2.5 text-ui text-ink-800 outline-none placeholder:text-ink-500" />
            </div>
          </div>

          {!q && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <BlankCard selected={templateKey === ''} onSelect={() => setTemplateKey('')} />
            </div>
          )}

          {categories.length === 0 ? (
            <div className="py-4 text-center text-caption text-ink-500">No templates match “{query}”.</div>
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
  cn('focus-ring flex flex-col overflow-hidden rounded-lg border text-left transition-colors duration-fast',
    selected ? 'border-ink-900 bg-surface-active' : 'border-line-soft hover:border-line hover:bg-surface-hover');

// A tokenized structural preview — a couple of sections with a task line or two,
// so the card shows what the template actually creates (no image assets).
function TemplateCard({ template, selected, onSelect }: { template: ProjectTemplate; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cardCls(selected)}>
      <div className="flex h-24 flex-col gap-1.5 overflow-hidden border-b border-line-soft bg-surface-sunken p-2.5">
        {template.sections.slice(0, 2).map((s) => (
          <div key={s} className="min-w-0">
            <div className="truncate text-[10px] font-medium uppercase tracking-[0.04em] text-ink-500">{s}</div>
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
        <div className="truncate text-caption text-ink-500">{template.sections.length} sections · {template.tasks.length} tasks</div>
      </div>
    </button>
  );
}

function BlankCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cardCls(selected)}>
      <div className="flex h-24 items-center justify-center border-b border-line-soft bg-surface-sunken">
        <Icon icon={Plus} size={20} className="text-ink-400" />
      </div>
      <div className="p-2.5">
        <div className="text-ui font-medium text-ink-900">Blank project</div>
        <div className="truncate text-caption text-ink-500">Start from scratch</div>
      </div>
    </button>
  );
}
