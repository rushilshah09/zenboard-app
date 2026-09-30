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
import { type Art, type Part, type Tone, rect, circle, ellipse, poly, sparkle, mark } from './kit';

const S = (w: number, h: number, parts: Part[]): Art => ({ w, h, parts, look: 'shape' });

// ── Construction ────────────────────────────────────────────────────────────
const fill = (d: string, tone: Tone, extra: Partial<Part> = {}): Part => ({ d, fill: tone, line: false, ...extra });
const field = (tone: Tone): Part => ({ d: rect(0, 0, 360, 240, 24), fill: tone, line: false, backdrop: true });
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
const chain = (x: number, y: number, s = 1, tone: Tone = 'sBerry'): Part[] => [
  fill(rect(x, y, 26 * s, 16 * s, 8 * s) + rect(x + 5 * s, y + 5 * s, 16 * s, 6 * s, 3 * s), tone, { evenOdd: true }),
  fill(rect(x + 17 * s, y, 26 * s, 16 * s, 8 * s) + rect(x + 22 * s, y + 5 * s, 16 * s, 6 * s, 3 * s), tone, { evenOdd: true }),
];
const lock = (x: number, y: number, open: boolean): Part[] => [
  { d: open ? `M${x + 6} ${y}V${y - 9}Q${x + 6} ${y - 17} ${x + 14} ${y - 17}Q${x + 22} ${y - 17} ${x + 22} ${y - 11}` : `M${x + 6} ${y}V${y - 7}Q${x + 6} ${y - 15} ${x + 14} ${y - 15}Q${x + 22} ${y - 15} ${x + 22} ${y - 7}V${y}`, line: 'sAmberDk', w: 1.6 },
  ...block(x, y, 28, 22, 7, 'sAmber', 'sAmberDk'),
  fill(circle(x + 14, y + 10, 3), 'sAmberDk'),
];
const docShape = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + 12}Q${x} ${y} ${x + 12} ${y}H${x + w - 26}L${x + w} ${y + 26}V${y + h - 12}Q${x + w} ${y + h} ${x + w - 12} ${y + h}H${x + 12}Q${x} ${y + h} ${x} ${y + h - 12}Z`;
const doc = (x: number, y: number, w: number, h: number): Part[] => [
  fill(docShape(x, y, w, h), 'sPaper'),
  fill(poly(x + w - 26, y, x + w, y + 26, x + w - 26, y + 26), 'sLavLt'),
];
const receipt = (x: number, y: number, w: number, h: number): Part => {
  const n = Math.floor(w / 14);
  const teeth = Array.from({ length: n }, (_, i) => `L${x + w - (i + 0.5) * (w / n)} ${y + h - 8}L${x + w - (i + 1) * (w / n)} ${y + h}`).join('');
  return fill(`M${x + 12} ${y}H${x + w - 12}Q${x + w} ${y} ${x + w} ${y + 12}V${y + h}${teeth}L${x} ${y + h}V${y + 12}Q${x} ${y} ${x + 12} ${y}Z`, 'sPaper');
};
const coin = (cx: number, cy: number, r: number): Part[] => [...ball(cx, cy, r, 'sAmber', 'sAmberDk'), fill(circle(cx - r * 0.1, cy - r * 0.1, r * 0.55), 'sAmberLt', { opacity: 0.45 })];
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
  star(150, 54, 13, 'sAmber'), star(362, 164, 8), star(46, 120, 8),
]);

// ── Feature scenes (360×240) ────────────────────────────────────────────────

/** Home — Zenboard lifts the one task that matters first out of the day. */
const home = S(360, 240, [
  field('sLav'),
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
  shadow(180, 204, 118, 'sBerryDk'),
  ...rotate(block(106, 50, 52, 52, 12, 'sAmber', 'sAmberDk'), -12, 132, 76),
  card(126, 46, 84, 60, 12), fill(poly(120, 46, 168, 84, 216, 46), 'sLavLt', { clip: rect(126, 46, 84, 60, 12) }),
  fill(rect(96, 100, 110, 18, 9), 'sBerryDk'),
  ...block(80, 106, 142, 92, 24, 'sBerry', 'sBerryDk'),
  zmark(129, 130, 44),
  dot(214, 106, 11),
  // sorted, lined up beside it
  fill(rect(236, 56, 26, 12, 5), 'sAmberDk'),
  ...block(232, 62, 60, 42, 12, 'sAmber', 'sAmberDk'),
  ...block(232, 110, 60, 42, 12, 'sBlue', 'sBlueDk'),
  fill(rect(232, 110, 60, 12), 'sBlueDk', { clip: rect(232, 110, 60, 42, 12) }),
  ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(241 + c * 15, 127 + r * 11, 11, 7, 2.5), r === 1 && c === 2 ? 'sBerry' : 'sPaper'))),
  ...done(262, 178, 21),
]);

/** Projects — work moves across the board; the card goes to Done. */
const projects = S(360, 240, [
  field('sLav'),
  shadow(180, 204, 128),
  ...[0, 1, 2].map((i): Part => card(58 + i * 84, 44, 76, 152, 18)),
  dot(74, 62, 5, 'sLav'), bar(84, 58, 34), dot(158, 62, 5, 'sAmber'), bar(168, 58, 34), dot(242, 62, 5, 'sGreen'), bar(252, 58, 34),
  card(66, 78, 60, 34, 10, 'sLavLt'), card(66, 118, 60, 34, 10, 'sLavLt'),
  card(150, 78, 60, 34, 10, 'sLavLt'),
  card(234, 78, 60, 34, 10, 'sLavLt'), ...done(250, 95, 9),
  shadow(222, 178, 52),
  ...rotate([...block(170, 126, 96, 44, 14, 'sBerry', 'sBerryDk'), zmark(182, 136, 24), bar(214, 139, 40, 'sBerryLt', 8)], -7, 218, 148),
]);

/** Client portal — the project opens on your client's phone, with what needs them on top. */
const clientPortal = S(360, 240, [
  field('sBerryLt'),
  shadow(186, 210, 90, 'sBerryDk'),
  ...phone(136, 22, 112, 190),
  zmark(152, 44, 22, 'sBerry'), bar(182, 50, 48),
  fill(rect(152, 80, 80, 10, 5), 'sLavLt'), fill(rect(152, 80, 54, 10, 5), 'sBerry'),
  ...block(150, 104, 84, 58, 14, 'sBerry', 'sBerryDk'),
  bar(162, 116, 46, 'sBerryLt', 8), fill(rect(162, 134, 58, 18, 9), 'sPaper'),
  ...done(162, 182, 8), bar(176, 178, 48),
  // the link you sent
  shadow(104, 150, 50, 'sBerryDk'),
  card(52, 106, 104, 40, 20), ...chain(66, 118, 1),
  // your client
  ...person(256, 52, 26),
]);

/** Docs — a line in the brief becomes a task, and the brief lives in its project. */
const docs = S(360, 240, [
  field('sLav'),
  shadow(196, 208, 118),
  fill(rect(174, 106, 44, 22, 8), 'sAmberDk'),
  ...block(168, 116, 128, 88, 18, 'sAmber', 'sAmberDk'),
  ...doc(76, 30, 128, 170),
  zmark(92, 48, 24, 'sBerry'), bar(124, 55, 44),
  bar(92, 88, 94), bar(92, 104, 80),
  fill(rect(86, 122, 110, 20, 10), 'sBerryLt'),
  bar(92, 158, 94), bar(92, 174, 64),
  shadow(260, 148, 58),
  card(178, 118, 136, 26, 13), fill(rect(178, 118, 136, 26, 13), 'sBerry'),
  ...done(196, 131, 8), bar(212, 127, 80, 'sBerryLt', 8),
]);

/** Finance — tracked time becomes an invoice, and the payment lands. */
const finance = S(360, 240, [
  field('sAmberLt'),
  shadow(186, 212, 120, 'sAmberDk'),
  receipt(126, 28, 118, 180),
  zmark(142, 44, 22, 'sBerry'), bar(172, 51, 52),
  bar(142, 84, 60), bar(142, 100, 74), bar(142, 116, 52),
  fill(rect(138, 138, 94, 26, 13), 'sBerryLt'), bar(148, 147, 36, 'sBerry', 8),
  ...ball(112, 170, 32, 'sIndigo', 'sIndigoDk'),
  fill(rect(105, 130, 14, 10, 4), 'sIndigoDk'),
  fill(circle(112, 170, 22), 'sPaper'), { d: 'M112 170L123 158', line: 'sBerry', w: 1.6 }, fill(circle(112, 170, 3.5), 'sInk'),
  ...block(206, 132, 112, 70, 16, 'sGreen', 'sGreenDk'),
  fill(rect(220, 146, 22, 16, 5), 'sAmber'), bar(220, 180, 60, 'sPaper', 8),
  ...coin(292, 124, 20),
  ...done(316, 196, 15),
]);

/** One link, no login — your link opens the project on your client's phone. No password. */
const shareLink = S(360, 240, [
  field('sLav'),
  shadow(180, 206, 128),
  ...block(52, 84, 88, 88, 24, 'sBerry', 'sBerryDk'),
  zmark(70, 102, 52),
  card(124, 108, 116, 40, 20), ...chain(140, 120, 1),
  bar(192, 124, 34, 'sLavLt', 8),
  ...phone(222, 30, 94, 168),
  bar(240, 64, 46), bar(240, 80, 32),
  fill(circle(269, 118, 20), 'sLavLt'),
  { d: 'M269 98A20 20 0 1 1 251 127', line: 'sBerry', w: 1.8 },
  ...lock(255, 168, true),
]);

/** You choose what they see — your switches decide what reaches your client. */
const visibility = S(360, 240, [
  field('sBerryLt'),
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
]);

/** Requests become tasks — your client's request lands in your tasks, ready to accept. */
const requests = S(360, 240, [
  field('sLav'),
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
]);

/** Approvals, on the record — your client's approval is stamped onto the plan. */
const approvals = S(360, 240, [
  field('sLav'),
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
]);

/** Invoices, next to the work — sent, and paid. */
const invoices = S(360, 240, [
  field('sBerryLt'),
  shadow(180, 208, 118, 'sBerryDk'),
  receipt(132, 26, 96, 110),
  zmark(146, 40, 18, 'sBerry'), bar(170, 45, 42), bar(146, 70, 66), bar(146, 86, 50),
  ...block(96, 92, 168, 104, 20, 'sBerry', 'sBerryDk'),
  fill(poly(90, 92, 180, 158, 270, 92), 'sPink', { clip: rect(96, 92, 168, 104, 20) }),
  fill(circle(180, 150, 17), 'sPaper'), zmark(170, 140, 20, 'sBerry'),
  shadow(282, 196, 44, 'sBerryDk'),
  card(236, 150, 94, 38, 19), ...done(256, 169, 11), bar(274, 165, 42, 'sLavLt', 8),
  ...coin(96, 190, 18),
]);

export const SHAPE_HERO = { hub } satisfies Record<string, Art>;
export const SHAPE_SCENES = {
  home, inbox, projects, clientPortal, docs, finance,
  shareLink, visibility, requests, approvals, invoices,
} satisfies Record<string, Art>;
export type ShapeSceneName = keyof typeof SHAPE_SCENES;

// ── Icons: one object, 48px live area (24→72), on a 96px round field ───────
const icon = (bg: Tone, parts: Part[]): Art => S(96, 96, [fill(circle(48, 48, 46), bg), ...parts]);

export const SHAPE_ICONS = {
  home: icon('sLav', [...block(20, 33, 56, 30, 15, 'sBerry', 'sBerryDk'), zmark(27, 40, 16), fill(circle(62, 48, 8.5), 'sPaper'), fill(poly(59.5, 43.5, 59.5, 52.5, 66.5, 48), 'sBerry'), card(26, 67, 44, 9, 4.5)]),
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
  habits: icon('sLav', [
    { d: 'M48 72V52', line: 'sGreenDk', w: 1.3 }, fill('M47 66Q36 66 32 58Q42 55 47 62Z', 'sGreen'), fill('M49 62Q60 62 64 54Q54 51 49 58Z', 'sGreen'),
    ...Array.from({ length: 5 }, (_, i): Part => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return fill(circle(48 + 10 * Math.cos(a), 38 + 10 * Math.sin(a), 8), 'sPink');
    }),
    fill(circle(48, 38, 6), 'sAmber'),
  ]),
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
    star(46, 45, 11, 'sAmber'), star(62, 34, 4.5),
  ]),
} satisfies Record<string, Art>;
export type ShapeIconName = keyof typeof SHAPE_ICONS;
