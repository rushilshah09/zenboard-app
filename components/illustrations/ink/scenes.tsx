// Zen Ink scenes — the "a little more detailed" tier: a few spot objects staged
// together with props, a soft pigment backdrop and small marks of life (steam,
// sparkles, leaves). 320×220. Use for page-level empty states and onboarding.
import { type Art, type Part, rect, circle, ellipse, poly, sparkle, ground, place } from './kit';
import { inbox, calendar, tasks, ai, invoice, finance } from './spots';

const scene = (parts: Part[]): Art => ({ w: 320, h: 220, parts });
const wash = (d: string, fill: Part['fill']): Part => ({ d, fill, line: false });
const detail = (d: string, w = 0.75): Part => ({ d, w });

// ── Shared props ────────────────────────────────────────────────────────────
function mug(x: number, y: number, tone: Part['fill'] = 'tomato'): Part[] {
  return [
    ground(x + 15, y + 34, 20),
    { d: `M${x + 30} ${y + 8}Q${x + 41} ${y + 8} ${x + 41} ${y + 16}Q${x + 41} ${y + 24} ${x + 30} ${y + 24}`, w: 1.3 },
    { d: rect(x, y, 30, 32, 5), fill: tone },
    detail(`M${x + 5} ${y + 7}V${y + 22}`, 0.7),
    detail(`M${x + 9} ${y - 4}Q${x + 5} ${y - 10} ${x + 9} ${y - 16}`, 0.8),
    detail(`M${x + 19} ${y - 4}Q${x + 15} ${y - 10} ${x + 19} ${y - 16}`, 0.8),
  ];
}

function plant(x: number, y: number): Part[] {
  return [
    ground(x + 14, y + 38, 18),
    detail(`M${x + 14} ${y + 8}V${y - 16}`, 0.9),
    { d: `M${x + 13} ${y - 2}Q${x} ${y - 2} ${x - 4} ${y - 14}Q${x + 9} ${y - 16} ${x + 13} ${y - 6}Z`, fill: 'teal' },
    { d: `M${x + 15} ${y - 8}Q${x + 28} ${y - 8} ${x + 32} ${y - 20}Q${x + 19} ${y - 22} ${x + 15} ${y - 12}Z`, fill: 'teal' },
    { d: `M${x + 13} ${y - 16}Q${x + 7} ${y - 26} ${x + 14} ${y - 32}Q${x + 21} ${y - 26} ${x + 15} ${y - 16}Z`, fill: 'teal' },
    { d: `M${x} ${y + 8}H${x + 28}L${x + 25} ${y + 36}Q${x + 25} ${y + 38} ${x + 23} ${y + 38}H${x + 5}Q${x + 3} ${y + 38} ${x + 3} ${y + 36}Z`, fill: 'brick' },
    detail(`M${x + 1} ${y + 14}H${x + 27}`, 0.7),
  ];
}

function coinPlant(x: number, y: number): Part[] {
  return [
    ground(x, y + 44, 18),
    detail(`M${x} ${y + 42}V${y + 6}`, 0.9),
    { d: `M${x - 1} ${y + 32}Q${x - 16} ${y + 32} ${x - 20} ${y + 20}Q${x - 6} ${y + 18} ${x - 1} ${y + 28}Z`, fill: 'teal' },
    { d: `M${x + 1} ${y + 26}Q${x + 16} ${y + 26} ${x + 20} ${y + 14}Q${x + 6} ${y + 12} ${x + 1} ${y + 22}Z`, fill: 'teal' },
    { d: circle(x + 3, y - 1, 11), fill: 'orange' },
    { d: circle(x, y - 4, 11), fill: 'marigold' },
    detail(`M${x + 3} ${y - 8}Q${x} ${y - 10} ${x - 3} ${y - 8}Q${x - 4} ${y - 5} ${x} ${y - 4}Q${x + 4} ${y - 3} ${x + 3} ${y}Q${x} ${y + 2} ${x - 3} ${y}M${x} ${y - 12}V${y + 4}`, 0.75),
  ];
}

