# Product polish — the whole app, one system (2026-09-22)

The user's brief: Zenboard feels "immature, inconsistent, and somewhat like an AI-generated application". Use
`emil-design-eng` and `better-ui` throughout; make it calm, mature and cohesive; fix surrounding UX while there.

**Method.** Every `/dev-preview` harness captured at 1440×900 in light and dark
(`scripts/verify/capture-surfaces.mjs`), read side by side, so each screen is judged against its neighbours rather
than against memory. Findings are grouped by the principle they break and ranked by how often a person meets them —
a task row is seen a hundred times a day, an onboarding card once.

**Rulings carried in** (see memory `zenboard-design-skills-vetted`): where the two skills disagree on MOTION, Emil
wins (press 0.97/0.98, colour on `ease`). Where better-ui disagrees with a house rule on SURFACES (shadow rings vs
bordered cards, stroke by weight vs the two-weight icon table), the house rule wins.

## What the audit found

### One object, drawn five ways — the task

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `components/tasks/tasks-view.tsx:965` (`Row`) vs `components/tasks/task-row.tsx` (`TaskRow`) | Two task rows: Home and project tabs draw one line at 36px; the Tasks page draws title + meta line, 61px or 82px depending on whether a chip exists | One `TaskRow`, one height, meta trailing | The same task looks like two different things on Home and on Tasks; the Inbox steps 61/82/61 so the list has no rhythm |
| HIGH | `components/week/week-view.tsx:222`, `components/focus/focus-view.tsx:387` | Round checkboxes (priority-coloured ring on the week board, hairline circles for "Up next") | The square DS `Checkbox` | CLAUDE.md: "Tasks are never radio circles"; a circle reads as a radio choice |
| HIGH | `task-row.tsx:192` (bars + coloured word), `tasks-view.tsx:991` (grey chip), `focus-view.tsx:288` (flag), `week-view.tsx:127` (3px tick, label hidden when narrow) | Four priority glyphs | One: `PriorityBadge` | A person learns a mark once; four marks for one fact is four things to learn |
| MEDIUM | `task-row.tsx:163` (dot), `tasks-view.tsx:993` (filled folder), `week-view.tsx:155` (rounded square) | Three project marks | One | Same |
| MEDIUM | `components/ui/quick-add-row.tsx:13`, `week-view.tsx:324`, `focus-view` "Add subtask" (⊞), Home "Add to today — try…" | Four add affordances; the Tasks one is a 48px grey slab reading "Add Task" (title case) | The DS `AddLine` everywhere a list grows | One act, one control; sentence case is a house rule |

### Sections boxed like a dashboard — Home

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| ~~HIGH~~ | `components/today/today-view.tsx` | Every section is a card with a grey header band and an icon | ~~Plain section headings~~ — **overruled by the user**: the cards stay; rows inside them are made one height | The user values the structure the cards give a sparse day ("looks so bad and empty" without them) |
| ~~MEDIUM~~ | same | The highlight is named three times: in the greeting sentence, in its own card, and as the first starred row of the plan | ~~Once~~ — **overruled with the cards**: the plan stays the whole day | The user wants the full list back |

### Legacy surfaces the design system never reached — Week board

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `components/week/week-view.tsx` | Hand-rolled popovers (`ChipPop`), menu, date picker; inline styles on legacy tokens | DS `DropdownMenu` / `Popover` / `DatePicker` | CLAUDE.md: never hand-roll a dropdown or popover; they also miss the house focus, origin and keyboard rules |
| HIGH | `week-view.tsx:378` | Today's column filled grey (a large tinted surface) | A marker on the header, the column left alone | The chroma/area rule: tint the smallest thing that says it |
| MEDIUM | `week-view.tsx:854`, `:269` | "TODAY", "MOVE TO" — uppercase, tracked | Sentence case | House rule; the sentence-case guard does not see literal capitals |
| MEDIUM | `week-view.tsx:876` | Empty days say "Open." or "Rest." | Nothing, or a plain line | "No slogans, no poetry in UI copy" |

### Copy and casing that slipped past the guards

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `components/rituals/*` | "DAILY PLANNING"; "A calm start." / "Three minutes to shape the day before it shapes you."; a step 1 that is only a Begin button | Sentence case, plain copy, start on the first real step | Slogans and a gate that asks for a click and gives nothing |
| LOW | `forms/share-view.tsx:121,140`, `forms/insights-view.tsx:134`, four `sectionLabel` copies | `text-overline tracking-[0.04em]`, `tracking-[0.02em]` | `text-overline` as defined | The tracking existed only to keep capitals legible (CLAUDE.md, reversed 2026-09-08) |

### Filled cards on the canvas

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `components/horizon/horizon-view.tsx` | Goal cards filled grey on a grey page; a ring AND a bar for one percentage | White bordered card; one progress mark | "Never a darker fill on the canvas"; one fact, one mark |
| MEDIUM | `components/portal/portal-document.tsx` | Grey-filled stat and review cards at a larger radius than the app's; two filled buttons in one view | The app's card; one primary | The client sees a different product from the one the studio uses |

### Smaller, recorded

- Docs gallery: titles cut at ~16 characters in 215px cards that are mostly empty preview (`documents-view`).
- App header: a divider between every icon button (search · shutdown · bell · timer) — fussy for four controls.
- Focus: checked subtasks fill with the accent while every other checked box is ink.

## Order of work

Each is one sprint under SPRINT_RULES — finished, verified in the browser, PROGRESS entry — before the next starts.

1. **The task, drawn one way** — one `TaskRow` (Tasks page adopts it), one checkbox, one priority mark, one project
   mark, one add line. Home, Tasks, project tabs, portal, board cards, Focus's up-next.
2. **Home** — ~~sections by type, the highlight said once~~ REVISED by the user the same day: keep the cards
   ("I really like that card old Home screen"), improve inside them — one row height, TaskMeta, a truthful compact
   schedule, Completed inside the plan's card, empty cards that keep a body.
3. **The Week board on the design system** — DS menus/popovers/date picker, square checkbox, the shared meta, no
   tinted column, sentence case, no poetry.
4. **Copy and casing guard** — literal capitals and tracked labels caught by the guard, Rituals copy.
5. **Goals and the portal on the house card.** ✅ — one 16px progress glyph, DS menu/select/date, saves that revert
   when refused; the portal's cards are the app's card with two filled buttons (the form submits). Found on the way:
   `cn()` dropped every theme type size beside a colour (`lib/cn.ts`).
6. **Docs gallery cards; header controls.**
