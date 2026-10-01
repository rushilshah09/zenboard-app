// Zen Shape — flat geometric illustrations in Zenboard colors.
//
// Construction rules (the difference between crafted and cheap):
//  1. One tight, centered cluster per illustration. Objects touch and overlap;
//     order and overlap tell the story. No connector arrows.
//  2. One light: from the top left. Every colored shape gets the same fold, a
//     crescent of its own deeper shade at the lower right. White UI stays flat.
//  3. Mid-tone brand fields (lavender, blush, amber) so white and berry pop.
//  4. At most two thick, tinted bars on a card. No grey placeholder text.
//  5. The Zenboard mark appears once, on the hero object. No faces.
//  6. Icons: one object in a 48px live area, centered on a 96px round field.
import { type Art, type Part, type Tone, rect, circle, ellipse, poly, sparkle, mark, dashed } from './kit';

const S = (w: number, h: number, parts: Part[]): Art => ({ w, h, parts, look: 'shape' });

// ── Construction ────────────────────────────────────────────────────────────
const fill = (d: string, tone: Tone, extra: Partial<Part> = {}): Part => ({ d, fill: tone, line: false, ...extra });
const field = (tone: Tone): Part => ({ d: rect(0, 0, 360, 240, 24), fill: tone, line: false, backdrop: true });
/** A soft stage behind the cluster: one big circle in a deeper tint of the field. */
const STAGE: Partial<Record<Tone, [Tone, number]>> = { sLav: ['sLavDk', 0.35], sBerryLt: ['sPink', 0.18], sAmberLt: ['sAmber', 0.22] };
const stage = (fieldTone: Tone, cx = 180, cy = 124, r = 104): Part => {
  const [tone, opacity] = STAGE[fieldTone] ?? ['sLavDk', 0.3];
  return fill(circle(cx, cy, r), tone, { opacity });
};
const shadow = (cx: number, cy: number, rx: number, tone: Tone = 'sIndigoDk'): Part =>
  fill(ellipse(cx, cy, rx, Math.max(4, rx * 0.09)), tone, { opacity: 0.2 });
/** A colored block: deep shade underneath, base lit from the top left → an even crescent fold at the lower right. */
const block = (x: number, y: number, w: number, h: number, r: number, base: Tone, dk: Tone): Part[] => {
  const d = rect(x, y, w, h, r);
  const R = 0.84 * Math.hypot(w * 0.7, h * 0.8);
  return [fill(d, base), fill(d + circle(x + w * 0.3, y + h * 0.2, R), dk, { clip: d, evenOdd: true })];
};
const ball = (cx: number, cy: number, r: number, base: Tone, dk: Tone): Part[] => {
  const d = circle(cx, cy, r);
  return [fill(d, base), fill(d + circle(cx - r * 0.14, cy - r * 0.14, r), dk, { clip: d, evenOdd: true })];
};
/** A seal: soft scalloped rosette behind a ball. */
const rosette = (cx: number, cy: number, r: number, tone: Tone): Part[] => [
  fill(circle(cx, cy, r * 0.86), tone),
  ...Array.from({ length: 16 }, (_, i): Part => {
    const a = (i / 16) * Math.PI * 2;
    return fill(circle(cx + r * 0.84 * Math.cos(a), cy + r * 0.84 * Math.sin(a), r * 0.2), tone);
  }),
];
/** White UI surface: flat. */
const card = (x: number, y: number, w: number, h: number, r: number, tone: Tone = 'sPaper'): Part => fill(rect(x, y, w, h, r), tone);
const bar = (x: number, y: number, w: number, tone: Tone = 'sLavLt', h = 8): Part => fill(rect(x, y, w, h, h / 2), tone);
const tick = (cx: number, cy: number, r: number, tone: Tone = 'sPaper'): Part =>
  ({ d: `M${cx - r * 0.42} ${cy + r * 0.02}L${cx - r * 0.1} ${cy + r * 0.32}L${cx + r * 0.44} ${cy - r * 0.3}`, line: tone, w: r / 6.5 });
const done = (cx: number, cy: number, r: number): Part[] => [...ball(cx, cy, r, 'sGreen', 'sGreenDk'), tick(cx, cy, r)];
const zmark = (x: number, y: number, size: number, tone: Tone = 'sPaper'): Part => ({ ...mark(x, y, size, tone), line: false });
const dot = (cx: number, cy: number, r: number, tone: Tone = 'sCoral'): Part => fill(circle(cx, cy, r), tone);
const star = (cx: number, cy: number, r: number, tone: Tone = 'sPaper'): Part => fill(sparkle(cx, cy, r), tone);
const GOLD: Tone = 'sGold';
/** A person as one shape: ball + head and shoulders in paper. No face. */
const person = (cx: number, cy: number, r: number, base: Tone = 'sIndigo', dk: Tone = 'sIndigoDk'): Part[] => {
  const d = circle(cx, cy, r);
  return [
    ...ball(cx, cy, r, base, dk),
    fill(circle(cx, cy - r * 0.18, r * 0.33), 'sPaper', { clip: d }),
    fill(ellipse(cx, cy + r * 0.84, r * 0.62, r * 0.5), 'sPaper', { clip: d }),
  ];
};
const rotate = (parts: Part[], deg: number, cx: number, cy: number): Part[] =>
  parts.map((p) => ({ ...p, t: `rotate(${deg} ${cx} ${cy})${p.t ? ` ${p.t}` : ''}` }));
