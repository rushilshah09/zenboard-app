# Collection — a new database view (the user's brief)

**Status:** ⏳ in progress since 2026-09-15 13:20 IST (docs session, on the user's instruction to
start it immediately). Plan and task status: `COLLECTION_VIEW_PLAN.md`. Governing. **Source:** user directive, 2026-09-14 16:01 UTC,
given with six Cosmos/Pinterest reference images: *"once you completed the database take after
this you work on this task."* It runs after `DATABASE_EXPERIENCE_PLAN.md` T1–T15.

It was queued into a session mid-turn and dropped from that session's summary when it
compacted three minutes later, so it is kept here VERBATIM — the plan written from it will live
in `DATABASE_EXPERIENCE_PLAN.md`, but this file is what it is checked against.

---

Master Prompt  Add “Collection” as a New Zenboard Database View
Use the uploaded reference images as the primary inspiration for this feature. The references show the visual and interaction patterns of Cosmos, Pinterest-style collections, saved inspiration boards, social content collections, and visual bookmarking tools.
I want to introduce a new database view in Zenboard called Collection.
This should not be a separate product or a separate feature outside the database system. Collection must be a first-class database view, just like Table, Board, Gallery, List, Calendar, and Timeline.
The core idea is:
A Zenboard Collection is a flexible visual database where users can collect anything from anywhere and organize it into a visual library.
Users should be able to collect a YouTube video, Instagram post, Facebook post, Pinterest pin, website, article, image, PDF, uploaded file, design reference, social post, or any other useful resource and have Zenboard automatically turn it into a beautiful visual collection item.
1. Add “Collection” to Database Views
The database view selector should now include:

* Table
* Board
* Gallery
* List
* Calendar
* Timeline
* Collection

Collection should behave exactly like the other database views.
For example:

```
Projects Database

Table
Board
Gallery
List
Calendar
Timeline
Collection
```

The important part is that Collection does not create a new database type.
It is simply another presentation layer for the same database.
2. Same Database, Multiple Views
A user should be able to create a database as normal:

```
New database
```

Then choose:

```
Collection
```

But later they should be able to switch that same database to:

```
Table
Board
Gallery
List
Collection
...
```

The underlying records remain the same.
For example:

```
Collection View
        ↓
[YouTube] [Instagram] [Website] [PDF]

Switch to Table
        ↓

Name | URL | Type | Source | Tags | Created

Switch to Board
        ↓

Not started | In progress | Done
```

Nothing should be lost when changing views.
3. What Makes Collection Different?
Collection is specifically optimized for visual discovery and reference collecting.
Instead of showing information primarily as rows or task cards, it should prioritize:

1.  Preview/image 
2.  Title 
3.  Source 
4.  Content type 
5.  Metadata 
6.  Tags 
7.  User-defined properties 

The visual should be the first thing users recognize.
Think:
Pinterest + Cosmos + Notion Database
but integrated directly into the Zenboard document/database system.
4. Users Can Collect Anything
The Collection database should accept many different types of content.
Web content
Users can paste:

*  Website URLs 
*  Articles 
*  Blogs 
*  Landing pages 
*  Design websites 
*  Portfolios 
*  Online resources 
*  Random websites 

Social media
Support URLs from:

*  YouTube 
*  Instagram 
*  Facebook 
*  Pinterest 
*  X 
*  TikTok 
*  LinkedIn 
*  Reddit 
*  Substack 
*  Other supported platforms 

Do not design the system around only a fixed list of platforms.
It should have a generic fallback for unknown websites.
5. Files and Uploads
Users should also be able to add:

*  JPG 
*  PNG 
*  WEBP 
*  GIF 
*  SVG 
*  PDF 
*  Video 
*  Audio 
*  Documents 
*  Screenshots 
*  Design files 
*  Other supported file types 

