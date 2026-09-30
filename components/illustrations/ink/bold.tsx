// Zen Bold — the flat, editorial illustration look, in Zenboard colors.
// Thick ink line, flat pigment, hard black cast shadows (see kit.tsx `look:
// 'bold'`). Two tiers:
//   · BADGES — icon illustrations: one object on a colored badge shape (96×96)
//   · BOLD_SCENES — detailed editorial compositions on a color field (320×320)
import {
  type Art, type Part, type Tone, rect, circle, poly, polyline, sparkle, cast,
  isoAt, isoBox, isoShadow,
} from './kit';

const bold = (w: number, h: number, parts: Part[]): Art => ({ w, h, parts, look: 'bold' });
const detail = (d: string, w = 0.6, line: Part['line'] = true): Part => ({ d, w, line });
const flat = (d: string, fill: Tone): Part => ({ d, fill, line: false });

// ── Badge shapes (rounded by stroking in their own color) ───────────────────
const ring = (n: number, r: number, cx = 48, cy = 48, rot = -90) =>
  poly(...Array.from({ length: n }, (_, i) => {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
  }).flat());

const SHAPES = {
  hex: ring(6, 41),
  square: rect(10, 10, 76, 76, 16),
  circle: circle(48, 48, 39),
  pentagon: ring(5, 42, 48, 51),
  arch: 'M12 86V46a36 36 0 0 1 72 0V86Z',
};
const badge = (shape: keyof typeof SHAPES, tone: Tone, parts: Part[]): Art =>
  bold(96, 96, [{ d: SHAPES[shape], fill: tone, line: tone, w: 1.8 }, ...parts]);

// ── Badges ──────────────────────────────────────────────────────────────────
const tray = 'M24 52L32 40H64L72 52V66Q72 70 68 70H28Q24 70 24 66Z';
const card = rect(26, 26, 44, 44, 10);
const cal = rect(24, 30, 48, 40, 5);
const folderBack = 'M22 36Q22 33 25 33H40L45 38H71Q74 38 74 41V66Q74 69 71 69H25Q22 69 22 66Z';
const page = 'M30 19H56L68 31V74Q68 77 65 77H33Q30 77 30 74Z';
const bank = rect(18, 32, 52, 32, 5);
const flag = 'M46 24H70L64 32L70 40H46Z';
const flame = 'M48 18Q67 36 65 54Q64 71 48 73Q32 71 31 54Q31 41 42 33Q42 44 48 46Q45 31 48 18Z';
const bubble = 'M26 28H70Q74 28 74 32V56Q74 60 70 60H44L32 70L34 60H26Q22 60 22 56V32Q22 28 26 28Z';
const keyShape = poly(42, 52, 68, 26, 74, 32, 48, 58);

