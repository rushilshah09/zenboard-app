import * as React from "react";
import { LayoutGroup, motion, useReducedMotion } from "./motion";
import { Plus } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Card, cardInteractiveClass } from "./card";
import { Count } from "./count";
import { inlineEdit, inputBox } from "./input";
import { MOTION } from "./motion";

// design-system.md §4.50 — Kanban. Columns are paper-2 wells with their own
// scroll; a WIP limit informs (warning tint), never blocks. The dashed
// "+ New task" inline-add is how you add ten tasks in twenty seconds.
export interface BoardCardData {
  id: string;
  title: string;
  meta?: React.ReactNode;
  /**
   * A control on the card itself, revealed on hover and whenever it is open.
   * A board's most frequent action is moving a card, and making that cost a
   * detail panel is what turns a pipeline into a filing cabinet.
   */
  action?: React.ReactNode;
}

export interface BoardColumnData {
  id: string;
  name: string;
  dotClass: string; // e.g. "bg-info-500"
  cards: BoardCardData[];
  wipLimit?: number;
  /**
   * A line under the last card. For a column that does not show everything it
   * holds — a TERMINAL column like `published`, which nothing leaves and which
   * therefore grows without bound. Hiding cards silently is worse than a long
   * column; this is where the column says so and points at the full list.
   */
  footer?: React.ReactNode;
  /**
   * Can work be created straight into this column? Defaults to TRUE, so a task
   * board — where adding to "In progress" is an everyday act — is unchanged.
   *
   * A pipeline is different. On the content board every column offered
   * "+ New idea", including `published`, where creating "an idea" that is
   * already out is a sentence that does not parse. Creation there is
   * concentrated at the front: you make an idea, then you move it. Six of the
   * seven buttons were mislabelled clutter for an action nobody takes.
   */
  canAdd?: boolean;
  /**
   * The column's own menu — rename, and whatever else a column can be.
   *
   * Required to render anything at all: this header used to draw a hard-coded
   * `⋯` IconButton with NO handler, on every column of every board. A control
   * that does nothing is worse than an absent one, because it is the only
   * affordance a user has for "this column has settings" and it teaches them
   * that pressing it is pointless.
   */
  action?: React.ReactNode;
  /**
   * What this column is called when nobody has renamed it. Shown as the rename
   * field's placeholder, so clearing the field SHOWS what it will go back to —
   * the reset is visible instead of being a rule you have to know.
   */
  defaultName?: string;
}

/**
 * THE DRAG SEAM.
 *
 * dnd-kit must never be imported inside `components/ds` — the barrel is pulled
 * in by dozens of files, and a primitive that drags is a primitive that costs
 * every one of them (`property-block.test.ts` guards it, and caught this file
 * the first time round). So the DS draws the shapes and a FEATURE supplies the
 * behaviour, by passing components that wrap each column and each card.
 *
 * A shell, not a callback, because `useDroppable` and `useDraggable` are hooks:
 * they have to be called inside a component, one per column and per card, and a
 * `(id) => props` function cannot call them. The shell also owns the ref, so
 * dnd-kit measures the real `<section>` rather than a wrapper around it.
 *
 * `components/content/pipeline-drag.tsx` is the one implementation.
 */
export type BoardColumnShell = React.ComponentType<{
  id: string;
  /** The accessible name — the column's title. */
  label: string;
  /** The DS's own classes for the column well; the shell adds its drop state. */
  className: string;
  children: React.ReactNode;
}>;

export type BoardCardShell = React.ComponentType<{
  id: string;
  title: string;
  onOpen?: () => void;
  /** Called with `true` while this card is the one being dragged. */
  children: (dragging: boolean) => React.ReactNode;
}>;

function PlainColumnShell({ label, className, children }: React.ComponentProps<BoardColumnShell>) {
  return <section aria-label={label} className={className}>{children}</section>;
}

