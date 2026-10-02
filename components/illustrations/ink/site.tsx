// Zen Ink · Site — the zenboard.life feature illustrations. Each one is built
// around the ACTION Zenboard helps with ("what is Zenboard helping the user do
// here?"), told with 2–3 story elements, left → right. The Zenboard mark sits
// on the product objects it would really appear on (cards, invoices, screens,
// tiles). Render inside `.ill-brand` for the brand palette. 360×240.
import {
  type Art, type Part, type Tone, rect, circle, ellipse, poly, polyline, sparkle, gear, ground, place,
  mark, dashed, arrowHead,
} from './kit';
import { inbox as inboxSpot, folder, calendar as calendarSpot } from './spots';

const W = 360;
const H = 240;
const art = (parts: Part[]): Art => ({ w: W, h: H, parts });
const detail = (d: string, w = 0.7): Part => ({ d, w });
const tinted = (d: string, tone: Tone, w = 0.7): Part => ({ d, w, line: tone });

// ── Shared vocabulary: every illustration draws from these, so the whole set
//    keeps one line weight, one corner treatment, one depth, one cursor. ─────
/** A surface with depth: a pigment edge offset down-right, the face on top. */
const slab = (x: number, y: number, w: number, h: number, face: Tone = 'paper', edge: Tone = 'cream', r = 8, dep = 5): Part[] => [
  { d: rect(x + dep, y + dep, w, h, r), fill: edge },
  { d: rect(x, y, w, h, r), fill: face },
];
const card = (x: number, y: number, w: number, h: number, fill: Tone = 'paper', r = 6): Part => ({ d: rect(x, y, w, h, r), fill });
/** Text as ink lines: n lines, the last one shorter. */
const lines = (x: number, y: number, w: number, n: number, gap = 9, weight = 0.6): Part[] =>
  Array.from({ length: n }, (_, i) => detail(`M${x} ${y + i * gap}H${x + (i === n - 1 && n > 1 ? w * 0.6 : w)}`, weight));
const title = (x: number, y: number, w: number): Part => detail(`M${x} ${y}H${x + w}`, 1.15);
const checkbox = (x: number, y: number, done = false): Part[] => [
  { d: rect(x, y, 11, 11, 3), fill: done ? 'teal' : 'paper', w: 0.75 },
  ...(done ? [tinted(polyline(x + 2.5, y + 5.5, x + 5, y + 8, x + 9, y + 3), 'paper', 0.9)] : []),
];
const pill = (x: number, y: number, w: number, tone: Tone, h = 10): Part => ({ d: rect(x, y, w, h, h / 2), fill: tone, w: 0.6 });
/** A button: a pill with its label as a paper line. */
const button = (x: number, y: number, w: number, tone: Tone = 'violet'): Part[] => [
  { d: rect(x, y, w, 14, 7), fill: tone, w: 0.7 },
  tinted(`M${x + 8} ${y + 7}H${x + w - 8}`, 'paper', 0.9),
];
const toggle = (x: number, y: number, on: boolean): Part[] => [
  { d: rect(x, y, 24, 13, 6.5), fill: on ? 'violet' : 'cream', w: 0.75 },
  { d: circle(on ? x + 17.5 : x + 6.5, y + 6.5, 4.2), fill: 'paper', w: 0.55 },
];
/** The pointer: where the person is acting. */
const cursor = (x: number, y: number): Part =>
  ({ d: poly(x, y, x, y + 16, x + 4.4, y + 12.2, x + 7.4, y + 18.6, x + 10, y + 17.4, x + 7.1, y + 11.1, x + 12.4, y + 11), fill: 'paper', w: 0.75 });
