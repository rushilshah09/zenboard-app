import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Sfx } from "../components/Sfx";
import { color, ease, font, radius, tween } from "../theme";

/** Scene 7 — the business spine: one object flows from request to payment. */

const NODES = [
  { k: "Request", v: "Pricing page", sub: "via client portal" },
  { k: "Project", v: "Acme rebrand", sub: "task added" },
  { k: "Time", v: "12.5h", sub: "tracked, unbilled" },
  { k: "Invoice", v: "INV-1042", sub: "one click" },
  { k: "Paid", v: "$1,875.00", sub: "reconciled" },
];

const NODE_W = 300;
const GAP = 44;
const START_X = (1920 - (NODES.length * NODE_W + (NODES.length - 1) * GAP)) / 2;
const ROW_Y = 450;
const NODE_H = 190;
const STEP = 22;
const FIRST = 22;

export const Spine: React.FC = () => {
  const frame = useCurrentFrame();
  const headIn = tween(frame, [0, 16], [0, 1]);
  const lineStart = START_X + NODE_W / 2;
  const lineEnd = START_X + (NODES.length - 1) * (NODE_W + GAP) + NODE_W / 2;
  const lineT = tween(frame, [FIRST, FIRST + STEP * (NODES.length - 1)], [0, 1], (x) => x);
  const capIn = tween(frame, [FIRST + STEP * 5, FIRST + STEP * 5 + 16], [0, 1]);

  return (
    <AbsoluteFill style={{ background: color.canvas, fontFamily: font.sans }}>
      <div
        style={{
          position: "absolute",
          top: 170,
          width: "100%",
          textAlign: "center",
          fontSize: 104,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: color.ink900,
          opacity: headIn,
          translate: `0 ${(1 - headIn) * 20}px`,
        }}
      >
        From request to paid.
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={lineStart} x2={lineEnd} y1={ROW_Y + NODE_H / 2} y2={ROW_Y + NODE_H / 2} stroke={color.line} strokeWidth={2} />
        <line
          x1={lineStart}
          x2={lineStart + (lineEnd - lineStart) * lineT}
          y1={ROW_Y + NODE_H / 2}
          y2={ROW_Y + NODE_H / 2}
          stroke={color.ink900}
          strokeWidth={2}
        />
      </svg>

      {NODES.map((n, i) => {
        const at = FIRST + i * STEP;
        const inT = tween(frame, [4 + i * 3, 18 + i * 3], [0, 1]);
        const on = tween(frame, [at, at + 10], [0, 1], ease.spring);
        const last = i === NODES.length - 1;
        return (
          <div
            key={n.k}
            style={{
              position: "absolute",
              left: START_X + i * (NODE_W + GAP),
              top: ROW_Y,
              width: NODE_W,
              height: NODE_H,
              borderRadius: radius.xl,
              background: last && on > 0.5 ? color.success100 : color.paper,
              border: `2px solid ${on > 0.5 ? (last ? color.success500 : color.ink900) : color.line}`,
              padding: 28,
              opacity: inT,
              translate: `0 ${(1 - inT) * 24}px`,
              scale: String(1 + Math.sin(on * Math.PI) * 0.05),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 20,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: last && on > 0.5 ? color.success600 : color.ink500,
              }}
            >
              {String(i + 1).padStart(2, "0")} · {n.k}
            </div>
            <div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.02em",
                  color: on > 0.5 ? color.ink900 : color.ink500,
                  fontFamily: i >= 2 ? font.mono : font.sans,
                }}
              >
                {n.v}
              </div>
              <div style={{ fontSize: 22, color: color.ink500, marginTop: 4 }}>{n.sub}</div>
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          top: 780,
          width: "100%",
          textAlign: "center",
          fontSize: 48,
          letterSpacing: "-0.015em",
          color: color.ink600,
          opacity: capIn,
          translate: `0 ${(1 - capIn) * 14}px`,
        }}
      >
        One connected workspace. No copy-paste.
      </div>
      <Sfx at={110} sound="ding" volume={0.35} />
    </AbsoluteFill>
  );
};
