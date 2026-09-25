import { loadFont } from "@remotion/fonts";
import { Easing, interpolate, staticFile } from "remotion";

/**
 * Zenboard design tokens, mirrored from app/tokens.generated.css and
 * app/tokens.css so the film speaks the product's exact visual language.
 * Scenes must pull every color, font, radius and easing from here.
 */

// Fonts are bundled in public/fonts (OFL) so renders work offline.
const FACES: [family: string, file: string, weight: string, style?: string][] = [
  ["Geist", "geist-latin-400-normal", "400"],
  ["Geist", "geist-latin-500-normal", "500"],
  ["Geist", "geist-latin-600-normal", "600"],
  ["Geist", "geist-latin-700-normal", "700"],
  ["Geist Mono", "geist-mono-latin-400-normal", "400"],
  ["Geist Mono", "geist-mono-latin-500-normal", "500"],
  ["Source Serif 4", "source-serif-4-latin-400-normal", "400"],
  ["Source Serif 4", "source-serif-4-latin-600-normal", "600"],
  ["Source Serif 4", "source-serif-4-latin-400-italic", "400", "italic"],
  ["Source Serif 4", "source-serif-4-latin-500-italic", "500", "italic"],
];
for (const [family, file, weight, style = "normal"] of FACES) {
  loadFont({ family, weight, style, url: staticFile(`fonts/${file}.woff2`) });
}

export const font = {
  sans: '"Geist", ui-sans-serif, system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
  serif: '"Source Serif 4", ui-serif, Georgia, serif',
};

export const color = {
  // Surfaces
  canvas: "#000000",
  paper: "#121212",
  paper2: "#1E1E1E",
  paper3: "#262626",
  paper4: "#303030",
  // Ink
  ink900: "#F2F1EB",
  ink800: "#E6E5E3",
  ink700: "#C9C8C2",
  ink600: "#A8A8A8",
  ink500: "#91918E",
  ink400: "#7C7C79",
  ink300: "#5C5C5C",
  ink200: "#3A3A38",
  line: "rgba(242, 241, 235, 0.12)",
  line2: "rgba(242, 241, 235, 0.08)",
  line3: "rgba(242, 241, 235, 0.20)",
  wash: "rgba(242, 241, 235, 0.06)",
  // Brand
  berry700: "#8A0F51",
  berry500: "#C41C72",
  berry300: "#E38CB2",
  berry200: "#EFB9D0",
  // Status
  success500: "#55A87C",
  success600: "#7FC49E",
  success100: "#1E2C24",
  warning500: "#D2A150",
  danger500: "#E5675E",
  info500: "#5E92BE",
  info600: "#9DBBD6",
  // Labels (user data palette)
  labelOchre: "#C99E3F",
  labelMoss: "#55A87C",
  labelRust: "#C97A55",
  labelStone: "#8B877E",
} as const;

/**
 * Illustration grounds — warm, desaturated tints of the label palette, used
 * behind the hand-drawn ink illustrations (which are multiplied onto them).
 */
export const ground = {
  cream: "#F2F1EB",
  sand: "#E9DCC2",
  clay: "#D8A788",
  terracotta: "#C97A55",
  stone: "#C9C8C2",
  sage: "#BCCDBF",
  mist: "#BFD0DE",
  blush: "#EFC9D8",
  sticky: "#F4DD8A",
} as const;

/**
 * Zenboard illustration system palette (brand brief). Illustrations are
 * mostly deep burgundy line, with pink as the one deliberate accent; the
 * light tones are the cards they sit on.
 */
export const illo = {
  deep: "#280417",
  pink: "#C41C72",
  softPink: "#E8A8C5",
  blush: "#F3D9E5",
  dustyRose: "#A94A72",
  plum: "#5B1839",
  cream: "#F7F1E8",
  sand: "#E8D8C5",
  mauve: "#B98B9E",
  white: "#FFFFFF",
} as const;

/** Light "paper" scenes invert the product palette: ink becomes the ground. */
export const light = {
  bg: color.ink900,
  surface: "#FFFFFF",
  text: color.paper,
  muted: "rgba(18, 18, 18, 0.42)",
  faint: "rgba(18, 18, 18, 0.10)",
} as const;

export const radius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, pill: 9999 } as const;

export const shadow = {
  lift2:
    "0 1px 2px rgba(0,0,0,0.24), 0 8px 16px -6px rgba(0,0,0,0.40)",
  lift3:
    "0 2px 4px rgba(0,0,0,0.24), 0 24px 48px -12px rgba(0,0,0,0.56)",
  float: "0 2px 6px rgba(18,18,18,0.08), 0 32px 64px -16px rgba(18,18,18,0.28)",
} as const;

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  standard: Easing.bezier(0.2, 0, 0, 1),
  in: Easing.bezier(0.4, 0, 1, 1),
  spring: Easing.bezier(0.34, 1.4, 0.64, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const FPS = 30;

/** Clamped interpolate with the product's default quiet ease-out. */
export const tween = (
  frame: number,
  input: [number, number],
  output: [number, number],
  easing: (t: number) => number = ease.out,
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Number of characters of `text` visible for a typewriter starting at `start`. */
export const typed = (frame: number, start: number, text: string, cps = 22) =>
  text.slice(0, Math.max(0, Math.floor(((frame - start) / FPS) * cps)));

/** Deterministic pseudo-random in [0, 1) for a seed. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Decaying camera shake that starts at `at`. Returns a CSS translate. */
export const shake = (frame: number, at: number, strength = 10, length = 12) => {
  const t = frame - at;
  if (t < 0 || t > length) return "0px 0px";
  const k = (1 - t / length) * strength;
  return `${Math.sin(t * 2.7) * k}px ${Math.cos(t * 3.3) * k}px`;
};
