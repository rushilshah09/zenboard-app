import React from "react";
import { FilmScene } from "../../timeline/film";
import { Noise } from "./Noise";
import { Collapse } from "./Collapse";
import { Reveal } from "./Reveal";
import { Arc } from "./Arc";
import { Graph } from "./Graph";
import { Orbit } from "./Orbit";
import { Flow } from "./Flow";
import { One } from "./One";
import { Outro } from "../Outro";

/** Each film scene's component (scene-local frames). Placeholders are replaced as scenes are animated. */
export const SCENES: Record<FilmScene, React.FC> = {
  noise: Noise,
  collapse: Collapse,
  reveal: Reveal,
  arc: Arc,
  graph: Graph,
  orbit: Orbit,
  flow: Flow,
  one: One,
  outro: Outro,
};
