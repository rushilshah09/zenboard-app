/** The v4 launch film: every scene on its slot, plus the transition overlays that span scene cuts. */
import React from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { SFX } from "./sound";
import { VO4, voDur } from "./vo";
import { V4, V4Scene, v4At, v4Len } from "./timeline";
import { SCENES_V4 } from "./scenes";
import { Flash, PAPER, s } from "./kit";
import { useCurrentFrame } from "remotion";

/** Score ducks to 55% under each voice-over line, with short ramps. */
const duck = (f: number) => {
  let d = 1;
  for (const [id, t] of VO4) {
    const a = s(t), b = s(t + voDur(id));
    d = Math.min(d, interpolate(f, [a - 12, a, b, b + 20], [1, 0.55, 0.55, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  }
  return d;
};

const Flashes: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <Flash f={f} at={s(23.5)} len={10} />
      <Flash f={f} at={s(65.5)} len={10} />
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
    {VO4.map(([id, t]) => (
      <Sequence key={id} from={s(t)} name={`vo ${id}`}>
        <Audio src={staticFile(`audio/vo4/${id}.wav`)} volume={1.15} />
      </Sequence>
    ))}
    <Audio src={staticFile("audio/film-score.wav")} volume={(f) => 0.3 * duck(f) * interpolate(f, [0, 30, s(70.5), s(73.5)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
  </AbsoluteFill>
);
