import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { LogoLockup } from "../components/Logo";
import { Sfx } from "../components/Sfx";
import { ToolKind, ToolWindow } from "../components/ToolWindow";
import { color, ease, rand, shake, tween } from "../theme";

/**
 * 08 · Every scattered tool is pulled into one point — and Zenboard opens
 * out of it. "Meet Zenboard. One calm workspace for your work, your
 * business, and your life."
 */

const MERGE = 58;
const KINDS: ToolKind[] = ["tasks", "notes", "invoice", "calendar", "clients", "email", "sheet", "timer", "sticky", "tasks"];

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = tween(frame, [MERGE, MERGE + 3], [0, 1]) * (1 - tween(frame, [MERGE + 3, MERGE + 22], [0, 1]));
  const glow = tween(frame, [MERGE, MERGE + 40], [0, 1]);
  const lift = tween(frame, [140, 170], [0, 1], ease.inOut);
  const seed = tween(frame, [0, 10], [1, 0]);
  return (
    <AbsoluteFill style={{ background: color.canvas, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(196,28,114,${0.28 * glow}) 0%, rgba(196,28,114,${0.08 * glow}) 30%, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 951,
          top: 531,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: color.berry500,
          opacity: frame < MERGE ? 1 : 0,
          scale: String(1 + seed + Math.sin(frame / 3) * 0.15),
          boxShadow: `0 0 60px ${color.berry500}`,
        }}
      />

      {KINDS.map((k, i) => {
        const a = (i / KINDS.length) * Math.PI * 2 + rand(i) * 0.4;
        const start = 6 + rand(i + 20) * 14;
        const p = tween(frame, [start, MERGE], [0, 1], ease.in);
        return [0.12, 0.06, 0].map((lag, g) => {
          const pg = Math.max(0, p - lag);
          const dg = 1400 * (1 - pg);
          return (
            <div
              key={`${i}-${g}`}
              style={{
                position: "absolute",
                left: 960 + Math.cos(a) * dg,
                top: 540 + Math.sin(a) * dg * 0.7,
                translate: "-50% -50%",
                scale: String(Math.max(0.02, 1 - pg * 0.98)),
                rotate: `${(1 - pg) * (rand(i + 4) - 0.5) * 60}deg`,
                opacity: (frame >= start && frame < MERGE ? 1 : 0) * (g === 2 ? 1 : 0.18),
              }}
            >
              <ToolWindow kind={k} width={320} />
            </div>
          );
        });
      })}

      {[0, 1, 2].map((r) => {
        const t = tween(frame, [MERGE + r * 6, MERGE + r * 6 + 50], [0, 1], ease.out);
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 960,
              top: 540,
              width: 1400 * t,
              height: 1400 * t,
              translate: "-50% -50%",
              borderRadius: 9999,
              border: `2px solid ${color.berry500}`,
              opacity: (1 - t) * 0.6,
            }}
          />
        );
      })}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", translate: shake(frame, MERGE, 16, 16) }}>
        <div style={{ translate: `0 ${-lift * 90}px`, opacity: frame >= MERGE ? 1 : 0 }}>
          <LogoLockup frame={frame - MERGE} size={170} />
        </div>
        <div style={{ position: "absolute", top: 610, width: 1840 }}>
          <Headline
            text="One calm workspace for your *work,* your *business,* and your *life.*"
            at={150}
            size={54}
            tint={color.ink700}
            accent={color.berry300}
            weight={500}
            stagger={4}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ background: color.ink900, opacity: flash * 0.85, pointerEvents: "none" }} />

      <Sfx at={4} sound="whoosh" volume={0.45} />
      <Sfx at={MERGE - 2} sound="impact" volume={0.9} />
      <Sfx at={MERGE + 4} sound="shimmer" volume={0.4} />
      <Sfx at={150} sound="swipe" volume={0.2} />
    </AbsoluteFill>
  );
};