const blob = 'M58 64Q70 26 132 30Q196 18 246 44Q296 66 280 122Q272 180 200 188Q118 200 70 172Q28 146 58 64Z';

// ── Scenes ──────────────────────────────────────────────────────────────────

/** Inbox zero — everything triaged; a quiet desk moment. */
export const inboxZero = scene([
  wash(blob, 'cream'),
  detail('M36 186Q160 180 292 186', 0.8),
  ...place(inbox, 94, 50, 1.35),
  ...plant(222, 132),
  ...mug(56, 142, 'lilac'),
  { d: sparkle(236, 46, 8), fill: 'marigold' },
  { d: sparkle(258, 70, 4.5), fill: 'marigold' },
  { d: sparkle(74, 64, 5.5), fill: 'paper' },
]);

/** Plan your day — morning light, calendar and today's checklist on the desk. */
export const planDay = scene([
  wash(rect(176, 22, 112, 92, 8), 'periwinkle'),
  { d: rect(176, 22, 112, 92, 8), fill: undefined, w: 1 },
  detail('M232 22V114', 0.9), detail('M176 70H288', 0.9),
  { d: circle(204, 48, 11), fill: 'marigold' },
  detail('M204 30V33', 0.7), detail('M186 48H189', 0.7), detail('M219 48H222', 0.7),
  detail('M191 35L193 37', 0.7), detail('M217 35L215 37', 0.7),
  wash('M244 96Q244 88 252 88Q256 82 263 84Q270 84 272 90Q278 90 278 96Q278 100 274 100H248Q244 100 244 96Z', 'paper'),
  { d: 'M244 96Q244 88 252 88Q256 82 263 84Q270 84 272 90Q278 90 278 96Q278 100 274 100H248Q244 100 244 96Z', w: 0.8 },
  { d: rect(16, 170, 288, 10, 3), fill: 'brick' },
  detail('M36 180V206', 1.1), detail('M284 180V206', 1.1),
  ...place(calendar, 26, 88, 0.95, { ground: false }),
  ...place(tasks, 116, 102, 0.8, { ground: false }),
  ...mug(222, 136, 'tomato'),
  { d: sparkle(160, 36, 7), fill: 'marigold' },
  { d: sparkle(146, 58, 4), fill: 'paper' },
]);

/** Zenboard AI — a conversation lifting off the laptop. */
export const askAi = scene([
  wash(blob, 'cream'),
  { d: poly(52, 164, 268, 164, 288, 184, 32, 184), fill: 'cream' },
  detail('M140 174H180', 0.8),
  { d: rect(72, 70, 176, 96, 8), fill: 'cream' },
  { d: rect(80, 78, 160, 80, 4), fill: 'paper' },
  { d: rect(92, 90, 70, 16, 8), fill: 'lilac', w: 0.8 },
  { d: rect(130, 114, 96, 16, 8), fill: 'periwinkle', w: 0.8 },
  { d: rect(92, 138, 54, 12, 6), fill: 'lilac', w: 0.8 },
  ...place(ai, 190, 6, 0.95, { ground: false }),
  { d: sparkle(56, 60, 7), fill: 'marigold' },
  { d: sparkle(40, 90, 4), fill: 'paper' },
  { d: sparkle(292, 120, 5), fill: 'marigold' },
]);

/** Get paid — an invoice going out, money coming back, savings growing. */
export const getPaid = scene([
  wash(ellipse(160, 118, 138, 82), 'cream'),
  ...place(invoice, 22, 44, 1.2),
  ...place(finance, 132, 82, 1.0),
  ...coinPlant(262, 104),
  { d: 'M112 40Q156 8 200 52', w: 0.8 },
  { d: poly(200, 52, 192, 50, 197, 44), fill: 'ink', w: 0.6 },
  { d: sparkle(156, 44, 6), fill: 'marigold' },
]);

export const SCENES = { inboxZero, planDay, askAi, getPaid } satisfies Record<string, Art>;
export type SceneName = keyof typeof SCENES;
