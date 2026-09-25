import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx, Voiceover } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { Aura, Mark, Wordmark } from "../components/ZenMark";
import { Rect, col, span } from "../brand/layout";
import { EASE, clamp, leave, rise } from "../brand/motion";
import { colour, radius } from "../brand/tokens";
import { frames } from "../brand/timeline";
import { Scene } from "./shared";

/** Act 4 — the breath (S08) and the reveal (S09). */

const OUTLINE = 120;
const ROW_Y = 600;
const MERGE = { x: 960, y: ROW_Y + OUTLINE / 2 };
const outlineRect = (i: number): Rect => ({ x: col(1) + (i * (span(12) - OUTLINE)) / 7, y: ROW_Y, w: OUTLINE, h: OUTLINE });
export const QUESTION: Rect = { x: col(1), y: 336, w: span(12), h: 80 };
const Q_AT = 40;
const MERGE_AT = 104;

/** The lockup, centred: mark, 32px, wordmark (Display). */
export const LOCKUP = { markSize: 120, gap: 32, wordW: 528, cy: 470 };
export const lockupMark = () => {
  const total = LOCKUP.markSize + LOCKUP.gap + LOCKUP.wordW;
  return { x: 960 - total / 2 + LOCKUP.markSize / 2, y: LOCKUP.cy };
};
const WORD_RECT = (): Rect => {
  const m = lockupMark();
  return { x: m.x + LOCKUP.markSize / 2 + LOCKUP.gap, y: LOCKUP.cy - 60, w: LOCKUP.wordW + 40, h: 120 };
};
export const TAGLINE: Rect = { x: col(1), y: 584, w: span(12), h: 48 };
export const TAGLINE_TEXT = "The single platform to manage [work], [life], and [business].";

export const S08: React.FC = () => {
  const frame = useCurrentFrame();
  const merge = clamp(frame, [MERGE_AT, frames("S08") - 4], [0, 1], EASE.breathe);
  const point = clamp(frame, [frames("S08") - 30, frames("S08") - 4], [0, 1], EASE.settle);
  return (
    <Scene>
      <Camera scale={1}>
        {Array.from({ length: 8 }, (_, i) => {
          const r = outlineRect(i);
          const dx = (MERGE.x - (r.x + r.w / 2)) * merge;
          const enter = rise(frame, 16 + i * 3, { dist: 48 });
          return (
            <div key={i} style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              opacity: (enter.opacity as number) * (1 - clamp(merge, [0.75, 1], [0, 1], EASE.settle)),
              translate: merge > 0 ? `${dx}px 0px` : enter.translate,
              scale: String(1 - merge * 0.85),
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: radius.window, border: `2px solid ${colour.hairline}` }} />
            </div>
          );
        })}
        {/* The outline row counts as one object; while merging it is one converging shape. */}
        <Place id="outline-row" rect={{ x: col(1), y: ROW_Y, w: span(12), h: OUTLINE }} visible={frame >= 16} moving={frame < 16 + 7 * 3 + 42 || (merge > 0 && merge < 1)}>
          <div />
        </Place>
        <div style={{ position: "absolute", left: MERGE.x - 6, top: MERGE.y - 6, width: 12, height: 12, borderRadius: radius.pill, background: colour.hairline, opacity: point }} />
        <Place id="headline" rect={QUESTION} visible={frame >= Q_AT} moving={during(frame, [Q_AT, Q_AT + 64])}>
          <Headline text="What if it all lived in one place?" at={Q_AT} align="center" width={QUESTION.w} />
        </Place>
      </Camera>
      <Sfx at={16} sound="breath" volume={0.08} />
      <Voiceover id="S08" at={Q_AT} />
    </Scene>
  );
};

export const S09: React.FC = () => {
  const frame = useCurrentFrame();
  const bloom = rise(frame, 6, { dist: 0, scale: true });
  const travel = clamp(frame, [30, 30 + 42], [0, 1], EASE.settle);
  const m = lockupMark();
  const mx = MERGE.x + (m.x - MERGE.x) * travel;
  const my = MERGE.y + (m.y - MERGE.y) * travel;
  const aura = clamp(frame, [6, 60], [0, 1], EASE.breathe);
  const breathe = 1 + Math.sin((frame / 150) * Math.PI * 2) * 0.02;
  return (
    <Scene>
      <Camera scale={1}>
        <div style={{ position: "absolute", left: 960 - 450, top: m.y - 450, width: 900, height: 900, opacity: aura, scale: String(breathe) }}>
          <Aura size={900} />
        </div>
        {/* S08's question leaves as the point blooms (exit before enter). */}
        <Place id="question" rect={QUESTION} moving={frame < 18}>
          <Headline text="What if it all lived in one place?" at={Q_AT - frames("S08")} align="center" width={QUESTION.w} exitAt={0} />
        </Place>
        <Place id="mark" rect={{ x: mx - 60, y: my - 60, w: 120, h: 120 }} moving={travel > 0 && travel < 1} style={bloom}>
          <Mark size={LOCKUP.markSize} />
        </Place>
        <Place id="wordmark" rect={WORD_RECT()} style={rise(frame, 52, { dist: 24 })}>
          <Wordmark />
        </Place>
        <Place id="tagline" rect={TAGLINE}>
          <Headline text={TAGLINE_TEXT} at={60} style="subhead" tone="stone" emphasisFrom="stone" emphasisTo="ink" emphasisStagger={12} align="center" width={TAGLINE.w} />
        </Place>
      </Camera>
      <Sfx at={6} sound="chime" volume={0.9} />
      <Voiceover id="S09" at={40} />
    </Scene>
  );
};

/** For S10: the lockup's parts leaving while the mark travels on. */
export const LockupLeaving: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <Place id="wordmark" rect={WORD_RECT()} moving={frame < 18} style={leave(frame, 0)}>
      <Wordmark />
    </Place>
    <Place id="tagline" rect={TAGLINE} moving={frame < 18}>
      <Headline text={TAGLINE_TEXT} at={-400} style="subhead" tone="stone" emphasisTo="ink" align="center" width={TAGLINE.w} exitAt={0} />
    </Place>
  </>
);
