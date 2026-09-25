import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";

type Sound = "whoosh" | "mouse-click" | "switch" | "ding";

/** Plays a sound effect from public/ at a frame relative to the parent scene. */
export const Sfx: React.FC<{ at: number; sound: Sound; volume?: number }> = ({ at, sound, volume = 0.5 }) => (
  <Sequence from={at} layout="none" name={`sfx:${sound}`}>
    <Audio src={staticFile(`${sound}.wav`)} volume={volume} />
  </Sequence>
);
