import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Caret } from "../components/primitives";
import { Sfx } from "../components/Sfx";
import { color, ease, font, light, tween } from "../theme";

/** Scene 2 — a wall of "switch", until one word changes to "focus". */

const ROWS = 9;
const COLS = 7;
const CELL_W = 300;
const CELL_H = 118;
const WORD = "switch";
const NEXT = "focus";

const Corner: React.FC<{ pos: "tl" | "tr" | "bl" | "br"; t: number }> = ({ pos, t }) => {
  const size = 26;
  const top = pos[0] === "t";
  const left = pos[1] === "l";
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        [top ? "top" : "bottom"]: -8 - (1 - t) * 30,
        [left ? "left" : "right"]: -16 - (1 - t) * 30,
        borderColor: color.berry500,
        borderStyle: "solid",
        borderWidth: 0,
        [top ? "borderTopWidth" : "borderBottomWidth"]: 5,
        [left ? "borderLeftWidth" : "borderRightWidth"]: 5,
        opacity: t,
      }}
    />
  );
};

export const WordWall: React.FC = () => {
  const frame = useCurrentFrame();

  const deleted = Math.floor(tween(frame, [34, 44], [0, WORD.length], (x) => x));
  const typedCount = Math.floor(tween(frame, [46, 56], [0, NEXT.length], (x) => x));
  const centerText = frame < 45 ? WORD.slice(0, WORD.length - deleted) : NEXT.slice(0, typedCount);
  const bracket = tween(frame, [18, 30], [0, 1], ease.spring);
  const settle = tween(frame, [62, 90], [0, 1]);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = 960 + (c - (COLS - 1) / 2) * CELL_W + (r % 2 ? CELL_W / 2 : 0);
      const y = 540 + (r - (ROWS - 1) / 2) * CELL_H;
      const isCenter = r === (ROWS - 1) / 2 && c === (COLS - 1) / 2;
      if (isCenter) continue;
      const dist = Math.hypot(x - 960, y - 540) / 960;
      const inT = tween(frame, [dist * 14, dist * 14 + 12], [0, 1]);
      const outT = tween(frame, [60 + (1 - dist) * 14, 72 + (1 - dist) * 14], [0, 1], ease.in);
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: x - CELL_W / 2,
            top: y - CELL_H / 2,
            width: CELL_W,
            height: CELL_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.sans,
            fontSize: 72,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            color: light.text,
            opacity: inT * (1 - outT) * (0.1 + 0.08 * (1 - dist)),
            filter: `blur(${outT * 6}px)`,
          }}
        >
          {WORD}
        </div>,
      );
    }
  }

  return (
    <AbsoluteFill style={{ background: light.bg }}>
      {cells}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            fontFamily: font.sans,
            fontSize: 72 + settle * 88,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            color: light.text,
            minWidth: 60,
            textAlign: "center",
          }}
        >
          <Corner pos="tl" t={bracket * (1 - settle)} />
          <Corner pos="tr" t={bracket * (1 - settle)} />
          <Corner pos="bl" t={bracket * (1 - settle)} />
          <Corner pos="br" t={bracket * (1 - settle)} />
          {centerText}
          {frame > 30 && frame < 62 ? <Caret height={64} tint={color.berry500} /> : null}
          {frame >= 56 ? <span style={{ color: color.berry500 }}>.</span> : null}
        </div>
      </AbsoluteFill>
      <Sfx at={45} sound="switch" volume={0.35} />
    </AbsoluteFill>
  );
};
