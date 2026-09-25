/**
 * Film brand system — creative direction §3. Every colour, type style,
 * spacing step, radius and the one shadow live here. Scenes never hard-code.
 */

export const colour = {
  /** Warm Cream: background of every frame. */
  paper: "#F7F1E8",
  /** App windows, UI panels, cards. */
  card: "#FFFFFF",
  /** Deep Burgundy: headlines, UI text, all linework. There is no black. */
  ink: "#280417",
  /** Ink at 55%: secondary text, de-emphasised words, inactive UI. */
  stone: "rgba(40, 4, 23, 0.55)",
  /** Soft Sand: borders, dividers, the only fill before the reveal. */
  hairline: "#E8D8C5",
  /** Zenboard Pink: only from S09, only on Zenboard things. */
  pink: "#C41C72",
  /** Blush: aura behind the mark, selected rows. */
  blush: "#F3D9E5",
} as const;

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

/** The one shadow, tinted burgundy so it never goes grey. */
export const shadow = "0 24px 48px rgba(40, 4, 23, 0.06), 0 2px 6px rgba(40, 4, 23, 0.04)";