The Collection should not be limited to URLs.
A user should be able to drag a file directly into the collection.
6. Smart Automatic Metadata
When a user pastes a URL, Zenboard should automatically attempt to extract useful information.
For example:

```
Paste URL
        ↓
Fetch metadata
        ↓
Identify source
        ↓
Fetch preview image
        ↓
Fetch title
        ↓
Fetch description
        ↓
Create Collection item
```

Automatically detect:

*  Title 
*  Thumbnail 
*  Description 
*  URL 
*  Domain 
*  Platform 
*  Author 
*  Profile/account name 
*  Published date 
*  Content type 
*  Video duration where available 
*  Image dimensions where available 

Do not force users to manually enter all of this.
7. Thumbnail Fetching
This is extremely important.
When a user pastes a URL, automatically look for the best available visual.
Priority should roughly be:

1.  Platform-specific thumbnail 
2.  Open Graph image 
3.  Twitter/X card image 
4.  Website preview image 
5.  Embedded media thumbnail 
6.  Favicon/domain identity 
7.  Generated fallback preview 

For example:
YouTube
Show:

*  Video thumbnail 
*  Video title 
*  Channel 
*  Duration 
*  YouTube icon 

Instagram
Show:

*  Post/reel preview 
*  Account name 
*  Caption excerpt where available 
*  Instagram icon 

Website
Show:

*  Website preview/image 
*  Page title 
*  Domain 
*  Description 

Pinterest
Show:

*  Pin image 
*  Pin title 
*  Pinterest identity 

8. When No Thumbnail Exists
Do not leave the collection card looking broken.
If there is no useful visual available, create a beautiful fallback.
Possible fallback:

```
┌──────────────────────┐
│                      │
│       Website        │
│                      │
│       example.com    │
│                      │
└──────────────────────┘
```

Or generate a simple document-style preview depending on the content type.
For PDFs:

*  Show the first-page preview. 

For documents:

*  Show a document preview. 

For links without images:

*  Show domain + title + content type. 

For unsupported content:

*  Show a clean generic resource card. 

The fallback must still look intentional.
9. User-Controlled Titles
Automatic metadata should make collecting fast, but users must remain in control.
When an item is created:

```
Title: automatically fetched title
```

The user can change it to:

```
Title: Amazing typography reference
```

This should be extremely easy.
The user should never be forced to keep the original website title.
10. Quick Collection Flow
The fastest possible workflow should be:

```
Copy something
        ↓
Open Zenboard
        ↓
Paste
        ↓
Collection item appears
```

Ideally:
Paste → preview → done.
No multi-step form.
No mandatory property configuration.
No waiting for a separate page to open.
11. Collection “New” Flow
Clicking:

```
+ New
```

should provide an extremely lightweight creation experience.
For example:

```
Add to collection

Paste a link or upload a file...

[ URL input ]

or

Drop files here
```

After pasting:

```
Fetching preview...
```

Then immediately:

```
[Preview]

Title
Source
Tags
```

The item should appear optimistically and metadata can continue loading in the background.
12. Drag and Drop
Collection should have excellent drag-and-drop behavior.
Users should be able to:

*  Drag files into the collection. 
*  Drag images into the collection. 
*  Drag URLs into the collection where the browser provides them. 
*  Reorder items where manual ordering is enabled. 
*  Move items between collection databases where supported. 

The drop zone should appear only when needed.
Do not keep a giant upload area permanently visible.
13. Collection Layout
The visual layout should be inspired by Cosmos/Pinterest-style visual discovery, but should remain consistent with Zenboard.
Use a responsive grid.
For example:

```
┌──────────┐ ┌──────────────┐ ┌─────────┐
│          │ │              │ │         │
│  Image   │ │    Image     │ │  Image  │
│          │ │              │ │         │
├──────────┤ ├──────────────┤ ├─────────┤
│ Title    │ │ Title        │ │ Title   │
│ Source   │ │ Source       │ │ Source  │
└──────────┘ └──────────────┘ └─────────┘
```

