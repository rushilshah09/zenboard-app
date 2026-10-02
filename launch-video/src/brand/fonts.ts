import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Geist only (§3). loadFont holds the render until each face is ready. */
for (const weight of ["400", "500", "600"]) {
  loadFont({ family: "Geist", weight, url: staticFile(`fonts/geist-latin-${weight}-normal.woff2`) });
}

export const FONT = '"Geist", sans-serif';
