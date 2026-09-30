// Zen Ink · Site — detailed, hand-inked illustrations for zenboard.life's
// feature cards. Each tells its feature as a small drawn story (not a UI
// wireframe). Render inside `.ill-brand` for the brand palette. 360×240.
import { type Art, type Part, type Tone, rect, circle, ellipse, poly, polyline, sparkle, gear, ground, place } from './kit';
import { inbox as inboxSpot, folder, focus } from './spots';

const W = 360;
const H = 240;
const art = (parts: Part[]): Art => ({ w: W, h: H, parts });
const detail = (d: string, w = 0.7): Part => ({ d, w });
const tinted = (d: string, tone: Tone, w = 0.7): Part => ({ d, w, line: tone });

// ── Drawing vocabulary ──────────────────────────────────────────────────────
/** A paper card with a soft ground beneath it. */
const card = (x: number, y: number, w: number, h: number, fill: Tone = 'paper', r = 7): Part => ({ d: rect(x, y, w, h, r), fill });
/** Text as ink lines: n lines, the last one shorter. */
const lines = (x: number, y: number, w: number, n: number, gap = 9, weight = 0.7): Part[] =>
  Array.from({ length: n }, (_, i) => detail(`M${x} ${y + i * gap}H${x + (i === n - 1 && n > 1 ? w * 0.6 : w)}`, weight));
/** Pencil hatching for shade: short diagonal strokes inside a box. */
const hatch = (x: number, y: number, w: number, h: number, step = 5): Part =>
  detail(Array.from({ length: Math.floor(w / step) }, (_, i) => `M${x + i * step} ${y + h}L${x + i * step + Math.min(h, 6)} ${y}`).join(''), 0.45);
const checkbox = (x: number, y: number, done = false): Part[] => [
  { d: rect(x, y, 11, 11, 3), fill: done ? 'teal' : 'paper', w: 0.8 },
  ...(done ? [detail(polyline(x + 2.5, y + 5.5, x + 5, y + 8, x + 9, y + 3), 0.8)] : []),
];
const pill = (x: number, y: number, w: number, tone: Tone) => ({ d: rect(x, y, w, 10, 5), fill: tone, w: 0.6 } as Part);
const toggle = (x: number, y: number, on: boolean): Part[] => [
  { d: rect(x, y, 26, 14, 7), fill: on ? 'violet' : 'cream', w: 0.8 },
  { d: circle(on ? x + 19 : x + 7, y + 7, 4.6), fill: 'paper', w: 0.6 },
];
const avatar = (cx: number, cy: number, tone: Tone, r = 9): Part[] => [
  { d: circle(cx, cy, r), fill: tone, w: 0.8 },
  { d: circle(cx, cy - r * 0.2, r * 0.36), fill: 'paper', w: 0.5 },
  { d: `M${cx - r * 0.62} ${cy + r * 0.72}Q${cx} ${cy + r * 0.05} ${cx + r * 0.62} ${cy + r * 0.72}`, fill: 'paper', w: 0.5 },
];
const mug = (x: number, y: number, tone: Tone): Part[] => [
  ground(x + 13, y + 30, 18),
  detail(`M${x + 26} ${y + 7}Q${x + 36} ${y + 7} ${x + 36} ${y + 14}Q${x + 36} ${y + 21} ${x + 26} ${y + 21}`, 1.1),
  { d: rect(x, y, 26, 28, 5), fill: tone },
  detail(`M${x + 8} ${y - 4}Q${x + 4} ${y - 10} ${x + 8} ${y - 16}`, 0.7),
  detail(`M${x + 17} ${y - 4}Q${x + 13} ${y - 10} ${x + 17} ${y - 16}`, 0.7),
];
const leaf = (x: number, y: number, flip = 1): Part =>
  ({ d: `M${x} ${y}Q${x + 16 * flip} ${y - 2} ${x + 20 * flip} ${y - 16}Q${x + 5 * flip} ${y - 16} ${x} ${y}Z`, fill: 'teal', w: 0.8 });
