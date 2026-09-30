// Zen Shape — flat geometric illustrations in Zenboard colors.
// No outlines. Rounded blocks, circles, pills and sparkles, each with ONE tonal
// fold (a darker shade of its own hue, clipped to the shape) and a soft tonal
// ground shadow. Objects stack like building blocks. There are no faces: the
// Zenboard mark is the hero shape, and it sits on the product objects it would
// really appear on. Every scene is built around the action Zenboard helps with.
//   · SHAPE_HERO   — the hub: every tool stacked around the mark (400×300)
//   · SHAPE_SCENES — feature illustrations, 2–3 story steps (360×240)
//   · SHAPE_ICONS  — the same blocks at icon size, on a round field (96×96)
import { type Art, type Part, type Tone, rect, circle, ellipse, poly, sparkle, gear, mark, arrowHead } from './kit';

const S = (w: number, h: number, parts: Part[]): Art => ({ w, h, parts, look: 'shape' });

// ── Vocabulary ──────────────────────────────────────────────────────────────
const fill = (d: string, tone: Tone, extra: Partial<Part> = {}): Part => ({ d, fill: tone, line: false, ...extra });
const field = (w: number, h: number, tone: Tone, r = 22): Part => ({ d: rect(0, 0, w, h, r), fill: tone, line: false, backdrop: true });
/** Soft tonal ground shadow. */
const soft = (cx: number, cy: number, rx: number, ry = rx * 0.12): Part => fill(ellipse(cx, cy, rx, ry), 'sInk', { opacity: 0.08, ground: true });
/** A block with one curved tonal fold at its lower right. */
const block = (x: number, y: number, w: number, h: number, r: number, base: Tone, dk: Tone): Part[] => {
  const d = rect(x, y, w, h, r);
  return [fill(d, base), fill(circle(x + w * 1.02, y + h * 1.08, Math.max(w, h) * 0.6), dk, { clip: d })];
};
/** A flat UI surface (white card, panel): no fold — only colored objects fold. */
const panel = (x: number, y: number, w: number, h: number, r: number, tone: Tone = 'sPaper'): Part => fill(rect(x, y, w, h, r), tone);
/** A ball with a crescent fold at its lower right. */
const ball = (cx: number, cy: number, r: number, base: Tone, dk: Tone): Part[] => {
  const d = circle(cx, cy, r);
  return [fill(d, dk), fill(circle(cx - r * 0.16, cy - r * 0.16, r), base, { clip: d })];
};
const bar = (x: number, y: number, w: number, tone: Tone = 'sBar', h = 6): Part => fill(rect(x, y, w, h, h / 2), tone);
const pill = (x: number, y: number, w: number, h: number, tone: Tone): Part => fill(rect(x, y, w, h, h / 2), tone);
/** A glyph stroke (checks, arrows, hands): the only lines in this style. */
const stroke = (d: string, tone: Tone, w = 1): Part => ({ d, line: tone, w });
const tick = (cx: number, cy: number, r: number, tone: Tone = 'sPaper'): Part =>
  stroke(`M${cx - r * 0.45} ${cy}L${cx - r * 0.1} ${cy + r * 0.36}L${cx + r * 0.48} ${cy - r * 0.34}`, tone, r / 9);
const check = (cx: number, cy: number, r: number, base: Tone = 'sGreen', dk: Tone = 'sGreenDk'): Part[] => [...ball(cx, cy, r, base, dk), tick(cx, cy, r)];
const zmark = (x: number, y: number, size: number, tone: Tone): Part => ({ ...mark(x, y, size, tone), line: false });
const cursor = (x: number, y: number): Part =>
  fill(poly(x, y, x, y + 17, x + 4.6, y + 13, x + 7.8, y + 19.6, x + 10.6, y + 18.3, x + 7.5, y + 11.7, x + 13, y + 11.6), 'sInk');
/** A tap ring behind a cursor: something is being pressed. */
const tap = (cx: number, cy: number, tone: Tone = 'sBerry'): Part => fill(circle(cx, cy, 10), tone, { opacity: 0.22 });
/** A person as a shape: a ball with head and shoulders knocked out in paper. No face. */
const person = (cx: number, cy: number, r: number, base: Tone, dk: Tone): Part[] => {
  const d = circle(cx, cy, r);
  return [
    ...ball(cx, cy, r, base, dk),
    fill(circle(cx, cy - r * 0.2, r * 0.34), 'sPaper', { clip: d, opacity: 0.92 }),
    fill(ellipse(cx, cy + r * 0.82, r * 0.64, r * 0.5), 'sPaper', { clip: d, opacity: 0.92 }),
  ];
};
/** A path of travel: a soft stroke with an arrowhead at its end. */
const travel = (d: string, x2: number, y2: number, deg: number, tone: Tone = 'sBerry'): Part[] =>
  [stroke(d, tone, 0.8), stroke(arrowHead(x2, y2, deg, 8), tone, 0.8)];
