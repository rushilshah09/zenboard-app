/**
 * Film brand system — creative direction §3. Every colour, type style,
 * spacing step, radius and the one shadow live here. Scenes never hard-code.
 */

/**
 * "Zenboard Aurora" — the launch film's look (STYLE.md): a bright warm-white
 * canvas under living violet → pink → coral gradients, white floating UI,
 * deep plum ink, and full-bleed gradient brand moments.
 */
export const colour = {
  /** Canvas: warm white under the aurora. */
  paper: "#FBF8F6",
  /** App windows, UI panels, cards. */
  card: "#FFFFFF",
  /** Deep plum: headlines, UI text, linework. */
  ink: "#1B1020",
  /** Ink at 55%: secondary text, de-emphasised words, inactive UI. */
  stone: "rgba(27, 16, 32, 0.52)",
  /** Borders, dividers, skeleton fills. */
  hairline: "#ECE4EC",
  /** Zenboard Pink: the brand accent. */
  pink: "#C41C72",
  /** Selected rows, soft pink surfaces. */
  blush: "#FBE2EE",
  /** Type and marks on the full-bleed gradient. */
  white: "#FFFFFF",
} as const;

/** The aurora: the gradient family behind everything (and full-bleed on brand moments). */
export const aurora = {
  violet: "#8A74FF",
  periwinkle: "#7FA4FF",
  pink: "#E6358A",
  coral: "#FF8A5C",
  peach: "#FFC2A1",
} as const;

/** The void of the chaos acts: deep plum, never pure black. */
export const voidColour = "#0D0915";

/** UI on the void: glassy panels with light hairlines that glow (ElevenLabs). */
export const glass = {
  fill: "rgba(255, 255, 255, 0.045)",
  line: "rgba(255, 255, 255, 0.14)",
  text: "rgba(255, 255, 255, 0.92)",
  muted: "rgba(255, 255, 255, 0.48)",
  glow: "0 0 0 1px rgba(160, 140, 255, 0.10), 0 0 40px rgba(122, 96, 255, 0.18), 0 30px 80px rgba(0, 0, 0, 0.45)",
} as const;

/** The brand gradient as CSS, for full-bleed moments, text shimmer and lines. */
export const brandGradient = `linear-gradient(115deg, ${aurora.periwinkle} 0%, ${aurora.violet} 28%, ${aurora.pink} 62%, ${aurora.coral} 100%)`;

/** Faint ink tints for UI fills (skeleton bars, highlights) — never grey. */
export const tint = {
  ink06: "rgba(27, 16, 32, 0.05)",
  ink10: "rgba(27, 16, 32, 0.09)",
  ink16: "rgba(27, 16, 32, 0.15)",
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

/** Floating-card shadow: deep, soft, violet-tinted, so white UI hovers over the aurora. */
export const shadow = "0 40px 90px rgba(76, 40, 130, 0.16), 0 8px 24px rgba(76, 40, 130, 0.08), 0 1px 2px rgba(76, 40, 130, 0.06)";
