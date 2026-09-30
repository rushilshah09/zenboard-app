import React from "react";
import { FONT } from "../brand/fonts";
import { colour, energy } from "../brand/tokens";
import { Stage } from "../ui/Stage";
import { WS, Workspace } from "../ui/Workspace";

/**
 * Scene 3 · The Reveal (0:16–0:24). Signature: an extreme macro pull-out from
 * 800% inside a checkbox, ending in a rim-lit 3D hero shot of the workspace.
 * Styleframe: beat 3c. The workspace tilts back 18° over the Ivory floor, the
 * energy light behind its far edge, "One workspace." in the space above.
 */
export const S3Styleframe: React.FC = () => {
  const k = 0.86;
  return (
    <Stage kind="ivory">
      {/* Energy light behind the workspace's far edge: light, not a background. */}
      <div style={{ position: "absolute", left: 960 - 800, top: 250, width: 1600, height: 420, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(196,28,114,.30), rgba(232,168,197,.28) 45%, rgba(232,184,138,.12) 70%, transparent)`, filter: "blur(20px)" }} />
      {/* Soft floor shadow under the floating panel. */}
      <div style={{ position: "absolute", left: 960 - 760, top: 930, width: 1520, height: 120, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(40,4,23,.22), transparent)", filter: "blur(18px)" }} />
      {/* One perspective for the whole frame, centred on the panel, so the tilt is symmetric. */}
      <div style={{ position: "absolute", inset: 0, perspective: 2200, perspectiveOrigin: "960px 380px" }}>
        <div
          style={{
            position: "absolute",
            left: 960 - WS.w / 2,
            top: 650 - WS.h / 2,
            transform: `rotateX(18deg) scale(${k})`,
            transformOrigin: "50% 50%",
            borderRadius: 22,
            boxShadow: `0 -1.5px 0 ${energy.pink}, 0 -10px 40px rgba(196,28,114,.35), 0 2px 4px rgba(40,4,23,.08), 0 40px 90px rgba(40,4,23,.22)`,
          }}
        >
          <Workspace checkedFirst style={{ width: WS.w, height: WS.h }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 112, letterSpacing: "-0.04em", color: colour.ink, lineHeight: 1 }}>
        One workspace.
      </div>
    </Stage>
  );
};