const star = (cx: number, cy: number, r: number, tone: Tone = 'sAmber'): Part => fill(sparkle(cx, cy, r), tone);
/** A paper sheet with a torn (zigzag) bottom. */
const receipt = (x: number, y: number, w: number, h: number): Part => {
  const teeth = Array.from({ length: Math.floor(w / 12) }, (_, i) => `L${x + w - (i + 0.5) * 12} ${y + h - 7}L${x + w - (i + 1) * 12} ${y + h}`).join('');
  return fill(`M${x + 12} ${y}H${x + w - 12}Q${x + w} ${y} ${x + w} ${y + 12}V${y + h}${teeth}L${x} ${y + h}V${y + 12}Q${x} ${y} ${x + 12} ${y}Z`, 'sPaper');
};
const chain = (x: number, y: number, tone: Tone = 'sBerry'): Part[] => [
  fill(rect(x, y, 22, 14, 7) + rect(x + 4, y + 4, 14, 6, 3), tone, { evenOdd: true }),
  fill(rect(x + 14, y, 22, 14, 7) + rect(x + 18, y + 4, 14, 6, 3), tone, { evenOdd: true }),
];
const lock = (x: number, y: number, open = false): Part[] => [
  stroke(open ? `M${x + 5} ${y}V${y - 7}Q${x + 5} ${y - 14} ${x + 12} ${y - 14}Q${x + 19} ${y - 14} ${x + 19} ${y - 9}` : `M${x + 5} ${y}V${y - 6}Q${x + 5} ${y - 12} ${x + 12} ${y - 12}Q${x + 19} ${y - 12} ${x + 19} ${y - 6}V${y}`, 'sAmberDk', 1),
  ...block(x, y, 24, 20, 6, 'sAmber', 'sAmberDk'),
];

// ── Hero: everything you run, in one calm place ─────────────────────────────
export const hub = S(400, 300, [
  field(400, 300, 'sAmberLt', 26),
  soft(200, 262, 170, 10),
  // docs: the pencil
  ...block(54, 222, 118, 34, 8, 'sCoral', 'sCoralDk'),
  fill(poly(54, 222, 26, 239, 54, 256), 'sBone'), fill(poly(35, 234, 26, 239, 35, 244), 'sInk'),
  // calendar
  ...block(70, 132, 90, 86, 16, 'sBlue', 'sBlueDk'),
  fill(rect(70, 132, 90, 20), 'sBlueDk', { clip: rect(70, 132, 90, 86, 16) }),
  ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(84 + c * 22, 164 + r * 22, 14, 14, 4), r === 1 && c === 1 ? 'sBerry' : 'sPaper'))),
  // focus: the stopwatch on top
  ...ball(114, 98, 30, 'sIndigo', 'sIndigoDk'),
  fill(rect(108, 60, 12, 10, 3), 'sIndigoDk'), fill(circle(114, 98, 20), 'sPaper'), stroke('M114 98L124 88', 'sBerry', 1.1),
  // the center: Zenboard
  ...block(166, 62, 110, 194, 28, 'sBerry', 'sBerryDk'),
  zmark(185, 118, 72, 'sPaper'),
  // chat and tasks, bottom right
  ...block(282, 196, 96, 60, 14, 'sGreen', 'sGreenDk'),
  fill('M300 210H340Q350 210 350 220V232Q350 242 340 242H318L308 250L310 242H300Q290 242 290 232V220Q290 210 300 210Z', 'sPaper'),
  fill(circle(306, 226, 3.2), 'sGreen'), fill(circle(320, 226, 3.2), 'sGreen'), fill(circle(334, 226, 3.2), 'sGreen'),
  // projects: the folder
  fill(rect(288, 122, 38, 18, 6), 'sAmberDk'),
  ...block(282, 130, 96, 62, 14, 'sAmber', 'sAmberDk'),
  zmark(316, 146, 28, 'sPaper'),
  // something needs you
  ...check(330, 92, 22),
  fill(circle(348, 74, 7), 'sCoral'),
  star(146, 50, 12), star(372, 150, 7, 'sPaper'), star(46, 180, 8, 'sPaper'),
]);

