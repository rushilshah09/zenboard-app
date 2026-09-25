import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Caret } from "../components/primitives";
import { TypingSfx } from "../components/Sfx";
import { color, font, tween } from "../theme";

/** 07 · Silence. A caret, then the question. */

const LEAD = "What if it all lived in ";
const ACCENT = "one place?";
const TYPE_AT = 24;
const CPS = 17;

export const Pause: React.FC = () => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor(((frame - TYPE_AT) / 30) * CPS));
  const lead = LEAD.slice(0, n);
  const accent = ACCENT.slice(0, Math.max(0, n - LEAD.length));
  const out = tween(frame, [128, 142], [0, 1]);
  const dot = tween(frame, [136, 150], [0, 1]);
  return (
    <AbsoluteFill style={{ background: color.canvas, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: font.sans,
          fontSize: 92,
          fontWeight: 500,
          letterSpacing: "-0.035em",
          color: color.ink900,
          opacity: 1 - out,
          filter: `blur(${out * 12}px)`,
        }}
      >
        {lead}
        <span style={{ fontFamily: font.serif, fontStyle: "italic", fontWeight: 400, color: color.berry300 }}>{accent}</span>
        <Caret height={88} />
      </div>
      <div
        style={{
          position: "absolute",
          width: 18,
          height: 18,
          borderRadius: 999,
          background: color.berry500,
          scale: String(dot),
          boxShadow: `0 0 ${60 * dot}px ${color.berry500}`,
        }}
      />
      <TypingSfx at={TYPE_AT} chars={LEAD.length + ACCENT.length} cps={CPS} volume={0.3} />
    </AbsoluteFill>
  );
};
