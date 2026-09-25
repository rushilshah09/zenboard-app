import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GlyphField } from "../components/GlyphField";
import { Headline } from "../components/Headline";
import { LogoLockup } from "../components/Logo";
import { Sfx } from "../components/Sfx";
import { color, ease, font, radius, tween } from "../theme";

/** 16 · End card: the glyphs gather into the mark. */
const LOGO_AT = 26;

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const pill = tween(frame, [112, 126], [0, 1], ease.spring);
  const out = tween(frame, [222, 240], [0, 1]);
  const lift = tween(frame, [70, 96], [0, 1], ease.inOut);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 44%, ${color.paper2} 0%, ${color.canvas} 62%)`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font.sans,
      }}
    >
      <GlyphField at={0} gatherAt={14} dark spread={700} />
      <div style={{ translate: `0 ${-lift * 70}px`, opacity: frame >= LOGO_AT ? 1 : 0 }}>
        <LogoLockup frame={frame - LOGO_AT} size={180} />
      </div>
      <div style={{ position: "absolute", top: 610, width: 1600 }}>
        <Headline text="Everything you run, *in one place.*" at={78} size={60} tint={color.ink700} accent={color.berry300} weight={500} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 730,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 34,
          fontWeight: 500,
          color: color.ink900,
          padding: "16px 36px",
          borderRadius: radius.pill,
          border: `1px solid ${color.line3}`,
          opacity: pill,
          scale: String(0.85 + pill * 0.15),
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: radius.pill, background: color.berry500 }} />
        Available today
      </div>
      <AbsoluteFill style={{ background: color.canvas, opacity: out }} />
      <Sfx at={0} sound="swipe" volume={0.3} />
      <Sfx at={LOGO_AT} sound="shimmer" volume={0.45} />
      <Sfx at={LOGO_AT} sound="impact" volume={0.35} />
      <Sfx at={112} sound="pop" volume={0.35} />
    </AbsoluteFill>
  );
};
