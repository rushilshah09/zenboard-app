# 007 — Progress fills and switch thumbs move with transform

- **Status**: DONE 2026-09-17 (the segmented thumb and tabs underline are declared exceptions: out-of-flow indicators whose rounded ends scaleX would distort)
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-17)
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 7 sites, 1 guard block
- **Depends on**: 006 (curve and ladder vocabulary, guard for movement curves)

## Problem

Emil Kowalski: "Only animate transform and opacity." These animate layout properties, which
re-run layout and paint on every frame:

| Location | Current |
| --- | --- |
| `components/ds/ui/progress.tsx:39` | `block h-full rounded-full transition-[width] duration-base ease-standard` + `style={{ width: \`${…}%\` }}` |
| `components/forms/form-renderer.tsx:213` | `h-full rounded-full bg-ink-900 transition-[width] duration-slow ease-standard` + `style={{ width: … }}` |
| `components/ds/ui/file-upload.tsx:209` | `block h-full rounded-full bg-berry-500 transition-[width]` + `style={{ width: \`${f.progress}%\` }}` |
| `components/horizon/horizon-view.tsx:92` | inline `width: \`${frac * 100}%\`, transition: 'width var(--duration-base) var(--ease-out-quiet)'` |
| `components/portal/portal-document.tsx:313` | inline `width: \`${meter}%\`, transition: 'width 300ms'` (also off the ladder, on CSS `ease`) |
| `components/ui/switch-track.tsx:32` | `transition-[left] [transition-duration:var(--duration-base)]` + `style={{ left: on ? geom.on : geom.off }}` |
| `components/ui/primitives.tsx:229` | the same thumb, legacy copy |

## Target

- A fill is full width and slides: `w-full` + `transform: translateX(-${100 - pct}%)`, transitioned
  with `transition-transform duration-base ease-standard` (a value changing on screen is movement →
  Emil's ease-in-out, `cubic-bezier(0.77, 0, 0.175, 1)`). Every track already clips with
  `overflow-hidden rounded-full` (confirm per site; add `overflow-hidden` to a track that lacks it),
  so the fill's rounded leading edge is kept and the trailing part is hidden.
- A switch thumb sits at `left: 0` and moves with `transform: translateX(${on ? geom.on : geom.off}px)`,
  `transition-transform duration-fast ease-standard`, and its track colour uses `duration-fast`
  so both land together (same as plan 006 did for the DS Switch).

## Steps

1. For each fill site: keep the `style` object but replace `width: X%` with
   `transform: \`translateX(-${100 - X}%)\``, add `w-full` (class) or `width: '100%'` (inline), and
   replace the transition with `transition-transform duration-base ease-standard` (class) or
   `transition: 'transform var(--duration-base) var(--ease-standard)'` (inline). Clamp X to 0–100
   where the site does not already. In `progress.tsx`, keep the `Math.min(100, Math.max(0, value!))` clamp.
2. `switch-track.tsx` and `primitives.tsx`: thumb class `absolute top-0.5 left-0 …` with
   `transition-transform duration-fast ease-standard`; `style={{ transform: \`translateX(${on ? geom.on : geom.off}px)\` }}`;
   track `[transition-duration:var(--duration-base)]` → `duration-fast`.
3. Guard in `app/design-system.test.ts`: no TSX line has `transition-\[(?:[^\]]*\b)(?:width|height|left|top|right|bottom|margin|padding)` and no `transition:` string names `width`, `height`, `left`, `top`, `margin` or `padding`, except the declared list: `components/shell/app-shell.tsx` (the desktop sidebar's collapse animates `width`/`min-width`, because the content beside it must reflow) and `components/ds/ui/drawer.tsx` (the bottom sheet's detent `height`), each with its reason in a comment.

## Boundaries

- Do NOT change what the bars show or their colours; do NOT touch the indeterminate keyframe.
- Do NOT touch the desktop sidebar collapse or the bottom sheet (declared exceptions).

## Verification

- **Mechanical**: `npx tsc --noEmit`, `npx vitest run app/design-system.test.ts`.
- **Live**: on a page with each bar, set the value and read `getComputedStyle(fill).transitionProperty === 'transform'`;
  the fill's right edge sits at X% of the track (±1px) once settled.
- **Feel check**: toggle the shell's Focus switch at 10%: the thumb slides with ease-in-out and the
  colour lands on the same frame; step through a form: the progress bar grows from the left with its
  rounded end intact.
- **Done when**: the guard passes and each fill measures within 1px of its old settled width.
