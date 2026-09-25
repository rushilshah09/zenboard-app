import React from "react";
import { interpolateColors } from "remotion";
import { FONT } from "../brand/fonts";
import { ZONES } from "../brand/layout";
import { DUR, EASE, POP, clamp, kick, leave, rise } from "../brand/motion";
import { CATEGORY, Category, colour, radius, shadow, space, tint, type } from "../brand/tokens";
import { Glyph, Icon } from "./Glyph";
import { Headline } from "./Headline";
import { Illustration, IllustrationCode } from "./Illustration";
import { Mark } from "./ZenMark";

/**
 * Zenboard in light mode, living on the same Paper as the rest of the film.
 * All coordinates below are window-local (the window is ZONES.window).
 */

export const WIN = ZONES.window;
export const SIDEBAR_W = 320;
export const ROW_Y0 = 96;
export const ROW_H = 64;
export const CONTENT = { x: SIDEBAR_W + 48, y: 40, w: WIN.w - SIDEBAR_W - 96, h: WIN.h - 80 };

export const NAV: { label: string; category: Category }[] = [
  { label: "Today", category: "tasks" },
  { label: "Projects", category: "projects" },
  { label: "Docs", category: "docs" },
  { label: "Notes", category: "notes" },
  { label: "Calendar", category: "calendar" },
  { label: "Money", category: "money" },
  { label: "Clients", category: "clients" },
  { label: "Life", category: "life" },
];
export const ROW = { today: 0, projects: 1, docs: 2, notes: 3, calendar: 4, money: 5, clients: 6, life: 7 } as const;

/** Window-local centre of a sidebar row's glyph (thread anchor). */
export const rowGlyph = (i: number) => ({ x: 16 + 16 + 20, y: ROW_Y0 + i * ROW_H + ROW_H / 2 });

export const ProductWindow: React.FC<{
  /** Per-row entrance (0 → 1) and category colour (0 → 1). */
  rows: number[];
  colours: number[];
  /** Selected row index; fractional while the selection slides. */
  selected?: number;
  selectedOpacity?: number;
  /** Per-row light-up (0 → 1) as the thread passes (S16). */
  lit?: number[];
  headerMark?: number;
  /** Frames since the window started assembling (S10); omit once it is built. */
  build?: number;
  frame?: React.CSSProperties;
  content?: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ rows, colours, selected, selectedOpacity = 1, lit, headerMark = 1, build, frame, content, overlay }) => (
  <div
    style={{
      position: "absolute",
      left: WIN.x,
      top: WIN.y,
      width: WIN.w,
      height: WIN.h,
      borderRadius: radius.window,
      background: colour.card,
      boxShadow: shadow,
      fontFamily: FONT,
      overflow: "hidden",
      ...(build === undefined ? null : assembleFrame(build)),
      ...frame,
    }}
  >
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR_W, borderRight: `1px solid ${colour.hairline}`, ...sidebarDrop(build) }}>
      <div style={{ position: "absolute", left: 32, top: 28, display: "flex", alignItems: "center", gap: space.s2, opacity: headerMark }}>
        <Mark size={32} />
        <div style={{ ...type.uiStrong, color: colour.ink }}>Zenboard</div>
      </div>
      {selected !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            width: SIDEBAR_W - 32,
            top: ROW_Y0 + 4,
            height: ROW_H - 8,
            borderRadius: radius.card,
            background: colour.blush,
            translate: `0 ${selected * ROW_H}px`,
            opacity: selectedOpacity,
          }}
        />
      ) : null}
      {NAV.map((n, i) => (
        <div
          key={n.label}
          style={{
            position: "absolute",
            left: 16,
            width: SIDEBAR_W - 32,
            top: ROW_Y0 + i * ROW_H + 4,
            height: ROW_H - 8,
            borderRadius: radius.card,
            background: lit ? `rgba(243, 217, 229, ${lit[i]})` : "transparent",
            display: "flex",
            alignItems: "center",
            gap: space.s2,
            paddingLeft: 16,
            opacity: rows[i],
            translate: `0 ${(1 - rows[i]) * 24}px`,
          }}
        >
          <Glyph category={n.category} size={40} colourProgress={colours[i]} />
          <div style={{ ...type.ui, color: colour.ink }}>{n.label}</div>
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", left: CONTENT.x, top: CONTENT.y, width: CONTENT.w, height: CONTENT.h }}>{content}</div>
    {overlay}
  </div>
);

/** The window surface assembling: it sharpens out of a blur and grows the last step into place. */
const assembleFrame = (b: number): React.CSSProperties => {
  // The canvas swings in on Y from −15° (and a touch of pitch) to face camera, in real perspective.
  const swing = clamp(b, [0, 56], [0, 1], EASE.settle);
  return {
    opacity: clamp(b, [0, 12], [0, 1], EASE.settle),
    transform: `perspective(2200px) rotateY(${-15 * (1 - swing)}deg) rotateX(${4 * (1 - swing)}deg) translateZ(${-120 * (1 - swing)}px)`,
    transformOrigin: "30% 50%",
    filter: `blur(${14 * (1 - clamp(b, [0, 26], [0, 1], EASE.settle))}px)`,
  };
};

/** The sidebar drops in on Y with a hard deceleration while the canvas swings round. */
const sidebarDrop = (b?: number): React.CSSProperties =>
  b === undefined
    ? {}
    : {
        translate: `0 ${-160 * (1 - clamp(b, [4, 34], [0, 1], EASE.settle))}px`,
        opacity: clamp(b, [4, 14], [0, 1]),
      };

/**
 * Swipe cut between two views (the cut catalog's cut-the-curve, vertical):
 * the outgoing view accelerates upward, blurring and fading, and the incoming
 * one arrives from below already moving and decelerates. Both halves share
 * distance and peak blur, so the eye rides one motion across the cut.
 */
export const SWIPE = { exit: 16, enter: 40, dist: 96, blur: 16 };
export const SwipeCut: React.FC<{ frame: number; at: number; out: React.ReactNode; in: React.ReactNode }> = ({ frame, at, out, in: incoming }) => {
  const cut = at + SWIPE.exit;
  if (frame < cut) {
    const p = clamp(frame, [at, cut], [0, 1], EASE.leave);
    return (
      <div style={{ position: "absolute", inset: 0, translate: `0 ${-p * SWIPE.dist}px`, filter: `blur(${p * SWIPE.blur}px)`, opacity: 1 - 0.85 * clamp(frame, [at, cut], [0, 1]) }}>
        {out}
      </div>
    );
  }
  const p = clamp(frame, [cut, cut + SWIPE.enter], [0, 1], EASE.settle);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        translate: `0 ${(1 - p) * SWIPE.dist}px`,
        filter: `blur(${(1 - p) * SWIPE.blur}px)`,
        opacity: 0.15 + 0.85 * clamp(frame, [cut, cut + 12], [0, 1], EASE.settle),
      }}
    >
      {incoming}
    </div>
  );
};