But do not make every card identical in height if the content naturally benefits from different aspect ratios.
Explore a masonry-style layout where appropriate.
The layout should feel:

*  Visual 
*  Dense but breathable 
*  Editorial 
*  Lightweight 
*  Calm 
*  Discoverable 

14. Collection Card
Each card should have a clear hierarchy.
Primary
Visual preview.
Secondary
Title.
Tertiary
Source/domain.
Optional
Tags, author, date, content type, or other selected properties.
Example:

```
┌─────────────────────────┐
│                         │
│       PREVIEW           │
│                         │
│                         │
└─────────────────────────┘
Typography system for    ← title
Awwwards                 ← source

#Typography  #Reference
```

Do not overload the card with properties.
15. Hover Interaction
The reference images show that the collection should feel interactive without becoming noisy.
On hover:

*  Slightly reveal actions. 
*  Show save/open/edit controls. 
*  Show source/platform. 
*  Show selection state. 
*  Allow quick actions. 

Possible actions:

```
Open
Edit
Copy link
Move
Tags
More
```

Keep these hidden until needed.
16. Card Selection
Users should be able to select multiple items.
Support:

*  Checkbox/selection on hover. 
*  Shift selection. 
*  Multi-select. 
*  Select all. 

Once selected, show a lightweight action bar.
Example:

```
3 selected

Move    Tag    Open    Delete    More
```

Do not permanently show selection controls on every card.
17. Opening a Collection Item
A Collection item is still a database page.
Clicking an item should open the same Zenboard page system.
Use the page-opening behavior we defined previously:

*  Side peek 
*  Center peek 
*  Full page 

For Collection, I recommend:
Default: Center peek
because the user is usually inspecting a visual reference rather than navigating through a task.
But make it configurable through the view settings.
18. Collection Item Page
When the user opens a collection item, the page should contain:

```
[Preview]

Title

Source
Type
URL
Author
Tags
Created
...

Content
```

For a website:

```
Website preview
↓
Open website
```

For YouTube:

```
Video preview
↓
Watch on YouTube
```

For a PDF:

```
PDF preview
↓
Open PDF
```

For an uploaded image:

```
Large image preview
↓
File information
```

The page should still support the complete Zenboard editor.
The user should be able to write notes underneath the collected item.
This is important.
19. Collection + Documents
This is where the feature becomes much more powerful.
A user should be able to create:

```
Document
    ↓
Collection database
    ↓
References
```

For example:
Brand research document

```
Brand Research

Competitor references

[ Collection ]

Nike
Apple
Aesop
Patagonia
...
```

Users can collect references directly inside their document.
The collection is not separate from the document system.
It is part of it.
20. Collection Inside a Database
A user should also be able to insert Collection into any document using:

```
/
```

The command menu should include:

```
Collection view
```

or:

```
Database → Collection
```

For example:

```
/collection
```

should allow:

```
Collection view
```

to be inserted immediately.
21. Collection as a Database Default
When creating a new database, allow:

```
New database

Table
Board
Gallery
List
Calendar
Timeline
Collection
```

If the user selects Collection, create a database optimized for collecting resources.
But remember:
It is still the same database architecture.
22. Recommended Collection Properties
We need to carefully define which properties Collection supports by default.
I recommend these default properties:
Required/core
Name

*  Title of the collected item. 

Preview

*  Image/video/document preview. 

URL

*  Original source URL. 

Type

*  Website 
*  Image 
*  Video 
*  PDF 
*  Document 
*  Social post 
*  Audio 
*  File 
*  Other 

Source

*  YouTube 
*  Instagram 
*  Pinterest 
*  Website 
*  X 
*  Facebook 
*  etc. 

Useful
Tags

*  User-defined tags. 

Author

*  Creator/account/person. 

Created

*  When the item was added. 

Published

*  Original publication date when available. 

Description

*  Extracted or user-written description. 