function PlainCardShell({ title, onOpen, children }: React.ComponentProps<BoardCardShell>) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen?.(); }}
      className="focus-ring block w-full rounded-lg text-left"
    >
      {children(false)}
    </div>
  );
}

export interface BoardProps {
  columns: BoardColumnData[];
  onAdd?: (columnId: string, title: string) => void;
  onOpen?: (cardId: string) => void;
  /** What the inline-add row is called. A board of content adds an idea, not a
   *  task — the glossary is per-module and the component must not name it. */
  addLabel?: string;
  /** What an empty column says. The default promises a drop target, so a board
   *  without drag-and-drop must pass its own rather than advertise one. */
  emptyLabel?: string;
  /** Wraps each column. A feature that drags passes a droppable one. */
  ColumnShell?: BoardColumnShell;
  /** Wraps each card. A feature that drags passes a draggable one. */
  CardShell?: BoardCardShell;
  /**
   * A dashed slot at this index in this column, while a card is held over it —
   * or `null` for no slot. The feature owns the drag state, so it answers this.
   *
   * WHY AN INDEX AND NOT THE CURSOR: a board whose columns carry a manual order
   * does not need it, because the drop position IS the answer. A board whose
   * columns are SORTED does, because then the cursor does not decide — the data
   * does, and a marker under the pointer would promise a choice that is not on
   * offer. See `landingIndex` in lib/content.ts.
   */
  landingAt?: (columnId: string) => number | null;
  /**
   * A card's identity FOR ANIMATION, when it must differ from its id.
   *
   * Cards share a `layoutId` so a move made somewhere else — the ⋯ menu, another
   * device — flies across and reads as "that one moved there". A DRAG is the one
   * move where that is wrong: the person already carried the card, so on release
   * it replayed the whole journey from its origin column. Measured on a real
   * drag, 2026-09-14: the dropped card's left edge went 74 → 211 → 260 → 309 →
   * 340 over ~200ms after the pointer let go. A feature that drags renews the
   * key on drop, so the landed card has nothing to fly from. (Removing the
   * `layoutId` for a single render is not enough — framer keeps the previous
   * element's snapshot and can replay the flight when the id returns.)
   */
  cardLayoutKey?: (cardId: string) => string;
  /**
   * Rename a column. Its absence leaves the title as plain text.
   *
   * The title itself is the affordance — click it and it becomes an input —
   * which is how every other rename in this app works (a document title, a
   * habit, a saved view). The alternative was a `⋯` menu holding one item, and
   * a one-item menu is a drawer with one sock in it.
   *
   * An EMPTY name is not a nameless column: it means "put the default back",
   * and the consumer decides what that is. Clearing the field and asking for
   * the default are one intention, so they are one control.
   */
  onRenameColumn?: (columnId: string, name: string) => void;
  /** Cap for the rename field, so a long name cannot break the header. */
  renameMaxLength?: number;
  className?: string;
}

function InlineAdd({ onCommit, label }: { onCommit: (title: string) => void; label: string }) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState("");
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong text-ui text-ink-600 transition-colors duration-instant hover:border-ink-300 hover:text-ink-800"
      >
        <Plus className="size-3.5" aria-hidden /> {label}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={title}
      placeholder={label}
      aria-label={label}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        setEditing(false);
        setTitle("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && title.trim()) {
          onCommit(title.trim());
          setTitle(""); // Enter commits and opens another (§4.50)
        }
        if (e.key === "Escape") {
          setEditing(false);
          setTitle("");
        }
      }}
      // The DS field recipe. This was `border-berry-500 … ring-2
      // ring-berry-alpha-20`, which drew a near-black box for two different
      // reasons (measured: border lab(22…) = ink-900). The `berry-*` UTILITIES
      // are remapped to the ink ramp on purpose (globals.css, B&G), so the
      // border was ink-900 exactly as declared; and `berry-alpha-20` was never a
      // token, so `ring-2` fell back to currentColor — ink again.
      className={inputBox({ size: "md" })}
    />
  );
}