// ── Feature scenes ──────────────────────────────────────────────────────────

/** Home — Zenboard lifts the one task that matters first. You press Start. */
const home = S(360, 240, [
  field(360, 240, 'sLavLt'),
  ...ball(296, 60, 28, 'sAmber', 'sAmberDk'),
  star(52, 46, 10), star(322, 196, 7, 'sPaper'),
  soft(186, 216, 110),
  pill(98, 176, 188, 34, 'sPaper'), fill(circle(120, 193, 8), 'sBar'), bar(136, 186, 92), bar(136, 196, 56, 'sBar', 5),
  pill(82, 130, 212, 38, 'sPaper'), ...check(106, 149, 10), bar(124, 142, 104), bar(124, 152, 64, 'sBar', 5),
  soft(170, 122, 112, 7),
  ...block(46, 56, 248, 60, 30, 'sBerry', 'sBerryDk'),
  zmark(62, 69, 34, 'sPaper'),
  bar(108, 76, 104, 'sBerryLt', 8), bar(108, 91, 64, 'sBerryLt', 6),
  fill(circle(260, 86, 18), 'sPaper'), fill(poly(254, 78, 254, 94, 268, 86), 'sBerry'),
  tap(270, 98), cursor(268, 96),
]);

/** Inbox — everything lands in one place, then goes to a project, a date or done in one pass. */
const inbox = S(360, 240, [
  field(360, 240, 'sBlushLt'),
  soft(98, 206, 72),
  ...block(98, 38, 46, 46, 9, 'sAmber', 'sAmberDk').map((p) => ({ ...p, t: 'rotate(12 121 61)' })),
  fill(rect(54, 58, 86, 60, 10), 'sPaper'), fill(poly(54, 62, 97, 94, 140, 62), 'sBone'),
  fill(circle(142, 58, 10), 'sCoral'),
  pill(48, 112, 100, 18, 'sBerryDk'),
  ...block(34, 118, 128, 80, 20, 'sBerry', 'sBerryDk'),
  zmark(82, 140, 34, 'sPaper'),
  ...travel('M166 140Q206 140 222 70', 222, 70, -70),
  ...travel('M166 158H222', 222, 158, 0),
  ...travel('M166 176Q204 176 224 204', 224, 204, 54),
  fill(rect(238, 30, 28, 14, 5), 'sAmberDk'), fill(rect(240, 34, 52, 18, 3), 'sPaper'),
  ...block(230, 40, 76, 54, 12, 'sAmber', 'sAmberDk'),
  ...block(230, 130, 76, 56, 12, 'sBlue', 'sBlueDk'),
  fill(rect(230, 130, 76, 14), 'sBlueDk', { clip: rect(230, 130, 76, 56, 12) }),
  ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(241 + c * 20, 152 + r * 14, 14, 9, 3), 'sPaper'))),
  ...check(268, 212, 22),
]);

/** Projects — work moves across the board. You drag a card to Done. */
const projects = S(360, 240, [
  field(360, 240, 'sLavLt'),
  soft(180, 222, 150, 8),
  panel(26, 26, 308, 190, 22),
  zmark(40, 38, 22, 'sBerry'), bar(70, 46, 70, 'sBar', 8),
  ...person(300, 50, 11, 'sLav', 'sLavDk'), ...person(318, 50, 11, 'sAmber', 'sAmberDk'),
  fill(rect(38, 72, 90, 132, 14), 'sBone'), fill(rect(135, 72, 90, 132, 14), 'sBone'), fill(rect(232, 72, 90, 132, 14), 'sBone'),
  fill(circle(52, 86, 4.5), 'sBar'), bar(62, 83, 40), fill(circle(149, 86, 4.5), 'sAmber'), bar(159, 83, 40), fill(circle(246, 86, 4.5), 'sGreen'), bar(256, 83, 40),
  fill(rect(46, 98, 74, 30, 9), 'sPaper'), bar(54, 106, 52), bar(54, 116, 34, 'sBar', 5),
  fill(rect(46, 134, 74, 30, 9), 'sPaper'), bar(54, 142, 44), bar(54, 152, 30, 'sBar', 5),
  fill(rect(143, 98, 74, 30, 9), 'sPaper'), bar(151, 106, 50), bar(151, 116, 30, 'sBar', 5),
  fill(rect(143, 134, 74, 30, 9), 'sBar', { opacity: 0.55 }),
  fill(rect(143, 170, 74, 28, 9), 'sPaper'),
  fill('M152 176H162L157 184L162 192H152L157 184Z', 'sAmber'), bar(168, 181, 26), ...person(206, 184, 7, 'sLav', 'sLavDk'), fill(circle(212, 176, 4), 'sCoral'),
  fill(rect(240, 98, 74, 30, 9), 'sPaper'), ...check(254, 113, 7), bar(266, 110, 38),
  soft(282, 184, 42, 5),
  ...block(238, 136, 84, 34, 10, 'sBerry', 'sBerryDk').map((p) => ({ ...p, t: 'rotate(-7 280 153)' })),
  { ...zmark(248, 145, 16, 'sPaper'), t: 'rotate(-7 280 153) translate(248 145) scale(0.8)' },
  { ...bar(270, 148, 40, 'sBerryLt', 6), t: 'rotate(-7 280 153)' },
  cursor(304, 156),
]);

