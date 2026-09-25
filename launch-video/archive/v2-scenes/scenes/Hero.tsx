import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { ClientView, CONTENT, DocView, LifeView, MoneyView, NAV, ProductWindow, ROW, ROW_H, ROW_Y0, SIDEBAR_W, TodayView, WIN } from "../components/Product";
import { Glyph } from "../components/Glyph";
import { RevealMark } from "../components/LogoReveal";
import { ParticleFlow, Particle } from "../gl/ParticleFlow";
import { rgb } from "../gl/gl";
import { ZONES } from "../brand/layout";
import { EASE, clamp } from "../brand/motion";
import { syncWords, syncedSpan } from "../brand/sync";
import { VO_AT, frames } from "../brand/timeline";
import { aurora, colour, radius, shadow, space, type } from "../brand/tokens";
import { FONT } from "../brand/fonts";
import { Scene } from "./shared";

/**
 * S16 · Everything connects (hero, TREATMENT.md §3). The workspace splits into
 * real 3D planes: the sidebar is the hub, five modules float around it. The
 * camera orbits the constellation; threads of light join every module to the
 * hub and a GPU particle stream carries information along them. Then it all
 * folds back into one calm window.
 *
 * One projection (`project`) drives the CSS 3D panels, the SVG threads and the
 * WebGL particles, so all three stay locked together as the camera moves.
 */

export const S16_HEADLINE = "All connected. Nothing to switch.";
const WORDS = syncWords(S16_HEADLINE, "S16", VO_AT.S16);

const P = 1500; // perspective (px): a ~35mm feel
const C = { x: 960, y: 610 }; // stage centre on screen
const OPEN: [number, number] = [6, 56];
const CLOSE_AT = frames("S16") - 58;

type Panel = { id: string; x: number; y: number; z: number; w: number; h: number; ry: number; view?: React.FC<{ f: number }>; accent: string };
const PANELS: Panel[] = [
  { id: "today", x: -600, y: -150, z: -140, w: 500, h: 250, ry: 16, view: TodayView, accent: aurora.periwinkle },
  { id: "docs", x: 600, y: -160, z: -120, w: 500, h: 250, ry: -16, view: DocView, accent: aurora.violet },
  { id: "client", x: -560, y: 230, z: -40, w: 500, h: 250, ry: 12, view: ClientView, accent: aurora.pink },
  { id: "money", x: 580, y: 220, z: -20, w: 500, h: 250, ry: -12, view: MoneyView as React.FC<{ f: number }>, accent: aurora.coral },
  { id: "life", x: 0, y: 330, z: -380, w: 440, h: 220, ry: 0, view: LifeView, accent: aurora.peach },
];
const HUB = { w: 300, h: 560, z: 120 };
/** Which sidebar row each module's thread leaves from. */
const HUB_ROW: Record<string, number> = { today: ROW.today, docs: ROW.docs, client: ROW.clients, money: ROW.money, life: ROW.life };

/** Camera: a push in from depth, then a slow orbit that accelerates through the middle. */
const camera = (f: number) => {
  const orbit = clamp(f, [OPEN[0], CLOSE_AT], [0, 1], EASE.breathe);
  const back = clamp(f, [CLOSE_AT, frames("S16")], [0, 1], EASE.settle);
  return { ry: (-16 + 32 * orbit) * (1 - back), tz: -260 + 260 * clamp(f, OPEN, [0, 1], EASE.settle) };
};

/** Project a stage point (x, y, z) through rotateY(ry) and the perspective. */
const project = (p: { x: number; y: number; z: number }, cam: { ry: number; tz: number }) => {
  const a = (cam.ry * Math.PI) / 180;
  const x = p.x * Math.cos(a) + p.z * Math.sin(a);
  const z = -p.x * Math.sin(a) + p.z * Math.cos(a) + cam.tz;
  const s = P / (P - z);
  return { x: C.x + x * s, y: C.y + p.y * s, s };
};

/** Each panel's position: from its place inside the flat window (split) to the constellation and back. */
const panelAt = (pn: Panel, f: number) => {
  const open = clamp(f, [OPEN[0] + 4, OPEN[1] + 6], [0, 1], EASE.settle);
  const close = clamp(f, [CLOSE_AT, CLOSE_AT + 44], [0, 1], EASE.settle);
  const k = open * (1 - close);
  const home = { x: WIN.x + CONTENT.x + CONTENT.w / 2 - C.x, y: WIN.y + CONTENT.y + CONTENT.h / 2 - C.y, z: 0 };
  return { x: home.x + (pn.x - home.x) * k, y: home.y + (pn.y - home.y) * k, z: pn.z * k, ry: pn.ry * k, k };
};
const hubAt = (f: number) => {
  const open = clamp(f, [OPEN[0], OPEN[1]], [0, 1], EASE.settle);
  const close = clamp(f, [CLOSE_AT, CLOSE_AT + 44], [0, 1], EASE.settle);
  const k = open * (1 - close);
  const home = { x: WIN.x + SIDEBAR_W / 2 - C.x, y: WIN.y + WIN.h / 2 - C.y };
  return { x: home.x * (1 - k), y: home.y * (1 - k), z: HUB.z * k, k };
};