export const BADGES = {
  inbox: badge('hex', 'sky', [
    cast(tray),
    { d: rect(35, 22, 26, 24, 2), fill: 'white' },
    detail('M40 30H56'), detail('M40 36H52'),
    { d: tray, fill: 'white' },
    { d: 'M38 52L41 58H55L58 52Z', fill: 'berry' },
    detail('M24 52H38', 0.8), detail('M58 52H72', 0.8),
  ]),
  tasks: badge('square', 'gold', [
    cast(card),
    { d: card, fill: 'berry' },
    detail(polyline(37, 48, 45, 56, 60, 40), 1.4),
    detail(polyline(37, 48, 45, 56, 60, 40), 0.7, 'white'),
  ]),
  calendar: badge('circle', 'lavender', [
    cast(cal),
    { d: cal, fill: 'white' },
    { d: 'M24 42V35Q24 30 29 30H67Q72 30 72 35V42Z', fill: 'berry' },
    detail('M35 34V24', 0.9), detail('M61 34V24', 0.9),
    ...[0, 1].flatMap((r) => [0, 1, 2].map((c): Part =>
      ({ d: rect(31 + c * 12, 48 + r * 10, 9, 6, 1.5), fill: r === 1 && c === 1 ? 'gold' : undefined, w: 0.55 }))),
  ]),
  projects: badge('pentagon', 'green', [
    cast(folderBack),
    { d: folderBack, fill: 'amber' },
    { d: rect(30, 30, 34, 20, 2), fill: 'white' },
    detail('M35 36H56'),
    { d: 'M20 46Q20 43 23 43H73Q76 43 76 46L72 66Q72 69 69 69H27Q24 69 24 66Z', fill: 'gold' },
  ]),
  clients: badge('arch', 'blue', [
    cast('M22 74Q22 52 38 52Q54 52 54 74Z'),
    { d: 'M50 74Q50 54 62 54Q74 54 74 74Z', fill: 'gold' },
    { d: circle(62, 44, 8), fill: 'skin' },
    { d: 'M54 42Q55 35 62 35Q69 35 70 42Q66 38 62 39Q58 39 54 42Z', fill: 'night' },
    { d: 'M22 74Q22 52 38 52Q54 52 54 74Z', fill: 'berry' },
    { d: circle(38, 40, 9.5), fill: 'skin' },
    { d: circle(38, 27, 4), fill: 'night' },
    { d: 'M28.5 39Q29 30 38 30Q47 30 47.5 39Q43 34 38 35Q33 35 28.5 39Z', fill: 'night' },
  ]),
  docs: badge('square', 'blush', [
    cast(page),
    { d: page, fill: 'white' },
    { d: poly(56, 19, 68, 31, 56, 31), fill: 'stone' },
    detail('M37 42H60'), detail('M37 50H60'), detail('M37 58H51'),
    { d: poly(38, 19, 46, 19, 46, 34, 42, 30, 38, 34), fill: 'berry' },
  ]),
  finance: badge('circle', 'green', [
    cast(bank),
    { d: bank, fill: 'blue' },
    flat(rect(18, 40, 52, 7), 'night'),
    { d: rect(25, 51, 10, 7, 2), fill: 'gold', w: 0.7 },
    cast(circle(64, 60, 12)),
    { d: circle(67, 63, 12), fill: 'amber' },
    { d: circle(64, 60, 12), fill: 'gold' },
    detail('M64 53V67', 0.8),
  ]),
  goals: badge('hex', 'berry', [
    { d: 'M22 72Q48 55 74 72Z', fill: 'green' },
    cast(flag),
    detail('M46 71V22', 1),
    { d: flag, fill: 'gold' },
  ]),
  habits: badge('pentagon', 'gold', [
    cast(flame),
    { d: flame, fill: 'berry' },
    { d: 'M48 45Q58 55 55 63Q52 71 48 71Q42 70 41 63Q41 55 48 45Z', fill: 'blush' },
  ]),
  focus: badge('arch', 'lavender', [
    cast(circle(48, 56, 20)),
    { d: rect(43, 26, 10, 7, 2), fill: 'berry' },
    detail('M48 33V36', 0.9),
    { d: circle(48, 56, 20), fill: 'white' },
    detail('M48 40V43', 0.6), detail('M48 69V72', 0.6), detail('M32 56H35', 0.6), detail('M61 56H64', 0.6),
    detail('M48 56L57 47', 0.9, 'berry'),
    { d: circle(48, 56, 2), fill: 'night', w: 0.3 },
  ]),
  ai: badge('circle', 'berry', [
    cast(bubble),
    { d: bubble, fill: 'white' },
    { d: sparkle(47, 44, 10), fill: 'gold' },
    { d: sparkle(62, 36, 4.5), fill: 'gold' },
  ]),
  portal: badge('square', 'sky', [
    cast(keyShape), cast(circle(36, 60, 12)),
    { d: keyShape, fill: 'gold' },
    { d: poly(60, 40, 66, 46, 62, 50, 56, 44), fill: 'gold' },
    { d: circle(36, 60, 12), fill: 'gold' },
    { d: circle(36, 60, 4), fill: 'sky' },
  ]),
} satisfies Record<string, Art>;
export type BadgeName = keyof typeof BADGES;

// ── Scenes ──────────────────────────────────────────────────────────────────
const field = (tone: Tone): Part => ({ d: rect(0, 0, 320, 320, 24), fill: tone, line: false, backdrop: true });
const facesOf = (b: ReturnType<typeof isoBox>, top: Tone, front: Tone, side: Tone, w = 0.8): Part[] => [
  { d: b.side, fill: side, w }, { d: b.front, fill: front, w }, { d: b.top, fill: top, w },
];

