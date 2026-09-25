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
];

export const RemotionRoot: React.FC = () => (
  <Folder name="Styleframes">
    {STYLEFRAMES.map((s) => (
      <Composition key={s.id} id={s.id} component={s.component} durationInFrames={1} {...size} />
    ))}
  </Folder>
);
