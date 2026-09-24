# 003 — Anchored surfaces grow from their trigger

- **Status**: DONE 2026-09-17
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-16)
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 2 keyframes, 8 DS class strings, 7 hand-rolled panels, 1 guard block. Every menu, select, popover, combobox, hover card and tooltip in the app.
- **Depends on**: none. Apply after 002 if both are in flight: 002 adds `zb-enter` to some of the same class strings, and the replacements below are written to work either way.

## Problem

Emil Kowalski: popovers "should scale in from their trigger, not from center." Two things
break that here.

**1. The precise origin Radix computes is overridden or never used.** Radix publishes the
exact point each surface should grow from (the trigger corner, including alignment and
collision flips) as a CSS variable. The dropdown menu reads it, then loses it to four
side-based classes on the SAME element, whose attribute selector is more specific:

```tsx
// components/ds/ui/dropdown-menu.tsx:62 (and :272, the sub-menu) — current
"z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto p-1 data-[state=open]:animate-emerge data-[state=closed]:animate-exit data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left",
```

The others never read it:

```tsx
// components/ds/ui/popover.tsx:39, hover-card.tsx:46, tooltip.tsx:61 — current
"data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left",
// components/ds/ui/select.tsx:87 and combobox.tsx:235 — current (hard-coded, ignores flips)
"data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top",
// components/ds/ui/filter.tsx:99 — current
"data-[state=open]:animate-emerge data-[state=closed]:animate-exit origin-top-left",
```

**2. The entrance moves the wrong way for most menus.** `emerge` and `zb-pop-in` rise 4px
whatever side the surface opens on. A menu BELOW its trigger (the common case) therefore
starts 4px further away and travels up toward the trigger, against its own origin:

```css
/* app/ds-theme.css:237 — current */
@keyframes emerge { from { opacity: 0; transform: translateY(4px) scale(0.96); } }
/* app/globals.css:664 — current */
@keyframes zb-pop-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
```

Measured on `/dev-preview/overlay-states` (animations at 10%, paused and scrubbed):

| Surface | Radix origin | Computed `transform-origin` | Frame 0 → end |
| --- | --- | --- | --- |
| DropdownMenu (side bottom, align start) | `0% 0px` | `144px 0px` (top centre) | left edge 341.8 → 336px, top 92 → 88px |
| Select (side bottom, align start) | `0% 0px` | `128px 0px` (top centre) | left edge 341.1 → 336px, top 386 → 382px |

The menu's anchored corner slides sideways across the trigger edge, and the whole panel
lifts toward the trigger instead of dropping out of it.

Hand-rolled panels have the same two faults: `components/ui/picker-panel.tsx:39`,
`components/focus/focus-view.tsx:226` and `:320`, and `components/documents/block-editor.tsx:2735`
open BELOW a trigger on `fade-rise` (a 4px rise, meant for content arriving, not for a panel
leaving its trigger), and `doc-properties.tsx:81`, `tasks-view.tsx:777`, `week-view.tsx:134`,
`week-view.tsx:359` and `components/ui/popover.tsx:34` play `zb-pop-in` from the default centre.

## Target

- An anchored entrance is `opacity: 0; transform: scale(<s>)` growing from the trigger's
  edge, with no translate: `emerge` keeps `scale(0.96)`, `zb-pop-in` keeps `scale(0.98)`.
  Durations and curves stay as they are.
- Every Radix surface takes its own Radix origin variable, and nothing overrides it:

  | Component | Class |
  | --- | --- |
  | DropdownMenu content and sub-content | `origin-(--radix-dropdown-menu-content-transform-origin)` (already there) |
  | Popover | `origin-(--radix-popover-content-transform-origin)` |
  | HoverCard | `origin-(--radix-hover-card-content-transform-origin)` |
  | Tooltip | `origin-(--radix-tooltip-content-transform-origin)` |
  | Select (`position="popper"`) | `origin-(--radix-select-content-transform-origin)` |
  | Combobox and Filter (both Radix Popover content) | `origin-(--radix-popover-content-transform-origin)` |

- A hand-rolled panel sets the corner that faces its trigger. Modals are exempt and stay
  centred (Emil: "modals should keep `transform-origin: center`").

## Repo conventions to follow

- Keyframes and animation tokens: `app/ds-theme.css` (`--animate-emerge: emerge var(--duration-base) var(--ease-out-quiet)`),
  legacy keyframes in `app/globals.css`. Each moving keyframe has an opacity-only twin of the
  same name inside `@media (prefers-reduced-motion: reduce)` in `app/globals.css` — leave the
  twins as they are (they already only fade).
- Tailwind v4 arbitrary-variable syntax for a CSS variable is `origin-(--var-name)`, as
  `dropdown-menu.tsx` already uses. It compiles to `transform-origin: var(--var-name)`.