const notif = (x: number, y: number): Part => ({ d: circle(x, y, 4), fill: 'tomato', w: 0.6 });
const avatar = (cx: number, cy: number, tone: Tone, r = 9): Part[] => [
  { d: circle(cx, cy, r), fill: tone, w: 0.75 },
  { d: circle(cx, cy - r * 0.18, r * 0.36), fill: 'paper', w: 0.45 },
  { d: `M${cx - r * 0.6} ${cy + r * 0.7}Q${cx} ${cy + r * 0.08} ${cx + r * 0.6} ${cy + r * 0.7}`, fill: 'paper', w: 0.45 },
];
/** A person, shoulders up, standing on the ground line `base`. */
const person = (cx: number, base: number, body: Tone, hair: Tone = 'brick'): Part[] => [
  ground(cx, base + 4, 24),
  { d: `M${cx - 19} ${base}Q${cx - 19} ${base - 26} ${cx} ${base - 26}Q${cx + 19} ${base - 26} ${cx + 19} ${base}Z`, fill: body },
  { d: circle(cx, base - 38, 11), fill: 'marigold' },
  { d: `M${cx - 11} ${base - 39}Q${cx - 10} ${base - 51} ${cx} ${base - 51}Q${cx + 11} ${base - 51} ${cx + 11} ${base - 40}Q${cx + 4} ${base - 46} ${cx - 3} ${base - 45}Q${cx - 8} ${base - 44} ${cx - 11} ${base - 39}Z`, fill: hair, w: 0.8 },
];
/** "Moves to": a dashed curve with an arrowhead. */
const flow = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): Part[] => [
  detail(dashed(x1, y1, cx, cy, x2, y2), 0.7),
  detail(arrowHead(x2, y2, (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI), 0.75),
];
/** Motion lines trailing an object moving right. */
const motion = (x: number, y: number): Part[] => [
  detail(`M${x} ${y}H${x - 12}`, 0.6), detail(`M${x - 2} ${y + 7}H${x - 16}`, 0.6), detail(`M${x} ${y + 14}H${x - 10}`, 0.6),
];
const coin = (cx: number, cy: number, r = 11): Part[] => [
  { d: ellipse(cx + 2.2, cy + 2.6, r, r * 0.42), fill: 'orange' },
  { d: ellipse(cx, cy, r, r * 0.42), fill: 'marigold' },
];
const doneBadge = (cx: number, cy: number, r = 14): Part[] => [
  { d: circle(cx, cy, r), fill: 'teal' },
  tinted(polyline(cx - r * 0.42, cy, cx - r * 0.1, cy + r * 0.34, cx + r * 0.45, cy - r * 0.34), 'paper', 1.4),
];
/** A torn-bottom invoice: the Zenboard mark heads it, a total is highlighted. */
function invoicePaper(x: number, y: number, w: number, h: number, withButton = false): Part[] {
  const teeth = Array.from({ length: Math.floor(w / 10) }, (_, i) => `L${x + w - (i + 0.5) * 10} ${y + h - 6}L${x + w - (i + 1) * 10} ${y + h}`).join('');
  return [
    { d: `M${x} ${y}H${x + w}V${y + h}${teeth}L${x} ${y + h}Z`, fill: 'paper' },
    mark(x + 10, y + 10, 12),
    title(x + 28, y + 16, w * 0.34),
    detail(`M${x + w - 34} ${y + 16}H${x + w - 12}`, 0.6),
    ...[0, 1, 2].flatMap((i) => [detail(`M${x + 12} ${y + 38 + i * 12}H${x + w * 0.62}`, 0.55), detail(`M${x + w - 30} ${y + 38 + i * 12}H${x + w - 12}`, 0.8)]),
    { d: rect(x + 8, y + 76, w - 16, 20, 5), fill: 'lilac', w: 0.7 },
    detail(`M${x + 16} ${y + 86}H${x + 40}`, 0.9), detail(`M${x + w - 42} ${y + 86}H${x + w - 16}`, 1.4),
    ...(withButton ? button(x + w - 50, y + 104, 38) : []),
  ];
}
const sunRays = (cx: number, cy: number, r1: number, r2: number): Part =>
  detail(Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `M${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}L${(cx + r2 * Math.cos(a)).toFixed(1)} ${(cy + r2 * Math.sin(a)).toFixed(1)}`;
  }).join(''), 0.8);

