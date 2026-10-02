// design-system.md §6.3 — the one sanctioned className escape hatch. Every ui/
// component accepts `className` and merges it LAST via cn(), so layout overrides
// win but re-skinning (bg-blue-500) is still reviewable.
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge doesn't know our CSS-first @theme scale, so it files an unknown `text-<name>` in the COLOUR group and
// keeps only the last of a size and a colour. Registered in July for thirteen names (the primary button had lost
// `text-onsolid`); the theme declares more, and the missing ones kept failing the same way — a goal's title,
// `cn('text-h4', 'text-ink-900')`, rendered at body size, and `cn(button({ variant: 'primary', size: 'xl' }))` kept
// `text-body-lg` and DROPPED the primary's white ink (2026-09-22). Every size the theme declares is listed here;
// lib/cn.test.ts reads the theme and fails when a new one is not.
const FONT_SIZES = [
  // ds-theme.css
  "caption", "overline", "meta", "mono-sm", "ui", "mono-md", "lead", "editor",
  "title-1", "title-2", "title-3", "title-4",
  // globals.css (the role scale)
  // The website's two display steps (components/site), above the app's scale, and their phone steps.
  "hero", "headline", "hero-sm", "headline-sm",
  "display", "h1", "h2", "h3", "h4", "stat", "body-lg", "body", "body-sm", "small", "label", "micro", "nano", "code",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
