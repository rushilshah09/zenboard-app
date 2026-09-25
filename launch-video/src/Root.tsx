import React from "react";
import { Composition, Folder } from "remotion";
import "./brand/fonts";
import { Film, SCENE } from "./Film";
import { LogoConcept } from "./scenes/LogoConcept";
import { FPS, SCENES, TOTAL_FRAMES, beat } from "./brand/timeline";

const size = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Film16x9" component={Film} durationInFrames={TOTAL_FRAMES} {...size} />
    <Composition id="LogoConcept" component={LogoConcept} durationInFrames={360} {...size} />
    <Folder name="Scenes">
      {SCENES.map((s) => (
        <Composition key={s.id} id={s.id} component={SCENE[s.id]} durationInFrames={beat(s.beats)} {...size} />
      ))}
    </Folder>
  </>
);
