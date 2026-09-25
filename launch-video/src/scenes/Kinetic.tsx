import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Sfx } from "../components/Sfx";
import { color, ease, font, light, radius, tween } from "../theme";

/** Scene 8 — kinetic type: a small line hands off to a very large one. */
export const Kinetic: React.FC = () => {
  const frame = useCurrentFrame();
  const small = tween(frame, [0, 10], [0, 1]);
  const smallOut = tween(frame, [34, 42], [0, 1], ease.in);
  const highlight = tween(frame, [8, 22], [0, 1], ease.inOut);
  const big = tween(frame, [40, 52], [0, 1]);
  const slide = tween(frame, [40, 110], [0, 1], ease.standard);

  return (
    <AbsoluteFill style={{ background: light.bg, fontFamily: font.sans, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          fontSize: 64,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          opacity: small * (1 - smallOut),
          scale: String(1 + smallOut * 0.6),
          filter: `blur(${smallOut * 8}px)`,
          padding: "4px 16px",
          borderRadius: radius.sm,
          color: highlight > 0.5 ? light.bg : light.text,
          background: `linear-gradient(90deg, ${light.text} ${highlight * 100}%, transparent ${highlight * 100}%)`,
        }}
      >
        The more you use it
      </div>
      <div
        style={{
          position: "absolute",
          whiteSpace: "nowrap",
          fontSize: 190,
          fontWeight: 600,
          letterSpacing: "-0.055em",
          color: light.text,
          opacity: big,
          translate: `${(1 - slide) * 700}px 0`,
          filter: `blur(${(1 - big) * 12}px)`,
        }}
      >
        the calmer it gets<span style={{ color: color.berry500 }}>.</span>
      </div>
      <Sfx at={40} sound="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};
