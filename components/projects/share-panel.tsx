'use client';
// Owner Share controls (Surface A). Enable/disable the portal (generates/rotates
// the token), copy the public link, flip the granular share_* switches, write an
// intro, and toggle per-task / per-doc client_visible. Every change persists via
// owner-RLS server actions and bubbles up so the header + Preview reflect it.
//
// DS-built: §4.37 Drawer (modal), §4.18 Switch (immediate-effect rows), §5.1
// Button, §4.14 Textarea. No inline styles, no legacy Paper-OS tokens.
import { useState } from 'react';
import { Copy, RefreshCw, Check, Link as LinkIcon } from "@/components/ds/icons";
import { Icon, Button, Drawer, Switch, Textarea } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  setPortalEnabled, rotatePortalToken, updateShareFlags,
  setTaskClientVisible, setDocClientVisible, type ShareFlags,
} from '@/lib/actions/portal';
import type { PProject, PTask, PDoc } from '@/components/projects/projects-workspace';

const overline = 'text-overline uppercase text-ink-500';

function Row({ label, hint, on, onToggle, disabled }: { label: string; hint?: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="border-t border-line-soft py-3">
      <Switch
        checked={on}
        onCheckedChange={() => onToggle()}
        disabled={disabled}
        label={
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-ui font-medium', disabled ? 'text-ink-400' : 'text-ink-900')}>{label}</span>
            {hint && <span className={cn('mt-0.5 block text-caption', disabled ? 'text-ink-300' : 'text-ink-500')}>{hint}</span>}
          </span>
        }
      />
    </div>
  );
}