// ── Hub feature cards ───────────────────────────────────────────────────────

/** Home — Zenboard puts the one thing that matters first; you press Start. */
export const home = art([
  ground(176, 218, 118),
  { d: circle(310, 44, 15), fill: 'marigold' }, sunRays(310, 44, 20, 26),
  ...slab(78, 34, 192, 166, 'paper', 'cream', 10, 6),
  mark(92, 47, 13), title(112, 54, 44), pill(228, 49, 30, 'cream'),
  ...checkbox(92, 74, true), detail('M110 79.5H210', 0.55),
  // the one thing, lifted by Zenboard
  ...slab(62, 98, 226, 46, 'lilac', 'violet', 10, 5),
  mark(74, 110, 20),
  title(104, 114, 88), ...lines(104, 126, 60, 1),
  { d: rect(214, 112, 58, 18, 9), fill: 'violet', w: 0.7 },
  { d: poly(224, 116.5, 224, 125.5, 231, 121), fill: 'paper', line: false },
  tinted('M237 121H262', 'paper', 0.9),
  cursor(256, 124),
  ...checkbox(92, 158), detail('M110 163.5H196', 0.55), pill(230, 158, 26, 'cream'),
  ...checkbox(92, 178), detail('M110 183.5H176', 0.55), pill(230, 178, 26, 'cream'),
  ...[0, 1].map((i): Part => detail(`M${303 + i * 9} ${146}Q${299 + i * 9} ${140} ${303 + i * 9} ${134}`, 0.6)),
  ground(310, 186, 16),
  detail('M322 156Q331 156 331 163Q331 170 322 170', 1),
  { d: rect(298, 150, 24, 28, 5), fill: 'cream' },
]);

/** Inbox — everything arrives in one place, then goes where it belongs in one pass. */
export const inbox = art([
  // arrivals
  { d: rect(16, 34, 40, 26, 3), fill: 'paper', t: 'rotate(-10 36 47)' },
  { d: polyline(16, 35, 36, 49, 56, 35), w: 0.6, t: 'rotate(-10 36 47)' },
  { d: rect(20, 96, 30, 30, 2), fill: 'marigold', t: 'rotate(-6 35 111)' },
  { ...lines(25, 106, 18, 2, 7)[0], t: 'rotate(-6 35 111)' }, { ...lines(25, 113, 12, 1)[0], t: 'rotate(-6 35 111)' },
  card(14, 158, 42, 30, 'paper', 4), { d: 'M14 166V162Q14 158 18 158H52Q56 158 56 162V166Z', fill: 'periwinkle', line: false }, ...lines(20, 175, 28, 2, 6),
  ...flow(62, 52, 90, 60, 116, 88), ...flow(58, 112, 86, 110, 112, 116), ...flow(62, 170, 90, 164, 114, 144),
  // one place
  ...place(inboxSpot, 102, 50, 1.42),
  mark(162, 131, 17, 'paper'),
  notif(216, 108),
  // filed in one pass
  ...flow(222, 102, 252, 64, 284, 48),
  ...place(folder, 276, 8, 0.64, { ground: false }),
  ...flow(226, 116, 258, 108, 288, 110),
  ...place(calendarSpot, 282, 82, 0.6, { ground: false }),
  ...flow(222, 132, 256, 180, 292, 186),
  ...doneBadge(308, 186, 15),
]);

