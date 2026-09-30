// Zen Ink spot illustrations — one object per Zenboard surface, 96×96, drawn in
// the house style (see kit.tsx). Use for empty states, feature tiles, menus.
import { type Art, type Part, rect, circle, poly, polyline, sparkle, gear, ground, mark } from './kit';

const art = (parts: Part[]): Art => ({ w: 96, h: 96, parts });
const detail = (d: string, w = 0.75): Part => ({ d, w });

export const inbox = art([
  ground(48, 84, 28),
  { d: rect(31, 14, 34, 30, 2), fill: 'paper' },
  detail('M37 22H59'), detail('M37 28H54'),
  { d: 'M14 52L24 40H72L82 52V72Q82 76 78 76H18Q14 76 14 72Z', fill: 'teal' },
  { d: 'M34 52L38 60H58L62 52Z', fill: 'tealDeep' },
  detail('M14 52H34', 1), detail('M62 52H82', 1),
]);

export const tasks = art([
  ground(46, 84, 24),
  { d: rect(33, 22, 42, 54, 3), fill: 'violet' },
  { d: rect(28, 19, 42, 54, 3), fill: 'lilac' },
  { d: 'M20 16H54L62 24V70Q62 73 59 73H23Q20 73 20 70Z', fill: 'paper' },
  detail('M54 16V24H62', 1),
  { d: polyline(26, 32, 30, 36, 37, 28), line: 'tealDeep', w: 1.3 },
  detail('M41 33H55'),
  { d: polyline(26, 46, 30, 50, 37, 42), line: 'tealDeep', w: 1.3 },
  detail('M41 47H55'),
  { d: rect(26, 57, 8, 7, 1.5) , w: 0.8 },
  detail('M41 61H52'),
]);

export const calendar = art([
  ground(46, 85, 26),
  { d: rect(73, 25, 5, 52, 1.5), fill: 'tealDeep' },
  { d: rect(18, 22, 57, 56, 3), fill: 'paper' },
  { d: 'M18 35V25Q18 22 21 22H72Q75 22 75 25V35Z', fill: 'teal' },
  ...[27, 39, 51, 63].map((x): Part => ({ d: `M${x} 28V18a3 3 0 0 1 6 0`, w: 0.9 })),
  ...[0, 1, 2].flatMap((r) => [0, 1, 2].map((c): Part => {
    const on = (r + c) % 2 === 1;
    return { d: rect(24 + c * 16, 41 + r * 12, 13, 9, 1), fill: on ? 'tealDeep' : undefined, w: 0.75 };
  })),
]);

export const folder = art([
  ground(48, 84, 27),
  { d: 'M16 28Q16 25 19 25H38L43 30H77Q80 30 80 33V72Q80 75 77 75H19Q16 75 16 72Z', fill: 'orange' },
  { d: rect(24, 21, 44, 30, 2), fill: 'paper' },
  detail('M30 28H56'), detail('M30 34H49'),
  { d: 'M13 42Q13 39 16 39H80Q83 39 83 42L79 72Q79 75 76 75H20Q17 75 17 72Z', fill: 'marigold' },
  mark(22, 45, 12, 'paper'),
]);

export const clients = art([
  ground(48, 86, 27),
  { d: 'M18 60Q18 45 30 45Q42 45 42 60Z', fill: 'orange' },
  { d: circle(30, 35, 7), fill: 'marigold' },
  { d: 'M54 60Q54 45 66 45Q78 45 78 60Z', fill: 'orange' },
  { d: circle(66, 35, 7), fill: 'marigold' },
  { d: 'M32 68Q32 49 48 49Q64 49 64 68Z', fill: 'marigold' },
  { d: circle(48, 37, 9), fill: 'marigold' },
  { d: rect(22, 62, 28, 16, 8) + rect(28, 67, 16, 6, 3), fill: 'periwinkle', evenOdd: true },
  { d: rect(46, 62, 28, 16, 8) + rect(52, 67, 16, 6, 3), fill: 'periwinkle', evenOdd: true },
]);