23. User-Defined Properties
Users should still be able to add normal Zenboard properties.
For example:

```
Name
Preview
URL
Type
Source
Tags
Status
Priority
Rating
Notes
Project
Client
Date
Person
```

Do not restrict the user so much that Collection becomes inflexible.
However, the default Collection experience should remain clean.
24. Properties That Should Be Special in Collection
Some properties should have special behavior.
Preview
This should be a first-class visual property.
It should support:

*  Image 
*  Video thumbnail 
*  PDF preview 
*  Website preview 
*  Uploaded file preview 

URL
Automatically recognize and enrich URLs.
Source
Automatically identify the platform/domain.
Type
Automatically identify the content type.
These three properties should work together.
For example:

```
URL
youtube.com/...

Source
YouTube

Type
Video

Preview
YouTube thumbnail
```

25. View-Specific Property Rules
Do not make every property equally prominent in every view.
For example:
Collection
Prioritize:

```
Preview
Name
Source
Type
Tags
```

Table
Show:

```
Name
Type
Source
URL
Tags
Created
```

Board
Group by:

```
Status
```

Gallery
Prioritize:

```
Preview
Name
Tags
```

The underlying data remains identical.
Only presentation changes.
26. Switching Collection to Other Views
This needs special attention.
If a user creates:

```
Collection database
```

and then changes the view to Table:
Do not lose anything.
The table should show:

```
Name | Preview | URL | Type | Source | Tags
```

If switched to Gallery:

```
[Preview]
Name
Tags
```

If switched to Board:

```
Not started
In progress
Done
```

If switched to List:

```
Preview | Name | Source | Type
```

The data should always remain intact.
27. View Compatibility
Define a clear compatibility system.
Some properties are universal:

*  Name 
*  Tags 
*  Status 
*  Date 
*  Person 
*  URL 
*  Text 
*  Number 
*  Checkbox 
*  Relation 

Some properties are visual:

*  Preview 
*  Thumbnail 
*  Cover 

Some are source-specific:

*  Author 
*  Duration 
*  Platform 
*  Published date 

Do not delete or hide data simply because a particular view does not display it.
Instead:
The view controls visibility, not data existence.
28. Collection View Settings
Add Collection-specific settings.
For example:

```
View settings

View name

Layout
    Masonry
    Grid

Card size
    Small
    Medium
    Large

Preview
    Cover
    Fit
    Original ratio

Property visibility

Filter

Sort

Group

Conditional color

Open pages in
    Center peek
    Side peek
    Full page
```

Potentially add:

```
Image ratio
    Original
    Square
    Landscape
    Portrait
```

29. Sorting
Collection should support:

*  Manual order 
*  Recently added 
*  Recently updated 
*  Name 
*  Source 
*  Published date 
*  Created date 
*  Custom property 

Manual order should be especially useful for visual moodboards.
30. Grouping
Allow users to group collections by:

*  Source 
*  Type 
*  Tag 
*  Project 
*  Client 
*  Status 
*  Custom property 

Example:

```
YouTube

[video] [video] [video]


Instagram

[post] [post] [post]


Websites

[website] [website] [website]
```

31. Filtering
Support normal database filters.
Examples:

```
Type is Video
```


```
Source is Instagram
```


```
Tags contains Typography
```


```
Created within last 7 days
```

This allows Collection to become a proper research library rather than just a visual board.
32. Search
Search should work across:

*  Title 
*  URL 
*  Domain 
*  Source 
*  Author 
*  Description 
*  Tags 
*  Notes 
*  Metadata 

Example:
Search:

```
typography
```

could find:

```
Typography reference
Swiss typography
Typography systems
Instagram post about typography
PDF typography book
```

33. Smart Source Detection
The system should automatically recognize URLs.
Examples:

```
youtube.com/...
→ YouTube
→ Video
```


```
instagram.com/...
→ Instagram
→ Social post
```


```
pinterest.com/...
→ Pinterest
→ Pin
```


