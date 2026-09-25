import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { FONT } from "../brand/fonts";
import { stage } from "../brand/tokens";
import { hasFile } from "../components/media";

/**
 * The two stages of v3 (DIRECTION_V3.md §2) plus the film finish: 3% grain and
 * a 10% burgundy vignette. Scenes draw on top of a Stage; nothing else paints
 * a background.
 *
 * Ink: deep burgundy at the centre falling to a darker burgundy at the edges,
 * with a faint dusty-rose haze. Ivory: warm cream with a soft shadow floor.
 */
export const Stage: React.FC<{ kind: "ink" | "ivory"; haze?: number; children: React.ReactNode }> = ({ kind, haze = 1, children }) => (
  <AbsoluteFill style={{ fontFamily: FONT, overflow: "hidden", background: kind === "ink" ? stage.ink : stage.ivory }}>
    {kind === "ink" ? (
      <>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 46%, #3A0A22 0%, ${stage.ink} 45%, ${stage.inkEdge} 100%)` }} />
        {/* Dusty-rose haze: two soft banks drifting through the space. */}
        <AbsoluteFill
          style={{
            opacity: 0.1 * haze,
            background: `radial-gradient(ellipse 60% 40% at 28% 62%, ${stage.haze}, transparent 70%), radial-gradient(ellipse 50% 35% at 74% 34%, ${stage.haze}, transparent 70%)`,
          }}
        />
      </>
    ) : (
      <>
        {/* The Ivory floor: a soft shadow pooling under the centre of frame. */}
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 30% at 50% 88%, rgba(40, 4, 23, 0.07), transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 40%, rgba(255, 255, 255, 0.55), transparent 70%)` }} />
      </>
    )}
    {children}
    <Finish />
  </AbsoluteFill>
);

/** Film finish over everything: grain 3% and a 10% burgundy vignette (never black). */
export const Finish: React.FC<{ grain?: number }> = ({ grain = 0.03 }) => (
  <>
    <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(40, 4, 23, 0.10) 100%)` }} />
    {grain > 0 && hasFile("img/IMG-04.png") ? (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Img src={staticFile("img/IMG-04.png")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: grain }} />
      </AbsoluteFill>
    ) : null}
  </>
);
