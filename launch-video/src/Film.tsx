import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, Series, getStaticFiles, interpolate, staticFile } from "remotion";
import { hasFile } from "./components/media";
import { colour } from "./brand/tokens";
import { SCENES, SceneId, TOTAL_FRAMES, beat } from "./brand/timeline";
import { S01, S02 } from "./scenes/Act1";
import { S03, S04 } from "./scenes/Act2";
import { S05, S06, S07 } from "./scenes/Act3";
import { S08, S09 } from "./scenes/Act4";
import { S10, S11, S12, S13, S14, S15, S16 } from "./scenes/Act5";
import { S17, S18 } from "./scenes/Act6";

export const SCENE: Record<SceneId, React.FC> = { S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S14, S15, S16, S17, S18 };

/** Music sits 3dB lower under any voice-over (§6). */
const hasVoiceover = () => getStaticFiles().some((f) => f.name.startsWith("vo/") && f.name.endsWith(".mp3"));

/** The whole film: a <Series> of scenes on one Paper surface, driven by timeline.ts. */
export const Film: React.FC = () => {
  const bed = hasVoiceover() ? 0.71 : 1;
  return (
    <AbsoluteFill style={{ background: colour.paper }}>
      <Series>
        {SCENES.map((s) => {
          const Scene = SCENE[s.id];
          return (
            <Series.Sequence key={s.id} name={s.id} durationInFrames={beat(s.beats)}>
              <Scene />
            </Series.Sequence>
          );
        })}
      </Series>
      {/* IMG-04: optional paper grain over everything at 3.5%. */}
      {hasFile("img/IMG-04.png") ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <Img src={staticFile("img/IMG-04.png")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.035 }} />
        </AbsoluteFill>
      ) : null}
      <Audio
        src={staticFile("audio/score.wav")}
        volume={(f) => interpolate(f, [0, TOTAL_FRAMES - 30, TOTAL_FRAMES], [bed, bed, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </AbsoluteFill>
  );
};