type CRect = { x: number; y: number; w: number; h: number };
/**
 * Seam cut: the object that links two modules carries the viewer across.
 * The outgoing page steps back (blur, dim, 0.98) while one surface morphs,
 * continuously in position, size, corner and colour, from where it lived in
 * the old view to where it lives in the new one. The new page then resolves
 * around it. Rects are content-local.
 */
export const SEAM = { at: 4, dur: 36, reveal: 26 };
export type Seam = { from: CRect; to: CRect; fromBg: string; toBg: string; fromR: number; toR: number; label: string };
export const SeamCut: React.FC<{ frame: number; seam: Seam; out: React.ReactNode; in: React.ReactNode }> = ({ frame, seam, out, in: incoming }) => {
  const a = SEAM.at;
  const p = clamp(frame, [a, a + SEAM.dur], [0, 1], EASE.settle);
  const back = clamp(frame, [a, a + 18], [0, 1], EASE.settle);
  const outGone = clamp(frame, [a + 10, a + 26], [0, 1], EASE.leave);
  const come = clamp(frame, [a + SEAM.reveal, a + SEAM.reveal + 20], [0, 1], EASE.settle);
  const lerp = (x: number, y: number) => x + (y - x) * p;
  const r = { x: lerp(seam.from.x, seam.to.x), y: lerp(seam.from.y, seam.to.y), w: lerp(seam.from.w, seam.to.w), h: lerp(seam.from.h, seam.to.h) };
  // Speed blur on the travelling surface, strongest mid-flight.
  const speed = Math.abs(p - clamp(frame - 1, [a, a + SEAM.dur], [0, 1], EASE.settle));
  return (
    <>
      {outGone < 1 ? (
        <div style={{ position: "absolute", inset: 0, filter: `blur(${back * 8}px)`, opacity: (1 - back * 0.45) * (1 - outGone), scale: String(1 - back * 0.02) }}>{out}</div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, opacity: come, filter: `blur(${(1 - come) * 6}px)` }}>{incoming}</div>
      {come < 1 ? (
        <div
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            borderRadius: lerp(seam.fromR, seam.toR),
            background: interpolateColors(p, [0, 1], [seam.fromBg, seam.toBg]),
            boxShadow: shadow,
            opacity: 1 - come,
            filter: `blur(${Math.min(4, speed * 60)}px)`,
            display: "flex",
            alignItems: "center",
            padding: `0 ${space.s3}px`,
            overflow: "hidden",
          }}
        >
          <div style={{ ...type.uiStrong, color: colour.ink, whiteSpace: "nowrap", opacity: 1 - clamp(p, [0.2, 0.6], [0, 1]) }}>{seam.label}</div>
        </div>
      ) : null}
    </>
  );
};

