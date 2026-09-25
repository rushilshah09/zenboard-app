import React from "react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Cursor } from "../components/Cursor";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import {
  CONTENT,
  ClientView,
  DocView,
  CLIENT,
  CLIENT_HERO,
  DOC,
  DOC_HERO,
  HeroMode,
  LIFE_HERO,
  MONEY_HERO,
  Seam,
  SEAM,
  SIDEBAR_W,
  SeamCut,
  SwipeCut,
  TodaySkeleton,
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
} from "../components/Product";
import { Thread } from "../components/Thread";
import { RevealMark } from "../components/LogoReveal";
import { CATEGORY, colour, radius } from "../brand/tokens";
import { ZONES } from "../brand/layout";
import { DUR, EASE, clamp, leave } from "../brand/motion";
import { syncWords, syncedSpan } from "../brand/sync";
import { SceneId, VO_AT, actRange, frames, sceneStart } from "../brand/timeline";
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
const ROW_AT = (i: number) => 36 + i * 9;
/** S09 ends pushed in; the lockup keeps that scale while it leaves so the cut is invisible. */
const S09_END_SCALE = 1.09;
/** S10 frame where the window starts assembling, while the mark is still in flight. */
const BUILD_AT = 14;
const toScreen = (p: { x: number; y: number }, s: number) => ({ x: 960 + (p.x - 960) * s, y: 540 + (p.y - 540) * s });
export const S10: React.FC = () => {
  const frame = useCurrentFrame();
  const travel = clamp(frame, [8, 8 + 52], [0, 1], EASE.settle);
  // Starts tight and pulls back as the sidebar rows unfold.
  const cam = actCamera("S10", frame) * (1.06 - 0.06 * clamp(frame, [16, frames("S10")], [0, 1], EASE.settle));
  const from = toScreen(lockupMark(), S09_END_SCALE);
  // The header mark: 32px box with a 2-unit pad on the 36-unit grid.
  const to = toScreen({ x: WIN.x + 32 + 16, y: WIN.y + 28 + 16 }, cam);
  const size0 = LOCKUP.markSize * S09_END_SCALE;
  const size1 = (32 * 32) / 36 * cam;
  const scale = 1 + (size1 / size0 - 1) * travel;
  const landed = clamp(frame, [56, 64], [0, 1], EASE.settle);
  const rows = NAV.map((_, i) => clamp(frame, [ROW_AT(i), ROW_AT(i) + DUR.settle], [0, 1], EASE.settle));
  const colours = NAV.map((_, i) => clamp(frame, [ROW_AT(i) + 18, ROW_AT(i) + 18 + DUR.colourShift], [0, 1], EASE.settle));
  const push = clamp(frame, [112, 140], [0, 1], EASE.settle);
  const sel = clamp(frame, [134, 150], [0, 1], EASE.settle);
  return (
    <Scene>
      <Camera scale={S09_END_SCALE}>
        <LockupLeaving frame={frame} />
      </Camera>
      <Camera scale={cam}>
        <ProductWindow
          rows={rows}
          colours={colours}
          selected={ROW.today}
          selectedOpacity={sel}
          headerMark={landed}
          build={frame - BUILD_AT}
          content={<TodaySkeleton b={frame - BUILD_AT} />}
          overlay={<Thread d={`M48 60 C 48 90, 52 110, ${rowEnd(0).x} ${rowEnd(0).y}`} progress={push} opacity={1 - clamp(frame, [146, 158], [0, 1], EASE.leave)} />}
        />
      </Camera>
      {landed < 1 ? (
        <div
          style={{
            position: "absolute",
            left: from.x - size0 / 2,
            top: from.y - size0 / 2,
            translate: `${(to.x - from.x) * travel}px ${(to.y - from.y) * travel}px`,
            scale: String(scale),
            opacity: 1 - landed,
            // Speed blur: strongest at the start of the flight, gone as it lands.
            filter: `blur(${Math.min(6, Math.hypot(to.x - from.x, to.y - from.y) * (travel - clamp(frame - 1, [8, 60], [0, 1], EASE.settle)) * 0.25)}px)`,
          }}
        >
          <RevealMark size={size0} fill={interpolateColors(travel, [0.2, 0.9], [colour.white, colour.pink])} />
        </div>
      ) : null}
      {NAV.map((_, i) => (
        <Sfx key={i} at={ROW_AT(i) + 10} sound="tick-tuned" variant={i} volume={0.22} />
      ))}
      <Sfx at={8} sound="whoosh-soft" volume={0.16} />
      <Sfx at={112} sound="thread" volume={0.14} />
    </Scene>
  );
};

