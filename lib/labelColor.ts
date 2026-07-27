// The ten-hue label palette (§2.1.5). Each has -fill / -text / (solid) tokens,
// already registered as Tailwind colours (bg-label-moss-fill, text-label-moss-text).
export const LABEL_COLORS = [
  "stone",
  "berry",
  "rust",
  "ochre",
  "moss",
  "teal",
  "slate",
  "indigo",
  "plum",
  "clay",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

// Deterministic hue from a stable id (§3.3) — avatars derive their fill this way
// so a person is always the same colour. Tags do NOT auto-assign (§4.8): colour is
// meaning there, so new tags default to `stone` and the user picks.
export function labelColorFor(seed: string): LabelColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
}

// Static class maps so Tailwind sees the full class strings (no runtime concat,
// which JIT can't scan).
export const LABEL_FILL: Record<LabelColor, string> = {
  stone: "bg-label-stone-fill text-label-stone-text",
  berry: "bg-label-berry-fill text-label-berry-text",
  rust: "bg-label-rust-fill text-label-rust-text",
  ochre: "bg-label-ochre-fill text-label-ochre-text",
  moss: "bg-label-moss-fill text-label-moss-text",
  teal: "bg-label-teal-fill text-label-teal-text",
  slate: "bg-label-slate-fill text-label-slate-text",
  indigo: "bg-label-indigo-fill text-label-indigo-text",
  plum: "bg-label-plum-fill text-label-plum-text",
  clay: "bg-label-clay-fill text-label-clay-text",
};

export const LABEL_SOLID: Record<LabelColor, string> = {
  stone: "bg-label-stone",
  berry: "bg-label-berry",
  rust: "bg-label-rust",
  ochre: "bg-label-ochre",
  moss: "bg-label-moss",
  teal: "bg-label-teal",
  slate: "bg-label-slate",
  indigo: "bg-label-indigo",
  plum: "bg-label-plum",
  clay: "bg-label-clay",
};