/** Thread from a hub row to a panel's near edge, as a cubic in stage space. */
const threadPts = (pn: Panel, f: number) => {
  const h = hubAt(f);
  const p = panelAt(pn, f);
  const rowY = h.y - HUB.h / 2 + 96 + HUB_ROW[pn.id] * 54 + 20;
  const side = Math.sign(pn.x) || 1;
  const a = { x: h.x + (side * HUB.w) / 2, y: rowY, z: h.z };
  const b = { x: p.x - (side * pn.w) / 2, y: p.y, z: p.z };
  return [a, { x: a.x + side * 180, y: a.y, z: a.z }, { x: b.x - side * 180, y: b.y, z: b.z }, b];
};
const bez = (pts: { x: number; y: number; z: number }[], u: number) => {
  const m = 1 - u;
  const w = [m * m * m, 3 * m * m * u, 3 * m * u * u, u * u * u];
  return { x: pts.reduce((s, p, i) => s + p.x * w[i], 0), y: pts.reduce((s, p, i) => s + p.y * w[i], 0), z: pts.reduce((s, p, i) => s + p.z * w[i], 0) };
};

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export const S16: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S16");
  const cam = camera(frame);
  const hub = hubAt(frame);
  const flat = 1 - clamp(frame, [0, 18], [0, 1], EASE.settle) + clamp(frame, [CLOSE_AT + 22, CLOSE_AT + 46], [0, 1], EASE.settle);
  const threads = clamp(frame, [OPEN[1] - 10, OPEN[1] + 50], [0, 1], EASE.settle) * (1 - clamp(frame, [CLOSE_AT - 10, CLOSE_AT + 20], [0, 1], EASE.leave));

  // Particles: information flowing from the hub out to every module (and some back).
  const particles: Particle[] = [];
  if (threads > 0) {
    PANELS.forEach((pn, pi) => {
      const pts = threadPts(pn, frame).map((q) => q);
      const col = rgb(pn.accent);
      for (let i = 0; i < 70; i++) {
        const seed = pi * 1000 + i;
        const dir = hash(seed + 3) < 0.25 ? -1 : 1;
        let u = (hash(seed) + (frame / 60) * (0.35 + hash(seed + 1) * 0.45) * dir) % 1;
        if (u < 0) u += 1;
        const reveal = clamp(u, [0, 1], [0, 1]) <= threads * 1.1 ? 1 : 0;
        const w = bez(pts, u);
        const jitter = (hash(seed + 7) - 0.5) * 14;
        const s = project({ x: w.x, y: w.y + jitter, z: w.z }, cam);
        particles.push({
          x: s.x,
          y: s.y,
          size: (7 + hash(seed + 5) * 11) * s.s,
          alpha: reveal * threads * Math.sin(Math.PI * u) * (0.5 + hash(seed + 9) * 0.5),
          c: hash(seed + 11) < 0.3 ? rgb(aurora.pink) : col,
        });
      }
    });
  }

  return (
    <Scene>
      <Place id="headline" rect={ZONES.headlineTop} moving={during(frame, syncedSpan(WORDS))}>
        <Headline text={S16_HEADLINE} at={WORDS[0]} wordAt={WORDS} align="center" width={ZONES.headlineTop.w} exitAt={len - 18} />
      </Place>

      {/* The flat window: present at the cut in, dissolving as it splits, and re-forming at the end. */}
      {flat > 0.01 ? (
        <ProductWindow rows={NAV.map(() => 1)} colours={NAV.map(() => 1)} selected={ROW.life} frame={{ opacity: Math.min(1, flat) }} content={<LifeView f={999} />} />
      ) : null}

      {/* The 3D stage. */}
      <div style={{ position: "absolute", inset: 0, perspective: P, perspectiveOrigin: `${C.x}px ${C.y}px`, opacity: frame > len / 2 ? 1 - clamp(frame, [CLOSE_AT + 30, CLOSE_AT + 50], [0, 1]) : 1 }}>
        <div style={{ position: "absolute", left: C.x, top: C.y, transformStyle: "preserve-3d", transform: `translateZ(${cam.tz}px) rotateY(${cam.ry}deg)` }}>
          {/* Hub: the sidebar, the one place everything runs through. */}
          <div
            style={{
              position: "absolute",
              left: -HUB.w / 2,
              top: -HUB.h / 2,
              width: HUB.w,
              height: HUB.h,
              transform: `translate3d(${hub.x}px, ${hub.y}px, ${hub.z}px)`,
              borderRadius: radius.window,
              background: colour.card,
              boxShadow: shadow,
              fontFamily: FONT,
              opacity: frame < 4 ? 0 : 1,
            }}
          >
            <div style={{ position: "absolute", left: 28, top: 26, display: "flex", alignItems: "center", gap: space.s2 }}>
              <RevealMark size={30} />
              <div style={{ ...type.uiStrong, color: colour.ink }}>Zenboard</div>
            </div>
            {NAV.map((n, i) => {
              const isLinked = Object.values(HUB_ROW).includes(i);
              const pulse = isLinked ? threads * (0.6 + 0.4 * Math.sin(frame / 7 + i)) : 0;
              return (
                <div
                  key={n.label}
                  style={{
                    position: "absolute",
                    left: 14,
                    right: 14,
                    top: 96 + i * 54,
                    height: 44,
                    borderRadius: radius.card,
                    display: "flex",
                    alignItems: "center",
                    gap: space.s2,
                    paddingLeft: 12,
                    background: `rgba(251, 226, 238, ${pulse * 0.9})`,
                  }}
                >
                  <Glyph category={n.category} size={32} colourProgress={1} />
                  <div style={{ ...type.ui, fontSize: 19, color: colour.ink }}>{n.label}</div>
                </div>
              );
            })}
          </div>

          {/* Modules on their own planes. */}
          {PANELS.map((pn, i) => {
            const p = panelAt(pn, frame);
            const View = pn.view!;
            const inner = pn.w / CONTENT.w;
            return (
              <div
                key={pn.id}
                style={{
                  position: "absolute",
                  left: -pn.w / 2,
                  top: -pn.h / 2,
                  width: pn.w,
                  height: pn.h,
                  transform: `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateY(${p.ry}deg) scale(${0.86 + 0.14 * p.k})`,
                  borderRadius: radius.window,
                  background: colour.card,
                  boxShadow: `${shadow}, 0 0 0 1px rgba(255, 255, 255, 0.6), 0 0 60px ${pn.accent}55`,
                  overflow: "hidden",
                  fontFamily: FONT,
                  opacity: clamp(frame, [OPEN[0] + i * 3, OPEN[0] + i * 3 + 16], [0, 1]) * (1 - clamp(frame, [CLOSE_AT + 20, CLOSE_AT + 44], [0, 1])),
                  filter: `blur(${Math.max(0, -p.z - 200) / 60}px)`,
                }}
              >
                <div style={{ position: "absolute", left: 18, top: 16, width: CONTENT.w, height: CONTENT.h, transformOrigin: "0 0", scale: String(inner * 0.94) }}>
                  <View f={999} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Threads of light, projected with the same camera. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
        <defs>
          <linearGradient id="thread" x1="0" x2="1">
            <stop offset="0" stopColor={aurora.violet} />
            <stop offset="0.55" stopColor={aurora.pink} />
            <stop offset="1" stopColor={aurora.coral} />
          </linearGradient>
        </defs>
        {PANELS.map((pn, i) => {
          const pts = threadPts(pn, frame);
          const steps = 40;
          const reveal = clamp(threads, [i * 0.08, 0.6 + i * 0.08], [0, 1]);
          const d = Array.from({ length: steps + 1 }, (_, k) => {
            const w = bez(pts, (k / steps) * reveal);
            const s = project(w, cam);
            return `${k ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
          }).join(" ");
          return (
            <path
              key={pn.id}
              d={d}
              fill="none"
              stroke="url(#thread)"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={threads * 0.9}
              style={{ filter: `drop-shadow(0 0 6px ${aurora.pink})` }}
            />
          );
        })}
      </svg>
      <ParticleFlow particles={particles} frame={frame} />

      <Sfx at={OPEN[0]} sound="whoosh-soft" volume={0.3} />
      <Sfx at={OPEN[1]} sound="thread" volume={0.28} />
      {PANELS.map((_, i) => (
        <Sfx key={i} at={OPEN[1] + 6 + i * 7} sound="tick-tuned" variant={i + 2} volume={0.2} />
      ))}
      <Sfx at={CLOSE_AT} sound="whoosh-soft" volume={0.22} />
      <Sfx at={CLOSE_AT + 40} sound="snap" volume={0.2} />
    </Scene>
  );
};

/** Screen point of a sidebar row glyph in the flat window (used by the ending). */
export const sidebarGlyphScreen = (i: number) => ({ x: WIN.x + 16 + 16 + 20, y: WIN.y + ROW_Y0 + i * ROW_H + ROW_H / 2 });
