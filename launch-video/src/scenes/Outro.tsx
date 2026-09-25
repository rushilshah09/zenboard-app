import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { color, font, radius, tween } from "../theme";
import { LogoLockup } from "./LogoReveal";

/** Scene 9 — end card. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const line = tween(frame, [42, 58], [0, 1]);
  const pill = tween(frame, [54, 70], [0, 1]);
  const out = tween(frame, [124, 140], [0, 1]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 44%, ${color.paper2} 0%, ${color.canvas} 62%)`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font.sans,
      }}
    >
      <div style={{ translate: `0 ${-line * 60}px` }}>
        <LogoLockup frame={frame} size={170} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 640,
          fontSize: 44,
          letterSpacing: "-0.015em",
          color: color.ink600,
          opacity: line,
          translate: `0 ${(1 - line) * 16}px`,
        }}
      >
        Tasks, docs, clients and money. One calm place.
      </div>
      <div
        style={{
          position: "absolute",
          top: 740,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 32,
          fontWeight: 500,
          color: color.ink900,
          padding: "14px 32px",
          borderRadius: radius.pill,
          border: `1px solid ${color.line3}`,
          opacity: pill,
          scale: String(0.9 + pill * 0.1),
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: radius.pill, background: color.berry500 }} />
        Available today
      </div>
      <AbsoluteFill style={{ background: color.canvas, opacity: out }} />
    </AbsoluteFill>
  );
};
