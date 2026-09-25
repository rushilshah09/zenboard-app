import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Cursor } from "../components/Cursor";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import {
  CONTENT,
  ClientView,
  DocView,
  DOC,
  FocusPull,
  LifeView,
  MONEY,
  MONEY_SEND,
  MoneyView,
  NAV,
  ProductWindow,
  ROW,
  ROW_H,
  ROW_Y0,
  TODAY,
  TODAY_THREAD_FROM,
  TodayView,
  WIN,
  rowGlyph,
} from "../components/Product";
import { Thread } from "../components/Thread";
import { Mark } from "../components/ZenMark";
import { ZONES } from "../brand/layout";
import { DUR, EASE, clamp, leave, rise } from "../brand/motion";
import { SceneId, actRange, frames, sceneStart } from "../brand/timeline";
import { LOCKUP, LockupLeaving, lockupMark } from "./Act4";
import { Scene, drift } from "./shared";

/**
 * Act 5 — one calm workspace (S10–S16). One continuous product sequence: the
 * window never leaves the frame, the camera drifts across the whole act, and
 * the pink thread carries us from module to module.
 */

const ALL_IN = NAV.map(() => 1);
const actCamera = (id: SceneId, frame: number) => {
  const [a0] = actRange(5);
  const s15End = sceneStart("S15") + frames("S15");
  return drift(sceneStart(id) + frame, [a0, s15End]);
};

/** Window-local point → used for threads drawn inside the window. */
const content = (p: { x: number; y: number }) => ({ x: CONTENT.x + p.x, y: CONTENT.y + p.y });
const rowEnd = (i: number) => ({ x: 296, y: ROW_Y0 + i * ROW_H + ROW_H / 2 });
/**
 * Threads run through empty space only: below the Today list, then up the
 * gutter between sidebar and content; the others go straight into the gutter.
 */
const threadPath = (from: { x: number; y: number }, to: { x: number; y: number }, below = false) =>
  below
    ? `M${from.x} ${from.y} C${from.x - 40} 470, 460 470, 380 360 S 344 ${to.y}, ${to.x} ${to.y}`
    : `M${from.x} ${from.y} C${from.x - 60} ${from.y}, ${to.x + 48} ${to.y}, ${to.x} ${to.y}`;

// ── S10 · the eight apps come home ──────────────────────────────────────────
const ROW_AT = (i: number) => 72 + i * 12;
export const S10: React.FC = () => {
  const frame = useCurrentFrame();
  const travel = clamp(frame, [12, 12 + 48], [0, 1], EASE.settle);
  const from = lockupMark();
  const to = { x: WIN.x + 32 + 16, y: WIN.y + 28 + 16 };
  const scale = 1 + (32 / LOCKUP.markSize - 1) * travel;
  const landed = clamp(frame, [58, 66], [0, 1], EASE.settle);
  const rows = NAV.map((_, i) => clamp(frame, [ROW_AT(i), ROW_AT(i) + DUR.settle], [0, 1], EASE.settle));
  const colours = NAV.map((_, i) => clamp(frame, [ROW_AT(i) + 18, ROW_AT(i) + 18 + DUR.colourShift], [0, 1], EASE.settle));
  const push = clamp(frame, [160, 190], [0, 1], EASE.settle);
  const sel = clamp(frame, [184, 200], [0, 1], EASE.settle);
  return (
    <Scene>
      <Camera scale={actCamera("S10", frame)}>
        <LockupLeaving frame={frame} />
        <ProductWindow
          rows={rows}
          colours={colours}
          selected={ROW.today}
          selectedOpacity={sel}
          headerMark={landed}
          frame={rise(frame, 24, { scale: true })}
          overlay={<Thread d={`M48 60 C 48 90, 52 110, ${rowEnd(0).x} ${rowEnd(0).y}`} progress={push} opacity={1 - clamp(frame, [196, 212], [0, 1], EASE.leave)} />}
        />
        {landed < 1 ? (
          <div
            style={{
              position: "absolute",
              left: from.x - LOCKUP.markSize / 2,
              top: from.y - LOCKUP.markSize / 2,
              translate: `${(to.x - from.x) * travel}px ${(to.y - from.y) * travel}px`,
              scale: String(scale),
              opacity: 1 - landed,
            }}
          >
            <Mark size={LOCKUP.markSize} />
          </div>
        ) : null}
      </Camera>
      {NAV.map((_, i) => (
        <Sfx key={i} at={ROW_AT(i) + 10} sound="tick-tuned" variant={i} volume={0.22} />
      ))}
      <Sfx at={160} sound="thread" volume={0.14} />
    </Scene>
  );
};

