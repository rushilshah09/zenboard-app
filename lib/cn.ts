// design-system.md §6.3 — the one sanctioned className escape hatch. Every ui/
// component accepts `className` and merges it LAST via cn(), so layout overrides
// win but re-skinning (bg-blue-500) is still reviewable.
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge doesn't know our CSS-first @theme scale, so it mis-grouped our
// custom text-* font sizes (text-body, text-ui, …) together WITH text-* colours
// (text-onsolid) and dropped the colour when a size followed it — e.g. the
// primary button lost `text-onsolid`. Register the named font sizes so a size
// and a colour never collide.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "caption",
            "overline",
            "meta",
            "mono-sm",
            "ui",
            "mono-md",
            "body",
            "lead",
            "title-1",
            "title-2",
            "title-3",
            "title-4",
            "display",
          ],
        },
      ],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
