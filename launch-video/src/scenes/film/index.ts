import React from "react";
import { FilmScene } from "../../timeline/film";
import { Noise } from "./Noise";
import { Collapse } from "./Collapse";
import { Reveal } from "./Reveal";
import { Arc } from "./Arc";
import { S4Styleframe } from "../S4Graph";
import { S5Styleframe } from "../S5Orbit";
import { MosaicMorph } from "../MosaicMorph";
import { S7Styleframe } from "../S7One";
import { Outro } from "../Outro";

/** Each film scene's component (scene-local frames). Placeholders are replaced as scenes are animated. */
export const SCENES: Record<FilmScene, React.FC> = {
  noise: Noise,
  collapse: Collapse,
  reveal: Reveal,
  arc: Arc,
  graph: S4Styleframe,
  orbit: S5Styleframe,
  flow: MosaicMorph,
  one: S7Styleframe,
  outro: Outro,
};
