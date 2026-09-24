'use client';
// ── THE FIRST SECOND ───────────────────────────────────────────────────────
//
// User, 2026-09-24, with a screenshot of Figma booting: "when 1st time open application I want an
// animated Zenboard logo animation like this". Figma's boot screen is a mark and a bar on the
// app's own ground — no spinner, no percentage, no copy.
//
// What it is FOR decides how it behaves. A splash that plays on every navigation is a tax; this
// one plays ONCE PER SESSION, on the first open, and it is gone the moment the app is ready. It
// also does something honest while it is there: it covers the first paint, which is the frame
// where fonts swap and the shell measures itself — the least finished the app ever looks.
//
// ── WHY THE FLAG IS STAMPED BEFORE REACT ──────────────────────────────────
// Rendering the splash and then hiding it in an effect would flash it on EVERY route change of
// the session. The boot script (`lib/theme.ts`, the same one that applies the theme before first
// paint) stamps `data-booted` when the session has already seen it, and CSS does the rest — so a
// returning render never paints the splash at all. Same pattern, same file, one script.
//
// Motion: it is seen once per session, so it may animate (Emil's frequency rule). The mark fades
// and settles; the bar fills on a curve that reaches the end when the app says it is ready, then
// the whole thing leaves faster than it arrived. Reduced motion keeps the cover and drops the
// movement: the bar is then a still line, and the fade is all that remains.
import { useEffect, useRef } from 'react';
import { Mark } from '@/components/ds/ui';
import { BOOTED_ATTR, BOOT_KEY } from '@/lib/boot';

/** How long the splash is guaranteed to be visible, so it never flickers past. */
const MIN_VISIBLE_MS = 420;

export function BootSplash() {
  // NO REACT STATE. The splash's whole lifecycle is two attributes on <html>: `data-boot-ready`
  // fades it, `data-booted` takes it out of the layout — and `data-booted` is also what the boot
  // script stamps before first paint for a session that has already seen it. Keeping the state in
  // the DOM means the element cannot be mid-unmount while the CSS is mid-fade, and it means this
  // component never sets state from an effect.
  const left = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute(BOOTED_ATTR)) return; // already seen this session

    const started = performance.now();
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const leave = () => {
      if (left.current) return;
      left.current = true;
      // Remembered BEFORE the exit, so a navigation that interrupts the fade still counts.
      try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* private window */ }
      root.setAttribute('data-boot-ready', '');
      timer = setTimeout(() => root.setAttribute(BOOTED_ATTR, ''), 260);
    };

    // Ready = the app has had a frame to paint with its fonts and shell in place. Two frames,
    // because the first still belongs to the paint that mounted us.
    raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      const waited = performance.now() - started;
      timer = setTimeout(leave, Math.max(0, MIN_VISIBLE_MS - waited));
    }));

    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, []);

  return (
    <div className="zb-splash" aria-hidden>
      <div className="zb-splash-mark"><Mark size={34} /></div>
      <div className="zb-splash-bar"><span /></div>
    </div>
  );
}
