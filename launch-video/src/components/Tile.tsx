import React from "react";
import { FONT } from "../brand/fonts";
import { Category, colour, radius, shadow, space, type } from "../brand/tokens";
import { Glyph } from "./Glyph";

/** An app shrunk to a tile (S04) or a tab (S05): glyph plus Stone label. */
export const Tile: React.FC<{ category: Category; label: string; width: number; height: number; tab?: boolean; style?: React.CSSProperties }> = ({
  category,
  label,
  width,
  height,
  tab = false,
  style,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: tab ? radius.card : radius.window,
      background: colour.card,
      boxShadow: shadow,
      fontFamily: FONT,
      display: "flex",
      flexDirection: tab ? "row" : "column",
      alignItems: "center",
      justifyContent: "center",
      gap: tab ? space.s1 : space.s2,
      ...style,
    }}
  >
    <Glyph category={category} size={tab ? 28 : 52} />
    <div style={{ ...type.caption, color: colour.stone, whiteSpace: "nowrap" }}>{label}</div>
  </div>
);
