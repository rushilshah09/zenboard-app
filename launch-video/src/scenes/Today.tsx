import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Check, Cursor, Panel } from "../components/primitives";
import { Sfx } from "../components/Sfx";
import { color, ease, font, radius, tween } from "../theme";

/** Scene 4 — Today: a short, curated list you actually finish. */

const PANEL_W = 460;
const ROW_H = 48;
const SCALE = 1.85;

type Task = {
  title: string;
  tag: string;
  tint: string;
  meta: string;
  y: number;
  doneAt?: number;
};

const TASKS: Task[] = [
  { title: "Send Acme the revised proposal", tag: "Acme", tint: color.berry500, meta: "Due today", y: 108, doneAt: 46 },
  { title: "Draft onboarding doc for Lumen", tag: "Lumen", tint: color.info500, meta: "2h", y: 108 + ROW_H },
  { title: "Review September invoices", tag: "Money", tint: color.labelMoss, meta: "30m", y: 108 + ROW_H * 2, doneAt: 92 },
  { title: "Studio call with Mara", tag: "Call", tint: color.labelOchre, meta: "15:30", y: 284 },
  { title: "Walk, no phone", tag: "Habit", tint: color.labelStone, meta: "20m", y: 284 + ROW_H },
];

const SectionLabel: React.FC<{ y: number; children: React.ReactNode }> = ({ y, children }) => (
  <div
    style={{
      position: "absolute",
      left: 20,
      top: y,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: color.ink500,
    }}
  >
    {children}
  </div>
);

const TaskRow: React.FC<{ task: Task; frame: number; index: number }> = ({ task, frame, index }) => {
  const done = task.doneAt ? tween(frame, [task.doneAt, task.doneAt + 10], [0, 1]) : 0;
  const appear = tween(frame, [6 + index * 4, 20 + index * 4], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        top: task.y,
        height: ROW_H - 4,
        borderRadius: radius.md,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        opacity: appear,
        translate: `0 ${(1 - appear) * 10}px`,
      }}
    >
      <Check done={done} />
      <div
        style={{
          flex: 1,
          fontSize: 14,
          color: done > 0.5 ? color.ink500 : color.ink800,
          textDecoration: done > 0.5 ? "line-through" : "none",
          textDecorationColor: color.ink400,
          whiteSpace: "nowrap",
        }}
      >
        {task.title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: color.ink600,
          padding: "2px 8px",
          borderRadius: radius.pill,
          background: color.wash,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: radius.pill, background: task.tint }} />
        {task.tag}
      </div>
      <div style={{ width: 76, textAlign: "right", whiteSpace: "nowrap", fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>
        {task.meta}
      </div>
    </div>
  );
};

const cursorPath = (frame: number) => {
  // Waypoints in panel units: [frame, x, y]
  const pts: [number, number, number][] = [
    [18, 430, 440],
    [40, 30, TASKS[0].y + 22],
    [70, 30, TASKS[0].y + 22],
    [86, 30, TASKS[2].y + 22],
    [120, 30, TASKS[2].y + 22],
    [150, 380, 420],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [f0, x0, y0] = pts[i];
    const [f1, x1, y1] = pts[i + 1];
    if (frame <= f1) {
      const t = tween(frame, [f0, f1], [0, 1], ease.inOut);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last[1], y: last[2] };
};

export const Today: React.FC = () => {
  const frame = useCurrentFrame();
  const panelIn = tween(frame, [0, 22], [0, 1]);
  const headIn = tween(frame, [4, 20], [0, 1]);
  const subIn = tween(frame, [14, 30], [0, 1]);
  const cur = cursorPath(frame);
  const press =
    tween(frame, [42, 45], [0, 1]) * (1 - tween(frame, [46, 50], [0, 1])) +
    tween(frame, [88, 91], [0, 1]) * (1 - tween(frame, [92, 96], [0, 1]));
  const doneCount = (frame >= 50 ? 1 : 0) + (frame >= 96 ? 1 : 0);

  return (
    <AbsoluteFill style={{ background: color.canvas, fontFamily: font.sans }}>
      <div style={{ position: "absolute", left: 140, top: 390, width: 700 }}>
        <div
          style={{
            fontSize: 112,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: color.ink900,
            opacity: headIn,
            translate: `0 ${(1 - headIn) * 24}px`,
          }}
        >
          Plan the day.
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 44,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            color: color.ink500,
            opacity: subIn,
            translate: `0 ${(1 - subIn) * 16}px`,
          }}
        >
          Three things that matter. Nothing that shouts.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 880,
          top: 150,
          width: PANEL_W,
          scale: String(SCALE * (0.94 + panelIn * 0.06)),
          transformOrigin: "0 0",
          opacity: panelIn,
          translate: `${(1 - panelIn) * 60}px 0`,
        }}
      >
        <Panel width={PANEL_W} style={{ position: "relative", height: 430 }}>
          <div style={{ position: "absolute", left: 20, top: 20, right: 20, display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: color.ink900, letterSpacing: "-0.01em" }}>Today</div>
            <div style={{ fontSize: 13, color: color.ink500 }}>Thu, 25 Sep</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{doneCount}/5 done</div>
          </div>
          <div style={{ position: "absolute", left: 20, right: 20, top: 64, height: 1, background: color.line2 }} />
          <SectionLabel y={84}>Top 3</SectionLabel>
          <SectionLabel y={264}>Later</SectionLabel>
          {TASKS.map((t, i) => (
            <TaskRow key={t.title} task={t} frame={frame} index={i} />
          ))}
          <div
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              bottom: 16,
              fontSize: 12,
              color: color.ink500,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{5 - doneCount} left · next deadline Fri</span>
            <span style={{ fontFamily: font.mono }}>Shutdown at 18:00</span>
          </div>
          <Cursor x={cur.x - 3} y={cur.y - 3} pressed={press} size={22} />
        </Panel>
      </div>
      <Sfx at={43} sound="mouse-click" volume={0.6} />
      <Sfx at={89} sound="mouse-click" volume={0.6} />
    </AbsoluteFill>
  );
};
