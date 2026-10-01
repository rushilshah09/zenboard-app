// Zen Shape people — the Zenboard cast.
//
// Authored, not rigged. Each figure is drawn the way an editorial
// illustrator builds a "people lineup": a few hand-shaped silhouettes per
// person, in flat Zenboard color.
//  1. Proportion: ~7.5 heads tall. A three-quarter head with a real jaw, a
//     short shaded neck, broad boxy shoulders, trousers as one tapered shape
//     that stops above a strip of ankle, chunky flat shoes turned out.
//  2. No outlines, no gradients. Depth comes from one darker tone where a
//     form turns away (the neck under the jaw, the far ear, the back arm).
//  3. No faces. Identity comes from silhouette and one or two details:
//     a bun, a bob, an afro, glasses, an earring, a collar, stripes, a watch.
//  4. Hands are mittens with a thumb. Poses carry the story: arms crossed,
//     a phone held at the chest, a tablet, a palm presenting the work.
//  5. Color is semantic: berry is you, indigo is the client; the supporting
//     cast wear amber and green.
//
// Every figure is authored once in a 140×390 frame facing right, standing on
// y 386, and placed with `figure(name, pose, x, ground, facing, scale)`.
import { type Art, type Part, type Tone, rect, circle, ellipse } from './kit';
import { fill, block, ball, card, bar, zmark, star, GOLD, coin, done, receipt, rotate, chain } from './shape';

type Pt = [number, number];
type Facing = 1 | -1;
export type Skin = 1 | 2 | 3 | 4;
export type Hair = 'bun' | 'short' | 'bob' | 'afro';
export type Outfit = {
  skin: Skin;
  hair: Hair;
  top: Tone;
  topDk: Tone;
  sleeve: 'long' | 'short';
  /** Optional garment detail. */
  detail?: { kind: 'stripes'; tone: Tone } | { kind: 'cardigan'; tone: Tone } | { kind: 'buttons'; tone: Tone };
  collar?: Tone;
  bottom: Tone;
  shoe: Tone;
  glasses?: boolean;
  earring?: boolean;
  watch?: boolean;
};
export type PoseName = 'relaxed' | 'crossed' | 'holding' | 'present' | 'tablet';

const LINE = 2.4; // Zen Shape house line weight
const skinOf = (s: Skin): [Tone, Tone] => [`sSkin${s}` as Tone, `sSkin${s}Dk` as Tone];
const lerp = ([ax, ay]: Pt, [bx, by]: Pt, t: number): Pt => [ax + (bx - ax) * t, ay + (by - ay) * t];

/** A tapered capsule from p0 (radius r0) to p1 (radius r1): limbs, hands. */
const capsule = ([x0, y0]: Pt, [x1, y1]: Pt, r0: number, r1: number): string => {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / L;
  const ny = (x1 - x0) / L;
  const f = (n: number) => +n.toFixed(2);
  return `M${f(x0 + nx * r0)} ${f(y0 + ny * r0)}L${f(x1 + nx * r1)} ${f(y1 + ny * r1)}`
    + `A${r1} ${r1} 0 0 0 ${f(x1 - nx * r1)} ${f(y1 - ny * r1)}L${f(x0 - nx * r0)} ${f(y0 - ny * r0)}`
    + `A${r0} ${r0} 0 0 0 ${f(x0 + nx * r0)} ${f(y0 + ny * r0)}Z`;
};

// ── The body, in the 140×390 frame ──────────────────────────────────────────
const TORSO = 'M24 113C24 100 34 92 48 91L60 90H80L92 91C106 92 116 100 116 113L111 210H29Z';
const HEAD = 'M53 52C53 36 63 28 74 28C86 28 95 36 95 50V60C95 71 88 79 78 80C70 81 61 78 57 72C54 67 53 60 53 52Z';
const PANTS = 'M31 204H109L106 364H77L71 240L65 364H34Z';
const SHOULDER_L: Pt = [37, 109];
const SHOULDER_R: Pt = [103, 109];

const HAIR: Record<Hair, string[]> = {
  short: ['M51 58C47 37 58 22 76 22C91 22 99 32 97 46L93 44C90 38 84 36 78 38C70 40 63 41 59 45L57 61Z'],
  bun: [circle(66, 19, 10), 'M51 58C48 37 59 24 76 24C91 24 98 33 97 47L94 46C91 39 85 36 78 38C70 40 63 42 59 46L57 62Z'],
  bob: ['M47 76C41 44 53 24 75 24C93 24 104 38 101 60L103 76H92L93 50C86 43 74 41 62 47L61 76Z'],
  afro: [circle(73, 44, 31)],
};

