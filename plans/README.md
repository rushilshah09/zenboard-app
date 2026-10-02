# Animation plans

Written by the `improve-animations` audit on 2026-09-16/17, against Emil Kowalski's
animation philosophy — the project's source of truth for motion (root `CLAUDE.md`,
Interaction). Each plan is self-contained: exact files, current code, target values,
steps, boundaries and a feel check.

Measured with `scripts/verify/slow-motion.mjs`, which slows every animation to 10%, then
pauses and seeks each one frame by frame. Its checks fail on the code as audited
(baseline 2026-09-17: toolbar, dropdown, select, keyKey, slash, dialogExit, navDrawer FAIL;
the pointer control passes).

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [The selection toolbar positions itself with `translate`, not `transform`](001-selection-toolbar-positions-with-translate.md) | HIGH | DONE 2026-09-17 |
| 002 | [What a keyboard opens appears instantly](002-keyboard-opens-instantly.md) | HIGH | DONE 2026-09-17 |
| 003 | [Anchored surfaces grow from their trigger](003-anchored-surfaces-grow-from-their-trigger.md) | MEDIUM | DONE 2026-09-17 |
| 004 | [A scrim leaves with its panel](004-scrims-leave-with-their-panels.md) | MEDIUM | DONE 2026-09-17 |
| 005 | [The phone navigation drawer enters from the edge it lives on, and leaves](005-phone-nav-drawer-enters-from-its-edge.md) | HIGH | DONE 2026-09-17 |
| 006 | [Transitions take Emil's curves and the ladder's numbers](006-transitions-take-emils-curves-and-the-ladders-numbers.md) | MEDIUM | DONE 2026-09-17 |
| 007 | [Progress fills and switch thumbs move with transform](007-fills-and-thumbs-move-with-transform.md) | LOW | DONE 2026-09-17 |
| 008 | [An icon that changes state cross-fades instead of blinking](008-icon-swaps-cross-fade.md) | LOW | DONE 2026-09-17 |

## Execution order

001 → 003 → 004 → 002 → 005 → 006 → 007 → 008

- **001** stands alone and is the cheapest high-severity fix.
- **003** and **004** edit the same DS class strings that **002** marks with `zb-enter`; doing
  them first keeps each diff about one thing (002's replacements work either way).
- **005** needs `zb-enter` / `lastInput()` from 002 and `--animate-fadeout` from 004.
- **006** changes the curve vocabulary every other plan's transitions sit on; it goes after the
  structural fixes so the sweep sees the final class strings.
- **007** relies on 006's movement-curve rule; **008** relies on 002's `lastInput()`.

## Recorded, not planned

- ~~**Desktop sidebar collapse**: the labels disappear on frame 0 and the icons then slide ~93px
  left while the box narrows.~~ Shipped 2026-09-17 (PROGRESS "The sidebar collapses in place"):
  one geometry for both states, `components/shell/rail-motion.ts`.
- **Segmented thumb curve** (`segmented.tsx`): ease-out rather than Emil's in-out for on-screen
  movement. Documented decision (design-system.md §4.19); respected.
- **Rows a key removes** still collapse (`EXIT_ROW`) and their neighbours still glide (`Move`):
  kept on purpose for spatial continuity; 002 only removes key-driven entrances.
