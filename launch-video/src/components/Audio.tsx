import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";

export type Sound =
  | "pen-tap"
  | "paper-slide"
  | "lift"
  | "notify"
  | "click"
  | "paper-tear"
  | "key"
  | "cmd-tab"
  | "breath"
  | "chime"
  | "chime-single"
  | "chime-resolved"
  | "tick-tuned"
  | "ui-click"
  | "snap"
  | "thread"
  | "whoosh-soft";

/**
 * One sound effect from public/audio/sfx, at a frame relative to its scene.
 * `variant` picks a pitched file (notify-3.wav, tick-tuned-5.wav …).
 */
export const Sfx: React.FC<{ at: number; sound: Sound; variant?: number; volume?: number }> = ({ at, sound, variant, volume = 1 }) => (
  <Sequence from={Math.round(at)} layout="none" name={`sfx:${sound}${variant ?? ""}`}>
    <Audio src={staticFile(`audio/sfx/${sound}${variant !== undefined ? `-${variant}` : ""}.wav`)} volume={volume} />
  </Sequence>
);
