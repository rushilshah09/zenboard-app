'use client';
// The global Forms hub (/forms). Manage every form in one place, whichever client
// or project it lives under — or none. Rows share the exact grammar of the
// embedded FormsPanel (status badge · updated · responses →) plus a "where it
// lives" chip. A home is OPTIONAL (0024): new forms start in Drafts, and each row
// has a "Move to…" menu to attach one to a client or project (or detach) later.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Link2, Check, Trash, ArrowRight, Copy, Folder, Users, Forms as FormsIcon } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, Badge, toast, Modal, Select, SegmentedControl, EmptyState,
  Popover, PopoverTrigger, PopoverContent, MenuItem, MenuLabel,
  type BadgeStatus, type SelectGroup,
} from '@/components/ds/ui';
import { ViewContainer } from '@/components/ui/view-container';
import { createForm, deleteForm, duplicateForm, setFormHome } from '@/lib/actions/forms';
import { FORM_TEMPLATES } from '@/lib/form-templates';
import type { FormHubItem } from '@/lib/forms';

const STATUS_TONE: Record<string, BadgeStatus> = { draft: 'neutral', live: 'success', closed: 'neutral' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', live: 'Live', closed: 'Closed' };

const rel = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type NameRef = { id: string; name: string };
type Filter = 'all' | 'live' | 'draft' | 'closed';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'live', label: 'Live' },
  { value: 'draft', label: 'Draft' }, { value: 'closed', label: 'Closed' },
];

