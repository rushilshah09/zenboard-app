# Collection — the plan (a first-class item, beside Database)

**Status:** ⏳ K1–K5 built by the docs session (transcript e71978cb, which hit its usage limit at 20:11 IST)
and checked by `scripts/verify/verify-collection-item.mjs`. **Taken over 2026-09-15 22:15 IST by session
7061260e (zenboard-2-c2)** on the user's direct instruction: *"now complete collection part, now we need more
work on collection"*. That session holds K6 and K7–K13 below — **please read the task list before editing a
Collection file**, and leave a ⏳ note here before starting one.

**Source:** `COLLECTION_ITEM_BRIEF.md` (the user's third brief,
verbatim), which reverses the architecture of `COLLECTION_VIEW_PLAN.md`: Collection is its own item, never a
view of a database. The experience inside a Collection — masonry, previews, collecting, the canvas — still
follows `COLLECTION_VIEW_BRIEF.md` and `COLLECTION_CANVAS_BRIEF.md`. Subordinate to `DESIGN_CONSTITUTION.md`
and `SPRINT_RULES.md`.

---

## Architecture

- **A Collection is a page of type `collection`**, the way a Database is a page of type `database`.
  - **Inherited from pages:** its id, its name (the page title), rename, move to a folder, duplicate, trash,
    search, mentions, breadcrumbs and permissions.
  - **Why no migration:** `pages.type` is plain text with no check constraint.
- **Its items live in the page's content,** `content.collection = { items }`. An item has:
  - a stable id (a uuid, never an index);
  - a `kind`: link | image | video | audio | pdf | file | note;
  - its content: a `url`, an uploaded `file` (attachments, 0033) or a `note`;
  - its name and metadata: title, description, author, site, published day, preview image, favicon, and
    the picture's shape;
  - its **canvas placement** `{ x, y, w, h, z }`, which is layout and never content;
  - `createdAt` and `updatedAt`.
- **One writer.**
  - The Collection's store saves the page's content, merging over everything else the page holds.
  - Documents never writes a collection page's content; it saves the title, tags and icon only. Otherwise
    renaming a Collection would write back an older copy of its items.
- **Two presentations of one list.** The masonry arranges the items by itself. The canvas draws each item
  where it was put, and an item never put anywhere opens where the masonry would place it.
- **The database system is unchanged.** The Collection VIEW (COLLECTION_VIEW_PLAN C1–C3 and the start of C13)
  is taken back out of databases.
  - **Kept:** fixes that stand on their own — the `orderBefore` key floor, the row page's body save that keeps
    other content (`withBlocks`), the documents harness's fixture clock, and the published day read by
    `/api/unfurl`.
  - **Reused:** the pure rules the view built — link type, source and picture (`lib/collection-item.ts`), the
    masonry, the canvas geometry, and link previews.

## Tasks, in order

- **K1 — Collection leaves the database.** Revert the view; databases exactly as before; the suite, tsc and
  eslint clean.
- **K2 — The model and its store.**
  - `lib/collection.ts`: read (guarded), add, remove, rename, fill from a link, remember a shape, place,
    bring to front.
  - `lib/collection-store.ts`: optimistic, undo and redo, and saves merged into the page, waiting for a page
    still being created.
- **K3 — Creation and identity.**
  - **Where it is offered:** Documents' New menu (Doc · Database · Collection), the breadcrumb folder menu
    ("New collection" beside "New database"), and `/collection` in the editor (a page block).
  - **How it shows:** a Collection icon wherever a page's kind is shown.
  - **Opening:** it opens on the Collection surface, named "New collection", its name selected to rename.
- **K4 — The masonry.**
  - Cards with previews (the C2 rules).
  - **Add:** paste a link, write a note, upload files.
  - **Collecting by hand:** paste links anywhere on the page, or drop files.
  - **The item's page:** open, rename, go to the source, delete.
  - Select many, and delete them.
- **K5 — The canvas.**
  - "View canvas": pan, zoom, select, marquee, move many, resize, bring to front, delete, add.
  - Every place is saved on the items and restored exactly.
- **K6 — Proof.**
  - Harness collections, unit tests first, CDP checks with trusted input.
  - Both themes and phone width.
  - PROGRESS and memory.