/** Conversation — a pile of messages landing in one place (Zenboard AI, chat). */
const conversation = bold(320, 320, [
  field('gold'),
  { d: 'M66 266Q70 252 112 254Q152 248 192 254Q248 250 262 262Q268 276 238 280Q198 286 150 284Q94 288 74 280Q62 274 66 266Z', fill: 'night', line: false, ground: true },
  { d: 'M70 118H206Q214 118 214 126V200Q214 208 206 208H190L196 228L176 208H78Q70 208 70 200V126Q70 118 78 118Z', fill: 'berry' },
  { d: 'M66 86Q66 74 78 74H144Q156 74 156 86V144Q156 156 144 156H108L100 174L94 156H78Q66 156 66 144Z', fill: 'sky' },
  { d: circle(94, 116, 3.6), fill: 'night', w: 0.3 }, { d: circle(108, 116, 3.6), fill: 'night', w: 0.3 }, { d: circle(122, 116, 3.6), fill: 'night', w: 0.3 },
  { d: 'M152 112Q152 96 172 96H232Q256 98 258 120V142Q256 162 234 162H198L186 178L182 162Q154 160 152 142Z', fill: 'lavender' },
  detail('M200 120H238', 0.7), detail('M204 132H234', 0.7),
  { d: 'M100 128H196Q208 128 208 140V156Q208 168 196 168H150L142 182L136 168H100Q88 168 88 156V140Q88 128 100 128Z', fill: 'meadow' },
  detail('M104 150Q110 143 116 150T128 150T140 150T152 150T164 150T176 150T188 150', 0.7),
  { d: poly(128, 234, 116, 256, 142, 244), fill: 'white' },
  { d: circle(152, 212, 38), fill: 'white' },
  detail('M152 198V226', 0.8), detail(polyline(143, 217, 152, 226, 161, 217), 0.8),
]);

/** Archive — docs and projects, filed and trending up (Docs, Projects). */
const archive = (() => {
  const p = isoAt(134, 196, 1.1);
  const post = (x: number, y: number) => facesOf(isoBox(p, x, y, 0, 3, 3, 151), 'white', 'white', 'stone', 0.7);
  const board = (z: number, h = 4) => facesOf(isoBox(p, 0, 0, z, 120, 44, h), 'white', 'white', 'stone');
  const spines: Tone[] = ['blue', 'clay', 'lavender', 'blue', 'sky', 'lavender', 'blue', 'clay'];
  const trend = [98, 94, 99, 96, 101, 98, 104, 110];
  const binders = spines.flatMap((tone, i) => {
    const x = 6 + i * 13;
    const b = isoBox(p, x, 8, 66, 11, 32, 44);
    const [lx, ly] = p(x + 5.5, 40, 76);
    return [
      ...facesOf(b, 'white', tone, 'white', 0.7),
      { d: circle(lx, ly, 2.4), fill: 'night', w: 0.3 } as Part,
    ];
  });
  const string = trend.map((z, i) => p(6 + i * 13 + 5.5, 40, z)).flat();
  const [ex, ey] = p(6 + 7 * 13 + 5.5, 40, 110);
  return bold(320, 320, [
    field('meadow'),
    { d: isoShadow(p, 0, 0, 120, 44, -34, 26), fill: 'night', line: false, ground: true },
    ...post(0, 0), ...post(117, 0),
    ...board(8),
    ...facesOf(isoBox(p, 6, 6, 12, 38, 34, 22), 'white', 'sky', 'blue', 0.7),
    ...facesOf(isoBox(p, 6, 6, 34, 38, 34, 20), 'white', 'sky', 'blue', 0.7),
    ...[0, 1, 2].flatMap((i) => facesOf(isoBox(p, 50 + i * 7, 10, 12, 5, 28, 36 - i * 3), 'blush', 'berry', 'berry', 0.7)),
    ...facesOf(isoBox(p, 76, 4, 12, 40, 36, 26), 'amber', 'amber', 'clay', 0.7),
    ...facesOf(isoBox(p, 82, 8, 38, 30, 28, 20), 'amber', 'amber', 'clay', 0.7),
    ...board(62),
    ...binders,
    { d: polyline(...string), line: 'berry', w: 0.9 },
    { d: poly(ex, ey - 9, ex - 5, ey - 1, ex + 5, ey - 1), fill: 'berry', line: 'berry', w: 0.4 },
    ...board(116),
    ...board(146, 5),
    ...post(0, 41), ...post(117, 41),
  ]);
})();

