# Zenboard Interaction Standards

**Status:** governing document. Subordinate to `DESIGN_CONSTITUTION.md` (principles) and
`MASTER_PRODUCT_PLAN.md` (what we build). This file settles *how the same action behaves
everywhere*, so a user who learns one screen has learned them all.

Zenboard is one application made of mini-apps. The risk of that shape is that each module
grows its own dialect. This document is the dictionary.

**Rule zero — the substitution test.** If you can describe an interaction without naming the
module ("delete a thing", "create a thing", "switch a view"), it must be implemented the same
way in every module. Only genuinely module-specific behaviour may differ.

---

## Part 1 — Audit: where we currently disagree with ourselves

Measured against the codebase, not from memory. Counts are files unless stated.

| # | Interaction | What we found | Severity |
|---|---|---|---|
| 1 | **Deleting a thing** | Three patterns coexist: `InlineConfirm` (3 files), delete-immediately (Forms ×3, project docs, database rows), and a `danger` dropdown item that also deletes immediately. Same destructive weight, three different levels of protection. | **High** |
| 2 | **Date display** | `toLocaleDateString` called at **13 sites** for the same "2 Jun" format — **8** use the user's locale, **5** hardcode `'en-US'`. A non-US user sees two date formats on one screen. | **High** |
| 3 | **Overlays** | Two parallel systems: DS `<Modal>` (10 files) and hand-rolled `position: fixed` overlays (13 files). Some of the latter are legitimately not modals (popover, command palette, drawer, quick-capture), but `new-space-modal`, `triage`, `preview-overlay` and `ritual-flow` are modal-shaped and hand-built. | **High** |
| 4 | **Switching sections of a record** | Projects uses underline `<Tabs>`; Clients uses `<SegmentedControl>` for the identical job (switch between sections of the thing you're looking at). | **Medium** |
| 5 | **Primary action sizing** | `variant="primary"` appears at 4 sizes — `sm` ×23 (the de-facto standard), plus `md` ×2, `lg` ×1, `xs` ×1, and ~10 with no size at all (inheriting the default). | **Medium** |
| 6 | **Empty states** | `<EmptyState>` is used in 14 files — good — but **11 files** still hand-roll "No … yet" copy with their own spacing and tone. | **Medium** |
| 7 | **Row actions on hover** | `reveal-on-hover` utility in 8 files; 3 files still hand-roll `opacity-0 group-hover:`. The utility also handles coarse pointers; the hand-rolled version does not, so those actions are **unreachable on touch**. | **Medium** |
| 8 | **Undo** | Only Inbox offers undo after a destructive action. Everywhere else, a delete is final with no safety net. | **Medium** |

### What is already consistent (protect these)

- `<EmptyState>`, `<SegmentedControl>`, `<Button>`, `<Badge>` have real adoption.
- The icon seam (`components/ds/icons.ts`) is genuinely the single import point.
- `recordHref()` is the one record-addressing function; the palette and the Connected panel agree.
- The page header (`--page-header-h`, `--app-header-px`) now aligns with the app header on one axis.
- Colour, spacing and type run on tokens; raw hex is effectively absent from feature code.

---

## Part 1b — Module-by-module review

The table above is cross-cutting (by interaction). This one is per-module, measured
the same way. It answers "which mini-app is drifting furthest?"

| Module | Page header | EmptyState | Destructive | Bespoke overlay | Verdict |
|---|---|---|---|---|---|
| **Home (today)** | ✓ | ✓ 3 | ✓ InlineConfirm ×2 | — | Conformant |
| **Tasks** | ✓ | ✓ 1 | — | 1 | Conformant bar one hand-rolled empty line |
| **Projects** | ✓ | ✓ 3 | ✗ 1 raw delete | 1 | Good, bar one unconfirmed delete |
| **Clients** | ✓ | ✓ 1 | — | — | Conformant |
| **Finance (money)** | ✓ | ✓ 1 | — | — | Conformant |
| **Forms** | ✓ ×2 | ✓ 2 | ✗ **4 raw deletes** | — | Worst destructive record in the app |
| **Documents** | ✓ | ✓ 2 shapes | ✓ confirm + undo | 2 (a lightbox, a row drawer) | Conformant — see the pass below |
| **Inbox** | ✓ | ✓ 1 | — | 1 | Conformant; the only module with Undo |
| **Habits** | ✓ | ✓ 1 | — | — | Conformant |
| **Goals (horizon)** | ✓ | ✓ 1 | — | — | Conformant |
| **Calendar** | ✓ | ✗ 0 | — | 1 (the event composer — a popover, correctly) | Empty states still missing |
| **Settings** | n/a (no page actions) | ✓ 1 | ✓ InlineConfirm | — | Conformant |

**Documents was the outlier and has had its pass** (row updated above). What it
needed, in the order it mattered: a header (it had none, so the shell's floating
••• landed 30px from the module's own ⋮), empty states for all six rail views
(**four of them rendered literally nothing** — a ternary fell through to `null`, so
an empty Draft or folder was a blank grey field), and one feedback channel (a
private 2-second "flash" span, rendered at two different type sizes in two places,
became `toast()`). Its two remaining overlays are legitimate: an image **lightbox**
(already `role="dialog" aria-modal` with a focus/Escape/arrow contract — a card
modal would be wrong for a full-bleed image) and the database **row drawer**, which
wants DS `<Drawer>`, not `<Modal>`. That drawer is the one real leftover: it has a
scrim but no focus trap. Tracked with #6, not part of it.

**Forms and Documents together held 9 of the app's 10 unconfirmed destructive
actions** — that is where data actually got lost, and it is closed (#2).

**Every module now shares the header grammar**, and the shell's floating `•••`
is gone entirely — see §2.12 for what the header rows own and what was removed
from them.

---

## Part 2 — The standards

### 2.1 Creating

| Situation | Pattern |
|---|---|
| One field (a task, a subtask, a note, a habit check) | **Inline composer** in place. Enter commits, Escape cancels and restores. Never a modal. |
| Two or more fields, or a decision (project, invoice, form, client) | **DS `<Modal>`**. Never a hand-rolled overlay. |
| From anywhere | `+ New` in the app header, and `C` for quick capture. |

- The create action is **`<Button variant="primary" size="sm">`**, last in the page header's `actions`. Nothing global sits to the right of it.
- **One filled-accent element per view** (constitution). If the page header has a primary button, the empty state's button is `secondary`.
- Optimistic insert with a `tmp-` id, reconcile on the server response, roll back and toast on failure.

### 2.2 Deleting and other destructive acts — **the biggest gap**

Destructiveness is a property of the action, not of the module.

| Reversible? | Pattern |
|---|---|
| **Recoverable** (archive, move to trash, unlink, remove a chip) | Act immediately. Toast with **Undo**. No confirmation. |
| **Permanent, low stakes** (one row, one label, one filter rule) | **`<InlineConfirm>`** in place. It must state the consequence: "Delete this label? It drops from 12 tasks." |
| **Permanent, high stakes** (a project, a client, a form with responses) | DS `<Modal>` naming what else disappears, confirm button `variant="danger"`. |

Rules:
- **Never delete permanently on a single click.** The Forms and database-row deletes violate this today.
- Never use `window.confirm` — it is unstyled and unbrandable.
- A `danger` dropdown item is a *trigger*, never the act itself; it opens the confirm.
- Deleting the thing you are looking at returns you to the list, never a blank pane.

### 2.2a How it is implemented (shipped)

`<ConfirmModal>` was already correct and almost unused, because wiring it cost
three pieces of state per call site. **`useConfirm()`** (`components/ds/ui/use-confirm.tsx`)
is its imperative face, so a handler stays one readable function:

```tsx
const [confirm, confirmUI] = useConfirm();
if (!(await confirm({ title, body, actionLabel }))) return;
…
return <>{…}{confirmUI}</>;   // render it once, anywhere in the tree
```

It is a hook, not a global host, because the portal and the app shell are
separate trees. Verified at `/dev-preview/confirm`: confirm-through deletes and
toasts, Cancel and Escape resolve `false` and leave the record alone, and the
overlay unmounts cleanly (no `pointer-events: none` left on `body`).

Where each of the ten unguarded deletes landed:

| Act | Verdict | Pattern |
|---|---|---|
| Delete a form (hub + panel) | permanent, cascades to responses | confirm, counting the responses that go with it |
| Delete a response | permanent, someone else's submission | confirm |
| Delete a builder block | editor-scale, Backspace does it too | **Undo toast** — a dialog mid-typing would be worse than the risk |
| Page → Trash | reversible | **Undo toast** (it used to vanish with no feedback at all) |
| Trash → Delete forever | end of the line | confirm |
| Delete a comment | reversible | **Undo toast**, restored to its place in the thread |
| Delete a database row | store already recorded an inverse op | **Undo toast** — ⌘Z worked, nothing ever said so |
| Delete a database property | empties a column in every row | confirm, counting the rows holding a value |
| Delete a doc property | one field, popover-scale | **Undo toast** |
| Delete a project section | permanent, tasks survive | confirm — the reassurance now arrives *before* the decision |

**One `<Toaster>`, in the shell.** 12 components called `toast()`; only 6 mounted
a host, so every toast raised by Forms, Habits, Settings and the doc surfaces —
including Undo offers — rendered nowhere. The host now lives once in
`app-shell.tsx` inside `[data-view-shell]`, and the six per-view mounts are gone.
The store is a module singleton: **a second mount renders every toast twice**, so
views must never add their own.

### 2.3 Editing

- Edit **in place**. Click the value, it becomes an input. Enter commits, Escape reverts, blur commits.
- Autosave on a **800ms debounce**, with a quiet Saving…/Saved indicator. Never a Save button for a single field.
- A form with several fields in a modal keeps an explicit **Save**; it is disabled until dirty.
- Optimistic, with rollback + error toast. Never block the UI on a write.

### 2.4 Navigating and switching

| Job | Component | Where it sits |
|---|---|---|
| **Top level of a module** (Clients / Pipeline / Feedback · form status) | **`<SegmentedControl fit="content">`** | the page header's **left lane** |
| Sections of **one record** you're looking at (Overview / Tasks / Docs …) | **`<Tabs>`** (underline) | above the record's body |
| Alternate LAYOUTS of the same data (List/Week, Grid/List, Month/Quarter/Year) | **`<SegmentedControl>`**, icon-only, first in `actions` | the header's **right lane** |
| Filtering a list by status | `<SegmentedControl>` when ≤4 options, `<Select>` beyond that | the header's left lane |
| Filtering by anything else (a `Filter ⌄` menu) | `<Button size="sm" variant={active ? 'tinted' : 'ghost'}>` as the trigger | the header's **right lane**, before the layout switch |
| Going to a record | `recordHref(type, id)` — never a hand-written path | — |

### The two lanes (revised 2026-07-30)

**Left = where you are. Right = how you're looking at it, then what you can do.**

A filter and a layout switch both belong on the RIGHT, grouped with each other,
before the page's verbs. This reverses the earlier rule ("a filter belongs in the
left lane, never bunched against the primary, or a navigation control starts
reading as a verb"). That rule assumed a scope title in the left cluster. Once the
titles came out — a rail that already highlights the open view makes the header's
copy of it pure noise — the filter was left alone against the far-left edge with
the whole width of the window between it and every other control. Two lonely
clusters, not a balanced row.

A **scope title is duplication whenever a rail is on screen** naming the same
thing: Tasks printed "Completed 31" beside a rail row reading "Completed 31".
Documents already dropped its title unless the rail is hidden; Tasks now has no
title at all.

Rationale: the **depth** decides it, not the wording. Switching the whole module is
the same act on every page, so it gets the same control in the same place — the
header's left lane, where Forms already put it. Underline tabs are reserved for one
level down: the parts of a single record. A user who learns the Forms header has
learned the Clients header.

**A rail that two layouts share must be ONE component.** Tasks drew its rail in
the list view and nothing in the week board, whose own 320px "Inbox" column stood
where the rail had been — so changing layout moved Inbox/Views/Lists and redrew
the page. `components/tasks/tasks-rail.tsx` is now rendered by both, which forces
its selection into the URL (`railHref` / `readRailParams` in
`components/tasks/types.ts`): picking "Today" from the board has to be able to
land you in the list, and component state can't cross a page boundary. Anything
the rail prints (its counts) has to come from ONE query used by both branches —
a board that only loads its own week cannot derive them, and "identical" has to
mean identical. Verify by measuring: same class string, same row y-positions.

**Never put a module switcher in a rail.** The Clients rail is 211px; three options
need ~250px, so the third scrolled out of sight and `hideScrollbar` left no hint it
existed. The header lane has the full panel width and scrolls honestly on a phone.

**And no `title` on a master/detail hub.** The rail highlights the selection and the
detail pane leads with it as an H1; naming it a third time in the header is noise, and
it pushes the switcher off the left edge where every other module starts it. The
switcher is the first thing in the lane — the same first thing as on Forms.

### 2.5 Feedback

- **Toast** for anything that happened away from the user's eye, or that they may want to undo. Bottom-right, one at a time, 4s (8s with an Undo).
- **Inline** for validation — next to the field, never a toast.
- **Never silent** on failure. If a write fails, say so and restore the previous state.
- Success needs no toast when the result is visible on screen. A new row appearing *is* the confirmation.

### 2.6 Empty, loading and error states

- Always `<EmptyState>` — never hand-rolled copy. ≤180px tall, 20px plain icon (no tinted circle), one title line, ≤1 sentence, at most one action.
- Copy names the next action, not the absence: "Log a call, then pull the asks out as feedback" beats "No meetings".
- **No skeletons for fast local reads.** A placeholder that flashes reads as breakage. Skeletons only where a load reliably exceeds ~300ms.
- Errors are honest and recoverable: what failed, and the way back.

### 2.7 Keyboard

- **Escape** closes the top-most layer, one layer per press. **Enter** commits. **⌘K** the palette. **C** capture.
- Every interactive element keeps `focus-visible` ring. Never strip it.
- Row lists follow the §6.3 grammar (`↑ ↓` move, `Enter` open, `Space` toggle).
- Shortcuts are scoped: a widget's keys must not fire while focus is in a text field.

### 2.8 Formatting — one function each

| Value | Rule |
|---|---|
| Dates | **One helper.** Never call `toLocaleDateString` in a component, and **never hardcode `'en-US'`** — it breaks every non-US user. |
| Money | One `usd()`/`money()` helper. |
| Durations | One `fmtDur()`. |
| Numbers in tables, stats, timers | `tabular-nums`, sans. **Mono is for IDs only** (`INV-014`). |
| Enum values | Sentence case at the boundary (`in_progress` → "In progress") — never raw in UI. |
| All UI strings | Sentence case. Glossary: Doc/Documents · Finance · Lists · Shutdown · Goals · Habits. |

### 2.9 Button size, by context

Size follows the container, not the variant. The default (`md`, 32px) is correct
for the most common case, so most call sites should pass no `size` at all.

| Where | Size |
|---|---|
| Modal / dialog footer CTA | **default** (`md`, 32px) — pass no `size` |
| Page header, toolbar, section header action | `sm` (28px) — it has to sit inside a 48px header row |
| Inside a popover, beside a `sm` input | `sm` — match the control next to it, or the row is ragged |
| Dense card or row action | `xs` (24px) — and match the siblings in that row |
| The single submit of a public page (a form a client fills in) | `lg` — it is the only action on the screen and the reader is not a user of the app |

And the variant rule that bites more often than size: **a filled `primary` on a
repeating element is a bug.** Cards, rows and list items get `secondary` or
`ghost`; at most one filled accent is visible at a time.

### 2.10 Touch and responsive

- Every action reachable on hover must also be reachable on touch. Use the **`reveal-on-hover`** utility, which handles `pointer: coarse` — never hand-roll `opacity-0 group-hover:`.
- Minimum 44px touch target on coarse pointers.
- No page scrolls horizontally. Wide content scrolls inside its own container.
- Rail + detail collapses to stacked below `md`.

### 2.11 Overlays — which one, and the layer the DS was missing

| The thing | Component |
|---|---|
| **Opening a record** — its detail, its editor | DS **`<PageView>`** — the one detail shell (side/center/full peek, persisted width & mode). Never a module-specific detail panel. |
| A decision or a short form (2+ fields) | DS **`<Modal>`** — 400–720px card, title bar, ×, footer |
| A **modal create/config** panel that slides from the right (share a project, edit a habit's settings) | DS **`<Drawer modal>`** |
| A permanent-and-consequential confirm | **`useConfirm()`** (§2.2a) |
| A whole-screen **mode** — the screen *is* the point | DS **`<FullScreenLayer>`** |
| A menu, a picker, a palette, a composer | popover/menu primitives — not modals, correctly |

**One panel, not two that look alike (2026-07-31).** A record's detail used to open
in `<Drawer>` in five modules and in `<PageView>` in Tasks — the same job, two
shells that diverged on the things a user actually sees: corner radius (`rounded-s-lg`
left the right corners square on a panel that floats 4px off the edge), header height
(`py-3` vs `py-2.5`), and the resize handle (Drawer painted it **berry** — a stray
accent on a piece of chrome — with no keyboard operation, against PageView's ink,
keyboard-resizable, focus-ringed handle). `<Drawer>`'s chrome now mirrors PageView's
exactly (same radius, header, handle, and `MAX_WIDTH` ceiling), so an un-migrated
Drawer and a peek are indistinguishable. The direction of travel is still one system:
**every record detail becomes `<PageView>`**; `<Drawer>` is reserved for the modal
create/config form it was co-opted away from. Tracked as the migration in Part 3.

`<FullScreenLayer>` exists because four surfaces needed the fourth row and the
system only offered the first: the triage queue (one thought, big type), the
ritual flow (a calm guided sequence), the client-portal preview, the image
lightbox. Each hand-rolled `position: fixed` and each landed on a *different
subset of the same contract*:

| | z | role+label | Esc | focus in | focus back | scroll lock |
|---|---|---|---|---|---|---|
| ritual flow | `100` | ✗ | ✗ (the × was *titled* "Leave (Esc)") | ✗ | ✗ | ✗ |
| triage | `190` | ✓ | ✓ | ✓ | ✗ | ✗ |
| portal preview | `z-modal` | ✗ | ✓ | ✗ | ✗ | ✗ |
| image lightbox | `200` | ✓ | ✓ | ✗ | ✗ | ✓ |

Three raw z-values for one layer, one of four announced to a screen reader, and
**none of them gave focus back** — dismissing any of them dropped a keyboard user
at the top of the document. The layer owns all six columns; a surface keeps only
what is genuinely its own (triage its Escape *ladder*, the lightbox its ←/→
paging). It is deliberately not Radix Dialog: a focus trap fights both of those.

**The z registry gained a floor and a ceiling.** `--z-fullscreen: 300` is the one
value for this layer. And `--z-toast` / `--z-tooltip` moved from 55/70 to 320/330,
because the DS scale topped out at 70 while the app's overlays improvised in the
100–210 range: **a toast raised from quick-capture or the command palette
rendered behind it.** Both moved together, so every relation inside the DS scale
is unchanged. Verify token-named classes against the *compiled* CSS — Tailwind v4
has no `--z-*` namespace, and these compiled to nothing once before.

### 2.12 The two header rows

Two rows, one grammar, one set of tokens (`--app-header-px` · `--app-header-lead-px`
· `--app-header-cluster-gap` · `--page-header-h` · `--page-header-gap`, all in
`globals.css`). Never re-state a header dimension in a component.

| Row | Owns |
|---|---|
| **App header** (44px) | where you ARE (page name) · what works everywhere (search, ritual, bell, focus, `+ New`) |
| **Page header** (48px) | this page's scope · its left lane (where you ARE) · **its right lane: how you're looking at it, then what you can do, ending with its primary** |

**The invariant:** the first content box in each row starts exactly
`--app-header-px` from the panel edge; the last one ends exactly there. Both
rows, same axis. Measured, not asserted — see the shell harness.

**Nothing global belongs in the page header.** It ended with a `•••` holding one
device-wide "Full width" toggle: a tertiary, page-independent preference in the
most valuable slot on every screen, pushing each page's real action inboard and
landing 30px from Documents' own ⋮. The preference lives in **Settings →
Appearance** with the other device preferences; the ••• and the shell's floating
copy are both deleted.

**Only one filled button may be visible, and the app header counts.** Its `+ New`
sits directly above — and at the same x as — every page's primary, so a fill
there meant two filled buttons stacked 8px apart on every screen ("+ New" over
"+ New invoice"). `+ New` is bordered; the page's action is the accent.

**`⋮` means a menu opens.** It is not a "go here" glyph and not a second way to
click a row. Home had two that were neither, ~55px apart in one card.

**A dead token is invisible.** All five header tokens were uncommitted additions
that a stale Turbopack CSS bundle never served, so the row ran at `padding: 0`,
`min-height: 0`, `gap: normal` — which is precisely what "cramped" looks like.
Both header rows *matched* in that state, so an alignment check passed on two
equally-broken rows. **Assert a token's computed VALUE, not just that two things
agree.**

---

## Part 3 — Remediation order

Ordered by user-visible harm per unit of work.

1. ~~**Date helper**~~ — **done.** `lib/date.ts` is the vocabulary: `formatDay`,
   `formatDayWithWeekday`, `formatDayTime`, `formatWeekday`, `formatMonthYear`,
   `formatRelativeDay`, `formatAgo`. Every `'en-US'` hardcode outside a
   server-generated string is gone, along with two private `ago()` ladders
   (Documents said "3 months ago" where the app said "2 Jun"). 15 tests.
2. ~~**Destructive actions**~~ — **done.** See §2.2a below for what shipped.
3. ~~**Touch-unreachable row actions**~~ — **done.** The remaining reveals were
   CSS-driven, not `group-hover:` — `.zb-db-row:hover .zb-db-del`, `.doc-proprow:hover
   .doc-prop-x`, `.doc-cover:hover .doc-cover-actions` — with no coarse-pointer branch,
   so delete-row, open-row, open-link, delete-comment, the property chips and the cover
   actions were all invisible *and* unreachable on a phone. They use `reveal-on-hover`
   now; two of those rules also reached across files into `doc-properties`, which is gone
   with them. Verified live: rest 0 · hover 1 · keyboard focus 1, and the compiled
   `@media (pointer: coarse)` branch is present.
4. ~~**Clients switcher**~~ — **done, and the finding was half wrong.** The bug was the
   *placement*, not the component: in the 211px rail the switcher measured ~250–290px, so
   "Feedback" scrolled out of sight with `hideScrollbar` leaving no hint it existed. It
   moved to the page header's **left lane**. It stays a **`<SegmentedControl>`** —
   per the user, the top level of every module uses the same switcher Forms uses; underline
   `<Tabs>` belong one level down, on a single record. §2.4 rewritten to say so.
   Three private date helpers in that file went to `lib/date.ts` too.
5. ~~**Primary button sizes**~~ — **done, and the finding was wrong.** "Four sizes"
   read as drift; on inspection the app already sizes buttons *by context* and does it
   consistently (see §2.10). Forcing `sm` everywhere would have broken working modal
   footers. Only two call sites genuinely violated the contextual rule: a `md` button
   beside a 28px input in the cover popover (heights didn't match), and a **filled
   primary on a repeating pipeline card** — one accent per proposal-stage deal, against
   the one-filled-accent rule. Both fixed; the rule below is now written down.
6. ~~**Bespoke modals**~~ — **done, and only one of the four was a modal.**
   `new-space-modal` is a form with a footer: it renders through DS `<Modal>` now
   and gets a focus trap, Escape, a labelled dialog and "Discard changes?" for
   free. The other three — **triage**, the **ritual flow**, the **portal
   preview** — plus the image **lightbox** are full-screen *modes*, and pouring a
   full-screen mode into a 560px card would destroy each one. They were
   re-implementing a layer the design system didn't have, so the system got it:
   **`<FullScreenLayer>`** (§2.11).
7. ~~**Hand-rolled empty states**~~ — **done, and the count was inflated.** Of the
   "11 files", most of the hits were **menu and popover internals** — "No options",
   "No results", "No project", "No property types". A menu's empty row is not an
   empty *state*: it is a disabled-looking row inside a 200px panel, and pushing
   `<EmptyLine>` into it would make the panel read like a page. Those stay.
   The genuinely section-level ones — 15 of them across **7 files** (projects
   Overview ×4, the ritual flow's five steps, task drawer subtasks + comments,
   the invoice line-item and money filter tables, the tasks list, the template
   gallery) — are `<EmptyLine>` now. They had been written five different ways:
   centred vs left, `text-ui`/`text-caption`/`text-body-lg`, `ink-400`/`ink-500`/
   `text-secondary`, one of them in *italic editorial*.
   **Still open:** Calendar has no empty states at all, but that is a design
   question rather than a migration — an event grid with nothing in it is not
   empty, the grid IS the content.
8. ~~**Remaining page headers**~~ — **done.** Tasks, Calendar, Documents and Home
   all render through `<PageHeader>` now, so no screen falls back to the shell's
   floating •••. Each one gave up a bespoke bar in the process:
   - **Documents** had *no* header, so the float landed on top of the module's own
     ⋮ — two dot-menus, 30px apart. The header now carries the view scope (Draft ·
     All documents · Shared · Templates · Trash · folder name), the tag filter in
     the left lane, the grid/list switch and one primary create. See §1b.
   - **Tasks** had an `h-12` bar *inside the task pane*, centred in the reading
     column, so its scope label and actions sat at a different x from every other
     page. It moved above both panes; the filter went to the left lane.
   - **Calendar**'s toolbar padded itself `pr-[52px]` — a literal hard-coded gap to
     clear the floating •••. Gone with the float. `‹ ›` is the `lead`, "July 2026 ·
     Week 31" the scope, Today + Day/Week/Month the actions.
   - **Home** had the shell's ••• floating over the greeting. It takes the same
     shape Habits uses — the day as scope, "1 of 3 done" as subtitle — because the
     greeting H1 never says *which* day, and Home is Today staged by time of day.

   Two things fell out of doing it: a **permanently disabled Forward button** in
   the doc header (dead chrome the DS painted with a filled `bg-surface-disabled`,
   making it the loudest thing in the row), and **three affordances copying one
   URL** (Share ⌄ whose caret opened nothing, a 🔗 icon, and a menu row).

---

## Part 4 — The checklist, before any screen ships

- [ ] ≤1 filled-accent element visible **counting the app header** — its `+ New` sits directly above every page's primary
- [ ] Page header present: actions right, ending with the page's primary, aligned with the app header
- [ ] `⋮`/`•••` appears only where a **menu** opens — never on a link or a jump
- [ ] Every destructive action confirms or offers undo
- [ ] Create uses inline-vs-modal per §2.1
- [ ] Tabs vs segmented per §2.4
- [ ] Empty state via `<EmptyState>`, ≤180px
- [ ] Dates/money/durations through the shared helpers; no `'en-US'`; numbers `tabular-nums`
- [ ] Sentence case; glossary respected
- [ ] Hover actions reachable on touch; 44px coarse targets
- [ ] Escape/Enter behave per §2.7; focus rings intact
- [ ] No horizontal page scroll at 390px

If a box fails, fix it before calling the screen done.


---

## Popovers must not be clippable (2026-07-30)

A menu positioned `absolute` inside the thing that triggers it is clipped by the
nearest scrolling ancestor. `database-view.tsx` shipped that way and the column
menu lost its last two items behind the table's edge.

**The trap:** the table wrapper was only `overflow-x: auto`. **Once `overflow-x`
is `auto`, CSS computes `overflow-y` to `auto` as well** — so a box that meant to
scroll sideways clipped vertically too. Never assume one axis is safe.

**The rule:** every popover, menu and tooltip renders in a **portal**, positioned
from its trigger's rect. Prefer a DS Radix component (`DropdownMenu`, `Popover`),
which does this already. A hand-rolled one — justified only for rich content Radix
menus can't hold, like an inline rename input plus a submenu — owes four things:

1. portal to `document.body`;
2. flip when there's no room, and clamp into the viewport on both axes;
3. **follow the trigger on scroll** — the portal costs you the tracking an
   absolute child got for free, so a scrolled container strands it;
4. **close when the trigger leaves the viewport**, rather than sitting clamped
   over unrelated content.

Fix it at the ONE popover seam a module owns, not per call site.

**Verifying it:** assert there is no clipping ancestor between the panel and
`<html>` (walk `parentElement`, checking computed `overflowX`/`overflowY`) — not
just that the panel "looks right" at one scroll position. And note that the
browser pane runs with `document.visibilityState === "hidden"`, where **native
scroll events are never dispatched**: pair any programmatic scroll with an
explicit `dispatchEvent(new Event('scroll', { bubbles: true }))` or the test
silently proves nothing.
