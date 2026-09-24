# Collection view — the plan

**Status:** SUPERSEDED 2026-09-15 by `COLLECTION_PLAN.md`. The user's third brief (`COLLECTION_ITEM_BRIEF.md`)
made Collection its own item beside a Database, never a view of one, and the view described below was taken
back out of databases. Kept as history. **Source:** `COLLECTION_VIEW_BRIEF.md` (the user's brief,
verbatim), started 2026-09-15 on the user's instruction: *"immediately start working on collection task
this is imp now"*. Subordinate to `DESIGN_CONSTITUTION.md`, `SPRINT_RULES.md` and the database plan's
established rules (`DATABASE_EXPERIENCE_PLAN.md`).

A Collection is a **layout** of a database, like Table or Gallery: the same rows, the same
properties, another way to see them. It is never a separate database type (brief §1–3, §44).

---

## Audit — what exists, and what Collection builds on

| Brief | Area | Today | Collection's use |
|---|---|---|---|
| §1–3, §44 | Views | `ViewKind` + `VIEW_LABEL`, `OPEN_IN_DEFAULT`, `layoutOptions` (lib/collections.ts); `VIEW_ICON`, `VIEW_CHOICES` (view-icons.ts); one renderer per layout mounted in database-view.tsx | `collection` joins every registry and gets a renderer, `database-collection.tsx` |
| §2, §21 | New database | `defaultCollection(kind)`, `newDatabase({ kind })`; slash entries typed by `BlockMenuItem['db']` with a drawn preview each | `defaultCollection('collection')` = the collecting schema; a "Collection view" slash entry |
| §13–15 | Cards | `db-card.tsx` (`CardContent`, `CardMenu`, `PagePreview`); `DatabaseGallery` is a uniform grid | a preview-FIRST card in a masonry |
| §6–8, §33–35 | Link metadata | `/api/unfurl` (oEmbed first, then og tags, SSRF-guarded, signed-in only); `lib/unfurl.ts` `LinkMeta`; `useLinkMeta` (client cache); `lib/platforms.ts` (`platformOf`, `platformThumbnail`, `youtubeId`, `isMissingThumbnail`); DS `LinkMark` | reused as they are; Collection adds TYPE detection and the picture rule |
| §37 | Remembering previews | Content's `meta.preview` (`readPreview`, `freshPreview`, `previewFrom`, 30 days) | reused shape when previews are remembered on a row (C3) |
| §5, §12 | Files | attachments (0033): `uploadAttachment({ page_id }, file)`, signed URLs, `attachmentKind`; a row IS a page, so it can own them. `files` is a PAGE-only property with no database cell | C4 makes Files & media a database property with a cell |
| §17–18 | Opening an item | PageView, per-view "Open pages in" (T6), row pages with bodies | Collection opens pages in the centre by default |
| §25–32 | Filter · sort · group · search | engine filters/sorts/groups; toolbar search; `newRowValues` | reused; Collection groups render as sections |

## Tasks, in order

Each task lands with tests watched failing first, a real-input browser check in both themes and at
phone width, and a `PROGRESS.md` entry.

- **C1 — Collection is a view.** ✅ 2026-09-15. Registered everywhere a layout is (label, glyph, center
  peek, view picker, `/collection`, its slash preview). A new Collection database starts with the
  collecting properties (Name, URL, Type, Source, Tags, Author, Published, Description, Created). A
  responsive masonry of preview-first cards: picture, then title, then source; tags only when set. The
  picture is the platform's thumbnail, else an address that is itself an image, else the link's own
  image, else an intentional tile naming the type and the domain. Items open in a center peek.
  Switching layouts keeps every row and property. Check: `scripts/verify/verify-collection.mjs`.
- **C2 — The preview system.** ✅ 2026-09-15. One rule for an item's picture (platform → image
  address → remembered preview → live metadata → a tile shaped like its type); previews and picture
  shapes remembered on the row as a cache (`rememberContent`), so the masonry does not settle; an
  expired picture is asked for again; lazy loading. Uploads join the rule with C4.
- **C3 — Collect by pasting.** ✅ 2026-09-15.
  - **Page paste:** links pasted on a Collection's page, or into "Add to collection" (its New), become items
    at once, on top, in pasted order, as one undoable step.
  - **At once:** URL, Type and Source are filled from the address.
  - **Behind the item:** Name, Author, Description, Published and the preview are filled from the link,
    never over what the person typed.
  - **Card states:** "Fetching preview…" while asking; "Untitled resource" / "Preview unavailable" when
    the link says nothing.
  - **Found on the way:** `orderPrepend` (the key floor), `fill` surviving redo, and the width of a
    Collection that starts empty.
  - **Check:** `scripts/verify/verify-collect.mjs`.
  - **Harness fixture times made identical on server and client** ✅: the documents harness hydrates on
    every load.
