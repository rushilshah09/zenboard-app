import React from "react";
import { useCurrentFrame } from "remotion";
import { AppWindow } from "../components/AppWindow";
import { Sfx, Voiceover } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Icon } from "../components/Glyph";
import { Headline } from "../components/Headline";
import { Tile } from "../components/Tile";
import { Rect, col, span } from "../brand/layout";
import { DUR, EASE, clamp, rise } from "../brand/motion";
import { colour, radius, space, tint } from "../brand/tokens";
import { beat } from "../brand/timeline";
import { OPENING_SCALE } from "./Act1";
import { APPS, Scene, TILE_SCALE, gridSlot, pillRect, tileRect, tileSlot } from "./shared";

/** Act 2 — too many apps (S03–S04). Monochrome, gridded, nothing overlaps. */

const bbox = (rects: Rect[]) => {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Camera target once windows 0..k are on the table: fit their bounding box. */
const target = (k: number) => {
  const b = bbox(Array.from({ length: k + 1 }, (_, i) => gridSlot(i)));
  const s = Math.min(OPENING_SCALE, span(12) / b.w, (gridSlot(4).y + gridSlot(4).h - gridSlot(0).y) / b.h);
  return { s, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
};

const ARRIVE = (k: number) => beat(k);

export const S03: React.FC = () => {
  const frame = useCurrentFrame();
  // Ease the camera from each target to the next as each window lands.
  let cam = target(0);
  for (let k = 1; k < APPS.length; k++) {
    const p = clamp(frame, [ARRIVE(k), ARRIVE(k) + 36], [0, 1], EASE.settle);
    const t = target(k);
    cam = { s: cam.s + (t.s - cam.s) * p, cx: cam.cx + (t.cx - cam.cx) * p, cy: cam.cy + (t.cy - cam.cy) * p };
  }
  return (
    <Scene>
      <Camera scale={cam.s} x={-(cam.cx - 960) * cam.s} y={-(cam.cy - 540) * cam.s}>
        {APPS.map((a, i) => {
          const r = gridSlot(i);
          const style = i === 0 ? { opacity: 1 } : rise(frame, ARRIVE(i), { dur: 20, easing: EASE.snap, scale: true });
          return (
            <Place key={a.label} id={a.short} rect={r} moving={frame >= ARRIVE(i) && frame < ARRIVE(i) + 20} style={style}>
              <div style={{ opacity: i === 0 ? clamp(frame, [0, 16], [0, 1], EASE.settle) : 1 }}>
                <AppWindow category={a.category} label={a.label} width={r.w} height={r.h} />
              </div>
            </Place>
          );
        })}
      </Camera>
      {APPS.slice(1).map((a, i) => (
        <Sfx key={a.label} at={ARRIVE(i + 1)} sound="notify" variant={i + 1} volume={0.2} />
      ))}
      <Sfx at={0} sound="notify" variant={0} volume={0.2} />
    </Scene>
  );
};

/** Top row compresses first, the bottom row follows once it is clear. */
const shrinkP = (frame: number, i: number) =>
  i < 4 ? clamp(frame, [0, 28], [0, 1], EASE.settle) : clamp(frame, [20, 48], [0, 1], EASE.settle);

/** Each phrase lands on a beat, after the grid has finished compressing. */
export const PHRASES_S04 = [beat(1), beat(2), beat(3)];
const TILE_ROW: Rect = { x: col(1), y: tileRect(0).y, w: span(12), h: pillRect(0).y + pillRect(0).h - tileRect(0).y };
const HEADLINE_S04: Rect = { x: col(1), y: pillRect(0).y + pillRect(0).h + 96, w: span(12), h: 80 };

export const S04: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Scene>
      <Camera scale={1}>
        {APPS.map((a, i) => {
          const g = gridSlot(i);
          const t = tileRect(tileSlot(i));
          const p = shrinkP(frame, i);
          // Bottom-row windows finish their sideways move early so they clear the resting top-row tiles.
          const px = i < 4 ? p : clamp(p, [0, 0.6], [0, 1]);
          const s = 1 + (TILE_SCALE - 1) * p;
          const dx = (t.x + t.w / 2 - (g.x + g.w / 2)) * px;
          const dy = (t.y + t.h / 2 - (g.y + g.h / 2)) * p;
          const swap = clamp(p, [0.7, 1], [0, 1], EASE.settle);
          return (
            <React.Fragment key={a.label}>
              {swap < 1 ? (
                <Place
                  id={`${a.short}-window`}
                  rect={g}
                  bounds={{ x: g.x + dx + (g.w * (1 - s)) / 2, y: g.y + dy + (g.h * (1 - s)) / 2, w: g.w * s, h: g.h * s }}
                  moving={p > 0 && p < 1}
                  style={{ translate: `${dx}px ${dy}px`, scale: String(s), opacity: 1 - swap }}
                >
                  <AppWindow category={a.category} label={a.label} width={g.w} height={g.h} />
                </Place>
              ) : null}
              <div style={{ position: "absolute", left: t.x, top: t.y, opacity: swap }}>
                <Tile category={a.category} label={a.short} width={t.w} height={t.h} />
              </div>
              <div style={{ position: "absolute", left: pillRect(tileSlot(i)).x, top: pillRect(tileSlot(i)).y, width: pillRect(0).w, height: pillRect(0).h, ...rise(frame, PHRASES_S04[1] + tileSlot(i) * 2, { dist: 24 }) }}>
                <LoginBillPill frame={frame} i={tileSlot(i)} />
              </div>
            </React.Fragment>
          );
        })}
        {/* The tile row (with its pills) is one compositional object for the budget. */}
        <Place id="tile-row" rect={TILE_ROW} moving={during(frame, [PHRASES_S04[1], PHRASES_S04[1] + 56])} style={{ opacity: shrinkP(frame, 7) >= 1 ? 1 : 0 }}>
          <div />
        </Place>
        <Place id="headline" rect={HEADLINE_S04} visible={frame >= PHRASES_S04[0]} moving={during(frame, [PHRASES_S04[0], PHRASES_S04[2] + 50], [beat(8) - 18, beat(8)])}>
          <Headline text="Eight apps.|Eight logins.|Eight bills." at={PHRASES_S04[0]} phraseAt={PHRASES_S04} exitAt={beat(8) - 18} />
        </Place>
      </Camera>
      {PHRASES_S04.map((p, i) => (
        <Sfx key={p} at={p} sound="click" variant={i} volume={0.3} />
      ))}
      <Sfx at={PHRASES_S04[2] + 4} sound="paper-tear" volume={0.15} />
      <Voiceover id="S04" at={PHRASES_S04[0]} />
    </Scene>
  );
};

/** The Stone pill under each tile: a key (login), then a receipt (bill). */
const LoginBillPill: React.FC<{ frame: number; i: number }> = ({ frame, i }) => {
  const bill = clamp(frame, [PHRASES_S04[2] + i * 2, PHRASES_S04[2] + i * 2 + DUR.snap], [0, 1], EASE.snap);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: radius.pill,
        background: tint.ink06,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: space.s2,
      }}
    >
      <Icon name="key" size={22} tint={colour.stone} />
      <Icon name="receipt" size={22} tint={colour.stone} style={{ opacity: bill, scale: String(0.25 + bill * 0.75), filter: `blur(${(1 - bill) * 4}px)` }} />
    </div>
  );
};
