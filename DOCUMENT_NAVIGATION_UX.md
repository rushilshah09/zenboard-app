# Document Navigation UX

**Status:** governing document for how you *move* through Zenboard's documents.
Subordinate to `DESIGN_CONSTITUTION.md` (principles) and `INTERACTION_STANDARDS.md`
(how the same act behaves everywhere). Where this file and the DS disagree on a
number, the DS wins and the deviation is recorded in §3.

**The thesis.** Notion does not feel premium because of any one feature. It feels
premium because navigation almost never costs a page load. Every surface you can
see is also a surface you can *travel from*. Zenboard has the same information —
spaces, folders, databases, nested pages — and currently spends it on a label.

**Rule zero.** A breadcrumb is not text. It is an entry point.

> **Revised 2026-09-14 by user directive** ("Make Zenboard databases feel like Notion", §1
> Breadcrumbs: *"look cheap because of the underline treatment … only show information
> that is relevant to the current page … do not expose unnecessary hierarchy or unrelated
> information … a native navigation system, not a collection of links"*). This reverses
> four decisions below; the rest stands.
>
> 1. **The trail starts where the page lives.** No workspace crumb (§2.1's first row,
>    Part 1 row 3): every document in the view shares it, and the sidebar names and
>    switches it. `Learning / Motion / After Effects`.
> 2. **Every crumb opens its siblings — the open page's too.** The current page no longer
>    swaps them for actions (§2.1's last row); those live in the header's ⋯, and rename is
>    the title itself. Each list carries a heading naming what holds it — "Pages in
>    Motion", "Folders in Learning" — Notion's "Other pages in …".
> 3. **No Recent and no Favorites in a crumb menu** (§2.2). Scoped or not, they are
>    information from outside the branch the crumb describes; ⌘K is the place for them.
> 4. **One crumb, one control.** A quiet 24px pill whose only hover is a soft wash, held
>    while its menu is open — no underline, and no caret button beside it (its invisible
>    slot was the uneven gap before every "/"). A crumb that leads somewhere is pressed
>    to GO there, and opens its menu on hover, ↓, Space or right-click; the open page, or
>    a picker with nowhere to go (Content's stage — which alone keeps a caret), is pressed
>    to open its menu. An icon appears only where the page has its own.
>
> Two things were found and fixed on the way: a menu opened by **hover** now leaves focus
> where it was (it took the caret out of the document being written, then parked it on
> the crumb), and **touch** is decided by the pointer, not the width — a tablet has no
> hover either, so any coarse pointer gets the sheets of §2.3.

---

## Part 1 — Audit: what Documents navigation is today

Measured against the codebase, not from memory.

| # | Surface | What it does now | Gap |
|---|---|---|---|
| 1 | Header folder chip (`documents-view.tsx`) | A button with a `ChevronDown` rotated −90°. Clicking it opens the folder's grid. **The caret opens nothing** — it is a chevron drawn as decoration. | The one affordance that promises a menu doesn't have one. |
| 2 | Header doc crumb | A `<span>`. Icon + truncated title. | Not focusable, not actionable, no siblings. |
| 3 | Workspace level | Absent from the trail entirely. The space is named only in the shell sidebar. | You cannot tell, from the document you are reading, which workspace you are in. |
| 4 | Nested pages (`pages.parent_id`) | The column exists and `movePages` writes it. Nothing in the header reads it. | A page three levels deep looks identical to a top-level page. |
| 5 | Databases (`pages.type = 'database'`, `database_id`) | Reachable only from the grid. | A database row's ancestry is invisible. |
| 6 | DS `<Breadcrumbs>` (`components/ds/ui/breadcrumbs.tsx`) | Real component, correct collapse rule (>4 levels → `Root / … / Parent / Current`). Links only; the `…` is the sole menu. | **Documents never imported it.** Two breadcrumb implementations, and the app shipped the weaker one. |

The finding that matters: the data for a full interactive trail is *already loaded*.
`DocumentsView` receives every folder and every page of the space up front. Sibling
lookup is an array filter, not a query. The friction is entirely in the UI layer.

---

## Part 2 — The interactive breadcrumb

### 2.1 What each level opens

| Level | Menu shows | Create row |
|---|---|---|
| Workspace | All workspaces, active one checked | New workspace |
| Space section (Drafts / All / Shared / Templates / Trash) | The sibling sections | — |
| Folder | Sibling folders at the same depth, then the folder's own child folders and pages | New folder · New page |
| Database | Sibling databases in the same folder | New database |
| Parent page | Sibling pages, current one checked | New page |
| Current page | **Actions**, not siblings: Open in new tab · Copy link · Rename · Duplicate · Move to · Delete | — |

A row whose target has children carries a `>` and opens a submenu on hover —
Finder/macOS/Notion behaviour, nested to any depth.

### 2.2 Menu anatomy (top to bottom)

```
┌────────────────────────────────┐
│ [search]        (only if > 7)  │
│ RECENT                         │
│   · three most recent, in this │
│     branch                     │
│ ─────────────────────────────  │
│ FAVORITES                      │
│   ⭐ starred pages              │
│ ─────────────────────────────  │
│ items…                    ✓ >  │
│ ─────────────────────────────  │
│ + New page / folder / database │
└────────────────────────────────┘
```

Recent and Favorites are *scoped to the branch the menu describes*, not global. A
global recents list in a folder menu is a second command palette, and we already
have one.

### 2.3 Behaviour

| Behaviour | Value | Why |
|---|---|---|
| Hover-open delay | 120 ms | Below this, crossing the trail with the mouse fires three menus. |
| Close delay | 250 ms | Buys the diagonal path from trigger to menu row. |
| Switch delay, menu already open | 0 ms | Menubar rule: once one is open, the trail behaves like one control. |
| Open animation | DS `emerge` (150 ms, `--ease-out-quiet`) | Already fade + `scale(0.96)` + 4px rise. The brief asked for fade + scale 0.98→1 / 150 ms; the DS token is the same gesture and is shared by every overlay in the app. |
| Keyboard | ↑ ↓ → ← Enter Esc Tab ⇧Tab | Radix roving focus; submenus open on → and close on ←. |
| Typeahead | filter input above 7 items; Radix's own jump-to-letter below that | A filter box over five rows is noise. |
| Touch | tap → `<BottomSheet>`, never a hover menu | Hover does not exist on touch, and a 32px row does not meet the 44px target. |
| Current page | trailing ✓ and a persistent highlight | A row that also opens a submenu shows the highlight only — the `>` owns that slot. |

### 2.3b How much path survives the width

| Width | Trail |
|---|---|
| wide | up to 3 ancestors, then the current page. Beyond 4 levels the **middle** collapses into `…` — never the current page or its direct parent (§4.29). |
| < 768px | `… / Current page`. Every ancestor moves into the `…`, which on touch opens the drill-down sheet. |

This is not cosmetic. At 375px the full path drew straight through the page's
own actions — the trail claimed 277px of a 159px slot, because the header's lead
cluster is `shrink-0` on every page and could not squeeze it. Two things fixed
it: the collapse above, and a `max-w` on the trail so `truncate` has a ceiling.
The Documents header also gives up two sets of words below 640px (the "Edited
…" stamp goes, "Copy link" keeps only its glyph) — that row cannot carry a path,
a save stamp and a labelled button at once, and it had been drawing them on top
of each other since before the trail arrived.

### 2.4 What we deliberately did *not* build

- **Lazy loading / prefetch.** The brief asks for both. Every folder and page of
  the space is already in memory before the header renders, so a lazy load would
  add a spinner to something that is synchronous. The `menu` prop is still typed
  as `() => Items | Promise<Items>` so a future space large enough to page *can*
  become async without touching a call site.
- **Virtualization.** Same reason, plus: a virtualized list inside a Radix menu
  breaks roving focus and typeahead. Instead, a node with more than 200 children
  renders the first 200 and the filter box narrows from the full set — 1000+
  pages stay reachable, and reachable *faster* than by scrolling.
- **A skeleton in the common path.** Skeleton rows exist for the async case
  (§2.4 first bullet) and are never seen today. Never a spinner.

---

## Part 3 — DS reconciliation

The brief specifies Notion's numbers. Zenboard's overlay chrome is already one
shared spec (`MENU_PANEL_CLASS`, used by `MenuPanel`, `DropdownMenu`, `Popover`).
Splitting it would make the breadcrumb menu the one panel in the app that looks
imported. Adopted vs. held:

| Brief | Zenboard | Decision |
|---|---|---|
| Width 280px | — | **Adopted.** 280px, and the current-page action menu is 240px. |
| Padding 8px | `p-1.5` (6px) | **Held** — DS panel padding. |
| Item height 32px | `min-h-9` (36px) | **Held** — DS row. 36px is Zenboard's menu row everywhere; 32px would make this menu the outlier. |
| Radius 12px | `rounded-lg` | **Held** — `--radius-panel` is 12px, `rounded-lg` resolves to it. Same number, DS name. |
| Gap 4px | DS | **Held.** |
| Icons 16px Phosphor | Phosphor via the seam | **Adopted** — already the one family. |
| Fade + scale 150ms | `animate-emerge` | **Held** (identical gesture, shared token). |
| Large shadow, no heavy border | `shadow-lift-2` + `border-line-strong` | **Held.** The border is one hairline on a lifted surface; removing it only here would break the overlay family. |

---

## Part 4 — Architecture

```
lib/doc-nav.ts          THE projection. Pure. spaces+folders+pages → trail + menus.
lib/recents.ts          Recently-opened, localStorage, record-type generic.
components/ds/ui/breadcrumbs.tsx
                        THE component. Knows nothing about documents.
components/documents/doc-breadcrumbs.tsx
                        The wiring: projection → DS component, plus the verbs
                        (create, move, switch space).
```

Three rules that keep this from rotting:

1. **One projection.** Anything that needs to know where a document lives calls
   `lib/doc-nav.ts`. Precedent: `lib/connected.ts`, `lib/goal-rollup.ts`,
   `lib/habit-schedule.ts` — every one of those exists because two callers had
   quietly disagreed.
2. **The DS component knows no domain.** It takes `Crumb[]` with opaque menu
   sections. Projects, Clients and Tasks can adopt it without a rewrite.
3. **Never hand-roll the menu.** Radix `DropdownMenu` + `DropdownMenuSub` already
   ship the safe-triangle, roving focus, typeahead and ARIA `menu`/`menuitem`.
   Hover timing is the only thing layered on top.

---

## Part 5 — Programme

P0 items are the ones that change how the app *feels* to a daily user.

| # | Priority | Feature | Status |
|---|---|---|---|
| 1 | P0 | Interactive breadcrumbs with hover navigation | **Built** — this pass |
| 2 | P0 | Page Peek (hover preview card for links and mentions) | Next. `<PageView>` already owns opening a record; peek is its hover twin. |
| 3 | P0 | Universal command palette (⌘K) with recent, favourites, actions | `<CommandMenu>` exists and takes `recentIds`; `lib/recents.ts` (this pass) is the store it was missing. |
| 4 | P0 | Rich page mentions with hover preview | Depends on #2 and on 0027_mentions (drafted, not applied). |
| 5 | P0 | Floating contextual toolbar for selected blocks | `block-editor.tsx`. |
| 6 | P1 | Smart drag-and-drop indicators with insertion animation | dnd-kit is already a dependency. |
| 7 | P1 | Multi-select pages and blocks with batch actions | `<SelectionBar>` exists and is unused here. |
| 8 | P1 | Context-aware right-click menus | Partly landed with #1 (current-page crumb). **Owed:** `DocContextMenu` in `documents-view.tsx` is still a hand-positioned `MenuPanel` with its own Title Case labels and its own "Move to" flyout — it and the crumb's action menu are two renderings of one idea. Fold it into the DS menu here. |
| 9 | P1 | Page transitions with preserved scroll state | |
| 10 | P1 | Navigation history with hoverable Back/Forward menus | The Forward button was *deleted* from the Documents header for being permanently disabled — this is what earns it back. |
| 11 | P2 | Inline AI suggestions while typing | |
| 12 | P2 | Quick switcher with fuzzy search | `fuse.js` is already a dependency. |
| 13 | P2 | Recents + pinned in every navigation menu | `lib/recents.ts` generalises to this. |
| 14 | P2 | Predictive prefetching | Only meaningful once a space is large enough to page. |

Build them in that order. None of them adds a feature; each removes a reason to
stop and think about where something is.
