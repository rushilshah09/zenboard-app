import React from "react";
import { useCurrentFrame } from "remotion";
import { color, ease, font, rand, tween } from "../theme";

/**
 * Text that holds, then blows apart letter by letter (left → right), each
 * letter drifting up and away into a blur. *Asterisks* mark accent words,
 * set like Headline's accent.
 */
export const Dissolve: React.FC<{
  text: string;
  at: number;
  size: number;
  tint: string;
  accent?: string;
  style?: React.CSSProperties;
}> = ({ text, at, size, tint, accent = color.berry500, style }) => {
  const frame = useCurrentFrame();
  let accentOn = false;
  return (
    <div style={{ fontFamily: font.sans, fontSize: size, fontWeight: 600, letterSpacing: "-0.035em", color: tint, whiteSpace: "pre", ...style }}>
      {Array.from(text).map((ch, i) => {
        if (ch === "*") {
          accentOn = !accentOn;
          return null;
        }
        const start = at + i * 0.7;
        const p = tween(frame, [start, start + 22], [0, 1], ease.in);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              translate: `${(rand(i + 1) - 0.2) * 420 * p}px ${((rand(i + 7) - 0.5) * 260 - 120) * p}px`,
              rotate: `${(rand(i + 3) - 0.5) * 120 * p}deg`,
              opacity: 1 - p,
              filter: `blur(${p * 10}px)`,
              ...(accentOn ? { fontFamily: font.serif, fontStyle: "italic", fontWeight: 400, color: accent, letterSpacing: "-0.02em" } : null),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};
