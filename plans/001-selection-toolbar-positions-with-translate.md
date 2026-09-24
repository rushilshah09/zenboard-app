# 001 — The selection toolbar positions itself with `translate`, not `transform`

- **Status**: DONE 2026-09-17
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-16)
- **Severity**: HIGH
- **Category**: Physicality & origin (an entrance keyframe fighting the element's own positioning)
- **Estimated scope**: 1 component line, 1 guard test (~25 lines)

## Problem

The floating formatting toolbar that appears over selected text positions itself with an
inline `transform`, and enters with a keyframe that animates `transform`. A running CSS
animation outranks an inline style, so for the whole entrance the keyframe's value
REPLACES the positioning translate. The toolbar fades in at the wrong place, on top of the
text you just selected, then jumps to its real position when the animation ends.

```tsx
// components/documents/rich-text.tsx:907-913 — current
<Toolbar
  floating
  onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
  className="fixed z-dropdown [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]"
  // Position is computed from the selection coords — geometry stays inline.
  style={{ left: tb.x, top: tb.y, transform: tb.below ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))' }}
>
```

```css
/* app/globals.css:664 — the keyframe it plays */
@keyframes zb-pop-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
```

Measured on `/dev-preview/editor` (double-click "paragraph", animations slowed to 10%, then
paused and scrubbed):

| Moment | top | left | computed `transform` |
| --- | --- | --- | --- |
| Entrance, 50% | 300.95px | 468.15px | `matrix(0.99932, 0, 0, 0.99932, 0, 0.136)` |
| After the animation | 254.8px | 322.1px | `matrix(1, 0, 0, 1, -145.914, -46)` |

It fades in 145.9px to the right and 46px lower than where it lives, covering the selected
text, then snaps into place. Selecting text happens dozens of times a day in Docs.

## Target

Position with the individual `translate` property. `translate` and `transform` are separate
properties that compose (translate first, then transform), so the entrance keyframe can
scale and fade the toolbar without moving where it sits. Scale from the edge that faces the
selection, which is where the toolbar comes from.

```tsx
// target
style={{
  left: tb.x,
  top: tb.y,
  translate: tb.below ? '-50% 8px' : '-50% calc(-100% - 8px)',
  transformOrigin: tb.below ? '50% 0%' : '50% 100%',
}}
```

## Repo conventions to follow

- Motion tokens: durations `--duration-instant|fast|base|slow` (20/100/150/200ms) and curves
  `--ease-out-quiet` = `cubic-bezier(0.23, 1, 0.32, 1)` live in `app/ds-theme.css`. Do not
  add or change tokens in this plan.
- Guard tests for motion live in `app/design-system.test.ts`, as `describe` blocks with
  a must-fail control first. They use the file's helpers `FILES` (source file list) and
  `code(file)`, which returns the file as an ARRAY of lines with comments blanked. Imitate
  `describe('a toast animates with transitions, not keyframes', ...)` near line 1540.

## Steps

1. In `components/documents/rich-text.tsx`, replace the `style={{ ... transform: ... }}`
   line of the floating `<Toolbar>` (currently line 912) with the target `style` above.
   Keep the comment line above it. Change nothing else on the element.
2. Confirm nothing else on that element sets `transform` (the `Toolbar` component is in
   `components/ds/ui/`; open it and check that it spreads `style` onto its root and does
   not set a `transform` of its own). If it does set one, STOP and report.
3. In `app/design-system.test.ts`, append this block at the end of the file:

   ```ts
   describe('an element that animates in does not position itself with transform', () => {
     // A running animation outranks an inline style, so a keyframe that animates
     // `transform` REPLACES an inline `transform: translate(...)` for as long as it
     // runs: the selection toolbar faded in 146px right and 46px low, over the text,
     // then jumped. Position with the `translate` property, which composes instead.
     const ANIMATES = /animation:|\[animation:|\banimate-(?:emerge|rise|exit|fadein|tick|pop-in|slide-in-[a-z]+|slide-out-[a-z]+)\b/;
     const POSITIONS_WITH_TRANSFORM = /\btransform:\s*[`'"][^`'"]*translate\(/;

     it('catches the shape it guards (control)', () => {
       const before = "className=\"fixed [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]\" style={{ left: x, transform: 'translate(-50%, 8px)' }}";
       expect(ANIMATES.test(before) && POSITIONS_WITH_TRANSFORM.test(before)).toBe(true);
       const after = "className=\"fixed [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]\" style={{ left: x, translate: '-50% 8px' }}";
       expect(ANIMATES.test(after) && POSITIONS_WITH_TRANSFORM.test(after)).toBe(false);
     });

     it('no animated element carries a positioning transform within three lines', () => {
       const offenders: string[] = [];
       for (const file of FILES.filter((f) => /\.tsx$/.test(f))) {
         const lines = code(file);
         lines.forEach((line, i) => {
           if (!ANIMATES.test(line)) return;
           const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
           if (POSITIONS_WITH_TRANSFORM.test(near)) offenders.push(`${file}:${i + 1}`);
         });
       }
       expect(offenders).toEqual([]);
     });
   });
   ```

## Boundaries

- Do NOT change `@keyframes zb-pop-in` or any token. Plan 003 changes the keyframe; this
  plan must be correct with the keyframe as it is today.
- Do NOT change the toolbar's markup, props, `className`, or positioning math (`tb.x`,
  `tb.y`, `tb.below`).
- Do NOT add dependencies.
- If the excerpt above does not match the file (drift since the commit stamp), STOP and
  report instead of improvising.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0. `npx vitest run app/design-system.test.ts`
  passes, including the new block. Temporarily revert step 1 and confirm the new test
  FAILS naming `components/documents/rich-text.tsx`, then restore step 1.
- **Feel check** (`/dev-preview/editor`, dev server running):
  - Double-click a word in "A paragraph with enough text…". The toolbar appears ABOVE the
    selection, centred on it, and never covers the selected word at any point.
  - In DevTools, open the Animations panel, set playback to 10%, and select the text again.
    Scrub the `zb-pop-in` animation. At every frame the toolbar's horizontal centre sits
    over the selection, and it grows out of its bottom edge (the edge facing the text).
  - Select text on the first line of a page so the toolbar opens BELOW (`tb.below`). It
    grows out of its top edge and sits 8px under the selection throughout.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel): the toolbar fades in with no
    scale, in its final position.
- **Done when**: at 50% of the entrance, the toolbar's `getBoundingClientRect().left` is
  within 3px of its settled value, and `top` within 3px (the 0.98 scale accounts for the rest).