/** Client portal — you share the project; your client opens it and reviews what needs them. */
const clientPortal = S(360, 240, [
  field(360, 240, 'sBlushLt'),
  ...person(40, 64, 20, 'sBerry', 'sBerryDk'),
  soft(80, 150, 60, 6),
  pill(18, 98, 128, 40, 'sPaper'), ...chain(30, 111), bar(72, 115, 22),
  pill(100, 106, 38, 24, 'sInk'), bar(108, 115, 22, 'sPaper', 6),
  cursor(126, 120),
  ...travel('M150 118Q178 96 196 104', 196, 104, 24),
  soft(262, 230, 62, 6),
  fill(rect(204, 20, 116, 206, 24), 'sInk'),
  fill(rect(212, 28, 100, 190, 17), 'sPaper'), pill(246, 34, 32, 7, 'sInk'),
  zmark(222, 50, 18, 'sBerry'), bar(246, 55, 50, 'sBar', 8),
  fill(rect(222, 78, 80, 8, 4), 'sBar'), fill(rect(222, 78, 52, 8, 4), 'sBerry'),
  fill(rect(218, 98, 88, 52, 12), 'sLavLt'),
  fill(rect(226, 108, 15, 19, 3), 'sPaper'), bar(248, 110, 44, 'sLavDk', 6),
  pill(248, 126, 50, 16, 'sBerry'), bar(258, 131, 30, 'sPaper', 6),
  tap(286, 136), cursor(284, 134),
  ...check(228, 168, 7), bar(240, 165, 56), ...check(228, 190, 7), bar(240, 187, 44),
  ...person(328, 48, 20, 'sLav', 'sLavDk'),
]);

/** Docs — one line in a brief links straight to the task and the project it is about. */
const docPath = 'M34 38Q34 24 48 24H154L184 54V206Q184 220 170 220H48Q34 220 34 206Z';
const docs = S(360, 240, [
  field(360, 240, 'sLavLt'),
  soft(110, 226, 80, 6),
  fill(docPath, 'sPaper'), fill(circle(208, 250, 96), 'sBone', { clip: docPath }), fill(poly(154, 24, 184, 54, 154, 54), 'sBar'),
  zmark(50, 40, 22, 'sBerry'), bar(80, 46, 56, 'sBar', 8),
  bar(50, 78, 112), bar(50, 92, 98),
  fill(rect(44, 106, 126, 18, 7), 'sBerryLt'), bar(52, 112, 100, 'sBerry', 6),
  bar(50, 136, 112), bar(50, 150, 80),
  fill(rect(50, 164, 118, 40, 9), 'sLav'),
  fill(poly(50, 204, 84, 180, 106, 194, 132, 172, 168, 204), 'sLavDk', { clip: rect(50, 164, 118, 40, 9) }),
  fill(circle(150, 178, 6), 'sAmber'),
  fill(circle(172, 115, 4.5), 'sBerry'),
  ...travel('M176 115Q210 110 222 88', 222, 88, -62),
  soft(280, 102, 60, 5),
  pill(214, 56, 132, 40, 'sPaper'), fill(circle(236, 76, 9), 'sBar'), bar(252, 69, 72, 'sBar', 7),
  pill(252, 81, 46, 10, 'sBerryLt'), zmark(255, 82, 8, 'sBerry'),
  ...travel('M176 115Q206 152 224 168', 224, 168, 42),
  fill(rect(236, 140, 36, 16, 6), 'sAmberDk'),
  ...block(228, 150, 104, 66, 14, 'sAmber', 'sAmberDk'),
  zmark(264, 167, 30, 'sPaper'),
]);