/** Arms per pose: [shoulder, elbow, wrist] for the back (L) and front (R) arm. */
const POSES: Record<PoseName, { L: [Pt, Pt]; R: [Pt, Pt]; frontL?: boolean }> = {
  relaxed: { L: [[31, 160], [33, 206]], R: [[109, 160], [107, 206]] },
  crossed: { L: [[27, 162], [95, 170]], R: [[113, 160], [47, 155]], frontL: true },
  holding: { L: [[29, 168], [62, 152]], R: [[111, 168], [80, 150]], frontL: true },
  present: { L: [[31, 160], [39, 202]], R: [[126, 154], [152, 128]] },
  tablet: { L: [[31, 168], [80, 160]], R: [[109, 168], [88, 148]], frontL: true },
};

const hand = (elbow: Pt, wrist: Pt, tone: Tone, watch?: boolean): Part[] => {
  const L = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]) || 1;
  const u: Pt = [(wrist[0] - elbow[0]) / L, (wrist[1] - elbow[1]) / L];
  const tip: Pt = [wrist[0] + u[0] * 11, wrist[1] + u[1] * 11];
  const thumbBase: Pt = [wrist[0] + u[0] * 2, wrist[1] + u[1] * 2];
  const thumbTip: Pt = [thumbBase[0] - u[1] * 7 + u[0] * 3, thumbBase[1] + u[0] * 7 + u[1] * 3];
  return [
    fill(capsule(thumbBase, thumbTip, 2.6, 2.4), tone),
    fill(capsule(wrist, tip, 6, 5.6), tone),
    ...(watch ? [fill(capsule(lerp(elbow, wrist, 0.84), lerp(elbow, wrist, 0.9), 6.3, 6.1), 'sInk')] : []),
  ];
};

const arm = (o: Outfit, shoulder: Pt, [elbow, wrist]: [Pt, Pt], back: boolean): Part[] => {
  const [skin, skinDk] = skinOf(o.skin);
  const sk = back ? skinDk : skin;
  const top = back ? o.topDk : o.top;
  const parts: Part[] = o.sleeve === 'long'
    ? [fill(capsule(shoulder, elbow, 10, 8), top), fill(capsule(elbow, wrist, 8, 6.6), top)]
    : [fill(capsule(shoulder, elbow, 8.5, 7.2), sk), fill(capsule(elbow, wrist, 7.2, 5.8), sk), fill(capsule(shoulder, lerp(shoulder, elbow, 0.55), 12, 10.5), top)];
  return [...parts, ...hand(elbow, wrist, sk, o.watch && !back)];
};

/** Author-space figure (facing right, frame 140×390). */
function bodyParts(o: Outfit, pose: PoseName, prop: Part[]): Part[] {
  const [skin, skinDk] = skinOf(o.skin);
  const p = POSES[pose];
  const d = o.detail;
  const backArm = arm(o, SHOULDER_L, p.L, true);
  return [
    ...(o.hair === 'afro' || o.hair === 'bob' ? HAIR[o.hair].map((h) => fill(h, 'sHair')) : []),
    ...(p.frontL ? [] : backArm),
    // legs
    fill(rect(44, 360, 16, 12, 3), skinDk), fill(rect(82, 360, 16, 12, 3), skin),
    fill('M26 386V381C26 373 33 368 42 368H62V386Z', o.shoe),
    fill('M78 386V368H98C107 368 114 373 114 381V386Z', o.shoe),
    fill(PANTS, o.bottom),
    { d: 'M90 252L91 344', line: 'sPaper', w: 1.2 / LINE, opacity: 0.35 },
    // neck + torso
    fill(rect(62, 66, 18, 30, 7), skinDk),
    fill(TORSO, o.top),
    ...(d?.kind === 'stripes' ? [118, 140, 162, 184].map((y): Part => fill(rect(20, y, 100, 10), d.tone, { clip: TORSO })) : []),
    ...(d?.kind === 'cardigan' ? [fill('M58 91H82L84 210H56Z', d.tone)] : []),
    ...(d?.kind === 'buttons' ? [118, 140, 162, 184].map((y): Part => fill(circle(71, y, 1.8), d.tone)) : []),
    fill(ellipse(71, 91, 10, 7), skinDk, { clip: TORSO }),
    ...(o.collar ? [fill('M58 88L71 97L64 106Z', o.collar), fill('M84 88L71 97L78 106Z', o.collar)] : []),
    // head
    fill(ellipse(55, 58, 4.5, 6.5), skinDk),
    fill(HEAD, skin),
    ...(o.hair === 'afro' ? [fill('M53 50C53 34 63 27 74 27C86 27 95 34 96 47C88 40 70 40 53 50Z', 'sHair')] : []),
    ...(o.hair === 'short' || o.hair === 'bun' ? HAIR[o.hair].map((h) => fill(h, 'sHair')) : []),
    ...(o.hair === 'bob' ? [fill('M53 50C53 34 63 28 75 28C87 28 95 35 96 46C86 40 68 39 53 50Z', 'sHair')] : []),
    ...(o.glasses ? [{ d: circle(74, 54, 5) + circle(88, 54, 5), line: 'sInk' as Tone, w: 1.5 / LINE }, { d: 'M79 53H83M69 53L56 51', line: 'sInk' as Tone, w: 1.5 / LINE }] : []),
    ...(o.earring ? [fill(circle(55, 67, 2.2), GOLD)] : []),
    // arms + what the hands hold
    ...(p.frontL ? backArm : []),
    ...prop,
    ...arm(o, SHOULDER_R, p.R, false),
  ];
}

