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
import { Icon, IconSwap, Button, Drawer, Switch, Textarea, cardClass } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  setPortalEnabled, rotatePortalToken, updateShareFlags,
  setDocClientVisible, type ShareFlags,
} from '@/lib/actions/portal';
import { readChannels, clientVisible } from '@/lib/visibility';
import { applyShare } from '@/components/sharing/apply-share';
import type { PProject, PTask, PDoc } from '@/components/projects/projects-workspace';

const overline = 'text-overline text-ink-500';

function Row({ label, hint, on, onToggle, disabled }: { label: string; hint?: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="border-t border-line-soft py-3">
      <Switch
        checked={on}
        onCheckedChange={() => onToggle()}
        disabled={disabled}
        label={
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-ui font-medium', disabled ? 'text-ink-500' : 'text-ink-900')}>{label}</span>
            {hint && <span className={cn('mt-0.5 block text-caption', disabled ? 'text-ink-300' : 'text-ink-500')}>{hint}</span>}
          </span>
        }
      />
    </div>
  );
}

export function SharePanel({
  project, tasks, docs, taskVisible, onTaskVisible, portalSupported, onClose, onPatch, flash,
}: {
  project: PProject;
  tasks: PTask[];
  docs: PDoc[];
  /** Owned by the workspace now, not by this drawer — the same marks are shown
   *  and changed on the task rows themselves, and two copies would disagree. */
  taskVisible: Record<string, boolean>;
  onTaskVisible: (id: string, next: boolean) => void;
  portalSupported: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<PProject>) => void;
  flash: (m: string) => void;
}) {
  const [p, setP] = useState(project);
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
    flash('Link rotated. The old link no longer works');
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

  async function flipDoc(id: string) {
    const next = !docVis[id];
    setDocVis((m) => ({ ...m, [id]: next }));
    await applyShare(() => setDocClientVisible(id, next), () => setDocVis((m) => ({ ...m, [id]: !next })), flash);
  }

  const topTasks = tasks.filter((t) => !t.parent_task_id);
  // Both gates, from the one rule — so this drawer counts what the PORTAL will
  // show, not what has been ticked.
  const channels = readChannels(p as unknown as Record<string, unknown>);
  const sharesAnything = Object.values(channels).some((v) => v === true);
  const sharedTasks = clientVisible('task', topTasks.map((t) => ({ client_visible: taskVisible[t.id] === true, done: t.done })), channels).length;

  return (
    // ── STAYS A DRAWER, DELIBERATELY ────────────────────────────────────────
    // Everything else that opens in Zenboard goes through <PageView>, and this
    // does not, so the reason belongs here rather than being re-litigated
    // (CONSISTENCY_PRINCIPLE.md: a divergence must be named, caused by the use
    // case, and written where the code is).
    //
    // PageView opens a RECORD. This is not a record — it is one project's
    // settings for one capability. It has no canonical URL, so "Open in new
    // tab" would have nothing to point at; there are no siblings, so the
    // back/forward-through-records control is dead; and there is no reason to
    // remember "how do I like sharing settings to open", because you open it,
    // change a switch and leave. Rendering it through PageView would put a
    // toolbar of inert controls above a settings list — consistency of
    // appearance bought by making three affordances lie.
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }} modal size="md" title="Share with client">
      {!portalSupported ? (
        <div className={cardClass('p-4 text-ui leading-relaxed text-ink-600')}>
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
                <Button size="sm" variant="secondary" icon={<IconSwap swapKey={copied ? 'check' : 'copy'}><Icon icon={copied ? Check : Copy} size={14} /></IconSwap>} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                <Button size="sm" variant="ghost" icon={<Icon icon={RefreshCw} size={14} />} onClick={rotate}>Rotate link</Button>
              </div>
            </div>
          )}

          {/* The most embarrassing failure this feature has: sending a link to
              a page with nothing on it. Cheap to detect (lib/visibility.ts
              already answers it) and it belongs next to the switches that fix
              it, not in a toast after the client has replied. */}
          {p.portal_enabled && !sharesAnything && (
            <div className="mt-3 rounded-md border border-dashed border-line-strong px-3 py-2 text-caption text-ink-600">
              Nothing is switched on yet, so this link opens an empty page.
            </div>
          )}

          {/* What to share */}
          <div className="mt-6">
            <div className={cn(overline, 'mb-1')}>What the client sees</div>
            <Row label="Progress" hint="Percent complete and X/Y done" on={p.share_progress ?? false} onToggle={() => flip('share_progress', !(p.share_progress ?? false))} />
            <Row label="Completed tasks" hint="Titles only" on={p.share_completed_tasks ?? false} onToggle={() => flip('share_completed_tasks', !(p.share_completed_tasks ?? false))} />
            <Row label="Open tasks" hint="Titles only: no notes, time, or estimates" on={p.share_open_tasks ?? false} onToggle={() => flip('share_open_tasks', !(p.share_open_tasks ?? false))} />
            <Row label="Timeline" hint="Recent completed updates" on={p.share_timeline ?? false} onToggle={() => flip('share_timeline', !(p.share_timeline ?? false))} />
            {/* One switch, both kinds — `share_files` is the channel that
                `lib/visibility.ts` maps BOTH docs and files onto, and calling
                it "Documents" here while it also gates uploaded files was the
                label quietly disagreeing with the rule. */}
            <Row label="Documents and files" hint="Only the ones you mark for the client" on={p.share_files ?? false} onToggle={() => flip('share_files', !(p.share_files ?? false))} />
            <Row label="Invoices" hint="Status and amounts of sent invoices, no drafts or notes" on={p.share_invoices ?? false} onToggle={() => flip('share_invoices', !(p.share_invoices ?? false))} />
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
              <div className={cn(overline, 'mb-1')}>Tasks · {sharedTasks} shared</div>
              {/* The bulk pass. The everyday one now lives on the task rows
                  themselves, so this says where rather than implying it is the
                  only way. */}
              <div className="mb-1.5 text-caption text-ink-500">You can also mark a task from its row in the Tasks tab.</div>
              {topTasks.map((t) => (
                <Row key={t.id} label={t.title} hint={t.done ? 'Completed' : 'Open'} on={taskVisible[t.id] === true}
                  onToggle={() => onTaskVisible(t.id, taskVisible[t.id] !== true)} />
              ))}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