/**
 * A view can render its hero component normally, hide it (while a lifted copy
 * is shown above the window) or render only it (the lifted copy itself).
 */
export type HeroMode = "show" | "hide" | "only";
const heroVisible = (mode: HeroMode) => mode !== "hide";
const restVisible = (mode: HeroMode) => mode !== "only";

/** The hero's surface once lifted: Card with the one shadow, fading in with the lift. */
const liftedSurface = (lift: number): React.CSSProperties =>
  lift > 0 ? { background: colour.card, boxShadow: shadow, borderRadius: radius.card } : {};

/** Blank Paper blocks laid exactly where Today's header, tasks and calendar will be (S10–S11). */
export const TodaySkeleton: React.FC<{ b: number; opacity?: number }> = ({ b, opacity = 1 }) => {
  const blocks = [
    { x: 0, y: 0, w: 260, h: 40 },
    ...[0, 1, 2, 3].map((i) => ({ x: 0, y: TASK_Y(i), w: 520, h: 64 })),
    { x: CAL_X, y: 16, w: 1184 - CAL_X, h: HOUR_Y(4) + HOUR_H - 16 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      {blocks.map((r, i) => {
        const at = 14 + i * 4;
        const p = clamp(b, [at, at + 40], [0, 1], EASE.settle);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              borderRadius: radius.card,
              background: colour.paper,
              opacity: clamp(b, [at, at + 12], [0, 1], EASE.settle),
              translate: `${i === 5 ? (1 - p) * 72 : 0}px ${i === 5 ? 0 : (1 - p) * 48}px`,
              filter: `blur(${(1 - p) * 10}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

const Caption: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...type.caption, color: colour.stone, whiteSpace: "nowrap", ...style }}>{children}</div>
);

const Dot: React.FC<{ c: string; size?: number }> = ({ c, size = 10 }) => (
  <div style={{ width: size, height: size, borderRadius: radius.pill, background: c, flexShrink: 0 }} />
);

const Chip: React.FC<{ c: string; children: React.ReactNode }> = ({ c, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: space.s1, padding: "2px 12px", borderRadius: radius.pill, background: tint.ink06, ...type.caption, color: colour.ink }}>
    <Dot c={c} />
    {children}
  </div>
);

const ViewHeader: React.FC<{ title: string; meta: string }> = ({ title, meta }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: space.s2, height: 40 }}>
    <div style={{ ...type.uiStrong, fontSize: 28, color: colour.ink }}>{title}</div>
    <Caption>{meta}</Caption>
  </div>
);

// ── S11 · Today ─────────────────────────────────────────────────────────────
const TASKS = [
  { t: "Draft Acme proposal", chip: "Acme", c: CATEGORY.clients.dominant },
  { t: "Review Lumen feedback", chip: "Lumen", c: CATEGORY.projects.dominant },
  { t: "Send September invoices", chip: "Money", c: CATEGORY.money.dominant },
  { t: "Walk, 20 min", chip: "Life", c: CATEGORY.life.dominant },
];
const TASK_Y = (i: number) => 72 + i * 76;
const CAL_X = 600;
const HOUR_H = 100;
const HOUR_Y = (i: number) => 64 + i * HOUR_H;
const HOURS = ["9:00", "10:00", "11:00", "12:00", "13:00"];
export const TODAY = {
  grabAt: 40,
  dropAt: 96,
  /** Content-local rects of the dragged task row and the 10:00 slot. */
  row: { x: 0, y: TASK_Y(0), w: 520, h: 64 },
  slot: { x: CAL_X + 96, y: HOUR_Y(1) + 4, w: 1184 - CAL_X - 96, h: HOUR_H - 8 },
};

const TaskRow: React.FC<{ t: string; chip: string; c: string; style?: React.CSSProperties }> = ({ t, chip, c, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: space.s2,
      height: 64,
      padding: `0 ${space.s2}px`,
      borderRadius: radius.card,
      background: colour.card,
      ...style,
    }}
  >
    <div style={{ width: 22, height: 22, borderRadius: radius.pill, border: `2px solid ${colour.stone}`, flexShrink: 0 }} />
    <div style={{ ...type.ui, color: colour.ink, flex: 1, whiteSpace: "nowrap" }}>{t}</div>
    <Chip c={c}>{chip}</Chip>
  </div>
);

const EventBlock: React.FC<{ title: string; time: string; category: Category; style?: React.CSSProperties }> = ({ title, time, category, style }) => (
  <div
    style={{
      borderRadius: radius.card,
      background: CATEGORY[category].accent,
      borderLeft: `6px solid ${CATEGORY[category].dominant}`,
      padding: `${space.s2}px ${space.s3}px`,
      ...style,
    }}
  >
    <div style={{ ...type.uiStrong, color: colour.ink }}>{title}</div>
    <Caption>{time}</Caption>
  </div>
);

export const TodayView: React.FC<{ f: number }> = ({ f }) => {
  const drag = clamp(f, [TODAY.grabAt + 6, TODAY.dropAt], [0, 1], EASE.settle);
  const lifted = f >= TODAY.grabAt && f < TODAY.dropAt;
  const morph = clamp(f, [TODAY.dropAt, TODAY.dropAt + 10], [0, 1], EASE.settle);
  const closeUp = clamp(f, [TODAY.dropAt + 8, TODAY.dropAt + 8 + DUR.settle], [0, 1], EASE.settle);
  const { row, slot } = TODAY;
  const gx = row.x + (slot.x - row.x) * drag;
  const gy = row.y + (slot.y - row.y) * drag;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewHeader title="Today" meta="Thursday, 25 September" />
      {TASKS.slice(1).map((task, i) => (
        <div key={task.t} style={{ position: "absolute", left: 0, top: TASK_Y(i + 1), width: row.w, translate: `0 ${-closeUp * 76}px` }}>
          <TaskRow {...task} />
        </div>
      ))}
      <div style={{ position: "absolute", left: CAL_X, top: 16, width: 1184 - CAL_X }}>
        <Caption>Thursday</Caption>
      </div>
      {HOURS.map((h, i) => (
        <div key={h} style={{ position: "absolute", left: CAL_X, top: HOUR_Y(i), width: 1184 - CAL_X, height: HOUR_H, borderTop: `1px solid ${colour.hairline}` }}>
          <Caption style={{ marginTop: 8 }}>{h}</Caption>
        </div>
      ))}
      <EventBlock
        title="Call with Mara"
        time="11:00 – 12:00"
        category="calendar"
        style={{ position: "absolute", left: slot.x, top: HOUR_Y(2) + 4, width: slot.w, height: slot.h }}
      />
      {/* The dragged task: a lifted row that settles into the slot, then becomes an event. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: `${gx}px ${gy}px`,
          width: row.w,
          opacity: 1 - morph,
          filter: `blur(${morph * 2}px)`,
          boxShadow: lifted ? shadow : "none",
          borderRadius: radius.card,
          scale: String(1 + 0.05 * clamp(f, [TODAY.grabAt, TODAY.grabAt + 10], [0, 1], EASE.settle) * (1 - clamp(f, [TODAY.dropAt - 6, TODAY.dropAt], [0, 1], EASE.settle))),
        }}
      >
        <TaskRow {...TASKS[0]} />
      </div>
      <EventBlock
        title="Draft Acme proposal"
        time="10:00 – 11:00 · Acme"
        category="tasks"
        style={{ position: "absolute", left: slot.x, top: slot.y, width: slot.w, height: slot.h, opacity: morph, filter: `blur(${(1 - morph) * 2}px)` }}
      />
    </div>
  );
};
/** Content-local anchor where the thread leaves the scheduled task. */
export const TODAY_THREAD_FROM = { x: TODAY.slot.x + 40, y: TODAY.slot.y + TODAY.slot.h };

// ── S12 · Docs ──────────────────────────────────────────────────────────────
export const DOC = { lineAt: 84, updateAt: 132 };
/** Content-local hero: the task chip that flips to "Ready for review". Lifts from its left edge. */
export const DOC_HERO = { x: 0, y: 184, w: 520, h: 48, origin: { x: 0, y: 208 } };
type ViewProps = { f: number; hero?: HeroMode; lift?: number };
/** The chip's parts slide in from the left, 2 frames apart, overlapping as they settle. */
const chipPart = (f: number, i: number): React.CSSProperties => {
  const p = clamp(f, [24 + i * 2, 24 + i * 2 + 30], [0, 1], EASE.settle);
  return { opacity: clamp(p, [0, 0.4], [0, 1]), translate: `${(1 - p) * -40}px 0px` };
};
export const DocView: React.FC<ViewProps> = ({ f, hero = "show", lift = 0 }) => {
  const upd = clamp(f, [DOC.updateAt, DOC.updateAt + 16], [0, 1], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {restVisible(hero) ? (
        <>
          <Caption style={{ position: "absolute", top: 0 }}>Docs · Acme Studio</Caption>
          <div style={{ position: "absolute", top: 32, ...type.subhead, fontWeight: 500, color: colour.ink }}>Rebrand, phase two — proposal</div>
          <div style={{ position: "absolute", top: 104, ...type.ui, color: colour.stone, width: 880 }}>
            Phase two carries the new brand into the product: a type scale, a component kit and the pricing page.
          </div>
          <div style={{ position: "absolute", top: 296, display: "flex", alignItems: "center" }}>
            <Headline text="Timeline: two weeks, three reviews, one fixed fee." at={DOC.lineAt} style="ui" tone="ink" />
            {/* Text caret: solid while writing, then a hard on/off blink (no easing, like a real caret). */}
            <div
              style={{
                width: 2,
                height: 26,
                marginLeft: -4,
                background: colour.pink,
                opacity: f < DOC.lineAt - 24 || f > DOC.lineAt + 150 ? 0 : f < DOC.lineAt + 36 ? 1 : Math.floor((f - DOC.lineAt) / 16) % 2 === 0 ? 1 : 0,
              }}
            />
          </div>
        </>
      ) : null}
      {heroVisible(hero) ? (
        <div
          style={{
            position: "absolute",
            left: DOC_HERO.x,
            top: DOC_HERO.y,
            height: DOC_HERO.h,
            display: "inline-flex",
            alignItems: "center",
            gap: space.s2,
            padding: `0 ${space.s2}px`,
            borderRadius: radius.pill,
            background: colour.card,
            boxShadow: shadow,
          }}
        >
          <div style={chipPart(f, 0)}>
            <Dot c={colour.pink} />
          </div>
          <div style={{ ...type.uiStrong, color: colour.ink, whiteSpace: "nowrap", ...chipPart(f, 1) }}>Draft Acme proposal</div>
          <div style={{ width: 1, height: 20, background: colour.hairline, ...chipPart(f, 2) }} />
          <div style={{ position: "relative", minWidth: 150, height: 30, ...chipPart(f, 3) }}>
            <div style={{ position: "absolute", ...type.ui, color: colour.stone, opacity: 1 - upd, filter: `blur(${upd * 2}px)`, translate: `0 ${-upd * 10}px`, whiteSpace: "nowrap" }}>
              Today, 10:00
            </div>
            <div style={{ position: "absolute", ...type.ui, color: colour.pink, opacity: upd, filter: `blur(${(1 - upd) * 2}px)`, translate: `0 ${(1 - upd) * 10}px`, whiteSpace: "nowrap" }}>
              Ready for review
            </div>
          </div>
          {/* A soft pink ring answers the status change while the chip is lifted. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius.pill,
              border: `2px solid ${colour.pink}`,
              opacity: lift * (1 - clamp(f, [DOC.updateAt, DOC.updateAt + 40], [0, 1], EASE.settle)) * clamp(f, [DOC.updateAt - 2, DOC.updateAt], [0, 1]),
              scale: String(1 + 0.25 * clamp(f, [DOC.updateAt, DOC.updateAt + 40], [0, 1], EASE.settle)),
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

// ── S13 · Clients ───────────────────────────────────────────────────────────
const CLIENT_ROWS: { category: Category; t: string; meta: string }[] = [
  { category: "docs", t: "Proposal — rebrand, phase two", meta: "Ready for review" },
  { category: "tasks", t: "3 open tasks", meta: "Next: Draft Acme proposal · 10:00" },
  { category: "money", t: "12.5h tracked this week", meta: "$1,875 unbilled" },
];
export const CLIENT = { fillAt: 30 };
/** Content-local hero: the project progress, lifted on a card as it fills. */
export const CLIENT_HERO = { x: -24, y: 88, w: 1232, h: 96, origin: { x: 592, y: 136 } };
export const ClientView: React.FC<ViewProps & { rowAt?: number[] }> = ({ f, hero = "show", lift = 0, rowAt = [20, 28, 36] }) => {
  const fill = clamp(f, [CLIENT.fillAt, CLIENT.fillAt + 90], [0, 0.64], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {restVisible(hero) ? (
        <>
          <div style={{ position: "absolute", top: 0, display: "flex", alignItems: "center", gap: space.s2 }}>
            <Glyph category="clients" size={56} colourProgress={1} />
            <div>
              <div style={{ ...type.subhead, fontWeight: 500, color: colour.ink }}>Acme Studio</div>
              <Caption>Client since 2025 · 3 projects</Caption>
            </div>
          </div>
          <div style={{ position: "absolute", top: 216, width: "100%", display: "flex", flexDirection: "column", gap: space.s2 }}>
            {CLIENT_ROWS.map((r, i) => (
              <div key={r.t} style={{ display: "flex", alignItems: "center", gap: space.s2, height: 64, padding: `0 ${space.s2}px`, borderRadius: radius.card, background: tint.ink06, ...(i === 0 ? { opacity: f >= rowAt[0] ? 1 : 0 } : rise(f, rowAt[0] + i * 4, { dist: -32 })) }}>
                <Glyph category={r.category} size={40} colourProgress={1} />
                <div style={{ ...type.uiStrong, color: colour.ink, flex: 1 }}>{r.t}</div>
                <Caption>{r.meta}</Caption>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {heroVisible(hero) ? (
        <div style={{ position: "absolute", left: CLIENT_HERO.x, top: CLIENT_HERO.y, width: CLIENT_HERO.w, height: CLIENT_HERO.h, padding: `${space.s3}px ${space.s3}px`, ...liftedSurface(lift) }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...type.uiStrong, color: colour.ink }}>
            <span>Rebrand, phase two</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: colour.stone }}>{Math.round(fill * 100)}%</span>
          </div>
          <div style={{ marginTop: space.s1, height: 12, borderRadius: radius.pill, background: colour.hairline, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", borderRadius: radius.pill, background: colour.pink, transformOrigin: "0 50%", scale: `${fill} 1` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ── S14 · Money ─────────────────────────────────────────────────────────────
const HOURS_ROWS = [
  ["Mon 22", "Brand system, round 2", "3.0h"],
  ["Tue 23", "Brand system, round 2", "5.0h"],
  ["Wed 24", "Pricing page", "2.5h"],
  ["Thu 25", "Pricing page", "2.0h"],
];
export const MONEY = { collapseAt: 36, cardAt: 58, sendAt: 118, paidAt: 172 };
/** When the invoice has formed out of the hours row (view-local), in the seam version of S14. */
export const MONEY_MORPHED_AT = 22;
export const MONEY_SEND = { x: 1184 - 24 - 60, y: 64 + 330 - 24 - 24 }; // content-local centre of Send
/** Content-local hero: the invoice card, lifted for Send → Paid. */
export const MONEY_HERO = { x: 0, y: 64, w: 1184, h: 330, origin: { x: 592, y: 229 } };

export const MoneyView: React.FC<ViewProps & { magnet?: { x: number; y: number }; morphed?: boolean }> = ({ f, hero = "show", lift = 0, magnet = { x: 0, y: 0 }, morphed = false }) => {
  const clickRing = clamp(f, [MONEY.sendAt, MONEY.sendAt + 36], [0, 1], EASE.settle);
  const press = clamp(f, [MONEY.sendAt - 4, MONEY.sendAt], [0, 1], EASE.snap) * (1 - clamp(f, [MONEY.sendAt + 2, MONEY.sendAt + 10], [0, 1], EASE.settle));
  const sent = f >= MONEY.sendAt + 4;
  const paid = clamp(f, [MONEY.paidAt, MONEY.paidAt + 18], [0, 1], EASE.settle);
  const amount = Math.round(clamp(f, [(morphed ? MONEY_MORPHED_AT : MONEY.cardAt) + 10, (morphed ? MONEY_MORPHED_AT : MONEY.cardAt) + 60], [0, 1875], EASE.settle));
  const ripple = clamp(f, [MONEY.paidAt, MONEY.paidAt + 48], [0, 1], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {restVisible(hero) ? (
        <>
          <ViewHeader title="Money" meta="Acme Studio · tracked time" />
          {morphed ? null : HOURS_ROWS.map(([d, what, h], i) => (
            <div
              key={d}
              style={{
                position: "absolute",
                left: 0,
                top: 64 + i * 64,
                width: 1184,
                height: 56,
                display: "flex",
                alignItems: "center",
                gap: space.s3,
                borderBottom: `1px solid ${colour.hairline}`,
                // The hours converge upward into the invoice.
                ...leave(f, MONEY.collapseAt + i * 3, { dist: 24 + i * 16 }),
              }}
            >
              <Caption style={{ width: 90 }}>{d}</Caption>
              <div style={{ ...type.ui, color: colour.ink, flex: 1 }}>{what}</div>
              <div style={{ ...type.uiStrong, color: colour.ink, fontVariantNumeric: "tabular-nums" }}>{h}</div>
            </div>
          ))}
        </>
      ) : null}
      {heroVisible(hero) ? (
        <div
          style={{
            position: "absolute",
            left: MONEY_HERO.x,
            top: MONEY_HERO.y,
            width: MONEY_HERO.w,
            height: MONEY_HERO.h,
            borderRadius: radius.card,
            background: colour.paper,
            padding: space.s3,
            display: "flex",
            flexDirection: "column",
            ...(lift > 0 ? { background: colour.card, boxShadow: shadow } : null),
            ...(morphed ? {} : rise(f, MONEY.cardAt, { scale: true })),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: space.s2 }}>
            <Glyph category="money" size={40} colourProgress={1} />
            <div style={{ ...type.uiStrong, color: colour.ink }}>Invoice INV-1042</div>
            <Caption>Acme Studio</Caption>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: space.s4 }}>
            <div style={{ ...type.ui, color: colour.stone, flex: 1 }}>12.5h × $150 · Brand system, pricing page</div>
            <div style={{ ...type.subhead, fontWeight: 500, color: colour.ink, fontVariantNumeric: "tabular-nums" }}>${amount.toLocaleString("en-US")}.00</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ position: "relative", height: 36, minWidth: 140 }}>
              {sent ? (
                <div
                  style={{
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    gap: space.s1,
                    padding: "3px 14px",
                    borderRadius: radius.pill,
                    background: interpolateColors(paid, [0, 1], [tint.ink06, colour.blush]),
                    ...type.uiStrong,
                    color: interpolateColors(paid, [0, 1], [colour.stone, colour.pink]),
                    ...rise(f, MONEY.sendAt + 4, { dist: 12, dur: 24 }),
                    // Paid pops: an upward spring with a 3° tilt that snaps back to level.
                    scale: String(1 + 0.14 * kick(f, MONEY.paidAt, 28)),
                    rotate: `${f >= MONEY.paidAt ? 3 * (1 - clamp(f, [MONEY.paidAt, MONEY.paidAt + 20], [0, 1], POP)) : 0}deg`,
                    translate: `0 ${-8 * Math.max(0, kick(f, MONEY.paidAt, 28))}px`,
                  }}
                >
                  <div style={{ width: 20, height: 20, position: "relative" }}>
                    <Icon name="paper-plane-tilt" size={20} tint={colour.stone} style={{ position: "absolute", opacity: 1 - paid, scale: String(1 - paid * 0.75), filter: `blur(${paid * 4}px)` }} />
                    <Icon name="check" size={20} tint={colour.pink} style={{ position: "absolute", opacity: paid, scale: String(0.25 + paid * 0.75), filter: `blur(${(1 - paid) * 4}px)` }} />
                  </div>
                  <span>{paid > 0.5 ? "Paid" : "Sent"}</span>
                  {/* Paid answers with one ripple. */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: radius.pill,
                      border: `2px solid ${colour.pink}`,
                      opacity: ripple > 0 ? (1 - ripple) * 0.7 : 0,
                      scale: `${1 + ripple * 0.5} ${1 + ripple * 1.2}`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: space.s1,
                padding: "10px 20px 10px 22px",
                borderRadius: radius.pill,
                background: colour.ink,
                color: colour.paper,
                ...type.uiStrong,
                position: "relative",
                scale: String(1 - press * 0.06),
                // Magnetic hover: the button leans toward the approaching cursor.
                translate: `${magnet.x}px ${magnet.y}px`,
              }}
            >
              {/* The click throws a soft radial glow. */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 240,
                  height: 240,
                  marginLeft: -120,
                  marginTop: -120,
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, rgba(230, 53, 138, 0.55), rgba(138, 116, 255, 0.25) 55%, transparent)`,
                  opacity: clickRing > 0 ? (1 - clickRing) : 0,
                  scale: String(0.3 + clickRing * 1.4),
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: radius.pill,
                  border: `2px solid ${colour.pink}`,
                  opacity: clickRing > 0 ? (1 - clickRing) * 0.8 : 0,
                  scale: `${1 + clickRing * 0.6} ${1 + clickRing * 1.4}`,
                }}
              />
              Send
              <Icon name="arrow-right" size={20} tint={colour.paper} style={{ translate: `${clamp(f, [MONEY.sendAt, MONEY.sendAt + 14], [0, 6], EASE.settle) * (1 - clamp(f, [MONEY.sendAt + 14, MONEY.sendAt + 40], [0, 1], EASE.settle))}px 0px` }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ── S15 · Life ──────────────────────────────────────────────────────────────
const LIFE: { code: IllustrationCode; t: string; meta: string; category: Category }[] = [
  { code: "IMG-06a", t: "Deep work", meta: "Tue · 9:00 – 11:00", category: "tasks" },
  { code: "IMG-06b", t: "A walk", meta: "Every day · 18:00", category: "life" },
  { code: "IMG-06c", t: "Dinner with Sam", meta: "Fri · 19:30", category: "clients" },
  { code: "IMG-06d", t: "A day off", meta: "Saturday", category: "money" },
];
const LIFE_CW = (1184 - 32) / 2;
const LIFE_CH = (CONTENT.h - 64 - 32) / 2;
const lifeRect = (i: number) => ({ x: (i % 2) * (LIFE_CW + 32), y: 64 + Math.floor(i / 2) * (LIFE_CH + 32), w: LIFE_CW, h: LIFE_CH });
/** Each card flies in from its own corner and snaps into the grid on the settle curve. */
const diagonalIn = (f: number, at: number, i: number): React.CSSProperties => {
  const p = clamp(f, [at, at + 44], [0, 1], EASE.settle);
  const dx = (i % 2 === 0 ? -1 : 1) * 160;
  const dy = (i < 2 ? -1 : 1) * 110;
  return { opacity: clamp(f, [at, at + 14], [0, 1], EASE.settle), translate: `${(1 - p) * dx}px ${(1 - p) * dy}px`, scale: String(0.9 + 0.1 * p) };
};
/** Content-local hero: the "A walk" card. */
export const LIFE_HERO_INDEX = 1;
export const LIFE_HERO = { ...lifeRect(LIFE_HERO_INDEX), origin: { x: lifeRect(LIFE_HERO_INDEX).x + LIFE_CW / 2, y: lifeRect(LIFE_HERO_INDEX).y + LIFE_CH / 2 } };
export const LifeView: React.FC<ViewProps & { cardAt?: number[] }> = ({ f, hero = "show", lift = 0, cardAt = [16, 26, 36, 46] }) => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>
    {restVisible(hero) ? <ViewHeader title="This week" meta="Life" /> : null}
    {LIFE.map((c, i) => {
      const isHero = i === LIFE_HERO_INDEX;
      if (isHero ? !heroVisible(hero) : !restVisible(hero)) return null;
      const r = lifeRect(i);
      const at = cardAt[i];
      const art = LIFE_CH - 48;
      return (
        <div
          key={c.code}
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            borderRadius: radius.card,
            background: colour.paper,
            display: "flex",
            alignItems: "center",
            gap: space.s3,
            padding: space.s3,
            ...(isHero && lift > 0 ? { background: colour.card, boxShadow: shadow } : null),
            ...diagonalIn(f, at, i),
          }}
        >
          <div style={{ position: "relative", width: art, height: art, borderRadius: radius.inner, background: CATEGORY[c.category].accent, flexShrink: 0 }}>
            <Illustration
              code={c.code}
              rect={{ x: space.s1, y: space.s1, w: art - 2 * space.s1, h: art - 2 * space.s1 }}
              draw={clamp(f, [at + 6, at + 70], [0, 1], EASE.settle)}
              parallax={clamp(f, [at, at + 220], [0, 18], EASE.breathe) + (isHero ? lift * 14 : 0)}
            />
          </div>
          <div>
            <div style={{ ...type.uiStrong, color: colour.ink }}>{c.t}</div>
            <Caption style={{ marginTop: 4 }}>{c.meta}</Caption>
          </div>
        </div>
      );
    })}
  </div>
);

// ── S17 · Evening ───────────────────────────────────────────────────────────
/** Today in the evening: everything done but one; one click completes the day. */
export const EVENING = { clickAt: 150 };
/** Content-local centre of the last task's checkbox (the one interaction). */
export const EVENING_CHECK = { x: 16 + 11, y: 72 + 3 * 76 + 32 };
export const EveningView: React.FC<{ f: number }> = ({ f }) => {
  const done = clamp(f, [EVENING.clickAt, EVENING.clickAt + 14], [0, 1], EASE.settle);
  const card = clamp(f, [EVENING.clickAt + 12, EVENING.clickAt + 52], [0, 1], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewHeader title="Today" meta="Thursday, 25 September · evening" />
      {TASKS.map((task, i) => {
        const d = i < 3 ? 1 : done;
        return (
          <div key={task.t} style={{ position: "absolute", left: 0, top: TASK_Y(i), width: 520, display: "flex", alignItems: "center", gap: space.s2, height: 64, padding: `0 ${space.s2}px`, borderRadius: radius.card, background: colour.card }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.pill,
                border: `2px solid ${interpolateColors(d, [0, 1], [colour.stone, colour.pink])}`,
                background: interpolateColors(d, [0, 1], ["rgba(196, 28, 114, 0)", colour.pink]),
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scale: String(1 + (i === 3 ? 0.25 * kick(f, EVENING.clickAt, 24) : 0)),
              }}
            >
              <Icon name="check" size={14} tint={colour.white} style={{ opacity: d, scale: String(0.4 + 0.6 * d) }} />
            </div>
            <div style={{ position: "relative", ...type.ui, color: interpolateColors(d, [0, 1], [colour.ink, colour.stone]), flex: 1, whiteSpace: "nowrap" }}>
              {task.t}
              {/* The strike draws left to right as the task completes. */}
              <div style={{ position: "absolute", left: 0, top: "52%", height: 1.5, width: "100%", background: colour.stone, transformOrigin: "0 50%", scale: `${d} 1` }} />
            </div>
          </div>
        );
      })}
      {/* The acknowledgement: the day closes into the evening at the desk. */}
      <div
        style={{
          position: "absolute",
          left: CAL_X,
          top: 16,
          width: 1184 - CAL_X,
          height: HOUR_Y(4) + HOUR_H - 16,
          borderRadius: radius.card,
          background: colour.paper,
          overflow: "hidden",
          opacity: clamp(card, [0, 0.4], [0, 1]),
          translate: `0 ${(1 - card) * 24}px`,
        }}
      >
        <Illustration code="IMG-07" rect={{ x: 24, y: 64, w: 1184 - CAL_X - 48, h: HOUR_Y(4) + HOUR_H - 16 - 88 }} draw={card} parallax={clamp(f, [EVENING.clickAt, EVENING.clickAt + 200], [0, -16], EASE.breathe)} />
        <div style={{ position: "absolute", left: 24, top: 20, ...type.uiStrong, color: colour.ink }}>Done for today</div>
      </div>
    </div>
  );
};