- Guard tests: `app/design-system.test.ts`, helpers `FILES`, `code(file)` (array of lines,
  comments blanked), must-fail control first.

## Steps

1. `app/ds-theme.css` — replace
   `@keyframes emerge { from { opacity: 0; transform: translateY(4px) scale(0.96); } }` with
   `@keyframes emerge { from { opacity: 0; transform: scale(0.96); } }`.
2. `app/globals.css` — replace
   `@keyframes zb-pop-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }` with
   `@keyframes zb-pop-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: none; } }`,
   and change the comment line above it from
   `/* Popover/dropdown entrance (DS §4.7): fade + 4px rise + 0.98 scale, --duration-base. */` to
   `/* Popover/dropdown entrance: fade + 0.98 scale out of the edge that faces the trigger. No rise - a 4px lift moved every menu below its trigger UP, toward it. */`.
   In `components/ui/popover.tsx:17`, change `entrance per §4.7 (fade + 4px rise +` to
   `entrance per §4.7 (fade +` (the rest of that comment line stays).
3. `components/ds/ui/dropdown-menu.tsx` — in BOTH class strings (content ~line 62, sub-content
   ~line 272) delete the substring
   ` data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left`.
4. `components/ds/ui/popover.tsx`, `hover-card.tsx`, `tooltip.tsx` — replace the whole line
   `"data-[side=bottom]:origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left",`
   with, respectively:
   - `"origin-(--radix-popover-content-transform-origin)",`
   - `"origin-(--radix-hover-card-content-transform-origin)",`
   - `"origin-(--radix-tooltip-content-transform-origin)",`
5. `components/ds/ui/select.tsx` — in the class string holding `animate-emerge`, replace
   ` origin-top"` with ` origin-(--radix-select-content-transform-origin)"`. Confirm the
   `RSel.Content` still has `position="popper"` (the variable only exists in popper mode); if
   it does not, STOP and report.
6. `components/ds/ui/combobox.tsx` — in the class string holding `animate-emerge`, replace
   ` origin-top"` with ` origin-(--radix-popover-content-transform-origin)"`. Confirm the
   element is rendered through `RP.Content asChild` (Radix Popover); if not, STOP and report.
7. `components/ds/ui/filter.tsx` — in the class string holding `animate-emerge`, replace
   ` origin-top-left"` with ` origin-(--radix-popover-content-transform-origin)"`.