/** Team — clients and collaborators under one roof (Clients, portal). */
const team = bold(320, 320, [
  field('stone'),
  detail('M40 40L28 90', 0.6, 'white'), detail('M266 30L250 96', 0.6, 'white'), detail('M290 150L278 200', 0.6, 'white'),
  detail('M62 150L54 186', 0.6, 'white'), detail('M34 230L26 262', 0.6, 'white'),
  { d: 'M78 268L244 264L262 284L96 290Z', fill: 'night', line: false, ground: true },
  { d: 'M44 132L78 76L160 54L244 72L278 132L250 124L222 134L190 124L160 134L130 124L98 134L70 124Z', fill: 'sage' },
  { d: 'M78 76L160 54L244 72L226 98L160 84L96 100Z', fill: 'meadow' },
  { d: poly(140, 70, 166, 64, 168, 76, 144, 80), fill: 'sage', w: 0.6 },
  detail('M98 100L70 124', 0.5), detail('M160 84V134', 0.5), detail('M226 98L250 124', 0.5),
  detail('M162 54V30', 0.9, 'berry'), detail(polyline(154, 38, 162, 30, 170, 38), 0.9, 'berry'),
  // back person
  { d: rect(130, 206, 28, 64), fill: 'clay' },
  { d: 'M124 214V178Q124 166 136 166H152Q164 166 164 178V214Z', fill: 'night' },
  { d: circle(144, 146, 15), fill: 'skin' },
  { d: 'M129 144Q131 130 144 130Q157 130 159 144Q152 138 144 139Q136 139 129 144Z', fill: 'night' },
  // left person
  { d: rect(92, 218, 30, 56), fill: 'night' },
  { d: 'M88 220V182Q88 170 100 170H114Q126 170 126 182V220Z', fill: 'blue' },
  detail('M98 186V214', 0.6),
  { d: circle(98, 222, 5), fill: 'skin', w: 0.6 },
  { d: circle(106, 154, 15), fill: 'skin' },
  { d: 'M91 152Q92 137 106 137Q117 137 121 146Q113 142 106 144Q97 145 91 152Z', fill: 'amber' },
  { d: circle(90, 160, 6), fill: 'amber', w: 0.7 },
  // right person
  { d: rect(212, 212, 24, 62), fill: 'berry' },
  { d: 'M200 214V180Q200 168 212 168H228Q240 168 240 180V214Z', fill: 'lavender' },
  { d: circle(220, 148, 15), fill: 'skin' },
  { d: circle(233, 132, 7), fill: 'night' },
  { d: 'M205 146Q207 132 220 132Q233 132 235 146Q228 140 220 141Q212 141 205 146Z', fill: 'night' },
  // umbrella shaft, then the front person holding it
  detail('M161 58L156 210', 1, 'white'),
  { d: 'M156 210Q156 218 150 218', w: 1, line: 'white' },
  { d: rect(166, 220, 30, 54), fill: 'night' },
  { d: 'M160 222V184Q160 172 172 172H192Q204 172 204 184V222Z', fill: 'amber' },
  { d: 'M190 178Q196 180 197 188', w: 0.8, line: 'gold' },
  { d: circle(182, 154, 15), fill: 'skin' },
  { d: 'M167 150Q169 138 182 138Q195 138 197 150Q190 144 182 145Q174 145 167 150Z', fill: 'bone' },
  { d: circle(160, 212, 6), fill: 'skin', w: 0.7 },
]);

