import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, getStaticFiles, staticFile } from "remotion";

export type Sound =
  | "pop"
  | "tick"
  | "key-1"
  | "key-2"
  | "key-3"
  | "thud"
  | "snap"
  | "whoosh"
  | "swipe"
  | "riser"
  | "impact"
  | "shimmer"
  | "chime"
  | "glitch";

/** Plays a sound from public/sfx at a frame relative to the parent scene. */
export const Sfx: React.FC<{ at: number; sound: Sound; volume?: number }> = ({ at, sound, volume = 0.5 }) => (
  <Sequence from={Math.round(at)} layout="none" name={`sfx:${sound}`}>
    <Audio src={staticFile(`sfx/${sound}.wav`)} volume={volume} />
  </Sequence>
);

/** Typing clicks: one key sound per character, cycling through the key variants. */
export const TypingSfx: React.FC<{ at: number; chars: number; cps?: number; volume?: number }> = ({
  at,
  chars,
  cps = 22,
  volume = 0.25,
}) => (
  <>
    {Array.from({ length: chars }, (_, i) => (
      <Sfx key={i} at={at + (i * 30) / cps} sound={(["key-1", "key-2", "key-3"] as const)[i % 3]} volume={volume} />
    ))}
  </>
);

const hasFile = (path: string) => getStaticFiles().some((f) => f.name === path);

/** Voice-over slot: plays public/vo/<id>.mp3 if it has been added. */
export const Voiceover: React.FC<{ id: string; at: number }> = ({ id, at }) => {
  const path = `vo/${id}.mp3`;
  if (!hasFile(path)) return null;
  return (
    <Sequence from={at} layout="none" name={`vo:${id}`}>
      <Audio src={staticFile(path)} volume={1} />
    </Sequence>
  );
};

export { hasFile };
