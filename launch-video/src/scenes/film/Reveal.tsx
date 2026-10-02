import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { colour, energy, stage } from "../../brand/tokens";
import { Cursor } from "../../components/Cursor";
import { voAt } from "../../timeline/film";
import { AW, AW_CHECK, AppWorkspace } from "../../ui/app/AppWorkspace";
import { Finish } from "../../ui/Stage";

/**
 * Scene 3 · The Reveal (0:16–0:24). One long move.
 *   0        match cut: the mark's centre becomes a checkbox at 800%
 *   14–62    the cursor, enormous, arrives and clicks; the tick draws on
 *   70–300   one continuous pull-out, 800% → 72%, the stage going from Ink to
 *            Ivory as we exit the UI; "Your whole business." in the widening space
 *   290–400  the workspace tilts back 18° to the hero angle with a pink rim
 *            light over the Ivory floor; "One workspace."
 */
export const REVEAL_FRAMES = 480;
const START = { x: 960, y: 500 };
const END = { x: 960, y: 630 };
const K0 = 8;
const K1 = 0.86;

export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const pull = clamp(f, [70, 300], [0, 1], CURVE.glide);
  // Scale interpolated in log space so the pull-out reads at a constant rate.
  const k = Math.exp(Math.log(K0) + (Math.log(K1) - Math.log(K0)) * pull);
  // The checkbox travels from frame centre to where it sits in the centred, scaled workspace.
  const endCheck = { x: END.x - (AW.w / 2) * K1 + AW_CHECK.x * K1, y: END.y - (AW.h / 2) * K1 + AW_CHECK.y * K1 };
  const cx = START.x + (endCheck.x - START.x) * pull;
  const cy = START.y + (endCheck.y - START.y) * pull;
  const left = cx - AW_CHECK.x * k;
  const top = cy - AW_CHECK.y * k;

  const click = clamp(f, [40, 46], [0, 1]) * clamp(f, [48, 56], [1, 0]);
  const check = clamp(f, [46, 64], [0, 1], EASE.settle);
  const cursorIn = clamp(f, [12, 44], [0, 1], CURVE.glide);
  const cursorOut = clamp(f, [70, 110], [0, 1], EASE.settle);
  const ivory = clamp(f, [150, 290], [0, 1], EASE.settle);
  const tilt = clamp(f, [290, 400], [0, 1], CURVE.glide);
  const whole = voAt("whole", "reveal");
  const one = voAt("one", "reveal");
  const wholeO = clamp(f, [whole - 6, whole + 22], [0, 1], EASE.settle) * clamp(f, [one - 30, one - 10], [1, 0]);
  const oneO = clamp(f, [one - 6, one + 22], [0, 1], EASE.settle);
  // Macro depth of field while we're close: the rows around the checkbox soften.
  const macro = clamp(k, [1.4, 6], [0, 1]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: stage.ink, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, background: stage.ivory, opacity: ivory }} />
      <div style={{ position: "absolute", inset: 0, opacity: ivory, background: "radial-gradient(ellipse 70% 30% at 50% 92%, rgba(40, 4, 23, 0.10), transparent 70%)" }} />
      {/* Energy light behind the far edge, once tilted: light, never a backdrop. */}
      <div style={{ position: "absolute", left: 960 - 820, top: 250, width: 1640, height: 440, borderRadius: "50%", opacity: tilt, background: `radial-gradient(closest-side, rgba(196,28,114,.34), rgba(232,168,197,.3) 45%, rgba(232,184,138,.14) 70%, transparent)`, filter: "blur(24px)" }} />
      <div style={{ position: "absolute", left: 960 - 760, top: 960, width: 1520, height: 110, borderRadius: "50%", opacity: tilt, background: "radial-gradient(closest-side, rgba(40,4,23,.26), transparent)", filter: "blur(18px)" }} />
      <div style={{ position: "absolute", inset: 0, perspective: 2200, perspectiveOrigin: `960px ${END.y - 260}px` }}>
        <div
          style={{
            position: "absolute",
            left,
            top,
            width: AW.w,
            height: AW.h,
            transformOrigin: "0 0",
            transform: `scale(${k})`,
          }}
        >
          <div
            style={{
              width: AW.w,
              height: AW.h,
              borderRadius: 18,
              transformOrigin: "50% 50%",
              transform: `rotateX(${18 * tilt}deg)`,
              boxShadow: `0 -1.5px 0 rgba(196,28,114,${tilt}), 0 -12px 44px rgba(196,28,114,${0.4 * tilt}), 0 40px 90px rgba(40,4,23,${0.35 * ivory})`,
              filter: macro > 0 ? `blur(${0}px)` : undefined,
            }}
          >
            <AppWorkspace check={check} />
          </div>
        </div>
      </div>
      {/* Macro vignette: only the checkbox plane is sharp at 800%. */}
      <div style={{ position: "absolute", inset: 0, opacity: macro, backdropFilter: "blur(6px)", WebkitMaskImage: `radial-gradient(circle at ${cx}px ${cy}px, transparent 180px, black 520px)`, maskImage: `radial-gradient(circle at ${cx}px ${cy}px, transparent 180px, black 520px)` }} />
      {/* The cursor, enormous. */}
      <div style={{ position: "absolute", left: cx + 26 + (1 - cursorIn) * 520 + cursorOut * 900, top: cy + 20 + (1 - cursorIn) * 380 + cursorOut * 500, transform: "scale(5)", transformOrigin: "0 0", opacity: (cursorIn > 0.01 ? 1 : 0) * (1 - cursorOut) }}>
        <Cursor x={0} y={0} pressed={click} tone="light" />
      </div>
      {/* Click ring. */}
      <div style={{ position: "absolute", left: cx, top: cy, width: 0, height: 0 }}>
        <div style={{ position: "absolute", left: -120, top: -120, width: 240, height: 240, borderRadius: "50%", border: `3px solid ${energy.rose}`, opacity: clamp(f, [46, 70], [0.8, 0]), transform: `scale(${clamp(f, [46, 70], [0.7, 1.5])})` }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 104, letterSpacing: "-0.045em", lineHeight: 1, color: colour.ink, opacity: wholeO, translate: `0 ${(1 - wholeO) * 16}px`, filter: `blur(${(1 - wholeO) * 8}px)` }}>
        Your whole business.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 112, letterSpacing: "-0.045em", lineHeight: 1, color: colour.ink, opacity: oneO, translate: `0 ${(1 - oneO) * 16}px`, filter: `blur(${(1 - oneO) * 8}px)` }}>
        One workspace.
      </div>
      <Finish />
    </div>
  );
};