// ── S11–S15 · one job through every module ─────────────────────────────────
type ModuleId = "S11" | "S12" | "S13" | "S14" | "S15";
type Module = {
  row: number;
  from: number;
  headline: string;
  View: React.FC<{ f: number }>;
  Prev?: React.FC<{ f: number }>;
  /** Outgoing thread: window-local start, and the sidebar row it leads to. */
  thread?: { from: { x: number; y: number }; to: number; below?: boolean };
};
const VIEW_AT = 10;

const MODULES: Record<ModuleId, Module> = {
  S11: { row: ROW.today, from: ROW.today, headline: "Plan your day in seconds.", View: TodayView, thread: { from: content(TODAY_THREAD_FROM), to: ROW.docs, below: true } },
  S12: { row: ROW.docs, from: ROW.today, headline: "Write right next to the work.", View: DocView, Prev: TodayView, thread: { from: content({ x: 22, y: 218 }), to: ROW.clients } },
  S13: { row: ROW.clients, from: ROW.docs, headline: "Every client in one view.", View: ClientView, Prev: DocView, thread: { from: content({ x: 36, y: 394 }), to: ROW.money } },
  S14: { row: ROW.money, from: ROW.clients, headline: "Invoice in one click.", View: MoneyView, Prev: ClientView },
  S15: { row: ROW.life, from: ROW.money, headline: "And room for the rest of your life.", View: LifeView, Prev: MoneyView },
};
const ORDER: ModuleId[] = ["S11", "S12", "S13", "S14", "S15"];

