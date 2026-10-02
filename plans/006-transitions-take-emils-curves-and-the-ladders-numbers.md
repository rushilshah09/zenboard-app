# 006 — Transitions take Emil's curves and the ladder's numbers

- **Status**: DONE 2026-09-17 (also: 4 Tailwind numeric durations and 8 style helpers on buttons found by the corrected guards; audit-surfaces now checks curves per property)
- **Commit**: 80502d8 (working tree has uncommitted changes; excerpts below are from the working tree on 2026-09-17)
- **Severity**: MEDIUM
- **Category**: Easing & duration, Cohesion & tokens
- **Estimated scope**: 1 token (two files) + 2 Tailwind theme defaults, ~31 inline style strings in 12 files, 6 CSS rules, 11 raw-ms transitions, 13 movement classes, 4 DS class strings, 4 guard blocks, 2 existing guards amended

## Problem

Five separate faults, one root: transitions that do not come from the motion vocabulary Emil
Kowalski's skill prescribes.

**1. Colour changes run on the wrong curve.** Emil's decision tree: entering or exiting →
ease-out; moving on screen → ease-in-out; **hover or colour change → `ease`**. The house curve for
colour is the strong ease-out `--ease-out-quiet` (`cubic-bezier(0.23, 1, 0.32, 1)`), which puts
97% of a 100ms wash in its first 50ms; `app/globals.css` (`.zb-nav-item`, `.zb-press`,
`.zb-press::after`, the global button rule), `app/ds-theme.css` (`row-hover`, `composer-shell`,
`reveal-on-hover`) and 31 inline `transition:` strings in 12 components all say
`<colour property> var(--duration-*) var(--ease-out-quiet)`. `components/ds/ui/button.tsx:17` and
`components/ds/ui/switch.tsx:27` put colour on `ease-standard` (the in-out movement curve).

**2. Tailwind's own default leaks through.** A `transition-colors` with no `ease-*` / `duration-*`
class computes Tailwind's `cubic-bezier(0.4, 0, 0.2, 1)` over 150ms. Measured live: 12 of 52
transitioning elements on `/dev-preview/tasks`, 6 of 40 on `/dev-preview/clients`. So colour
changes currently run on three different curves.

**3. Raw milliseconds escape the ladder.** The guard "an animation takes its numbers from the
ladder" reads `animation:` only. Eleven `transition:` strings spell their own:

| Location | Current |
| --- | --- |
| `components/documents/block-editor.tsx:1801` | `transform 140ms var(--ease-standard)` |
| `components/documents/documents-view.tsx:1967` | `transform 160ms var(--ease-out-quiet), background 160ms var(--ease-out-quiet)` |
| `components/memory/memory-home.tsx:106` | `transform 140ms var(--ease-standard)` |
| `components/portal/portal-document.tsx:313` | `width 300ms` (plan 007 replaces it) |
| `components/shell/app-shell.tsx:316` | `transform 160ms` |
| `components/shell/quick-capture.tsx:165` | `color 120ms` |
| `components/shell/quick-capture.tsx:169` | `background 120ms, color 120ms` |
| `components/week/week-view.tsx:319` | `border-color 140ms, box-shadow 140ms` |
| `components/week/week-view.tsx:352` | `opacity 120ms` |
| `components/week/week-view.tsx:476`, `:495` | `background 120ms, outline-color 120ms` |

**4. Movement with no curve.** 13 `transition-transform` / `transition-[left|width]` classes name
no easing (chevron rotations in `calendar-sidebar.tsx:30`, `accordion.tsx:27`, `combobox.tsx:212`,
`select.tsx:74`, `habits-board.tsx:249`, `pinned-rail.tsx:193`, `completed-section.tsx:49`,
`tasks-rail.tsx:91`; `tasks-rail.tsx:285`; `slider.tsx:85`; the three width/left sites plan 007 owns).

**5. The press and the utilities fight on buttons.** The global rule
`button:not(.zb-nopress), [role="button"]:not(.zb-nopress) { transition: transform …, background-color …, color …, border-color …, box-shadow … }`
is unlayered, so it beats every Tailwind `transition-*` utility (those live in `@layer utilities`)
on a button. Measured: the pinned rail's reorder buttons lose `transition-opacity` (their hover
reveal snaps), the calendar's event chips lose `transition-[filter]`, and the DS Switch's
`duration-base` track colour computes 100ms while its thumb (a child span) moves over 150ms, so the
two land at different moments. The other way round, an inline `transition` on a `<button>` beats
the global rule and drops `transform`, so the press snaps: `focus-view.tsx:358`,
`ritual-flow.tsx:83`, `task-detail-drawer.tsx:107` and `:385`. Three inline strings say
`transition: all` (`ritual-flow.tsx:444`, `task-detail-drawer.tsx:102`, `:395`).

## Target