export function SharePanel({
  project, tasks, docs, taskVisible, portalSupported, onClose, onPatch, flash,
}: {
  project: PProject;
  tasks: PTask[];
  docs: PDoc[];
  taskVisible: Record<string, boolean>;
  portalSupported: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<PProject>) => void;
  flash: (m: string) => void;
}) {
  const [p, setP] = useState(project);
  const [tv, setTv] = useState(taskVisible);
  const [docVis, setDocVis] = useState<Record<string, boolean>>(() => Object.fromEntries(docs.map((d) => [d.id, d.client_visible])));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = p.portal_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${p.portal_token}` : '';

  function patch(patch: Partial<PProject>) { setP((x) => ({ ...x, ...patch })); onPatch(patch); }

  async function toggleEnabled() {
    setBusy(true);
    const next = !p.portal_enabled;
    const res = await setPortalEnabled(p.id, next);
    setBusy(false);
    if ('error' in res) { flash(res.error); return; }
    patch({ portal_enabled: next, portal_token: res.token });
    flash(next ? 'Portal enabled' : 'Portal disabled');
  }

  async function rotate() {
    setBusy(true);
    const res = await rotatePortalToken(p.id);
    setBusy(false);
    if ('error' in res) { flash(res.error); return; }
    patch({ portal_token: res.token });
    setCopied(false);
    flash('Link rotated — the old link no longer works');
  }

  async function flip(key: keyof ShareFlags, value: boolean) {
    patch({ [key]: value } as Partial<PProject>);
    const res = await updateShareFlags(p.id, { [key]: value });
    if ('error' in res) { patch({ [key]: !value } as Partial<PProject>); flash(res.error); }
  }

  async function saveIntro(value: string | null) {
    if (value === (p.portal_intro ?? null)) return;
    patch({ portal_intro: value });
    const res = await updateShareFlags(p.id, { portal_intro: value });
    if ('error' in res) flash(res.error);
  }

  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { flash(link); }
  }

  async function flipTask(id: string) {
    const next = !tv[id];
    setTv((m) => ({ ...m, [id]: next }));
    const res = await setTaskClientVisible(id, next);
    if ('error' in res) { setTv((m) => ({ ...m, [id]: !next })); flash(res.error); }
  }
  async function flipDoc(id: string) {
    const next = !docVis[id];
    setDocVis((m) => ({ ...m, [id]: next }));
    const res = await setDocClientVisible(id, next);
    if ('error' in res) { setDocVis((m) => ({ ...m, [id]: !next })); flash(res.error); }
  }

  const topTasks = tasks.filter((t) => !t.parent_task_id);

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }} modal size="md" title="Share with client">
      {!portalSupported ? (
        <div className="rounded-lg border border-line-soft bg-surface-raised p-4 text-ui leading-relaxed text-ink-600">
          The client portal needs migration <code className="font-mono text-caption">0006_portal.sql</code>. Apply it in the Supabase SQL editor, then reload to enable sharing.
        </div>
      ) : (
        <>
          {/* Enable — the drawer's main decision, one step up on the surface ladder when live. */}
          <div className={cn('rounded-lg border p-4 transition-colors duration-fast', p.portal_enabled ? 'border-line-strong bg-surface-selected' : 'border-line-soft bg-surface-raised')}>
            <Switch
              checked={!!p.portal_enabled}
              onCheckedChange={toggleEnabled}
              loading={busy}
              label={
                <span className="min-w-0 flex-1">
                  <span className="block text-ui font-medium text-ink-900">{p.portal_enabled ? 'Portal is live' : 'Enable client portal'}</span>
                  <span className="mt-0.5 block text-caption text-ink-500">{p.portal_enabled ? 'Anyone with the link can view what you share' : 'Create a private link to share progress'}</span>
                </span>
              }
            />
          </div>

          {/* Link */}
          {p.portal_enabled && link && (
            <div className="mt-3">
              <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-sunken px-2.5 py-2">
                <Icon icon={LinkIcon} size={14} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-caption text-ink-800">{link}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" icon={<Icon icon={copied ? Check : Copy} size={14} />} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                <Button size="sm" variant="ghost" icon={<Icon icon={RefreshCw} size={14} />} onClick={rotate}>Rotate link</Button>
              </div>
            </div>
          )}

          {/* What to share */}
          <div className="mt-6">
            <div className={cn(overline, 'mb-1')}>What the client sees</div>
            <Row label="Progress" hint="Percent complete and X/Y done" on={p.share_progress ?? false} onToggle={() => flip('share_progress', !(p.share_progress ?? false))} />
            <Row label="Completed tasks" hint="Titles only" on={p.share_completed_tasks ?? false} onToggle={() => flip('share_completed_tasks', !(p.share_completed_tasks ?? false))} />
            <Row label="Open tasks" hint="Titles only — no notes, time, or estimates" on={p.share_open_tasks ?? false} onToggle={() => flip('share_open_tasks', !(p.share_open_tasks ?? false))} />
            <Row label="Timeline" hint="Recent completed updates" on={p.share_timeline ?? false} onToggle={() => flip('share_timeline', !(p.share_timeline ?? false))} />
            <Row label="Documents" hint="Only docs you mark visible below" on={p.share_files ?? false} onToggle={() => flip('share_files', !(p.share_files ?? false))} />
            <Row label="Invoices" hint="Status and amounts of sent invoices — no drafts or notes" on={p.share_invoices ?? false} onToggle={() => flip('share_invoices', !(p.share_invoices ?? false))} />
            <Row label="Allow messages" hint="Let the client send requests" on={p.allow_requests ?? false} onToggle={() => flip('allow_requests', !(p.allow_requests ?? false))} />
          </div>

          {/* Intro */}
          <div className="mt-6">
            <div className={cn(overline, 'mb-2')}>Intro note (optional)</div>
            <Textarea
              defaultValue={p.portal_intro ?? ''}
              onBlur={(e) => saveIntro(e.target.value.trim() || null)}
              placeholder="A short welcome shown at the top of the portal…" rows={3} />
          </div>

          {/* Per-doc visibility */}
          {docs.length > 0 && (
            <div className="mt-6">
              <div className={cn(overline, 'mb-1')}>Documents</div>
              {docs.map((d) => (
                <Row key={d.id} label={d.title?.trim() || 'Untitled'} hint={d.type} on={!!docVis[d.id]} onToggle={() => flipDoc(d.id)} disabled={!p.share_files} />
              ))}
              {!p.share_files && <div className="mt-1.5 text-caption text-ink-500">Turn on “Documents” above to share any of these.</div>}
            </div>
          )}

          {/* Per-task overrides */}
          {topTasks.length > 0 && (
            <div className="mt-6">
              <div className={cn(overline, 'mb-1')}>Share specific tasks</div>
              <div className="mb-1.5 text-caption text-ink-500">Adds a task to the portal even if its group above is off.</div>
              {topTasks.map((t) => (
                <Row key={t.id} label={t.title} hint={t.done ? 'Completed' : 'Open'} on={!!tv[t.id]} onToggle={() => flipTask(t.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
