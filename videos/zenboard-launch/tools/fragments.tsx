// Renders the approved v4 UI (launch-video/src/v4) to static HTML fragments for the HyperFrames film.
import React from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { writeFileSync } from "fs";
import { Dashboard } from "../../../launch-video/src/v4/Dashboard";
import { FeatUI, Float, FEATS } from "../../../launch-video/src/v4/S5Features";
import { Steps, TEXT } from "../../../launch-video/src/v4/S6Automation";
import { Icon, Lockup, Defs } from "../../../launch-video/src/v4/kit";
import { KIND, KINDS } from "../../../launch-video/src/v4/S1Juggling";
import { LOCKUP_MARK, LOCKUP_LETTERS } from "../../../launch-video/src/brand/logo.generated";
import { ICONS } from "../../../launch-video/src/v4/icons.generated";

const icons: Record<string, string> = {};
for (const n of Object.keys(ICONS)) for (const w of ["fill", "regular", "bold", "duotone"]) {
  if ((ICONS as any)[n][w]) icons[`${n}:${w}`] = html(<Icon name={n as any} weight={w as any} />);
}
const out = {
  defs: html(<Defs />),
  dashboard: html(<Dashboard />),
  feats: FEATS.map((F, i) => ({ ...F, ui: html(<FeatUI i={i} />), float: html(<Float i={i} />) })),
  steps: html(<Steps state={4} />),
  prompt: TEXT,
  lockupDark: html(<Lockup width={40} />),
  kinds: KINDS.map((k) => KIND[k]),
  mark: LOCKUP_MARK,
  letters: LOCKUP_LETTERS,
  icons,
};
writeFileSync(process.argv[2], JSON.stringify(out));
console.log("fragments:", Object.keys(out).join(", "), "icons", Object.keys(icons).length);
