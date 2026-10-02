// Zenboard character — built one person at a time, front view first.
//
// Construction (from the reference guide): basic geometric shapes under every
// part. The torso is a soft rectangle, limbs are tapered capsules, the head
// is a rounded shape with a slight jaw and an ear on each side. Flat color,
// no outlines; the only shading is the neck, one tone darker than the face.
// The avatar reuses the same head, so the two always match.
import { type Art, type Part, type Tone, rect, circle } from './kit';

const fill = (d: string, tone: Tone, extra: Partial<Part> = {}): Part => ({ d, fill: tone, line: false, ...extra });
const field = (w: number, h: number, tone: Tone, r = 0): Part => ({ d: rect(0, 0, w, h, r), fill: tone, line: false, backdrop: true });
type Pt = [number, number];

/** A tapered capsule from p0 (radius r0) to p1 (radius r1). */
const capsule = ([x0, y0]: Pt, [x1, y1]: Pt, r0: number, r1: number): string => {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / L;
  const ny = (x1 - x0) / L;
  const n = (v: number) => +v.toFixed(2);
  return `M${n(x0 + nx * r0)} ${n(y0 + ny * r0)}L${n(x1 + nx * r1)} ${n(y1 + ny * r1)}`
    + `A${r1} ${r1} 0 0 0 ${n(x1 - nx * r1)} ${n(y1 - ny * r1)}L${n(x0 - nx * r0)} ${n(y0 - ny * r0)}`
    + `A${r0} ${r0} 0 0 0 ${n(x0 + nx * r0)} ${n(y0 + ny * r0)}Z`;
};

// ── Maya — runs a design studio of one. Berry: she is "you". ──────────────
// Frame 200×500, centered on x 100, standing on y 490.
const SKIN: Tone = 'sSkin3';
const SKIN_DK: Tone = 'sSkin3Dk';
const TOP: Tone = 'sBerry';
const TOP_DK: Tone = 'sBerryDk';
const PANTS: Tone = 'sInk';
const SHOE: Tone = 'sPaper';

const FACE = 'M77 68C77 51 87 41 100 41C113 41 123 51 123 68V79C123 93 113 103 100 103C87 103 77 93 77 79Z';
const TORSO = 'M42 150C42 132 57 123 76 121L88 120Q100 134 112 120L124 121C143 123 158 132 158 150L153 244H47Z';

/** Neck: one tone darker, sits behind the neckline. */
const mayaNeck: Part = fill('M90 92H110V130H90Z', SKIN_DK);
/** Head, shared by the full figure and the avatar. */
const mayaHead: Part[] = [
  // bun, then the hair mass framing the face to the ears
  fill(circle(100, 27, 13), 'sHair'),
  fill('M73 80C70 50 83 33 100 33C117 33 130 50 127 80H123C123 64 117 56 110 53H90C83 56 77 64 77 80Z', 'sHair'),
  // ears, face, and the fringe sweep
  fill(circle(77, 77, 6.5), SKIN), fill(circle(123, 77, 6.5), SKIN),
  fill(FACE, SKIN),
  fill('M75.5 72C75.5 47 87 37 100 37C113 37 124.5 46 124.5 66C113 56 99 54 87 60C82 63 78 67 75.5 72Z', 'sHair'),
  // gold hoops
  fill(circle(77, 86, 2.6), 'sGold'), fill(circle(123, 86, 2.6), 'sGold'),
];

/** Sleeve over the torso: a darker rim, clipped to the torso, keeps the arm readable. */
const sleeve = (s: Pt, e: Pt, w: Pt): Part[] => [
  fill(capsule(s, e, 13.5, 12) + capsule(e, w, 12, 10.5), TOP_DK, { clip: TORSO }),
  fill(capsule(s, e, 12, 10.5), TOP),
  fill(capsule(e, w, 10.5, 9), TOP),
];
/** Mitten hand hanging from the wrist, thumb turned toward the body. */
const handDown = ([x, y]: Pt, inward: 1 | -1): Part[] => [
  fill(capsule([x + inward * 4, y + 2], [x + inward * 9, y + 12], 3.4, 3), SKIN),
  fill(capsule([x, y], [x, y + 16], 8, 7), SKIN),
];

const mayaBody: Part[] = [
  // shoes, ankles, trousers (one tapered shape, a strip of ankle showing)
  fill('M44 490C44 474 54 463 68 463H84C91 463 95 469 95 477V490Z', SHOE),
  fill('M105 490V477C105 469 109 463 116 463H132C146 463 156 474 156 490Z', SHOE),
  fill(rect(62, 446, 22, 20, 4), SKIN_DK), fill(rect(116, 446, 22, 20, 4), SKIN_DK),
  fill('M47 236H153L150 452H108L100 284L92 452H50Z', PANTS),
  // neck, torso
  mayaNeck,
  fill(TORSO, TOP),
  ...mayaHead,
  // arms
  ...handDown([31, 260], 1), ...sleeve([52, 146], [36, 204], [31, 258]),
  ...handDown([169, 260], -1), ...sleeve([148, 146], [164, 204], [169, 258]),
];

export const MAYA: Art = { w: 200, h: 500, look: 'shape', parts: mayaBody };

/** Avatar: the same head, scaled into a 1:1 tile with the shoulders as one dome. */
export const MAYA_AVATAR: Art = {
  w: 200, h: 200, look: 'shape',
  parts: [
    field(200, 200, 'sLav'),
    ...[mayaNeck, fill('M22 220C22 156 50 124 84 121L90 120Q100 132 110 120L116 121C150 124 178 156 178 220Z', TOP), ...mayaHead]
      .map((p) => ({ ...p, t: 'translate(100 150) scale(1.25) translate(-100 -134)' })),
  ],
};
