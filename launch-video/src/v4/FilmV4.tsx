/** The v4 launch film: every scene on its slot, plus the transition overlays that span scene cuts. */
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { V4, V4Scene, v4At, v4Len } from "./timeline";
import { SCENES_V4 } from "./scenes";
import { PAPER } from "./kit";


export const FilmV4: React.FC<{ score?: boolean }> = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    {(Object.keys(V4) as V4Scene[]).map((k) => {
      const C = SCENES_V4[k];
      return C ? (
        <Sequence key={k} from={v4At(k)} durationInFrames={v4Len(k)} name={k}>
          {/* film-camera motion blur: each frame blends 5 sub-frame samples over a 180° shutter */}
          <CameraMotionBlur samples={5} shutterAngle={180}>
            <C />
          </CameraMotionBlur>
        </Sequence>
      ) : null;
    })}
    {/* sound: score, motion-matched SFX and voice-over, mixed and mastered by scripts/sound-design-v4.py */}
    <Audio src={staticFile("audio/v4/mix.wav")} />
  </AbsoluteFill>
);
