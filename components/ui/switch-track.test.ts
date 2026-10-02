import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── THE LABELLED, DRAGGABLE SWITCH ─────────────────────────────────────────
//
// Built 2026-09-28/29 to the user's sketch for the Focus toggle ("Off / Focus / on", a thumb that
// really drags). On 2026-10-02 the user replaced it in the top bar with a Linear-style toggle
// button (`FocusModeButton`, components/shell/shell-parts.tsx), so nothing renders this today.
// These tests moved here from focus-interaction.test.ts so the component keeps its guarantees if
// it is used again. If it is deleted, delete this file with it.

const track = readFileSync('components/ui/switch-track.tsx', 'utf8');

describe('the labelled switch', () => {
  it('the two words never move — the thumb slides over them', () => {
    // 2026-09-28, the user's sketch and their correction on seeing it built as a segmented:
    // "I want like this switch, not tabs." A segmented is a RADIO GROUP — two peer options where
    // there is one thing that is on or off — so the control stays `<button role="switch">`.
    // "Off" leading, "on" trailing, FIXED: they do not move and they do not fade. The pill slides
    // OVER them (user's spec, 2026-09-29: "Off and On remain fixed in the background, while the
    // Focus pill slides horizontally between them… partially covering them as it moves"). An
    // earlier version crossfaded their opacity; occlusion says the same thing without asking the
    // eye to track two fades at once.
    expect(track).toMatch(/pointer-events-none absolute inset-y-0 z-0 grid w-\[var\(--sw-travel\)\]/);
    expect(track, 'the quiet side must not read as a peer tab').toMatch(/text-ink-500/);
    expect(track, 'a fixed label does not fade').not.toMatch(/opacity: shown/);
  });

  it('sizes the TRACK from the thumb, so the pill can never outgrow it', () => {
    // THE BUG, 2026-09-29: the user sent a screenshot of "Focus" spilling out past the track. The
    // track was a two-column grid sized by its two SHORT words while the thumb had to hold a
    // third, longer one at `calc(50% - 4px)` — two widths with no relationship between them, so
    // any name wider than "Off"/"on" overflowed. Nothing caught it because nothing asserted that
    // the pill fits.
    //
    // Now an invisible copy of the thumb's own content sets the first column and the travel is the
    // second, so the track is BY CONSTRUCTION thumb + travel, in any language, with nothing
    // measured at runtime. These two must move together: the width the pill gets and the width
    // the column reserves are the same subtraction.
    expect(track).toMatch(/grid-cols-\[max-content_var\(--sw-travel\)\]/);
    expect(track, 'the hidden mirror is what sizes the column').toMatch(/invisible flex items-center gap-1\.5 whitespace-nowrap/);
    expect(track).toMatch(/w-\[calc\(100%-4px-var\(--sw-travel\)\)\]/);
    // Measured in the browser at three positions (3/37, 20/20, 37/3 px inside the track's ends):
    // symmetric, never overflowing, and a half drag uncovers exactly half of each label.
    expect(track).toMatch(/const TRAVEL_PX = 34;/);
  });

  it('interpolates continuously across the drag — position, fill and both labels', () => {
    // The user's spec, and the point of it: "subtly interpolate the pill colour based on its
    // position … smoothly transition the opacity … do not use abrupt state changes while
    // dragging." A half-way drag has to LOOK half-way, or it is a click with extra steps.
    expect(track, 'one number drives everything').toMatch(/const p = dragP \?\? \(on \? 1 : 0\);/);
    expect(track).toMatch(/color-mix\(in oklab, var\(--accent\) \$\{p \* 100\}%, var\(--color-ink-900\)\)/);
    // It travels exactly `--sw-travel`, which is the SAME number the pointer handler divides by —
    // a percentage of the thumb's own width no longer describes the distance, now that the thumb
    // and the travel are sized independently.
    expect(track).toMatch(/transform: `translateX\(calc\(\$\{p\} \* var\(--sw-travel\)\)\)`/);
    expect(track, 'the CSS and the drag math share one number').toMatch(/travelRef\.current = TRAVEL_PX;/);
    // Following a finger must never be animated — a transition there is the thumb lagging it.
    expect(track).toMatch(/const settle = dragging \? 'none'/);
    // …and the settle is a hard decelerating ease-out, which reads as a spring without the
    // overshoot the user ruled out ("no bouncing or excessive overshoot"). Tokens, never raw ms.
    expect(track).toMatch(/var\(--duration-base\) var\(--ease-out-quiet\)/);
    // Colour takes the HOVER curve and movement the arrival curve (CLAUDE.md, amended
    // 2026-09-17 — the strong ease-out snaps a wash on), at one duration so they land together.
    expect(track).toMatch(/background-color var\(--duration-base\) var\(--ease-hover\)/);
    // `p` is STATE, not a measurement taken while rendering: React forbids reading a ref during
    // render and eslint caught exactly that here. The pointer handler normalises against the same
    // constant the CSS travels by — it no longer has to measure the track at all, because the
    // travel is a declared number rather than a fraction of a width that changes with the label.
    expect(track).toMatch(/const p = dragP \?\? \(on \? 1 : 0\);/);
  });

  it('the grip is not decoration — the thumb really drags, and a tap is still a tap', () => {
    for (const h of ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel']) {
      expect(track, `the thumb needs ${h} to be draggable`).toContain(h);
    }
    expect(track, 'the pointer must be captured or the drag dies at the thumb edge').toMatch(/setPointerCapture/);
    // Under the slop it is a PRESS and the parent button's click owns it, so tap and keyboard are
    // untouched. Over it the drag commits past half the travel and must NOT also fire that click,
    // or the mode would toggle twice and land back where it started.
    expect(track).toMatch(/const DRAG_SLOP = 3;/);
    expect(track).toMatch(/if \(Math\.abs\(dx\) > DRAG_SLOP\) movedRef\.current = true;/);
    // Decided from the RELEASE position, not the last sample — a stale sample can land the
    // switch on the opposite side from where the finger let go.
    expect(track).toMatch(/const landed = Math\.min\(1, Math\.max\(0, \(\(on \? travel : 0\) \+ \(e\.clientX - startRef\.current\)\) \/ travel\)\);/);
    expect(track).toMatch(/if \(\(landed > 0\.5\) !== on\) onToggle\?\.\(\);/);
    expect(track).toMatch(/if \(movedRef\.current\) \{ e\.stopPropagation\(\)/);
  });

});
