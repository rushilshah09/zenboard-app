# 005 — The phone navigation drawer enters from the edge it lives on, and leaves

- **Status**: DONE 2026-09-17 (scrim and drawer made siblings: as a child the drawer inherited the scrim fade and went see-through, measured 0 → 0.775 → 1). Later the same day the drawer became a Radix Dialog (Escape, focus trap, focus return), which replaced the closing state and timer floor described below.
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-17)
- **Severity**: HIGH
- **Category**: Physicality & origin (spatial consistency), Easing
- **Estimated scope**: 1 component block, 2 animation tokens + 2 keyframes + 2 reduced-motion twins, 1 guard block
- **Depends on**: 002 (`zb-enter`, `lastInput()`), 004 (`--animate-fadeout`)

## Problem

On a phone, the sidebar opens as a drawer pinned to the LEFT edge (`left: 8`), but its entrance
keyframe starts it one width to the RIGHT, so it appears over the middle of the page and slides
left into place. It enters on the arrivals curve instead of the drawer curve, the scrim cuts in,
and closing unmounts everything in one frame.

```tsx
// components/shell/app-shell.tsx:683-689 — current
{isMobile && !focusMode && drawer && (
  <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 8, bottom: 8, left: 8, animation: 'slideIn var(--duration-slow) var(--ease-out-quiet)' }}>
      <Sidebar name={name} email={email} spaces={spaces} pins={pins} current={current} activeSpaceId={activeSpaceId} onNavigate={() => setDrawer(false)} />
    </div>
  </div>
)}
```
```css
/* app/globals.css:661 — current */
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
```

Measured on `/dev-preview/shell` at 390×844 (`scripts/verify/slow-motion.mjs navDrawer`): the
drawer's left edge is at 238px at frame 0, 59.7px at 25%, 15.8px at 50%, and 8px at the end.

## Target

Emil Kowalski: drawers use the iOS drawer curve, enter from the edge they belong to, and leave
faster than they arrive.

- Enter: `transform: translateX(calc(-100% - 8px))` → `none`, `--duration-slow` (200ms),
  `--ease-drawer` = `cubic-bezier(0.32, 0.72, 0, 1)`.
- Leave: `none` → `translateX(calc(-100% - 8px))`, `--duration-fast` (100ms), `--ease-drawer`.
- Scrim: `--animate-fadein` in, `--animate-fadeout` out.
- A key that closes it (Escape handled elsewhere, or a keyboard-driven navigation) closes it at once.
- Reduced motion: both keyframes fade only (twins).

## Repo conventions to follow

- Right-edge drawers already have tokens in `app/ds-theme.css`:
  `--animate-slide-in-right: slide-in-right var(--duration-slow) var(--ease-drawer);` and
  `--animate-slide-out-right: slide-out-right var(--duration-fast) var(--ease-drawer);` with
  `@keyframes slide-in-right { from { transform: translateX(100%); } }`. Mirror them.
- Every moving keyframe has an opacity-only twin of the same name inside
  `@media (prefers-reduced-motion: reduce)` in `app/globals.css` (guarded).
- A component that must stay mounted while it leaves: `components/ds/ui/toast.tsx` keeps a
  `leaving` state and removes on the element's own animation/transition end with a timer floor.

## Steps

