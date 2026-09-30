'use client';
// Zen Ink — the illustration kit. Hand-inked outlines over grainy watercolor
// fills, slightly off-register, resting on a soft periwinkle ground shadow.
//
// An illustration is data: an ordered list of Parts. Each Part is drawn as its
// pigment (offset a hair, washed with paper grain) and then its ink line on top,
// so later parts naturally occlude earlier ones. Colors are the --ill-* tokens
// (app/tokens.css); nothing here hardcodes a hue.
import { useId, type CSSProperties } from 'react';

export type Tone =
  | 'ink' | 'paper' | 'cream' | 'teal' | 'tealDeep' | 'lilac' | 'violet'
  | 'marigold' | 'orange' | 'tomato' | 'brick' | 'periwinkle' | 'shadow';

const TONE_VAR: Record<Tone, string> = {
  ink: 'var(--ill-ink)', paper: 'var(--ill-paper)', cream: 'var(--ill-cream)',
  teal: 'var(--ill-teal)', tealDeep: 'var(--ill-teal-deep)', lilac: 'var(--ill-lilac)',
  violet: 'var(--ill-violet)', marigold: 'var(--ill-marigold)', orange: 'var(--ill-orange)',
  tomato: 'var(--ill-tomato)', brick: 'var(--ill-brick)', periwinkle: 'var(--ill-periwinkle)',
  shadow: 'var(--ill-shadow)',
};

export type Part = {
  d: string;
  /** Pigment. Omit for a line-only stroke (details, hatching). */
  fill?: Tone;
  /** Ink line: true (default) = ink, a Tone = colored line, false = pigment only. */
  line?: boolean | Tone;
  /** Line weight multiplier (1 = the house weight). */
  w?: number;
  /** SVG transform applied to this part (set by `place`). */
  t?: string;
  evenOdd?: boolean;
  /** Ground shadow: flat wash, no misregistration, no line. */
  ground?: boolean;
};

export type Art = { w: number; h: number; parts: Part[] };

const LINE = 1.85; // house line weight, in viewBox units at 1×

// ── Shape helpers → path data ────────────────────────────────────────────────
export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}
export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
export function poly(...pts: number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`;
  return d + 'Z';
}
export function polyline(...pts: number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`;
  return d;
}
/** Four-point sparkle. */
export function sparkle(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
}
export function gear(cx: number, cy: number, ro: number, ri: number, teeth: number): string {
  const pts: number[] = [];
  const at = (r: number, a: number) => pts.push(+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2));
  const w = Math.PI / teeth / 2;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    at(ri, a - w * 1.25); at(ro, a - w * 0.65); at(ro, a + w * 0.65); at(ri, a + w * 1.25);
  }
  return poly(...pts);
}
/** The ground shadow every object rests on. */
export const ground = (cx: number, cy: number, rx: number, ry = rx * 0.16): Part =>
  ({ d: ellipse(cx, cy, rx, ry), fill: 'shadow', ground: true, line: false });

/** Place an illustration's parts inside another (scenes). Keeps line weight
 *  visually constant under scale. */
export function place(art: Art, x: number, y: number, s = 1, opts: { ground?: boolean } = {}): Part[] {
  return art.parts
    .filter((p) => opts.ground !== false || !p.ground)
    .map((p) => ({ ...p, t: `translate(${x} ${y}) scale(${s})${p.t ? ` ${p.t}` : ''}`, w: (p.w ?? 1) / s }));
}

// ── Renderer ────────────────────────────────────────────────────────────────
export type InkProps = {
  art: Art;
  /** Rendered width in px (height follows the art's aspect). */
  size?: number;
  /** Accessible name. Omit for decorative use (aria-hidden). */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

export function Ink({ art, size, title, className, style }: InkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const wash = `ink-wash-${uid}`;
  const hand = `ink-hand-${uid}`;
  const width = size ?? art.w;
  return (
    <svg
      viewBox={`0 0 ${art.w} ${art.h}`}
      width={width}
      height={(width * art.h) / art.w}
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {/* Watercolor: low-frequency pigment pooling × fine paper tooth. */}
        <filter id={wash} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="pool" />
          <feColorMatrix in="pool" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.75 0 0 0 0.55" result="poolA" />
          <feComposite in="SourceGraphic" in2="poolA" operator="in" result="washed" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" result="tooth" />
          <feColorMatrix in="tooth" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0 0 0 0.62" result="toothA" />
          <feComposite in="washed" in2="toothA" operator="in" />
        </filter>
        {/* Hand: a gentle wobble so no line is ruler-straight. */}
        <filter id={hand} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="11" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${hand})`}>
        {art.parts.map((p, i) => {
          const lineTone = p.line === false ? null : p.line === true || p.line === undefined ? 'ink' : p.line;
          return (
            <g key={i} transform={p.t}>
              {p.fill && (
                <path
                  d={p.d}
                  fill={TONE_VAR[p.fill]}
                  fillRule={p.evenOdd ? 'evenodd' : undefined}
                  filter={`url(#${wash})`}
                  transform={p.ground ? undefined : 'translate(-1.8 1.6)'}
                  opacity={p.ground ? 0.8 : undefined}
                />
              )}
              {lineTone && !p.ground && (
                <path
                  d={p.d}
                  fill="none"
                  fillRule={p.evenOdd ? 'evenodd' : undefined}
                  stroke={TONE_VAR[lineTone]}
                  strokeWidth={LINE * (p.w ?? 1)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
