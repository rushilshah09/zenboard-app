'use client';
// ── SHARING A TICKET ────────────────────────────────────────────────────────
//
// A ROW OF COMPOSERS, NOT A POSTING ROBOT. Each button opens that network's own composer with the
// words already written; the person presses post. Posting on someone's behalf would mean holding
// their account, which nobody hands over for a ticket, and a "share" that posts without a last look
// is how people end up surprised by their own timeline.
//
// The system share sheet is offered FIRST when the browser has one (phones, and Safari), because on
// a phone that sheet is where every app the person actually uses lives — including the ones we
// would never think to list. The named networks stay as the fallback, so a desktop is not left
// with nothing.

import * as React from 'react';
import { Copy, Check, Download } from '@/components/ds/icons';
import { Button, Icon, IconSwap, button, toast } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { shareMessage, shareUrl, type ShareTarget } from '@/lib/waitlist';

const NETWORKS: { id: ShareTarget; label: string }[] = [
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export function ShareRow({ number, onDownload, downloading, onDark = false }: {
  number: number;
  onDownload: () => void;
  downloading?: boolean;
  /** On the black success screen. The DS buttons are drawn for the page's own ground, so on that
   *  one their words would be ink on ink — the same turn-over the site's closing band makes. */
  onDark?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);

  // Read on the client only: `navigator.share` does not exist while this renders on the server, and
  // asking during render would make the first paint disagree with the second.
  React.useEffect(() => { setCanShare(typeof navigator !== 'undefined' && !!navigator.share); }, []);

  // One place each treatment is spelled, so a button cannot be dark in one row and light in another.
  const solid = onDark ? 'border-transparent bg-site-ink-fg text-site-ink hover:bg-site-ink-fg/90 active:bg-site-ink-fg/90' : '';
  const outline = onDark ? 'border-site-ink-line bg-transparent text-site-ink-fg hover:bg-site-ink-fg/10 active:bg-site-ink-fg/10' : '';
  const quiet = onDark ? 'text-site-ink-muted hover:bg-site-ink-fg/10 hover:text-site-ink-fg' : '';

  const origin = typeof window === 'undefined' ? 'https://zenboard.life' : window.location.origin;
  const text = shareMessage(number);
  const url = `${origin.replace(/\/$/, '')}/waitlist`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ message: 'Couldn’t copy: this browser kept the clipboard closed.', variant: 'error' });
    }
  };

  const systemShare = async () => {
    try { await navigator.share({ text, url }); } catch { /* dismissed — not an error */ }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="secondary" onClick={onDownload} loading={downloading} className={solid} icon={<Icon icon={Download} size={16} />}>
        Save ticket
      </Button>

      {canShare ? (
        <Button variant="secondary" onClick={systemShare} className={outline}>Share</Button>
      ) : (
        NETWORKS.map((n) => (
          /* An <a> wearing the button's class, NOT `<Button asChild>`: Button always renders a
             loading slot beside its label, so Slot is handed two children and throws
             ("Slot failed to slot onto its children"). This is how the site's own links are built. */
          <a
            key={n.id}
            href={shareUrl(n.id, number, origin)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(button({ variant: 'secondary', size: 'md' }), outline)}
          >
            {n.label}
          </a>
        ))
      )}

      {/* The glyph CROSS-FADES rather than being swapped: an icon that changes with state goes
          through IconSwap everywhere in the app (design-system.test.ts). */}
      <Button variant="ghost" onClick={copy} className={quiet} icon={<IconSwap swapKey={copied ? 'check' : 'copy'}><Icon icon={copied ? Check : Copy} size={16} /></IconSwap>}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  );
}