/** The link symbol: two rings interlocked on a diagonal. */
const chain = (x: number, y: number, s = 1, tone: Tone = 'sBerry'): Part[] => {
  const ring = (rx: number, ry: number) => fill(rect(rx, ry, 24 * s, 14 * s, 7 * s) + rect(rx + 5 * s, ry + 4.5 * s, 14 * s, 5 * s, 2.5 * s), tone, { evenOdd: true });
  const cx = x + 20 * s;
  const cy = y + 8 * s;
  return rotate([ring(x, y + 1 * s), ring(x + 16 * s, y + 1 * s)], -40, cx, cy);
};
const lock = (x: number, y: number, open: boolean): Part[] => [
  { d: open ? `M${x + 6} ${y}V${y - 9}Q${x + 6} ${y - 17} ${x + 14} ${y - 17}Q${x + 22} ${y - 17} ${x + 22} ${y - 11}` : `M${x + 6} ${y}V${y - 7}Q${x + 6} ${y - 15} ${x + 14} ${y - 15}Q${x + 22} ${y - 15} ${x + 22} ${y - 7}V${y}`, line: 'sAmberDk', w: 1.6 },
  ...block(x, y, 28, 22, 7, 'sAmber', 'sAmberDk'),
  fill(circle(x + 14, y + 10, 3), 'sAmberDk'),
];
/** Page corner fold scales with the page (≈18% of its width, capped), so small pages aren't over-folded. */
const foldOf = (w: number) => Math.min(24, w * 0.18);
const docShape = (x: number, y: number, w: number, h: number) => {
  const f = foldOf(w);
  const r = Math.min(12, w * 0.14);
  return `M${x} ${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - f}L${x + w} ${y + f}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}Z`;
};
const doc = (x: number, y: number, w: number, h: number): Part[] => {
  const f = foldOf(w);
  return [fill(docShape(x, y, w, h), 'sPaper'), fill(poly(x + w - f, y, x + w, y + f, x + w - f, y + f), 'sLavLt')];
};
const receipt = (x: number, y: number, w: number, h: number): Part => {
  const n = Math.floor(w / 14);
  const teeth = Array.from({ length: n }, (_, i) => `L${x + w - (i + 0.5) * (w / n)} ${y + h - 8}L${x + w - (i + 1) * (w / n)} ${y + h}`).join('');
  return fill(`M${x + 12} ${y}H${x + w - 12}Q${x + w} ${y} ${x + w} ${y + 12}V${y + h}${teeth}L${x} ${y + h}V${y + 12}Q${x} ${y} ${x + 12} ${y}Z`, 'sPaper');
};
/** A coin: its edge (thickness) behind, a flat face, a raised rim ring and the embossed mark. */
const coin = (cx: number, cy: number, r: number): Part[] => [
  fill(circle(cx + r * 0.16, cy + r * 0.1, r), 'sAmberDk'),
  fill(circle(cx, cy, r), 'sAmber'),
  fill(circle(cx, cy, r * 0.8) + circle(cx, cy, r * 0.66), 'sAmberDk', { evenOdd: true }),
  zmark(cx - r * 0.38, cy - r * 0.38, r * 0.76, 'sAmberDk'),
];
const phone = (x: number, y: number, w: number, h: number): Part[] => [
  card(x, y, w, h, 22, 'sInk'),
  card(x + 7, y + 7, w - 14, h - 14, 16),
  fill(rect(x + w / 2 - 14, y + 13, 28, 6, 3), 'sInk'),
];

// ── Hero: everything you run, in one calm place ─────────────────────────────
export const hub = S(400, 300, [
  { d: rect(0, 0, 400, 300, 26), fill: 'sLav', line: false, backdrop: true },
  shadow(200, 262, 150),
  // calendar with focus on top (left)
  ...block(70, 150, 92, 108, 18, 'sBlue', 'sBlueDk'),
  fill(rect(70, 150, 92, 24), 'sBlueDk', { clip: rect(70, 150, 92, 108, 18) }),
  ...[0, 1, 2].flatMap((c) => [0, 1, 2].map((r): Part => fill(rect(84 + c * 23, 186 + r * 21, 16, 13, 4), r === 1 && c === 2 ? 'sBerry' : 'sPaper'))),
  ...ball(116, 116, 32, 'sIndigo', 'sIndigoDk'),
  fill(rect(109, 76, 14, 10, 4), 'sIndigoDk'),
  fill(circle(116, 116, 22), 'sPaper'),
  { d: 'M116 116L126 104', line: 'sBerry', w: 1.5 },
  fill(circle(116, 116, 3.5), 'sInk'),
  // Zenboard, the center
  ...block(166, 58, 110, 200, 30, 'sBerry', 'sBerryDk'),
  zmark(187, 120, 68),
  // projects folder + chat (right)
  fill(rect(286, 124, 42, 20, 7), 'sAmberDk'),
  ...block(280, 134, 96, 66, 16, 'sAmber', 'sAmberDk'),
  ...block(280, 204, 96, 54, 16, 'sGreen', 'sGreenDk'),
  fill('M300 216H350Q358 216 358 224V236Q358 244 350 244H322L312 252L313 244H300Q292 244 292 236V224Q292 216 300 216Z', 'sPaper'),
  dot(310, 230, 3.4, 'sGreen'), dot(324, 230, 3.4, 'sGreen'), dot(338, 230, 3.4, 'sGreen'),
  // the one thing waiting on you
  ...done(328, 100, 24), dot(348, 80, 8),
  star(150, 54, 13, GOLD), star(362, 164, 8), star(46, 120, 8),
]);

// ── Feature scenes (360×240) ────────────────────────────────────────────────

/** Home — Zenboard lifts the one task that matters first out of the day. */
const home = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  ...ball(270, 70, 30, 'sAmber', 'sAmberDk'),
  shadow(180, 196, 112),
  ...rotate([card(112, 50, 156, 46, 23), bar(160, 68, 60)], 5, 190, 73),
  ...rotate([card(98, 74, 170, 50, 25), bar(146, 94, 72)], -3, 183, 99),
  ...block(80, 104, 200, 70, 35, 'sBerry', 'sBerryDk'),
  zmark(99, 120, 38),
  bar(152, 127, 68, 'sBerryLt', 10), bar(152, 145, 42, 'sBerryLt', 8),
  fill(circle(246, 139, 21), 'sPaper'), fill(poly(240, 129, 240, 149, 256, 139), 'sBerry'),
  star(66, 60, 11), star(300, 186, 7),
]);

