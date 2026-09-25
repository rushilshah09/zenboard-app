import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Cursor } from "../components/primitives";
import {
  DOC_PICK_AT,
  DOC_SLASH_AT,
  DocView,
  MONEY_CLICK_AT,
  MoneyView,
  PORTAL_ACCEPT_AT,
  PortalView,
  SHELL_H,
  SHELL_W,
  SIDEBAR_W,
  Sidebar,
  TODAY_ROWS,
  TodayView,
  navY,
} from "../components/Product";
import { Sfx, TypingSfx } from "../components/Sfx";
import { color, ease, font, radius, shadow, tween } from "../theme";

/**
 * 09–12 · The tour. One app shell stays on screen across four scenes; only
 * the sidebar selection and the content change — the "one place" idea,
 * shown rather than said.
 */

type Segment = {
  nav: number;
  headline: string;
  View: React.FC<{ f: number }>;
  /** Cursor waypoints after the nav click: [frame, x, y] in shell coords. */
  path: [number, number, number][];
  clicks: number[];
};

const CONTENT_X = SIDEBAR_W + 36;
const CONTENT_Y = 28;
const CLICK = 14;
const SWAP = 18;

const SEGMENTS: Segment[] = [
  {
    nav: 0,
    headline: "Plan your day *in seconds.*",
    View: TodayView,
    path: [
      [50, CONTENT_X + 10, 130],
      [TODAY_ROWS[0].doneAt! + SWAP, CONTENT_X + 10, 130],
      [TODAY_ROWS[2].doneAt! + SWAP - 10, CONTENT_X + 10, 222],
      [150, CONTENT_X + 200, 330],
    ],
    clicks: [TODAY_ROWS[0].doneAt! + SWAP, TODAY_ROWS[2].doneAt! + SWAP],
  },
  {
    nav: 3,
    headline: "Write *right next* to the work.",
    View: DocView,
    path: [
      [40, CONTENT_X + 420, 260],
      [150, CONTENT_X + 440, 270],
    ],
    clicks: [],
  },
  {
    nav: 5,
    headline: "Hours to invoice, *in one click.*",
    View: MoneyView,
    path: [
      [MONEY_CLICK_AT + SWAP - 2, 1000, 312],
      [150, 960, 360],
    ],
    clicks: [MONEY_CLICK_AT + SWAP],
  },
  {
    nav: 4,
    headline: "A portal for *every client.*",
    View: PortalView,
    path: [
      [PORTAL_ACCEPT_AT + SWAP - 2, 1010, 272],
      [150, 960, 330],
    ],
    clicks: [PORTAL_ACCEPT_AT + SWAP],
  },
];

const SCALE = 1.55;

