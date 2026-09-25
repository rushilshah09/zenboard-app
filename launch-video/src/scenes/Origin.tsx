import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GlyphField } from "../components/GlyphField";
import { Headline } from "../components/Headline";
import { Illustration, groundOf } from "../components/Illustration";
import { Sfx } from "../components/Sfx";
import { ease, font, light, radius, tween } from "../theme";

/** 01 · "Every business starts with one person… and a big idea." */
export const Origin: React.FC = () => {
  const frame = useCurrentFrame();
  const caretOn = frame < 20 && Math.floor(frame / 8) % 2 === 0;
  const phase2 = tween(frame, [92, 112], [0, 1], ease.inOut);
  const card = tween(frame, [98, 120], [0, 1], ease.spring);
  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 950,
          top: 500,
          fontFamily: font.mono,
          fontSize: 64,
          color: light.text,
          opacity: caretOn ? 1 : 0,
        }}
      >
        /
      </div>
      <GlyphField at={16} gatherAt={88} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: 1 - phase2,
          scale: String(1 - phase2 * 0.08),
          filter: `blur(${phase2 * 10}px)`,
        }}
      >
        <Headline text="Every business starts with" at={14} size={56} tint={light.muted} weight={500} />
        <Headline text="*one person.*" at={30} size={170} tint={light.text} accent={light.text} style={{ marginTop: 8 }} />
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 180, top: 420, width: 760, opacity: phase2 }}>
        <Headline text="…and a big *idea.*" at={100} size={120} tint={light.text} align="left" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 1060,
          top: 200,
          width: 680,
          height: 680,
          borderRadius: radius.xl * 2,
          background: groundOf("founder-idea"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: tween(frame, [98, 104], [0, 1]),
          scale: String(0.8 + card * 0.2),
          translate: `0 ${(1 - card) * 80 + Math.sin(frame / 25) * 6}px`,
          rotate: `${(1 - card) * 6}deg`,
        }}
      >
        <Illustration name="founder-idea" draw={tween(frame, [104, 160], [0, 1], (x) => x)} size={560} />
      </div>

      <Sfx at={16} sound="swipe" volume={0.35} />
      <Sfx at={30} sound="pop" volume={0.3} />
      <Sfx at={90} sound="whoosh" volume={0.3} />
      <Sfx at={100} sound="pop" volume={0.35} />
    </AbsoluteFill>
  );
};