const envelope = (x: number, y: number, rot: number, fill: Tone = 'paper'): Part[] => {
  const t = `rotate(${rot} ${x + 20} ${y + 13})`;
  return [
    { d: rect(x, y, 40, 26, 3), fill, t },
    { d: polyline(x, y + 1, x + 20, y + 15, x + 40, y + 1), w: 0.7, t },
  ];
};
const coin = (cx: number, cy: number, r = 12): Part[] => [
  { d: ellipse(cx + 2.5, cy + 3, r, r * 0.42), fill: 'orange' },
  { d: ellipse(cx, cy, r, r * 0.42), fill: 'marigold' },
];

// ── Hub feature cards ───────────────────────────────────────────────────────

/** Home — your day in one place, the one thing that matters first. */
export const home = art([
  ground(176, 214, 124),
  { d: circle(292, 52, 20), fill: 'marigold' },
  detail('M292 22V27'), detail('M262 52H267'), detail('M317 52H322'), detail('M271 31L274 34'), detail('M313 31L310 34'),
  card(74, 34, 196, 164, 'paper', 10),
  hatch(76, 188, 192, 8),
  detail('M92 54H152', 1.1), { d: circle(252, 54, 3), fill: 'violet', w: 0.5 },
  ...checkbox(92, 74, true), ...lines(112, 79.5, 110, 1),
  { d: rect(68, 106, 214, 36, 9), fill: 'violet' },
  { d: rect(62, 100, 214, 36, 9), fill: 'lilac' },
  ...checkbox(76, 112), detail('M96 117.5H198', 1),
  pill(216, 112.5, 34, 'paper'),
  { d: sparkle(262, 108, 7), fill: 'marigold' },
  ...checkbox(92, 156), ...lines(112, 161.5, 96, 1),
  ...checkbox(92, 176), ...lines(112, 181.5, 70, 1),
  ...mug(296, 164, 'lilac'),
  leaf(46, 196, 1), leaf(46, 196, -1), detail('M46 210V186', 0.8),
  { d: sparkle(40, 60, 6), fill: 'paper' },
]);

/** Inbox — everything that arrived, filed in one pass. */
export const inbox = art([
  ...place(inboxSpot, 116, 76, 1.45),
  ...envelope(28, 40, -14, 'paper'),
  tinted('M74 60Q96 70 112 92', 'periwinkle', 0.8), tinted('M70 72Q90 80 104 98', 'periwinkle', 0.6),
  ...envelope(52, 132, 10, 'lilac'),
  ...envelope(250, 30, 16, 'paper'),
  tinted('M246 60Q224 70 214 92', 'periwinkle', 0.8),
  ...place(folder, 264, 118, 0.9),
  detail('M226 168L236 164M242 161L252 157', 0.8),
  { d: poly(252, 157, 246, 154, 247, 160), fill: 'ink', w: 0.4 },
  { d: sparkle(196, 34, 7), fill: 'marigold' },
  { d: sparkle(330, 90, 4), fill: 'marigold' },
]);

/** Projects — boards, calendar, briefs and what you are waiting on. */
export const projects = art([
  ground(180, 218, 138),
  { d: rect(36, 30, 288, 178, 10), fill: 'cream' },
  hatch(38, 198, 284, 8),
  detail('M132 46V196', 0.6), detail('M228 46V196', 0.6),
  { d: circle(52, 48, 4), fill: 'teal', w: 0.5 }, detail('M62 48H96'),
  { d: circle(148, 48, 4), fill: 'marigold', w: 0.5 }, detail('M158 48H190'),
  { d: circle(244, 48, 4), fill: 'violet', w: 0.5 }, detail('M254 48H280'),
  card(46, 62, 76, 34, 'paper', 6), ...lines(54, 74, 56, 2, 9),
  card(46, 104, 76, 34, 'paper', 6), ...lines(54, 116, 50, 2, 9),
  card(46, 146, 76, 34, 'paper', 6), ...lines(54, 158, 60, 2, 9),
  card(142, 62, 76, 34, 'paper', 6), ...lines(150, 74, 52, 2, 9),
  card(238, 62, 76, 34, 'paper', 6), ...checkbox(246, 73, true), ...lines(263, 78.5, 40, 1),
  card(238, 104, 76, 34, 'paper', 6), ...lines(246, 116, 58, 2, 9),
  { d: ellipse(186, 176, 44, 6), fill: 'shadow', ground: true, line: false },
  { d: rect(146, 118, 84, 38, 7), fill: 'paper', t: 'rotate(-8 188 137)' },
  { d: circle(160, 132, 4), fill: 'violet', w: 0.5, t: 'rotate(-8 188 137)' },
  { ...lines(170, 132, 48, 1, 9, 0.9)[0], t: 'rotate(-8 188 137)' },
  { ...lines(158, 144, 56, 1, 9, 0.7)[0], t: 'rotate(-8 188 137)' },
  { d: circle(180, 28, 5), fill: 'tomato', w: 0.7 },
  { d: sparkle(334, 40, 7), fill: 'marigold' },
]);