```
example.com/article
→ Website
→ Article
```


```
example.com/file.pdf
→ PDF
→ Document
```

Do not rely only on hardcoded domains.
Build the system so additional platforms can be supported later.
34. Unknown Websites
If a user pastes:

```
randomwebsite.com/something
```

Zenboard should still create a useful collection item.
Try:

```
Title
Open Graph image
Description
Domain
Favicon
URL
```

If metadata cannot be extracted:

```
Untitled resource
randomwebsite.com
```

The user can edit it manually.
35. URL Preview Failure
Never let a failed metadata request break the database.
If fetching fails:

```
Preview unavailable

Untitled resource
example.com
```

The item should still be created.
The user should still be able to open the URL.
36. Offline / Slow Network Behavior
The Collection UI should remain responsive even when metadata fetching is slow.
Example:

```
[placeholder preview]

Fetching preview...
```

The item should already exist.
When metadata arrives, update the card automatically.
Do not block the entire database waiting for one URL.
37. Content Preview vs Source Link
Always preserve the original source.
Every collected item should have:

```
Preview
+
Source URL
```

The preview is only a representation.
The original link remains the canonical source.
Users should be able to:

```
Open source
Copy link
```

38. Notes on Collected Items
One of the biggest advantages over Pinterest/Cosmos should be that Collection items are actual Zenboard pages.
Users can write:

```
Why I saved this:

Love the typography.

Potential reference for LIFE Studio.

Interesting navigation pattern.
```

This turns Collection into a research and thinking tool, not just a bookmarking tool.
39. Collection + AI Later
Keep the architecture ready for future AI capabilities.
Potential future metadata:

```
AI summary
AI tags
AI category
AI description
Similar references
Related items
```

Do not necessarily build all of this now, but make the database architecture extensible enough to support it later.
40. Visual Language
Use the uploaded Cosmos/Pinterest references for:

*  Visual density 
*  Masonry/grid behavior 
*  Content discovery 
*  Preview-first hierarchy 
*  Collection browsing 
*  Source identity 
*  Hover behavior 
*  Visual storytelling 

But do not copy their branding.
Collection must still feel like Zenboard.
The visual language should remain:

*  Black and white 
*  Minimal 
*  Calm 
*  Intelligent 
*  Lightweight 
*  Editorial 
*  Human 
*  Premium 

Use color only when it communicates something meaningful.
41. Do Not Turn It Into Pinterest
This distinction is important.
Pinterest is primarily:
Discover → save → browse
Zenboard Collection should be:
Collect → organize → annotate → connect → use
The user should be able to collect inspiration and then connect it to:

*  Documents 
*  Projects 
*  Clients 
*  Tasks 
*  Research 
*  Notes 
*  Ideas 
*  Other databases 

That is what makes Collection a Zenboard feature rather than a Pinterest clone.
42. Collection Database Example
A user could create:
Brand Inspiration

```
Collection

[Apple website]
[Linear website]
[Aesop packaging]
[Instagram reference]
[YouTube video]
[PDF]
[Typography reference]
```

Then add:

```
Tags:
Branding
Typography
Packaging
Web
Motion
Research
```

And later filter:

```
Branding + Web
```

or:

```
Typography
```

The result becomes a visual research library.
43. Collection Inside a LIFE Studio Project
For example:

```
LIFE Studio
    ↓
Client Project
    ↓
Research
    ↓
Collection
```

The collection could contain:

*  Competitor websites 
*  Brand references 
*  Packaging 
*  Typography 
*  Photography 
*  Social posts 
*  Articles 
*  PDFs 
*  Videos 

Each reference can have notes and tags.
This should work naturally inside the existing Zenboard document architecture.
44. Database Architecture
Do not create a separate Collection database architecture.
Use:

```
Database
   ├── Records
   ├── Properties
   ├── Views
   │    ├── Table
   │    ├── Board
   │    ├── Gallery
   │    ├── List
   │    ├── Calendar
   │    ├── Timeline
   │    └── Collection
```