/** Projects — work moves across the board; you drag a card to Done. */
export const projects = art([
  ground(180, 222, 142),
  ...slab(30, 34, 294, 172, 'cream', 'brick', 10, 5),
  mark(44, 45, 12), title(62, 51, 50),
  ...avatar(288, 51, 'periwinkle', 6.5), ...avatar(302, 51, 'marigold', 6.5),
  detail('M128 66V198', 0.55), detail('M226 66V198', 0.55),
  { d: circle(44, 76, 3.5), fill: 'paper', w: 0.5 }, detail('M52 76H84', 0.6),
  { d: circle(142, 76, 3.5), fill: 'marigold', w: 0.5 }, detail('M150 76H178', 0.6),
  { d: circle(240, 76, 3.5), fill: 'teal', w: 0.5 }, detail('M248 76H272', 0.6),
  card(40, 86, 78, 30), ...lines(48, 97, 58, 2, 8),
  card(40, 124, 78, 30), ...lines(48, 135, 50, 2, 8),
  card(138, 86, 78, 30), ...lines(146, 97, 56, 2, 8),
  // waiting on the client
  card(138, 162, 78, 32), { d: 'M146 170H156L151 177L156 184H146L151 177Z', fill: 'marigold', w: 0.6 }, ...lines(162, 174, 26, 2, 8),
  ...avatar(203, 178, 'periwinkle', 6.5), notif(209, 171),
  // the empty slot the card came from
  detail(dashed(138, 124, 177, 124, 216, 124, 4, 3) + dashed(216, 124, 216, 139, 216, 154, 4, 3) + dashed(216, 154, 177, 154, 138, 154, 4, 3) + dashed(138, 154, 138, 139, 138, 124, 4, 3), 0.5),
  card(236, 86, 78, 30), ...checkbox(244, 95.5, true), ...lines(261, 101, 44, 1),
  // the drag
  ...motion(236, 128),
  { d: ellipse(282, 166, 38, 5), fill: 'shadow', ground: true, line: false },
  ...slab(242, 118, 80, 32, 'paper', 'lilac', 6, 4).map((p) => ({ ...p, t: 'rotate(6 282 134)' })),
  { ...checkbox(250, 128, true)[0], t: 'rotate(6 282 134)' },
  { ...lines(267, 133, 42, 1)[0], t: 'rotate(6 282 134)' },
  cursor(300, 136),
]);

/** Client portal — you share the project; your client opens it and reviews. */
export const clientPortal = art([
  ...person(58, 202, 'violet'),
  ...slab(18, 66, 88, 24, 'paper', 'cream', 12, 4),
  { d: rect(26, 73, 14, 10, 5) + rect(29, 76, 8, 4, 2), fill: 'violet', evenOdd: true, w: 0.6 },
  detail('M46 78H78', 0.55), ...button(80, 71, 20, 'violet'),
  ...flow(108, 76, 124, 60, 140, 70),
  // the client's view
  ...slab(142, 30, 190, 176, 'paper', 'cream', 10, 6),
  { d: 'M142 52V40Q142 30 152 30H322Q332 30 332 40V52Z', fill: 'cream' },
  { d: circle(154, 41, 2.6), fill: 'tomato', w: 0.4 }, { d: circle(163, 41, 2.6), fill: 'marigold', w: 0.4 }, { d: circle(172, 41, 2.6), fill: 'teal', w: 0.4 },
  pill(186, 36, 124, 'paper', 11), mark(190, 37.5, 8), detail('M202 41.5H280', 0.5),
  mark(156, 64, 14), title(176, 70, 72), pill(256, 65, 30, 'teal'),
  { d: rect(156, 86, 160, 7, 3.5), fill: 'cream', w: 0.55 }, { d: rect(156, 86, 102, 7, 3.5), fill: 'violet', w: 0.55 },
  // what needs them
  { d: rect(154, 104, 164, 34, 7), fill: 'lilac', w: 0.8 },
  { d: 'M164 112H174L178 116V130H164Z', fill: 'paper', w: 0.6 }, title(184, 117, 44), ...lines(184, 127, 30, 1),
  ...button(270, 114, 40, 'violet'), cursor(296, 122),
  ...checkbox(156, 150, true), detail('M173 155.5H250', 0.55), detail('M296 155.5H314', 0.55),
  ...checkbox(156, 168, true), detail('M173 173.5H236', 0.55), detail('M296 173.5H314', 0.55),
  { d: rect(220, 186, 96, 16, 8), fill: 'periwinkle', w: 0.7 }, ...avatar(229, 194, 'marigold', 5.5), tinted('M239 194H306', 'paper', 0.7),
]);

