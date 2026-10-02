'use client';
// ── THE HALFTONE ────────────────────────────────────────────────────────────
//
// The website's gradient, printed rather than airbrushed. A soft colour cloud is how every SaaS page
// says "calm"; Zenboard's pages say it in their own marks. A cell is SCREENED the way a print is: a
// lattice whose ink mass follows the shape underneath.
//
// THE RAMP, lightest to heaviest (rebuilt 2026-09-26 from the user's moodboard, which is a plotter's
// screen: filled dots and open rings of ramping size over a blurred field):
//
//   ·  a fine dot  ·  an open ring  ·  a dot  ·  a wider ring  ·  a heavy dot
//   ·  the star at the heart of the mark  ·  the mark itself
//
// Filled and open ALTERNATE, and each step carries more ink than the one below it whichever it is
// (a ring's ink is its circumference times its stroke; the pairs are matched to within a few per
// cent). That alternation is the whole difference between a screen and a field of dots: it is what
// gives the print a weave. The heavy end is the logo, because the user's rule is that the shapes
// here are ours ("we use mostly our logo shape for the halftone").
//
// The shape underneath is always the mark, placed and cropped by its cell: the hero holds the whole
// of it behind the headline, and each product area shows one lobe.
//
// TWO INKS, NEVER THREE. Light and deep — white and black, both blended into the colour rather than
// laid on it (user, 2026-09-26: "I don't want brand colour on that, I want only black and white, we
// use with blend mode"). The open rings take the deep ink and the filled marks the light one, which
// is what makes a screen read as printed rather than as an overlay.
//
// IT ANSWERS THE HAND. Point at it and the print swells and DARKENS under the pointer, drawing in
// the deep ink. Double-click it and a ring travels out from where you struck, lifting the screen as
// it passes and flashing it in the light ink: the same gesture as a finger on water, and the only
// thing on this page that answers a click rather than a hover. A slow wave crosses the whole screen
// besides, stepping the glyphs it passes one weight up or down.
//
// It runs only while the cell is on screen and the tab is visible, and never when less motion is
// asked for; then it is printed once and left alone, rings and all. It is decoration, so it is
// hidden from assistive technology and takes no pointer.

import * as React from 'react';
import { MARK_PATH } from '@/components/ds/icons';
import { cn } from '@/lib/cn';

export type MarkPlacement = {
  /** Centre of the mark, as a fraction of the cell's width and height. */
  x: number;
  y: number;
  /** The mark's size, as a fraction of the cell's shorter side (so a tall phone cell does not blow it up). */
  size: number;
  /** A turn, in turns (0.125 is 45°). */
  turn?: number;
};

/** Where the screen thins out: the side the words are on. */
export type Fade = 'start' | 'end' | 'top' | 'bottom';

/** The ramp's thresholds, lightest to heaviest: where a density crosses one, the glyph changes.
    Seven steps where there were five, because the moodboard's screens ramp in small increments and
    a five-step screen reads as five separate textures rather than as one gradient. */
const STEPS = [0.1, 0.22, 0.34, 0.47, 0.62, 0.78, 0.92];
/** How far the passing wave moves a glyph's density: never more than about one step. */
const SWELL = 0.1;
/** The wave's length, in glyphs. */
const WAVE = 9;
/** How heavy the ambient screen gets at its densest corner, before the mark is drawn over it.
    About a third: the ground is fine dots and open rings, and the mark still has four steps of
    ramp above it to rise through. */
const AMBIENT = 0.34;
/** Frames drawn per second while it moves. The wave is slow: more frames would only cost battery. */
const FPS = 24;
/** THE POINTER (user, 2026-09-26: "all the halftone effect with mouse interactive"). Where the
    visitor points, the print swells: a patch about `REACH` glyphs across lifts every glyph in it by
    up to `LIFT`, and draws in the DEEP ink, so the pointer leaves a dark thumbprint on the screen
    rather than a coloured one. The patch follows the pointer and fades in and out by a share of the
    way each frame (`FOLLOW`, `FADE`), so it trails like light rather than snapping like a cursor. */
