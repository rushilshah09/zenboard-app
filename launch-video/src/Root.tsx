import React from "react";
import { Composition, Folder } from "remotion";
import { LAUNCH_DURATION, LaunchVideo, SCENES } from "./LaunchVideo";
import { Scatter } from "./scenes/Scatter";
import { WordWall } from "./scenes/WordWall";
import { LogoReveal } from "./scenes/LogoReveal";
import { Today } from "./scenes/Today";
import { Command } from "./scenes/Command";
import { Collage } from "./scenes/Collage";
import { Spine } from "./scenes/Spine";
import { Kinetic } from "./scenes/Kinetic";
import { Outro } from "./scenes/Outro";
import { FPS } from "./theme";

const size = { width: 1920, height: 1080, fps: FPS };

const scenes = { Scatter, WordWall, LogoReveal, Today, Command, Collage, Spine, Kinetic, Outro };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ZenboardLaunch" component={LaunchVideo} durationInFrames={LAUNCH_DURATION} {...size} />
    <Folder name="Scenes">
      {(Object.keys(scenes) as (keyof typeof scenes)[]).map((id) => (
        <Composition key={id} id={id} component={scenes[id]} durationInFrames={SCENES[id]} {...size} />
      ))}
    </Folder>
  </>
);