/** Cursor waypoints per module: [frame, window-local x, y]. */
const along = (frame: number, pts: [number, number, number][]) => {
  if (frame <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [f0, x0, y0] = pts[i];
    const [f1, x1, y1] = pts[i + 1];
    if (frame <= f1) {
      const t = clamp(frame, [f0, f1], [0, 1], EASE.settle);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const l = pts[pts.length - 1];
  return { x: l[1], y: l[2] };
};

const TODAY_CURSOR: [number, number, number][] = (() => {
  const grab = { x: CONTENT.x + TODAY.row.x + 260, y: CONTENT.y + TODAY.row.y + 32 };
  const drop = { x: CONTENT.x + TODAY.slot.x + 260, y: CONTENT.y + TODAY.slot.y + 32 };
  const g = VIEW_AT + TODAY.grabAt;
  const d = VIEW_AT + TODAY.dropAt;
  return [
    [0, 1100, 560],
    [g - 4, grab.x, grab.y],
    [g + 6, grab.x, grab.y],
    [d, drop.x, drop.y],
    [d + 40, drop.x + 120, drop.y + 150],
  ];
})();
const MONEY_CURSOR: [number, number, number][] = (() => {
  const b = content(MONEY_SEND);
  const s = VIEW_AT + MONEY.sendAt;
  return [
    [0, 1100, 620],
    [s - 8, b.x, b.y],
    [s + 30, b.x, b.y],
    [s + 70, b.x + 80, b.y + 120],
  ];
})();

const ModuleScene: React.FC<{ id: ModuleId }> = ({ id }) => {
  const frame = useCurrentFrame();
  const m = MODULES[id];
  const prevId = ORDER[ORDER.indexOf(id) - 1];
  const prev = prevId ? MODULES[prevId] : undefined;
  const len = frames(id);
  const f = frame - VIEW_AT;
  const selected = m.from + (m.row - m.from) * clamp(frame, [4, 40], [0, 1], EASE.settle);
  const outThread = m.thread ? clamp(frame, [len - 60, len - 14], [0, 1], EASE.settle) : 0;
  const inThread = prev?.thread;
  const cursor = id === "S11" ? TODAY_CURSOR : id === "S14" ? MONEY_CURSOR : null;
  const cur = cursor ? along(frame, cursor) : null;
  const cursorIn = cursor ? clamp(frame, [cursor[0][0], cursor[0][0] + 16], [0, 1], EASE.settle) * (1 - clamp(frame, [cursor[cursor.length - 1][0] - 10, cursor[cursor.length - 1][0] + 8], [0, 1], EASE.leave)) : 0;
  const pressAt = id === "S11" ? VIEW_AT + TODAY.grabAt : VIEW_AT + MONEY.sendAt;
  const press = clamp(frame, [pressAt - 3, pressAt], [0, 1], EASE.snap) * (1 - clamp(frame, [pressAt + 2, pressAt + 8], [0, 1], EASE.settle));
  const holding = id === "S11" && frame >= VIEW_AT + TODAY.grabAt && frame < VIEW_AT + TODAY.dropAt;
  const Current = m.View;
  const Prev = m.Prev;
  return (
    <Scene>
      <Camera scale={actCamera(id, frame)}>
        <Place id="headline" rect={ZONES.headlineTop} moving={during(frame, [12, 70], [len - 18, len])}>
          <Headline text={m.headline} at={12} align="center" width={ZONES.headlineTop.w} exitAt={len - 18} />
        </Place>
        <Place id="window" rect={WIN}>
          <div />
        </Place>
        <ProductWindow
          rows={ALL_IN}
          colours={ALL_IN}
          selected={selected}
          content={
            Prev ? (
              <FocusPull frame={frame} at={6} out={<Prev f={999} />} in={<Current f={f} />} />
            ) : (
              <div style={{ position: "absolute", inset: 0, ...rise(frame, 4, { dist: 24 }) }}>
                <Current f={f} />
              </div>
            )
          }
          overlay={
            <>
              {inThread ? <Thread d={threadPath(inThread.from, rowEnd(inThread.to), inThread.below)} progress={1} opacity={leave(frame, 0).opacity} /> : null}
              {m.thread ? <Thread d={threadPath(m.thread.from, rowEnd(m.thread.to), m.thread.below)} progress={outThread} /> : null}
              {cur ? <Cursor x={cur.x} y={cur.y} pressed={holding ? 1 : press} opacity={cursorIn} /> : null}
            </>
          }
        />
      </Camera>
      {m.thread ? <Sfx at={len - 60} sound="thread" volume={0.14} /> : null}
      {id === "S11" ? (
        <>
          <Sfx at={VIEW_AT + TODAY.grabAt} sound="ui-click" volume={0.2} />
          <Sfx at={VIEW_AT + TODAY.dropAt} sound="snap" volume={0.2} />
        </>
      ) : null}
      {id === "S12"
        ? [0, 5, 9, 15, 20, 26, 31, 37].map((k, i) => <Sfx key={k} at={VIEW_AT + DOC.lineAt + k} sound="key" variant={i % 4} volume={0.08} />)
        : null}
      {id === "S13" ? <Sfx at={VIEW_AT + 30} sound="whoosh-soft" volume={0.14} /> : null}
      {id === "S14" ? (
        <>
          <Sfx at={VIEW_AT + MONEY.sendAt} sound="ui-click" volume={0.22} />
          <Sfx at={VIEW_AT + MONEY.paidAt} sound="chime-single" volume={0.8} />
        </>
      ) : null}
    </Scene>
  );
};

export const S11: React.FC = () => <ModuleScene id="S11" />;
export const S12: React.FC = () => <ModuleScene id="S12" />;
export const S13: React.FC = () => <ModuleScene id="S13" />;
export const S14: React.FC = () => <ModuleScene id="S14" />;
export const S15: React.FC = () => <ModuleScene id="S15" />;

// ── S16 · all connected ─────────────────────────────────────────────────────
export const S16_HEADLINE = "All connected. Nothing to switch.";
const TRACE: [number, number] = [16, 112];
export const S16: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S16");
  const pull = clamp(frame, [0, 96], [0, 1], EASE.settle);
  const cam = actCamera("S16", frame) * (1 - pull) + 0.92 * pull;
  const trace = clamp(frame, TRACE, [0, 1], EASE.breathe);
  const first = rowGlyph(0).y - ROW_H / 2 + 8;
  const last = rowGlyph(NAV.length - 1).y + ROW_H / 2 - 8;
  const lit = NAV.map((_, i) => {
    const t = TRACE[0] + ((rowGlyph(i).y - first) / (last - first)) * (TRACE[1] - TRACE[0]);
    return clamp(frame, [t - 4, t + 6], [0, 1], EASE.settle) * (1 - clamp(frame, [t + 18, t + 42], [0, 1], EASE.settle));
  });
  const recede = clamp(frame, [len - 30, len], [0, 1], EASE.leave);
  return (
    <Scene>
      <Camera scale={cam}>
        <Place id="headline" rect={ZONES.headlineTop} moving={during(frame, [8, 64])}>
          <Headline text={S16_HEADLINE} at={8} align="center" width={ZONES.headlineTop.w} />
        </Place>
        <ProductWindow
          rows={ALL_IN}
          colours={ALL_IN}
          lit={lit}
          selected={ROW.life}
          selectedOpacity={1 - clamp(frame, [4, 20], [0, 1], EASE.settle)}
          frame={{ opacity: 1 - recede, scale: String(1 - recede * 0.04) }}
          content={<LifeView f={999} />}
          overlay={<Thread d={`M8 ${first} L8 ${last}`} progress={trace} />}
        />
      </Camera>
      {NAV.map((_, i) => (
        <Sfx key={i} at={TRACE[0] + (i / (NAV.length - 1)) * (TRACE[1] - TRACE[0])} sound="tick-tuned" variant={i} volume={0.18} />
      ))}
    </Scene>
  );
};
