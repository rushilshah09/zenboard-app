import React from "react";
import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import { getStaticFiles, interpolate, staticFile } from "remotion";
import { GradientSweep } from "./components/GradientSweep";
import { Voiceover } from "./components/Sfx";
import { Calm } from "./scenes/Calm";
import { Disconnected } from "./scenes/Disconnected";
import { Flow } from "./scenes/Flow";
import { Friday } from "./scenes/Friday";
import { Life } from "./scenes/Life";
import { Origin } from "./scenes/Origin";
import { Outro } from "./scenes/Outro";
import { Pause } from "./scenes/Pause";
import { Reveal } from "./scenes/Reveal";
import { Switching } from "./scenes/Switching";
import { ToolPile } from "./scenes/ToolPile";
import { TourDocs, TourMoney, TourPortal, TourToday } from "./scenes/Tour";
import { WorkArrives } from "./scenes/WorkArrives";
import { SceneId, TIMELINE, TOTAL_FRAMES } from "./timeline";

export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  origin: Origin,
  "work-arrives": WorkArrives,
  "tool-pile": ToolPile,
  disconnected: Disconnected,
  switching: Switching,
  friday: Friday,
  pause: Pause,
  reveal: Reveal,
  "tour-today": TourToday,
  "tour-docs": TourDocs,
  "tour-money": TourMoney,
  "tour-portal": TourPortal,
  life: Life,
  flow: Flow,
  calm: Calm,
  outro: Outro,
};

/** Cuts that get a soft colour wash (overlay: does not shift the timeline). */
const SWEEP_BEFORE = new Set<SceneId>(["disconnected", "tour-today", "life", "flow", "calm"]);

/** Music sits lower once any voice-over clip has been added. */
const hasVoiceover = () => getStaticFiles().some((f) => f.name.startsWith("vo/") && f.name.endsWith(".mp3"));

export const LaunchVideo: React.FC = () => {
  const bed = hasVoiceover() ? 0.32 : 0.75;
  return (
    <>
      <TransitionSeries>
        {TIMELINE.flatMap((s) => {
          const Scene = SCENE_COMPONENTS[s.id];
          const nodes = [];
          if (SWEEP_BEFORE.has(s.id)) {
            nodes.push(
              <TransitionSeries.Overlay key={`sweep-${s.id}`} durationInFrames={24}>
                <GradientSweep />
              </TransitionSeries.Overlay>,
            );
          }
          nodes.push(
            <TransitionSeries.Sequence key={s.id} name={s.id} durationInFrames={s.frames}>
              <Scene />
              <Voiceover id={s.id} at={s.voAt} />
            </TransitionSeries.Sequence>,
          );
          return nodes;
        })}
      </TransitionSeries>
      <Audio
        src={staticFile("music.wav")}
        volume={(f) =>
          interpolate(f, [0, 15, TOTAL_FRAMES - 40, TOTAL_FRAMES], [0, bed, bed, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </>
  );
};
