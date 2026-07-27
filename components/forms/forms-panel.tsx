'use client';
// The Forms section. ONE component with two homes: a client's detail pane and a
// project's Forms tab — scoped by whichever id it's given. Rows lead to the
// builder; the response count leads to the responses table.
//
// Presentation deliberately matches the surrounding detail sections (Projects,
// Invoices, Meetings): an h4 header + count + quiet "New", then hairline rows.
// A third list idiom on the same screen would read as a different product.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Link2, Check, Trash, ArrowRight, Copy } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, Badge, toast,
  Popover, PopoverTrigger, PopoverContent, MenuItem, MenuLabel, type BadgeStatus,
} from '@/components/ds/ui';
import { createForm, deleteForm, duplicateForm } from '@/lib/actions/forms';
import { FORM_TEMPLATES } from '@/lib/form-templates';
import { cn } from '@/lib/cn';
import type { FormSummary } from '@/lib/forms';

const STATUS_TONE: Record<string, BadgeStatus> = { draft: 'neutral', live: 'success', closed: 'neutral' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', live: 'Live', closed: 'Closed' };

const rel = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function FormsPanel({ forms, clientId, projectId, className }: {
  forms: FormSummary[]; clientId?: string; projectId?: string; className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function create(template?: string) {
    setBusy(true);
    const res = await createForm({ clientId, projectId, template });
    setBusy(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    router.push(`/forms/${res.id}`);
  }

  async function duplicate(id: string) {
    const res = await duplicateForm(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    router.push(`/forms/${res.id}`);
  }

  async function copyLink(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/${token}`);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    } catch { toast({ message: 'Couldn’t copy the link.', variant: 'error' }); }
  }

  async function remove(id: string, title: string) {
    const res = await deleteForm(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    toast({ message: `“${title}” deleted.` });
    router.refresh();
  }

  return (
    <section className={cn('mt-10', className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-h4 text-ink-900">Forms</span>
        <span className="text-caption tabular-nums text-ink-500">{forms.length}</span>
        <span className="flex-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="xs" variant="ghost" icon={<Icon icon={Plus} size={14} />} loading={busy}>New</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[264px] p-1.5">
            <MenuItem onClick={() => create()}>Blank form</MenuItem>
            <MenuLabel>Start from a template</MenuLabel>
            {FORM_TEMPLATES.map((t) => (
              <MenuItem key={t.key} onClick={() => create(t.key)}>
                <span className="flex-1">{t.name}</span>
                <span className="text-meta text-ink-500">{t.hint}</span>
              </MenuItem>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {forms.length === 0 ? (
        <div className="py-1.5 text-ui text-ink-500">
          No forms yet. Collect a brief or feedback — they fill it in without an account.
        </div>
      ) : (
        forms.map((f) => (
          <div key={f.id} className="group flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
            <button
              onClick={() => router.push(`/forms/${f.id}`)}
              className="focus-ring min-w-0 flex-1 rounded-sm text-left"
            >
              <span className="block truncate text-ui text-ink-800">{f.title}</span>
              <span className="mt-0.5 block truncate text-caption text-ink-500">
                Updated {rel(f.updatedAt)}
                {f.partials > 0 && <> · <span className="tabular-nums">{f.partials}</span> in progress</>}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {f.shareToken && f.status === 'live' && (
                <IconButton
                  label={copied === f.id ? 'Copied' : 'Copy link'}
                  variant="ghost"
                  size="xs"
                  icon={<Icon icon={copied === f.id ? Check : Link2} size={14} />}
                  onClick={() => copyLink(f.shareToken!, f.id)}
                />
              )}
              <IconButton label="Duplicate form" variant="ghost" size="xs" icon={<Icon icon={Copy} size={14} />} onClick={() => duplicate(f.id)} />
              <IconButton label="Delete form" variant="ghost" size="xs" icon={<Icon icon={Trash} size={14} />} onClick={() => remove(f.id, f.title)} />
            </div>

            <Badge status={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>

            <button
              onClick={() => router.push(`/forms/${f.id}/responses`)}
              aria-label={`${f.responses} responses`}
              className="focus-ring flex shrink-0 items-center gap-1 rounded-sm text-ink-500 transition-colors hover:text-ink-900"
            >
              <span className="tabular-nums text-ui text-ink-800">{f.responses}</span>
              <Icon icon={ArrowRight} size={13} />
            </button>
          </div>
        ))
      )}
    </section>
  );
}
