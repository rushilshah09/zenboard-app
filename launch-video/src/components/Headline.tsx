import React from "react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { FONT } from "../brand/fonts";
import { DUR, EASE, clamp, leave, rise } from "../brand/motion";
import { aurora, colour, type, TypeStyle } from "../brand/tokens";

/**
 * The only way text enters the film (§4): words rise 24px and fade in with a
 * 45ms stagger on the Settle curve; lines leave together as one block.
 *
 * Markup: `[word]` is emphasis (shifts colour 200ms after the line lands),
 * `|` splits phrases that can land on their own beats via `phraseAt`.
 */
type Tone = "ink" | "stone" | "pink" | "white" | "whiteMuted";
const TONE: Record<Tone, string> = { ink: colour.ink, stone: colour.stone, pink: colour.pink, white: colour.white, whiteMuted: "rgba(255, 255, 255, 0.62)" };
/** Words arrive warm (Jurni's shimmer): coral → pink → their final colour. */
const shimmer = (frame: number, start: number, to: string) => {
  const p = clamp(frame, [start, start + 26], [0, 1], EASE.settle);
  return p < 0.5 ? interpolateColors(p, [0, 0.5], [aurora.coral, aurora.pink]) : interpolateColors(p, [0.5, 1], [aurora.pink, to]);
};

export const Headline: React.FC<{
  text: string;
  at: number;
  phraseAt?: number[];
  style?: TypeStyle;
  tone?: Tone;
  emphasisFrom?: Tone;
  emphasisTo?: Tone;
  /** Frames between each emphasised word's colour shift ("one by one"). */
  emphasisStagger?: number;
  align?: "left" | "center";
  /** Put each phrase on its own line. */
  stack?: boolean;
  exitAt?: number;
  width?: number;
  /** Per-word start frames (from syncWords): words appear exactly as they are spoken. */
  wordAt?: number[];
}> = ({
  text,
  at,
  phraseAt,
  style = "headline",
  tone = "ink",
  emphasisFrom = "stone",
  emphasisTo = "ink",
  emphasisStagger = 0,
  align = "left",
  stack = false,
  exitAt,
  width,
  wordAt,
}) => {
  const frame = useCurrentFrame();
  const phrases = text.split("|").map((p) => p.trim().split(/\s+/));
  const starts = phrases.map((_, i) => phraseAt?.[i] ?? at);
  // A phrase without its own start flows on from the previous one.
  if (!phraseAt) {
    let t = at;
    phrases.forEach((words, i) => {
      starts[i] = t;
      t += words.length * DUR.wordStagger;
    });
  }
  const lastPhrase = phrases.length - 1;
  const landed = wordAt ? wordAt[wordAt.length - 1] + DUR.settle : starts[lastPhrase] + (phrases[lastPhrase].length - 1) * DUR.wordStagger + DUR.settle;
  // Synced words rise faster so each is readable the moment it is heard.
  const riseDur = wordAt ? 24 : DUR.settle;
  let wordIndex = 0;
  const block = exitAt !== undefined ? leave(frame, exitAt) : { opacity: 1, translate: "0 0px" };

  let emphasisIndex = 0;
  const renderWord = (raw: string, flowStart: number, key: string) => {
    const start = wordAt ? wordAt[wordIndex] ?? flowStart : flowStart;
    wordIndex++;
    const isEmphasis = raw.includes("[");
    const word = raw.replace(/[[\]]/g, "");
    let fill = style === "ui" || style === "caption" ? TONE[tone] : shimmer(frame, start, TONE[tone]);
    if (isEmphasis) {
      // Synced lines shift each emphasised word as it is spoken; others after the line lands.
      const shiftAt = wordAt ? start + 8 : landed + DUR.colourDelay + emphasisIndex * emphasisStagger;
      emphasisIndex++;
      const p = clamp(frame, [shiftAt, shiftAt + DUR.colourShift], [0, 1], EASE.settle);
      fill = interpolateColors(p, [0, 1], [TONE[emphasisFrom], TONE[emphasisTo]]);
    }
    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          color: fill,
          marginRight: "0.26em",
          ...rise(frame, start, { dist: 28, dur: riseDur }),
          filter: `blur(${(1 - clamp(frame, [start, start + riseDur * 0.7], [0, 1], EASE.settle)) * 10}px)`,
        }}
      >
        {word}
      </span>
    );
  };

  return (
    <div
      style={{
        fontFamily: FONT,
        ...type[style],
        textAlign: align,
        width,
        opacity: block.opacity,
        translate: block.translate,
      }}
    >
      {phrases.map((words, pi) => {
        const nodes = words.map((w, wi) => renderWord(w, starts[pi] + wi * DUR.wordStagger, `${pi}-${wi}`));
        return stack ? <div key={pi}>{nodes}</div> : <React.Fragment key={pi}>{nodes}</React.Fragment>;
      })}
    </div>
  );
};