/** Docs — a brief that links straight to the work it is about. */
export const docs = art([
  ground(126, 218, 96),
  { d: rect(58, 40, 130, 164, 6), fill: 'lilac', t: 'rotate(5 123 122)' },
  { d: 'M44 30H154L178 54V194Q178 200 172 200H50Q44 200 44 194Z', fill: 'paper' },
  { d: poly(154, 30, 178, 54, 154, 54), fill: 'cream' },
  { d: rect(92, 22, 44, 12, 1.5), fill: 'periwinkle', line: false, t: 'rotate(-5 114 28)' },
  mark(58, 46, 13), title(78, 52, 58),
  ...lines(58, 76, 104, 2, 10),
  // the linked line
  { d: rect(55, 92, 96, 14, 3), fill: 'lilac', line: false },
  detail('M58 99H146', 0.9), tinted('M58 104H146', 'violet', 0.8),
  cursor(146, 100),
  ...lines(58, 124, 104, 3, 10),
  { d: rect(58, 158, 104, 28, 4), fill: 'teal', w: 0.6 },
  { d: 'M58 184L80 168L94 178L112 164L162 184V186H58Z', fill: 'tealDeep', line: false },
  ...flow(166, 99, 206, 70, 234, 76),
  ...slab(236, 58, 104, 40, 'paper', 'cream', 7, 4),
  ...checkbox(246, 67), title(263, 72.5, 50),
  pill(263, 81, 42, 'lilac', 9), mark(266, 81.5, 8), detail('M277 85.5H300', 0.5),
  ...flow(166, 140, 210, 166, 246, 170),
  ...place(folder, 238, 116, 0.8),
]);

/** Finance — tracked time becomes an invoice, and the payment lands. */
export const finance = art([
  // tracked time
  ...slab(14, 72, 86, 62, 'paper', 'cream', 8, 4),
  { d: circle(38, 103, 13), fill: 'periwinkle' }, { d: circle(38, 103, 9), fill: 'paper', w: 0.6 },
  { d: rect(35, 86, 6, 4, 1.5), fill: 'violet', w: 0.5 }, tinted('M38 103L43 98', 'violet', 0.9),
  title(58, 98, 30), ...lines(58, 108, 24, 1),
  ...flow(102, 100, 118, 80, 132, 88),
  // the invoice
  ground(186, 206, 56),
  ...invoicePaper(134, 38, 104, 160, true),
  cursor(222, 150),
  ...flow(240, 118, 254, 96, 270, 104),
  // paid
  ...slab(262, 96, 84, 58, 'teal', 'tealDeep', 9, 4),
  { d: rect(272, 106, 16, 12, 3), fill: 'marigold', w: 0.6 }, tinted('M272 140H322', 'paper', 0.8), tinted('M272 130H300', 'paper', 0.6),
  mark(316, 104, 16, 'paper'),
  ...coin(304, 74, 12),
  detail('M296 56V64M304 52V62M312 56V64', 0.6),
  ...doneBadge(336, 160, 13),
]);

// ── Client portal section ───────────────────────────────────────────────────

