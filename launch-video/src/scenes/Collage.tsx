import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Mark } from "../components/primitives";
import { Sfx } from "../components/Sfx";
import { color, ease, font, radius, tween } from "../theme";

/** Scene 6 — everything Zenboard holds, collaged under one line of type. */

type CardProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  at: number;
  depth: number;
  children: React.ReactNode;
};

const Card: React.FC<CardProps & { frame: number }> = ({ x, y, w, h, bg, at, depth, frame, children }) => {
  const inT = tween(frame, [at, at + 18], [0, 1], ease.spring);
  const drift = frame * depth * 0.35;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: bg,
        borderRadius: radius.lg,
        overflow: "hidden",
        opacity: tween(frame, [at, at + 6], [0, 1]),
        scale: String(0.7 + inT * 0.3),
        translate: `${-drift}px ${(1 - inT) * 60}px`,
        fontFamily: font.sans,
      }}
    >
      {children}
    </div>
  );
};

const WeekCard = () => (
  <div style={{ padding: 20, height: "100%", position: "relative" }}>
    <div style={{ fontSize: 16, fontWeight: 600, color: color.paper }}>Week 39</div>
    {[0, 1, 2, 3, 4].map((c) => (
      <div key={c} style={{ position: "absolute", top: 56, bottom: 20, left: 20 + c * 54, width: 1, background: "rgba(18,18,18,0.18)" }} />
    ))}
    {[
      [0, 90, 70],
      [1, 150, 110],
      [2, 70, 50],
      [3, 200, 90],
      [4, 110, 130],
      [1, 290, 60],
    ].map(([c, t, h], i) => (
      <div
        key={i}
        style={{ position: "absolute", left: 24 + c * 54, top: t, width: 46, height: h, borderRadius: radius.sm, background: "rgba(18,18,18,0.82)" }}
      />
    ))}
  </div>
);

const DocCard = () => (
  <div style={{ padding: 32, fontFamily: font.serif, color: color.paper }}>
    <div style={{ fontSize: 14, fontFamily: font.mono, opacity: 0.6 }}>DOC · PROPOSAL</div>
    <div style={{ fontSize: 40, fontWeight: 600, marginTop: 16, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
      Acme rebrand,
      <br />
      phase two
    </div>
    <div style={{ fontSize: 19, lineHeight: 1.5, marginTop: 20, opacity: 0.78 }}>
      Scope, milestones and fees for the second round. Accepting this proposal seeds the project.
    </div>
  </div>
);

const RingsCard = () => (
  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width={220} height={220} viewBox="0 0 220 220">
      {[90, 66, 42].map((r, i) => (
        <circle
          key={r}
          cx={110}
          cy={110}
          r={r}
          fill="none"
          stroke={color.paper}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * r * [0.78, 0.6, 0.92][i]} 999`}
          transform="rotate(-90 110 110)"
          opacity={0.85 - i * 0.15}
        />
      ))}
    </svg>
  </div>
);

const TimerCard = () => (
  <div style={{ padding: 24, color: color.paper }}>
    <div style={{ fontSize: 14, fontFamily: font.mono, opacity: 0.7 }}>FOCUS</div>
    <div style={{ fontFamily: font.mono, fontSize: 88, letterSpacing: "-0.04em", marginTop: 16 }}>25:00</div>
    <div style={{ fontSize: 16, opacity: 0.7 }}>Brand system, round 2</div>
  </div>
);

const InvoiceCard = () => (
  <div style={{ padding: 24, color: color.ink800 }}>
    <div style={{ fontSize: 14, fontFamily: font.mono, color: color.ink500 }}>INV-1042</div>
    <div style={{ fontFamily: font.mono, fontSize: 52, color: color.ink900, marginTop: 20 }}>$1,875</div>
    <div
      style={{
        display: "inline-block",
        marginTop: 16,
        fontSize: 15,
        padding: "4px 12px",
        borderRadius: radius.pill,
        background: color.success100,
        color: color.success600,
      }}
    >
      Paid
    </div>
    {[0.9, 0.7, 0.8].map((w, i) => (
      <div key={i} style={{ marginTop: 16, height: 8, width: `${w * 100}%`, borderRadius: radius.pill, background: color.wash }} />
    ))}
  </div>
);

const PortalCard = () => (
  <div style={{ padding: 28, color: color.ink800 }}>
    <div style={{ fontSize: 14, fontFamily: font.mono, color: color.ink500 }}>CLIENT PORTAL</div>
    <div style={{ fontSize: 28, fontWeight: 600, color: color.ink900, marginTop: 12, letterSpacing: "-0.02em" }}>Acme Studio</div>
    {[
      ["Discovery", 1],
      ["Design", 0.64],
      ["Build", 0.2],
    ].map(([l, p]) => (
      <div key={l as string} style={{ marginTop: 20 }}>
        <div style={{ fontSize: 15, color: color.ink600 }}>{l}</div>
        <div style={{ marginTop: 8, height: 6, borderRadius: radius.pill, background: color.wash }}>
          <div style={{ height: 6, width: `${(p as number) * 100}%`, borderRadius: radius.pill, background: color.ink900 }} />
        </div>
      </div>
    ))}
  </div>
);

const MarkCard = () => (
  <div style={{ padding: 20, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
    <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ink900, lineHeight: 1.4 }}>
      ZB / 01
      <br />
      CALM MODE
    </div>
    <Mark size={96} fill={color.ink900} style={{ alignSelf: "flex-end" }} />
  </div>
);

const WORDS = ["Work,", "made", "calm."];

export const Collage: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = tween(frame, [0, 150], [1, 1.06], (x) => x);
  return (
    <AbsoluteFill style={{ background: color.ink700, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(zoom) }}>
        <Card frame={frame} x={170} y={180} w={300} h={400} bg={color.info600} at={0} depth={0.6}>
          <WeekCard />
        </Card>
        <Card frame={frame} x={560} y={80} w={440} h={460} bg={color.berry200} at={6} depth={0.3}>
          <DocCard />
        </Card>
        <Card frame={frame} x={1080} y={250} w={320} h={380} bg={color.paper} at={12} depth={0.8}>
          <InvoiceCard />
        </Card>
        <Card frame={frame} x={1460} y={130} w={300} h={300} bg={color.labelOchre} at={16} depth={0.4}>
          <RingsCard />
        </Card>
        <Card frame={frame} x={110} y={640} w={380} h={260} bg={color.labelMoss} at={20} depth={0.5}>
          <TimerCard />
        </Card>
        <Card frame={frame} x={1320} y={560} w={460} h={360} bg={color.paper4} at={24} depth={0.7}>
          <PortalCard />
        </Card>
        <Card frame={frame} x={780} y={640} w={260} h={260} bg={color.berry500} at={28} depth={0.9}>
          <MarkCard />
        </Card>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 48 }}>
        {WORDS.map((w, i) => {
          const t = tween(frame, [34 + i * 9, 50 + i * 9], [0, 1]);
          return (
            <div
              key={w}
              style={{
                fontFamily: font.sans,
                fontWeight: 700,
                fontSize: 230,
                letterSpacing: "-0.05em",
                color: "#FFFFFF",
                opacity: t,
                translate: `0 ${(1 - t) * 50}px`,
                filter: `blur(${(1 - t) * 10}px)`,
                textShadow: "0 4px 40px rgba(0,0,0,0.12)",
              }}
            >
              {w}
            </div>
          );
        })}
      </AbsoluteFill>
      <Sfx at={0} sound="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};
