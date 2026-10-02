# Block selection brief — verbatim

**Status:** queued. **Source:** user, 2026-09-15, sent mid-turn during DATABASE_EXPERIENCE_PLAN T6.
**Order:** after the Collection view (`COLLECTION_VIEW_BRIEF.md`), which itself follows
`DATABASE_EXPERIENCE_PLAN.md` T6–T15. Saved word for word because a brief queued mid-turn was
once lost to an automatic summary.

---

after completing collection task you have to work on this 


ZENBOARD — IMPROVE EXISTING BLOCK SELECTION

We already have a working block-based editor.

DO NOT rebuild the editor architecture.
DO NOT replace the current editor.
DO NOT change the existing visual design.

Only improve the existing block interaction/selection behavior to match the behavior shown in the provided reference.

CURRENT STATE

The editor already contains individual blocks.

For example:

1. Decompose tasks into smaller or simpler subtasks...
2. Engage "fresh eyes" by consulting additional experts...
3. Emphasize iterative verification...
4. Discourage guessing...
5. If advanced computations or code are needed...

Each numbered item is already an independent block.

Keep this architecture exactly as it is.

==================================================
REQUIRED FUNCTIONALITY
==================================================

1. INDIVIDUAL BLOCK SELECTION

Every existing block must be selectable as a complete block.

The user should be able to interact with the block from its left-side block handle / gutter.

When the user selects a block:

- highlight the entire block
- preserve its existing content
- preserve its formatting
- do not convert it into a single text selection
- do not merge it with other blocks

Example:

[1. Decompose tasks into smaller or simpler subtasks...]
     ↑
     entire block selected


==================================================
2. MULTI-BLOCK SELECTION

Allow the user to select multiple blocks at once.

Example:

User selects block 1 and drags downward to block 5.

Result:

[1. Decompose tasks...]
[2. Engage "fresh eyes"...]
[3. Emphasize iterative verification...]
[4. Discourage guessing...]
[5. If advanced computations...]

All five blocks should become selected.

IMPORTANT:

These remain five separate blocks internally.

Do NOT combine them into one block.

The selection is only a temporary UI/editor state.


==================================================
3. CONTINUOUS SELECTION APPEARANCE

When multiple consecutive blocks are selected, make them visually appear as one continuous selection.

Example:

┌─────────────────────────────────────────────┐
│ 1. Decompose tasks...                       │
│ 2. Engage "fresh eyes"...                   │
│ 3. Emphasize iterative verification...     │
│ 4. Discourage guessing...                   │
│ 5. If advanced computations...             │
└─────────────────────────────────────────────┘

There should NOT be a separate card/border around every selected block.

The selection should visually connect between blocks.

Keep the current Zenboard styling.


==================================================
4. TEXT SELECTION MUST CONTINUE TO WORK

This is critical.

There are TWO different selection types:

A. Text selection
B. Block selection

Text selection should continue working exactly as it currently does.

Example:

User selects:

"advanced computations or code"

Only those characters are selected.

The existing floating formatting toolbar should appear.

Do not change the existing text formatting behavior.


==================================================
5. BLOCK SELECTION MUST NOT TRIGGER TEXT SELECTION

If the user interacts with the block handle/gutter:

select the block.

Do NOT select the text inside the block.

The two interactions must remain independent.


==================================================
6. BLOCK HANDLE

Use the existing block handle if one already exists.

Do not redesign it.

On hover:

show the existing block handle.

The handle should provide access to block selection.

Interaction:

Click handle
→ select block

Drag handle
→ select/move multiple blocks depending on the existing editor behavior.


==================================================
7. SHIFT SELECTION

Support:

Click block handle
+
Shift + click another block handle

Example:

Click block 2.

Then:

Shift + click block 5.

Result:

Blocks 2, 3, 4 and 5 become selected.

Keep them as independent blocks.


==================================================
8. DRAG ACROSS BLOCK HANDLES