// ── S11–S15 · one job through every module ─────────────────────────────────
type ModuleId = "S11" | "S12" | "S13" | "S14" | "S15";
type ViewFC = React.FC<{ f: number; hero?: HeroMode; lift?: number; rowAt?: number[]; cardAt?: number[]; magnet?: { x: number; y: number }; morphed?: boolean }>;
type Hero = { origin: { x: number; y: number } };
type Module = {
  row: number;
  from: number;
  headline: string;
  View: ViewFC;
  Prev?: ViewFC;
  /** Outgoing thread: window-local start, and the sidebar row it leads to. */
  thread?: { from: { x: number; y: number }; to: number; below?: boolean };
  /**
   * Lift-out: the hero component rises off the page toward camera (scale k,
   * about its content-local origin) while the window behind softens and recedes.
   */
  lift?: { hero: Hero; k: number; up: [number, number]; down: [number, number] };
  /** The object that carries the viewer in from the previous module. */
  seam?: Seam;
};
const ROW_TINT = "#F4F1F4";
const VIEW_AT = 10;
/** Scene frame where the swipe cut into a module starts. */
const SWIPE_AT = 6;

const MODULES: Record<ModuleId, Module> = {
  S11: { row: ROW.today, from: ROW.today, headline: "Plan your day in seconds.", View: TodayView, thread: { from: content(TODAY_THREAD_FROM), to: ROW.docs, below: true } },
  S12: {
    row: ROW.docs,
    from: ROW.today,
    headline: "Write right next to the work.",
    View: DocView,
    Prev: TodayView,
    thread: { from: content({ x: 22, y: DOC_HERO.y + DOC_HERO.h }), to: ROW.clients },
    lift: { hero: DOC_HERO, k: 1.5, up: [100, 126], down: [168, 194] },
    // The 10:00 event opens into the document it belongs to.
    seam: { from: TODAY.slot, to: { x: -24, y: -16, w: CONTENT.w + 48, h: CONTENT.h + 32 }, fromBg: CATEGORY.tasks.accent, toBg: colour.card, fromR: radius.card, toR: radius.window, label: "Draft Acme proposal" },
  },
  S13: {
    row: ROW.clients,
    from: ROW.docs,
    headline: "Every client in one view.",
    View: ClientView,
    Prev: DocView,
    thread: { from: content({ x: 36, y: 440 }), to: ROW.money },
    lift: { hero: CLIENT_HERO, k: 1.12, up: [54, 80], down: [150, 176] },
    // The task chip, now ready for review, flies to its client and becomes the proposal row.
    seam: { from: { x: DOC_HERO.x, y: DOC_HERO.y, w: DOC_HERO.w, h: DOC_HERO.h }, to: { x: 0, y: 216, w: 1184, h: 64 }, fromBg: colour.card, toBg: ROW_TINT, fromR: radius.pill, toR: radius.card, label: "Proposal — rebrand, phase two" },
  },
  S14: {
    row: ROW.money,
    from: ROW.clients,
    headline: "Invoice in one click.",
    View: MoneyView,
    Prev: ClientView,
    lift: { hero: MONEY_HERO, k: 1.12, up: [92, 120], down: [204, 232] },
    // The client's tracked hours expand into the invoice.
    seam: { from: { x: 0, y: 376, w: 1184, h: 64 }, to: { x: MONEY_HERO.x, y: MONEY_HERO.y, w: MONEY_HERO.w, h: MONEY_HERO.h }, fromBg: ROW_TINT, toBg: colour.paper, fromR: radius.card, toR: radius.card, label: "12.5h tracked this week" },
  },
  S15: {
    row: ROW.life,
    from: ROW.money,
    headline: "And room for the rest of your life.",
    View: LifeView,
    Prev: MoneyView,
    lift: { hero: LIFE_HERO, k: 1.3, up: [116, 144], down: [194, 222] },
    // Paid, the invoice folds back into Money, and the week opens.
    seam: { from: { x: MONEY_HERO.x, y: MONEY_HERO.y, w: MONEY_HERO.w, h: MONEY_HERO.h }, to: { x: 16 - CONTENT.x, y: ROW_Y0 + ROW.money * ROW_H + 4 - CONTENT.y, w: SIDEBAR_W - 32, h: ROW_H - 8 }, fromBg: colour.paper, toBg: colour.blush, fromR: radius.card, toR: radius.card, label: "Paid · INV-1042" },
  },
};
const ORDER: ModuleId[] = ["S11", "S12", "S13", "S14", "S15"];
const LIFT_RISE = 14;