export const forms = art([
  ground(48, 87, 24),
  { d: rect(22, 18, 52, 62, 5), fill: 'brick' },
  { d: rect(28, 26, 40, 48, 2), fill: 'paper' },
  { d: rect(38, 13, 20, 12, 3.5), fill: 'violet' },
  { d: circle(48, 18, 2), w: 0.7 },
  { d: rect(33, 33, 7, 7, 1.5), w: 0.8 }, detail('M45 37H62'),
  { d: rect(33, 45, 7, 7, 1.5), fill: 'teal', w: 0.8 }, detail('M45 49H60'),
  { d: rect(33, 57, 7, 7, 1.5), w: 0.8 }, detail('M45 61H56'),
]);

export const docs = art([
  ground(50, 88, 26),
  { d: 'M24 16H55L68 29V76Q68 79 65 79H27Q24 79 24 76Z', fill: 'lilac' },
  { d: poly(55, 16, 68, 29, 55, 29), fill: 'paper' },
  mark(31, 32, 10), detail('M45 37H60', 1), detail('M31 48H60'), detail('M31 56H50'),
  { d: poly(76, 44, 82, 50, 84.5, 47.5, 78.5, 41.5), fill: 'lilac' },
  { d: poly(56, 78, 50, 72, 76, 44, 82, 50), fill: 'tomato' },
  { d: poly(50, 72, 56, 78, 45, 83), fill: 'cream' },
  { d: poly(45, 83, 46.5, 79.5, 48.5, 81.5), fill: 'ink', w: 0.6 },
]);

const dollar = (cx: number, cy: number): Part => ({
  d: `M${cx + 4.5} ${cy - 5}Q${cx} ${cy - 8.5} ${cx - 3.5} ${cy - 6}Q${cx - 5.5} ${cy - 3} ${cx - 1} ${cy - 1}L${cx + 1.5} ${cy + 0.5}Q${cx + 5.5} ${cy + 2.5} ${cx + 3.5} ${cy + 5.8}Q${cx} ${cy + 8.5} ${cx - 4.5} ${cy + 5.5}M${cx} ${cy - 9}V${cy + 9}`,
  w: 0.95,
});

export const finance = art([
  ground(46, 82, 30),
  { d: rect(16, 56, 52, 16, 2), fill: 'teal' },
  detail('M16 61H68', 0.6), detail('M16 66H68', 0.6),
  { d: rect(37, 56, 9, 16), fill: 'paper', w: 0.8 },
  { d: circle(64, 38, 14), fill: 'orange' },
  { d: circle(60, 34, 14), fill: 'marigold' },
  dollar(60, 34),
  { d: sparkle(28, 30, 8), fill: 'paper' },
  { d: sparkle(82, 16, 5), fill: 'paper' },
]);

export const invoice = art([
  ground(50, 87, 28),
  { d: rect(30, 18, 36, 30, 2), fill: 'teal' },
  { d: circle(48, 32, 8), fill: 'paper', w: 0.8 },
  mark(43, 27, 10),
  { d: rect(18, 38, 60, 40, 2), fill: 'cream' },
  { d: rect(78, 40, 4, 38, 1.5), fill: 'lilac' },
  { d: 'M18 42L48 62L78 42V76Q78 78 76 78H20Q18 78 18 76Z', fill: 'paper' },
  detail('M20 77L41 58'), detail('M76 77L55 58'),
  detail('M68 14L72 8', 0.9), detail('M74 19L80 16', 0.9), detail('M61 12L62 6', 0.9),
]);

export const goals = art([
  ground(48, 86, 24),
  detail('M39 60L32 80', 1.1), detail('M57 60L64 80', 1.1),
  { d: circle(52, 40, 22), fill: 'tomato' },
  { d: circle(48, 40, 22), fill: 'lilac' },
  { d: circle(48, 40, 14), fill: 'paper' },
  { d: circle(48, 40, 7), fill: 'lilac' },
  detail('M48 40L25 17', 1.1),
  { d: 'M25 17L17 16L21 21Z', fill: 'paper', w: 0.8 },
  { d: 'M25 17L26 9L21 13Z', fill: 'paper', w: 0.8 },
]);

