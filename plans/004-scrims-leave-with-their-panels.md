# 004 — A scrim leaves with its panel

- **Status**: DONE 2026-09-17 (also gave PageView's centre peek panel its missing exit, so the scrim cannot outlive it)
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-16)
- **Severity**: MEDIUM
- **Category**: Cohesion (properties out of sync)
- **Estimated scope**: 1 token + 1 keyframe, 5 overlay class strings, 1 guard block
- **Depends on**: 002 removes the DS CommandMenu's animations, so its overlay is NOT in this plan.

## Problem

Every DS overlay fades its scrim IN and declares nothing for OUT. Radix's `Presence` sees no
closing animation on the scrim and unmounts it at once, while the panel above it plays its
100ms exit. For the length of that exit the page is fully bright and the panel is a
half-transparent ghost floating over it: two states on screen at the same time, which is
the first thing Emil's slow-motion check looks for.

```tsx
// components/ds/ui/modal.tsx:61 (and :152) — current
<RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]" />
// components/ds/ui/page-view.tsx:358 — current (center peek)
<RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-fadein" />
// components/ds/ui/drawer.tsx:66 (Drawer) and :249 (BottomSheet) — current
<RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-fadein" />
<RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] data-[state=open]:animate-fadein" />
```

Measured on `/dev-preview/overlay-states`: open "New project", click Cancel with animations at
10%, sample at 25% of the panel's `exit` — the overlay element is already gone from the DOM
(`overlayStillMounted: false`) while `[role=dialog]` is still mounted with `data-state="closed"`,
and the screenshot shows the dialog ghosted over the undimmed page.

The two modal overlays also hand-spell the fade token
(`animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]`, which is exactly
`--animate-fadein`) instead of using it.

## Target

The scrim leaves with the panel, on the panel's exit timing: `--duration-fast` (100ms) on
`--ease-out-quiet` (`cubic-bezier(0.23, 1, 0.32, 1)`), opacity only — a scrim has nowhere to go.

```css
/* app/ds-theme.css, in @theme */
--animate-fadeout: fadeout var(--duration-fast) var(--ease-out-quiet);
/* app/ds-theme.css, beside @keyframes fadein */
@keyframes fadeout { to { opacity: 0; } }
```

Every DS overlay: `data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout`.

## Repo conventions to follow

- Named animations live in `app/ds-theme.css`'s `@theme` block as `--animate-<name>` and are
  used as Tailwind classes (`animate-<name>`), e.g. `--animate-exit: exit var(--duration-fast) var(--ease-out-quiet);`
  (exits are `--duration-fast`, entrances `--duration-base`).
- A keyframe that only changes `opacity` needs no reduced-motion twin (the twins exist only
  for keyframes that move).
- `app/design-system.test.ts` guards "an animation class draws something": every
  `animate-*` class must have a `--animate-*` token, so add the token in step 1 before using it.

## Steps

1. `app/ds-theme.css` — directly after the line
   `--animate-fadein: fadein var(--duration-base) var(--ease-out-quiet);` add
   `--animate-fadeout: fadeout var(--duration-fast) var(--ease-out-quiet);`
   and directly after `@keyframes fadein { from { opacity: 0; } }` add
   `@keyframes fadeout { to { opacity: 0; } }`.
2. `components/ds/ui/modal.tsx` — in BOTH overlay class strings (lines 61 and 152) replace
   `data-[state=open]:animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]` with
   `data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout`.
3. `components/ds/ui/page-view.tsx:358`, `components/ds/ui/drawer.tsx:66` and `:249` — in each
   overlay class string replace `data-[state=open]:animate-fadein` with
   `data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout`.
4. Append to `app/design-system.test.ts`:

   ```ts
   describe('a scrim leaves with its panel', () => {
     // Every DS overlay faded in and declared nothing for out, so Radix unmounted the
     // scrim at once while the panel played its 100ms exit: measured, the New project
     // dialog ghosted over a fully bright page for the whole exit.
     const OVERLAY = /<RDlg\.Overlay\b[^>]*className="([^"]*)"/;

     it('catches the shape it guards (control)', () => {
       const before = '<RDlg.Overlay className="fixed inset-0 data-[state=open]:animate-fadein" />';
       expect(OVERLAY.exec(before)?.[1]).not.toMatch(/data-\[state=closed\]:animate-fadeout/);
     });

     it('every overlay that fades in also fades out', () => {
       const offenders: string[] = [];
       for (const file of FILES.filter((f) => /^components\/ds\/ui\/.*\.tsx$/.test(f))) {
         code(file).forEach((line, i) => {
           const cls = OVERLAY.exec(line)?.[1];
           if (!cls || !/data-\[state=open\]:animate-/.test(cls)) return;
           if (!/data-\[state=closed\]:animate-fadeout\b/.test(cls)) offenders.push(`${file}:${i + 1}`);
         });
       }
       expect(offenders).toEqual([]);
     });
   });
   ```

## Boundaries

- Do NOT change any panel (Content) animation, duration or curve.
- Do NOT touch `components/ds/ui/command-menu.tsx` (plan 002 removes its animations).
- Do NOT touch the app-layer `Modal` in `components/ui/popover.tsx`: it has no exit at all, so
  its scrim and panel already leave together.
- Do NOT add dependencies.
- If a quoted fragment is not found (drift since the commit stamp), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0; `npx vitest run app/design-system.test.ts` passes.
  Remove `data-[state=closed]:animate-fadeout` from `drawer.tsx:66` and confirm the new guard
  FAILS, then restore it.
- **Feel check** (`/dev-preview/overlay-states`, "Open new project"):
  - DevTools → Animations at 10%. Click Cancel. Scrub the exit: in every frame the scrim is
    still there and fading, and it finishes with the panel. No frame shows a ghosted dialog
    over an undimmed page.
  - Press Escape instead: with plan 002 applied the dialog and scrim both vanish at once
    (the keyboard drove it); without 002 they fade out together.
  - Toggle `prefers-reduced-motion: reduce`: scrim and panel still fade out together.
- **Done when**: 25% into the dialog's exit, the overlay is still mounted and its computed
  `opacity` is below 1.