/** Inbox — everything lands in one place, then is sorted in one pass. */
const inbox = S(360, 240, [
  field('sBerryLt'),
  stage('sBerryLt'),
  shadow(180, 212, 124, 'sBerryDk'),
  ...rotate(block(106, 50, 56, 56, 12, 'sAmber', 'sAmberDk'), -14, 134, 78),
  ...rotate([
    ...block(198, 50, 62, 54, 12, 'sBlue', 'sBlueDk'),
    fill(rect(198, 50, 62, 14), 'sBlueDk', { clip: rect(198, 50, 62, 54, 12) }),
    ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(207 + c * 16, 72 + r * 13, 11, 8, 2.5), r === 1 && c === 2 ? 'sBerry' : 'sPaper'))),
  ], 12, 229, 77),
  card(138, 36, 86, 64, 12), fill(poly(132, 36, 181, 74, 230, 36), 'sLavLt', { clip: rect(138, 36, 86, 64, 12) }),
  fill(rect(100, 102, 160, 18, 9), 'sBerryDk'),
  ...block(92, 108, 176, 96, 26, 'sBerry', 'sBerryDk'),
  zmark(157, 133, 46),
  ...done(266, 110, 19),
  star(62, 58, 9, GOLD), star(300, 196, 6),
]);

/** Projects — work moves across the board; the card goes to Done. */
const projects = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  shadow(180, 210, 132),
  card(46, 34, 268, 172, 22),
  ...[0, 1, 2].map((i): Part => fill(rect(58 + i * 84, 46, 76, 148, 14), 'sLavLt')),
  dot(70, 60, 4.5, 'sLavDk'), bar(80, 56, 32, 'sLav'), dot(154, 60, 4.5, 'sAmber'), bar(164, 56, 32, 'sLav'), dot(238, 60, 4.5, 'sGreen'), bar(248, 56, 32, 'sLav'),
  card(66, 76, 60, 38, 10), bar(72, 84, 22, 'sAmber', 6), bar(72, 98, 42, 'sLavLt', 6),
  card(66, 120, 60, 38, 10), bar(72, 128, 22, 'sBlue', 6), bar(72, 142, 36, 'sLavLt', 6),
  card(150, 76, 60, 38, 10), bar(156, 84, 22, 'sIndigo', 6), bar(156, 98, 40, 'sLavLt', 6),
  fill(rect(150, 120, 60, 38, 10), 'sLav', { opacity: 0.35 }),
  card(234, 76, 60, 38, 10), ...done(248, 95, 8), bar(260, 91, 28, 'sLavLt', 6),
  shadow(226, 186, 54),
  ...rotate([...block(174, 130, 100, 46, 14, 'sBerry', 'sBerryDk'), zmark(186, 141, 24), bar(218, 144, 42, 'sBerryLt', 8)], -7, 224, 153),
  star(40, 46, 9, GOLD), star(326, 196, 7),
]);

/** Client portal — the project opens on your client's phone, with what needs them on top. */
const clientPortal = S(360, 240, [
  field('sBerryLt'),
  stage('sBerryLt'),
  shadow(186, 210, 90, 'sBerryDk'),
  ...phone(136, 22, 112, 190),
  zmark(152, 44, 22, 'sBerry'), bar(182, 50, 48),
  fill(rect(152, 80, 80, 10, 5), 'sLavLt'), fill(rect(152, 80, 54, 10, 5), 'sIndigo'),
  ...block(150, 104, 84, 58, 14, 'sIndigo', 'sIndigoDk'),
  bar(162, 116, 46, 'sLav', 8), fill(rect(162, 134, 58, 18, 9), 'sPaper'),
  ...done(162, 182, 8), bar(176, 178, 48),
  // the link you sent
  shadow(104, 150, 50, 'sBerryDk'),
  card(52, 106, 104, 40, 20), ...chain(66, 118, 1),
  // your client
  ...person(256, 52, 26),
  star(56, 60, 9, GOLD), star(300, 196, 6),
]);

/** Docs — a line in the brief becomes a task, and the brief lives in its project. */
const docs = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  shadow(176, 212, 118),
  fill(rect(86, 70, 52, 22, 8), 'sAmberDk'),
  fill(rect(78, 82, 192, 120, 20), 'sAmberDk'),
  ...doc(104, 32, 124, 150),
  bar(120, 56, 56), bar(120, 74, 88),
  fill(rect(114, 90, 104, 20, 10), 'sBerryLt'),
  shadow(262, 128, 58),
  ...block(198, 84, 124, 36, 18, 'sBerry', 'sBerryDk'),
  ...done(217, 102, 9), bar(234, 98, 66, 'sBerryLt', 8),
  ...block(70, 124, 208, 84, 22, 'sAmber', 'sAmberDk'),
  zmark(156, 146, 38),
  star(52, 52, 9, GOLD), star(316, 190, 6),
]);

/** Finance — tracked time becomes an invoice, and the payment lands. */
const finance = S(360, 240, [
  field('sAmberLt'),
  stage('sAmberLt'),
  shadow(180, 212, 124, 'sAmberDk'),
  receipt(116, 26, 124, 176),
  zmark(132, 42, 22, 'sBerry'), bar(162, 49, 56),
  bar(172, 84, 52), bar(172, 100, 44),
  fill(rect(128, 130, 100, 26, 13), 'sBerryLt'), bar(138, 139, 40, 'sBerry', 8),
  ...ball(116, 102, 30, 'sIndigo', 'sIndigoDk'),
  fill(rect(109, 64, 14, 10, 4), 'sIndigoDk'),
  fill(circle(116, 102, 21), 'sPaper'), { d: 'M116 102L126 91', line: 'sBerry', w: 1.5 }, fill(circle(116, 102, 3.2), 'sInk'),
  shadow(270, 206, 64, 'sAmberDk'),
  ...block(206, 142, 120, 64, 16, 'sGreen', 'sGreenDk'),
  fill(rect(220, 156, 22, 16, 5), 'sAmber'), bar(220, 186, 64, 'sPaper', 8),
  ...coin(290, 128, 21),
  ...coin(274, 112, 21),
  star(58, 56, 9, GOLD), star(318, 86, 6),
]);