/** Client portal — one link your client can follow. No login. */
export const clientPortal = art([
  ground(160, 214, 116),
  card(46, 34, 214, 164, 'paper', 10),
  { d: 'M46 58V44Q46 34 56 34H250Q260 34 260 44V58Z', fill: 'cream' },
  { d: circle(60, 46, 3), fill: 'tomato', w: 0.5 }, { d: circle(71, 46, 3), fill: 'marigold', w: 0.5 }, { d: circle(82, 46, 3), fill: 'teal', w: 0.5 },
  pill(104, 41, 130, 'paper'), detail('M116 46H200', 0.5),
  { d: circle(104, 118, 30), fill: 'cream' },
  { d: 'M104 88A30 30 0 1 1 78 133', w: 1.6, line: 'violet' },
  ...checkbox(150, 90, true), ...lines(168, 95.5, 70, 1),
  ...checkbox(150, 112, true), ...lines(168, 117.5, 60, 1),
  ...checkbox(150, 134), ...lines(168, 139.5, 74, 1),
  { d: rect(142, 158, 104, 22, 6), fill: 'lilac', w: 0.8 }, detail('M152 169H212', 0.7),
  { d: rect(240, 110, 40, 20, 10) + rect(246, 115, 28, 10, 5), fill: 'violet', evenOdd: true, t: 'rotate(-24 260 120)' },
  { d: rect(266, 122, 40, 20, 10) + rect(272, 127, 28, 10, 5), fill: 'periwinkle', evenOdd: true, t: 'rotate(-24 286 132)' },
  ground(322, 200, 22),
  { d: 'M302 196Q302 168 322 168Q342 168 342 196Z', fill: 'periwinkle' },
  { d: circle(322, 152, 13), fill: 'marigold' },
  { d: 'M309 150Q311 136 322 136Q334 136 336 148Q328 142 322 144Q314 144 309 150Z', fill: 'brick', w: 0.8 },
  { d: sparkle(304, 44, 7), fill: 'marigold' },
]);

/** Docs — briefs and notes that link to the work they are about. */
export const docs = art([
  ground(150, 214, 96),
  { d: rect(92, 38, 128, 162, 6), fill: 'lilac', t: 'rotate(7 156 119)' },
  { d: rect(84, 36, 128, 162, 6), fill: 'cream', t: 'rotate(-4 148 117)' },
  { d: 'M78 32H186L210 56V190Q210 196 204 196H84Q78 196 78 190Z', fill: 'paper' },
  { d: poly(186, 32, 210, 56, 186, 56), fill: 'cream' },
  detail('M94 52H158', 1.2),
  ...lines(94, 72, 96, 3, 10),
  { d: rect(94, 108, 96, 34, 4), fill: 'teal', w: 0.7 },
  { d: 'M94 136L118 118L134 130L150 116L190 140V142H94Z', fill: 'tealDeep', line: false },
  ...lines(94, 156, 96, 3, 10),
  { d: poly(214, 148, 219, 153, 223, 149, 218, 144), fill: 'lilac' },
  { d: poly(186, 186, 181, 181, 214, 148, 219, 153), fill: 'tomato' },
  { d: poly(181, 181, 186, 186, 176, 190), fill: 'cream' },
  tinted('M210 110Q250 100 262 124', 'violet', 0.8),
  detail('M262 124L266 131M262 124L256 128', 0.8),
  card(236, 132, 98, 30, 'paper', 6), ...checkbox(246, 141.5), ...lines(264, 147, 56, 1),
  { d: circle(236 + 90, 140, 3), fill: 'violet', w: 0.4 },
  { d: sparkle(300, 60, 8), fill: 'marigold' },
  { d: sparkle(58, 84, 5), fill: 'paper' },
]);

