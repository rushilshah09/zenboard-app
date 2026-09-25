import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Sfx } from "../components/Sfx";
import { ToolWindow } from "../components/ToolWindow";
import { color, ease, font, tween } from "../theme";

/** 04 · None of it talks to each other: connections draw, then snap. */

const NODES = {
  calendar: { x: 360, y: 470 },
  projects: { x: 960, y: 330 },
  clients: { x: 1560, y: 470 },
};

const Link: React.FC<{
  a: { x: number; y: number };
  b: { x: number; y: number };
  drawAt: number;
  breakAt: number;
  frame: number;
}> = ({ a, b, drawAt, breakAt, frame }) => {
  const draw = tween(frame, [drawAt, drawAt + 24], [0, 1]);
  const brk = tween(frame, [breakAt, breakAt + 14], [0, 1], ease.out);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = (b.x - a.x) / 2;
  const dy = (b.y - a.y) / 2;
  const gap = brk * 0.22;
  const sag = brk * 60;
  const q = tween(frame, [breakAt + 4, breakAt + 16], [0, 1], ease.spring);
  const flash = tween(frame, [breakAt, breakAt + 2], [0, 1]) * (1 - tween(frame, [breakAt + 2, breakAt + 10], [0, 1]));
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M${a.x} ${a.y} Q${a.x + dx * 0.6} ${a.y + dy * 0.6 + sag} ${mx - dx * gap} ${my - dy * gap + sag}`}
          stroke={brk > 0 ? color.ink400 : color.ink900}
          strokeWidth={3}
          fill="none"
          pathLength={1}
          style={{ strokeDasharray: `${draw} 1` }}
        />
        <path
          d={`M${b.x} ${b.y} Q${b.x - dx * 0.6} ${b.y - dy * 0.6 + sag} ${mx + dx * gap} ${my + dy * gap + sag}`}
          stroke={brk > 0 ? color.ink400 : color.ink900}
          strokeWidth={3}
          fill="none"
          pathLength={1}
          style={{ strokeDasharray: `${draw} 1` }}
        />
        <circle cx={mx} cy={my} r={10 + flash * 60} fill={color.danger500} opacity={flash * 0.6} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: mx,
          top: my + 30,
          translate: "-50% -50%",
          scale: String(q),
          width: 64,
          height: 64,
          borderRadius: 999,
          border: `2px solid ${color.danger500}`,
          color: color.danger500,
          fontFamily: font.sans,
          fontSize: 38,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.canvas,
        }}
      >
        ?
      </div>
    </>
  );
};

export const Disconnected: React.FC = () => {
  const frame = useCurrentFrame();
  const inT = (i: number) => tween(frame, [4 + i * 6, 20 + i * 6], [0, 1], ease.spring);
  const win = (i: number, left: number, top: number, node: React.ReactNode) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        translate: "-50% -50%",
        scale: String((0.8 + inT(i) * 0.2) * 1.3),
        opacity: inT(i),
        zIndex: 5,
      }}
    >
      {node}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: color.canvas, overflow: "hidden" }}>
      <Link a={NODES.calendar} b={NODES.projects} drawAt={30} breakAt={112} frame={frame} />
      <Link a={NODES.projects} b={NODES.clients} drawAt={42} breakAt={176} frame={frame} />
      {win(0, NODES.calendar.x, NODES.calendar.y, <ToolWindow kind="calendar" />)}
      {win(1, NODES.projects.x, NODES.projects.y, <ToolWindow kind="tasks" title="Projects" />)}
      {win(2, NODES.clients.x, NODES.clients.y, <ToolWindow kind="clients" />)}
      <div style={{ position: "absolute", top: 760, width: "100%" }}>
        <Headline text="None of it *talks* to each other." at={8} size={84} tint={color.ink900} out={100} />
      </div>
      <div style={{ position: "absolute", top: 780, width: "100%" }}>
        <Headline text="Your calendar doesn't know your *projects.*" at={108} size={60} tint={color.ink900} accent={color.berry300} out={164} />
      </div>
      <div style={{ position: "absolute", top: 780, width: "100%" }}>
        <Headline text="Your projects don't know your *clients.*" at={172} size={60} tint={color.ink900} accent={color.berry300} />
      </div>
      <Sfx at={30} sound="swipe" volume={0.25} />
      <Sfx at={112} sound="snap" volume={0.5} />
      <Sfx at={176} sound="snap" volume={0.5} />
    </AbsoluteFill>
  );
};
