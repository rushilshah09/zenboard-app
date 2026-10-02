import React, { createContext, useContext, useRef } from "react";
import { getInputProps, getRemotionEnvironment } from "remotion";
import { Rect, ZONES, intersects } from "../brand/layout";

/**
 * Collision tooling (§9). Scenes place top-level elements with <Place>, which
 * registers their box. <DebugOverlay> (rendered by the Camera) draws every
 * zone and element; two *moving* boxes that intersect turn red, and more than
 * 8 elements on screen raises a warning. On in Studio; force it in a render
 * with --props='{"debug":true}'.
 */
type Entry = { id: string; rect: Rect; moving: boolean };

const Registry = createContext<{ current: Entry[] } | null>(null);

export const debugEnabled = () => {
  const props = getInputProps() as { debug?: boolean };
  return props.debug ?? getRemotionEnvironment().isStudio;
};

export const DebugScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<Entry[]>([]);
  ref.current = []; // reset before this frame's children register
  return <Registry.Provider value={ref}>{children}</Registry.Provider>;
};

export const Place: React.FC<{
  id: string;
  rect: Rect;
  moving?: boolean;
  /** Registered bounds when a transform moves the element away from `rect`. */
  bounds?: Rect;
  /** Not on screen yet (or any more): skip it in the budget and collision checks. */
  visible?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ id, rect, moving = false, bounds, visible = true, style, children }) => {
  const reg = useContext(Registry);
  if (reg && visible && style?.opacity !== 0) reg.current.push({ id, rect: bounds ?? rect, moving });
  return <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...style }}>{children}</div>;
};

/** True while `frame` is inside any of the given [start, end] ranges. */
export const during = (frame: number, ...ranges: [number, number][]) => ranges.some(([a, b]) => frame >= a && frame <= b);

export const DebugOverlay: React.FC = () => {
  const reg = useContext(Registry);
  if (!reg || !debugEnabled()) return null;
  const entries = reg.current;
  const clash = new Set<string>();
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++)
      if (entries[i].moving && entries[j].moving && intersects(entries[i].rect, entries[j].rect)) {
        clash.add(entries[i].id);
        clash.add(entries[j].id);
      }
  const over = entries.length > 8;
  if (over) console.warn(`[DebugZones] ${entries.length} elements on screen (budget 8)`);
  const box = (r: Rect, stroke: string, dash = false) => ({
    position: "absolute" as const,
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    border: `2px ${dash ? "dashed" : "solid"} ${stroke}`,
    pointerEvents: "none" as const,
  });
  return (
    <>
      {Object.entries(ZONES).map(([k, r]) => (
        <div key={k} style={box(r, "rgba(111, 145, 168, 0.35)", true)} />
      ))}
      {entries.map((e) => (
        <div key={e.id} style={box(e.rect, clash.has(e.id) ? "#E0443A" : "rgba(125, 148, 101, 0.8)")}>
          <span style={{ fontSize: 14, fontFamily: "monospace", color: clash.has(e.id) ? "#E0443A" : "#7D9465" }}>{e.id}</span>
        </div>
      ))}
      <div style={{ position: "absolute", right: 16, top: 16, fontSize: 18, fontFamily: "monospace", color: over ? "#E0443A" : "#7D9465" }}>
        {entries.length}/8 elements
      </div>
      {/* Solid flags so a scrub (or an automated scan) can't miss a problem frame. */}
      {clash.size > 0 ? <div style={{ position: "absolute", left: 0, top: 0, width: 96, height: 96, background: "#FF0000" }} /> : null}
      {over ? <div style={{ position: "absolute", left: 96, top: 0, width: 96, height: 96, background: "#0000FF" }} /> : null}
    </>
  );
};
