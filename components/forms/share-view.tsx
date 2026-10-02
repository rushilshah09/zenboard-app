'use client';
// Share — the form's public life, as a PLACE.
//
// It used to be a modal opened from the builder, which meant the one thing you
// come back for ("what's the link again?") was behind a button on a different
// tab, and the URL of the page you were on said nothing about it. This module
// already decided the rule — FormTabs: "tabs are PLACES, not modes: each one is
// a real URL you can send someone, so nothing important hides behind a toggle"
// — and Share was the surface still breaking it.
//
// BENCHMARK (rule 7). Tally's Share tab is the link + copy, a social link
// preview, and three embed options (standard, popup, full page). We ship the
// link, the embed snippet and the rotate; the social preview card is a paid
// feature there and is a rendering of metadata rather than a control, so it is
// deliberately not imitated. What we add that Tally does not have: the client
// portal switch, because a form for a client should be reachable where that
// client already goes.
import { useState } from 'react';
import { Check, Copy, RotateCcw, ExternalLink } from '@/components/ds/icons';
import { Icon, IconSwap, Button, IconButton, TextInput, Switch, toast, useConfirm } from '@/components/ds/ui';
import { rotateFormToken, setFormInPortal } from '@/lib/actions/forms';
import { cn } from '@/lib/cn';

/** The public URL of a form. One builder, because four files were composing it
 *  by hand and a share link that differs by a slash is a dead link. */
export function formUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return `${base}/f/${token}`;
}

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ message: 'Copy failed. Select the text and copy it manually.', variant: 'error' });
    }
  };
  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <textarea
          value={value} readOnly aria-label={label} rows={3}
          onFocus={(e) => e.currentTarget.select()}
          className="focus-ring min-w-0 flex-1 resize-none rounded-md border border-line-strong bg-surface-sunken px-3 py-2 font-mono text-caption text-ink-700 outline-none"
        />
      ) : (
        <TextInput value={value} readOnly aria-label={label} className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
      )}
      <Button variant={multiline ? 'secondary' : 'primary'} icon={<IconSwap swapKey={copied ? 'check' : 'copy'}><Icon icon={copied ? Check : Copy} size={16} /></IconSwap>} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export function ShareView({ form, demo = false }: {
  form: {
    id: string; title: string; status: 'draft' | 'live' | 'closed';
    shareToken: string | null; projectId: string | null; showInPortal: boolean;
  };
  /** Harness mode: render everything, touch no server. */
  demo?: boolean;
}) {
  const [token, setToken] = useState(form.shareToken);
  const [inPortal, setInPortal] = useState(form.showInPortal);
  const [confirm, confirmUI] = useConfirm();

  const url = token ? formUrl(token) : '';
  // The standard Tally-style embed: an iframe with no chrome of its own, so the
  // host page's background shows through and the form reads as part of the site.
  const embed = token
    ? `<iframe src="${url}" width="100%" height="640" frameborder="0" title="${form.title.replace(/"/g, '&quot;') || 'Form'}"></iframe>`
    : '';

  async function rotate() {
    // Rotating is destructive in a way nothing can undo: every link already
    // sent — in an email, in a proposal, on a site — stops working the instant
    // it lands. It is the one action on this page that gets a confirmation.
    const ok = await confirm({
      title: 'Create a new link?',
      body: 'The current link stops working immediately, including anywhere you have already shared or embedded it.',
      actionLabel: 'Create a new link',
    });
    if (!ok) return;
    if (demo) { setToken(`demo-${Math.random().toString(36).slice(2, 10)}`); return; }
    const res = await rotateFormToken(form.id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setToken(res.token);
    toast({ message: 'New link created. The old one no longer works.' });
  }

  async function togglePortal(next: boolean) {
    setInPortal(next);
    if (demo) return;
    const res = await setFormInPortal(form.id, next);
    if ('error' in res) { setInPortal(!next); toast({ message: res.error, variant: 'error' }); }
  }

  // A draft has no link, and inventing one would be a promise the /f/ route
  // does not keep — it refuses anything that is not live. So this says what to
  // do about it rather than showing a box you cannot use.
  if (!token || form.status === 'draft') {
    return (
      <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
        <h2 className="text-h3 text-ink-900">This form isn’t published yet.</h2>
        <p className="mt-2 max-w-[52ch] text-body text-ink-600">
          Publishing creates the link people fill in. Nothing is shared until you do, and you can keep editing afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-5 py-8 sm:px-8">
      <section className="flex flex-col gap-3">
        <div>
          <span className="text-overline text-ink-500">Link</span>
          <p className="mt-1 text-body text-ink-600">
            Anyone with this link can fill the form in, no account needed.
            {form.status === 'closed' && <span className="text-warning-600"> The form is closed, so the link shows a closed notice.</span>}
          </p>
        </div>
        <CopyField label="Form link" value={url} />
        <div className="flex items-center gap-1">
          <IconButton size="sm" variant="ghost" label="Open the form in a new tab"
            icon={<Icon icon={ExternalLink} size={16} />}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} />
          <IconButton size="sm" variant="ghost" label="Create a new link"
            icon={<Icon icon={RotateCcw} size={16} />} onClick={rotate} />
          <span className="text-meta text-ink-500">Open · new link</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <span className="text-overline text-ink-500">Embed</span>
          <p className="mt-1 text-body text-ink-600">
            Paste this into your own site. It stays in sync: editing the form updates every page it is on.
          </p>
        </div>
        <CopyField label="Embed code" value={embed} multiline />
      </section>

      {form.projectId && (
        <section className={cn('flex items-start justify-between gap-6 rounded-lg border border-line-soft p-4')}>
          <div className="min-w-0">
            <h3 className="text-ui font-medium text-ink-900">Show in the client portal</h3>
            <p className="mt-1 text-meta text-ink-500">
              The client sees it under Forms in their portal, so they never have to find the email with the link in it.
            </p>
          </div>
          <Switch checked={inPortal} onCheckedChange={togglePortal} aria-label="Show this form in the client portal" />
        </section>
      )}

      {confirmUI}
    </div>
  );
}
