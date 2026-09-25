import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Headline } from "../components/Headline";
import { LogoReveal, REVEAL, RevealGeometry } from "../components/LogoReveal";
import { LOCKUP_VIEWBOX } from "../brand/logo.generated";
import { col, span } from "../brand/layout";
import { colour } from "../brand/tokens";

/** Standalone preview of the new logo reveal (6s at 60fps), for sign-off before it replaces S08–S09. */
const MARK = 132;
const LOCKUP_W = (LOCKUP_VIEWBOX.w / 32) * MARK;
export const CONCEPT_GEOMETRY: RevealGeometry = {
  row: Array.from({ length: 8 }, (_, i) => ({ x: col(1) + 60 + (i * (span(12) - 120)) / 7, y: 560 })),
  spin: { x: 960, y: 500 },
  markSize: MARK,
  lockup: { x: 960 - LOCKUP_W / 2, y: 404 },
};

export const LogoConcept: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: colour.paper, overflow: "hidden" }}>
      <LogoReveal
        frame={frame}
        geometry={CONCEPT_GEOMETRY}
        tagline={
          <div style={{ position: "absolute", left: col(1), top: 600, width: span(12) }}>
            <Headline text="The single platform to manage [work], [life], and [business]." at={REVEAL.slide[1] - 6} style="subhead" tone="stone" emphasisTo="ink" emphasisStagger={10} align="center" width={span(12)} />
          </div>
        }
      />
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Img src={staticFile("img/IMG-04.png")} style={{ width: "100%", height: "100%", opacity: 0.035 }} />
      </AbsoluteFill>
      <Sfx at={REVEAL.lift[0]} sound="whoosh-soft" volume={0.25} />
      <Sfx at={REVEAL.spiral[0]} sound="thread" volume={0.2} />
      {[0, 1, 2, 3].map((k) => (
        <Sfx key={k} at={REVEAL.pair[0] + 18 + k * 12} sound="tick-tuned" variant={k * 2} volume={0.25} />
      ))}
      <Sfx at={REVEAL.pink[0]} sound="chime" volume={0.9} />
      <Sfx at={REVEAL.slide[0]} sound="whoosh-soft" volume={0.2} />
    </AbsoluteFill>
  );
};