- One new curve token, `--ease-hover: cubic-bezier(0.25, 0.1, 0.25, 1)` — exactly CSS `ease`, spelled
  out so every curve in the vocabulary reads and parses the same way. Used by every hover and colour
  change (color, background, background-color, border-color, outline-color, box-shadow, fill, stroke,
  filter, and opacity when it reveals on hover or reflects a state).
- Tailwind's defaults are the house's: `--default-transition-duration: var(--duration-fast)` and
  `--default-transition-timing-function: var(--ease-hover)`.
- Movement on screen (a chevron turning, a thumb sliding) names `ease-standard`
  (`cubic-bezier(0.77, 0, 0.175, 1)`, Emil's ease-in-out). A hover scale names `ease-hover`.
- Every transition duration is a rung: `--duration-instant|fast|base|slow` (20/100/150/200ms).
  120ms → `--duration-fast`; 140ms and 160ms → `--duration-base`.
- The global press rule also carries `opacity` and `filter`, on the hover curve; the press itself
  stays `transform var(--duration-fast) var(--ease-out-quiet)` (Emil: press 100–160ms, ease-out).
- An inline `transition` on a `<button>` includes `transform var(--duration-fast) var(--ease-out-quiet)`.
- No `transition: all`: name the properties.
- DS Switch: track colour and thumb both `--duration-fast` so they land together.

## Repo conventions to follow

- Curves live in both `app/tokens.css` (`:root`) and `app/ds-theme.css` (`@theme`, which generates
  the `ease-*` utilities), side by side with `--ease-out-quiet`, `--ease-standard`, `--ease-drawer`.
- Guards: `app/design-system.test.ts`, helpers `FILES`, `code(file)` (array of lines, comments
  blanked); a must-fail control first.

## Steps

1. Tokens. In `app/tokens.css` after `--ease-drawer:     cubic-bezier(0.32, 0.72, 0, 1);` add
   `--ease-hover:      cubic-bezier(0.25, 0.1, 0.25, 1);` with a one-line comment
   `/* CSS \`ease\`: hover and colour changes (Emil's decision tree). */`. In `app/ds-theme.css` after
   `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);` add the same token, then
   `--default-transition-duration: var(--duration-fast);` and
   `--default-transition-timing-function: var(--ease-hover);` with a comment saying Tailwind's own
   defaults (150ms, `cubic-bezier(0.4, 0, 0.2, 1)`) were leaking into every unnamed transition.
2. CSS rules — replace `var(--ease-out-quiet)` with `var(--ease-hover)` ONLY after a colour property:
   - `app/globals.css` `.zb-nav-item` (both entries), `.zb-press` (`box-shadow`, `background`,
     `border-color`, `color`; leave `transform`), `.zb-press::after` (`background`).
   - The global button rule becomes:
     ```css
     transition: transform var(--duration-fast) var(--ease-out-quiet),
                 background-color var(--duration-fast) var(--ease-hover),
                 color var(--duration-fast) var(--ease-hover),
                 border-color var(--duration-fast) var(--ease-hover),
                 box-shadow var(--duration-fast) var(--ease-hover),
                 opacity var(--duration-fast) var(--ease-hover),
                 filter var(--duration-fast) var(--ease-hover);
     ```
     Extend its comment: the rule is unlayered and beats Tailwind's layered utilities, so it carries
     `opacity` and `filter` too (hover reveals and chip brightness were snapping).
   - `app/ds-theme.css` `row-hover` (`background-color`), `composer-shell` (`box-shadow`),
     `reveal-on-hover` (`opacity`).
3. Inline styles — in each string below replace `var(--ease-out-quiet)` after a colour/opacity
   property with `var(--ease-hover)`; leave any `transform` entry on its curve:
   `documents-view.tsx:1344,1347,1350,1356,1511,1531,1967` · `focus-timer.tsx:218,236,256,284,658,731,744,748,878` ·
   `focus-view.tsx:358` · `ritual-flow.tsx:82,83,90,408,465` · `app-shell.tsx:118,243` (only `box-shadow` at 243;
   `width`/`min-width` stay) · `pinned-rail.tsx:116` · `chip-ui.tsx:186` · `task-detail-drawer.tsx:96,107,385` ·
   `emoji-picker.tsx:194` · `upload-zone.tsx:20`. Before changing an `opacity` entry, confirm it
   reveals on hover or reflects a state (not an element arriving); if it is an arrival, leave it and
   note it.
4. Raw ms (table above): `120ms` → `var(--duration-fast)`, `140ms`/`160ms` → `var(--duration-base)`;
   add the curve: colour/opacity/outline → `var(--ease-hover)`, `transform` → `var(--ease-standard)`.
   `app-shell.tsx:316` becomes `transform var(--duration-base) var(--ease-standard)`.
   `documents-view.tsx:1967` becomes `transform var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-hover)`.
   Skip `portal-document.tsx:313` (plan 007).
5. Buttons: `focus-view.tsx:358`, `ritual-flow.tsx:83`, `task-detail-drawer.tsx:107`, `:385` — append
   `, transform var(--duration-fast) var(--ease-out-quiet)` to the inline string.
   `ritual-flow.tsx:444`, `task-detail-drawer.tsx:102`, `:395` — replace
   `all var(--duration-fast) var(--ease-out-quiet)` with
   `background-color var(--duration-fast) var(--ease-hover), border-color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)`.
6. Movement classes: add `ease-standard` beside `transition-transform` in `calendar-sidebar.tsx:30`,
   `accordion.tsx:27`, `combobox.tsx:212`, `select.tsx:74`, `habits-board.tsx:249`, `pinned-rail.tsx:193`,
   `completed-section.tsx:49`, `tasks-rail.tsx:91`. Read `tasks-rail.tsx:285` first: if what transforms
   is a hover/press scale use `ease-hover`, otherwise `ease-standard`. `slider.tsx:85` (hover scale) → `ease-hover`.
7. DS classes: `button.tsx:17` `ease-standard` → `ease-hover` (keeps an `asChild` link right; on a real
   button the global rule governs). `switch.tsx:27` `duration-base ease-standard` → `duration-fast ease-hover`;
   `switch.tsx:57` thumb `duration-base` → `duration-fast`.
8. Guards — append to `app/design-system.test.ts` a `describe('transitions take Emil\'s curves and the ladder\'s numbers', …)` with:
   - control: the colour-on-quiet-curve regex matches `background var(--duration-fast) var(--ease-out-quiet)` and not `transform var(--duration-fast) var(--ease-out-quiet)`;
   - "a colour change takes the hover curve": no `(?:color|background(?:-color)?|border-color|outline-color|box-shadow|fill|stroke|filter|opacity) var\(--duration-[a-z]+\) var\(--ease-(?:out-quiet|standard|drawer)\)` in `app/globals.css`, `app/ds-theme.css`, or any TSX `code(file)` line, and no TSX line pairing `transition-(?:colors|shadow)` with `ease-(?:out-quiet|standard|drawer)`;
   - "Tailwind's defaults are the house's": `app/ds-theme.css` contains both default lines from step 1;
   - "no transition spells raw milliseconds": no `transition:` string (CSS or TSX) with a number followed by `ms`/`s` outside `var(…)`, and no Tailwind `duration-\d` / `duration-\[` class;
   - "movement names its curve": every TSX line with `transition-transform` or `transition-\[[^\]]*(?:transform|translate|scale|rotate|left|width)` also has an `ease-` class;
   - "an inline transition on a button keeps the press": every TSX line with `<button` and an inline `transition:` string includes `transform`, and no line anywhere says `transition: 'all` / `transition: all`.
   Amend the existing guards: `one easing vocabulary › reads the vocabulary it guards (control)` expects
   `['--ease-drawer', '--ease-hover', '--ease-out-quiet', '--ease-standard']`;
   `the global press does not eat the hover` checks `opacity` and `filter` too, and its curve test expects
   `transform var(--duration-fast) var(--ease-out-quiet)` and `background-color var(--duration-fast) var(--ease-hover)`.
9. `/Users/rushilshah/Downloads/CLAUDE.md`, Interaction section: add `--ease-hover` (hover and colour,
   Emil's `ease`) to the curve list, and change "`--ease-out-quiet` (arrivals, departures, colour)" to
   "`--ease-out-quiet` (arrivals, departures, the press)".

## Boundaries

- Do NOT change `--animate-*` tokens, keyframes, or any arrival/departure curve.
- Do NOT touch the segmented control's thumb (`segmented.tsx`): its curve is a documented decision
  (design-system.md §4.19).
- Do NOT touch `components/ds/ui/progress.tsx:152` (`stroke-dashoffset` on `ease-standard` is movement, correct).
- Do NOT add dependencies. If a quoted fragment is not found, STOP and report.

## Verification

- **Mechanical**: `npx tsc --noEmit` exits 0; `npx vitest run` passes. Revert one inline string to
  `var(--ease-out-quiet)` on a colour and confirm the new guard FAILS naming it.
- **Live**: on `/dev-preview/tasks`, `/dev-preview/clients` and `/dev-preview/documents`, tally every
  element's computed `transition-timing-function` per property: no `cubic-bezier(0.4, 0, 0.2, 1)`;
  colour properties read `cubic-bezier(0.25, 0.1, 0.25, 1)`; `transform` on buttons reads
  `cubic-bezier(0.23, 1, 0.32, 1)`. On `/dev-preview/shell` the pinned rail's reorder buttons compute
  a `transition-property` that includes `opacity`.
- **Feel check**: sweep the mouse down a list of rows at 10% playback — each wash eases in and out
  evenly instead of snapping on; toggle a DS Switch at 10% — the track colour and the thumb arrive on
  the same frame; press and hold a button — it still scales in 100ms with no bounce.
- **Done when**: the live tally shows exactly three curves in use for transitions (hover, quiet,
  standard/drawer where they move) and the guards pass.
