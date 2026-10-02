# Database experience — the Notion-grade plan

**Status:** governing for Docs and Databases work. **Source:** user directive, 2026-09-14 —
"Make Zenboard databases feel like Notion" (32 sections, with Notion references and screenshots
of Zenboard today). Subordinate to `DESIGN_CONSTITUTION.md`, `INTERACTION_STANDARDS.md` and
`SPRINT_RULES.md`.

Notion is the reference for **interaction quality** — speed, hierarchy, spacing, the small
states — not a visual template. Zenboard stays black-and-white, calm and token-driven. Every
task follows the same loop: name the problem with evidence → the reference behaviour → the
desired behaviour → implement → test → check responsive → check the design system → next.

---

## What already exists — build on it, never beside it

- **One opening system** — `components/ds/ui/page-view.tsx`. Side peek (non-modal, resizable
  380–1100px, 560 default), center peek (modal, `min(920px)` × `min(840px)`, scrim), full page
  (inside the content pane, with breadcrumbs and a back arrow). One preference per content
  type (`lib/page-view-mode.ts`) and a viewport veto below 1100px.
- **Rows are pages** — `pages.database_id`; one store (`lib/db-store.ts`), one engine
  (`lib/db-engine.ts`), one collections module (`lib/collections.ts`).
- **Views that render today:** table, board, gallery, list, calendar, feed.
- **View capabilities:** typed filters with chips, multi-sort, group and subgroup, conditional
  colour, property retype, per-view visibility and order, a view-settings panel (layout,
  properties, sort, group, conditional colour, copy link), linked views (source picker), board
  drag between columns, undo for structural database edits.
- **Property types defined:** title, text, number, select, multi-select, status, date, person,
  files, checkbox, URL, email, phone, formula, relation, rollup, created/edited time and by,
  button, place, id (`lib/properties.ts`).
- **Breadcrumbs open their siblings** — `lib/doc-nav.ts` → DS `Breadcrumbs` →
  `components/documents/doc-breadcrumbs.tsx`.

---

## Audit — today against the reference

| § | Area | Today (evidence) | Reference behaviour | Task |
|---|---|---|---|---|
| 1 | Breadcrumbs | The DS crumb is `hover:underline` with no fill; a chevron appears on hover | Plain text crumbs, a soft rounded fill on hover, the current page distinct without weight | T3 |
| 2 | Creating a database | **Full page:** the page opens under a temporary id and its body queries the server with it — the user saw `invalid input syntax for type uuid: "tmp-…"`. **Inline:** the block shows "Creating database…" until the server returns an id | Appears instantly with its structure; setup happens behind; never an error | T1, T2 |
| 3, 24 | Room on the page | An inline board clips at the text column (the Done column cut off, a scrollbar inside the column) | Aligned to the text column, free to extend to the page's width; comfortable to keep writing below | T5 |
| 4, 5 | Slash menu | Seven database items share one icon — one `collection` block type maps to one glyph; no Calendar or Timeline entry | An icon per purpose, a clear title and a quiet description; every view kind | T4 |
| 6 | Views | Timeline and chart exist in the data model with no renderer and no menu entry | Table, Board, Gallery, List, Timeline, Calendar over one database | T9 |
| 7 | View settings | The panel covers layout, properties, sort, group, conditional colour, copy link | Plus layout-specific settings, and nothing irrelevant to the current layout | T8 |
| 8 | Opening pages | One preference for every database row, whatever the view | "Open pages in" per view — Board, List and Timeline side peek; Calendar and Gallery center peek | T6 |
| 9–11 | Peeks and full page | Sizes and behaviour largely right | Verify per viewport; full page keeps properties, comments and breadcrumbs | T6 |
| 12 | Rows are pages | Done in the model | Everything a page can hold, editable from every open mode | T7 |
| 13, 14 | Properties, status | All types defined | Each type with its icon and hover, focus, empty, loading and editing states; muted status colour | T10 |
| 15, 16 | Toolbar, New | Search, filter, properties, view settings, expand, and a filled "New" | Quiet icon controls with tooltips; New creates instantly, applies defaults and opens per the view | T7 |
| 17, 22 | Cards, empty states | Board card is paper-2 with a border and shadow on a well; empty view says "Nothing here yet." | One surface, no double edge; an empty state that offers New | T11 |
| 18 | Drag and drop | Board cards move between columns | Also row reorder, property reorder, view reorder | T12 |
| 20 | Keyboard | Inside a database only Escape is handled | Arrow keys between cells, Enter to edit, Escape, Tab | T13 |
| 21 | Speed | Creation waits on a server round trip | Optimistic wherever it is safe | T1, T2, T7 |
| 25 | Linked views | The source picker exists | Filter, sort, group and properties of their own over shared data | T14 |
| 19, 23, 26–30 | States, responsive, menus, hierarchy, type, tokens | `database-view.tsx` still paints much of its chrome with inline styles | One menu pattern, tokens only, every state present | every task |
| 32 | Not asked for | — | Lock database, view duplicate and reorder, OR-filter groups, templates and default values, … | T15 |

---

## Tasks, in order

Correctness before polish, then the most visible gaps.

- **T1 — a new database page never errors.** ✅ 2026-09-14. Nothing may query the server with
  a temporary id; a new page opens with its structure immediately.