/** Place an authored figure: feet centered on x, resting on ground g. */
export function figure(o: Outfit, pose: PoseName, x: number, g: number, f: Facing = 1, s = 1, prop: Part[] = []): Part[] {
  const t = `translate(${x} ${g}) scale(${f * s} ${s}) translate(-70 -386)`;
  return bodyParts(o, pose, prop).map((p) => ({ ...p, t: p.t ? `${t} ${p.t}` : t }));
}

// ── The cast ────────────────────────────────────────────────────────────────
export const CAST = {
  /** Maya — runs a design studio of one. Berry: she is "you". */
  maya: { skin: 3, hair: 'bun', top: 'sBerry', topDk: 'sBerryDk', sleeve: 'long', bottom: 'sInk', shoe: 'sPaper', earring: true },
  /** Theo — freelance developer. Striped polo, glasses. */
  theo: { skin: 1, hair: 'short', top: 'sGreen', topDk: 'sGreenDk', sleeve: 'short', detail: { kind: 'stripes', tone: 'sInk' }, collar: 'sPaper', bottom: 'sBlue', shoe: 'sInk', glasses: true },
  /** Ines — independent consultant. Open cardigan over a dark top. */
  ines: { skin: 2, hair: 'bob', top: 'sAmber', topDk: 'sAmberDk', sleeve: 'long', detail: { kind: 'cardigan', tone: 'sInk' }, bottom: 'sTeal', shoe: 'sCoral', earring: true },
  /** Sam — the client. Indigo, always. */
  sam: { skin: 4, hair: 'afro', top: 'sIndigo', topDk: 'sIndigoDk', sleeve: 'short', detail: { kind: 'buttons', tone: 'sPaper' }, bottom: 'sInk', shoe: 'sPaper', watch: true },
} satisfies Record<string, Outfit>;
export type CastName = keyof typeof CAST;

// ── Props (same construction as the scene objects) ─────────────────────────
const S2 = (w: number, h: number, parts: Part[]): Art => ({ w, h, parts, look: 'shape' });
/** Lift the art so the bottom band stays clear for the wordmark. */
const lift = (parts: Part[], dy = -38): Part[] => parts.map((p) => (p.backdrop ? p : { ...p, t: `translate(0 ${dy})${p.t ? ` ${p.t}` : ''}` }));
const groundShadow = (cx: number, cy: number, rx: number, tone: Tone = 'sIndigoDk', opacity = 0.2): Part =>
  fill(ellipse(cx, cy, rx, Math.max(4, rx * 0.08)), tone, { opacity });
