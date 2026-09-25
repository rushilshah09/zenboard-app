import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { LockupLetters, LogoReveal, REVEAL_FILM, RevealGeometry, RevealTiming } from "../components/LogoReveal";
import { LOCKUP_VIEWBOX } from "../brand/logo.generated";
import { Rect, col, span } from "../brand/layout";
import { EASE, clamp, leave } from "../brand/motion";
import { syncWords, syncedSpan } from "../brand/sync";
import { VO_AT, frames } from "../brand/timeline";
import { lookIn } from "../brand/look";
import { colour } from "../brand/tokens";
import { Scene } from "./shared";

/**
 * Act 4 — the breath (S08) and the reveal (S09). S08 sets the eight app tiles
 * in a row under the question; S09 turns them into the mark (LogoReveal).
 * Both scenes render the same reveal on one clock, so the hand-off is seamless.
 */

export const QUESTION: Rect = { x: col(1), y: 336, w: span(12), h: 80 };
const QUESTION_TEXT = "What if it all lived in one place?";
const Q_WORDS = syncWords(QUESTION_TEXT, "S08", VO_AT.S08);

/** The lockup (real mark + wordmark from the app), centred. */
const MARK = 132;
const LOCKUP_W = (LOCKUP_VIEWBOX.w / 32) * MARK;
export const LOCKUP = { markSize: MARK };
export const GEOMETRY: RevealGeometry = {
  row: Array.from({ length: 8 }, (_, i) => ({ x: col(1) + 60 + (i * (span(12) - 120)) / 7, y: 560 })),
  spin: { x: 960, y: 500 },
  markSize: MARK,
  lockup: { x: 960 - LOCKUP_W / 2, y: 404 },
};
/** Centre of the settled mark in the lockup (S10 flies it into the sidebar). */
export const lockupMark = () => ({ x: GEOMETRY.lockup.x + MARK / 2, y: GEOMETRY.lockup.y + MARK / 2 });
const LOCKUP_RECT: Rect = { x: GEOMETRY.lockup.x, y: GEOMETRY.lockup.y, w: LOCKUP_W, h: MARK };
const ROW_RECT: Rect = { x: col(1), y: 500, w: span(12), h: 120 };
const RING_RECT: Rect = { x: 960 - 400, y: 100, w: 800, h: 800 };

/** S08 and S09 share one clock: S09 frame 0 is reveal frame 0. */
const FILM: RevealTiming = { ...REVEAL_FILM, enter: 16 - frames("S08") };

export const TAGLINE: Rect = { x: col(1), y: 584, w: span(12), h: 48 };
export const TAGLINE_TEXT = "The single platform to manage [work], [life], and [business].";
const TAG_WORDS = syncWords(TAGLINE_TEXT, "S09", VO_AT.S09);

export const S08: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame - frames("S08");
  return (
    <Scene>
      <Camera scale={1 + 0.02 * clamp(frame, [0, frames("S08")], [0, 1], EASE.breathe)}>
        <LogoReveal frame={f} geometry={GEOMETRY} timing={FILM} dark={1} />
        {/* The tile row counts as one object; it breathes in place under the question. */}
        <Place id="tile-row" rect={ROW_RECT} visible={frame >= 16} moving={frame < 16 + 7 * 4 + 36}>
          <div />
        </Place>
        <Place id="headline" rect={QUESTION} visible={frame >= Q_WORDS[0]} moving={during(frame, syncedSpan(Q_WORDS))}>
          <Headline text={QUESTION_TEXT} at={Q_WORDS[0]} wordAt={Q_WORDS} tone="white" align="center" width={QUESTION.w} />
        </Place>
      </Camera>
      <Sfx at={16} sound="breath" volume={0.08} />
    </Scene>
  );
};

export const S09: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S09");
  // After the reveal the camera keeps a slow push so the lockup never sits dead still.
  const push = clamp(frame, [FILM.slide[0], len], [0, 1], EASE.breathe);
  return (
    <Scene>
      <Camera scale={1.02 + 0.07 * push}>
        {/* S08's question leaves as the tiles lift (exit before enter). */}
        <Place id="question" rect={QUESTION} moving={frame < 18} visible={frame < 18}>
          <Headline text={QUESTION_TEXT} at={-400} tone="white" align="center" width={QUESTION.w} exitAt={0} />
        </Place>
        <LogoReveal
          frame={frame}
          geometry={GEOMETRY}
          timing={FILM}
          dark={1}
          brand={lookIn("S09", frame).brand}
          tagline={
            <Place id="tagline" rect={TAGLINE} visible={frame >= TAG_WORDS[0]} moving={during(frame, syncedSpan(TAG_WORDS))}>
              <Headline text={TAGLINE_TEXT} at={TAG_WORDS[0]} wordAt={TAG_WORDS} style="subhead" tone="whiteMuted" emphasisFrom="whiteMuted" emphasisTo="white" align="center" width={TAGLINE.w} />
            </Place>
          }
        />
        <Place id="ring" rect={RING_RECT} visible={frame >= FILM.lift[0] + 10 && frame < FILM.fuse[1]} moving>
          <div />
        </Place>
        <Place id="lockup" rect={LOCKUP_RECT} visible={frame >= FILM.fuse[1]} moving={frame < FILM.slide[1] + 20}>
          <div />
        </Place>
      </Camera>
      <Sfx at={FILM.lift[0]} sound="whoosh-soft" volume={0.25} />
      <Sfx at={FILM.spiral[0]} sound="thread" volume={0.2} />
      {[0, 1, 2, 3].map((k) => (
        <Sfx key={k} at={FILM.pair[0] + 14 + k * 11} sound="tick-tuned" variant={k * 2} volume={0.25} />
      ))}
      <Sfx at={FILM.pink[0]} sound="chime" volume={0.9} />
      <Sfx at={FILM.slide[0]} sound="whoosh-soft" volume={0.18} />
    </Scene>
  );
};

/** For S10: the lockup's wordmark and tagline leaving while the mark travels on. */
export const LockupLeaving: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <Place id="wordmark" rect={LOCKUP_RECT} moving={frame < 18} visible={frame < 18}>
      <LockupLetters geometry={GEOMETRY} fill={colour.white} style={{ left: 0, top: 0, ...leave(frame, 0), clipPath: `inset(-20% -10% -20% ${(34 / LOCKUP_VIEWBOX.w) * 100}%)` }} />
    </Place>
    <Place id="tagline" rect={TAGLINE} moving={frame < 18} visible={frame < 18}>
      <Headline text={TAGLINE_TEXT} at={-400} style="subhead" tone="whiteMuted" emphasisTo="white" align="center" width={TAGLINE.w} exitAt={0} />
    </Place>
  </>
);