/** The face of a card, shared by the one in the column and the one under the
 *  cursor — a drag that redraws the card differently mid-flight loses it. */
function CardFace({ card, dim }: { card: BoardCardData; dim?: boolean }) {
  return (
    <Card on="paper-2" className={cn("gap-2 p-3", dim && "opacity-40")}>
      <p className={cn("text-body text-ink-800", card.action && "pr-6")}>{card.title}</p>
      {card.meta && <div className="flex items-center gap-2 text-meta text-ink-500">{card.meta}</div>}
    </Card>
  );
}

function BoardCard({ card, onOpen, still, CardShell, layoutKey }: {
  card: BoardCardData; onOpen?: (id: string) => void; still: boolean; CardShell?: BoardCardShell;
  layoutKey: string;
}) {
  const Shell = CardShell ?? PlainCardShell;
  return (
    <motion.div
      key={card.id}
      // The layout animation is suppressed for the card in flight: framer would
      // animate the same node dnd-kit is transforming, and the two fight over it.
      // Its neighbours keep theirs, so the gap it leaves still closes smoothly.
      layout={still ? false : "position"}
      layoutId={still ? undefined : `board-card:${layoutKey}`}
      // Ease-out, not the library's default spring: this is a work
      // board, and a card that overshoots and settles reads as a toy.
      transition={{ duration: MOTION.slow, ease: MOTION.ease }}
      className="group relative"
    >
      <Shell
        id={card.id}
        title={card.title}
        onOpen={onOpen ? () => onOpen(card.id) : undefined}
      >
        {(dragging) => <CardFace card={card} dim={dragging} />}
      </Shell>
      {/* OUTSIDE the card, laid over it. The card is `role="button"`,
          and a control nested inside a button is a button inside a
          button — one tab stop swallowing another, and ambiguous to
          a screen reader. Sitting alongside it, the two are two
          controls, which is what they are. It is also outside the drag
          listeners, so pressing it opens the menu instead of lifting the card. */}
      {card.action && (
        <div className="reveal-on-hover absolute right-2 top-2">{card.action}</div>
      )}
    </motion.div>
  );
}

/** The dashed slot showing where the held card is going to sit. */
function Landing() {
  return (
    <div aria-hidden className="h-16 shrink-0 rounded-md border border-dashed border-ink-300 bg-surface-hover/40" />
  );
}

/**
 * THE KANBAN COLUMN — one spec, every board in the app.
 *
 * There were three. Measured 2026-09-12: the content pipeline drew a 300px
 * `paper-2` well with an `h-9` header and a round dot; Tasks (and Projects,
 * which reuses it) drew a 288px UNFILLED lane divided by `border-r` hairlines,
 * with an `h-11` header and a square swatch; the database board drew a 264px
 * `paper-3` well with 10px gutters. Seven differences between two of them, for
 * one object.
 *
 * THE WELL WINS, and it is worth saying why, because the Tasks lane was a
 * considered decision and not an accident — `project-board.tsx` argues for it
 * from CLAUDE.md's rule 1, "never nest two fills". The counter-argument: a
 * column's whole job is to GROUP its cards; a hairline between lanes groups by
 * implication where a well groups by enclosure. The DS `Card` also already has
 * first-class support for the nesting (`on="paper-2"`), which is the DS saying
 * this particular nesting is sanctioned rather than overlooked.
 *
 * A COLUMN IS AS TALL AS WHAT IS IN IT, everywhere — `items-start` on the row.
 * This was going to be the one thing left per-surface, on the theory that a
 * dedicated board page wants full-height lanes with their own scroll. Drawing
 * it proved otherwise: Tasks' seven-hundred-pixel wells with one card in them
 * are the same slabs of empty grey that made the content board look broken, and
 * the reference the user pointed at does not do it either — a Notion board with
 * nothing in a column draws a header and a `+ New` button, not a shaft. The
 * page scrolls when a column outgrows it, which is what that reference does.
 *
 * The week board is NOT a consumer, and that is not drift either: its seven day
 * columns FLEX to fit a week on screen rather than taking a fixed width, which
 * is the whole finding behind `zenboard-week-board-fit`.
 */