Allow the user to drag from the block gutter/handle across multiple blocks.

Example:

Start:
block 1 handle

Drag down:

block 1
block 2
block 3
block 4
block 5

Result:

All five blocks are selected.

The interaction should feel like the reference image.


==================================================
9. SELECTED BLOCK ACTIONS

Once multiple blocks are selected, existing block actions should operate on the complete selection.

At minimum:

- Copy
- Cut
- Delete
- Duplicate
- Move
- Drag/reorder

Do not change the existing block menu unless required to support this functionality.


==================================================
10. COPY / PASTE

If multiple blocks are selected and copied:

copy the complete blocks.

Pasting should create new independent blocks.

Preserve:

- numbered list structure
- text
- formatting
- links
- block properties

Do not paste everything as one giant text block.


==================================================
11. DELETE

When multiple blocks are selected:

Delete all selected blocks.

Do not delete unselected blocks.

If the last remaining editable block is deleted, preserve one empty editable block.


==================================================
12. KEYBOARD SELECTION

Support standard block selection shortcuts where compatible with the existing editor.

Shift + Arrow Up
Shift + Arrow Down

should allow extending selection across blocks where appropriate.

Do not break normal cursor movement.


==================================================
13. VISUAL STATES

Keep the existing Zenboard design.

Only introduce the necessary interaction states:

DEFAULT

Normal block.

HOVER

Block handle becomes visible.

TEXT SELECTION

Selected characters only.

BLOCK SELECTION

Entire block highlighted.

MULTI-BLOCK SELECTION

Multiple blocks highlighted as one continuous selection.

DRAGGING

Selected blocks can be moved.

Do not introduce cards, shadows, excessive borders, or new visual components.


==================================================
14. IMPORTANT: DO NOT CHANGE THE EXISTING EDITOR

This is an enhancement to the current implementation.

Before changing anything:

1. Inspect the existing editor implementation.
2. Identify how blocks are currently represented.
3. Identify the current block handle.
4. Identify the current text selection state.
5. Identify the current drag/drop implementation.
6. Extend the existing system rather than replacing it.

Reuse existing components, state, utilities, and design tokens wherever possible.


==================================================
15. SELECTION STATE

Implement block selection independently from text selection.

Conceptually:

selectedBlockIds = [
  blockId1,
  blockId2,
  blockId3
]

Keep the existing text selection system separate.

Do NOT use text ranges to represent block selection.


==================================================
16. FINAL BEHAVIOR

The final editor should behave like this:

Text interaction:

User can select any characters normally.

Block interaction:

User can select one or multiple complete blocks from the block gutter.

Multiple blocks:

They visually appear as one continuous selection.

Internally:

They remain independent blocks.

Example:

Document
 ├── Block 1
 ├── Block 2
 ├── Block 3
 ├── Block 4
 └── Block 5

Selecting all:

selectedBlockIds = [
  Block 1,
  Block 2,
  Block 3,
  Block 4,
  Block 5
]

The underlying document structure must remain unchanged.

==================================================
SUCCESS CRITERIA

The implementation is complete when:

1. Existing blocks continue working exactly as before.
2. Text selection continues working exactly as before.
3. Clicking the block gutter selects the entire block.
4. Multiple blocks can be selected.
5. Shift-click can extend block selection.
6. Dragging across block handles can select multiple blocks.
7. Multiple selected blocks look like one continuous selection.
8. Selected blocks remain independent internally.
9. Copy/paste works with multiple blocks.
10. Delete works with multiple blocks.
11. Existing floating text toolbar still works.
12. Existing block menu still works.
13. Existing drag/reorder behavior is not broken.
14. No new card-style UI is introduced.
15. No existing Zenboard design tokens are changed.

MOST IMPORTANT:

We are NOT asking you to redesign the editor.

We are asking you to add the missing MULTI-BLOCK SELECTION INTERACTION to the existing block editor.
