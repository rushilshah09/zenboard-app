'use client';
// ── BACK TO THE TOP ─────────────────────────────────────────────────────────
//
// The user, 2026-09-26: "give the website a back to top option". A page this long earns one, and only
// once the reader is well into it: it arrives past two screens down and leaves near the top again. It
// is a button, not a link to "#": the page glides back (at once, for less motion) and the keyboard
// lands on the navigation's first link, so a keyboard reader is back at the top of the page too, not
// stranded on a button that has just gone.
//
// Bottom right, clear of the cookie choice (bottom left on a wide screen). On a phone that choice spans
// the width, so while it is being asked this waits. At the very foot of the page it rises above the
// footer's last row, so it never sits on the studio's credit there.

import * as React from 'react';
import { ArrowUp } from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui';
import { cn } from '@/lib/cn';

export function BackToTop() {
  const [shown, setShown] = React.useState(false);
  const [lifted, setLifted] = React.useState(false);

  React.useEffect(() => {
    const foot = document.querySelector('[data-site-foot]');
    if (!foot) return;
    const io = new IntersectionObserver(([e]) => setLifted(e.isIntersecting));
    io.observe(foot);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const asking = window.innerWidth < 640 && !!document.querySelector('[aria-label="Cookie choice"]');
      setShown(window.scrollY > window.innerHeight * 2 && !asking);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    document.querySelector<HTMLElement>('header a[href]')?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      aria-hidden={!shown || undefined}
      tabIndex={shown ? 0 : -1}
      data-shown={shown || undefined}
      data-lifted={lifted || undefined}
      className={cn(
        // Its own press (`zb-nopress` hands the house's over): it moves on three properties the house's
        // press rule does not carry, and a press there would replace the lift for as long as it lasted.
        'site-top zb-nopress focus-ring fixed bottom-4 end-4 z-sticky grid size-11 place-items-center rounded-full border border-line bg-surface-raised text-ink-800 shadow-panel sm:bottom-6 sm:end-6',
        'hover:bg-surface-hover hover:text-ink-900',
      )}
    >
      <Icon icon={ArrowUp} size={16} />
    </button>
  );
}
