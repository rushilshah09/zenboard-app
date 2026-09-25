import React from "react";
import { useCurrentFrame } from "remotion";
import { color, ease, font, tween } from "../theme";

/**
 * Word-by-word headline. Wrap words in *asterisks* to set them as the
 * accent: Source Serif italic, optionally tinted. Words rise out of a blur.
 */
export const Headline: React.FC<{
  text: string;
  at: number;
  size: number;
  tint: string;
  accent?: string;
  stagger?: number;
  out?: number;
  align?: "left" | "center";
  weight?: number;
  style?: React.CSSProperties;
}> = ({ text, at, size, tint, accent = color.berry500, stagger = 3, out, align = "center", weight = 600, style }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  let accentOn = false;
  const exit = out === undefined ? 0 : tween(frame, [out, out + 10], [0, 1], ease.in);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.26,
        fontFamily: font.sans,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: "-0.035em",
        lineHeight: 1.08,
        color: tint,
        opacity: 1 - exit,
        filter: `blur(${exit * 8}px)`,
        translate: `0 ${-exit * 20}px`,
        ...style,
      }}
    >
      {words.map((raw, i) => {
        const starts = raw.startsWith("*");
        const ends = raw.replace(/[.,?!…]+$/, "").endsWith("*");
        if (starts) accentOn = true;
        const isAccent = accentOn;
        if (ends) accentOn = false;
        const word = raw.replace(/\*/g, "");
        const t = tween(frame, [at + i * stagger, at + i * stagger + 12], [0, 1]);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: t,
              translate: `0 ${(1 - t) * size * 0.35}px`,
              filter: `blur(${(1 - t) * 10}px)`,
              ...(isAccent
                ? { fontFamily: font.serif, fontStyle: "italic", fontWeight: 400, color: accent, letterSpacing: "-0.02em" }
                : null),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
