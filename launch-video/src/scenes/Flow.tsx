import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Illustration } from "../components/Illustration";
import { Sfx } from "../components/Sfx";
import { color, ease, font, ground, light, radius, shadow, tween } from "../theme";

/**
 * 14 · "Because everything is connected." The camera rides one request
 * down the chain — request → task → time → invoice → paid — then pulls
 * back to show the whole line.
 */

const NODE_W = 400;
const NODE_H = 124;
const STEP_X = 560;

const NODES = [
  { k: "Request", v: "Pricing page", sub: "from the client portal", glyph: "◎", at: 96 },
  { k: "Task", v: "Build pricing page", sub: "added to Acme rebrand", glyph: "✓", at: 140 },
  { k: "Time", v: "12.5h tracked", sub: "straight from the task", glyph: "◷", at: 184 },
  { k: "Invoice", v: "INV-1042", sub: "drafted in one click", glyph: "$", at: 228 },
  { k: "Paid", v: "$1,875.00", sub: "reconciled", glyph: "✓", at: 268 },
].map((n, i) => ({ ...n, x: i * STEP_X, y: i % 2 ? 230 : 0 }));

const PULLBACK = 292;

export const Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = tween(frame, [0, 22], [0, 1], ease.spring);
  const introOut = tween(frame, [78, 96], [0, 1], ease.inOut);

  // Camera x follows the most recently activated node.
  let camX = NODES[0].x;
  for (let i = 1; i < NODES.length; i++) {
    camX += (NODES[i].x - NODES[i - 1].x) * tween(frame, [NODES[i].at - 14, NODES[i].at + 4], [0, 1], ease.inOut);
  }
  const back = tween(frame, [PULLBACK, PULLBACK + 30], [0, 1], ease.inOut);
  const chainMid = (NODES[NODES.length - 1].x + NODE_W) / 2;
  const cx = camX + NODE_W / 2 + (chainMid - camX - NODE_W / 2) * back;
  const zoom = 1 - back * 0.4;

  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      {[
        { c: ground.blush, x: 20, y: 30, s: 900 },
        { c: ground.sand, x: 80, y: 80, s: 1000 },
        { c: color.berry300, x: 70, y: 10, s: 600 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x + Math.sin((frame + i * 60) / 70) * 6}%`,
            top: `${b.y}%`,
            width: b.s,
            height: b.s,
            marginLeft: -b.s / 2,
            marginTop: -b.s / 2,
            borderRadius: "50%",
            background: b.c,
            filter: "blur(140px)",
            opacity: 0.55 * tween(frame, [60, 110], [0, 1]),
          }}
        />
      ))}

      {/* Intro: the puzzle */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - introOut, scale: String(1 - introOut * 0.2) }}>
        <div
          style={{
            width: 520,
            height: 520,
            borderRadius: radius.xl * 2,
            background: ground.blush,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: intro,
            scale: String(0.85 + intro * 0.15),
            translate: "0 -90px",
          }}
        >
          <Illustration name="connected-puzzle" draw={tween(frame, [4, 70], [0, 1], (x) => x)} size={440} />
        </div>
        <div style={{ position: "absolute", top: 820, width: 1600 }}>
          <Headline text="Because everything is *connected.*" at={8} size={92} tint={light.text} />
        </div>
      </AbsoluteFill>

      {/* The chain */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          scale: String(zoom),
          transformOrigin: "0 0",
          opacity: tween(frame, [84, 100], [0, 1]),
        }}
      >
        <div style={{ position: "absolute", left: -cx, top: -NODE_H / 2 - 115 }}>
          <svg width={NODES[NODES.length - 1].x + NODE_W + 40} height={NODE_H + 260} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {NODES.slice(0, -1).map((n, i) => {
              const m = NODES[i + 1];
              const x1 = n.x + NODE_W;
              const y1 = n.y + NODE_H / 2;
              const x2 = m.x;
              const y2 = m.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const draw = tween(frame, [n.at + 6, m.at], [0, 1], ease.inOut);
              return (
                <g key={i}>
                  <path d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} stroke={light.faint} strokeWidth={4} fill="none" />
                  <path
                    d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                    stroke={color.berry500}
                    strokeWidth={4}
                    fill="none"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - draw}
                  />
                </g>
              );
            })}
          </svg>
          {NODES.map((n, i) => {
            const on = tween(frame, [n.at, n.at + 12], [0, 1], ease.spring);
            const last = i === NODES.length - 1;
            const pulse = last ? tween(frame, [n.at, n.at + 40], [0, 1]) : 0;
            return (
              <div key={n.k} style={{ position: "absolute", left: n.x, top: n.y, width: NODE_W }}>
                {last ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      height: NODE_H,
                      borderRadius: radius.pill,
                      border: `3px solid ${color.success500}`,
                      scale: String(1 + pulse * 0.35),
                      opacity: (1 - pulse) * (pulse > 0 ? 1 : 0),
                    }}
                  />
                ) : null}
                <div
                  style={{
                    height: NODE_H,
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    padding: "0 30px 0 16px",
                    borderRadius: radius.pill,
                    background: light.surface,
                    border: `2px solid ${on > 0.5 ? (last ? color.success500 : light.text) : light.faint}`,
                    boxShadow: on > 0.5 ? shadow.float : "none",
                    opacity: 0.25 + on * 0.75,
                    scale: String(0.9 + on * 0.1),
                    fontFamily: font.sans,
                  }}
                >
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: radius.pill,
                      background: on > 0.5 ? (last ? color.success500 : color.berry500) : light.faint,
                      color: light.surface,
                      fontSize: 40,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {n.glyph}
                  </div>
                  <div>
                    <div style={{ fontFamily: font.mono, fontSize: 18, letterSpacing: "0.06em", textTransform: "uppercase", color: light.muted }}>
                      {String(i + 1).padStart(2, "0")} · {n.k}
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", color: light.text, whiteSpace: "nowrap" }}>{n.v}</div>
                  </div>
                </div>
                <div style={{ marginTop: 16, paddingLeft: 30, fontFamily: font.sans, fontSize: 24, color: light.muted, opacity: on }}>{n.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", top: 110, width: "100%", opacity: back }}>
        <Headline text="One request. *Zero* copy-paste." at={PULLBACK + 4} size={84} tint={light.text} />
      </div>

      {NODES.map((n, i) => (
        <Sfx key={n.k} at={n.at} sound={i === NODES.length - 1 ? "chime" : "pop"} volume={i === NODES.length - 1 ? 0.45 : 0.35} />
      ))}
      {NODES.slice(1).map((n) => (
        <Sfx key={`w${n.k}`} at={n.at - 14} sound="swipe" volume={0.18} />
      ))}
      <Sfx at={PULLBACK} sound="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};
