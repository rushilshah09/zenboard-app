/** The v4 launch film: every scene on its slot, plus the transition overlays that span scene cuts. */
import React from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { SFX } from "./sound";
import { V4, V4Scene, v4At, v4Len } from "./timeline";
import { SCENES_V4 } from "./scenes";
import { Flash, PAPER, s } from "./kit";
import { useCurrentFrame } from "remotion";

const Flashes: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <Flash f={f} at={s(22)} len={10} />
      <Flash f={f} at={s(64)} len={10} />
    </>
  );
};

export const FilmV4: React.FC<{ score?: boolean }> = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    {(Object.keys(V4) as V4Scene[]).map((k) => {
      const C = SCENES_V4[k];
      return C ? (
        <Sequence key={k} from={v4At(k)} durationInFrames={v4Len(k)} name={k}>
          <C />
        </Sequence>
      ) : null;
    })}
    <Flashes />
    {SFX.map(([id, t, v], i) => (
      <Sequence key={i} from={s(t)} name={`sfx ${id}`}>
        <Audio src={staticFile(`audio/sfx/${id}.wav`)} volume={v} />
      </Sequence>
    ))}
    <Audio src={staticFile("audio/film-score.wav")} volume={(f) => 0.32 * interpolate(f, [0, 30, s(69), s(72)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
  </AbsoluteFill>
);
