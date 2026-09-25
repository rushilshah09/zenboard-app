import React from "react";
import { Img, staticFile } from "remotion";
import { font, illo, radius } from "../theme";
import { hasFile } from "./Sfx";

/**
 * Illustration slots. The registry is the single source for every
 * illustration in the film: its number, the card colour it sits on, and
 * where it appears. ILLUSTRATIONS.md is written against this table.
 *
 * Drop `public/illustrations/<name>.svg` (or `.png`) and the slot shows it;
 * until then a numbered placeholder marks the spot.
 */
export const ILLUSTRATIONS = {
  "founder-idea": { n: 1, ground: illo.sand, scene: "01 · origin" },
  juggling: { n: 2, ground: illo.blush, scene: "02 · work-arrives" },
  "tangled-thread": { n: 3, ground: illo.sand, scene: "06 · friday" },
  "connected-thread": { n: 4, ground: illo.blush, scene: "14 · flow" },
  "calm-desk": { n: 5, ground: illo.sand, scene: "15 · calm" },
  "habit-plant": { n: 6, ground: illo.blush, scene: "13 · life" },
  "goal-path": { n: 7, ground: illo.sand, scene: "13 · life" },
  "focus-bubble": { n: 8, ground: illo.cream, scene: "13 · life" },
  "morning-ritual": { n: 9, ground: illo.sand, scene: "13 · life" },
  "week-plan": { n: 10, ground: illo.blush, scene: "13 · life" },
  "client-portal": { n: 11, ground: illo.cream, scene: "13 · life" },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export const groundOf = (name: IllustrationName) => ILLUSTRATIONS[name].ground;

const sourceOf = (name: IllustrationName) =>
  [`illustrations/${name}.svg`, `illustrations/${name}.png`].find(hasFile);

export const Illustration: React.FC<{
  name: IllustrationName;
  /** 0 → 1 reveal progress. */
  draw: number;
  size: number;
  style?: React.CSSProperties;
}> = ({ name, draw, size, style }) => {
  const src = sourceOf(name);
  if (src) {
    return (
      <div style={{ width: size, height: size, ...style }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            clipPath: `inset(${(1 - draw) * 100}% 0 0 0)`,
            scale: String(1.04 - draw * 0.04),
          }}
        />
      </div>
    );
  }
  const { n } = ILLUSTRATIONS[name];
  return (
    <div
      style={{
        width: size * 0.82,
        height: size * 0.82,
        margin: size * 0.09,
        borderRadius: radius.xl,
        border: `2px dashed rgba(40, 4, 23, 0.28)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.03,
        fontFamily: font.mono,
        color: illo.deep,
        opacity: 0.3 + Math.min(1, draw * 3) * 0.7,
        ...style,
      }}
    >
      <div style={{ fontSize: size * 0.2, lineHeight: 1, opacity: 0.8 }}>{String(n).padStart(2, "0")}</div>
      <div style={{ fontSize: Math.max(12, size * 0.05), opacity: 0.55 }}>{name}</div>
    </div>
  );
};