- **C13 — Canvas mode.** From the user's second brief (`COLLECTION_CANVAS_BRIEF.md`, 2026-09-15 13:54).
  Scheduled NEXT, right after C3; numbered after C12 so the earlier references stay true. A Collection
  view has two modes, Masonry and Canvas, and "View canvas" switches between them. The canvas shows the
  same filtered and searched rows on an infinite surface: drag, resize, select one or many (shift,
  marquee), move many together, zoom, pan, and "Remove from view", which hides the row from this view
  and never deletes it. Positions and sizes belong to the VIEW (`rowId → x, y, w, h`), never to the
  record. They are restored on return, stay independent of the masonry, and are pruned when a record
  is deleted. A move or a resize is an undoable step; the camera (zoom, pan) is each viewer's own.
  **Steps, shipped as one feature:**
  1. **The model.** `ViewDef.collectionMode` (grid | canvas), `ViewDef.canvas` (rowId → x, y, w, h) and
     `ViewDef.removed`, each read through `normalizeViews`. The pure geometry lives in `lib/canvas.ts`:
     camera, zoom about the pointer, fit, marquee, the masonry unplaced cards open as, move, resize, and
     what is saved.
  2. **One card for both layouts** (`collection-card.tsx`). The grid opens a card on click; the canvas
     selects it, and opens it on double-click or Enter.
  3. **The surface** (`collection-canvas.tsx`), a dotted ground:
     - **Navigate:** wheel and trackpad pan; ⌘/Ctrl-wheel and pinch zoom about the pointer; Space-drag and
       middle-drag pan; − · 100% · + · Fit.
     - **Select:** click, Shift, marquee, ⌘A; Escape clears.
     - **Arrange:** move one or many, resize from a corner, arrow keys nudge.
     - **Undo:** each gesture is ONE undoable change to the view. The first gesture writes the whole
       arrangement, so nothing reflows when one card moves.
  4. **The switch.** Grid | Canvas in the Collection's toolbar (`SegmentedControl`), kept on the view. The
     camera is kept per viewer in the browser. The frame fills the page below the toolbar (a fixed height
     inside a document).
  5. **A selection bar** (count · Open · Remove from view · Delete), built to be shared with C5.
  6. **Checks.** Unit tests first; `scripts/verify/verify-canvas.mjs` with trusted pointer input.
- **C4 — Files.** Files & media becomes a database property with a cell; drop or pick files → one item
  each (images preview themselves, PDFs and others get their tile); the drop zone appears only while
  dragging.
- **C5 — Hover and selection.** Actions revealed on hover (Open, Copy link, Open source, More);
  select on hover, shift-select, select all; a quiet action bar (Tag, Open, Delete, More).
- **C6 — Toolbar and view settings.** Layout (Masonry/Grid), Card size, Preview (Cover/Fit/Original),
  property visibility, Open pages in; the shared toolbar.
- **C7 — Organise.** Grouping as sections (Source, Type, Tag, any property); sorting including manual
  order by drag.
- **C8 — The item's page.** Picture, properties, "Open website / Watch on YouTube / Open PDF", notes
  in the body.
- **C9 — Search** across title, URL, domain, source, author, description, tags and notes.
- **C10 — Documents and linked views.** `/collection` inside a document, linked Collection views,
  property compatibility across layouts audited.
- **C11 — Performance.** Sized thumbnails, virtualised rendering for hundreds of items.
- **C12 — The final audit** (brief §34–44).

## Decisions

- **Facts are properties.** URL, Type, Source, Author, Published and Description are ordinary
  properties, so Table, Board, filter, sort and search all read them and nothing is lost when the
  layout changes (§25–27).
- **Type is a fixed vocabulary** (Website, Image, Video, PDF, Document, Social post, Audio, File,
  Other). **Source is open**: a known platform's name, else "Website"; options are created as sources
  appear, so a new platform needs no code (§33).
- **A canvas arrangement belongs to the view, not the record** (canvas brief: "stored separately from
  the database record itself"). Positions live in the view definition, JSON the database already
  saves, so no migration is needed. Moving a record never changes its properties or content, and two
  Collection views of one database can be arranged differently.
- **Masonry keeps reading order.** Cards are placed row by row into the shortest column, so the DOM, the
  tab order and manual order all agree. CSS columns would read column by column.