const along = (frame: number, pts: [number, number, number][]) => {
  if (frame <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [f0, x0, y0] = pts[i];
    const [f1, x1, y1] = pts[i + 1];
    if (frame <= f1) {
      const t = tween(frame, [f0, f1], [0, 1], ease.inOut);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const l = pts[pts.length - 1];
  return { x: l[1], y: l[2] };
};

export const Tour: React.FC<{ index: 0 | 1 | 2 | 3 }> = ({ index }) => {
  const frame = useCurrentFrame();
  const seg = SEGMENTS[index];
  const prev = index > 0 ? SEGMENTS[index - 1] : null;
  const first = index === 0;

  const enter = first ? tween(frame, [0, 26], [0, 1], ease.out) : 1;
  const pill = prev ? prev.nav + (seg.nav - prev.nav) * tween(frame, [CLICK, CLICK + 12], [0, 1], ease.spring) : seg.nav;
  const outT = tween(frame, [SWAP - 4, SWAP + 8], [0, 1], ease.in);
  const inT = first ? tween(frame, [10, 30], [0, 1]) : tween(frame, [SWAP + 2, SWAP + 16], [0, 1]);
  const drift = tween(frame, [0, 150], [0, 1], (x) => x);

  // Cursor: from the previous segment's resting point, to the nav item, then along this segment's path.
  const navPt = { x: 110, y: navY(seg.nav) + 15 };
  const start = prev ? prev.path[prev.path.length - 1] : ([0, 900, 560] as [number, number, number]);
  const cursorPath: [number, number, number][] = first
    ? [[0, 700, 420], ...seg.path]
    : [[0, start[1], start[2]], [CLICK - 2, navPt.x, navPt.y], [CLICK + 6, navPt.x, navPt.y], ...seg.path];
  const cur = along(frame, cursorPath);
  const clicks = first ? seg.clicks : [CLICK, ...seg.clicks];
  const press = clicks.reduce(
    (p, c) => Math.max(p, tween(frame, [c - 3, c], [0, 1]) * (1 - tween(frame, [c + 1, c + 5], [0, 1]))),
    0,
  );

  const Prev = prev?.View;
  return (
    <AbsoluteFill style={{ background: color.canvas, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 80% 0%, rgba(196,28,114,0.14) 0%, transparent 55%)`,
        }}
      />
      <div style={{ position: "absolute", left: 110, top: 70, width: 1700 }}>
        <Headline key={index} text={seg.headline} at={first ? 8 : SWAP} size={88} tint={color.ink900} accent={color.berry300} align="left" out={138} />
      </div>
      <div
        style={{
          position: "absolute",
          left: (1920 - SHELL_W) / 2,
          top: 250,
          width: SHELL_W,
          height: SHELL_H,
          scale: String(SCALE * (0.92 + enter * 0.08) * (1 + drift * 0.015)),
          transformOrigin: "50% 0",
          opacity: enter,
          translate: `0 ${(1 - enter) * 120}px`,
          borderRadius: radius.xl,
          background: color.paper,
          border: `1px solid ${color.line}`,
          boxShadow: shadow.lift3,
          overflow: "hidden",
          fontFamily: font.sans,
        }}
      >
        <Sidebar active={pill} />
        <div style={{ position: "absolute", left: CONTENT_X, top: CONTENT_Y, right: 36, bottom: 0 }}>
          {Prev ? (
            <div style={{ position: "absolute", inset: 0, opacity: 1 - outT, translate: `${-outT * 40}px 0`, filter: `blur(${outT * 4}px)` }}>
              <Prev f={150} />
            </div>
          ) : null}
          <div style={{ position: "absolute", inset: 0, opacity: inT, translate: `${(1 - inT) * 40}px 0` }}>
            <seg.View f={frame - SWAP} />
          </div>
        </div>
        <Cursor x={cur.x - 3} y={cur.y - 3} pressed={press} size={22} />
      </div>

      {first ? <Sfx at={0} sound="whoosh" volume={0.3} /> : <Sfx at={CLICK} sound="tick" volume={0.45} />}
      {!first ? <Sfx at={SWAP} sound="swipe" volume={0.2} /> : null}
      {seg.clicks.map((c) => (
        <Sfx key={c} at={c} sound="tick" volume={0.45} />
      ))}
      {index === 0 ? seg.clicks.map((c) => <Sfx key={`p${c}`} at={c + 2} sound="pop" volume={0.25} />) : null}
      {index === 1 ? (
        <>
          <TypingSfx at={SWAP + 18} chars={34} cps={40} volume={0.18} />
          <Sfx at={SWAP + DOC_SLASH_AT} sound="key-2" volume={0.35} />
          <Sfx at={SWAP + DOC_SLASH_AT + 4} sound="pop" volume={0.25} />
          <Sfx at={SWAP + DOC_PICK_AT} sound="pop" volume={0.35} />
        </>
      ) : null}
      {index === 2 ? <Sfx at={MONEY_CLICK_AT + SWAP + 8} sound="shimmer" volume={0.25} /> : null}
      {index === 3 ? <Sfx at={PORTAL_ACCEPT_AT + SWAP + 2} sound="chime" volume={0.35} /> : null}
    </AbsoluteFill>
  );
};

export const TourToday: React.FC = () => <Tour index={0} />;
export const TourDocs: React.FC = () => <Tour index={1} />;
export const TourMoney: React.FC = () => <Tour index={2} />;
export const TourPortal: React.FC = () => <Tour index={3} />;