export const BOARD_COLUMN = {
  /** Fixed, because a pile is a pile — only the week's days flex. */
  widthClass: "w-[300px]",
  /** Between columns. */
  gapClass: "gap-3",
  /**
   * A card's width inside the well: 300 − 2×8 (the well's `p-2`) − 2×4 (the
   * body's `p-1`) = 276. Used by the drag overlays so that what you are holding
   * is exactly the width of the slot it drops into.
   *
   * This said 284 until 2026-09-14 — the well's padding remembered, the body's
   * forgotten — and a real drag in headless Chrome showed the lifted card
   * visibly wider than the cards it was being dropped among. The arithmetic is
   * asserted in app/design-system.test.ts now, so it cannot drift again.
   */
  cardWidthClass: "w-[276px]",
  well: "shrink-0 rounded-lg bg-paper-2 p-2 transition-colors duration-fast",
  header: "flex h-9 items-center gap-2 rounded-sm px-1",
  /** A round dot, never a square — one shape for "this column's colour". */
  dot: "size-2 shrink-0 rounded-full",
  /**
   * NOT a scroll box. It was `overflow-y-auto`, from when columns were stretched
   * to a fixed height and a long one needed to scroll inside itself. Since
   * `items-start` a column is as tall as its cards and the PAGE scrolls — so the
   * overflow scrolled nothing and only clipped. And CSS makes a box that clips
   * one axis clip both: each column became a tiny horizontal scroller. Seen in a
   * user's screen recording, 2026-09-14: a trackpad swipe or a drag near the edge
   * scrolled the COLUMN sideways, leaving its cards cut off at a hard edge
   * ("·wcweewcww", "nstagram"), and a card dropped into another column was
   * clipped mid-flight at every column boundary it crossed.
   */
  body: "flex flex-col gap-2 p-1",
  /**
   * While a card is held over it: a tint, and NO ring. The ring was added
   * because a tint alone looked invisible, and it drew a grey outline that ran
   * straight through the card being carried ("I don't like this border is
   * cutting", 2026-09-14). The precise indicator is the dashed landing slot; the
   * column only has to change. `surface-active` because it is the stronger of
   * the two washes — measured over the well, 1.17:1 light / 1.25:1 dark against
   * `surface-hover`'s 1.10 / 1.12 — and it is the DS's own "this one" state.
   */
  over: "bg-surface-active",
  /**
   * A DATABASE board's column — Notion's anatomy, on the user's explicit "board
   * view same to same as Notion" (2026-09-15, with screenshots of it). Three
   * differences from the house column above, each deliberate rather than drift:
   *
   *  - 260px, Notion's medium card size. A database board is a sheet of short
   *    titles; the content and task boards carry meta rows on every card, which
   *    is what their 300px is for.
   *  - No well of its own. The ground is the GROUP's colour when the view colours
   *    its columns (`--pal-*-wash`, Notion's "Color columns") and the page when it
   *    does not — so a column's fill always MEANS something.
   *  - The add row is a quiet "New page" line, not a dashed box: an empty column
   *    in Notion is a heading and that line, nothing else.
   *
   * The card is RAISED (`surface-raised`), not the DS card's `bg-card`: in dark the
   * document page IS the card colour, so a `bg-card` card on a coloured column
   * read as a hole cut in it (measured 2026-09-15: card L 12.3 on a wash of 13.6).
   * Its hover is a wash laid OVER its own fill (`wash-over`), so it darkens a step
   * on any column colour.
   */
  database: {
    widthClass: "w-[260px]",
    /** 260 − 2×8 (the column's `px-2`). Asserted, like the house card width. */
    cardWidthClass: "w-[244px]",
    column: "flex shrink-0 flex-col rounded-lg px-2 pb-2",
    header: "group flex h-10 items-center gap-1.5 px-1",
    body: "flex flex-col gap-2",
    card: cardInteractiveClass("px-2.5 py-2"),
    add: "flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-ui transition-colors duration-fast hover:bg-surface-hover",
    /** Where a carried card will drop — the house's dashed slot, sized to the card. */
    landing: "shrink-0 rounded-lg border border-dashed border-ink-300 bg-surface-hover",
  },
} as const;

