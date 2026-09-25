import React from "react";
import { Composition, Folder } from "remotion";
import { LaunchVideo, SCENE_COMPONENTS } from "./LaunchVideo";
import { FPS } from "./theme";
import { TIMELINE, TOTAL_FRAMES } from "./timeline";

const size = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ZenboardLaunch" component={LaunchVideo} durationInFrames={TOTAL_FRAMES} {...size} />
    <Folder name="Scenes">
      {TIMELINE.map((s, i) => (
        <Composition
          key={s.id}
          id={`${String(i + 1).padStart(2, "0")}-${s.id}`}
          component={SCENE_COMPONENTS[s.id]}
          durationInFrames={s.frames}
          {...size}
        />
      ))}
    </Folder>
  </>
);
