'use client';
// ── YOU'RE ON THE WAITLIST ──────────────────────────────────────────────────
//
// What replaces the page the moment someone joins (user, 2026-09-30): the white page gives way to
// a full black screen, the ticket slides out of its holder and the holder drops away (the storyboard's
// last beats), and the two things they can do next are underneath it.
//
// IT IS A TAKEOVER, NOT A SECTION. `fixed inset-0`, its own scroll, and the page behind it is
// inert — because this is the end of one task, not a step in it. A success that renders inline
// leaves the form they just used sitting above it, inviting them to do it again.
//
// IT ARRIVES IN THREE BEATS, and the order is the point: the black arrives first so the eye has
// somewhere to land, THEN the card comes out of the box, THEN the words and the actions rise under
// it. All three at once is a flash; this is a reveal. Every duration is a token.
//
// NOTHING ANIMATES FOR SOMEONE WHO ASKED FOR LESS: the beats collapse and the screen is simply
// there, card already out.

import * as React from 'react';
import { Button } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { formatTicket, ticketFilename } from '@/lib/waitlist';
import { ticketBlob, saveBlob } from '@/lib/ticket-image';
import { GoldenTicket } from './golden-ticket';
import { ShareRow } from './share-row';

export function WaitlistSuccess({ number, name, username, already, onClose }: {
  number: number;
  name: string | null;
  username: string | null;
  already: boolean;
  onClose: () => void;
}) {
  const [out, setOut] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const claimed = username;
  const [downloading, setDownloading] = React.useState(false);
  const ticketRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    // Focus moves with the eye: the screen has replaced the page, so a keyboard left on the submit
    // button would be pointing at something that no longer exists.
    headingRef.current?.focus();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOut(true); setShown(true); return; }
    const a = window.setTimeout(() => setOut(true), 420);
    const b = window.setTimeout(() => setShown(true), 900);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);

  // Escape is the way out of any layer in this product.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async () => {
    const el = ticketRef.current?.querySelector('.zb-ticket');
    if (!(el instanceof HTMLElement)) return;
    setDownloading(true);
    try {
      const blob = await ticketBlob(el);
      if (blob) saveBlob(blob, ticketFilename(number));
    } finally { setDownloading(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="zb-joined-title" className="zb-joined">
      <div className="zb-joined-scroll">
        <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center gap-12 px-6 py-20">
          <span aria-hidden className="zb-ticket-pool" />
          <div ref={ticketRef} className="relative w-full max-w-[460px]">
<GoldenTicket number={number} name={name} arrive out={out} />
          </div>

          <div data-shown={shown ? 'true' : undefined} className="zb-joined-body flex w-full flex-col items-center gap-10 text-center">
            <div>
              <h2
                id="zb-joined-title"
                ref={headingRef}
                tabIndex={-1}
                className="font-editorial text-headline-sm text-site-ink-fg outline-none"
              >
                {already ? 'You’re already on the waitlist.' : 'You’re on the waitlist.'}
              </h2>
              <p className="mt-2 text-body-lg tabular-nums text-site-ink-muted">
                Ticket {formatTicket(number)}. We’ll email you when your place comes up.
              </p>
            </div>

            {/* Claimed as they joined, in the same insert — there is nothing left to do here but
                tell them it is theirs. */}
            {claimed && (
              <p className="text-body-lg text-site-ink-muted">
                Your username is <strong className="font-medium text-site-ink-fg">@{claimed}</strong>, held until launch.
              </p>
            )}

            <div className="flex flex-col items-center gap-3">
              <ShareRow number={number} onDownload={download} downloading={downloading} onDark />
              <Button variant="ghost" onClick={onClose} className={cn('text-site-ink-muted')}>Back to the site</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
