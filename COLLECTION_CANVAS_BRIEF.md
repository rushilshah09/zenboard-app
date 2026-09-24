# Collection view + Canvas view — the user's second brief

**Received:** 2026-09-15, 13:54 IST, mid-turn, while COLLECTION_VIEW_PLAN C3 (collect by pasting) was
in progress. **Status:** scheduled in `COLLECTION_VIEW_PLAN.md` as **C13 — Canvas mode**, next after C3.
It extends `COLLECTION_VIEW_BRIEF.md`; where they differ, this one is newer.

**Attachments:**
- A screen recording: `~/Downloads/Screen Recording 2026-09-15 at 1.54.05 PM.mp4`.
- Four Cosmos screenshots, used as interaction references only:
  1. A create-menu item: "Collection — A collection of elements", with a panel-layout glyph.
  2. A grid of collections: a "New collection" tile with a plus, then cover tiles each named with a count
     ("Unsorted Elements · 44 elements · Private").
  3. The browsing masonry, dimmed behind a small "New collection" dialog: a name, a "Make private"
     switch, and a "Create collection" button.
  4. An open collection ("Unsorted Elements"): a dense masonry of pictures only, with no titles or
     borders, under a floating bar showing the collection's name and "Search in Unsorted Elements…".

---

The brief, verbatim:

DATABASE — COLLECTION VIEW + CANVAS VIEW

Extend the existing Zenboard Database system by adding a new database view called “Collection”.

This is NOT a separate standalone feature. Collection is another view inside the existing Database system and must use the existing database records, properties, filters, sorting, permissions, and data architecture.

Do not rebuild or replace the current Database system.

COLLECTION VIEW

Add a new database view type:

Collection

The Collection view should be inspired by Pinterest and Cosmos in terms of how visual content is browsed and organized.

When a user creates or opens a Collection view:

- Display database records as a responsive masonry grid.
- Each database record becomes an individual visual item.
- Support different image sizes and aspect ratios.
- Automatically create a balanced masonry layout.
- Use the existing database properties and record data.
- Do not create duplicate records.
- The Collection view must always stay connected to the original database.

DATABASE → COLLECTION

Users should be able to add/collect items into the Collection view from the existing database.

Each collected item must remain a normal database record.

The same record can continue to exist in:

- Table view
- Board view
- List view
- Calendar view
- Collection view
- Any future database views

Changing a record in one view must update the same record everywhere.

COLLECTION VIEW CONTROLS

Provide the standard database controls already available in Zenboard, including where applicable:

- Filter
- Sort
- Search
- Group
- Properties
- View settings

Do not create a separate filtering or data system for Collections.

Use the existing Database filtering, sorting, and property infrastructure.

VIEW CANVAS

Add a “View Canvas” action to the Collection view.

The Collection database view should support:

Masonry Grid
↔
Canvas

When the user selects “View Canvas”:

- Open an infinite canvas for the current Collection view.
- Display the same filtered database records on the canvas.
- Each record becomes an independent draggable canvas item.
- Do not duplicate the database records.
- The canvas is only another visual representation of the same database records.

CANVAS INTERACTION

Users should be able to:

- Drag records anywhere on the infinite canvas.
- Reposition records freely.
- Resize records.
- Select one or multiple records.
- Move multiple selected records together.
- Zoom in and out.
- Pan across the infinite canvas.
- Organize records visually.
- Remove a record from the current Collection view when appropriate.

The canvas should feel like a freeform visual workspace.

POSITION PERSISTENCE

Canvas-specific properties must be stored separately from the database record itself.

For example:

recordId
canvasX
canvasY
canvasWidth
canvasHeight

When a user moves or resizes a record:

- Save its canvas position.
- Save its canvas size.
- Restore the position when returning to Canvas View.
- Do not change the underlying database record content.

MASONRY ↔ CANVAS

Switching between views must never duplicate, delete, or modify the underlying records.

Example:

Database:

Record A
Record B
Record C
Record D

Collection View:

A
B
C
D

Canvas View:

A      C

   B

          D

These are still the same four database records.

MASONRY VIEW

The masonry layout should be automatically generated based on the records and their visual content.

Canvas positioning should be independent from the automatic masonry layout.

Do not force Canvas positions back into the masonry layout.

DATABASE INTEGRATION

Collection must respect the current database state.

If a user applies:

Filter → only matching records appear.

Sort → Collection respects the selected sorting where applicable.

Search → Collection shows matching records.

Properties → Collection uses the selected database properties.

When a database record is edited:

The change must immediately be reflected in Collection View and Canvas View.

When a record is deleted from the database:

It must disappear from all database views, including Collection and Canvas.

DESIGN

Use Pinterest and Cosmos only as interaction/reference inspiration.

Do NOT copy their visual design.

Collection must use the existing Zenboard design system:

- Existing typography
- Existing spacing
- Existing colors
- Black and white foundation
- Minimal accent color
- Existing borders
- Existing components
- Existing database UI
- Existing app shell

Do not introduce a separate design system.

ARCHITECTURE

Collection must be implemented as a database view type.

Conceptually:

Database
├── Table View
├── Board View
├── List View
├── Calendar View
└── Collection View
      ├── Masonry Mode
      └── Canvas Mode

All views use the same database records.

Do not create a separate Collection database.

Do not duplicate records.

Do not create a separate data source.

The Database remains the source of truth.

FINAL EXPERIENCE

The user should be able to:

Database
→ Create “Collection” view
→ See records in a Pinterest/Cosmos-style masonry grid
→ Filter/search/sort using existing database controls
→ Select “View Canvas”
→ See the same records on an infinite canvas
→ Drag, resize, and arrange records freely
→ Leave the canvas
→ Return later
→ Find the exact same canvas arrangement

Core principle:

ONE DATABASE
ONE SET OF RECORDS
MULTIPLE VIEWS

Table
Board
List
Calendar
Collection Grid
Collection Canvas

Collection is simply a new visual database view, not a separate product or data system.

---

## Observed in the recording (frames read 2026-09-15)

The recording is 35 seconds of Cosmos, on its "Unsorted Elements" collection — reference, not Zenboard.
- **Create menu:** Collection ("A collection of elements"), Element ("Media, URL, or note"), Import ("From
  Pinterest, Are.na or Tumblr"), Chrome extension.
- **The collection page:** name, owner and privacy, a line of description, a row of round actions (New ·
  Similar · Organize · Share · More), then a five-column masonry of pictures with no titles. A hovered card
  shows the collection it is saved to, and "Saved".
- **"View canvas" lives in More:** Edit details · Make public · Pin collection · Invite collaborators ·
  View canvas · Export collection · Delete collection.
- **The canvas starts AS the masonry.** The same arrangement becomes a surface that pans in every
  direction: columns run off every edge, the page header is gone, and a small floating toolbar (a plus
  and round controls) sits over it. Nothing jumps when it opens; arranging starts from where things were.
- **A failed import is still a card:** "Only visible to you · Import failed. This Pinterest is set to
  private.", with a link action and a delete action.
