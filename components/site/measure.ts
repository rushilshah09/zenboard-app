// The page's measure, in a plain module on purpose: a value exported from a 'use client' file reaches
// a server component as a client REFERENCE, which renders correctly as a prop but vanishes inside
// cn() on the server (the grid's guides were drawn at the window's edges that way). Anything a server
// component computes with has to come from a module like this one.

/**
 * THE PAGE'S MEASURE: a frame 1440px wide (user, 2026-09-26: "max width is 1440px container").
 *
 * What runs to the window's edges is the page's LINES, not its sections (user, 2026-09-26: "I told
 * it to extend the line, it extended the section size, fix this"). Every section's top rule runs out
 * to both edges of the window and the grid's two outer rules run the height of the page, crossing at
 * the grid's corners (`.site-row`, `.site-guides`, `.site-foot` in globals.css). The sections keep
 * this measure, so a line of text never runs to a 2,560px window's width.
 */
export const MEASURE = 'mx-auto w-full max-w-[1440px] px-3 sm:px-6';
/** A cell's inset, for the rows that are not cells: the navigation and the footer's frame. */
export const GUTTER = 'site-pad';