/** One link, no login — your link opens the project on your client's phone. No password. */
const shareLink = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  shadow(180, 212, 120),
  ...block(64, 44, 88, 88, 24, 'sBerry', 'sBerryDk'),
  zmark(82, 62, 52),
  shadow(150, 176, 56),
  ...phone(182, 24, 104, 186),
  bar(202, 58, 50), bar(202, 74, 34),
  fill(circle(246, 112, 20), 'sLavLt'),
  { d: 'M246 92A20 20 0 1 1 228 121', line: 'sIndigo', w: 1.8 },
  ...lock(232, 166, true),
  card(96, 132, 112, 40, 20), ...chain(110, 144, 1),
  bar(158, 148, 30, 'sLavLt', 8),
]);

/** You choose what they see — your switches decide what reaches your client. */
const visibility = S(360, 240, [
  field('sBerryLt'),
  stage('sBerryLt'),
  shadow(180, 208, 124, 'sBerryDk'),
  card(58, 32, 150, 170, 20),
  zmark(74, 48, 22, 'sBerry'), bar(104, 55, 60),
  ...([true, true, false] as const).flatMap((on, i): Part[] => {
    const y = 96 + i * 34;
    return [bar(74, y, 58), fill(rect(146, y - 7, 44, 22, 11), on ? 'sBerry' : 'sLavLt'), fill(circle(on ? 179 : 157, y + 4, 8), 'sPaper')];
  }),
  ...lock(88, 170, false),
  shadow(260, 176, 60, 'sBerryDk'),
  card(196, 70, 118, 100, 18),
  ...done(216, 108, 9), bar(232, 104, 62),
  ...done(216, 138, 9), bar(232, 134, 48),
  ...person(302, 70, 22),
  star(40, 52, 9, GOLD), star(330, 190, 6),
]);

/** Requests become tasks — your client's request lands in your tasks, ready to accept. */
const requests = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  shadow(180, 206, 132),
  ...person(80, 148, 38),
  card(80, 44, 124, 52, 26), fill(poly(106, 92, 100, 112, 124, 92), 'sPaper'),
  bar(102, 58, 72), bar(102, 74, 48),
  dot(200, 48, 11), fill(rect(198.5, 41, 3, 8, 1.5), 'sPaper'), fill(circle(200, 53, 1.7), 'sPaper'),
  card(150, 96, 170, 108, 20),
  zmark(166, 112, 20, 'sBerry'), bar(194, 118, 60),
  ...block(160, 138, 150, 34, 17, 'sBerry', 'sBerryDk'),
  fill(circle(178, 155, 9), 'sPaper'), bar(194, 151, 58, 'sBerryLt', 8), fill(rect(262, 146, 40, 18, 9), 'sPaper'),
  ...done(178, 188, 8), bar(194, 184, 70),
  star(40, 52, 9, GOLD), star(330, 72, 6),
]);

/** Approvals, on the record — your client's approval is stamped onto the plan. */
const approvals = S(360, 240, [
  field('sLav'),
  stage('sLav'),
  shadow(180, 210, 110),
  ...rotate([
    ...doc(98, 30, 140, 176),
    zmark(114, 48, 22, 'sBerry'), bar(144, 55, 52),
    fill(rect(114, 82, 26, 12, 6), 'sLavLt'), fill(rect(144, 82, 26, 12, 6), 'sLavLt'), fill(rect(174, 82, 26, 12, 6), 'sBerry'),
    bar(114, 110, 104), bar(114, 126, 90), bar(114, 142, 70),
    { d: 'M116 176Q124 164 132 176T148 174Q156 168 162 178', line: 'sIndigo', w: 1.2 },
  ], -6, 168, 118),
  ...rosette(250, 164, 48, 'sGreenDk'),
  fill(circle(250, 164, 39.5), 'sPaper'),
  ...ball(250, 164, 36, 'sGreen', 'sGreenDk'),
  tick(250, 164, 30),
  ...person(294, 64, 22),
  star(58, 56, 9, GOLD), star(318, 196, 6),
]);

/** Invoices, next to the work — sent, and paid. */
const invoices = S(360, 240, [
  field('sBerryLt'),
  stage('sBerryLt'),
  shadow(180, 208, 118, 'sBerryDk'),
  receipt(132, 26, 96, 110),
  zmark(146, 40, 18, 'sBerry'), bar(170, 45, 42), bar(146, 70, 66), bar(146, 86, 50),
  ...block(96, 92, 168, 104, 20, 'sBerry', 'sBerryDk'),
  fill(poly(90, 92, 180, 158, 270, 92), 'sPink', { clip: rect(96, 92, 168, 104, 20) }),
  fill(circle(180, 150, 17), 'sPaper'), zmark(170, 140, 20, 'sBerry'),
  shadow(282, 196, 44, 'sBerryDk'),
  card(236, 150, 94, 38, 19), ...done(256, 169, 11), bar(274, 165, 42, 'sLavLt', 8),
  ...coin(96, 190, 18),
  star(64, 60, 9, GOLD), star(318, 110, 6),
]);

export const SHAPE_HERO = { hub } satisfies Record<string, Art>;
/** Move (and optionally scale) every part except the fixed ones as one group. */
const reframe = (art: Art, [dx, dy, k = 1]: [number, number, number?], fixed: (p: Part, i: number) => boolean): Art => {
  const t = `translate(${dx} ${dy})${k === 1 ? '' : ` scale(${k})`}`;
  return { ...art, parts: art.parts.map((p, i) => (fixed(p, i) ? p : { ...p, t: p.t ? `${t} ${p.t}` : t })) };
};
// Every scene opens with field(), stage(): those two stay put.
const isStage = (_p: Part, i: number) => i <= 1;