export const habits = art([
  ground(48, 82, 22),
  detail('M48 78V42', 1),
  { d: 'M47 70Q29 71 25 56Q42 53 47 66Z', fill: 'teal' },
  { d: 'M49 70Q67 71 71 56Q54 53 49 66Z', fill: 'teal' },
  detail('M46 67Q37 62 30 58', 0.6), detail('M50 67Q59 62 66 58', 0.6),
  ...Array.from({ length: 8 }, (_, i): Part => {
    const a = (i / 8) * Math.PI * 2;
    return { d: circle(+(48 + 10.5 * Math.cos(a)).toFixed(1), +(31 + 10.5 * Math.sin(a)).toFixed(1), 6.2), fill: 'marigold', w: 0.9 };
  }),
  { d: circle(48, 31, 6.5), fill: 'orange' },
]);

export const focus = art([
  ground(50, 85, 25),
  { d: circle(52, 45, 27), fill: 'violet' },
  { d: circle(48, 45, 27), fill: 'periwinkle' },
  { d: circle(48, 45, 20), fill: 'paper' },
  detail('M48 28V31', 0.9), detail('M48 59V62', 0.9), detail('M31 45H34', 0.9), detail('M62 45H65', 0.9),
  detail('M48 45V34', 1.2), detail('M48 45L56 49', 1.2),
  { d: circle(48, 45, 1.6), fill: 'ink', w: 0.5 },
]);

export const ai = art([
  ground(46, 85, 27),
  { d: 'M40 24H74Q80 24 80 30V48Q80 54 74 54H70L72 62L62 54H40Q34 54 34 48V30Q34 24 40 24Z', fill: 'periwinkle' },
  { d: 'M20 34H56Q62 34 62 40V58Q62 64 56 64H33L23 72L25 64H20Q14 64 14 58V40Q14 34 20 34Z', fill: 'lilac' },
  { d: circle(27, 49, 2.3), fill: 'ink', w: 0.5 },
  { d: circle(38, 49, 2.3), fill: 'ink', w: 0.5 },
  { d: circle(49, 49, 2.3), fill: 'ink', w: 0.5 },
  { d: sparkle(78, 14, 8), fill: 'marigold' },
  { d: sparkle(88, 30, 4.5), fill: 'marigold' },
]);

const bellShape = (dx: number) =>
  `M${48 + dx} 20Q${67 + dx} 20 ${67 + dx} 42V55L${73 + dx} 64H${23 + dx}L${29 + dx} 55V42Q${29 + dx} 20 ${48 + dx} 20Z`;

export const bell = art([
  ground(48, 84, 22),
  { d: circle(48, 69, 5), fill: 'orange' },
  { d: bellShape(4), fill: 'orange' },
  { d: bellShape(0), fill: 'marigold' },
  { d: circle(48, 17, 3), fill: 'marigold', w: 0.8 },
  { d: 'M38 34Q38 28 43 26', line: 'paper', w: 1.1 },
  detail('M20 27Q16 33 17 40', 0.9), detail('M76 27Q80 33 79 40', 0.9),
]);

const shieldShape = (dx: number) =>
  `M${48 + dx} 13L${72 + dx} 21V43Q${72 + dx} 66 ${48 + dx} 78Q${24 + dx} 66 ${24 + dx} 43V21Z`;

export const shield = art([
  ground(50, 88, 20),
  { d: shieldShape(4), fill: 'violet' },
  { d: shieldShape(0), fill: 'lilac' },
  { d: polyline(37, 45, 45, 53, 60, 36), w: 2.6 },
  { d: polyline(37, 45, 45, 53, 60, 36), line: 'paper', w: 1.3 },
]);