const COLUMN_WELL = cn("flex flex-col", BOARD_COLUMN.widthClass, BOARD_COLUMN.well);

function BoardColumn({ col, onAdd, onOpen, addLabel, emptyLabel, still, landingAt, onRename, renameMaxLength, ColumnShell, CardShell, cardLayoutKey }: {
  col: BoardColumnData;
  onAdd?: (columnId: string, title: string) => void;
  onOpen?: (cardId: string) => void;
  addLabel: string;
  emptyLabel: string;
  still: boolean;
  /** Index for the placeholder, `-1` for "in this column, position unknown", null for not hovered. */
  landingAt: number | null;
  onRename?: (columnId: string, name: string) => void;
  renameMaxLength?: number;
  ColumnShell?: BoardColumnShell;
  CardShell?: BoardCardShell;
  cardLayoutKey?: (cardId: string) => string;
}) {
  const Shell = ColumnShell ?? PlainColumnShell;
  const [renaming, setRenaming] = React.useState(false);
  const over = col.wipLimit !== undefined && col.cards.length > col.wipLimit;
  const showLanding = landingAt !== null && landingAt >= 0;
  return (
    // The drop highlight belongs to the shell, which is the thing that knows it
    // is being hovered. The DS only says what a column normally looks like.
    <Shell id={col.id} label={col.name} className={COLUMN_WELL}>
      <header className={cn("sticky top-0", BOARD_COLUMN.header, over && "bg-warning-100")}>
        <span aria-hidden className={cn(BOARD_COLUMN.dot, col.dotClass)} />
        {renaming && onRename ? (
          <input
            autoFocus
            data-chromeless
            defaultValue={col.name}
            placeholder={col.defaultName ?? col.name}
            maxLength={renameMaxLength}
            aria-label={`Rename ${col.name}`}
            // Select it all, so typing replaces the name — Notion's behaviour,
            // and the selection highlight is the cue that you are editing.
            onFocus={(e) => e.currentTarget.select()}
            // Commit on blur as well as on Enter: a rename abandoned by clicking
            // elsewhere is still a rename the person typed, and throwing it away
            // is the behaviour people describe as "it didn't save".
            onBlur={(e) => { setRenaming(false); onRename(col.id, e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.currentTarget.blur(); }
              // Escape abandons it, and must not then commit on the way out.
              if (e.key === "Escape") { e.currentTarget.value = col.name; e.currentTarget.blur(); }
            }}
            // `inlineEdit`, the DS's fourth edge tier: a title typed in place has
            // no box, because the text IS the thing being edited — the DS names
            // Notion's page title as the reference. Its first version drew a
            // heavy black box here (the same berry recipe as InlineAdd, above).
            // Sized to its text (`field-sizing: content`), not `flex-1`: a
            // growing field shoved the count from beside the title to the far
            // end of the header the moment you clicked — the header moved
            // because you started typing. Browsers without field-sizing keep
            // the input's intrinsic width, which only pushes the count along.
            className={cn(inlineEdit({ as: "label" }), "w-auto min-w-[3ch] max-w-full [field-sizing:content]")}
          />
        ) : onRename ? (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Rename"
            className="focus-ring -mx-1 truncate rounded-sm px-1 text-body font-medium text-ink-900 hover:bg-surface-hover [@media(pointer:coarse)]:min-h-6"
          >
            {col.name}
          </button>
        ) : (
          <span className="text-body font-medium text-ink-900">{col.name}</span>
        )}
        {/* A COUNT, so it gets `tabular-nums` from the primitive. It was
            plain `text-ui`, and on a board the number changes every time a
            card moves — proportional figures shift the header as it does.
            12px beside the 14px column title is the same relationship
            PanelHeader already uses. */}
        <Count
          value={col.wipLimit !== undefined ? `${col.cards.length}/${col.wipLimit}` : col.cards.length}
          className={cn(over && "font-medium text-warning-600")}
          data-numeric
        />
        <span className="flex-1" />
        {col.action}
      </header>
      <div className={cn(BOARD_COLUMN.body, "min-h-24")}>
        {col.cards.length === 0 && !showLanding && (
          <div className="grid h-24 place-items-center rounded-md border border-dashed border-line-strong text-ui text-ink-600">
            {emptyLabel}
          </div>
        )}
        {col.cards.map((c, i) => (
          <React.Fragment key={c.id}>
            {showLanding && landingAt === i && <Landing />}
            <BoardCard card={c} onOpen={onOpen} still={still} CardShell={CardShell} layoutKey={cardLayoutKey?.(c.id) ?? c.id} />
          </React.Fragment>
        ))}
        {showLanding && landingAt >= col.cards.length && <Landing />}
        {onAdd && col.canAdd !== false && <InlineAdd label={addLabel} onCommit={(t) => onAdd(col.id, t)} />}
        {col.footer}
      </div>
    </Shell>
  );
}