/** Finance — tracked time becomes an invoice, and the payment lands. */
const finance = S(360, 240, [
  field(360, 240, 'sAmberLt'),
  soft(58, 162, 36, 5),
  ...ball(58, 118, 34, 'sBlue', 'sBlueDk'),
  fill(rect(52, 76, 12, 9, 3), 'sBlueDk'), fill(circle(58, 118, 24), 'sPaper'),
  stroke('M58 118L68 106', 'sBerry', 1.1), fill(circle(58, 118, 3), 'sInk'),
  ...travel('M98 118H118', 118, 118, 0),
  soft(180, 218, 60, 6),
  receipt(124, 26, 112, 186),
  zmark(138, 40, 20, 'sBerry'), bar(164, 46, 50, 'sBar', 8),
  ...[0, 1, 2].flatMap((i) => [bar(138, 76 + i * 16, 58), bar(206, 76 + i * 16, 16)]),
  fill(rect(134, 128, 92, 26, 9), 'sBerryLt'), bar(142, 138, 30, 'sBerry', 6), bar(192, 138, 26, 'sBerry', 6),
  pill(178, 168, 48, 20, 'sBerry'), bar(188, 175, 28, 'sPaper', 6),
  tap(214, 182), cursor(212, 180),
  ...travel('M240 118Q252 104 262 106', 262, 106, 10),
  fill(rect(302, 22, 4, 10, 2), 'sAmberDk'), fill(rect(312, 28, 4, 8, 2), 'sAmberDk'), fill(rect(292, 28, 4, 8, 2), 'sAmberDk'),
  ...ball(304, 62, 16, 'sAmber', 'sAmberDk'), fill(circle(304, 62, 8), 'sAmberDk', { opacity: 0.35 }),
  soft(306, 170, 50, 5),
  ...block(262, 94, 90, 62, 14, 'sGreen', 'sGreenDk'),
  fill(rect(274, 106, 18, 14, 4), 'sAmber'), bar(274, 138, 52, 'sPaper', 6), zmark(324, 104, 18, 'sPaper'),
  ...check(340, 160, 14, 'sTeal', 'sTealDk'),
]);

/** One link, no login — copy the link; it opens on your client's phone, no password. */
const shareLink = S(360, 240, [
  field(360, 240, 'sLavLt'),
  star(62, 52, 11),
  soft(62, 176, 46, 6),
  ...block(24, 82, 78, 78, 22, 'sBerry', 'sBerryDk'),
  zmark(39, 97, 48, 'sPaper'),
  fill(rect(100, 116, 12, 8, 4), 'sBerryLt'),
  pill(108, 100, 140, 40, 'sPaper'), ...chain(120, 113), bar(162, 117, 36),
  pill(206, 108, 36, 24, 'sInk'), bar(214, 117, 20, 'sPaper', 6),
  tap(230, 124), cursor(228, 122),
  ...travel('M250 112Q262 96 262 84', 262, 84, -90),
  soft(302, 222, 44, 5),
  fill(rect(264, 30, 78, 180, 20), 'sInk'),
  fill(rect(270, 38, 66, 164, 14), 'sPaper'), pill(292, 43, 22, 6, 'sInk'),
  zmark(278, 56, 14, 'sBerry'), bar(296, 60, 32, 'sBar', 6),
  fill(circle(303, 110, 22), 'sBar'),
  stroke('M303 88A22 22 0 1 1 283 119', 'sBerry', 1.5),
  fill(circle(303, 110, 14), 'sPaper'),
  bar(282, 144, 42), bar(282, 156, 30),
  ...lock(291, 178, true),
]);

/** You choose what they see — your switches decide what reaches your client. */
const visibility = S(360, 240, [
  field(360, 240, 'sBlushLt'),
  soft(96, 224, 76, 6),
  panel(20, 28, 154, 188, 18),
  zmark(34, 42, 18, 'sBerry'), bar(58, 47, 54, 'sBar', 8),
  fill(ellipse(152, 51, 12, 8), 'sLav'), fill(circle(152, 51, 4.5), 'sIndigo'),
  ...([true, true, false] as const).flatMap((on, i): Part[] => {
    const y = 84 + i * 32;
    return [bar(34, y, 72), pill(122, y - 6, 34, 18, on ? 'sBerry' : 'sBar'), fill(circle(on ? 147 : 131, y + 3, 6.5), 'sPaper')];
  }),
  fill(rect(30, 164, 134, 40, 12), 'sBone'),
  bar(40, 176, 40, 'sBar', 5), bar(40, 186, 28, 'sBar', 5),
  ...lock(118, 186),
  ...travel('M162 88Q190 88 206 102', 206, 102, 40),
  ...travel('M162 120Q188 120 206 124', 206, 124, 10),
  stroke('M162 152H176', 'sCoral', 0.8), stroke('M181 146L191 158M191 146L181 158', 'sCoral', 0.9),
  soft(274, 188, 66, 6),
  panel(206, 62, 136, 116, 18),
  ...person(226, 84, 12, 'sLav', 'sLavDk'), bar(244, 80, 64, 'sBar', 8),
  ...check(224, 114, 7), bar(236, 111, 72),
  ...check(224, 138, 7), bar(236, 135, 56),
  ...person(328, 200, 18, 'sLav', 'sLavDk'),
]);