const REACH = 11;
const LIFT = 0.55;
const FOLLOW = 0.22;
const FADE = 0.16;
/** THE RIPPLE (user, 2026-09-26: "on a double click I want a ripple effect also"). A ring of lift
    travelling out from the strike at `RIPPLE_SPEED` px a second, `RIPPLE_WIDTH` px thick, fading
    over `RIPPLE_LIFE`. It flashes the glyphs it passes in the LIGHT ink, which is the opposite of
    what the pointer does: you point and the print darkens, you strike and it catches the light.
    Three at once is plenty — a fourth is indistinguishable and costs a pass over the lattice. */
const RIPPLE_SPEED = 620;
const RIPPLE_WIDTH = 52;
const RIPPLE_LIFE = 1.15;
const RIPPLE_LIFT = 0.85;
const MAX_RIPPLES = 3;

const level = (d: number) => {
  let l = 0;
  while (l < STEPS.length && d >= STEPS[l]) l++;
  return l;
};
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A stable number in [0, 1) for a lattice point: the grain and the sparks never reshuffle. */
const hash = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** A duration token read from CSS ("8s", "8000ms") in seconds, so the loop's pace is a token too. */
const seconds = (v: string) => {
  const n = parseFloat(v);
  return /ms\s*$/.test(v) ? n / 1000 : n;
};

/** A colour token as the canvas can paint it: resolved by the browser, exactly as a CSS rule is. */
function colour(host: Element, token: string) {
  const probe = document.createElement('i');
  probe.style.cssText = `display:none;color:var(${token})`;
  host.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

/** Separable box blur on the lattice; out-of-range reads clamp, so a mark cropped by the cell stays full at the crop. */
function blur(src: Float32Array, cols: number, rows: number, r: number) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  const at = (v: number, max: number) => Math.min(max - 1, Math.max(0, v));
  for (let j = 0; j < rows; j++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[j * cols + at(i, cols)];
    for (let i = 0; i < cols; i++) {
      tmp[j * cols + i] = acc / n;
      acc += src[j * cols + at(i + r + 1, cols)] - src[j * cols + at(i - r, cols)];
    }
  }
  for (let i = 0; i < cols; i++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += tmp[at(j, rows) * cols + i];
    for (let j = 0; j < rows; j++) {
      out[j * cols + i] = acc / n;
      acc += tmp[at(j + r + 1, rows) * cols + i] - tmp[at(j - r, rows) * cols + i];
    }
  }
  return out;
}

// The two stars, from the mark's own geometry. The heart is the mark's inner subpath; the joint is the
// same curve turned a quarter, which is the shape four rounded cells leave where they meet.
const HEART = `M${MARK_PATH.split('M').pop()}`;

/**
 * ONE CELL OF THE SCREEN, at level `l`. Everything is a fraction of the PITCH rather than of a
 * fixed 14px cell, so a finer screen is the same drawing smaller rather than a different one.
 *
 * No mark is smaller than about 0.6 CSS px across: below that a filled arc renders as a faint
 * SQUARE and the screen reads as a pixel grid, which is the other half of what "looks basic, just
 * put on the gradient" was describing.
 *
 * Filled and OPEN alternate up the ramp, which is what the user's reference screens do and what
 * gives a print its weave; a field of plain dots reads as a texture swatch. The pairs are matched
 * by ink mass, since a ring's ink is 2πr·lw and a dot's is πr²: (r .12, lw .055) against r .105 is
 * about 15% apart, (r .185, lw .075) against r .165 about 1%. So the ramp alternates texture
 * without the weight jumping around.
 *
 * The heavy end is the logo — its heart, then the mark whole (user, 2026-09-26: "we use mostly our
 * logo shape for the halftone or any effect shape").
 */
function glyph(g: CanvasRenderingContext2D, l: number, pitch: number, mark: Path2D, heart: Path2D) {
  if (l <= 5) {
    const ring = l === 2 || l === 4;
    const r = [0.085, 0.145, 0.125, 0.205, 0.185][l - 1] * pitch;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    if (!ring) { g.fill(); return; }
    g.lineWidth = (l === 2 ? 0.062 : 0.082) * pitch;
    g.strokeStyle = g.fillStyle;
    g.stroke();
    return;
  }
  const size = (l === 6 ? 0.55 : 0.72) * pitch;
  g.scale(size / 20, size / 20);
  g.translate(-10, -10);
  g.fill(l === 7 ? mark : heart);
}