const liftAt = (m: Module, frame: number) =>
  m.lift ? clamp(frame, m.lift.up, [0, 1], EASE.settle) - clamp(frame, m.lift.down, [0, 1], EASE.settle) : 0;

/** Where a window-local point lands once the hero is lifted by `d`. */
const lifted = (m: Module, d: number, p: { x: number; y: number }) => {
  if (!m.lift || d <= 0) return p;
  const o = content(m.lift.hero.origin);
  const s = 1 + (m.lift.k - 1) * d;
  return { x: o.x + (p.x - o.x) * s, y: o.y + (p.y - o.y) * s - LIFT_RISE * d };
};

/**
 * Macro camera: S11 pushes into the drop, S12 tracks into the document past
 * the softened sidebar, S14 goes in tight on Send. Each eases back out before
 * the next beat. `focus` is content-local; frames are scene-local.
 */
type Punch = { focus: { x: number; y: number }; k: number; in: [number, number]; out: [number, number] };
const PUNCH: Partial<Record<ModuleId, Punch>> = {
  S11: { focus: { x: TODAY.slot.x + TODAY.slot.w / 2 - 200, y: TODAY.slot.y + 40 }, k: 1.14, in: [VIEW_AT + TODAY.grabAt - 6, VIEW_AT + TODAY.dropAt + 8], out: [150, 186] },
  S12: { focus: { x: 320, y: 240 }, k: 1.18, in: [70, 124], out: [166, 200] },
  S14: { focus: { x: MONEY_SEND.x - 60, y: MONEY_SEND.y - 40 }, k: 1.2, in: [VIEW_AT + MONEY.sendAt - 46, VIEW_AT + MONEY.sendAt - 4], out: [200, 236] },
};
const punchAt = (id: ModuleId, frame: number, drift: number) => {
  const p = PUNCH[id];
  if (!p) return { scale: drift, x: 0, y: 0 };
  const k = 1 + (p.k - 1) * (clamp(frame, p.in, [0, 1], EASE.settle) - clamp(frame, p.out, [0, 1], EASE.settle));
  const fx = WIN.x + CONTENT.x + p.focus.x - 960;
  const fy = WIN.y + CONTENT.y + p.focus.y - 540;
  return { scale: drift * k, x: fx * drift * (1 - k), y: fy * drift * (1 - k) };
};

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

/** Per-module reveals keyed to the voice (view-local frames). */
const revealProps = (id: ModuleId, words: number[], cursor: { x: number; y: number } | null) => {
  if (id === "S14" && cursor) {
    // Magnetic hover: within ~180px the Send button leans up to 8px toward the cursor.
    const b = content(MONEY_SEND);
    const dx = cursor.x - b.x;
    const dy = cursor.y - b.y;
    const pull = 1 - clamp(Math.hypot(dx, dy), [24, 180], [0, 1], EASE.settle);
    const len = Math.max(1, Math.hypot(dx, dy));
    return { morphed: true, magnet: { x: (dx / len) * 8 * pull, y: (dy / len) * 8 * pull } };
  }
  // S13: the first row is where the chip lands; the rest cascade after it.
  if (id === "S13") return { rowAt: [SEAM.at + SEAM.dur - VIEW_AT, 0, 0] };
  if (id === "S15") return { cardAt: [words[1], words[3], words[5], words[7]].map((w) => w - VIEW_AT) };
  return {};
};