**K1–K5 status (2026-09-15 22:15 IST):** built; `verify-collection-item.mjs` passes steps A–L (cards, paste,
composer, upload, item page and rename, delete with Undo, canvas move/marquee/zoom/fit/resize, touch grip, empty
Collection, New menu and `/collection`). K6 ✅ — PROGRESS "A Collection is its own item, beside a Database".

**✅ K3/K4 fixes — session e71978cb (the docs session), 2026-09-16 — PROGRESS "Duplicate copies what is on
screen, and a new Collection's name arrives selected".** Two defects
found proving K3–K4 with trusted input: (1) Duplicate copied the page list's content, which a Collection's store
never updates — the copy missed everything collected since the page loaded (source 8 items, copy 7); (2) a new
Collection's name was NOT selected (K3 above says it is), so typing did not name it, and Enter in its title did
nothing. Touches `lib/collection-store.ts` (`flush` returns its save; `settledCollectionContent`),
`lib/collection.ts` (`NEW_COLLECTION_NAME` only), `documents-view.tsx` (`dup`, `newPage`, `openChildPage`, the
title's Enter), `block-editor.tsx` (the name), `collection-page.tsx` (the unmount flush, one line), and the verify
script (steps J, K, M). Nothing in K8's files.

## Next — what a Collection still needs (session 7061260e, in order)

Measured against `COLLECTION_VIEW_BRIEF.md` for everything that still applies to a Collection item.

- **K7 — Tags** ✅ 2026-09-15 — PROGRESS "A Collection's tags" (§14–16, §31, §42). A Collection keeps its own tag vocabulary; an item carries tags. Shown on
  the card (optional line), set on the item's page, added to many at once from the selection bar.
- **K8 — Find and order** ✅ **2026-09-16 by session e71978cb** (taken over from 7061260e, which had written the
  pure rules and nothing on screen) — PROGRESS "Finding and ordering a Collection". Filter · Sort · Search in the
  grid's bar, in the database bar's order; search over everything an item says (§32); Type · Source · Tags ·
  Collected (§31); six orders including Recently updated (§29); a card carried to a new place with a drop line,
  with ⌥←/⌥→ and Move left/Move right as its twins. The sort is saved through `learn`, so ⌘Z never undoes a way of
  looking. Touches `lib/collection-find.ts`, `lib/collection.ts` (one sort added), `lib/masonry.ts`
  (`masonryLanding`, `dropIndex`), `collection-find-bar.tsx` (new), `collection-grid.tsx`, `collection-card.tsx`
  (`ItemActions` gains the moves; `KIND_LABEL` folded into the model's `ITEM_KIND_LABEL`), `collection-page.tsx`,
  the documents fixture (an eighth item, older and audio) and `scripts/verify/verify-collection-find.mjs` (new).
- **K9 — Notes on an item** ✅ **2026-09-16 by session e71978cb** — PROGRESS "Notes on a collected thing" (§18,
  §38). `item.body` holds the Zenboard editor's blocks, saved through `learn` after a 400ms settle; a note item's
  words ARE its body (its `note` follows through `blocksToText`); the card carries a mark when an item has been
  written about; the search reads the notes. The editor is loaded only when an item opens. Check:
  `scripts/verify/verify-collection-notes.mjs`.
- **K10 — Hover and selection** ✅ **2026-09-16 by session e71978cb** — PROGRESS "Picking things out of a
  Collection" (§15–16). A box on hover picks without a modifier and stays on a picked card; the card's menu gains
  Rename (on the card), Tags (a real submenu — a popover opened from a menu lived 25ms) and Copy link; the
  selection bar gains Copy links and Select all. `copyText` in `components/ds/ui/clipboard.ts` is now the one way
  anything is copied. Check: `scripts/verify/verify-collection-select.mjs`.
- **K11 — Presentation** ✅ **2026-09-16 by session e71978cb** — PROGRESS "How a Collection shows itself" (§28).
  Card size (150 · 220 · 320 column floors), Preview (Original ratio = the masonry · Cover · Fit) and Show
  titles, in a View settings panel beside Filter · Sort · Search. `content.collection.view`, saved through
  `learn`, only what is not the ordinary. §28's Layout masonry|grid is NOT a fourth setting — Original ratio is
  the masonry. Check: `scripts/verify/verify-collection-look.mjs`.
- **K12 — Performance** ✅ **2026-09-19 by session e71978cb** — PROGRESS "A Collection of hundreds" (§45). Past 60
  items the grid draws only the cards near the screen (`cellsInView`) and the canvas only what the camera sees
  (`viewRect` + `hitTest`): 250 items → 28 cards in the DOM. The grid now guesses a card's height the way the card
  draws it (scroll drift 2.7% → 0.2%). Platform thumbnails deliberately stay `hqdefault` — the only YouTube size
  whose absence is detectable. Check: `scripts/verify/verify-collection-many.mjs`.
- **K13 — Final audit** (§34–44). Hover, loading, empty and error states; keyboard and screen reader; both
  themes; phone and tablet; PROGRESS and memory.
  ⏳ **2026-09-24, taken by session e71978cb.** Session 7061260e is not running (checked with ListAgents), and
  K11–K12 were in fact completed by e71978cb after the handoff note above, so that note is stale.

## Collection Index and an unbounded workspace — `COLLECTION_INDEX_BRIEF.md` (session e71978cb, in order)

The user's fourth brief (2026-09-16, sent to the docs session) adds two things:
- a Collection Index page, with every Collection as a large visual card;
- a Collection workspace with no page boundary.

It keeps everything above: a Collection is its own item; Grid ↔ Canvas show the same items; places are saved on
the items.

**✅ X1–X4 done 2026-09-16 by session e71978cb** — PROGRESS "The Collection Index, and a Collection without a page
boundary". K8–K13 stay with session 7061260e. X3 changed the layout of the Collection's bar (`collection-page.tsx`)
and the canvas frame, which K8 will also touch, so read both before editing either.

**Decisions (audit, 2026-09-16).**
- **The Index is a Documents view, `collections`,** beside Draft · All documents · Shared · Templates. It gets its
  own rail row and a deep link, `/documents?view=collections`.
  - **Why not its own route:** Documents already loads every page with its content, and already owns create,
    rename, duplicate, move and delete. A separate route would add a data loader (the perf session's files) and
    a second copy of each of those actions.
  - A Collection is still a document-kind page, so it also appears in All documents and in its folder.
- **A card's preview is made from the Collection's own items.**
  - Pictures come first, in the Collection's order, then tiles for items without a picture.
  - An empty Collection's card is the empty state, with a +.
  - A Collection open on this device previews from its store, because the page list's content is stale for it
    (see PROGRESS "Duplicate copies what is on screen").
- **Status, where applicable:** "Shared" when the page is shared to a client portal, and nothing otherwise.
  Private is the default, and a label on every card is noise. No collaborators: a space has one owner today.
- **Unbounded workspace:**
  - A Collection page drops the 820px document column, so the grid takes whatever width it is given.
  - The canvas fills the pane edge to edge, down to the bottom of the window, with no frame.
  - The "Full width" toggle leaves a Collection's menu. It never saved for one, because Documents does not write
    a Collection's content.
- **Deliberately not:**
  - **Items spanning columns in the grid:** Cosmos and Pinterest keep one column width, and the canvas is where
    a width is chosen.
  - **A top-level sidebar entry:** that is an IA change for the user. It is one line in `app-shell.tsx` once the
    Index exists.

**Tasks.**
- **X1 — The Index.** The `collections` view:
  - a rail row, with no count, like the rows beside it;
  - a header with "New collection" and sort;
  - a "New collection" card first;
  - one card per Collection: preview mosaic, icon and name, "N items", and "Shared" where it applies;
  - a click opens the Collection (a new one with its name selected);
  - copy for an empty Index; Trash unchanged.
- **X2 — What you can do from the Index.**
  - **Card menu:** Open · Rename (inline) · Duplicate · Copy link · Move to · Delete (to Trash, with Undo).
  - **Search:** by name, in the rail's field.
  - **Sort:** last edited · name · most items · created.
- **X3 — Unbounded workspace.** A full-width Collection page; a frameless canvas that fills the pane; no "Full
  width" toggle on a Collection.
- **X4 — Proof.**
  - Unit tests first: which items a preview shows, and the Index's sort and search.
  - A CDP check of the Index and the workspace, with trusted input.
  - Both themes and phone width.
  - PROGRESS and memory.
