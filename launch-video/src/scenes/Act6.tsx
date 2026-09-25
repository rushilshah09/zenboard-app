import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { Illustration } from "../components/Illustration";
import { Aura, Mark, Wordmark } from "../components/ZenMark";
import { FONT } from "../brand/fonts";
import { Rect, ZONES, col, span } from "../brand/layout";
import { EASE, clamp, leave, rise } from "../brand/motion";
import { colour, radius, type } from "../brand/tokens";
import { frames, sceneStart } from "../brand/timeline";
import { plateRect } from "./Act1";
import { LOCKUP, TAGLINE_TEXT, lockupMark } from "./Act4";
import { S16_HEADLINE } from "./Act5";
import { Scene, drift } from "./shared";

/** Act 6 — Zenboard (S17–S18). S17 mirrors S01: same desk, now evening. */

const PHRASES_S17 = [16, 60, 104];

export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S17");
  const g = sceneStart("S17") + frame;
  const plate = plateRect("IMG-07");
  const out = leave(frame, len - 24);
  return (
    <Scene>
      <Camera scale={drift(g, [sceneStart("S17"), sceneStart("S17") + len], 1, 1.03)}>
        {/* S16's line leaves first. */}
        <Place id="s16-headline" rect={ZONES.headlineTop} moving={frame < 18}>
          <Headline text={S16_HEADLINE} at={8 - frames("S16")} align="center" width={ZONES.headlineTop.w} exitAt={0} />
        </Place>
        <Place id="IMG-07" rect={plate} style={{ opacity: out.opacity }}>
          <Illustration code="IMG-07" rect={{ x: 0, y: 0, w: plate.w, h: plate.h }} draw={clamp(frame, [8, 80], [0, 1], EASE.breathe)} />
        </Place>
        <Place id="headline" rect={ZONES.headlineLeft} moving={during(frame, [PHRASES_S17[0], PHRASES_S17[2] + 50], [len - 24, len])}>
          <Headline text="One workspace.|One subscription.|One focus." at={PHRASES_S17[0]} phraseAt={PHRASES_S17} stack exitAt={len - 24} width={ZONES.headlineLeft.w} />
        </Place>
      </Camera>
      <Sfx at={4} sound="breath" volume={0.06} />
    </Scene>
  );
};

const CTA: Rect = { x: 960 - 140, y: 700, w: 280, h: 64 };
const TAG: Rect = { x: col(1), y: 572, w: span(12), h: 48 };

export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const m = lockupMark();
  const breathe = 1 + Math.sin((frame / 150) * Math.PI * 2) * 0.02;
  return (
    <Scene>
      <Camera scale={1}>
        <div style={{ position: "absolute", left: 960 - 450, top: m.y - 450, width: 900, height: 900, scale: String(breathe), ...rise(frame, 0, { dist: 0, dur: 90, easing: EASE.breathe }) }}>
          <Aura size={900} />
        </div>
        <Place id="mark" rect={{ x: m.x - 60, y: m.y - 60, w: 120, h: 120 }} style={rise(frame, 8, { dist: 24, scale: true })}>
          <Mark size={LOCKUP.markSize} />
        </Place>
        <Place id="wordmark" rect={{ x: m.x + 60 + LOCKUP.gap, y: m.y - 60, w: LOCKUP.wordW + 40, h: 120 }} style={rise(frame, 20, { dist: 24 })}>
          <Wordmark />
        </Place>
        <Place id="tagline" rect={TAG}>
          <Headline text={TAGLINE_TEXT} at={40} style="subhead" tone="stone" emphasisTo="ink" emphasisStagger={12} align="center" width={TAG.w} />
        </Place>
        <Place id="cta" rect={CTA} style={rise(frame, 72, { dist: 24 })}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius.pill,
              background: colour.ink,
              color: colour.paper,
              fontFamily: FONT,
              ...type.uiStrong,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Available today
          </div>
        </Place>
      </Camera>
      <Sfx at={8} sound="chime-resolved" volume={0.9} />
    </Scene>
  );
};