Collection is simply another renderer/view.
This is extremely important for long-term maintainability.
45. Performance
Collection could potentially contain hundreds or thousands of visual items.
Design for this from the beginning.
Use:

*  Lazy-loaded images 
*  Image thumbnails 
*  Responsive image sizes 
*  Virtualization where appropriate 
*  Progressive loading 
*  Cached metadata 
*  Optimistic creation 
*  Background metadata fetching 

Do not load every original image at full resolution immediately.
46. Responsive Collection
Desktop:

```
5–6 columns
```

Laptop:

```
4 columns
```

Tablet:

```
2–3 columns
```

Mobile:

```
1–2 columns
```

But do not hardcode these numbers blindly.
The layout should respond to the available content width.
47. Collection Toolbar
Use the same database toolbar system as other views.
Potential controls:

```
Search
Filter
Sort
Group
Layout
Property visibility
View settings
Fullscreen
New
```

Collection-specific controls can be added where genuinely useful.
Do not create a completely separate toolbar.
48. Collection Empty State
Keep it extremely simple.
For example:

```
Collect anything

Paste a link, upload a file, or drag something here.

+ Add
```

Do not use a large illustration or excessive onboarding.
49. `/` Command Integration
Update the command menu so Collection is discoverable.
For example:

```
/collection
```

Result:
Collection view
Create a visual collection for links, files, images, videos, and references.
Use an appropriate icon.
The command should insert the Collection database immediately.
50. Final UX Principle
The most important thing is the feeling.
When a user copies a reference from anywhere on the internet and brings it into Zenboard, the experience should feel like:
“I saved it.”
Not:
“I created a database record and filled out a form.”
The complexity should stay behind the scenes.
The user experience should be:
Paste → automatically understand → automatically preview → collect → organize.
Implementation Requirement
Before implementing, audit the current Zenboard database architecture.
Then work through this one task at a time:
Phase 1 — Database foundation

1.  Add Collection as a database view. 
2.  Ensure it uses the existing database/record architecture. 
3.  Add view switching. 
4.  Preserve all data when switching views. 

Phase 2 — Collection UI

5.  Build the responsive visual grid. 
6.  Build collection cards. 
7.  Build preview system. 
8.  Build hover/selection interactions. 
9.  Build Collection toolbar. 
10.  Build Collection view settings. 

Phase 3 — Content ingestion

11.  URL paste flow. 
12.  File upload flow. 
13.  Drag-and-drop. 
14.  Metadata extraction. 
15.  Thumbnail extraction. 
16.  Platform detection. 
17.  Fallback previews. 
18.  Error/loading states. 

Phase 4 — Database integration

19.  Collection item → Zenboard page. 
20.  Side peek / Center peek / Full page. 
21. `/collection` command. 
22.  Collection inside documents. 
23.  Linked Collection views. 
24.  Property compatibility across views. 

Phase 5 — Advanced database behavior

25.  Filtering. 
26.  Sorting. 
27.  Grouping. 
28.  Search. 
29.  Multi-select. 
30.  Bulk actions. 
31.  Manual ordering. 
32.  Responsive behavior. 
33.  Performance optimization. 

Phase 6 — Final audit

34.  Audit against the uploaded references. 
35.  Audit every hover state. 
36.  Audit every loading state. 
37.  Audit every empty state. 
38.  Audit keyboard interactions. 
39.  Audit responsive behavior. 
40.  Audit accessibility. 
41.  Audit database switching. 
42.  Audit data preservation. 
43.  Identify anything missing. 
44.  Fix remaining inconsistencies. 

Do not stop after creating the Collection grid.
The goal is to make Collection feel like a native Zenboard database capability, with the visual discovery quality of Cosmos/Pinterest but the structure, documents, properties, relationships, and flexibility of a real Zenboard database.
