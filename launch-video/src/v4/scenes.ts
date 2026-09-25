import type React from "react";
import type { V4Scene } from "./timeline";
import { S1Juggling } from "./S1Juggling";
import { S2Resolve } from "./S2Resolve";
import { S3AllInOne } from "./S3AllInOne";
import { S4Dashboard } from "./S4Dashboard";
import { S5Features } from "./S5Features";
import { S6Automation } from "./S6Automation";
import { S7Pills } from "./S7Pills";
import { S8Carousel } from "./S8Carousel";
import { S9One } from "./S9One";

export const SCENES_V4: Partial<Record<V4Scene, React.FC>> = {
  juggling: S1Juggling,
  resolve: S2Resolve,
  allInOne: S3AllInOne,
  dashboard: S4Dashboard,
  features: S5Features,
  automation: S6Automation,
  pills: S7Pills,
  carousel: S8Carousel,
  one: S9One,
};
