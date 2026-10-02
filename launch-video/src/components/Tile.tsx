import React from "react";
import { FONT } from "../brand/fonts";
import { surface } from "../brand/surface";
import { Category, radius, space, type } from "../brand/tokens";
import { Glyph } from "./Glyph";

/** An app shrunk to a tile (S04) or a tab (S05): glyph plus label. White on the aurora, glass on the void. */
export const Tile: React.FC<{ category: Category; label: string; width: number; height: number; tab?: boolean; dark?: number; style?: React.CSSProperties }> = ({
  category,
  label,
  width,
  height,
  tab = false,
  dark = 0,
  style,
}) => {
  const s = surface(dark);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: tab ? radius.card : radius.window,
        background: s.bg,
        boxShadow: `${s.shadow}, inset 0 0 0 1px ${s.line}`,
        backdropFilter: s.backdrop,
        fontFamily: FONT,
        display: "flex",
        flexDirection: tab ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tab ? space.s1 : space.s2,
        ...style,
      }}
    >
      <Glyph category={category} size={tab ? 28 : 52} dark={dark} />
      <div style={{ ...type.caption, color: s.muted, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
};