/** Finance — invoices from your tracked time, and what has been paid. */
export const finance = art([
  ground(150, 216, 92),
  { d: 'M84 26H206V200L196 194L186 200L176 194L166 200L156 194L146 200L136 194L126 200L116 194L106 200L96 194L84 200Z', fill: 'paper' },
  detail('M100 46H150', 1.3), { d: circle(188, 46, 6), fill: 'violet', w: 0.6 },
  ...lines(100, 70, 90, 1), ...lines(100, 84, 90, 1), ...lines(100, 98, 90, 1),
  detail('M170 70H190M170 84H190M170 98H190', 0.9),
  detail('M100 114H190', 0.5),
  { d: rect(96, 124, 98, 24, 5), fill: 'lilac', w: 0.8 }, detail('M106 136H136', 1), detail('M160 136H186', 1.4),
  { d: circle(172, 172, 18), fill: 'paper', line: 'teal', w: 1.4, t: 'rotate(-12 172 172)' },
  tinted(polyline(163, 172, 170, 179, 182, 165), 'teal', 1.4),
  ...place(focus, 20, 116, 0.8),
  ground(282, 206, 40),
  ...coin(282, 196, 20), ...coin(282, 182, 20), ...coin(282, 168, 20), ...coin(278, 154, 20),
  detail('M272 150Q278 146 284 150Q288 154 282 156Q276 158 280 162Q286 164 290 160', 0.7),
  { d: sparkle(250, 60, 8), fill: 'marigold' },
  { d: sparkle(318, 110, 5), fill: 'marigold' },
]);

// ── Client portal section ───────────────────────────────────────────────────

/** One link, no login — a link goes out, the project opens on their side. */
export const shareLink = art([
  ground(120, 214, 96),
  card(40, 70, 164, 130, 'paper', 9),
  { d: 'M40 90V80Q40 70 50 70H194Q204 70 204 80V90Z', fill: 'cream' },
  pill(62, 75, 112, 'paper'),
  { d: circle(88, 142, 26), fill: 'cream' },
  { d: 'M88 116A26 26 0 1 1 65 154', w: 1.6, line: 'violet' },
  ...lines(128, 124, 56, 1), ...lines(128, 140, 44, 1), ...lines(128, 156, 50, 1),
  { d: rect(166, 48, 50, 24, 12) + rect(173, 54, 36, 12, 6), fill: 'violet', evenOdd: true, t: 'rotate(-28 191 60)' },
  { d: rect(198, 32, 50, 24, 12) + rect(205, 38, 36, 12, 6), fill: 'periwinkle', evenOdd: true, t: 'rotate(-28 223 44)' },
  detail('M256 44Q284 30 296 58T326 64', 0.8),
  { d: poly(300, 106, 342, 82, 318, 124), fill: 'paper' },
  { d: poly(300, 106, 342, 82, 312, 110), fill: 'lilac' },
  detail('M312 110L318 124', 0.7),
  detail('M254 150Q280 140 296 116', 0.6), detail('M266 164Q288 150 304 124', 0.6),
  { d: sparkle(150, 40, 7), fill: 'marigold' },
]);

/** You choose what they see — an eye, the switches, and what stays private. */
export const visibility = art([
  ground(180, 216, 130),
  { d: 'M28 92Q76 48 124 92Q76 136 28 92Z', fill: 'paper' },
  { d: circle(76, 92, 20), fill: 'violet' },
  { d: circle(76, 92, 8.5), fill: 'ink', w: 0.4 },
  { d: circle(71, 87, 3), fill: 'paper', line: false },
  detail('M40 78L34 70M56 66L53 57M76 62V53M96 66L99 57M112 78L118 70', 0.8),
  card(148, 34, 136, 146, 'paper', 9),
  detail('M162 52H214', 1.1), { d: circle(268, 52, 4), fill: 'periwinkle', w: 0.5 },
  ...[0, 1, 2, 3].flatMap((i) => [
    ...lines(162, 80 + i * 26, 60, 1),
    ...toggle(244, 73 + i * 26, i !== 2),
  ]),
  { d: rect(236, 150, 100, 64, 8), fill: 'cream', t: 'rotate(4 286 182)' },
  hatch(242, 158, 88, 48, 7),
  { d: rect(270, 170, 20, 16, 3), fill: 'brick', w: 0.8, t: 'rotate(4 280 178)' },
  { d: 'M274 170V165Q274 159 280 159Q286 159 286 165V170', w: 0.9, t: 'rotate(4 280 178)' },
  { d: sparkle(42, 150, 6), fill: 'marigold' },
]);

