// ONE collapse, for everything inside the sidebar.
//
// Collapsing the sidebar used to re-render every row on the first frame: labels
// unmounted, rows re-centred, the header swapped its wordmark for the mark, the
// "Pinned" heading vanished — and only the panel's WIDTH animated. So in slow
// motion the text was gone at frame 0 while the panel was still 230px wide, and
// every icon, now centred in that shrinking panel, slid ~90px left to meet the
// rail (the pinned icons, which also lost a 12px indent, travelled further).
//
// Now each part keeps its place and the panel's narrowing does the work: a row
// stretches to its column, so in the 50px rail it is the 32px square by
// construction and only its inset changes (8px beside a label, 6px to centre a
// 20px glyph in the rail — a 2px glide); a label stays mounted and fades.
// Everything that moves shares ONE duration and curve, so nothing lands early.
//
// The curve is Emil Kowalski's ease-in-out: the sidebar is not arriving or
// leaving, it is changing shape on screen.
import type { CSSProperties } from 'react';

/** Duration and curve of everything the collapse moves: width, insets, indents. */
export const RAIL_MOTION = 'var(--duration-slow) var(--ease-standard)';

/**
 * A label (or any glyph that only belongs to the expanded sidebar) in a
 * collapsing rail: it FADES and is never unmounted, or it vanishes on the first
 * frame while the panel is still wide. It leaves quickly as the rail closes, and
 * arrives only once the panel is most of the way open, so it is not revealed
 * while the row beneath it is still reflowing. `extra` carries any transition
 * the element already had (a press, a colour, a rotation).
 */
export function railFade(collapsed: boolean | undefined, extra?: string): CSSProperties {
  const fade = collapsed
    ? 'opacity var(--duration-fast) var(--ease-hover)'
    : 'opacity var(--duration-fast) var(--ease-hover) var(--duration-fast)';
  return { opacity: collapsed ? 0 : 1, transition: extra ? `${fade}, ${extra}` : fade };
}
