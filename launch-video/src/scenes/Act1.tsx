import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { Illustration } from "../components/Illustration";
import { hasFile } from "../components/media";
import { FRAME, Rect, ZONES } from "../brand/layout";
import { EASE, clamp } from "../brand/motion";
import { colour, radius, shadow } from "../brand/tokens";
import { actRange, frames, sceneStart } from "../brand/timeline";
import { Scene, drift, gridSlot } from "./shared";

/**
 * Act 1 — one person (S01–S02). One two-phrase headline spans both scenes so
 * "And one big idea." stays readable before the card lifts into act 2.
 */
const LINE = "Every business starts with one person.|And one big idea.";
const PHRASE_AT = [16, 110]; // S01-local
const LINE_EXIT = frames("S01") + 68; // S01-local frame, lands inside S02

/** IMG-01 / IMG-07 are full-frame plates; their placeholder holds the right seven columns. */
export const plateRect = (code: "IMG-01" | "IMG-07"): Rect =>
  hasFile(`img/${code}.svg`) || hasFile(`img/${code}.png`) ? { x: 0, y: 0, w: FRAME.w, h: FRAME.h } : ZONES.visualRight;

/** Where the note card lands on the desk, and the size it grows to (S03 opening window). */
const NOTE: Rect = { x: 1240, y: 640, w: 200, h: 200 };
export const OPENING_SCALE = 1.9;

const ActOneHeadline: React.FC<{ offset: number }> = ({ offset }) => {
  const frame = useCurrentFrame() + offset;
  return (
    <Place id="headline" rect={ZONES.headlineLeft} moving={during(frame, [PHRASE_AT[0], PHRASE_AT[0] + 60], [PHRASE_AT[1], PHRASE_AT[1] + 54], [LINE_EXIT, LINE_EXIT + 18])}>
      <Headline text={LINE} at={PHRASE_AT[0] - offset} phraseAt={PHRASE_AT.map((p) => p - offset)} stack exitAt={LINE_EXIT - offset} width={ZONES.headlineLeft.w} />
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
          <Illustration code="IMG-01" rect={{ x: 0, y: 0, ...sizeOf(plateRect("IMG-01")) }} draw={clamp(frame, [0, 72], [0, 1], EASE.breathe)} />
        </Place>
        <ActOneHeadline offset={0} />
      </Camera>
      <Sfx at={PHRASE_AT[0]} sound="pen-tap" volume={0.3} />
    </Scene>
  );
};

const sizeOf = (r: Rect) => ({ w: r.w, h: r.h });

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
          <Illustration code="IMG-01" rect={{ x: 0, y: 0, ...sizeOf(plateRect("IMG-01")) }} draw={1} />
        </Place>
        <ActOneHeadline offset={offset} />
        <Place
          id="note-card"
          rect={NOTE}
          moving={frame < 42}
          style={{ translate: `${-(1 - slideP) * 48}px 0px`, opacity: slideO * (1 - clamp(frame, [72, 84], [0, 1], EASE.settle)) }}
        >
          <Illustration code="IMG-02" rect={{ x: 0, y: 0, w: NOTE.w, h: NOTE.h }} draw={clamp(frame, [4, 40], [0, 1], EASE.breathe)} />
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