/** Requests become tasks — a request travels from your client into your tasks, and back as done. */
const requests = S(360, 240, [
  field(360, 240, 'sLavLt'),
  ...person(56, 174, 28, 'sLav', 'sLavDk'),
  soft(86, 108, 62, 5),
  pill(24, 58, 124, 44, 'sPaper'), ...person(46, 80, 11, 'sLav', 'sLavDk'),
  bar(64, 72, 62, 'sBar', 7), bar(64, 84, 42, 'sBar', 5),
  fill(circle(144, 60, 10), 'sCoral'), fill(rect(142.5, 54, 3, 7, 1.5), 'sPaper'), fill(circle(144, 64.5, 1.6), 'sPaper'),
  ...travel('M150 80Q190 64 210 104', 210, 104, 62),
  bar(144, 118, 16, 'sLavDk', 4), bar(140, 126, 22, 'sLavDk', 4),
  soft(196, 140, 34, 4),
  { ...pill(166, 108, 66, 24, 'sPaper'), t: 'rotate(-10 199 120)' },
  { ...bar(176, 117, 40, 'sBar', 6), t: 'rotate(-10 199 120)' },
  soft(282, 218, 62, 5),
  panel(214, 110, 134, 102, 18),
  zmark(226, 122, 18, 'sBerry'), bar(250, 127, 50, 'sBar', 8), ...person(330, 131, 9, 'sBerry', 'sBerryDk'),
  pill(222, 146, 118, 30, 'sBerryLt'), fill(circle(237, 161, 7), 'sPaper'), bar(250, 158, 38, 'sBerry', 6),
  pill(296, 153, 36, 16, 'sBerry'), bar(304, 158, 20, 'sPaper', 6),
  tap(320, 164), cursor(318, 162),
  ...check(236, 194, 7), bar(248, 191, 64),
  ...travel('M216 214Q160 232 100 214', 100, 214, 196, 'sGreen'),
  ...check(158, 224, 10),
]);

/** Approvals, on the record — the plan moves toward approval; your client signs off. */
const approvals = S(360, 240, [
  field(360, 240, 'sLavLt'),
  bar(14, 96, 16, 'sLavDk', 5), bar(8, 108, 22, 'sLavDk', 5), bar(16, 120, 14, 'sLavDk', 5),
  soft(96, 214, 64, 6),
  ...[
    fill(rect(42, 42, 112, 156, 14), 'sBar'),
    fill(rect(36, 36, 112, 156, 14), 'sPaper'),
    zmark(50, 50, 18, 'sBerry'), bar(74, 55, 50, 'sBar', 8),
    pill(50, 78, 22, 10, 'sBar'), pill(76, 78, 22, 10, 'sBar'), pill(102, 78, 22, 10, 'sBerry'),
    bar(50, 104, 84), bar(50, 118, 84), bar(50, 132, 60),
    stroke('M52 166Q60 154 68 166T84 164Q92 158 98 168T118 162', 'sIndigo', 0.8),
  ].map((p) => ({ ...p, t: `rotate(-6 92 114)${p.t ? ` ${p.t}` : ''}` })),
  ...travel('M160 112Q192 92 212 112', 212, 112, 45),
  soft(262, 188, 50, 6),
  fill(gear(262, 124, 52, 45, 18), 'sGreenDk'),
  ...ball(262, 124, 40, 'sGreen', 'sGreenDk'),
  tick(262, 124, 30),
  ...person(318, 44, 16, 'sLav', 'sLavDk'),
  pill(282, 68, 64, 20, 'sBerry'), bar(294, 75, 40, 'sPaper', 6),
  tap(330, 80), cursor(328, 78),
]);