/** Every glyph in every ink, drawn once: a frame is then only copies. Rows: light, strong, deep. */
function sheetFor(pitch: number, dpr: number, inks: string[]) {
  const sheet = document.createElement('canvas');
  sheet.width = Math.ceil(pitch * dpr * STEPS.length);
  sheet.height = Math.ceil(pitch * dpr * inks.length);
  const g = sheet.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  const mark = new Path2D(MARK_PATH);
  const heart = new Path2D(HEART);
  inks.forEach((ink, row) => {
    g.fillStyle = ink;
    for (let l = 1; l <= STEPS.length; l++) {
      g.save();
      g.translate((l - 1) * pitch + pitch / 2, row * pitch + pitch / 2);
      glyph(g, l, pitch, mark, heart);
      g.restore();
    }
  });
  return sheet;
}

type Lattice = { cols: number; rows: number; base: Float32Array; seed: Float32Array };

/** The weight of every lattice point: the mark's coverage, heavier inside its lobes, loose grain around it. */
function latticeFor(w: number, h: number, pitch: number, place: Required<MarkPlacement>, fade?: Fade, weight = 1): Lattice | null {
  const cols = Math.ceil(w / pitch);
  const rows = Math.ceil(h / pitch);
  const S = 3; // samples per lattice point, each way
  const off = document.createElement('canvas');
  off.width = cols * S;
  off.height = rows * S;
  const g = off.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  const px = place.size * Math.min(w, h);
  g.setTransform(S / pitch, 0, 0, S / pitch, 0, 0);
  g.translate(place.x * w, place.y * h);
  g.rotate(place.turn * Math.PI * 2);
  g.scale(px / 20, px / 20);
  g.translate(-10, -10);
  g.fill(new Path2D(MARK_PATH));
  const img = g.getImageData(0, 0, off.width, off.height).data;

  const cov = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let a = 0;
      for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) a += img[((j * S + v) * off.width + i * S + u) * 4 + 3];
      cov[j * cols + i] = a / (S * S * 255);
    }
  }

  // How far the grain travels from the mark.
  const halo = blur(cov, cols, rows, Math.max(2, Math.round((px * 0.12) / pitch)));

  // The fill is a gradient across the MARK, not across the cell: light at the mark's top left, heavy
  // at its bottom right, so it turns with the mark and every lobe carries its own share of it. The
  // silhouette itself stays crisp (glyph or no glyph), which is what keeps the shape legible as the
  // mark at a glyph's resolution; a soft edge made it read as a blurred square.
  const cos = Math.cos(-place.turn * Math.PI * 2);
  const sin = Math.sin(-place.turn * Math.PI * 2);
  // On a phone-width cell the words run the whole width, so whatever prints behind them prints lighter.
  const narrow = w < 640 ? 0.55 : 1;
  const base = new Float32Array(cols * rows);
  const seed = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const s = hash(i, j);
      seed[k] = s;
      const u = (i + 0.5) / cols;
      const v = (j + 0.5) / rows;
      const dx = (i + 0.5) * pitch - place.x * w;
      const dy = (j + 0.5) * pitch - place.y * h;
      const mx = ((dx * cos - dy * sin) / px) * 20 + 10;
      const my = ((dx * sin + dy * cos) / px) * 20 + 10;
      const fill = 0.5 + 0.5 * smooth(4, 18, (mx + my) / 2);
      // THE WHOLE PICTURE IS SCREENED, not a rectangle of it. The first pass printed the mark's
      // silhouette and left the rest bare, which read as a pixel-grid patch dropped on the
      // gradient — the user, 2026-09-26, of exactly that: "right now that halftone execution
      // looks basic and just put on the gradient". In the reference, the screen covers
      // everything and its WEIGHT follows the picture's light.
      //
      // So: an ambient screen on the field's own axis. `.site-field-*` lays its richest hue at
      // the bottom-left corner and blooms to the top-right, so the screen is densest at the
      // bottom-left and thins out to nothing at the top-right, and the two are one picture
      // rather than a drawing on top of one. It is dithered by the cell's own seed, which is
      // what leaves the gaps a printed screen has; an undithered ambient is a wallpaper.
      const amb = AMBIENT * smooth(0.02, 1.02, (1 - u) * 0.55 + v * 0.45) * (0.45 + 1.15 * s);
      // The mark reads through the blur as well as through its own coverage, so its edge is a
      // gradient of density rather than a cut line. That was right when the field around it was
      // bare — a soft edge then read as a blurred square — and wrong now that the whole picture
      // is screened: against an ambient ground a crisp silhouette reads as a RECTANGLE OF DOTS
      // dropped on the gradient, which is exactly what the user saw.
      let d = Math.max(smooth(0.06, 0.88, 0.45 * cov[k] + 0.55 * halo[k]) * fill, amb);
      // Just outside the mark the ink travelled a little further: the halo lifts the ambient.
      if (cov[k] < 0.05) d = Math.max(amb * (1 + 1.6 * halo[k]), s < 0.04 * halo[k] ? STEPS[1] : 0);
      const keep = fade === 'start' ? smooth(0.16, 0.6, u)
        : fade === 'end' ? smooth(0.16, 0.6, 1 - u)
          : fade === 'top' ? smooth(0.12, 0.6, v)
            : fade === 'bottom' ? smooth(0.12, 0.6, 1 - v)
              : 1;
      base[k] = d * keep * weight * narrow;
    }
  }
  return { cols, rows, base, seed };
}

