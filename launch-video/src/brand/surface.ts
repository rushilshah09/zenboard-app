import { interpolateColors } from "remotion";
import { colour, glass, shadow, tint } from "./tokens";

/**
 * One UI surface, two lights: white cards on the aurora, glass on the void.
 * `d` is the look's dark mix (0 = light, 1 = void); everything interpolates,
 * so UI changes material as the film darkens and brightens.
 */
export const surface = (d: number) => ({
  bg: interpolateColors(d, [0, 1], ["rgba(255, 255, 255, 1)", glass.fill]),
  line: interpolateColors(d, [0, 1], ["rgba(255, 255, 255, 0)", glass.line]),
  text: interpolateColors(d, [0, 1], [colour.ink, glass.text]),
  muted: interpolateColors(d, [0, 1], [colour.stone, glass.muted]),
  hair: interpolateColors(d, [0, 1], [colour.hairline, "rgba(255, 255, 255, 0.10)"]),
  fill: interpolateColors(d, [0, 1], [tint.ink06, "rgba(255, 255, 255, 0.07)"]),
  shadow: d > 0.5 ? glass.glow : shadow,
  /** Glassmorphism: the void shows through, softened. */
  backdrop: d > 0.05 ? `blur(${d * 24}px) saturate(${1 + d * 0.4})` : undefined,
});
export type Surface = ReturnType<typeof surface>;