/** Invoices, next to the work — created, sent, and paid. */
const invoices = S(360, 240, [
  field(360, 240, 'sBlushLt'),
  soft(72, 214, 54, 6),
  receipt(20, 34, 104, 172),
  zmark(32, 46, 18, 'sBerry'), bar(56, 51, 44, 'sBar', 8),
  ...[0, 1, 2].flatMap((i) => [bar(32, 80 + i * 15, 50), bar(94, 80 + i * 15, 16)]),
  fill(rect(28, 128, 88, 24, 8), 'sBerryLt'), bar(36, 137, 26, 'sBerry', 6), bar(84, 137, 24, 'sBerry', 6),
  ...travel('M128 108Q140 80 150 78', 150, 78, -10),
  bar(134, 104, 14, 'sBerryLt', 4), bar(130, 112, 20, 'sBerryLt', 4),
  soft(192, 140, 40, 5),
  ...[
    ...block(154, 58, 82, 58, 10, 'sBerry', 'sBerryDk'),
    fill(poly(154, 60, 195, 92, 236, 60), 'sPink'),
    fill(circle(195, 92, 13), 'sPaper'),
    zmark(187, 84, 16, 'sBerry'),
  ].map((p) => ({ ...p, t: `rotate(-8 195 87)${p.t ? ` ${p.t}` : ''}` })),
  ...travel('M238 96Q246 104 248 110', 248, 110, 70),
  soft(298, 214, 54, 6),
  panel(248, 66, 100, 132, 18),
  ...person(268, 88, 12, 'sLav', 'sLavDk'), bar(286, 84, 46, 'sBar', 8),
  bar(262, 112, 72), bar(262, 124, 50),
  pill(256, 150, 84, 30, 'sGreen'), tick(274, 165, 12), bar(290, 162, 38, 'sPaper', 6),
  ...ball(250, 200, 14, 'sAmber', 'sAmberDk'),
]);

export const SHAPE_HERO = { hub } satisfies Record<string, Art>;
export const SHAPE_SCENES = {
  home, inbox, projects, clientPortal, docs, finance,
  shareLink, visibility, requests, approvals, invoices,
} satisfies Record<string, Art>;
export type ShapeSceneName = keyof typeof SHAPE_SCENES;

// ── Icons: the same blocks, on a round field ────────────────────────────────
const icon = (bg: Tone, parts: Part[]): Art => S(96, 96, [fill(circle(48, 48, 46), bg), ...parts]);