export const moon = art([
  ground(48, 86, 22),
  { d: circle(46, 44, 23), fill: 'lilac' },
  { d: circle(39, 37, 4), w: 0.7 }, { d: circle(55, 52, 3), w: 0.7 }, { d: circle(37, 55, 2.4), w: 0.7 },
  { d: 'M50 65Q50 57 58 57Q60 51 67 52Q74 51 76 58Q84 58 84 65Q84 69 80 69H54Q50 69 50 65Z', fill: 'paper' },
  { d: 'M12 35Q12 30 17 30Q19 26 24 27Q29 27 30 31Q34 31 34 35Q34 37 32 37H14Q12 37 12 35Z', fill: 'paper' },
  { d: sparkle(76, 20, 6.5), fill: 'paper' },
  { d: sparkle(18, 64, 4.5), fill: 'paper' },
]);

export const settings = art([
  ground(50, 88, 26),
  { d: gear(31, 28, 13, 9.5, 8), fill: 'paper' },
  { d: circle(31, 28, 4), w: 0.8 },
  { d: poly(64, 34, 70, 40, 73, 37, 67, 31), fill: 'lilac' },
  { d: poly(32, 78, 26, 72, 64, 34, 70, 40), fill: 'tomato' },
  { d: poly(26, 72, 32, 78, 21, 83), fill: 'cream' },
  { d: poly(21, 83, 22.5, 79.5, 24.5, 81.5), fill: 'ink', w: 0.6 },
  detail('M68 60V80', 1.3), detail('M58 70H78', 1.3),
]);

export const key = art([
  ground(50, 86, 24),
  { d: poly(40, 50, 70, 20, 76, 26, 46, 56), fill: 'marigold' },
  { d: poly(60, 36, 66, 42, 62, 46, 56, 40), fill: 'marigold' },
  { d: poly(68, 28, 74, 34, 70, 38, 64, 32), fill: 'marigold' },
  { d: circle(36, 60, 15), fill: 'orange' },
  { d: circle(33, 57, 15), fill: 'marigold' },
  { d: circle(30, 60, 5), fill: 'paper' },
]);

export const sun = art([
  ground(48, 84, 24),
  ...Array.from({ length: 8 }, (_, i): Part => {
    const a = (i / 8) * Math.PI * 2;
    const [x1, y1, x2, y2] = [48 + 24 * Math.cos(a), 40 + 24 * Math.sin(a), 48 + 31 * Math.cos(a), 40 + 31 * Math.sin(a)].map((v) => +v.toFixed(1));
    return detail(`M${x1} ${y1}L${x2} ${y2}`, 1);
  }),
  { d: circle(48, 40, 18), fill: 'marigold' },
  { d: 'M40 66Q40 58 48 58Q50 52 57 53Q64 52 66 59Q74 59 74 66Q74 70 70 70H44Q40 70 40 66Z', fill: 'paper' },
]);

export const link = art([
  ground(48, 84, 26),
  { d: rect(12, 38, 44, 22, 11) + rect(20, 44, 28, 10, 5), fill: 'violet', evenOdd: true, t: 'rotate(-30 34 49)' },
  { d: rect(40, 36, 44, 22, 11) + rect(48, 42, 28, 10, 5), fill: 'periwinkle', evenOdd: true, t: 'rotate(-30 62 47)' },
  detail('M20 26L24 32', 0.9), detail('M14 34L20 36', 0.9), detail('M76 62L82 66', 0.9), detail('M72 70L74 76', 0.9),
]);

export const eye = art([
  ground(48, 82, 26),
  { d: 'M10 48Q48 12 86 48Q48 84 10 48Z', fill: 'paper' },
  { d: circle(48, 48, 15), fill: 'violet' },
  { d: circle(48, 48, 6.5), fill: 'ink', w: 0.5 },
  { d: circle(44, 44, 2.4), fill: 'paper', line: false },
  detail('M20 36L15 29', 0.9), detail('M34 27L32 19', 0.9), detail('M48 24V16', 0.9), detail('M62 27L64 19', 0.9), detail('M76 36L81 29', 0.9),
]);

export const SPOTS = {
  inbox, tasks, calendar, folder, clients, forms, docs, finance, invoice,
  goals, habits, focus, ai, bell, shield, moon, settings, key, sun, link, eye,
} satisfies Record<string, Art>;
export type SpotName = keyof typeof SPOTS;
