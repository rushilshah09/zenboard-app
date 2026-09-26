'use client';
// ── ENTERING FOCUS ──────────────────────────────────────────────────────────
//
// The user, 2026-09-26, with pictures of a jump to hyperspace: "in brand colours, they are entering
// focus mode". The moment a focus session starts, the page falls away down a tunnel of streaks in the
// brand's own colours (berry, petal, periwinkle, apricot, and the illustration's light) and comes out
// on the quiet dark ground the session runs on.
//
// Emil's frequency test allows it: it plays once, when someone chooses to start a session, never on
// anything done a hundred times a day. It speeds up into the jump and slows into the arrival, so it
// never ends on a hard stop, and it is over in `--site-warp`. It is a picture (hidden from assistive
// technology), and less motion skips it for the plain fade the session arrives on anyway.

import * as React from 'react';

/** The brand's colours, read from the page so both themes and a chosen accent follow. */
const INKS = ['--accent', '--color-field-petal', '--color-field-periwinkle', '--color-field-apricot', '--color-illustration-light'];
/** Berry most, then petal and periwinkle, apricot and light least: the brand leads. */
const WEIGHTS = [0.34, 0.22, 0.22, 0.12, 0.1];
const STARS = 380;

/** A duration token (`1.4s`, `900ms`) in milliseconds. */
function ms(value: string, fallback: number): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n : n * 1000;
}

export function Warp({ onDone }: { onDone: () => void }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const done = React.useRef(onDone);
  React.useEffect(() => { done.current = onDone; });

  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current();
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    const cx = w / 2;
    const cy = h / 2;
    const reach = Math.hypot(cx, cy);
    // Where a star at depth 1 sits: near the middle. Nearer ones fly out past the edges.
    const focal = reach * 0.07;

    const probe = document.createElement('span');
    canvas.parentElement?.appendChild(probe);
    const inks = INKS.map((v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; });
    probe.remove();
    const pick = () => {
      let r = Math.random();
      for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return inks[i]; }
      return inks[0];
    };
    const stars = Array.from({ length: STARS }, () => ({
      a: Math.random() * Math.PI * 2,
      z: 0.05 + Math.random() * 0.95,
      ink: pick(),
      width: 0.5 + Math.random() * 1.5,
    }));
    const total = ms(getComputedStyle(document.documentElement).getPropertyValue('--site-warp'), 1400);

    let raf = 0;
    let last = performance.now();
    const start = last;
    const frame = (t: number) => {
      const p = Math.min(1, (t - start) / total);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      // Into the jump and out of it: the speed rises to its peak and falls away again, so it arrives.
      const speed = Math.pow(Math.sin(Math.PI * p), 1.6);
      const fade = Math.min(1, p / 0.12) * Math.min(1, (1 - p) / 0.3);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      // The light at the end of it.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * (0.12 + speed * 0.3));
      glow.addColorStop(0, inks[0]);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.28 * speed * fade;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.z -= (0.25 + speed * 2.4) * dt;
        if (s.z <= 0.02) s.z += 1;
        const trail = 0.004 + speed * 0.3;
        const r1 = focal / s.z;
        const r0 = focal / (s.z + trail);
        if (r0 > reach * 1.2) continue;
        const cos = Math.cos(s.a);
        const sin = Math.sin(s.a);
        ctx.globalAlpha = fade * Math.min(1, (1 - s.z) * 1.4);
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = s.width * (1 + (1 - s.z) * 1.8);
        ctx.beginPath();
        ctx.moveTo(cx + cos * r0, cy + sin * r0);
        ctx.lineTo(cx + cos * r1, cy + sin * r1);
        ctx.stroke();
      }
      if (p < 1) raf = requestAnimationFrame(frame);
      else done.current();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