const field = (w: number, h: number, tone: Tone): Part => ({ d: rect(0, 0, w, h), fill: tone, line: false, backdrop: true });
const plant = (x: number, y: number, s = 1): Part[] => [
  ...rotate([fill(ellipse(x - 9 * s, y - 24 * s, 7 * s, 17 * s), 'sGreenDk')], -28, x - 9 * s, y - 14 * s),
  ...rotate([fill(ellipse(x + 10 * s, y - 26 * s, 7 * s, 18 * s), 'sGreen')], 26, x + 10 * s, y - 14 * s),
  fill(ellipse(x, y - 34 * s, 7 * s, 20 * s), 'sGreen'),
  ...block(x - 15 * s, y - 10 * s, 30 * s, 26 * s, 6 * s, 'sAmber', 'sAmberDk'),
];
/** A focus timer: indigo body, paper face, berry hand. */
const timer = (cx: number, cy: number, r: number): Part[] => [
  fill(rect(cx - r * 0.2, cy - r * 1.24, r * 0.4, r * 0.3, r * 0.1), 'sIndigoDk'),
  ...ball(cx, cy, r, 'sIndigo', 'sIndigoDk'),
  fill(circle(cx, cy, r * 0.72), 'sPaper'),
  fill(`M${cx} ${cy}L${cx} ${cy - r * 0.72}A${r * 0.72} ${r * 0.72} 0 0 1 ${cx + r * 0.72 * Math.sin(1.9)} ${cy - r * 0.72 * Math.cos(1.9)}Z`, 'sBerryLt'),
  { d: `M${cx} ${cy}L${cx + r * 0.72 * 0.86 * Math.sin(1.9)} ${cy - r * 0.72 * 0.86 * Math.cos(1.9)}`, line: 'sBerry', w: r / 18 },
  fill(circle(cx, cy, r * 0.07), 'sInk'),
];
/** The shared project card: the hero object, carrying the mark once. */
const projectCard = (x: number, y: number, w: number, h: number): Part[] => [
  card(x, y, w, h, 14),
  fill(rect(x + 12, y + 12, 26, 26, 8), 'sBerry'), zmark(x + 15, y + 15, 20),
  bar(x + 46, y + 16, w - 70, 'sLavLt', 8), bar(x + 46, y + 30, w - 96, 'sLavLt', 6),
  card(x + 12, y + 50, w - 24, 22, 11, 'sBerryLt'), ...done(x + 24, y + 61, 7), bar(x + 36, y + 58, w - 70, 'sPaper', 6),
];

// Author-space props (drawn in the figure's own 140×390 frame).
const PHONE: Part[] = [fill(rect(60, 116, 22, 38, 5), 'sInk'), fill(rect(63, 120, 16, 30, 3), 'sPaper'), fill(rect(66, 128, 10, 5, 2.5), 'sBerry')];
const TABLET: Part[] = rotate([fill(rect(56, 112, 60, 44, 6), 'sInk'), fill(rect(60, 116, 52, 36, 3), 'sPaper'), fill(rect(66, 123, 22, 6, 3), 'sBerry'), fill(rect(66, 135, 36, 5, 2.5), 'sLavLt'), fill(rect(66, 144, 24, 5, 2.5), 'sLavLt')], -12, 86, 134);
const FOLDER: Part[] = rotate([fill(rect(52, 118, 40, 50, 5), 'sGreenDk'), fill(rect(56, 114, 40, 50, 5), 'sGreen')], -10, 74, 140);
const COIN: Part[] = coin(71, 136, 42);

// ── Character sheet: the cast, standing on one ground line ─────────────────
export const PEOPLE = {
  maya: S2(180, 400, [groundShadow(80, 394, 52), ...figure(CAST.maya, 'present', 72, 394, 1, 1)]),
  theo: S2(180, 400, [groundShadow(90, 394, 52), ...figure(CAST.theo, 'holding', 90, 394, 1, 1, PHONE)]),
  ines: S2(180, 400, [groundShadow(90, 394, 52), ...figure(CAST.ines, 'holding', 90, 394, -1, 1, FOLDER)]),
  sam: S2(180, 400, [groundShadow(90, 394, 52), ...figure(CAST.sam, 'crossed', 90, 394, -1, 1)]),
} satisfies Record<CastName, Art>;

// ── Social posts (432×540 = 1080×1350 at 2.5×). The art fills the frame; the
// headline sits in the top third, set in HTML over the field. ──────────────
const W = 432;
const H = 540;
const FS = 0.68; // figure scale in posts

