import { getStaticFiles } from "remotion";

/** True when public/<path> exists — lets the film pick up assets as they land. */
export const hasFile = (path: string) => getStaticFiles().some((f) => f.name === path);

/** First existing path among candidates. */
export const firstFile = (paths: string[]) => paths.find(hasFile);