const ModuleScene: React.FC<{ id: ModuleId }> = ({ id }) => {
  const frame = useCurrentFrame();
  const m = MODULES[id];
  const prevId = ORDER[ORDER.indexOf(id) - 1];
  const prev = prevId ? MODULES[prevId] : undefined;
  const len = frames(id);
  const f = frame - VIEW_AT;
  // The selection glides down with the swipe, one motion.
  const selected = m.from + (m.row - m.from) * clamp(frame, [SEAM.at + 8, SEAM.at + SEAM.dur + 12], [0, 1], EASE.settle);
  const outThread = m.thread ? clamp(frame, [len - 60, len - 14], [0, 1], EASE.settle) : 0;
  const inThread = prev?.thread;
  const cursor = id === "S11" ? TODAY_CURSOR : id === "S14" ? MONEY_CURSOR : null;
  const d = liftAt(m, frame);
  const cur = cursor ? lifted(m, d, along(frame, cursor)) : null;
  const cursorIn = cursor ? clamp(frame, [cursor[0][0], cursor[0][0] + 16], [0, 1], EASE.settle) * (1 - clamp(frame, [cursor[cursor.length - 1][0] - 10, cursor[cursor.length - 1][0] + 8], [0, 1], EASE.leave)) : 0;
  const pressAt = id === "S11" ? VIEW_AT + TODAY.grabAt : VIEW_AT + MONEY.sendAt;
  const press = clamp(frame, [pressAt - 3, pressAt], [0, 1], EASE.snap) * (1 - clamp(frame, [pressAt + 2, pressAt + 8], [0, 1], EASE.settle));
  const holding = id === "S11" && frame >= VIEW_AT + TODAY.grabAt && frame < VIEW_AT + TODAY.dropAt;
  const words = syncWords(m.headline, id, VO_AT[id]);
  const extra = revealProps(id, words, cursor ? along(frame, cursor) : null);
  const Current = m.View;
  const Prev = m.Prev;
  const cam = actCamera(id, frame);
  const punch = punchAt(id, frame, cam);
  // Depth of field: while the hero is lifted, the page behind softens, dims and steps back.
  const depth: React.CSSProperties = d > 0 ? { filter: `blur(${d * 6}px)`, scale: String(1 - d * 0.03), opacity: 1 - d * 0.3 } : {};
  const heroMode: HeroMode = d > 0 ? "hide" : "show";
  // S11: the blank blocks laid in S10 resolve into the real Today view.
  const resolve = clamp(frame, [4, 30], [0, 1], EASE.settle);
  return (
    <Scene>
      {/* The headline stays on the act's drift; only the product moves. */}
      <Camera scale={cam}>
        <Place id="headline" rect={ZONES.headlineTop} moving={during(frame, syncedSpan(words), [len - 18, len])}>
          <Headline text={m.headline} at={words[0]} wordAt={words} align="center" width={ZONES.headlineTop.w} exitAt={len - 18} />
        </Place>
      </Camera>
      <Camera scale={punch.scale} x={punch.x} y={punch.y}>
        <Place id="window" rect={WIN}>
          <div />
        </Place>
        <ProductWindow
          rows={ALL_IN}
          colours={ALL_IN}
          selected={selected}
          frame={depth}
          content={
            Prev ? (
              m.seam ? (
                <SeamCut frame={frame} seam={m.seam} out={<Prev f={999} {...(prevId === "S14" ? { morphed: true } : {})} />} in={<Current f={f} hero={heroMode} {...extra} />} />
              ) : (
                <SwipeCut frame={frame} at={SWIPE_AT} out={<Prev f={999} />} in={<Current f={f} hero={heroMode} {...extra} />} />
              )
            ) : (
              <>
                <TodaySkeleton b={999} opacity={1 - resolve} />
                <div style={{ position: "absolute", inset: 0, opacity: resolve, filter: `blur(${(1 - resolve) * 8}px)` }}>
                  <Current f={f} />
                </div>
              </>
            )
          }
          overlay={
            <>
              {inThread ? <Thread d={threadPath(inThread.from, rowEnd(inThread.to), inThread.below)} progress={1} opacity={leave(frame, 0).opacity} /> : null}
              {m.thread ? <Thread d={threadPath(m.thread.from, rowEnd(m.thread.to), m.thread.below)} progress={outThread} /> : null}
            </>
          }
        />
        {/* The lifted hero, above the softened page. */}
        {m.lift && d > 0 ? (
          <div
            style={{
              position: "absolute",
              left: WIN.x + CONTENT.x,
              top: WIN.y + CONTENT.y,
              width: CONTENT.w,
              height: CONTENT.h,
              transformOrigin: `${m.lift.hero.origin.x}px ${m.lift.hero.origin.y}px`,
              scale: String(1 + (m.lift.k - 1) * d),
              translate: `0 ${-LIFT_RISE * d}px`,
            }}
          >
            <Current f={f} hero="only" lift={d} {...extra} />
          </div>
        ) : null}
        {cur ? (
          <div style={{ position: "absolute", left: WIN.x, top: WIN.y }}>
            <Cursor x={cur.x} y={cur.y} pressed={holding ? 1 : press} opacity={cursorIn} />
          </div>
        ) : null}
      </Camera>
      {Prev ? <Sfx at={SWIPE_AT} sound="whoosh-soft" volume={0.12} /> : null}
      {m.lift ? <Sfx at={m.lift.up[0]} sound="lift" volume={0.16} /> : null}
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
      {id === "S12" ? <Sfx at={VIEW_AT + DOC.updateAt} sound="tick-tuned" variant={4} volume={0.2} /> : null}
      {id === "S13" ? <Sfx at={VIEW_AT + CLIENT.fillAt} sound="whoosh-soft" volume={0.12} /> : null}
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
