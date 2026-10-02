import { EASE, clamp } from "./motion";
import { frames, sceneStart } from "./timeline";

/**
 * The film's lighting arc, as a function of the global frame (STYLE.md):
 *
 *   light  — warm white under a soft aurora (act 1, product act)
 *   dark   — the atmospheric void of the chaos, where UI glows (S03 → S09 spin)
 *   brand  — the full-bleed Zenboard gradient (the reveal, the end card)
 *
 * `dark` and `brand` are 0..1 mixes; light is what remains. `aurora` is how
 * strongly the gradient blobs show on the light canvas.
 */
export type Look = { dark: number; brand: number; aurora: number };

/** S09 frame where the pink sweeps out of the mark and the gradient floods the frame. */
export const FLOOD_S09 = 156;
/** S18 frame of the reprise flood (LogoReveal REPRISE.pink[0]). */
export const FLOOD_S18 = 101;

export const lookAt = (g: number): Look => {
  const s = (id: Parameters<typeof sceneStart>[0], f = 0) => sceneStart(id) + f;
  // The void gathers as the apps multiply, and lifts when the product arrives.
  const dark = clamp(g, [s("S03", 120), s("S03", frames("S03") - 20)], [0, 1], EASE.breathe) - clamp(g, [s("S09", FLOOD_S09), s("S09", FLOOD_S09 + 24)], [0, 1], EASE.settle);
  const brand =
    clamp(g, [s("S09", FLOOD_S09), s("S09", FLOOD_S09 + 40)], [0, 1], EASE.settle) -
    clamp(g, [s("S10", 0), s("S10", 50)], [0, 1], EASE.settle) +
    clamp(g, [s("S18", FLOOD_S18), s("S18", FLOOD_S18 + 40)], [0, 1], EASE.settle);
  // Aurora strength ramps, never steps: restrained under the product, richer for the hero and the end.
  const aurora = 0.6 - 0.12 * clamp(g, [s("S10"), s("S11")], [0, 1], EASE.breathe) + 0.22 * clamp(g, [s("S16"), s("S16", 80)], [0, 1], EASE.breathe);
  return { dark: Math.max(0, dark), brand: Math.max(0, Math.min(1, brand)), aurora };
};

/** The look for a scene-local frame. */
export const lookIn = (id: Parameters<typeof sceneStart>[0], frame: number) => lookAt(sceneStart(id) + frame);