1. `app/ds-theme.css`: after the `--animate-slide-out-bottom` token add
   `--animate-slide-in-left: slide-in-left var(--duration-slow) var(--ease-drawer);` and
   `--animate-slide-out-left: slide-out-left var(--duration-fast) var(--ease-drawer);`; after
   `@keyframes slide-out-bottom` add
   `@keyframes slide-in-left { from { transform: translateX(calc(-100% - 8px)); } }` and
   `@keyframes slide-out-left { to { transform: translateX(calc(-100% - 8px)); } }`
   (the 8px is the drawer's own inset, so it starts fully off-screen).
2. `app/globals.css`: in the reduced-motion block add the twins
   `@keyframes slide-in-left { from { opacity: 0; } }` and `@keyframes slide-out-left { to { opacity: 0; } }`.
   Delete `@keyframes slideIn` (and its twin) once step 3 removes its only caller.
3. `components/shell/app-shell.tsx`: replace `const [drawer, setDrawer] = useState(false);` with a
   three-state value and a close that lets the drawer leave:

   ```tsx
   // 'closing' keeps the drawer mounted for its 100ms exit. A key closes it at once:
   // nothing a keyboard does animates (lib/input-modality.ts).
   const [drawer, setDrawerState] = useState<'open' | 'closing' | false>(false);
   const setDrawer = (open: boolean) => setDrawerState((d) => (open ? 'open' : !d ? false : lastInput() === 'keyboard' ? false : 'closing'));
   ```

   Import `lastInput` from `@/lib/input-modality`. Then replace the JSX block with:

   ```tsx
   {isMobile && !focusMode && drawer && (
     <div onClick={() => setDrawer(false)}
       className={cn('zb-enter', drawer === 'closing' ? 'animate-fadeout' : 'animate-fadein')}
       style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)' }}>
       <div onClick={(e) => e.stopPropagation()}
         className={cn('zb-enter', drawer === 'closing' ? 'animate-slide-out-left' : 'animate-slide-in-left')}
         onAnimationEnd={(e) => { if (e.target === e.currentTarget && drawer === 'closing') setDrawerState(false); }}
         style={{ position: 'absolute', top: 8, bottom: 8, left: 8 }}>
         <Sidebar name={name} email={email} spaces={spaces} pins={pins} current={current} activeSpaceId={activeSpaceId} onNavigate={() => setDrawer(false)} />
       </div>
     </div>
   )}
   ```

   `animate-fadeout` ends with the scrim at opacity 1 once the animation is removed, but the
   whole block unmounts on the panel's `animationend`, which is the same 100ms. Add an effect
   floor so a lost `animationend` (a hidden tab, or `animation: none` from the keyboard rule
   racing a pointer close) can never strand it:

   ```tsx
   useEffect(() => {
     if (drawer !== 'closing') return;
     const t = setTimeout(() => setDrawerState(false), 400);
     return () => clearTimeout(t);
   }, [drawer]);
   ```

   Confirm `cn` is imported in `app-shell.tsx` (it uses `@/lib/cn` elsewhere); add the import if not.
   Every other `setDrawer(true)` / `setDrawer(false)` call keeps working through the wrapper.
4. Append to `app/design-system.test.ts`:

   ```ts
   describe('a drawer enters from the edge it lives on', () => {
     // The phone navigation drawer sits on the LEFT edge and entered from the right, across
     // the page (measured: left edge 238px at frame 0, 8px at the end), on the arrivals curve.
     const shell = code('components/shell/app-shell.tsx').join('\n');
     it('the left drawer takes the left-edge keyframes', () => {
       expect(shell).toMatch(/animate-slide-in-left/);
       expect(shell).toMatch(/animate-slide-out-left/);
       expect(shell).not.toMatch(/slideIn/);
     });
     it('every edge keyframe starts off its own edge, on the drawer curve', () => {
       const ds = readFileSync('app/ds-theme.css', 'utf8');
       expect(ds).toMatch(/@keyframes slide-in-left \{ from \{ transform: translateX\(calc\(-100% - 8px\)\); \} \}/);
       for (const side of ['left', 'right', 'bottom']) {
         expect(ds).toMatch(new RegExp(`--animate-slide-in-${side}: slide-in-${side} var\\(--duration-slow\\) var\\(--ease-drawer\\);`));
         expect(ds).toMatch(new RegExp(`--animate-slide-out-${side}: slide-out-${side} var\\(--duration-fast\\) var\\(--ease-drawer\\);`));
       }
     });
   });
   ```

## Boundaries

- Do NOT change the desktop sidebar, `Sidebar`'s internals, `BottomTabs` or `TopBar`.
- Do NOT change right-edge or bottom drawers.
- Do NOT add dependencies. If a quoted fragment is not found, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0; `npx vitest run app/design-system.test.ts` passes.
- **Instrument**: `node --experimental-websocket scripts/verify/slow-motion.mjs http://localhost:3000 <outDir> navDrawer`
  reports `pass` (frame 0 left edge is left of the final 8px).
- **Feel check** (390×844, `/dev-preview/shell`): tap the menu button — the drawer slides in from
  the left edge over 200ms and settles without overshoot; tap the scrim — it slides back out to
  the left in 100ms while the scrim fades; tap a nav item — same exit while the page changes.
  At 10% playback, no frame shows the drawer anywhere right of its resting position.
  With `prefers-reduced-motion: reduce`, it fades in and out in place.
- **Done when**: the instrument passes and the drawer unmounts within 400ms of any close.