/** One link, no login — you copy a link; your client opens the project, no password. */
export const shareLink = art([
  ground(54, 170, 34),
  ...slab(22, 84, 64, 64, 'violet', 'tomato', 16, 5),
  { ...mark(36, 98, 36, 'paper'), fill: undefined, line: 'paper', w: 0.9 },
  ...slab(100, 98, 128, 34, 'paper', 'cream', 17, 4),
  { d: rect(110, 108, 16, 12, 6) + rect(113.5, 111.5, 9, 5, 2.5), fill: 'violet', evenOdd: true, w: 0.6 },
  detail('M132 115H176', 0.55),
  ...button(182, 108, 38, 'ink'),
  cursor(206, 116),
  detail('M88 116H100', 0.8),
  ...flow(230, 112, 246, 88, 260, 96),
  // the client's phone
  ground(300, 214, 40),
  ...slab(262, 44, 76, 162, 'paper', 'cream', 13, 5),
  { d: rect(288, 50, 24, 5, 2.5), fill: 'ink', line: false },
  mark(272, 66, 12), title(290, 72, 36),
  { d: circle(300, 112, 20), fill: 'cream' },
  { d: 'M300 92A20 20 0 1 1 282 121', w: 1.5, line: 'violet' },
  ...lines(274, 146, 52, 3, 10),
  // no password: the lock is open
  { d: rect(290, 180, 20, 16, 3), fill: 'brick', w: 0.8 },
  detail('M294 180V174Q294 168 300 168Q306 168 306 174', 0.9),
]);

/** You choose what they see — switches on your side decide what reaches your client. */
export const visibility = art([
  // your controls
  ...slab(16, 38, 146, 164, 'paper', 'cream', 9, 5),
  mark(28, 50, 12), title(46, 56, 64), { d: circle(146, 55, 5), fill: 'violet', w: 0.5 }, { d: circle(146, 55, 2), fill: 'ink', line: false },
  ...([true, true, false, true] as const).flatMap((on, i) => [
    ...lines(28, 84 + i * 28, 62, 1),
    ...toggle(126, 77 + i * 28, on),
  ]),
  // what stays with you
  { d: rect(24, 158, 130, 36, 6), fill: 'cream', w: 0.5 },
  detail(Array.from({ length: 24 }, (_, i) => `M${28 + i * 5} 190L${34 + i * 5} 162`).join(''), 0.3),
  { d: rect(80, 168, 16, 13, 3), fill: 'brick', w: 0.7 }, detail('M84 168V164Q84 159 88 159Q92 159 92 164V168', 0.8),
  // what crosses over
  ...flow(154, 84, 186, 80, 216, 86),
  ...flow(154, 112, 186, 112, 216, 112),
  ...flow(154, 168, 188, 150, 216, 140),
  detail('M154 140Q170 140 176 140', 0.6), detail('M176 134L186 146M186 134L176 146', 0.9),
  // your client's view
  ground(280, 204, 58),
  ...slab(218, 60, 122, 112, 'paper', 'cream', 9, 5),
  ...avatar(234, 76, 'periwinkle', 8), title(248, 76, 50),
  ...[0, 1, 2].flatMap((i) => [...checkbox(230, 94 + i * 22, true), ...lines(248, 99.5 + i * 22, 70 - i * 12, 1)]),
]);

/** Requests become tasks — a request travels from your client into your tasks. */
export const requests = art([
  ...person(46, 204, 'periwinkle', 'ink'),
  ...slab(14, 58, 104, 58, 'lilac', 'violet', 12, 4),
  { d: poly(36, 116, 30, 132, 50, 116), fill: 'lilac', w: 0.8 },
  title(26, 74, 58), ...lines(26, 86, 80, 2, 10),
  // in transit
  ...flow(122, 76, 160, 40, 200, 74),
  { d: rect(146, 38, 42, 26, 4), fill: 'paper', t: 'rotate(10 167 51)' },
  { ...title(153, 48, 22), t: 'rotate(10 167 51)' }, { ...lines(153, 56, 26, 1)[0], t: 'rotate(10 167 51)' },
  ...motion(146, 44),
  // your tasks
  ...slab(196, 74, 146, 118, 'paper', 'cream', 9, 5),
  mark(208, 86, 12), title(226, 92, 50), ...avatar(326, 90, 'marigold', 7),
  { d: rect(204, 106, 130, 30, 7), fill: 'lilac', w: 0.8 },
  ...checkbox(212, 115.5), title(230, 118, 44), ...lines(230, 128, 30, 1),
  ...button(290, 114, 36, 'violet'), cursor(310, 121),
  ...checkbox(212, 148, true), detail('M230 153.5H300', 0.55),
  ...checkbox(212, 168, true), detail('M230 173.5H284', 0.55),
  // they watch it move to done
  ...flow(214, 200, 150, 226, 82, 196),
  ...doneBadge(150, 212, 10),
]);