/** Project board — notes, people and the thread that connects them (Projects, Goals). */
const note = (x: number, y: number, w: number, h: number, inner: Part[] = []): Part[] => [
  cast(`M${x} ${y}H${x + w}V${y + h}L${x + w * 0.75} ${y + h - 2}L${x + w / 2} ${y + h + 1}L${x + w / 4} ${y + h - 2}L${x} ${y + h}Z`, -4, 4),
  { d: `M${x} ${y}H${x + w}V${y + h}L${x + w * 0.75} ${y + h - 2}L${x + w / 2} ${y + h + 1}L${x + w / 4} ${y + h - 2}L${x} ${y + h}Z`, fill: 'white', w: 0.7 },
  ...inner,
  { d: circle(x + w / 2, y + 6, 2.8), fill: 'night', w: 0.3 },
];
const person = (x: number, y: number, tone: Tone): Part[] => [
  { d: circle(x, y - 3, 3.5), fill: tone, w: 0.5 },
  { d: `M${x - 6} ${y + 7}Q${x - 6} ${y + 1} ${x} ${y + 1}Q${x + 6} ${y + 1} ${x + 6} ${y + 7}Z`, fill: tone, w: 0.5 },
];
const pins: [number, number][] = [[0, 92], [30, 118], [62, 108], [120, 176], [150, 158], [196, 204], [222, 172], [276, 252]];
const projectBoard = bold(320, 320, [
  field('meadow'),
  cast(rect(84, 112, 172, 122), -5, 5),
  { d: rect(84, 112, 172, 122), fill: 'white', w: 0.8 },
  flat(rect(92, 120, 156, 106), 'sky'),
  detail('M92 152H248', 1.9, 'white'), detail('M140 120L160 226', 1.9, 'white'), detail('M204 120L194 226', 1.9, 'white'),
  detail('M92 200L248 180', 1.9, 'white'), detail('M92 176L140 168', 1.3, 'white'),
  ...note(40, 58, 64, 48, [flat(rect(46, 70, 20, 16), 'stone'), flat(rect(70, 70, 28, 6), 'stone'), flat(rect(46, 90, 52, 8), 'stone')]),
  ...note(206, 70, 56, 68, [flat(rect(212, 80, 44, 36), 'lavender')]),
  { d: rect(126, 92, 34, 10, 1), fill: 'white', w: 0.6 }, flat(rect(134, 95, 18, 4), 'gold'),
  ...note(22, 112, 18, 52, [flat(rect(26, 124, 10, 24), 'sky')]),
  ...note(48, 102, 26, 96, [0, 1, 2, 3].map((i) => flat(rect(54, 116 + i * 18, 14, 10), 'lavender'))).flat(),
  ...note(106, 166, 28, 30, person(120, 182, 'stone')),
  ...note(182, 196, 26, 30, [detail('M188 208Q195 202 202 208M190 214Q195 209 200 214M192 220Q195 216 198 220', 0.45)]),
  ...note(208, 162, 30, 32, person(223, 180, 'gold')),
  { d: rect(176, 138, 40, 10, 1), fill: 'white', w: 0.6 }, flat(rect(184, 141, 22, 4), 'gold'),
  ...note(262, 150, 36, 32, [flat(rect(268, 162, 24, 14), 'sky')]),
  ...note(96, 246, 84, 40, [flat(rect(102, 258, 28, 16), 'stone'), flat(rect(136, 258, 36, 5), 'stone'), flat(rect(136, 268, 30, 5), 'stone')]),
  ...note(190, 238, 54, 66, [flat(rect(196, 250, 42, 36), 'meadow')]),
  ...note(254, 246, 58, 52, [0, 1, 2, 3].map((i) => flat(rect(260, 258 + i * 9, 46, 4), 'stone'))).flat(),
  { d: polyline(...pins.flat()), line: 'berry', w: 1 },
  ...pins.slice(1).map(([x, y]): Part => ({ d: circle(x, y, 2.6), fill: 'night', w: 0.3 })),
  { d: 'M276 252L290 224M282 226L290 224L294 232', line: 'berry', w: 1 },
]);

export const BOLD_SCENES = { conversation, archive, team, projectBoard } satisfies Record<string, Art>;
export type BoldSceneName = keyof typeof BOLD_SCENES;