/** 1 · Launch — one calm place, presented. */
const launch = S2(W, H, lift([
  field(W, H, 'sLav'),
  fill(circle(240, 404, 150), 'sLavDk', { opacity: 0.35 }),
  groundShadow(232, 506, 170),
  ...block(196, 300, 180, 206, 36, 'sBerry', 'sBerryDk'),
  zmark(242, 346, 88),
  bar(226, 458, 100, 'sBerryLt', 12), bar(226, 478, 60, 'sBerryLt', 9),
  ...figure(CAST.ines, 'present', 112, 506, 1, FS),
  star(70, 270, 12, GOLD), star(394, 290, 8, 'sPaper'), star(170, 250, 6, 'sPaper'),
]));

/** 2 · Client portal — you present the work; your client reads it on their phone. */
const portal = S2(W, H, lift([
  field(W, H, 'sBerryLt'),
  fill(circle(216, 392, 150), 'sPink', { opacity: 0.18 }),
  groundShadow(216, 508, 170, 'sBerryDk', 0.16),
  ...rotate(projectCard(150, 236, 128, 96), -5, 214, 284),
  ...chain(282, 210, 1.1),
  ...figure(CAST.maya, 'present', 98, 506, 1, FS),
  ...figure(CAST.sam, 'holding', 334, 506, -1, FS, PHONE),
  star(56, 300, 10, GOLD), star(392, 262, 7, 'sPaper'),
]));

/** 3 · Focus — deep work, on purpose. Dark field: the app's own night. */
const focus = S2(W, H, lift([
  field(W, H, 'sInk'),
  fill(circle(286, 320, 120), 'sIndigo', { opacity: 0.22 }),
  ...timer(296, 300, 66),
  groundShadow(216, 508, 170, 'sIndigo', 0.3),
  ...plant(372, 506, 1.5),
  ...figure(CAST.theo, 'tablet', 140, 506, 1, FS, TABLET),
  star(66, 280, 10, GOLD), star(104, 236, 5, 'sLav'), star(396, 210, 6, 'sLav'),
]));

/** 4 · Get paid — tracked time becomes paid time. */
const paid = S2(W, H, lift([
  field(W, H, 'sAmber'),
  fill(circle(216, 392, 150), 'sAmberLt', { opacity: 0.3 }),
  groundShadow(216, 508, 160, 'sAmberDk', 0.35),
  ...rotate([receipt(236, 272, 112, 150), bar(254, 298, 52, 'sLavLt', 9), bar(254, 316, 76, 'sLavLt', 7), card(254, 350, 76, 18, 9, 'sBerryLt'), bar(262, 356, 36, 'sBerry', 6)], 8, 292, 346),
  ...done(336, 392, 24),
  ...figure(CAST.maya, 'holding', 146, 506, 1, FS, COIN),
  star(66, 250, 11, 'sPaper'), star(384, 262, 8, GOLD),
]));

/** 5 · Inbox — capture now, plan later. */
const inbox = S2(W, H, lift([
  field(W, H, 'sIndigo'),
  fill(circle(216, 396, 150), 'sIndigoDk', { opacity: 0.5 }),
  groundShadow(216, 508, 170, 'sInk', 0.25),
  fill(rect(64, 400, 168, 22, 11), 'sBerryDk'),
  ...rotate(block(90, 316, 56, 56, 12, 'sAmber', 'sAmberDk'), -14, 118, 344),
  ...rotate([card(164, 292, 76, 48, 12), bar(176, 306, 48, 'sLavLt', 8), bar(176, 320, 30, 'sLavLt', 6)], 10, 202, 316),
  ...block(48, 410, 200, 96, 28, 'sBerry', 'sBerryDk'),
  zmark(128, 438, 40),
  ...figure(CAST.theo, 'present', 330, 506, -1, FS),
  star(52, 290, 10, GOLD), star(392, 230, 7, 'sPaper'),
]));

/** 6 · The cast — built for people who run their own thing. */
const cast = S2(W, H, lift([
  field(W, H, 'sBone'),
  fill(rect(24, 504, 384, 6, 3), 'sBar'),
  ...figure(CAST.ines, 'holding', 66, 506, 1, FS, FOLDER),
  ...figure(CAST.maya, 'tablet', 166, 506, 1, FS, TABLET),
  ...figure(CAST.theo, 'holding', 268, 506, -1, FS, PHONE),
  ...figure(CAST.sam, 'crossed', 366, 506, -1, FS),
  star(404, 240, 9, GOLD),
]));

export const SOCIAL = { launch, portal, focus, paid, inbox, cast } satisfies Record<string, Art>;
export type SocialName = keyof typeof SOCIAL;
