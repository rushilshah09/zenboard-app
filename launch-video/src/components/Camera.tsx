import React from "react";
import { AbsoluteFill } from "remotion";
import { DebugOverlay } from "./DebugZones";

/**
 * One virtual 2D camera (§4): it drifts, pans and pulls back, but never
 * rotates, tilts or shakes. `locked` pins it for act 3.
 */
export const Camera: React.FC<{ scale?: number; x?: number; y?: number; locked?: boolean; children: React.ReactNode }> = ({
  scale = 1,
  x = 0,
  y = 0,
  locked = false,
  children,
}) => (
  <AbsoluteFill style={locked ? undefined : { scale: String(scale), translate: `${x}px ${y}px` }}>
    {children}
    <DebugOverlay />
  </AbsoluteFill>
);