// Optical framing for the scenes. Clusters were pixel-measured (stage, shadow
// and field excluded): [cx, cy, width]. Each is re-centered on the stage
// (180, 119) and anything wider than 280 is scaled down, so every card has the
// same breathing room at its edges.
const SCENE_BOUNDS: Record<string, [number, number, number]> = {
  home: [180.5, 115.4, 251], inbox: [180, 119.6, 252], projects: [182.1, 119.6, 301],
  clientPortal: [176.3, 115.9, 257], docs: [183.7, 120.7, 278], finance: [188.5, 116.5, 275],
  shareLink: [171, 116.5, 215], visibility: [184.2, 116.5, 303], requests: [184.2, 120.2, 303],
  approvals: [186.4, 120.2, 273], invoices: [193.2, 118.6, 274],
};
const frameScene = (name: string, art: Art): Art => {
  const [cx, cy, w] = SCENE_BOUNDS[name];
  const k = Math.min(1, 280 / w);
  return reframe(art, [+(180 - k * cx).toFixed(2), +(119 - k * cy).toFixed(2), +k.toFixed(3)], isStage);
};
const SCENES_RAW = {
  home, inbox, projects, clientPortal, docs, finance,
  shareLink, visibility, requests, approvals, invoices,
} satisfies Record<string, Art>;
export const SHAPE_SCENES = Object.fromEntries(
  Object.entries(SCENES_RAW).map(([n, a]) => [n, frameScene(n, a)]),
) as Record<keyof typeof SCENES_RAW, Art>;
export type ShapeSceneName = keyof typeof SHAPE_SCENES;

// ── Icons: one object, 48px live area (24→72), on a 96px round field ───────
const icon = (bg: Tone, parts: Part[]): Art => S(96, 96, [fill(circle(48, 48, 46), bg), ...parts]);

export const SHAPE_ICONS = {
  home: icon('sLav', [
    ...ball(68, 28, 8, GOLD, 'sAmber'),
    fill(rect(56, 30, 8, 14, 2), 'sBerryDk'),
    ...block(28, 46, 40, 28, 5, 'sBerry', 'sBerryDk'),
    fill('M20 50Q18.5 48 20.5 46.3L45.5 25.6Q48 23.6 50.5 25.6L75.5 46.3Q77.5 48 76 50Q75 51.4 73 51.4H23Q21 51.4 20 50Z', 'sBerryDk'),
    fill(rect(42, 56, 12, 18, 6), 'sPaper'),
  ]),
  inbox: icon('sBerryLt', [
    card(32, 24, 32, 22, 5), fill(poly(28, 24, 48, 39, 68, 24), 'sLavLt', { clip: rect(32, 24, 32, 22, 5) }),
    fill(rect(28, 44, 40, 8, 4), 'sBerryDk'), ...block(24, 48, 48, 26, 9, 'sBerry', 'sBerryDk'), dot(68, 48, 6),
  ]),
  tasks: icon('sLav', [...block(26, 26, 44, 44, 13, 'sGreen', 'sGreenDk'), tick(48, 48, 20)]),
  calendar: icon('sBerryLt', [
    ...block(24, 26, 48, 46, 11, 'sBlue', 'sBlueDk'), fill(rect(24, 26, 48, 12), 'sBlueDk', { clip: rect(24, 26, 48, 46, 11) }),
    ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(31 + c * 12, 44 + r * 12, 9, 8, 2.5), r === 1 && c === 2 ? 'sBerry' : 'sPaper'))),
  ]),
  focus: icon('sLav', [
    ...ball(48, 52, 22, 'sIndigo', 'sIndigoDk'), fill(rect(43, 24, 10, 7, 2.5), 'sIndigoDk'),
    fill(circle(48, 52, 15), 'sPaper'), { d: 'M48 52L55 45', line: 'sBerry', w: 1.3 }, fill(circle(48, 52, 2.2), 'sInk'),
  ]),
  goals: icon('sAmberLt', [
    fill(rect(24, 56, 16, 16, 4), 'sLav'), fill(rect(40, 46, 16, 26, 4), 'sAmber'), ...block(56, 36, 16, 36, 4, 'sBerry', 'sBerryDk'),
    { d: 'M64 36V22', line: 'sInk', w: 0.9 }, fill('M64 22H76L72 26.5L76 31H64Z', 'sGreen'),
  ]),
  habits: icon('sAmberLt', [
    fill('M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z', 'sCoral'),
    fill('M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z' + circle(38, 36, 40), 'sCoralDk', { clip: 'M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z', evenOdd: true }),
    fill('M48 46Q57 54 55 62Q53 70 48 70Q42 69 41 62Q41 54 48 46Z', 'sGold'),
  ]),
  priority: icon('sLav', (() => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 11 : 25;
      return [+(48 + r * Math.cos(a)).toFixed(1), +(50 + r * Math.sin(a)).toFixed(1)];
    }).flat();
    const d = poly(...pts);
    return [
      { ...fill(d, 'sGold'), line: 'sGold', w: 2.2 } as Part,
      { ...fill(d + circle(42, 42, 30), 'sAmber', { clip: d, evenOdd: true }) } as Part,
    ];
  })()),
  projects: icon('sLav', [
    fill(rect(28, 28, 20, 10, 4), 'sAmberDk'), card(31, 31, 36, 12, 3),
    ...block(24, 36, 48, 36, 10, 'sAmber', 'sAmberDk'),
  ]),
  docs: icon('sBerryLt', [
    ...doc(30, 22, 36, 52), fill(rect(35, 44, 26, 8, 4), 'sBerry'), bar(35, 34, 18, 'sLavLt', 6), bar(35, 58, 22, 'sLavLt', 6),
  ]),
  clientPortal: icon('sLav', [
    card(34, 22, 28, 52, 9, 'sInk'), card(37, 25, 22, 46, 6), fill(rect(40, 32, 16, 5, 2.5), 'sBerry'), fill(rect(40, 52, 16, 10, 5), 'sBerry'),
    ...person(64, 64, 11),
  ]),
  clients: icon('sBerryLt', [...person(38, 50, 17, 'sAmber', 'sAmberDk'), ...person(58, 50, 17)]),
  forms: icon('sLav', [
    ...block(28, 26, 40, 46, 9, 'sAmber', 'sAmberDk'), card(33, 32, 30, 36, 4), fill(rect(40, 22, 16, 9, 4.5), 'sBerry'),
    ...done(40, 42, 4.5), bar(47, 39, 12, 'sLavLt', 6), fill(circle(40, 56, 4.5), 'sLavLt'), bar(47, 53, 10, 'sLavLt', 6),
  ]),
  finance: icon('sAmberLt', [...block(22, 38, 46, 32, 8, 'sGreen', 'sGreenDk'), fill(rect(28, 44, 10, 8, 2.5), 'sAmber'), ...coin(64, 36, 12)]),
  visibility: icon('sBerryLt', [fill('M22 48Q48 24 74 48Q48 72 22 48Z', 'sPaper'), ...ball(48, 48, 12, 'sBerry', 'sBerryDk'), fill(circle(48, 48, 4.6), 'sInk')]),
  requests: icon('sLav', [
    card(22, 26, 46, 20, 10), fill(circle(33, 36, 5), 'sLav'), dot(66, 28, 5),
    ...block(28, 50, 46, 20, 10, 'sBerry', 'sBerryDk'), fill(circle(39, 60, 4.5), 'sPaper'),
  ]),
  approvals: icon('sBerryLt', [...rosette(48, 48, 27, 'sGreenDk'), fill(circle(48, 48, 21.5), 'sPaper'), ...ball(48, 48, 19, 'sGreen', 'sGreenDk'), tick(48, 48, 16)]),
  invoices: icon('sLav', [...block(22, 32, 52, 36, 8, 'sBerry', 'sBerryDk'), fill(poly(18, 32, 48, 55, 78, 32), 'sPink', { clip: rect(22, 32, 52, 36, 8) }), fill(circle(48, 52, 7), 'sPaper')]),
  ai: icon('sBerryLt', [
    ...block(22, 26, 52, 38, 13, 'sBerry', 'sBerryDk'), fill(poly(32, 62, 29, 74, 44, 62), 'sBerryDk'),
    star(46, 45, 11, GOLD), star(62, 34, 4.5),
  ]),
} satisfies Record<string, Art>;
export type ShapeIconName = keyof typeof SHAPE_ICONS;

