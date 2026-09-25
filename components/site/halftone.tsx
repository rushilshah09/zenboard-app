'use client';
// ── THE HALFTONE ────────────────────────────────────────────────────────────
//
// The website's gradient, printed rather than airbrushed. A soft colour cloud is how every SaaS page
// says "calm"; Zenboard's pages say it in their own marks. A cell is screened the way a print is: a
// lattice of small glyphs whose weight follows the shape underneath. The glyphs are Zenboard's, in
// order of weight:
//
//   ·  a dot   ·  a heavier dot   ·  the page's joint (the star four cells leave where they meet)
//   ·  the star at the heart of the mark   ·  the mark itself
//
// and the shape underneath is always the mark, placed and cropped by its cell: the hero holds the whole
// of it behind the headline, and each product area shows one lobe (a different one each time, so the
// four areas between them hold the whole mark). A gradient here is the mark, drawn in marks.
//
// It moves the way print does not, only a little: a slow wave crosses the screen and steps the glyphs
// it passes one weight up or down, and now and then a glyph catches the brand's colour. It runs only
// while the cell is on screen and the tab is visible, and never when less motion is asked for; then it
// is printed once and left alone. It is decoration, so it is hidden from assistive technology and
// takes no pointer.

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

/** The ramp's thresholds, lightest to heaviest: where a density crosses one, the glyph changes. */
const STEPS = [0.12, 0.28, 0.5, 0.72, 0.9];
/** How far the passing wave moves a glyph's density: never more than about one step. */
const SWELL = 0.12;
/** The wave's length, in glyphs. */
const WAVE = 9;
/** The share of glyphs that can ever catch the brand's colour, and for what share of a period. */
const SPARKS = 0.03;
const SPARK_SPAN = 0.08;
/** Frames drawn per second while it moves. The wave is slow: more frames would only cost battery. */
const FPS = 24;

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

function glyph(g: CanvasRenderingContext2D, l: number, pitch: number, mark: Path2D, heart: Path2D) {
  const u = pitch / 14; // drawn for a 14px pitch, and scaled with it
  if (l === 1 || l === 2) {
    g.beginPath();
    g.arc(0, 0, (l === 1 ? 0.7 : 1.05) * u, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const size = (l === 3 ? 7 : l === 4 ? 9 : 7.5) * u;
  g.rotate(l === 3 ? Math.PI / 4 : 0);
  g.scale(size / 20, size / 20);
  g.translate(-10, -10);
  g.fill(l === 5 ? mark : heart);
}

/** Every glyph in every ink, drawn once: a frame is then only copies. Rows: soft, strong, accent. */
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
      let d = smooth(0.35, 0.65, cov[k]) * fill;
      // Outside the mark: a loose grain, closer together near it, like ink that travelled.
      if (cov[k] < 0.05) d = s < 0.003 + 0.04 * halo[k] ? STEPS[0] + 0.02 : 0;
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

export function Halftone({ mark, fade, weight = 1, pitch = 14, className }: {
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
    const t0 = performance.now();

    const inks = () => ['--site-glyph', '--site-glyph-strong', '--site-glyph-accent'].map((t) => colour(canvas, t));

    const draw = (t: number | null) => {
      ctx.clearRect(0, 0, w, h);
      if (!lattice || !sheet) return;
      const { cols, rows, base, seed } = lattice;
      const c = pitch * dpr;
      const phase = t == null ? 0 : (t / period) * Math.PI * 2;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          const d0 = base[k];
          if (d0 <= 0) continue;
          const d = t != null && d0 > STEPS[1] ? d0 + SWELL * Math.sin((i + j * 0.6) / WAVE - phase) : d0;
          const l = level(d);
          if (!l) continue;
          const spark = t != null && l >= 3 && seed[k] < SPARKS && (t / period + seed[k] * 97) % 1 < SPARK_SPAN;
          const ink = spark ? 2 : l >= 4 ? 1 : 0;
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

    const resized = new ResizeObserver(() => {
      layout();
      draw(moving() ? (performance.now() - t0) / 1000 : null);
    });
    resized.observe(host);
    const seen = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    seen.observe(canvas);
    // A theme or skin change repaints the inks.
    const themed = new MutationObserver(() => {
      sheet = sheetFor(pitch, dpr, inks());
      draw(moving() ? (performance.now() - t0) / 1000 : null);
    });
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
    document.addEventListener('visibilitychange', sync);
    still.addEventListener('change', sync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resized.disconnect();
      seen.disconnect();
      themed.disconnect();
      document.removeEventListener('visibilitychange', sync);
      still.removeEventListener('change', sync);
    };
  }, [x, y, size, turn, fade, weight, pitch]);

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}
