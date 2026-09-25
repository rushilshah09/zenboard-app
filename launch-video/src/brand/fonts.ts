import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Geist and Geist Mono only (v3 §2). loadFont holds the render until each face is ready. */
for (const weight of ["400", "500", "600"]) {
  loadFont({ family: "Geist", weight, url: staticFile(`fonts/geist-latin-${weight}-normal.woff2`) });
}

for (const weight of ["400", "500"]) {
  loadFont({ family: "Geist Mono", weight, url: staticFile(`fonts/geist-mono-latin-${weight}-normal.woff2`) });
}

export const FONT = '"Geist", sans-serif';
/** Geist Mono: data (times, amounts, counters, keyboard hints) and the decode glyphs. */
export const MONO = '"Geist Mono", monospace';