// ── Website tiles: the same icons on a rounded-square field (64×64) ────────
// The site sets icons on rounded-square tiles, so the tile IS the icon: the
// field, the object and its fold, drawn together. Objects are the icon art
// above, scaled 75% and centered so every tile has the same margin. Extra site-only subjects
// (link, receipt, team, everything, streak) are drawn in the same grid.
const extraIcons = {
  link: icon('sLav', [...chain(25, 40, 1.15)]),
  receipt: icon('sLav', [
    receipt(28, 20, 40, 54), bar(34, 30, 18, 'sLavLt', 6), bar(34, 42, 26, 'sLavLt', 6), fill(rect(34, 52, 26, 8, 4), 'sBerry'),
    ...done(66, 64, 11),
  ]),
  team: icon('sLav', [...person(34, 52, 14, 'sAmber', 'sAmberDk'), ...person(62, 52, 14, 'sGreen', 'sGreenDk'), ...person(48, 44, 16)]),
  everything: icon('sBerryLt', [
    ...block(24, 24, 22, 22, 7, 'sBerry', 'sBerryDk'), ...block(50, 24, 22, 22, 7, 'sBlue', 'sBlueDk'),
    ...block(24, 50, 22, 22, 7, 'sAmber', 'sAmberDk'), ...block(50, 50, 22, 22, 7, 'sGreen', 'sGreenDk'),
    zmark(28.5, 28.5, 13),
  ]),
  streak: icon('sAmberLt', [
    fill('M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z', 'sCoral'),
    fill('M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z' + circle(38, 36, 40), 'sCoralDk', { clip: 'M48 20Q64 34 63 50Q62 68 48 72Q34 68 33 52Q33 41 42 34Q42 44 48 46Q45 32 48 20Z', evenOdd: true }),
    fill('M48 46Q57 54 55 62Q53 70 48 70Q42 69 41 62Q41 54 48 46Z', 'sGold'),
  ]),
} satisfies Record<string, Art>;

const TILE_FIELD: Record<string, Tone> = {
  home: 'sLavLt', inbox: 'sBlushLt', tasks: 'sLavLt', calendar: 'sLavLt', focus: 'sLavLt', goals: 'sAmberLt',
  habits: 'sAmberLt', projects: 'sAmberLt', docs: 'sLav', clientPortal: 'sLavLt', clients: 'sLavLt', forms: 'sAmberLt',
  finance: 'sAmberLt', visibility: 'sLav', requests: 'sLavLt', approvals: 'sLavLt', invoices: 'sBlushLt', ai: 'sBlushLt',
  link: 'sBlushLt', receipt: 'sLav', team: 'sLavLt', everything: 'sBlushLt', streak: 'sAmberLt',
};

const ALL_ICONS = { ...SHAPE_ICONS, ...extraIcons };
export type ShapeTileName = keyof typeof ALL_ICONS;

