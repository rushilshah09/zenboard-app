# Collection as a separate item — the user's third brief (supersedes the view briefs)

**Received:** 2026-09-15, after C1–C3 had shipped Collection as a database VIEW and C13 (canvas) had
started. This brief REVERSES that architecture: a Collection is its own first-class item, alongside a
Database, never a view of one. `COLLECTION_VIEW_BRIEF.md` and `COLLECTION_CANVAS_BRIEF.md` still
describe the experience inside a Collection (masonry, previews, collecting, canvas); where they place
Collection inside a Database, this brief wins. Plan: `COLLECTION_PLAN.md`.

---

The brief, verbatim:

DATABASE — ADD COLLECTION AS A SEPARATE BLOCK TYPE

Change the previous Collection implementation.

IMPORTANT:
Collection must NOT be a Database View.

Collection must be a completely separate block/item type inside the existing Zenboard Database system, similar to how a Database itself can be added as an individual block.

The structure should be:

Database
├── Database Block
├── Collection Block
├── Database Block
├── Collection Block
└── Collection Block

A Collection is its own independent item with its own name, content, and layout.

==================================================
1. ADD COLLECTION AS A NEW DATABASE ITEM
==================================================

Inside the existing Database creation/add-item system, add:

+ New
├── Database
└── Collection

When the user selects Collection:

Create a new standalone Collection block/item.

Example:

Collection
"My Design Inspiration"

The Collection should behave like an independent object inside Zenboard.

It should NOT appear as:

Database → Views → Collection

Instead:

Workspace/Page
├── Database
├── Collection
├── Database
└── Collection


==================================================
2. COLLECTION NAME
==================================================

Every Collection has its own name.

Example:

My Design Inspiration
Brand References
UI Inspiration
Typography
Research

The user can:

- Rename Collection
- Delete Collection
- Duplicate Collection
- Move Collection
- Open Collection
- Add items to Collection


==================================================
3. COLLECTION CONTENT
==================================================

A Collection is designed for collecting and organizing visual/reference content.

Users should be able to collect different types of content, including:

- Images
- Videos
- Links
- Websites
- Bookmarks
- Files
- Screenshots
- Other supported visual content

Each collected item remains an independent item inside the Collection.


==================================================
4. COLLECTION MAIN VIEW
==================================================

When the user opens a Collection, display the collected items in a responsive masonry grid.

The visual experience should be inspired by:

- Pinterest
- Cosmos

Use them only as interaction/reference inspiration.

Do not copy their visual design.

Items can have different:

- Aspect ratios
- Heights
- Widths

Do not force every item into identical cards.

The masonry layout should feel visual, flexible, and editorial.


==================================================
5. VIEW CANVAS
==================================================

Inside every Collection, provide:

View Canvas

When the user selects View Canvas:

Open an infinite canvas containing all items from that Collection.

Every collected item becomes an independent draggable object on the canvas.

Example:

Collection
"My Design Inspiration"

Masonry:

[Image] [Image] [Image]
[Image] [Video]
[Image] [Image]

Canvas:

        [Image]

[Image]          [Video]

              [Image]

      [Image]          [Image]


==================================================
6. INFINITE CANVAS
==================================================

Canvas must support:

- Infinite workspace
- Pan
- Zoom in
- Zoom out
- Drag items
- Resize items
- Multi-select items
- Move multiple items
- Freely arrange items
- Delete items
- Add new items

Users should have complete freedom to visually organize their Collection.


==================================================
7. SAVE CANVAS POSITIONS
==================================================

Every Collection must remember its Canvas arrangement.

Save:

- X position
- Y position
- Width
- Height
- Z-index/layer when required

When the user leaves and reopens the Collection:

Restore the exact Canvas arrangement.

Canvas positioning belongs to the Collection item layout and should not modify the original content.


==================================================
8. MASONRY AND CANVAS ARE TWO PRESENTATIONS OF THE SAME COLLECTION
==================================================

The Collection itself is one object.

It has two ways to browse its content:

Collection
├── Masonry Grid
└── Canvas

The collected items are shared between both.

Do not create duplicate content when switching between Masonry and Canvas.

Masonry automatically arranges the items.

Canvas uses the user's saved freeform positions.


==================================================
9. COLLECTION DATA MODEL
==================================================

Do not treat Collection as a Database View.

Collection should have its own entity/type.

Conceptually:

Collection
- id
- name
- description
- items
- canvas settings
- createdAt
- updatedAt

CollectionItem
- id
- collectionId
- content
- contentType
- metadata
- canvasX
- canvasY
- canvasWidth
- canvasHeight
- createdAt
- updatedAt

Use stable IDs.

Do not use array indexes as IDs.


==================================================
10. COLLECTION VS DATABASE
==================================================

Keep the concepts completely separate.

DATABASE:

Structured information/data.

Examples:

- Table
- Board
- List
- Calendar
- Database records
- Properties
- Filters
- Sorting

COLLECTION:

Visual/reference gathering.

Examples:

- Images
- Inspiration
- Websites
- Videos
- Screenshots
- Visual references

Do not force Collection into the Database View architecture.


==================================================
11. EXISTING DATABASE MUST REMAIN UNCHANGED
==================================================

Do not modify or break:

- Existing Database views
- Table
- Board
- List
- Calendar
- Database properties
- Database filters
- Database sorting
- Database records
- Existing Database interactions

Collection should be added alongside Database as a new independent item type.


==================================================
12. COLLECTION CREATION UX
==================================================

Wherever the user currently has an option to add/create a Database item, add Collection as another option.

Example:

Create
────────────
Database
Collection
────────────
Other existing items

Selecting Collection should immediately create/open a new Collection with a default name such as:

New collection

The user can then rename it.


==================================================
13. IMPORTANT ARCHITECTURE RULE

Do NOT implement:

Database
→ Views
→ Collection

Implement:

Workspace/Page
→ Database Item
→ Collection Item

Collection is a first-class standalone item in Zenboard.

It should have its own:

- identity
- data
- content
- permissions where applicable
- UI
- interactions
- persistence
- canvas state


==================================================
14. FINAL EXPERIENCE

The user experience should be:

Create
→ Collection

New collection
→ Rename it
→ Start collecting content

Collection opens
→ Masonry Grid

View Canvas
→ Infinite Canvas

Masonry:
Automatically organized visual grid.

Canvas:
Freely arranged infinite visual board.

The core concept is:

DATABASE = structured information

COLLECTION = visual gathering and organization

Both are independent first-class items inside Zenboard.
