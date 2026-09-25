import React from "react";
import { useCurrentFrame } from "remotion";
import { color, ease, font, rand, tween } from "../theme";

/**
 * Code-like glyphs ( / < > ) that burst out from a centre word and drift,
 * then gather back in. A typographic nod to "building something".
 */
const GLYPHS = ["/", "/", "<", ">", "/", ">", "<", "/"];
const TINTS = [color.paper, color.berry500, color.paper, color.labelOchre, color.paper, color.info500];

export const GlyphField: React.FC<{
  at: number;
  gatherAt?: number;
  count?: number;
  spread?: number;
  size?: number;
  dark?: boolean;
}> = ({ at, gatherAt, count = 22, spread = 520, size = 56, dark = false }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = rand(i + 1) * Math.PI * 2;
        const r = spread * (0.35 + rand(i + 40) * 0.65);
        const delay = rand(i + 80) * 14;
        const burst = tween(frame, [at + delay, at + delay + 26], [0, 1], ease.out);
        const gather = gatherAt === undefined ? 0 : tween(frame, [gatherAt + delay * 0.5, gatherAt + delay * 0.5 + 18], [0, 1], ease.in);
        const drift = Math.sin((frame + i * 20) / 30) * 8;
        const k = burst * (1 - gather);
        const tint = TINTS[i % TINTS.length];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 960,
              top: 540,
              fontFamily: font.mono,
              fontSize: size * (0.7 + rand(i + 5) * 0.6),
              color: dark && tint === color.paper ? color.ink700 : tint,
              opacity: k * (0.35 + rand(i + 9) * 0.65),
              translate: `${Math.cos(a) * r * k - size / 3}px ${Math.sin(a) * r * 0.62 * k + drift - size / 2}px`,
              rotate: `${(rand(i + 3) - 0.5) * 30 * k}deg`,
            }}
          >
            {GLYPHS[i % GLYPHS.length]}
          </div>
        );
      })}
    </>
  );
};