// The screen is fine (user, 2026-09-26: "the dither's spacing is too wide, bring it closer, add a
// little detail"): 10px between glyphs on the page's own print, 8 on a picture's (visual.tsx).
export function Halftone({ mark, fade, weight = 1, pitch = 10, className }: {
  mark: MarkPlacement;
  fade?: Fade;
  /** How heavily it prints, 0 to 1: lighter where it lies behind the product rather than beside words. */
  weight?: number;
  pitch?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const { x, y, size, turn = 0 } = mark;

  React.useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let lattice: Lattice | null = null;
    let sheet: HTMLCanvasElement | null = null;
    let period = 8;
    let raf = 0;
    let last = -Infinity;
    let onScreen = false;
    // The clock starts when the print is first seen, so its shimmer begins in front of the reader.
    let t0 = performance.now();
    let firstSeen = false;
    // The pointer as the print feels it: where it is, where the light has got to, and how strongly.
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let pull = 0;
    let want = 0;
    let fresh = true;
    /** Rings struck by a double-click, newest last. Each is where, and when it started. */
    let rings: { x: number; y: number; at: number }[] = [];

    const inks = () => ['--site-glyph', '--site-glyph-strong', '--site-glyph-deep'].map((t) => colour(canvas, t));

    const draw = (t: number | null) => {
      ctx.clearRect(0, 0, w, h);
      if (!lattice || !sheet) return;
      const { cols, rows, base } = lattice;
      const c = pitch * dpr;
      const phase = t == null ? 0 : (t / period) * Math.PI * 2;
      if (t != null) {
        px += (tx - px) * FOLLOW;
        py += (ty - py) * FOLLOW;
        pull += (want - pull) * FADE;
        if (want === 0 && pull < 0.01) { pull = 0; fresh = true; }
        rings = rings.filter((r) => t - r.at < RIPPLE_LIFE);
      }
      const reach2 = (REACH * pitch) ** 2;
      // Each live ring, resolved once per frame rather than once per glyph: where its front has
      // got to, and how much of it is left.
      const live = t == null ? [] : rings.map((r) => ({
        x: r.x, y: r.y,
        at: (t - r.at) * RIPPLE_SPEED,
        amp: (1 - (t - r.at) / RIPPLE_LIFE) ** 2 * RIPPLE_LIFT,
      }));
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          const d0 = base[k];
          const cx = (i + 0.5) * pitch;
          const cy = (j + 0.5) * pitch;
          let lift = 0;
          if (pull > 0) {
            const dx = cx - px;
            const dy = cy - py;
            const q = (dx * dx + dy * dy) / reach2;
            if (q < 1) lift = (1 - q) * (1 - q) * pull;
          }
          // The ring: a band of lift at the travelling front, falling off either side of it.
          let wave = 0;
          for (const r of live) {
            const dr = Math.hypot(cx - r.x, cy - r.y) - r.at;
            if (dr < -RIPPLE_WIDTH || dr > RIPPLE_WIDTH) continue;
            const f = 1 - Math.abs(dr) / RIPPLE_WIDTH;
            wave = Math.max(wave, f * f * r.amp);
          }
          if (d0 <= 0 && lift <= 0 && wave <= 0) continue;
          let d = t != null && d0 > STEPS[1] ? d0 + SWELL * Math.sin((i + j * 0.6) / WAVE - phase) : d0;
          if (lift > 0) d = Math.max(d + LIFT * lift, lift * 0.42);
          if (wave > 0) d = Math.max(d + wave, wave * 0.5);
          const l = level(d);
          if (!l) continue;
          // TWO INKS, and which one is a statement about what made the glyph. The open rings take
          // the deep ink, which is what gives the screen its weave; the pointer draws in it too,
          // so pointing leaves a dark thumbprint. A ring from a double-click catches the LIGHT
          // ink instead: you point and the print darkens, you strike and it flashes.
          const ink = wave > 0.22 ? 1 : lift > 0.28 || l === 2 || l === 4 ? 2 : l >= 6 ? 1 : 0;
          ctx.drawImage(sheet, (l - 1) * c, ink * c, c, c, i * pitch, j * pitch, pitch, pitch);
        }
      }
    };

    const layout = () => {
      const r = host.getBoundingClientRect();
      w = r.width;
      h = r.height;
      if (!w || !h) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lattice = latticeFor(w, h, pitch, { x, y, size, turn }, fade, weight);
      sheet = sheetFor(pitch, dpr, inks());
      period = seconds(getComputedStyle(canvas).getPropertyValue('--site-shimmer')) || period;
    };

    const moving = () => onScreen && !document.hidden && !still.matches;
    const tick = (now: number) => {
      raf = 0;
      if (!moving()) return;
      if (now - last >= 1000 / FPS) {
        last = now;
        draw((now - t0) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (moving()) {
        if (!raf) raf = requestAnimationFrame(tick);
        return;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (still.matches) draw(null);
    };

    layout();
    draw(null);

    // The pointer is read from the cell the print lies in (the canvas itself takes no pointer).
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      want = 1;
      if (fresh) { px = tx; py = ty; fresh = false; }
    };
    const onLeave = () => { want = 0; };
    /** A strike on the plate. Ignored when less motion is asked for: a ripple is motion and
        nothing else, so there is nothing to show still. */
    const onStrike = (e: MouseEvent) => {
      if (still.matches) return;
      const r = canvas.getBoundingClientRect();
      rings.push({ x: e.clientX - r.left, y: e.clientY - r.top, at: (performance.now() - t0) / 1000 });
      if (rings.length > MAX_RIPPLES) rings.shift();
      sync();
    };
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('dblclick', onStrike);

    const resized = new ResizeObserver(() => {
      layout();
      draw(moving() ? (performance.now() - t0) / 1000 : null);
    });
    resized.observe(host);
    const seen = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen && !firstSeen) { firstSeen = true; t0 = performance.now(); }
      sync();
    });
    seen.observe(canvas);
    // No theme to follow: the website has one appearance (lib/theme.ts `SITE_APPEARANCE`), so the
    // inks read once per layout are the inks for good.
    document.addEventListener('visibilitychange', sync);
    still.addEventListener('change', sync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resized.disconnect();
      seen.disconnect();
      document.removeEventListener('visibilitychange', sync);
      still.removeEventListener('change', sync);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('dblclick', onStrike);
    };
  }, [x, y, size, turn, fade, weight, pitch]);

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}