/** Square tile version of an icon: field + the icon's object (its round field dropped). */
function tileOf(name: ShapeTileName): Art {
  const [, ...object] = ALL_ICONS[name].parts;
  return S(64, 64, [
    { d: rect(0, 0, 64, 64, 16), fill: TILE_FIELD[name] ?? 'sLavLt', line: false },
    ...object.map((p) => ({ ...p, t: `translate(-4 -4) scale(0.75)${p.t ? ` ${p.t}` : ''}` })),
  ]);
}

export const SHAPE_TILES = Object.fromEntries(
  (Object.keys(ALL_ICONS) as ShapeTileName[]).map((n) => [n, tileOf(n)]),
) as Record<ShapeTileName, Art>;

// ── In-app empty states (200×140, transparent) ─────────────────────────────
// For the app's own surfaces (dark or light): no field, a faint stage, one hero
// object and one cue: a berry plus = "create your first", a green check =
// "all clear". Same construction, palette and light as the scenes above.
const E = (parts: Part[]): Art => S(200, 140, [fill(circle(100, 66, 60), 'sLav', { opacity: 0.3 }), ...parts]);
const eShadow = (rx = 62): Part => fill(ellipse(100, 121, rx, 5.5), 'sInk', { opacity: 0.22 });
/** "Create your first": a berry plus badge. */
const plusBadge = (cx: number, cy: number, r = 13): Part[] => [
  ...ball(cx, cy, r, 'sBerry', 'sBerryDk'),
  { d: `M${cx} ${cy - r * 0.45}V${cy + r * 0.45}M${cx - r * 0.45} ${cy}H${cx + r * 0.45}`, line: 'sPaper', w: r / 7.5 },
];
const flameAt = (cx: number, cy: number, s: number): Part[] => {
  const d = `M${cx} ${cy - 30 * s}Q${cx + 18 * s} ${cy - 14 * s} ${cx + 17 * s} ${cy + 3 * s}Q${cx + 16 * s} ${cy + 22 * s} ${cx} ${cy + 26 * s}Q${cx - 16 * s} ${cy + 22 * s} ${cx - 17 * s} ${cy + 5 * s}Q${cx - 17 * s} ${cy - 7 * s} ${cx - 7 * s} ${cy - 15 * s}Q${cx - 7 * s} ${cy - 4 * s} ${cx} ${cy - 2 * s}Q${cx - 3 * s} ${cy - 16 * s} ${cx} ${cy - 30 * s}Z`;
  return [
    fill(d, 'sCoral'),
    fill(d + circle(cx - 8 * s, cy - 12 * s, 40 * s), 'sCoralDk', { clip: d, evenOdd: true }),
    fill(`M${cx} ${cy - 2 * s}Q${cx + 10 * s} ${cy + 7 * s} ${cx + 8 * s} ${cy + 15 * s}Q${cx + 6 * s} ${cy + 24 * s} ${cx} ${cy + 24 * s}Q${cx - 7 * s} ${cy + 23 * s} ${cx - 8 * s} ${cy + 15 * s}Q${cx - 8 * s} ${cy + 7 * s} ${cx} ${cy - 2 * s}Z`, GOLD),
  ];
};
const tray = (x: number, y: number, w: number, h: number): Part[] => [
  fill(rect(x + 8, y - 6, w - 16, 14, 7), 'sBerryDk'),
  ...block(x, y, w, h, 18, 'sBerry', 'sBerryDk'),
];