8. Hand-rolled panels:
   - `components/ui/picker-panel.tsx:39` — in the `style` object replace
     `animation: 'fade-rise var(--duration-fast) var(--ease-out-quiet)'` with
     `` animation: 'zb-pop-in var(--duration-fast) var(--ease-out-quiet)', transformOrigin: `top ${align}` ``
     (`align` is the component's existing `'left' | 'right'` prop that already positions it).
   - `components/focus/focus-view.tsx:226` and `:320` — in each `style` object replace
     `animation: 'fade-rise var(--duration-fast) var(--ease-out-quiet)'` with
     `animation: 'zb-pop-in var(--duration-fast) var(--ease-out-quiet)', transformOrigin: 'top right'`
     (both are `top: calc(100% + 4px); right: 0`).
   - `components/documents/block-editor.tsx:2735` — replace
     `[animation:fade-rise_var(--duration-fast)_var(--ease-out-quiet)]` with
     `origin-top-left [animation:zb-pop-in_var(--duration-fast)_var(--ease-out-quiet)]`
     (the panel is `absolute left-0 top-[calc(100%+4px)]`).
   - `components/documents/doc-properties.tsx:81` — in `PANEL`, insert `origin-top-left ` before
     `[animation:zb-pop-in_` (the panel is `absolute left-0 top-[calc(100%+4px)]`).
   - `components/tasks/tasks-view.tsx:777` — in the keyboard menu's `cn(MENU_PANEL_CLASS, '…')`,
     append ` origin-top-left` to the second string (it is placed at `rect.bottom + 4`, `rect.left + 28`).
   - `components/week/week-view.tsx:359` (card menu, placed at `r.bottom + 4` and right-aligned
     to `r.right - 180`) — add `transformOrigin: 'top right',` to its `style` object.
   - `components/week/week-view.tsx:120-127` (chip popover): it opens above the chip when there
     is no room below. Change `setPos({ top, left: Math.max(8, left) });` to
     `setPos({ top, left: Math.max(8, left), above: top < r.top });`, widen the `pos` state type
     to include `above: boolean` (find its `useState` declaration in the same component), and add
     `transformOrigin: pos.above ? 'bottom left' : 'top left',` to the panel's `style` object at line 134.
   - `components/ui/popover.tsx:34` — insert `'origin-top',` on the line before
     `'animate-[zb-pop-in_var(--duration-base)_var(--ease-out-quiet)]',` (its one caller,
     `components/ui/select.tsx`, opens it below a full-width field).
   - Leave `components/task-detail/chip-ui.tsx:116` alone: it already sets `transformOrigin: 'top left'`.
   - Leave `components/calendar/event-composer.tsx:132` alone: it is placed beside a calendar
     slot rather than hanging from a trigger edge, so a centred scale is correct.
9. Append to `app/design-system.test.ts`:

   ```ts
   describe('an anchored surface grows from its trigger', () => {
     // Emil Kowalski: popovers scale in from their trigger, never from centre (modals
     // exempt). Measured before: the dropdown's own Radix origin (0% 0px) lost to
     // `data-[side=bottom]:origin-top`, so its anchored corner slid 5.8px across the
     // trigger, and `emerge`'s 4px rise lifted every menu below a trigger UP toward it.
     const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
     const frames = (css: string, name: string) =>
       strip(css).match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`))?.[1] ?? '';
     const RADIX: Record<string, string> = {
       'components/ds/ui/dropdown-menu.tsx': '--radix-dropdown-menu-content-transform-origin',
       'components/ds/ui/popover.tsx': '--radix-popover-content-transform-origin',
       'components/ds/ui/hover-card.tsx': '--radix-hover-card-content-transform-origin',
       'components/ds/ui/tooltip.tsx': '--radix-tooltip-content-transform-origin',
       'components/ds/ui/select.tsx': '--radix-select-content-transform-origin',
       'components/ds/ui/combobox.tsx': '--radix-popover-content-transform-origin',
       'components/ds/ui/filter.tsx': '--radix-popover-content-transform-origin',
     };

     it('reads the keyframes it guards (control)', () => {
       expect(frames('@keyframes emerge { from { opacity: 0; transform: translateY(4px) scale(0.96); } }', 'emerge')).toMatch(/translate/);
     });

     it('the anchored entrances scale and fade, and never travel', () => {
       const ds = readFileSync('app/ds-theme.css', 'utf8');
       const globals = readFileSync('app/globals.css', 'utf8').replace(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g, '');
       for (const [src, name] of [[ds, 'emerge'], [globals, 'zb-pop-in']] as const) {
         const body = frames(src, name);
         expect(body, `@keyframes ${name} not found`).not.toBe('');
         expect(body, `${name} travels`).not.toMatch(/translate/);
         expect(body, `${name} lost its scale`).toMatch(/scale\(0\.9\d\)/);
       }
     });

     it('every Radix surface grows from the point Radix computes, and nothing overrides it', () => {
       const offenders: string[] = [];
       for (const [file, v] of Object.entries(RADIX)) {
         const src = code(file).join('\n');
         if (!src.includes(`origin-(${v})`)) offenders.push(`${file}: no origin-(${v})`);
         if (/data-\[side=[a-z]+\]:origin-|\borigin-(?:top|bottom|left|right|center)(?:-(?:left|right))?\b/.test(src)) offenders.push(`${file}: a fixed or side-based origin`);
       }
       expect(offenders).toEqual([]);
     });
   });
   ```

## Boundaries

- Do NOT change durations, curves, the `exit` keyframe, `rise`, or the modal entrances.
- Do NOT change the reduced-motion twins in `app/globals.css`.
- Do NOT change any positioning math except the one `above` flag in `week-view.tsx`.
- Do NOT add dependencies.
- If a quoted fragment is not found (drift since the commit stamp), STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0. `npx vitest run app/design-system.test.ts` passes.
  Put `data-[side=bottom]:origin-top` back into `popover.tsx` and confirm the new guard FAILS,
  then remove it.
- **Feel check** (`/dev-preview/overlay-states`):
  - DevTools → Animations at 10%. Click "Open menu": the menu's top-left corner stays pinned
    under the trigger's bottom-left corner in every frame, and the panel grows down and right
    from there. No frame shows the menu lower than where it ends up.
  - `getComputedStyle(document.querySelector('[data-slot="dropdown-menu-content"]')).transformOrigin`
    equals the element's `--radix-dropdown-menu-content-transform-origin` resolved in pixels
    (`0px 0px` for this menu), not `144px 0px`.
  - Open the Select near the bottom of the viewport (scroll so it must flip upward): it grows
    UP out of the field's top edge.
  - Hover a toolbar button with a tooltip: the tooltip grows out of the edge facing the button.
  - Toggle `prefers-reduced-motion: reduce`: every one of them only fades.
- **Done when**: on `/dev-preview/overlay-states`, frame 0 and the final frame of the
  dropdown's entrance have the same `left` and `top` to within 0.5px, and the computed
  origin equals Radix's value for the Select and the DropdownMenu.