export function FormsHub({ items, projects, clients }: { items: FormHubItem[]; projects: NameRef[]; clients: NameRef[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((f) => f.status === filter)), [items, filter]);

  async function duplicate(id: string) {
    const res = await duplicateForm(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    router.push(`/forms/${res.id}`);
  }
  async function remove(id: string, title: string) {
    const res = await deleteForm(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    toast({ message: `“${title}” deleted.` });
    router.refresh();
  }
  async function copyLink(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${token}`);
      setCopied(id); setTimeout(() => setCopied(null), 1600);
    } catch { toast({ message: 'Couldn’t copy the link.', variant: 'error' }); }
  }
  async function move(id: string, home: { clientId: string } | { projectId: string } | null) {
    const res = await setFormHome(id, home);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    toast({ message: home ? 'Form moved.' : 'Moved to Drafts.' });
    router.refresh();
  }

  return (
    <ViewContainer className="pt-[var(--view-pt)] pb-[var(--view-pb)]">
      <div className="mb-[var(--view-gap)] flex items-center gap-3">
        <SegmentedControl aria-label="Filter forms by status" options={FILTERS} value={filter} onValueChange={(v) => setFilter(v as Filter)} fit="content" />
        <span className="flex-1" />
        <Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setNewOpen(true)}>New form</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          illustration={<Icon icon={FormsIcon} size={20} />}
          title="No forms yet"
          description="Collect a brief, feedback, or a testimonial — people fill it in without an account. Start one in Drafts and attach it to a client or project whenever you like."
          primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setNewOpen(true)}>New form</Button>}
        />
      ) : shown.length === 0 ? (
        <div className="py-1.5 text-ui text-ink-500">No {filter} forms.</div>
      ) : (
        <div>
          {shown.map((f) => (
            <div key={f.id} className="group flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
              <button onClick={() => router.push(`/forms/${f.id}`)} className="focus-ring min-w-0 flex-1 rounded-sm text-left">
                <span className="block truncate text-ui text-ink-800">{f.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Icon icon={f.context ? (f.context.kind === 'project' ? Folder : Users) : FormsIcon} size={12} />
                    {f.context ? f.context.name : 'Drafts'}
                  </span>
                  <span aria-hidden>·</span>
                  <span>Updated {rel(f.updatedAt)}</span>
                  {f.partials > 0 && <>· <span className="tabular-nums">{f.partials}</span> in progress</>}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                {f.shareToken && f.status === 'live' && (
                  <IconButton label={copied === f.id ? 'Copied' : 'Copy link'} variant="ghost" size="xs"
                    icon={<Icon icon={copied === f.id ? Check : Link2} size={14} />} onClick={() => copyLink(f.shareToken!, f.id)} />
                )}
                {(projects.length > 0 || clients.length > 0) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button aria-label="Move to a client or project"
                        className="focus-ring grid size-7 place-items-center rounded-sm text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900">
                        <Icon icon={Folder} size={14} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="max-h-[320px] w-56 overflow-y-auto p-1.5">
                      <MenuLabel>Move to</MenuLabel>
                      {f.context && <MenuItem onClick={() => move(f.id, null)}>Drafts (no home)</MenuItem>}
                      {projects.length > 0 && <MenuLabel>Projects</MenuLabel>}
                      {projects.map((p) => <MenuItem key={p.id} onClick={() => move(f.id, { projectId: p.id })}>{p.name}</MenuItem>)}
                      {clients.length > 0 && <MenuLabel>Clients</MenuLabel>}
                      {clients.map((c) => <MenuItem key={c.id} onClick={() => move(f.id, { clientId: c.id })}>{c.name}</MenuItem>)}
                    </PopoverContent>
                  </Popover>
                )}
                <IconButton label="Duplicate form" variant="ghost" size="xs" icon={<Icon icon={Copy} size={14} />} onClick={() => duplicate(f.id)} />
                <IconButton label="Delete form" variant="ghost" size="xs" icon={<Icon icon={Trash} size={14} />} onClick={() => remove(f.id, f.title)} />
              </div>

              <Badge status={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>

              <button onClick={() => router.push(`/forms/${f.id}/responses`)} aria-label={`${f.responses} responses`}
                className="focus-ring flex shrink-0 items-center gap-1 rounded-sm text-ink-500 transition-colors hover:text-ink-900">
                <span className="tabular-nums text-ui text-ink-800">{f.responses}</span>
                <Icon icon={ArrowRight} size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <NewFormModal open={newOpen} onOpenChange={setNewOpen} projects={projects} clients={clients} />
    </ViewContainer>
  );
}

function NewFormModal({ open, onOpenChange, projects, clients }: {
  open: boolean; onOpenChange: (o: boolean) => void; projects: NameRef[]; clients: NameRef[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<string>('none'); // 'none' = Drafts (no home)
  const [busy, setBusy] = useState(false);

  const hasHomes = projects.length + clients.length > 0;
  const groups: SelectGroup[] = [
    { options: [{ value: 'none', label: 'Drafts — no client or project' }] },
    ...(projects.length ? [{ label: 'Projects', options: projects.map((p) => ({ value: `project:${p.id}`, label: p.name })) }] : []),
    ...(clients.length ? [{ label: 'Clients', options: clients.map((c) => ({ value: `client:${c.id}`, label: c.name })) }] : []),
  ];

  async function create(template?: string) {
    setBusy(true);
    // 'none' ⇒ no home; the form is born in Drafts and can be attached later.
    const [kind, id] = scope !== 'none' ? scope.split(':') : ['', ''];
    const res = await createForm({
      ...(kind === 'project' ? { projectId: id } : kind === 'client' ? { clientId: id } : {}),
      template,
    });
    setBusy(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    router.push(`/forms/${res.id}`);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New form" description="New forms start in Drafts. Give it a client or project now, or attach one later.">
      <div className="flex flex-col gap-4">
        {hasHomes && (
          <div className="flex flex-col gap-1.5">
            <label className="text-caption text-ink-500">Home <span className="text-ink-400">(optional)</span></label>
            <Select groups={groups} value={scope} onValueChange={setScope} aria-label="Form home" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-500">Start with</span>
          <div className="flex flex-col gap-1">
            <button onClick={() => create()} disabled={busy}
              className="focus-ring flex items-center gap-2 rounded-md border border-line-soft px-3 py-2 text-left text-ui text-ink-800 transition-colors hover:bg-surface-hover disabled:opacity-50">
              <Icon icon={Plus} size={14} /> Blank form
            </button>
            {FORM_TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => create(t.key)} disabled={busy}
                className="focus-ring flex items-center gap-2 rounded-md border border-line-soft px-3 py-2 text-left transition-colors hover:bg-surface-hover disabled:opacity-50">
                <span className="flex-1 text-ui text-ink-800">{t.name}</span>
                <span className="text-meta text-ink-500">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
