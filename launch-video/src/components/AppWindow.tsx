import React from "react";
import { interpolateColors } from "remotion";
import { FONT } from "../brand/fonts";
import { Category, colour, radius, shadow, space, tint, type } from "../brand/tokens";
import { Glyph } from "./Glyph";

/**
 * The generic, monochrome app window of acts 2–3: burgundy line on Card and
 * Soft Sand only, one category glyph and a Stone label. Never Zenboard.
 */

const Bar: React.FC<{ w: string; h?: number }> = ({ w, h = 12 }) => (
  <div style={{ width: w, height: h, borderRadius: radius.pill, background: colour.hairline }} />
);

const Skeleton: React.FC<{ category: Category }> = ({ category }) => {
  const rows = (n: number, lead?: "box" | "dot") =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: space.s2 }}>
        {lead === "box" ? <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${colour.hairline}` }} /> : null}
        {lead === "dot" ? <div style={{ width: 28, height: 28, borderRadius: radius.pill, background: colour.hairline }} /> : null}
        <Bar w={`${[78, 62, 70, 54, 66][i % 5]}%`} />
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
                <div key={i} style={{ height: 44, borderRadius: radius.inner, background: colour.hairline, opacity: 0.7 }} />
              ))}
            </div>
          ))}
        </div>
      );
    case "calendar":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, flex: 1 }}>
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} style={{ borderRadius: 6, minHeight: 28, background: [1, 7, 8, 13].includes(i) ? colour.hairline : tint.ink06 }} />
          ))}
        </div>
      );
    case "money":
      return (
        <>
          {[70, 55, 62].map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: space.s2 }}>
              <Bar w={`${w}%`} />
              <Bar w="14%" />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Bar w="30%" h={20} />
          </div>
        </>
      );
    default:
      return (
        <>
          <Bar w="46%" h={18} />
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
  /** The counter jumps a size on each tick and settles back (1 → 0). */
  counterKick?: number;
  /** Content filling in once the blank card has landed (0 → 1): header first, then the body. */
  fill?: number;
  style?: React.CSSProperties;
}> = ({ category, label, width, height, acme, counter, counterKick = 0, fill = 1, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius.window,
      background: colour.card,
      boxShadow: shadow,
      fontFamily: FONT,
      overflow: "hidden",
      position: "relative",
      ...style,
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
        <Glyph category={category} size={36} />
        <div style={{ ...type.uiStrong, color: colour.stone, whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ flex: 1 }} />
        {counter ? (
          <div
            style={{
              ...type.caption,
              color: interpolateColors(counterKick, [0, 1], [colour.stone, colour.ink]),
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              scale: String(1 + counterKick * 0.18),
              transformOrigin: "100% 50%",
            }}
          >
            {counter}
          </div>
        ) : null}
      </div>
      <div style={{ height: 1, background: colour.hairline, margin: `0 ${space.s3}px` }} />
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
          <div style={{ position: "relative", alignSelf: "flex-start", ...type.uiStrong, color: colour.ink, padding: "2px 8px", margin: "0 -8px" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 6,
                background: tint.ink10,
                transformOrigin: "0 50%",
                scale: `${acme} 1`,
              }}
            />
            <span style={{ position: "relative" }}>Acme Studio: rebrand, phase two</span>
          </div>
        ) : null}
        <Skeleton category={category} />
      </div>
    </div>
  </div>
);
