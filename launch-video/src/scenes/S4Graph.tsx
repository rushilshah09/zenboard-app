import React from "react";
import { FONT } from "../brand/fonts";
import { energy, stage } from "../brand/tokens";
import { ClientCard, DocCard, EventCard, ProjectCard, TaskCard } from "../ui/GraphCards";
import { Stage } from "../ui/Stage";

/**
 * Scene 4 · The Graph (0:24–0:40). Signature: a live node graph growing from one
 * task. Styleframe: mid 4b. The task has become a project and landed on the
 * calendar; the newest line has just opened the doc ("opens a doc."), and the
 * next line is already growing toward the client.
 */
type Pt = { x: number; y: number };
const curve = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
};

const Edge: React.FC<{ a: Pt; b: Pt; p?: number; id: string }> = ({ a, b, p = 1, id }) => {
  const d = curve(a, b);
  const len = 1400;
  return (
    <>
      <path d={d} fill="none" stroke={`url(#g-${id})`} strokeWidth={10} opacity={0.35} style={{ filter: "blur(8px)" }} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      <path d={d} fill="none" stroke={`url(#g-${id})`} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      <defs>
        <linearGradient id={`g-${id}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
          <stop offset="0" stopColor={energy.pink} />
          <stop offset="0.6" stopColor={energy.rose} />
          <stop offset="1" stopColor={energy.apricot} />
        </linearGradient>
      </defs>
    </>
  );
};

const Statement: React.FC<{ x: number; y: number; dim?: boolean; children: React.ReactNode }> = ({ x, y, dim, children }) => (
  <div style={{ position: "absolute", left: x, top: y, fontFamily: FONT, fontWeight: 600, fontSize: 56, letterSpacing: "-0.04em", color: stage.inkText, opacity: dim ? 0.35 : 1, whiteSpace: "nowrap", lineHeight: 1 }}>{children}</div>
);

const Node: React.FC<{ x: number; y: number; children: React.ReactNode; focus?: boolean }> = ({ x, y, children, focus }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", filter: focus ? undefined : "blur(0.6px) brightness(.92)" }}>{children}</div>
);

export const S4Styleframe: React.FC = () => {
  const task = { x: 300, y: 610 };
  const project = { x: 800, y: 280 };
  const cal = { x: 980, y: 820 };
  const doc = { x: 1500, y: 470 };
  const client = { x: 2150, y: 200 };
  return (
    <Stage kind="ink">
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <Edge id="tp" a={{ x: task.x + 200, y: task.y }} b={{ x: project.x - 235, y: project.y }} />
        <Edge id="tc" a={{ x: task.x + 200, y: task.y }} b={{ x: cal.x - 190, y: cal.y }} />
        <Edge id="pd" a={{ x: project.x + 235, y: project.y }} b={{ x: doc.x - 220, y: doc.y }} />
        <Edge id="dc" a={{ x: doc.x + 220, y: doc.y }} b={client} p={0.28} />
        {/* A pulse travelling along the newest line. */}
        <circle cx={1795} cy={452} r={7} fill="#fff" style={{ filter: `drop-shadow(0 0 10px ${energy.pink}) drop-shadow(0 0 20px ${energy.pink})` }} />
      </svg>
      <Node x={task.x} y={task.y}>
        <TaskCard light="ink" />
      </Node>
      <Node x={project.x} y={project.y}>
        <ProjectCard light="ink" />
      </Node>
      <Node x={cal.x} y={cal.y}>
        <EventCard light="ink" />
      </Node>
      <Node x={doc.x} y={doc.y} focus>
        <DocCard light="ink" />
      </Node>
      <Statement x={task.x - 200} y={task.y - 150} dim>
        A task
      </Statement>
      <Statement x={project.x - 235} y={project.y - 205} dim>
        becomes a project
      </Statement>
      <Statement x={cal.x - 190} y={cal.y - 175} dim>
        lands on your calendar
      </Statement>
      <Statement x={doc.x - 220} y={doc.y - 220}>
        opens a doc.
      </Statement>
      {/* The client node, still to come: glimpsed off the top-right edge, out of focus. */}
      <div style={{ position: "absolute", left: 1840, top: 60, filter: "blur(10px)", opacity: 0.5 }}>
        <ClientCard light="ink" />
      </div>
    </Stage>
  );
};
