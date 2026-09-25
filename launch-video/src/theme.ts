import { loadFont } from "@remotion/fonts";
import { Easing, interpolate, staticFile } from "remotion";

/**
 * Zenboard design tokens, mirrored from app/tokens.generated.css and
 * app/tokens.css so the film speaks the product's exact visual language.
 * Scenes must pull every color, font, radius and easing from here.
 */

// Fonts are bundled in public/fonts (OFL) so renders work offline.
const FACES: [family: string, file: string, weight: string][] = [
  ["Geist", "geist-latin-400-normal", "400"],
  ["Geist", "geist-latin-500-normal", "500"],
  ["Geist", "geist-latin-600-normal", "600"],
  ["Geist", "geist-latin-700-normal", "700"],
  ["Geist Mono", "geist-mono-latin-400-normal", "400"],
  ["Geist Mono", "geist-mono-latin-500-normal", "500"],
  ["Source Serif 4", "source-serif-4-latin-400-normal", "400"],
  ["Source Serif 4", "source-serif-4-latin-600-normal", "600"],
];
for (const [family, file, weight] of FACES) {
  loadFont({ family, weight, url: staticFile(`fonts/${file}.woff2`) });
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
  info500: "#5E92BE",
  info600: "#9DBBD6",
  // Labels (user data palette)
  labelOchre: "#C99E3F",
  labelMoss: "#55A87C",
  labelRust: "#C97A55",
  labelStone: "#8B877E",
} as const;

/** Light "paper" scenes invert the product palette: ink becomes the ground. */
export const light = {
  bg: color.ink900,
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
