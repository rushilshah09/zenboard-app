import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Caret, Kbd, Panel } from "../components/primitives";
import { Sfx } from "../components/Sfx";
import { color, ease, font, light, radius, shadow, tween, typed } from "../theme";

/** Scene 5 — ⌘K: say what you want, Zenboard files it. */

const QUERY = "Invoice Acme for this week";
const TYPE_AT = 26;
const ENTER_AT = 84;
const SCALE = 1.75;
const W = 620;

const RESULTS = [
  { icon: "◧", title: "Create invoice · Acme Studio", meta: "12.5h unbilled", active: true },
  { icon: "◷", title: "Open time log · Acme rebrand", meta: "This week", active: false },
  { icon: "◎", title: "Go to client · Acme Studio", meta: "Client", active: false },
];

export const Command: React.FC = () => {
  const frame = useCurrentFrame();
  const headIn = tween(frame, [0, 16], [0, 1]);
  const panelIn = tween(frame, [8, 26], [0, 1], ease.spring);
  const query = typed(frame, TYPE_AT, QUERY, 30);
  const resultsIn = tween(frame, [TYPE_AT + 18, TYPE_AT + 32], [0, 1]);
  const flip = tween(frame, [ENTER_AT, ENTER_AT + 14], [0, 1], ease.inOut);
  const invoiceIn = tween(frame, [ENTER_AT + 8, ENTER_AT + 26], [0, 1]);
  const amount = Math.round(tween(frame, [ENTER_AT + 12, ENTER_AT + 40], [0, 1875]));

  return (
    <AbsoluteFill style={{ background: light.bg, fontFamily: font.sans }}>
      <div
        style={{
          position: "absolute",
          top: 110,
          width: "100%",
          textAlign: "center",
          fontSize: 96,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: light.text,
          opacity: headIn,
          translate: `0 ${(1 - headIn) * 20}px`,
        }}
      >
        One keystroke away.
      </div>

      <div
        style={{
          position: "absolute",
          left: 960 - (W * SCALE) / 2,
          top: 300,
          width: W,
          scale: String(SCALE * (0.96 + panelIn * 0.04)),
          transformOrigin: "0 0",
          opacity: panelIn * (1 - flip),
          translate: `0 ${(1 - panelIn) * 30 - flip * 30}px`,
        }}
      >
        <Panel width={W} style={{ boxShadow: shadow.float }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px" }}>
            <Kbd>⌘K</Kbd>
            <div style={{ flex: 1, fontSize: 18, color: query ? color.ink900 : color.ink500, letterSpacing: "-0.01em" }}>
              {query || "Type a command or search…"}
              {frame < ENTER_AT ? <Caret height={20} /> : null}
            </div>
          </div>
          <div style={{ height: 1, background: color.line2 }} />
          <div style={{ padding: 8, opacity: resultsIn, height: 8 + 44 * RESULTS.length * resultsIn, overflow: "hidden" }}>
            {RESULTS.map((r) => (
              <div
                key={r.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  height: 44,
                  padding: "0 12px",
                  borderRadius: radius.md,
                  background: r.active ? color.wash : "transparent",
                  color: r.active ? color.ink900 : color.ink600,
                  fontSize: 14,
                }}
              >
                <span style={{ width: 16, color: color.ink500 }}>{r.icon}</span>
                <span style={{ flex: 1 }}>{r.title}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{r.meta}</span>
                {r.active ? <Kbd>↵</Kbd> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div
        style={{
          position: "absolute",
          left: 960 - (520 * SCALE) / 2,
          top: 300,
          width: 520,
          scale: String(SCALE * (0.94 + invoiceIn * 0.06)),
          transformOrigin: "50% 0",
          opacity: invoiceIn,
          translate: `0 ${(1 - invoiceIn) * 40}px`,
        }}
      >
        <Panel width={520} style={{ padding: 24, boxShadow: shadow.float }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, fontFamily: font.mono, color: color.ink500 }}>INV-1042</div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: radius.pill,
                background: color.success100,
                color: color.success600,
              }}
            >
              Ready to send
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: color.ink500 }}>Billed to</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: color.ink900, letterSpacing: "-0.01em" }}>Acme Studio</div>
          <div style={{ marginTop: 16, height: 1, background: color.line2 }} />
          {[
            ["Brand system, round 2", "8.0h"],
            ["Landing page review", "4.5h"],
          ].map(([l, h]) => (
            <div key={l} style={{ display: "flex", fontSize: 14, color: color.ink700, marginTop: 12 }}>
              <span style={{ flex: 1 }}>{l}</span>
              <span style={{ fontFamily: font.mono, color: color.ink500 }}>{h}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, height: 1, background: color.line2 }} />
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 16 }}>
            <span style={{ flex: 1, fontSize: 13, color: color.ink500 }}>Total · 12.5h × $150</span>
            <span style={{ fontFamily: font.mono, fontSize: 28, color: color.ink900 }}>
              ${amount.toLocaleString("en-US")}.00
            </span>
          </div>
        </Panel>
      </div>
      <Sfx at={84} sound="mouse-click" volume={0.5} />
    </AbsoluteFill>
  );
};