- **T2 — an inline database appears instantly.** ✅ 2026-09-14. The empty table renders at
  once; creation persists behind it and reports a failure without losing the block (human
  copy, Try again in the same layout). See PROGRESS "Databases appear the moment you ask".
- **T3 — breadcrumbs.** ✅ 2026-09-14. DS crumbs: no underline, soft fill on hover, intentional
  spacing, icon and type sizes — and relevant information only (no workspace, no Recent or
  Favorites, siblings under a heading). See `DOCUMENT_NAVIGATION_UX.md` revision.
- **T4 — slash menu database items.** ✅ 2026-09-14. An icon per kind; Calendar entry (Timeline
  lands with T9). Rebuilt as Notion's menu on the user's request — fixed size, sections,
  shortcuts, drawn hover previews, at the caret. See PROGRESS "The slash menu, Notion's".
- **T5 — inline database width.** ✅ 2026-09-15. Content aligned with the text column; the
  database may use the page's width; spacing above and below like any block. A table or board
  runs to the page's edges by measured distances (`lib/bleed.ts`). See PROGRESS "An inline
  database uses the page's width".
- **T6 — "Open pages in" per view,** with the reference defaults, through `PageView`. ✅ 2026-09-15.
  Tables, boards, lists and timelines open pages on the side; galleries, calendars and feeds open
  them centred. A view's own choice wins, set on its Layout page or from the peek's menu
  (`openPagesIn`). Board cards open on click and on Enter. See PROGRESS "A database view decides
  how its pages open".
- **T7 — toolbar and New.** Quiet controls with tooltips; New is instant and opens per view.
  ✅ 2026-09-15. A new row starts in its status's first option and inside the view's filter
  (`newRowValues`), and opens per "Open pages in" with its name focused. The table's foot types
  in place, and an inline database's New is secondary. See PROGRESS "New makes a row you can use
  at once".
- **T8 — layout-specific view settings.** ✅ 2026-09-15, with the Board rebuilt as Notion's (the
  user asked for it directly, with screenshots). Each layout's Layout page offers only its own
  settings (`layoutOptions`): vertical lines, card size, calendar by, weekends, group by, colour
  columns, hide empty groups. A board's Group page lists every column to drag, hide or show.
  See PROGRESS "The board, Notion's".
- **Pages inside pages** (the user, 2026-09-15). ✅ A row's page is a page (large name,
  properties, body), a Page block (`/page`) nests pages without end in docs and rows alike, and
  every page opened inside a peek steps deeper in the same peek with a trail. See PROGRESS
  "Pages inside pages".
- **T9 — Timeline view.** ✅ 2026-09-15. Bars from a start to an end date, drag to move or stretch,
  click to open, arrows to nudge, Week to Year, Today, the undated pages a click away; in the slash
  menu and Add view. See PROGRESS "The Timeline view".
- **T10 — properties, type by type.** ✅ 2026-09-15. One cell (`db-cell.tsx`) for a table or a page's
  sheet: focus inside its edges, hover wash and "Empty" on a sheet, the DS checkbox, open · write ·
  call beside a link, an address and a number (built through `safeHref`). See PROGRESS "A database's
  values, type by type".
- **T11 — cards and empty states.** ✅ 2026-09-15. One card (`db-card.tsx`) for board and gallery; a
  gallery card previews its page; a list line carries its values; a filtered-away view says so with
  Clear filters; loading is a skeleton. See PROGRESS "Cards, lists and the empty view".
- **T12 — drag and drop:** rows, properties, views. ✅ 2026-09-15.
  - Board cards and columns, table rows (into other groups too; a sorted view asks before its
    sort goes), table columns by their header, each view's own column order (`propOrder`), and
    views in the "N more…" list.
  - One ⌘Z per drop.
  - With it, the user's view bar: three tabs + "N more…", and the view menu (Rename · Display
    as · Edit view · Copy link · Open as full page · database title · Duplicate · Delete).
  - See PROGRESS "A database's views, and moving rows and columns by hand".
- **T13 — keyboard navigation in tables.**
- **T14 — linked views, verified end to end.**
- **T15 — the audit of what was not asked for.**
- **Collection** — ⏳ 2026-09-15, taken by the docs session (transcript e71978cb) on the user's direct
  instruction, ahead of T13–T15. **No longer a database view:** the user's third brief
  (`COLLECTION_ITEM_BRIEF.md`) made Collection its own item beside a Database — a page of type
  `collection` — and the Collection view was taken back out of the database code, which is as it was.
  Plan and status: `COLLECTION_PLAN.md`. Please don't start it in parallel; T13–T15 stay open.

Each task lands with tests, a browser check in both themes, and a `PROGRESS.md` entry.

---

## After T15 — the Collection view

> **Superseded 2026-09-15.** Collection is its own item beside a Database, not a view of one — see
> `COLLECTION_PLAN.md`. What follows is history.

The user's second brief (2026-09-14): **Collection**, a first-class database view for
collecting links, social posts, images, PDFs and files into a visual, masonry-style library —
another renderer over the SAME records, properties and views, never a separate product. Its
six phases (foundation → UI → ingestion → database integration → advanced behaviour → audit)
are planned here when T15 is done. The brief itself is `COLLECTION_VIEW_BRIEF.md`, verbatim.

Build on what exists: Content already unfurls links with platform identity and remembers the
preview on the row (`/api/unfurl`, PROGRESS "a link wears its platform's logo" and "a link's
preview is remembered on the row"); attachments store a path, never a URL (0033).
