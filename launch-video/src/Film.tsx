import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { sec } from "./timeline/beats";
import { FILM, FilmScene, VO, at, len } from "./timeline/film";
import { SCENES } from "./scenes/film";

/** The launch film: every scene on its slot, the voice-over and the score on top. */
export const Film: React.FC<{ score?: boolean }> = ({ score = true }) => (
  <AbsoluteFill style={{ background: "#120109" }}>
    {(Object.keys(FILM) as FilmScene[]).map((s) => {
      const C = SCENES[s];
      return (
        <Sequence key={s} from={at(s)} durationInFrames={len(s)} name={s}>
          <C />
        </Sequence>
      );
    })}
    {VO.map(([id, t]) => (
      <Sequence key={id} from={sec(t)} name={`vo ${id}`}>
        <Audio src={staticFile(`audio/vo/${id}.wav`)} volume={1} />
      </Sequence>
    ))}
    {score ? <Audio src={staticFile("audio/film-score.wav")} volume={1} /> : null}
  </AbsoluteFill>
);