/** Approvals, on the record — the plan goes out for sign-off and comes back approved. */
export const approvals = art([
  ground(104, 214, 70),
  { d: rect(52, 44, 110, 150, 6), fill: 'cream', t: 'rotate(-6 107 119)' },
  { d: rect(48, 40, 110, 152, 6), fill: 'paper', t: 'rotate(-2 103 116)' },
  mark(60, 52, 13), title(80, 58, 50),
  pill(60, 72, 18, 'cream'), pill(82, 72, 18, 'cream'), pill(104, 72, 18, 'violet'),
  ...lines(60, 98, 84, 4, 11),
  detail('M60 154Q68 142 76 154T92 152Q100 146 106 156T126 150', 0.9), detail('M60 164H140', 0.45),
  ...motion(166, 104),
  ...flow(170, 116, 208, 92, 236, 110),
  // the seal
  ground(268, 206, 42),
  { d: poly(252, 164, 244, 200, 256, 192, 262, 202, 266, 168), fill: 'tomato' },
  { d: poly(274, 168, 278, 202, 284, 192, 296, 200, 286, 164), fill: 'tomato' },
  { d: gear(268, 138, 36, 30, 16), fill: 'marigold' },
  { d: circle(268, 138, 23), fill: 'paper', w: 0.8 },
  ...doneBadge(268, 138, 16),
  // your client signs off
  ...avatar(324, 70, 'periwinkle', 10),
  ...button(300, 90, 44, 'teal'), cursor(330, 96),
]);

/** Invoices, next to the work — created, sent, and paid. */
export const invoices = art([
  // created
  ground(64, 212, 50),
  ...invoicePaper(18, 44, 96, 156),
  // sent
  ...flow(118, 96, 150, 40, 188, 66),
  { d: rect(150, 70, 44, 28, 3), fill: 'lilac', t: 'rotate(-8 172 84)' },
  { d: polyline(150, 71, 172, 86, 194, 71), w: 0.6, t: 'rotate(-8 172 84)' },
  mark(165, 84, 12, 'paper'),
  ...motion(146, 78),
  // paid, on the client's side
  ground(284, 212, 54),
  ...slab(232, 58, 106, 140, 'paper', 'cream', 9, 5),
  ...avatar(248, 74, 'periwinkle', 8), title(262, 74, 40),
  ...lines(244, 96, 82, 2, 11),
  { d: rect(242, 122, 86, 22, 5), fill: 'cream', w: 0.6 }, detail('M250 133H270', 0.9), detail('M298 133H320', 1.3),
  { d: rect(262, 156, 68, 26, 6), fill: 'teal', w: 0.8, t: 'rotate(-8 296 169)' },
  tinted('M276 170L282 176L292 164', 'paper', 1.2), tinted('M298 170H320', 'paper', 1),
  ...coin(236, 190, 12), ...coin(236, 178, 12),
  { d: sparkle(334, 40, 6), fill: 'marigold' },
]);

export const SITE = {
  home, inbox, projects, clientPortal, docs, finance,
  shareLink, visibility, requests, approvals, invoices,
} satisfies Record<string, Art>;
export type SiteIllustrationName = keyof typeof SITE;