export const SHAPE_ICONS = {
  home: icon('sLavLt', [
    ...block(14, 30, 68, 30, 15, 'sBerry', 'sBerryDk'), zmark(21, 37, 16, 'sPaper'), fill(circle(68, 45, 8), 'sPaper'),
    fill(poly(65.5, 41, 65.5, 49, 72, 45), 'sBerry'), pill(22, 66, 52, 11, 'sPaper'),
  ]),
  inbox: icon('sBlushLt', [
    fill(rect(28, 18, 40, 28, 5), 'sPaper'), fill(poly(28, 20, 48, 36, 68, 20), 'sBone'),
    pill(24, 42, 48, 10, 'sBerryDk'), ...block(18, 46, 60, 34, 11, 'sBerry', 'sBerryDk'), zmark(39, 54, 18, 'sPaper'),
    fill(circle(70, 20, 7), 'sCoral'),
  ]),
  tasks: icon('sLavLt', [...block(24, 24, 48, 48, 14, 'sGreen', 'sGreenDk'), tick(48, 48, 22)]),
  calendar: icon('sBlushLt', [
    ...block(20, 24, 56, 50, 11, 'sBlue', 'sBlueDk'), fill(rect(20, 24, 56, 13), 'sBlueDk', { clip: rect(20, 24, 56, 50, 11) }),
    ...[0, 1, 2].flatMap((c) => [0, 1].map((r): Part => fill(rect(28 + c * 14, 44 + r * 12, 10, 8, 2.5), r === 1 && c === 2 ? 'sBerry' : 'sPaper'))),
  ]),
  focus: icon('sLavLt', [
    ...ball(48, 52, 26, 'sIndigo', 'sIndigoDk'), fill(rect(43, 18, 10, 8, 2.5), 'sIndigoDk'),
    fill(circle(48, 52, 17), 'sPaper'), stroke('M48 52L56 44', 'sBerry', 1), fill(circle(48, 52, 2.4), 'sInk'),
  ]),
  goals: icon('sAmberLt', [
    fill(rect(18, 58, 20, 20, 4), 'sLav'), fill(rect(38, 46, 20, 32, 4), 'sAmber'), ...block(58, 34, 20, 44, 4, 'sBerry', 'sBerryDk'),
    stroke('M68 34V14', 'sInk', 0.7), fill('M68 14H82L78 19.5L82 25H68Z', 'sGreen'),
  ]),
  habits: icon('sLavLt', [
    stroke('M48 80V54', 'sGreenDk', 1), fill('M47 70Q34 70 30 60Q42 57 47 66Z', 'sGreen'), fill('M49 66Q62 66 66 56Q54 53 49 62Z', 'sGreen'),
    ...Array.from({ length: 5 }, (_, i): Part => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return fill(circle(48 + 12 * Math.cos(a), 36 + 12 * Math.sin(a), 9), 'sPink');
    }),
    fill(circle(48, 36, 7), 'sAmber'),
  ]),
  projects: icon('sLavLt', [
    fill(rect(22, 26, 24, 12, 4), 'sAmberDk'), fill(rect(26, 30, 44, 14, 3), 'sPaper'),
    ...block(18, 34, 60, 42, 10, 'sAmber', 'sAmberDk'), zmark(39, 45, 18, 'sPaper'),
  ]),
  docs: icon('sBlushLt', [
    fill('M28 22Q28 16 34 16H58L70 28V74Q70 80 64 80H34Q28 80 28 74Z', 'sPaper'), fill(poly(58, 16, 70, 28, 58, 28), 'sBar'),
    zmark(35, 24, 12, 'sBerry'), bar(35, 42, 28), fill(rect(33, 51, 32, 9, 3.5), 'sBerryLt'), bar(36, 53.5, 24, 'sBerry', 4), bar(35, 66, 22),
  ]),
  clientPortal: icon('sLavLt', [
    fill(rect(30, 14, 36, 68, 10), 'sInk'), fill(rect(34, 18, 28, 60, 7), 'sPaper'),
    zmark(40, 26, 16, 'sBerry'), bar(38, 50, 20), pill(38, 60, 20, 9, 'sBerry'), ...person(70, 70, 12, 'sLav', 'sLavDk'),
  ]),
  clients: icon('sBlushLt', [...person(36, 50, 20, 'sAmber', 'sAmberDk'), ...person(60, 50, 20, 'sLav', 'sLavDk')]),
  forms: icon('sLavLt', [
    ...block(24, 18, 48, 62, 9, 'sAmberDk', 'sAmberDk'), fill(rect(30, 26, 36, 48, 4), 'sPaper'), pill(38, 14, 20, 10, 'sBerry'),
    ...check(38, 38, 5), bar(46, 35, 16, 'sBar', 5), fill(circle(38, 52, 5), 'sBar'), bar(46, 49, 14, 'sBar', 5), fill(circle(38, 64, 5), 'sBar'), bar(46, 61, 12, 'sBar', 5),
  ]),
  finance: icon('sAmberLt', [
    ...block(14, 36, 56, 38, 9, 'sGreen', 'sGreenDk'), fill(rect(22, 44, 12, 9, 3), 'sAmber'), bar(22, 62, 32, 'sPaper', 5),
    ...ball(66, 34, 15, 'sAmber', 'sAmberDk'),
  ]),
  visibility: icon('sBlushLt', [
    fill('M14 48Q48 16 82 48Q48 80 14 48Z', 'sPaper'), ...ball(48, 48, 14, 'sBerry', 'sBerryDk'), fill(circle(48, 48, 5.5), 'sInk'),
  ]),
  requests: icon('sLavLt', [
    pill(14, 24, 62, 22, 'sPaper'), fill(circle(26, 35, 6), 'sLav'), bar(36, 32, 30), fill(circle(74, 26, 6), 'sCoral'),
    pill(22, 52, 62, 22, 'sPaper'), ...check(34, 63, 6), bar(44, 60, 30),
  ]),
  approvals: icon('sBlushLt', [fill(gear(48, 48, 32, 27, 14), 'sGreenDk'), ...ball(48, 48, 24, 'sGreen', 'sGreenDk'), tick(48, 48, 18)]),
  invoices: icon('sLavLt', [
    ...block(16, 28, 64, 44, 9, 'sBerry', 'sBerryDk'), fill(poly(16, 30, 48, 54, 80, 30), 'sPink'),
    fill(circle(48, 54, 10), 'sPaper'), zmark(42, 48, 12, 'sBerry'),
  ]),
  ai: icon('sBlushLt', [
    ...block(16, 22, 62, 44, 14, 'sBerry', 'sBerryDk'), fill(poly(28, 64, 24, 78, 42, 64), 'sBerryDk'),
    star(46, 44, 12, 'sAmber'), star(64, 32, 5, 'sPaper'),
  ]),
} satisfies Record<string, Art>;
export type ShapeIconName = keyof typeof SHAPE_ICONS;
