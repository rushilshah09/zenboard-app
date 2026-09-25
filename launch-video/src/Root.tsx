import React from "react";
import { Composition, Folder } from "remotion";
import "./brand/fonts";
import { FPS } from "./timeline/beats";
import { S1Styleframe } from "./scenes/S1Noise";
import { S2Styleframe } from "./scenes/S2Collapse";
import { S3Styleframe } from "./scenes/S3Reveal";
import { S4Styleframe } from "./scenes/S4Graph";
import { S5Styleframe } from "./scenes/S5Orbit";
import { S6Styleframe } from "./scenes/S6Flow";
import { S7Styleframe } from "./scenes/S7One";
import { PillsStyleframe } from "./scenes/Pills";
import { OUTRO_FRAMES, Outro, OutroStyleframe } from "./scenes/Outro";
import { MOSAIC_FRAMES, MosaicMorph } from "./scenes/MosaicMorph";
import { AppTest } from "./dev/AppTest";
import { Film } from "./Film";
import { SCENES } from "./scenes/film";
import { FILM, FILM_FRAMES, FilmScene, len } from "./timeline/film";

const size = { width: 1920, height: 1080, fps: FPS };

/**
 * v3 "Everything → One" (DIRECTION_V3.md). Session 1: styleframes only. Each
 * scene is animated after its styleframe is approved (CLAUDE.md, Workflow).
 */
export const STYLEFRAMES: { id: string; component: React.FC }[] = [
  { id: "SF1-Noise", component: S1Styleframe },
  { id: "SF2-Collapse", component: S2Styleframe },
  { id: "SF3-Reveal", component: S3Styleframe },
  { id: "SF4-Graph", component: S4Styleframe },
  { id: "SF5-Orbit", component: S5Styleframe },
  { id: "SF6-Flow", component: S6Styleframe },
  { id: "SF7-One", component: S7Styleframe },
  { id: "SFA-Pills", component: PillsStyleframe },
  { id: "SFB-Outro", component: OutroStyleframe },
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={FILM_FRAMES} {...size} defaultProps={{ score: true }} />
    <Folder name="Scenes">
      {(Object.keys(FILM) as FilmScene[]).map((s) => (
        <Composition key={s} id={`Scene-${s}`} component={SCENES[s]} durationInFrames={len(s)} {...size} />
      ))}
    </Folder>
    <Folder name="Styleframes">
      {STYLEFRAMES.map((s) => (
        <Composition key={s.id} id={s.id} component={s.component} durationInFrames={1} {...size} />
      ))}
    </Folder>
    <Folder name="Tests">
      <Composition id="MosaicMorph" component={MosaicMorph} durationInFrames={MOSAIC_FRAMES} {...size} />
      <Composition id="Outro" component={Outro} durationInFrames={OUTRO_FRAMES} {...size} />
      <Composition id="AppTest" component={AppTest} durationInFrames={1} {...size} />
    </Folder>
  </>
);