export function Board({
  columns, onAdd, onOpen, addLabel = "New task", emptyLabel = "Drop tasks here",
  ColumnShell, CardShell, landingAt, cardLayoutKey, onRenameColumn, renameMaxLength, className,
}: BoardProps) {
  // MOTION, for the one thing a cut cannot say.
  //
  // A card's column is its STATE, and state is usually changed somewhere else —
  // in the detail panel, by an automation, by someone else. Re-rendering the
  // board teleports the card: you look back and a card you were reading is
  // simply somewhere else, with nothing to tell you it is the same card. A
  // shared `layoutId` animates it across, which turns "a card vanished and
  // another appeared" into "that one moved there".
  //
  // Not an entrance animation, and not a hover effect — the design constitution
  // is right to refuse those. This fires only when a card actually changes
  // position, and `reducedMotion="user"` means it does not fire at all for
  // someone who has asked the OS for stillness.
  const still = useReducedMotion() ?? false;
  return (
    <LayoutGroup>
      {/* `items-start` — a column is as tall as what is IN it.
          Without it flex defaults to `stretch`, so every column inflates to match
          the tallest one: a pipeline with eight cards in one stage and none in
          five others drew five 830px slabs of empty grey that stopped abruptly
          part-way down the page. The fill was all padding, and it read as a
          rendering fault rather than as an empty stage.
          This is also what the app's other kanban already does — `database-view`'s
          board row sets `alignItems: 'flex-start'` — so the two were drawing the
          same object by two different rules. A column's body keeps its own
          `overflow-y-auto`, which is what stops a long one from running away. */}
      <div className={cn("flex items-start overflow-x-auto pb-2", BOARD_COLUMN.gapClass, className)}>
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            col={col}
            onAdd={onAdd}
            onOpen={onOpen}
            addLabel={addLabel}
            emptyLabel={emptyLabel}
            still={still}
            landingAt={landingAt?.(col.id) ?? null}
            onRename={onRenameColumn}
            renameMaxLength={renameMaxLength}
            ColumnShell={ColumnShell}
            CardShell={CardShell}
            cardLayoutKey={cardLayoutKey}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}
