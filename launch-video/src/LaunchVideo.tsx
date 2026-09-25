import React from "react";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { interpolate, staticFile } from "remotion";
import { Scatter } from "./scenes/Scatter";
import { WordWall } from "./scenes/WordWall";
import { LogoReveal } from "./scenes/LogoReveal";
import { Today } from "./scenes/Today";
import { Command } from "./scenes/Command";
import { Collage } from "./scenes/Collage";
import { Spine } from "./scenes/Spine";
import { Kinetic } from "./scenes/Kinetic";
import { Outro } from "./scenes/Outro";

export const SCENES = {
  Scatter: 150,
  WordWall: 96,
  LogoReveal: 105,
  Today: 150,
  Command: 150,
  Collage: 150,
  Spine: 170,
  Kinetic: 110,
  Outro: 140,
} as const;

const FADE = 10;
const FADE_LONG = 12;

export const LAUNCH_DURATION =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - FADE - FADE_LONG * 2;

export const LaunchVideo: React.FC = () => (
  <>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Scatter" durationInFrames={SCENES.Scatter}>
        <Scatter />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
      <TransitionSeries.Sequence name="WordWall" durationInFrames={SCENES.WordWall}>
        <WordWall />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="LogoReveal" durationInFrames={SCENES.LogoReveal}>
        <LogoReveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_LONG })} />
      <TransitionSeries.Sequence name="Today" durationInFrames={SCENES.Today}>
        <Today />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Command" durationInFrames={SCENES.Command}>
        <Command />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Collage" durationInFrames={SCENES.Collage}>
        <Collage />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Spine" durationInFrames={SCENES.Spine}>
        <Spine />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Kinetic" durationInFrames={SCENES.Kinetic}>
        <Kinetic />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_LONG })} />
      <TransitionSeries.Sequence name="Outro" durationInFrames={SCENES.Outro}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio
      src={staticFile("music.wav")}
      volume={(f) =>
        interpolate(f, [0, 20, LAUNCH_DURATION - 45, LAUNCH_DURATION], [0, 0.7, 0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  </>
);
