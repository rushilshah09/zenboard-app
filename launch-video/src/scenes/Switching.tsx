import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Sfx } from "../components/Sfx";
import { ToolKind, TOOL_META, ToolWindow } from "../components/ToolWindow";
import { color, ease, font, light, radius, rand, shake, shadow, tween } from "../theme";

/** 05 · Copy. Paste. Switch… again, and again — until it all collapses. */

const KeyCap: React.FC<{ label: string; at: number; frame: number; wide?: boolean }> = ({ label, at, frame, wide }) => {
  const slam = tween(frame, [at, at + 6], [0, 1], ease.out);
  return (
    <div
      style={{
        width: wide ? 200 : 140,
        height: 140,
        borderRadius: radius.xl * 1.5,
        background: light.surface,
        border: `1px solid ${light.faint}`,
        boxShadow: `0 ${10 - slam * 6}px 0 rgba(18,18,18,0.14), ${shadow.float}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font.sans,
        fontSize: 64,
        fontWeight: 500,
        color: light.text,
        opacity: tween(frame, [at, at + 2], [0, 1]),
        scale: String(1.5 - slam * 0.5),
        translate: `0 ${slam * 6}px`,
      }}
    >
      {label}
    </div>
  );
};

const APPS: ToolKind[] = ["tasks", "notes", "invoice", "calendar", "clients", "email", "sheet", "timer"];
const GLYPH: Record<ToolKind, string> = {
  tasks: "✓",
  notes: "¶",
  invoice: "$",
  calendar: "▦",
  clients: "@",
  email: "✉",
  sheet: "#",
  timer: "◷",
  sticky: "!",
};

// Each switch comes a little sooner than the last.
const SWITCHES: number[] = (() => {
  const out: number[] = [];
  let t = 104;
  let gap = 14;
  while (t < 222) {
    out.push(Math.round(t));
    t += gap;
    gap = Math.max(2, gap * 0.86);
  }
  return out;
})();

// "again" words for the z-depth tunnel, spawning faster and faster.
const TUNNEL_LIFE = 34;
const TUNNEL: { at: number; angle: number; pink: boolean }[] = (() => {
  const out: { at: number; angle: number; pink: boolean }[] = [];
  let t = 148;
  let gap = 7;
  let i = 0;
  while (t < 222) {
    out.push({ at: Math.round(t), angle: rand(i * 13 + 5) * Math.PI * 2, pink: i % 5 === 2 });
    t += gap;
    gap = Math.max(1.2, gap * 0.9);
    i++;
  }
  return out;
})();

export const Switching: React.FC = () => {
  const frame = useCurrentFrame();
  const phase = frame < 48 ? "copy" : frame < 92 ? "paste" : "switch";
  const collapse = tween(frame, [222, 238], [0, 1], ease.in);
  const switchIndex = SWITCHES.filter((s) => s <= frame).length;
  const selectW = tween(frame, [4, 20], [0, 1], ease.inOut);
  const pasted = frame >= 62;

  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale: String(1 - collapse * 0.96),
          opacity: 1 - collapse,
          translate: shake(frame, 200, 10, 20),
        }}
      >
        {phase === "copy" ? (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ scale: "1.7", translate: "0 -40px" }}>
              <ToolWindow kind="notes" width={520} />
              <div style={{ position: "absolute", left: 18, top: 176, fontFamily: font.sans, fontSize: 17, color: light.text }}>
                <span style={{ background: `linear-gradient(90deg, rgba(94,146,190,0.35) ${selectW * 100}%, transparent ${selectW * 100}%)` }}>
                  Scope: brand system, round 2 — 12.5h
                </span>
              </div>
            </div>
          </AbsoluteFill>
        ) : null}
        {phase === "paste" ? (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ scale: "1.7", translate: "0 -40px" }}>
              <ToolWindow kind="invoice" width={520} />
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  bottom: -40,
                  fontFamily: font.sans,
                  fontSize: 17,
                  color: light.text,
                  padding: "6px 10px",
                  borderRadius: radius.sm,
                  background: light.surface,
                  boxShadow: shadow.float,
                  opacity: pasted ? 1 : 0,
                  scale: String(pasted ? 1 : 0.9),
                }}
              >
                Scope: brand system, round 2 — 12.5h
              </div>
            </div>
          </AbsoluteFill>
        ) : null}
        {phase === "switch" ? (
          <>
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
              <div style={{ scale: "1.9", opacity: 0.9 }}>
                <ToolWindow kind={APPS[switchIndex % APPS.length]} width={480} />
              </div>
            </AbsoluteFill>
            {TUNNEL.filter((w) => frame >= w.at && frame < w.at + TUNNEL_LIFE).map((w) => {
              // Words rush out of the screen centre towards the camera.
              const p = (frame - w.at) / TUNNEL_LIFE;
              const depth = p * p;
              return (
                <div
                  key={w.at}
                  style={{
                    position: "absolute",
                    left: 960 + Math.cos(w.angle) * (40 + depth * 1150),
                    top: 540 + Math.sin(w.angle) * (30 + depth * 700),
                    translate: "-50% -50%",
                    scale: String(0.15 + depth * 3.2),
                    fontFamily: font.sans,
                    fontWeight: 600,
                    fontSize: 72,
                    letterSpacing: "-0.03em",
                    color: w.pink ? color.berry500 : light.text,
                    opacity: Math.min(1, p * 4) * (1 - Math.max(0, (p - 0.75) * 4)),
                    filter: `blur(${Math.max(0, (p - 0.55) * 18)}px)`,
                    zIndex: 30,
                  }}
                >
                  again
                </div>
              );
            })}
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", zIndex: 20 }}>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  padding: 20,
                  borderRadius: radius.xl * 2,
                  background: "rgba(18,18,18,0.72)",
                  backdropFilter: "blur(20px)",
                  opacity: tween(frame, [98, 104], [0, 1]),
                  scale: String(tween(frame, [98, 108], [0.9, 1], ease.spring)),
                }}
              >
                {APPS.map((k, i) => {
                  const on = switchIndex % APPS.length === i;
                  return (
                    <div
                      key={k}
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: radius.xl * 1.4,
                        background: on ? "rgba(242,241,235,0.22)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: radius.xl * 1.2,
                          background: TOOL_META[k].tint,
                          color: light.surface,
                          fontFamily: font.sans,
                          fontSize: 42,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {GLYPH[k]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AbsoluteFill>
          </>
        ) : null}

        <div style={{ position: "absolute", bottom: 90, width: "100%", display: "flex", justifyContent: "center", gap: 24, zIndex: 40 }}>
          {phase === "copy" ? (
            <>
              <KeyCap label="⌘" at={20} frame={frame} />
              <KeyCap label="C" at={25} frame={frame} />
            </>
          ) : phase === "paste" ? (
            <>
              <KeyCap label="⌘" at={54} frame={frame} />
              <KeyCap label="V" at={59} frame={frame} />
            </>
          ) : (
            <>
              <KeyCap label="⌘" at={94} frame={frame} />
              <KeyCap label="⇥" at={99} frame={frame} wide />
            </>
          )}
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", top: 70, width: "100%", zIndex: 60, opacity: 1 - collapse }}>
        {phase === "copy" ? <Headline text="So you *copy.*" at={2} size={100} tint={light.text} /> : null}
        {phase === "paste" ? <Headline text="You *paste.*" at={48} size={100} tint={light.text} /> : null}
        {phase === "switch" ? (
          <Headline text={frame < 150 ? "You *switch.*" : "Again. And again. And *again.*"} at={frame < 150 ? 92 : 150} size={100} tint={light.text} stagger={frame < 150 ? 3 : 10} />
        ) : null}
      </div>

      <Sfx at={20} sound="thud" volume={0.45} />
      <Sfx at={25} sound="thud" volume={0.5} />
      <Sfx at={54} sound="thud" volume={0.45} />
      <Sfx at={59} sound="thud" volume={0.5} />
      <Sfx at={62} sound="pop" volume={0.3} />
      <Sfx at={94} sound="thud" volume={0.45} />
      <Sfx at={99} sound="thud" volume={0.5} />
      {SWITCHES.map((s, i) => (
        <Sfx key={s} at={s} sound="tick" volume={0.25 + Math.min(0.35, i * 0.012)} />
      ))}
      <Sfx at={196} sound="glitch" volume={0.35} />
      <Sfx at={218} sound="whoosh" volume={0.45} />
    </AbsoluteFill>
  );
};
