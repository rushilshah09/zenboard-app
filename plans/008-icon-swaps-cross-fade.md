# 008 — An icon that changes state cross-fades instead of blinking

- **Status**: DONE 2026-09-17 (seven sites: the guard found the code block's copy button; leaving icons take the hand through AnimatePresence `custom`, or a key still played the exit)
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-17)
- **Severity**: LOW (missed opportunity)
- **Category**: Missed opportunities — state indication
- **Estimated scope**: 1 seam primitive, 6 call sites, 1 guard block
- **Depends on**: 002 (`lastInput()` in the motion seam)

## Problem

Icons that report a state change swap in one frame, so the change reads as a flicker rather than
as a new state:

| Location | Swap |
| --- | --- |
| `components/forms/share-view.tsx:53` | `copied ? Check : Copy` |
| `components/projects/share-panel.tsx:162` | `copied ? Check : Copy` |
| `components/focus/focus-timer.tsx:663` | `st.running ? Pause : Play` |
| `components/focus/focus-timer.tsx:746` | `st.running ? Pause : Play` |
| `components/focus/focus-view.tsx:232` | `running ? Pause : Play` |
| `components/focus/focus-view.tsx:308` | `running ? Pause : Play` |

Emil Kowalski: a morphing button "shows the state change", and blur masks a crossfade so the eye
sees one object changing rather than two overlapping. The better-ui skill gives the exact values
for a contextual icon: scale `0.25` → `1`, opacity `0` → `1`, blur `4px` → `0px`, spring
`{ type: "spring", duration: 0.3, bounce: 0 }`. They agree, and neither conflicts with house rules.
Each swap here happens a few times a day, which Emil's frequency table allows to animate.

## Target

One seam primitive, `IconSwap`, in `components/ds/ui/motion.tsx`:

```tsx
/** An icon that changes with state: the old one shrinks away as the new one grows in, blurred
 *  through the middle so it reads as one icon changing. Values are better-ui's, and Emil's
 *  blur-masked crossfade. A key did it, or reduced motion is on: it simply changes. */
export function IconSwap({ swapKey, children }: { swapKey: string; children: React.ReactNode }) {
  const still = useReducedMotion();
  const instant = still || lastInput() === 'keyboard';
  return (
    <span className="relative inline-grid place-items-center [&>*]:[grid-area:1/1]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swapKey}
          className="inline-grid place-items-center"
          initial={instant ? false : { opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }}
          animate={{ opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }}
          exit={instant ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }}
          transition={MOTION.swap}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
```

with `swap: { type: 'spring', duration: 0.3, bounce: 0 } satisfies Transition` added to `MOTION`.
Full transform strings, not Motion's `scale` shorthand (Emil: the shorthand runs on the main thread).

## Steps

1. Add `MOTION.swap` and `IconSwap` to `components/ds/ui/motion.tsx` as above, and export `IconSwap`
   from the DS barrel next to `Presence`/`Move` (find where `Presence` is re-exported in
   `components/ds/ui/index.ts` and add `IconSwap` beside it).
2. At each call site wrap the icon: `<IconSwap swapKey={copied ? 'check' : 'copy'}><Icon icon={copied ? Check : Copy} size={16} /></IconSwap>`
   (keys `play`/`pause` for the timer). Keep sizes, `style` and margins on the `Icon`.
3. Guard in `app/design-system.test.ts`: every TSX line matching
   `icon=\{(?:copied|st\.running|running) \? ` sits inside an `IconSwap` within 2 lines.

## Boundaries

- Do NOT animate menu-item icons (`Eye`/`EyeOff` in view menus): the menu closes on select, so the
  swap is never seen.
- Do NOT change button labels, sizes or layout. Do NOT add dependencies.

## Verification

- **Mechanical**: `npx tsc --noEmit`; `npx vitest run app/design-system.test.ts`.
- **Feel check**: click Copy link — Copy shrinks and blurs away as Check grows in, 300ms, no
  overshoot, and the button's width does not change; press Space in focus view — Play/Pause swaps
  instantly (the keyboard drove it); click the play button — it cross-fades. At 10% playback, at no
  frame are both icons fully visible at once. With reduced motion, the icon changes with no movement.
- **Done when**: all six sites use `IconSwap` and the guard passes.
