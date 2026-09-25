import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { Illustration } from "../components/Illustration";
import { Icon } from "../components/Glyph";
import { Rect, ZONES } from "../brand/layout";
import { EASE, clamp } from "../brand/motion";
import { colour, radius, shadow, space } from "../brand/tokens";
import { syncLine, syncedSpan } from "../brand/sync";
import { VO_AT, actRange, frames, sceneStart } from "../brand/timeline";
import { Scene, drift, gridSlot } from "./shared";

/**
 * Act 1 — one person (S01–S02). One two-phrase headline spans both scenes so
 * "And one big idea." stays readable before the card lifts into act 2.
 */
const P1 = "Every business starts with one person.";
const P2 = "And one big idea.";
const LINE = `${P1}|${P2}`;
/** Per-word frames, S01-local: each word appears as it is spoken (S02's clip plays inside S01). */
const WORDS = syncLine([
  [P1, "S01", VO_AT.S01],
  [P2, "S02", VO_AT.S02],
]);
const P2_FIRST = P1.split(" ").length;
const LINE_EXIT = frames("S01") + 50; // S01-local frame, lands inside S02

/** IMG-01 / IMG-07 (the founder's desk, morning and evening) sit in the right six columns. */
export const plateRect = (_code: "IMG-01" | "IMG-07"): Rect => ZONES.visualRight;

/** Where the note card lands on the desk, and the size it grows to (S03 opening window). */
const NOTE: Rect = { x: 1136, y: 560, w: 176, h: 176 };
export const OPENING_SCALE = 1.9;

const ActOneHeadline: React.FC<{ offset: number }> = ({ offset }) => {
  const frame = useCurrentFrame() + offset;
  return (
    <Place
      id="headline"
      rect={ZONES.headlineLeft}
      moving={during(frame, syncedSpan(WORDS.slice(0, P2_FIRST)), syncedSpan(WORDS.slice(P2_FIRST)), [LINE_EXIT, LINE_EXIT + 18])}
    >
      <Headline text={LINE} at={WORDS[0] - offset} wordAt={WORDS.map((w) => w - offset)} stack exitAt={LINE_EXIT - offset} width={ZONES.headlineLeft.w} />
    </Place>
  );
};

export const S01: React.FC = () => {
  const frame = useCurrentFrame();
  const g = sceneStart("S01") + frame;
  return (
    <Scene>
      <Camera scale={drift(g, actRange(1), 1, 1.03)}>
        <Place id="IMG-01" rect={plateRect("IMG-01")}>
          <Illustration code="IMG-01" rect={{ x: 0, y: 0, ...sizeOf(plateRect("IMG-01")) }} draw={clamp(frame, [0, 140], [0, 1], EASE.settle)} parallax={plateParallax(g)} />
        </Place>
        <ActOneHeadline offset={0} />
      </Camera>
      <Sfx at={WORDS[0]} sound="pen-tap" volume={0.3} />
    </Scene>
  );
};

const sizeOf = (r: Rect) => ({ w: r.w, h: r.h });

/** Layers of the desk plate slide apart slowly across act 1 (foreground travels furthest). */
const plateParallax = (g: number) => clamp(g, actRange(1), [0, -28], EASE.breathe);

/** The one big idea: a blank card, a lightbulb and two lines written onto it. */
const NoteCard: React.FC<{ size: number; write: number }> = ({ size, write }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius.card,
      background: colour.card,
      boxShadow: shadow,
      padding: space.s3,
      display: "flex",
      flexDirection: "column",
      gap: space.s2,
    }}
  >
    <Icon name="lightbulb" size={40} tint={colour.ink} style={{ opacity: clamp(write, [0, 0.4], [0, 1]) }} />
    {[1, 0.62].map((w, i) => (
      <div
        key={i}
        style={{
          height: space.s1,
          width: `${w * 100}%`,
          borderRadius: radius.pill,
          background: colour.hairline,
          transformOrigin: "left",
          scale: `${clamp(write, [0.3 + i * 0.3, 0.7 + i * 0.3], [0, 1])} 1`,
        }}
      />
    ))}
  </div>
);

export const S02: React.FC = () => {
  const frame = useCurrentFrame();
  const g = sceneStart("S02") + frame;
  const offset = frames("S01");
  // The note card slides onto the desk, left to right with the story's flow.
  const slideP = clamp(frame, [0, 42], [0, 1], EASE.settle);
  const slideO = clamp(frame, [0, 25], [0, 1], EASE.settle);
  // The card lifts toward camera and flattens into the first window (match cut into S03).
  const grow = clamp(frame, [72, frames("S02")], [0, 1], EASE.settle);
  const plateOut = clamp(frame, [64, 90], [0, 1], EASE.leave);
  const slot = gridSlot(0);
  const target = { w: slot.w * OPENING_SCALE, h: slot.h * OPENING_SCALE };
  const cardW = NOTE.w + (target.w - NOTE.w) * grow;
  const cardH = NOTE.h + (target.h - NOTE.h) * grow;
  const cx = NOTE.x + NOTE.w / 2 + (960 - NOTE.x - NOTE.w / 2) * grow;
  const cy = NOTE.y + NOTE.h / 2 + (540 - NOTE.y - NOTE.h / 2) * grow;
  return (
    <Scene>
      <Camera scale={drift(g, actRange(1), 1, 1.03) * (1 - grow) + grow}>
        <Place id="IMG-01" rect={plateRect("IMG-01")} style={{ opacity: 1 - plateOut, filter: `blur(${plateOut * 8}px)` }}>
          <Illustration code="IMG-01" rect={{ x: 0, y: 0, ...sizeOf(plateRect("IMG-01")) }} draw={1} parallax={plateParallax(g)} />
        </Place>
        <ActOneHeadline offset={offset} />
        <Place
          id="note-card"
          rect={NOTE}
          moving={frame < 42}
          style={{ translate: `${-(1 - slideP) * 48}px 0px`, opacity: slideO * (1 - clamp(frame, [72, 84], [0, 1], EASE.settle)) }}
        >
          <NoteCard size={NOTE.w} write={clamp(frame, [18, 60], [0, 1], EASE.settle)} />
        </Place>
      </Camera>
      {/* The flattening card, in screen space so it lands exactly on S03's opening window.
          Sized at its final size and moved with transform only. */}
      <div
        style={{
          position: "absolute",
          left: 960 - target.w / 2,
          top: 540 - target.h / 2,
          width: target.w,
          height: target.h,
          borderRadius: radius.window * OPENING_SCALE,
          background: colour.card,
          boxShadow: shadow,
          translate: `${cx - 960}px ${cy - 540}px`,
          scale: `${cardW / target.w} ${cardH / target.h}`,
          opacity: clamp(frame, [70, 80], [0, 1], EASE.settle),
        }}
      />
      <Sfx at={2} sound="paper-slide" volume={0.2} />
      <Sfx at={72} sound="lift" volume={0.2} />
    </Scene>
  );
};
