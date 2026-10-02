# Home's empty highlight state names the action the way its controls do

Written against: 1661561

## Evidence chain

- Surface: `app/(app)/today/page.tsx` → `components/today/today-view.tsx`, the *Today's highlight* panel's
  empty state (rendered when no task is the day's highlight).
- Problem: the empty state's description reads "Star a task to make it today's focus — it surfaces here to
  tackle first." Every control on the same screen that performs this action calls it **highlight**.
- Design evidence:
  - `/Users/rushilshah/Downloads/CLAUDE.md` line 60 — "Glossary (one name per concept)".
  - Same-task copy on the rendered path: panel title "Today’s highlight"; its action button "Remove highlight";
    the greeting line "Highlight: <task>"; the morning prompt "Pick a highlight"; the keyboard shortcut `h`
    (`toggleHl`), all in `components/today/today-view.tsx`.
  - `components/tasks/task-row.tsx` (rendered by Home's plan with `showHighlightToggle`): toggle label
    `'Highlight this task'` / `'Remove highlight'`; menu item `'Highlight'` / `'Remove highlight'`.
  - `components/tasks/task-meta.tsx:112`: `aria-label="Highlighted"`.
  - The highlight is drawn with the `Highlight` glyph; the star now means a favourite doc or a pinned memory
    (`app/identity.test.ts`), so "Star" points at a different concept.
- Owner: `components/today/today-view.tsx`.
- Scope and affected surfaces: that one string, on Home.
- Uncertainty: none.

## Design decision

The action is named **Highlight** everywhere a person can perform it; the empty state uses the same verb.

## Reuse

- The existing verb "Highlight" (`components/tasks/task-row.tsx`, the menu item's label).
- Exemplar: `components/tasks/task-row.tsx` highlight toggle and menu item.

## Changes

1. `components/today/today-view.tsx` — the `<EmptyState size="inline" … title="No highlight yet">` in the
   *Today's highlight* panel.
   - Change: `description` → `"Highlight a task to make it today’s focus — it surfaces here to tackle first."`
   - Preserve: `size="inline"`, the `Highlight` illustration, the title, the one secondary *Browse tasks* action,
     one sentence.
   - Verify: with no highlighted task, the panel reads "Highlight a task to make it today’s focus…".

## Scope

- Inherit: nothing — the string has one consumer.
- Verify: `lib/empty-state-copy.test.ts` (one sentence; inline states carry no character cap).
- Exclude: the star glyph on favourite docs, pinned memories and the rating control — a different concept.

## Validation

- Product: set no highlight; Home's highlight panel names the action "Highlight", as its controls do.
- Interface: the empty panel in light and dark.
- System: no second name for the concept remains on Home — `grep -rn "Star a task" components app` returns nothing.
- Repository: `npx vitest run lib/empty-state-copy.test.ts app/identity.test.ts` → all pass.

## Stop conditions

- Stop if the product decides "star" is the intended user-facing verb — then the controls' labels change
  instead, which is a different plan.

## Design documentation

- None.
