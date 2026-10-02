# User brief — Collection: infinite grid + Collection Index page (verbatim)

Received 2026-09-16 00:1x IST, mid-turn, in session e71978cb (the docs session). The fourth Collection brief. It
keeps `COLLECTION_ITEM_BRIEF.md` (Collection is its own item, never a database view) and adds a Collection Index
page and an unbounded Collection workspace. Plan: `COLLECTION_PLAN.md`.

---

COLLECTION — INFINITE GRID + COLLECTION INDEX PAGE

Update the existing Collection implementation.

Collection is a separate first-class block/item in Zenboard, not a Database View.

The Collection should work as a visual, infinite collection system inspired by Cosmos and Pinterest.

==================================================
1. COLLECTION INDEX PAGE
==================================================

Create a dedicated Collection Index page where users can see all of their Collections.

The Index page should look and behave like a visual collection library.

Display Collections in a responsive grid.

Each Collection should appear as a large visual card containing:

- Collection cover/preview
- Collection name
- Number of collected items
- Privacy/status information where applicable
- Optional collaborators/metadata

Example:

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│              │  │              │  │              │
│   Preview    │  │   Preview    │  │   Preview    │
│              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
  Brand Ideas      UI Inspiration   Web References
  42 elements      86 elements      18 elements

The Index page should feel visual and editorial, not like a traditional database table.

Include a “New Collection” card/button at the beginning of the grid.

==================================================
2. COLLECTION CREATION
==================================================

When the user creates a Collection:

- Create a new independent Collection.
- Give it a default name such as “New collection”.
- Open the Collection.
- Allow the user to rename it.
- The Collection should immediately appear on the Collection Index page.

==================================================
3. COLLECTION ITSELF = INFINITE VISUAL GRID
==================================================

A Collection should not be limited to a fixed page or fixed number of columns.

The main Collection workspace should behave as an infinite visual grid/canvas.

Users can continuously add content to the Collection.

Collected items should remain independent objects.

Example:

Collection
"My Design Inspiration"

        Item        Item

 Item          Item       Item

             Item

    Item                Item

Item        Item

There should be no artificial page boundary.

==================================================
4. COLLECT ANYTHING
==================================================

Users should be able to add/collect different types of content into a Collection:

- Images
- Videos
- Websites
- URLs
- Bookmarks
- Screenshots
- Files
- Design references
- Supported media/content

Every collected item should retain its original content and metadata.

==================================================
5. VISUAL GRID
==================================================

The default Collection experience should organize content visually.

Use a responsive masonry-style layout where appropriate.

Items can have different:

- Aspect ratios
- Widths
- Heights

Do not force every item into identical cards.

The layout should feel similar to a visual inspiration library such as Cosmos/Pinterest, while using Zenboard's own design system.

==================================================
6. CANVAS MODE
==================================================

Provide a “View Canvas” option inside the Collection.

When enabled:

- Switch from the automatic visual grid to an infinite freeform canvas.
- Show the same collected items.
- Every item becomes independently draggable.
- Users can position items anywhere.
- Users can resize items.
- Users can select multiple items.
- Users can move multiple selected items together.
- Users can zoom and pan.

The Collection should therefore support:

AUTO GRID
↔
FREEFORM CANVAS

==================================================
7. SAME COLLECTION DATA

Grid and Canvas must use the exact same Collection items.

Do NOT duplicate items.

Do NOT create a separate dataset for Canvas.

Conceptually:

Collection
 ├── Item A
 ├── Item B
 ├── Item C
 └── Item D

Grid View
→ automatically arranged

Canvas View
→ freely arranged

Both are displaying the same Collection.

==================================================
8. CANVAS POSITION

Canvas-specific positioning should be saved independently for every item.

Store:

- X position
- Y position
- Width
- Height
- Layer/order where required

When the user returns to Canvas View, restore the previous arrangement exactly.

==================================================
9. COLLECTION INDEX PREVIEW

The Collection Index should automatically generate a visual preview for each Collection.

Preferably use a selection of the Collection's collected items to create the preview.

For example:

Collection with 50 items
→ Index card displays a curated preview/grid of several items.

If the Collection is empty:

Show an empty Collection state with:

“New collection”

and a simple + action.

Do not require users to manually upload a cover unless that functionality is explicitly added later.

==================================================
10. COLLECTION INDEX INTERACTIONS

From the Index page users should be able to:

- Open Collection
- Create Collection
- Rename Collection
- Delete Collection
- Duplicate Collection
- Search Collections
- Sort Collections where appropriate

Opening a Collection should take the user directly into its visual workspace.

==================================================
11. DESIGN DIRECTION

Use the provided Cosmos/Pinterest references for:

- Information hierarchy
- Visual browsing
- Collection previews
- Masonry inspiration
- Visual discovery
- Infinite/freeform organization

Do NOT copy their branding or exact UI.

Use the existing Zenboard design system:

- Black and white foundation
- Neutral colors
- Existing typography
- Existing spacing
- Existing components
- Minimal accent color
- Existing navigation/app shell

The Collection system should feel native to Zenboard.

==================================================
12. IMPORTANT STRUCTURE

The final structure should be:

Zenboard
│
├── Database
│
├── Collection
│
├── Collection
│
├── Database
│
└── Collection

Collection Index
│
├── Collection Card
├── Collection Card
├── Collection Card
└── New Collection
       
Open Collection
│
├── Visual Grid
│
└── Canvas Mode

Collection is a first-class standalone item.

It is NOT:

Database → Collection View

It is:

Workspace/Page → Collection

==================================================
FINAL EXPERIENCE

The user should experience Zenboard Collections as:

Collection Index
→ See all collections visually
→ Create a new Collection
→ Open Collection
→ Collect anything
→ Browse everything in an infinite visual grid
→ Switch to Canvas
→ Freely arrange, move, resize, zoom, and organize items
→ Return later and continue exactly where they left off.

CORE CONCEPT:

COLLECTION = A VISUAL, INFINITE SPACE FOR COLLECTING AND ORGANIZING ANYTHING.

The Index page is the library of Collections.
The Collection is the infinite visual workspace.
The Grid is the automatic organization.
The Canvas is the freeform organization.
