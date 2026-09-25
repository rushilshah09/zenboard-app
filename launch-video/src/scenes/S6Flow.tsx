import React from "react";
import { FONT, MONO } from "../brand/fonts";
import { colour, energy, panelEdge, shadow, type } from "../brand/tokens";
import { Glyph, Icon } from "../components/Glyph";
import { Cursor } from "../components/Cursor";
import { JOB, money } from "../data/acme";
import { Stage } from "../ui/Stage";

/**
 * Scene 6 · The Flow (0:48–0:54). Signature: locked macro shots on the beat,
 * match-cut on shape, the word rising out of the element being used.
 * Styleframe: "Bill." A time entry has become an invoice line; the cursor,
 * enormous, presses Send. 100mm feel: only the button is sharp.
 */
export const Invoice: React.FC = () => (
  <div style={{ width: 760, borderRadius: 18, background: colour.card, boxShadow: `${panelEdge}, ${shadow}`, fontFamily: FONT, color: colour.ink, padding: 28 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Glyph category="money" size={40} colourProgress={1} />
      <div style={{ ...type.uiStrong, fontSize: 22, flex: 1 }}>{JOB.invoice.id}</div>
      <span style={{ fontFamily: MONO, fontSize: 15, color: colour.stone }}>Acme Studio · due 9 Oct</span>
    </div>
    {JOB.hours.map((h, i) => (
      <div key={h.day} style={{ display: "flex", alignItems: "center", gap: 16, height: 48, borderBottom: `1px solid ${colour.hairline}`, marginTop: i ? 0 : 18 }}>
        <span style={{ fontFamily: MONO, fontSize: 15, color: colour.stone, width: 70 }}>{h.day}</span>
        <span style={{ ...type.ui, fontSize: 18, flex: 1 }}>{h.what}</span>
        <span style={{ fontFamily: MONO, fontSize: 16 }}>{h.h.toFixed(1)}h</span>
      </div>
    ))}
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 48, borderBottom: `1px solid ${colour.hairline}`, background: "rgba(196,28,114,.06)", margin: "0 -12px", padding: "0 12px", borderRadius: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 15, color: colour.pink, width: 70 }}>Thu 25</span>
      <span style={{ ...type.ui, fontSize: 18, flex: 1 }}>Rebrand proposal</span>
      <span style={{ fontFamily: MONO, fontSize: 16 }}>2.0h</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 14, color: colour.stone }}>12.5h × $150</div>
        <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 500 }}>{money(JOB.invoice.amount)}</div>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 26px",
          borderRadius: 999,
          background: colour.ink,
          color: colour.paper,
          ...type.uiStrong,
          fontSize: 20,
          scale: "0.98",
          translate: "3px -2px",
        }}
      >
        Send <Icon name="arrow-right" size={20} tint={colour.paper} />
        {/* Release ripple: a soft pink ring spreading 12px. */}
        <div style={{ position: "absolute", inset: -8, borderRadius: 999, border: `2px solid ${energy.pink}`, opacity: 0.55 }} />
      </div>
    </div>
  </div>
);

export const S6Styleframe: React.FC = () => {
  const k = 2.35;
  // Send's centre in card space (measured from a 1× render), placed right of frame centre.
  const SEND = { x: 670, y: 332 };
  const at = { x: 1230, y: 690 };
  const pos = { left: at.x - SEND.x * k, top: at.y - SEND.y * k };
  return (
    <Stage kind="ivory">
      {/* Depth of field: a soft copy of the whole card, and a sharp copy masked to the button's plane. */}
      <div style={{ position: "absolute", ...pos, transform: `scale(${k})`, transformOrigin: "0 0", filter: "blur(3.5px)" }}>
        <Invoice />
      </div>
      <div
        style={{
          position: "absolute",
          ...pos,
          transform: `scale(${k})`,
          transformOrigin: "0 0",
          // The mask lives in card space, before the scale: the focus plane is the button.
          maskImage: `radial-gradient(ellipse 150px 64px at ${SEND.x}px ${SEND.y}px, black 55%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse 150px 64px at ${SEND.x}px ${SEND.y}px, black 55%, transparent 100%)`,
        }}
      >
        <Invoice />
      </div>
      <div style={{ position: "absolute", left: at.x + 30, top: at.y + 16, transform: "scale(3.2)", transformOrigin: "0 0" }}>
        <Cursor x={0} y={0} pressed={1} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 760, fontFamily: FONT, fontWeight: 600, fontSize: 250, letterSpacing: "-0.05em", color: colour.ink, lineHeight: 1 }}>Bill.</div>
    </Stage>
  );
};