/** Requests become tasks — a message turns into a task on your list. */
export const requests = art([
  ground(180, 214, 128),
  ...avatar(44, 58, 'periwinkle', 12),
  { d: 'M66 44H170Q180 44 180 54V104Q180 114 170 114H96L78 130L82 114H66Q56 114 56 104V54Q56 44 66 44Z', fill: 'lilac' },
  ...lines(72, 66, 90, 3, 12),
  detail('M168 136Q198 166 226 150', 1),
  { d: poly(226, 150, 216, 146, 220, 156), fill: 'ink', w: 0.5 },
  card(196, 126, 138, 64, 'paper', 8),
  { d: rect(196, 126, 6, 64, 3), fill: 'violet', line: false },
  ...checkbox(212, 142, true), detail('M230 147.5H300', 1),
  pill(212, 166, 44, 'lilac'), pill(262, 166, 30, 'cream'),
  ...avatar(318, 172, 'marigold', 7),
  { d: sparkle(306, 104, 8), fill: 'marigold' },
  { d: sparkle(210, 40, 5), fill: 'paper' },
]);

/** Approvals, on the record — versions, a signature and the seal. */
export const approvals = art([
  ground(170, 216, 110),
  { d: rect(108, 44, 124, 156, 6), fill: 'cream', t: 'rotate(8 170 122)' },
  { d: rect(100, 40, 124, 156, 6), fill: 'lilac', t: 'rotate(3 162 118)' },
  card(90, 34, 124, 160, 'paper', 6),
  detail('M104 54H160', 1.2),
  pill(104, 66, 20, 'cream'), pill(128, 66, 20, 'cream'), pill(152, 66, 20, 'violet'),
  ...lines(104, 94, 96, 4, 11),
  detail('M104 158Q112 146 120 158T136 156Q144 150 150 160T170 154', 1),
  detail('M104 170H176', 0.5),
  { d: gear(230, 150, 30, 25, 14), fill: 'marigold' },
  { d: circle(230, 150, 18), fill: 'paper', w: 0.8 },
  tinted(polyline(221, 150, 228, 157, 240, 143), 'teal', 1.5),
  { d: poly(214, 176, 206, 206, 216, 200, 222, 208, 226, 178), fill: 'tomato' },
  { d: poly(234, 178, 238, 208, 244, 200, 254, 206, 246, 176), fill: 'tomato' },
  { d: sparkle(282, 104, 8), fill: 'marigold' },
  { d: sparkle(70, 70, 5), fill: 'marigold' },
]);

/** Invoices, next to the work — what is due and what is paid. */
export const invoices = art([
  ground(176, 216, 120),
  { d: 'M70 30H190V196L180 190L170 196L160 190L150 196L140 190L130 196L120 190L110 196L100 190L90 196L80 190L70 196Z', fill: 'paper' },
  detail('M86 50H130', 1.3),
  ...lines(86, 74, 88, 1), ...lines(86, 88, 88, 1), ...lines(86, 102, 88, 1),
  { d: rect(82, 120, 96, 26, 5), fill: 'lilac', w: 0.8 }, detail('M92 133H118', 1), detail('M144 133H170', 1.4),
  ...[0, 1, 2, 3].flatMap((i) => coin(250, 196 - i * 12, 22)),
  { d: 'M228 108Q228 96 240 96H272Q284 96 284 108V124Q284 136 272 136H262L248 148L250 136H240Q228 136 228 124Z', fill: 'teal' },
  tinted(polyline(245, 116, 253, 124, 268, 108), 'paper', 1.5),
  { d: sparkle(304, 70, 8), fill: 'marigold' },
  { d: sparkle(40, 120, 5), fill: 'marigold' },
]);

export const SITE = {
  home, inbox, projects, clientPortal, docs, finance,
  shareLink, visibility, requests, approvals, invoices,
} satisfies Record<string, Art>;
export type SiteIllustrationName = keyof typeof SITE;
