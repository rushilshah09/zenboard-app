import React from "react";
import { interpolateColors } from "remotion";
import { clamp } from "../brand/motion";
import { Surface, surface } from "../brand/surface";
import { FONT } from "../brand/fonts";
import { Category, radius, space, tint, type } from "../brand/tokens";
import { Glyph } from "./Glyph";

/**
 * The generic, monochrome app window of acts 2–3: burgundy line on Card and
 * Soft Sand only, one category glyph and a Stone label. Never Zenboard.
 */

const Bar: React.FC<{ w: string; h?: number; s: Surface }> = ({ w, h = 12, s }) => (
  <div style={{ width: w, height: h, borderRadius: radius.pill, background: s.hair }} />
);

const Skeleton: React.FC<{ category: Category; s: Surface }> = ({ category, s }) => {
  const rows = (n: number, lead?: "box" | "dot") =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: space.s2 }}>
        {lead === "box" ? <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${s.hair}` }} /> : null}
        {lead === "dot" ? <div style={{ width: 28, height: 28, borderRadius: radius.pill, background: s.hair }} /> : null}
        <Bar s={s} w={`${[78, 62, 70, 54, 66][i % 5]}%`} />
      </div>
    ));
  switch (category) {
    case "tasks":
      return <>{rows(4, "box")}</>;
    case "clients":
      return <>{rows(3, "dot")}</>;
    case "life":
      return <>{rows(3, "dot")}</>;
    case "projects":
      return (
        <div style={{ display: "flex", gap: space.s2, flex: 1 }}>
          {[3, 2, 1].map((n, c) => (
            <div key={c} style={{ flex: 1, display: "flex", flexDirection: "column", gap: space.s1 }}>
              {Array.from({ length: n }, (_, i) => (
                <div key={i} style={{ height: 44, borderRadius: radius.inner, background: s.hair, opacity: 0.7 }} />
              ))}
            </div>
          ))}
        </div>
      );
    case "calendar":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, flex: 1 }}>
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} style={{ borderRadius: 6, minHeight: 28, background: [1, 7, 8, 13].includes(i) ? s.hair : s.fill }} />
          ))}
        </div>
      );
    case "money":
      return (
        <>
          {[70, 55, 62].map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: space.s2 }}>
              <Bar s={s} w={`${w}%`} />
              <Bar s={s} w="14%" />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Bar s={s} w="30%" h={20} />
          </div>
        </>
      );
    default:
      return (
        <>
          <Bar s={s} w="46%" h={18} />
          {rows(4)}
        </>
      );
  }
};

export const AppWindow: React.FC<{
  category: Category;
  label: string;
  width: number;
  height: number;
  /** The Acme line, retyped in this app (S06): its highlight sweep 0 → 1. */
  acme?: number;
  counter?: string;
  /** The counter jumps on each tick with a spring overshoot (1 → 0). */
  counterKick?: number;
  /** Content filling in once the card has landed (0 → 1): header first, then the body. */
  fill?: number;
  /** Look: 0 white card on the aurora, 1 glass on the void. */
  dark?: number;
  /** Outline drawing on around the window (ElevenLabs), 0 → 1; the glass fills in behind it. */
  draw?: number;
  style?: React.CSSProperties;
}> = ({ category, label, width, height, acme, counter, counterKick = 0, fill = 1, dark = 0, draw = 1, style }) => {
  const s = surface(dark);
  const body = clamp(draw, [0.55, 1], [0, 1]);
  const perimeter = 2 * (width + height);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius.window,
        fontFamily: FONT,
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius.window,
          background: s.bg,
          boxShadow: s.shadow,
          backdropFilter: s.backdrop,
          overflow: "hidden",
          opacity: body,
        }}
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: space.s2,
              padding: `${space.s3}px ${space.s3}px ${space.s2}px`,
              opacity: Math.min(1, fill * 2),
              translate: `0 ${(1 - Math.min(1, fill * 2)) * 8}px`,
            }}
          >
            <Glyph category={category} size={36} dark={dark} />
            <div style={{ ...type.uiStrong, color: s.muted, whiteSpace: "nowrap" }}>{label}</div>
            <div style={{ flex: 1 }} />
            {counter ? (
              <div
                style={{
                  ...type.caption,
                  color: interpolateColors(Math.min(1, Math.abs(counterKick)), [0, 1], [s.muted, s.text]),
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  scale: String(1 + counterKick * 0.3),
                  transformOrigin: "100% 50%",
                }}
              >
                {counter}
              </div>
            ) : null}
          </div>
          <div style={{ height: 1, background: s.hair, margin: `0 ${space.s3}px` }} />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: space.s2,
              padding: space.s3,
              opacity: Math.max(0, fill * 2 - 1),
              translate: `0 ${(1 - Math.max(0, fill * 2 - 1)) * 12}px`,
            }}
          >
            {acme !== undefined ? (
              <div style={{ position: "relative", alignSelf: "flex-start", ...type.uiStrong, color: s.text, padding: "2px 8px", margin: "0 -8px" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 6,
                    background: dark > 0.5 ? "rgba(230, 53, 138, 0.35)" : tint.ink10,
                    transformOrigin: "0 50%",
                    scale: `${acme} 1`,
                  }}
                />
                <span style={{ position: "relative" }}>Acme Studio: rebrand, phase two</span>
              </div>
            ) : null}
            <Skeleton category={category} s={s} />
          </div>
        </div>
      </div>
      {/* The glowing outline: draws around the window, then rests as a light hairline. */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        <rect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 1}
          rx={radius.window}
          fill="none"
          stroke={dark > 0.3 ? "rgba(190, 170, 255, 0.9)" : "rgba(255, 255, 255, 0)"}
          strokeWidth={1.5}
          strokeDasharray={perimeter}
          strokeDashoffset={perimeter * (1 - clamp(draw, [0, 0.7], [0, 1]))}
          style={{ opacity: dark * (1 - 0.7 * clamp(draw, [0.7, 1], [0, 1])), filter: "drop-shadow(0 0 6px rgba(150, 120, 255, 0.9))" }}
        />
      </svg>
    </div>
  );
};
