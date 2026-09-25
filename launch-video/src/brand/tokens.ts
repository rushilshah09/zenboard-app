/**
 * Film brand system — creative direction §3. Every colour, type style,
 * spacing step, radius and the one shadow live here. Scenes never hard-code.
 */

/**
 * v3 "Everything → One" (DIRECTION_V3.md §2). Two stages, Ink and Ivory, and
 * one energy gradient that is only ever light, never a flat background.
 */
export const colour = {
  /** Ivory stage and warm surfaces. */
  paper: "#F7F1E8",
  /** UI panels and cards. */
  card: "#FFFFFF",
  /** Deep Burgundy: text and linework. Never pure black. */
  ink: "#280417",
  /** Ink at 55%: secondary text. */
  stone: "rgba(40, 4, 23, 0.55)",
  /** Soft Sand: borders, dividers. */
  hairline: "#E8D8C5",
  /** Zenboard Pink. */
  pink: "#C41C72",
  /** Blush: selected rows, soft pink surfaces. */
  blush: "#F3D9E5",
  white: "#FFFFFF",
} as const;

/** The two stages the film takes place on. */
export const stage = {
  /** Ink: deep burgundy at the centre falling to a darker burgundy at the edges, with a dusty-rose haze. */
  ink: "#280417",
  inkEdge: "#120109",
  haze: "#A94A72",
  /** Type on the Ink stage. */
  inkText: "#F7F1E8",
  /** Ivory: warm cream with a soft shadow floor. */
  ivory: "#F7F1E8",
} as const;

/** The energy gradient: light only (orb, rims, pulses, glows, the bloom under the logo). */
export const energy = {
  pink: "#C41C72",
  rose: "#E8A8C5",
  apricot: "#E8B88A",
  lavender: "#AAA0D4",
} as const;
export const energyGradient = (angle = 90) => `linear-gradient(${angle}deg, ${energy.lavender} 0%, ${energy.pink} 30%, ${energy.rose} 65%, ${energy.apricot} 100%)`;

/** Faint ink tints for UI fills (skeleton bars, highlights) — never grey. */
export const tint = {
  ink06: "rgba(40, 4, 23, 0.06)",
  ink10: "rgba(40, 4, 23, 0.10)",
  ink16: "rgba(40, 4, 23, 0.16)",
} as const;

export type Category = "tasks" | "projects" | "docs" | "notes" | "calendar" | "money" | "clients" | "life";

/** §3 category pairings: one dominant + one accent per module. Held back until S10. */
export const CATEGORY: Record<Category, { dominant: string; accent: string }> = {
  tasks: { dominant: "#6F91A8", accent: "#C5DCE5" },
  projects: { dominant: "#7D9465", accent: "#C8D8C1" },
  docs: { dominant: "#8175AE", accent: "#AAA0D4" },
  notes: { dominant: "#E8B88A", accent: "#E8D8C5" },
  calendar: { dominant: "#C41C72", accent: "#E8A8C5" },
  money: { dominant: "#E7C66B", accent: "#E8D8C5" },
  clients: { dominant: "#D97A72", accent: "#F3D9E5" },
  life: { dominant: "#9BAF88", accent: "#C5DCE5" },
};

/** §3 type scale at 1080p. Geist only; emphasis is weight and colour. */
export const type = {
  display: { fontSize: 120, lineHeight: "120px", fontWeight: 500, letterSpacing: "-0.03em" },
  headline: { fontSize: 72, lineHeight: "80px", fontWeight: 500, letterSpacing: "-0.02em" },
  subhead: { fontSize: 40, lineHeight: "48px", fontWeight: 400, letterSpacing: "-0.01em" },
  ui: { fontSize: 22, lineHeight: "30px", fontWeight: 400, letterSpacing: "0em" },
  uiStrong: { fontSize: 22, lineHeight: "30px", fontWeight: 500, letterSpacing: "0em" },
  caption: { fontSize: 16, lineHeight: "22px", fontWeight: 500, letterSpacing: "0.02em" },
} as const;

export type TypeStyle = keyof typeof type;

/** 8px spacing scale — the only spacing values allowed. */
export const space = { s1: 8, s2: 16, s3: 24, s4: 32, s6: 48, s8: 64, s12: 96, s16: 128 } as const;

/** Radii: 20 windows, 12 cards (concentric: 20 = 12 + 8 inset), 999 pills. */
export const radius = { window: 20, card: 12, inner: 8, pill: 999 } as const;

/** Panel shadow on Ivory: contact, ambient, far, all burgundy-tinted (v2 §2, carried into v3). */
export const shadow = "0 1px 2px rgba(40, 4, 23, 0.08), 0 8px 24px rgba(40, 4, 23, 0.08), 0 40px 80px rgba(40, 4, 23, 0.10)";
/** Panel material: 1px inner top highlight and an 8% burgundy hairline. */
export const panelEdge = "inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 0 0 1px rgba(40, 4, 23, 0.08)";