const EMPTY_RAW = {
  /** Inbox: triaged to zero. */
  inboxZero: E([eShadow(58), ...tray(50, 62, 100, 56), zmark(86, 75, 28), ...done(146, 50, 15), star(54, 38, 7, GOLD)]),
  /** Tasks · Inbox: capture now, plan later. */
  inboxCapture: E([eShadow(58), ...rotate(block(82, 26, 36, 36, 9, 'sAmber', 'sAmberDk'), -12, 100, 44), ...tray(50, 62, 100, 56), zmark(86, 75, 28), star(150, 40, 7, GOLD)]),
  /** Tasks · Today, Home: all clear for today. */
  dayClear: E([eShadow(60), ...ball(132, 46, 22, 'sAmber', 'sAmberDk'), card(46, 54, 108, 46, 23), ...done(70, 77, 11), bar(88, 70, 50, 'sLavLt', 8), bar(88, 84, 30, 'sLavLt', 6)]),
  /** Tasks · Upcoming, schedule. */
  upcoming: E([
    eShadow(52), ...block(58, 30, 84, 80, 16, 'sBlue', 'sBlueDk'), fill(rect(58, 30, 84, 20), 'sBlueDk', { clip: rect(58, 30, 84, 80, 16) }),
    ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(70 + c * 22, 62 + r * 20, 16, 13, 4), r === 0 && c === 2 ? 'sBerry' : 'sPaper'))),
    star(150, 36, 7, GOLD),
  ]),
  /** Tasks · Completed: your quiet record of progress. */
  completed: E([eShadow(52), ...rotate([card(58, 34, 84, 66, 14)], -8, 100, 67), card(62, 38, 84, 66, 14), bar(76, 54, 46, 'sLavLt', 8), bar(76, 68, 30, 'sLavLt', 6), ...done(136, 92, 20)]),
  /** Projects: none yet. */
  projects: E([eShadow(60), fill(rect(58, 36, 36, 16, 6), 'sAmberDk'), card(64, 42, 72, 30, 4), ...block(50, 50, 100, 66, 16, 'sAmber', 'sAmberDk'), zmark(86, 69, 28), ...plusBadge(148, 50)]),
  /** Clients: none yet. */
  clients: E([eShadow(56), ...person(82, 74, 30), ...person(124, 80, 24, 'sAmber', 'sAmberDk'), ...plusBadge(146, 48)]),
  /** Finance: no invoices yet. */
  invoices: E([
    eShadow(52), receipt(64, 24, 72, 94), zmark(74, 34, 14, 'sBerry'), bar(94, 38, 30), bar(74, 58, 44), bar(74, 72, 34),
    fill(rect(72, 88, 56, 14, 7), 'sBerryLt'), bar(78, 92, 22, 'sBerry', 6), ...coin(138, 100, 15), ...plusBadge(140, 36, 12),
  ]),
  /** Forms: none yet. */
  forms: E([
    eShadow(48), ...block(66, 30, 68, 88, 12, 'sAmber', 'sAmberDk'), card(74, 40, 52, 70, 6), fill(rect(88, 23, 24, 13, 6.5), 'sBerry'),
    ...done(84, 56, 5.5), bar(94, 53, 24, 'sLavLt', 6), fill(circle(84, 74, 5.5), 'sLavLt'), bar(94, 71, 20, 'sLavLt', 6), fill(circle(84, 92, 5.5), 'sLavLt'), bar(94, 89, 22, 'sLavLt', 6),
    ...plusBadge(140, 42, 12),
  ]),
  /** Form responses: waiting for answers. */
  responses: E([
    eShadow(58), ...block(44, 34, 60, 80, 11, 'sAmber', 'sAmberDk'), card(51, 43, 46, 64, 5), bar(58, 54, 30, 'sLavLt', 6), bar(58, 68, 24, 'sLavLt', 6), bar(58, 82, 28, 'sLavLt', 6),
    ...block(100, 46, 62, 40, 15, 'sIndigo', 'sIndigoDk'), fill(poly(112, 84, 108, 98, 126, 84), 'sIndigoDk'),
    dot(118, 66, 4, 'sPaper'), dot(131, 66, 4, 'sPaper'), dot(144, 66, 4, 'sPaper'),
  ]),
  /** Habits: build a rhythm. */
  habits: E([
    eShadow(54), ...flameAt(100, 62, 1.25),
    ...[0, 1, 2, 3, 4].map((i): Part => fill(rect(56 + i * 18, 104, 14, 8, 4), i < 2 ? 'sCoral' : 'sLavLt')),
    ...plusBadge(146, 42, 12),
  ]),
  /** Goals: name an outcome. */
  goals: E([
    eShadow(54), fill(rect(56, 80, 26, 34, 6), 'sLav'), fill(rect(84, 64, 26, 50, 6), 'sAmber'), ...block(112, 46, 26, 68, 6, 'sBerry', 'sBerryDk'),
    { d: 'M125 46V18', line: 'sInk', w: 0.9 }, fill('M125 18H145L139 25L145 32H125Z', 'sGreen'),
    star(60, 46, 7, GOLD),
  ]),
  /** Feedback board: log what customers ask for. */
  feedback: E([
    eShadow(60), card(42, 36, 84, 40, 20), fill(poly(60, 72, 56, 86, 74, 72), 'sPaper'), bar(58, 48, 48, 'sLavLt', 7), bar(58, 60, 30, 'sLavLt', 6),
    ...block(80, 70, 80, 40, 20, 'sIndigo', 'sIndigoDk'), dot(104, 90, 4, 'sPaper'), dot(118, 90, 4, 'sPaper'), dot(132, 90, 4, 'sPaper'),
    ...block(138, 30, 26, 26, 9, 'sBerry', 'sBerryDk'), { d: 'M145 46L151 39L157 46', line: 'sPaper', w: 1.2 },
  ]),
  /** 404: this page isn't here. */
  notFound: E([
    eShadow(62),
    ...rotate([card(44, 30, 112, 82, 14), fill(rect(80, 30, 2, 82), 'sLavLt'), fill(rect(118, 30, 2, 82), 'sLavLt'),
      { d: dashed(58, 96, 84, 64, 122, 62, 6, 5), line: 'sLavDk', w: 1 }], -4, 100, 71),
    fill(`M128 74Q116 62 116 52a12 12 0 1 1 24 0Q140 62 128 74Z`, 'sBerry'),
    fill(circle(128, 52, 6), 'sPaper'),
    star(52, 34, 7, GOLD),
  ]),
  /** Something broke: blocks knocked over. */
  error: E([
    eShadow(56), ...block(56, 78, 40, 38, 8, 'sIndigo', 'sIndigoDk'), ...block(98, 78, 40, 38, 8, 'sBlue', 'sBlueDk'),
    ...rotate(block(78, 42, 38, 34, 8, 'sAmber', 'sAmberDk'), 22, 97, 59),
    dot(148, 44, 12), fill(rect(146.5, 36, 3, 10, 1.5), 'sPaper'), fill(circle(148, 50.5, 1.8), 'sPaper'),
  ]),
} satisfies Record<string, Art>;

// Optical framing. Each cluster (badges and sparkles included, stage and shadow
// excluded) was pixel-measured and nudged so its center sits on the stage at
// (100, 70) and nothing sinks below the ground line (y 117). Stage + shadow stay
// put; everything else moves together, so one composition rule holds for all.
const FRAME: Partial<Record<keyof typeof EMPTY_RAW, [number, number]>> = {
  inboxZero: [-4.5, -4], inboxCapture: [-3, 0], dayClear: [0, 8.5], upcoming: [-8, 1],
  completed: [-5, 0], projects: [-6, -5.5], clients: [-5, 1], invoices: [-10.5, 0],
  forms: [-9.5, 0], responses: [-2.5, -3.5], habits: [-7.5, 2.5], goals: [1.5, 4.5],
  feedback: [-3.5, 0], error: [-7.5, -3.5],
};
const isEmptyFixed = (p: Part, i: number) => i === 0 || (p.fill === 'sInk' && (p.opacity ?? 1) < 0.5);
export const EMPTY = Object.fromEntries(
  Object.entries(EMPTY_RAW).map(([n, art]) => {
    const f = FRAME[n as keyof typeof EMPTY_RAW];
    return [n, f ? reframe(art, f, isEmptyFixed) : art];
  }),
) as Record<keyof typeof EMPTY_RAW, Art>;
export type EmptyName = keyof typeof EMPTY;
