'use client';
// ── HOW MANY ARE ALREADY ON THE LIST ────────────────────────────────────────
//
// THE NUMBER, AND NOTHING ELSE (user, 2026-09-30: "dont show any face only counter, when people
// join counter grow"). The faces were the sample studio's own, but a row of strangers' portraits
// under a real number reads as stock photography vouching for something — and the number is the
// claim. It stands on its own.
//
// It COUNTS UP on first sight, which is what "grow" asks for: the figure arrives rather than simply
// being printed, so the eye lands on it. Once only, and never on a loop — this is a fact, not a
// meter. Someone who has asked for less motion is shown the final number immediately.
//
// The server always renders the FINAL number, so a page read without JavaScript, or scraped, or
// screenshotted mid-animation, still says the true figure.

import * as React from 'react';

/** How long the climb takes, from the site's own ladder. */
const RISE_MS = 900;

export function JoinedCount({ joined }: { joined: number }) {
  const [shown, setShown] = React.useState(joined);
  const ref = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Start the climb only when it is looked at: a number that finished counting three screens
    // above the fold has told nobody anything.
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      // From a little below, not from zero: counting up from 0 to 80 reads as a loading bar, and
      // for a few hundred milliseconds it tells a visitor the list is emptier than it is.
      const from = Math.max(0, joined - 24);
      const t0 = performance.now();
      let raf = 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / RISE_MS);
        // Ease out: it arrives at the true number and settles, rather than stopping dead.
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(Math.round(from + (joined - from) * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      setShown(from);
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, { rootMargin: '-40px' });
    io.observe(el);
    return () => io.disconnect();
  }, [joined]);

  return (
    <p ref={ref} className="text-body text-ink-600">
      {/* The true figure is always in the a11y tree and in the markup; only the digits on screen
          climb. `aria-hidden` on the climbing span stops a screen reader reciting every step. */}
      <span className="sr-only">{joined.toLocaleString('en-US')} already joined</span>
      <span aria-hidden>
        <strong className="text-title-sm font-medium tabular-nums text-ink-900">{shown.toLocaleString('en-US')}</strong>
        {' '}already joined
      </span>
    </p>
  );
}
