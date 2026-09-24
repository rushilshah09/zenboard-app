"use client";

import * as React from "react";
import { Ellipsis, ChevronDown, ChevronRight, ChevronLeft, Search } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useCoarsePointer, useNarrow } from "@/lib/use-narrow";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";
import { BottomSheet } from "./drawer";
import { SkeletonRow } from "./skeleton";
import { EmptyLine } from "./states";

// design-system.md §4.29 — `Projects / Q3 Retainer / Kickoff notes`. Zenboard
// uses "/" (quieter; matches the path metaphor). >4 levels → Root / … / Parent /
// Current, with … opening a menu of the hidden middle. Never truncate the
// current page or its direct parent.
//
// ── A breadcrumb is not text. It is an entry point. ──────────────────────────
// Give a crumb a `menu` and it becomes a navigation hub: hovering it opens the
// things beside it, and any row with children opens its own submenu, to any
// depth. See DOCUMENT_NAVIGATION_UX.md for the behaviour spec and for why the
// numbers here are the DS's and not Notion's.
//
// ── One crumb, one control (2026-09-14) ─────────────────────────────────────
// Each crumb is a quiet pill whose only hover is a soft wash. It was a link that
// UNDERLINED, plus a caret button beside it that appeared on hover — whose
// invisible 20px slot was the uneven gap before every "/", and which made each
// crumb two tab stops. The user's brief: "look cheap because of the underline
// … should feel like a native navigation system, not a collection of links".
//
// The menu chrome is Radix `DropdownMenu` verbatim — that is where the safe
// triangle, the roving focus, the jump-to-letter typeahead and the ARIA
// menu/menuitem wiring already live. The only thing layered on top is *hover
// timing*, which Radix leaves to the caller because a menubar and a lone action
// menu want different answers.

/** Open on hover after this long — below it, crossing the trail fires 3 menus. */
const OPEN_DELAY = 120;
/** Stay open this long after the pointer leaves — buys the diagonal path in. */
const CLOSE_DELAY = 250;
/** Above this many rows a menu grows a filter box. Below it, Radix's own
 *  jump-to-letter typeahead is enough and a search field is just furniture. */
const FILTER_THRESHOLD = 7;
/** Rows rendered per section. The filter reaches the rest — see §2.4: a
 *  virtualized list inside a menu breaks roving focus and typeahead. */
const MAX_ROWS = 200;

export interface CrumbMenuItem {
  id: string;
  label: string;
  /** Leading glyph, 16px. */
  icon?: React.ReactNode;
  /** On the current trail — trailing ✓ and a held highlight. */
  current?: boolean;
  /** Go here. Selecting the row closes the whole menu. */
  onSelect?: () => void;
  /** One level down. Resolved when the row is first opened, never before. */
  children?: () => CrumbMenuSection[] | Promise<CrumbMenuSection[]>;
  danger?: boolean;
  keys?: string[];
}

export interface CrumbMenuSection {
  /** The heading over the rows, sentence case ("Pages in Motion"). Omit for none. */
  label?: string;
  items: CrumbMenuItem[];
}

export type CrumbMenuSource = () => CrumbMenuSection[] | Promise<CrumbMenuSection[]>;

export interface Crumb {
  label: string;
  href?: string;
  onNavigate?: () => void;
  /** 16px glyph before the label (a page icon, a folder). */
  icon?: React.ReactNode;
  /** What this crumb opens — on hover, ↓, Space or right-click; and on a press
   *  when the crumb has nowhere to navigate (see `crumbRole`). */
  menu?: CrumbMenuSource;
  /** A caret after the label: the menu CHANGES something (a picker, like
   *  Content's stage), rather than showing where else you could go. A place
   *  never draws one. */
  caret?: boolean;
  /** The accessible name of a crumb that opens a menu when pressed, starting
   *  with its visible label ("Idea — move to another stage"). */
  menuLabel?: string;
  /** Filter-box placeholder. Defaults to "Search…". */
  searchPlaceholder?: string;
  /** Shown when the menu resolves to nothing at all. */
  emptyLabel?: string;
}

// ── Resolving a menu ─────────────────────────────────────────────────────────

const isPromise = <T,>(v: T | Promise<T>): v is Promise<T> =>
  !!v && typeof (v as Promise<T>).then === "function";

/**
 * A menu source's sections, resolved once per open. `null` = still resolving.
 *
 * Radix unmounts a closed menu's content, so "once per mount" IS "once per
 * open" — a synchronous source (the common case: the rows are already in
 * memory) therefore recomputes on every open and can never go stale, and an
 * async one shows skeleton rows exactly once.
 */
function useMenuSections(source?: CrumbMenuSource): CrumbMenuSection[] | null {
  const [sections, setSections] = React.useState<CrumbMenuSection[] | null>(null);
  // The source is a fresh closure on every render of the host, so depending on
  // it would re-resolve for ever. The identity that matters is the one this
  // menu opened with — which is what `useRef`'s initial value holds, and why
  // nothing ever writes to this ref.
  const ref = React.useRef(source);

  React.useEffect(() => {
    const result = ref.current?.();
    if (!result) { setSections([]); return; }
    if (!isPromise(result)) { setSections(result); return; }
    let alive = true;
    result
      .then((s) => { if (alive) setSections(s); })
      .catch(() => { if (alive) setSections([]); });
    return () => { alive = false; };
  }, []);

  return sections;
}

// ── Filtering ────────────────────────────────────────────────────────────────

/**
 * Subsequence match with a rank — "af" finds "After Effects" and "Affinity",
 * "ae" finds "After Effects" too. Ranked so a prefix beats a word start beats a
 * match buried mid-word; ties break on the shorter label, which is almost
 * always the one you meant.
 *
 * Deliberately hand-rolled rather than fuse.js: this runs on ≤200 short strings
 * inside a menu, and pulling a search library into the DS to do it would put
 * weight in every bundle that imports a breadcrumb.
 */
function rank(label: string, q: string): number {
  const hay = label.toLowerCase();
  const needle = q.toLowerCase();
  if (hay.startsWith(needle)) return 0;
  let i = 0, first = -1, wordStart = false;
  for (let h = 0; h < hay.length && i < needle.length; h++) {
    if (hay[h] === needle[i]) {
      if (i === 0) { first = h; wordStart = h === 0 || /[\s\-_/]/.test(hay[h - 1]); }
      i++;
    }
  }
  if (i < needle.length) return -1;
  return (wordStart ? 1 : 2) * 1000 + first;
}

/** Empty sections are always dropped — a "Recent" label with nothing under it
 *  is a promise the menu didn't keep. */
function filterSections(sections: CrumbMenuSection[], q: string): CrumbMenuSection[] {
  const query = q.trim();
  if (!query) return sections.filter((s) => s.items.length > 0);
  return sections
    .map((s) => ({
      ...s,
      items: s.items
        .map((it) => ({ it, r: rank(it.label, query) }))
        .filter((x) => x.r >= 0)
        .sort((a, b) => a.r - b.r || a.it.label.length - b.it.label.length)
        .map((x) => x.it),
    }))
    .filter((s) => s.items.length > 0);
}

const countItems = (sections: CrumbMenuSection[]) => sections.reduce((n, s) => n + s.items.length, 0);

// ── The menu body (shared by every level of nesting) ─────────────────────────

function MenuBody(props: {
  source?: CrumbMenuSource;
  searchPlaceholder?: string;
  emptyLabel?: string;
  onClose: () => void;
  /** Top-level menu: the filter box takes focus on open. See <MenuList>. */
  autoFocusFilter?: boolean;
}) {
  const sections = useMenuSections(props.source);
  if (!sections) {
    // A skeleton IS the layout with the content removed (§2.10.5). Never a
    // spinner: a spinner says "wait", a skeleton says "three rows are coming".
    return (
      <div aria-busy="true" className="py-1">
        {[0, 1, 2].map((i) => <SkeletonRow key={i} className="h-9 px-1" />)}
      </div>
    );
  }
  return <MenuList {...props} sections={sections} />;
}

function MenuList({
  sections,
  searchPlaceholder = "Search…",
  emptyLabel = "Nothing here yet",
  onClose,
  autoFocusFilter,
}: {
  sections: CrumbMenuSection[];
  searchPlaceholder?: string;
  emptyLabel?: string;
  onClose: () => void;
  autoFocusFilter?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const showFilter = countItems(sections) > FILTER_THRESHOLD;
  const shown = filterSections(sections, q);
  const empty = countItems(shown) === 0;

  // "Press any key" only works if the filter box already has focus, so the top
  // level takes it back from Radix a frame after open. A SUBMENU deliberately
  // does not: its focus belongs on the first row, where ← still closes it and
  // ↑↓ still walk it — a menu you cannot back out of with the keyboard is worse
  // than one you have to click into to search.
  React.useEffect(() => {
    if (!showFilter || !autoFocusFilter) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [showFilter, autoFocusFilter]);

  /** ↓ out of the filter box hands the list back to Radix's roving focus. */
  const intoList = () => {
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')?.focus();
  };

  return (
    <>
      {showFilter && (
        // Inside a menu, every keystroke is Radix's jump-to-letter typeahead
        // until proven otherwise — so this input stops character keys from
        // reaching the content, and forwards only the keys that steer.
        <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
          <Search className="size-4 shrink-0 text-ink-500" aria-hidden />
          <input data-chromeless
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-ui text-ink-900 outline-none placeholder:text-ink-500 [@media(pointer:coarse)]:min-h-6"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); intoList(); return; }
              if (e.key === "Enter") {
                e.preventDefault();
                const first = shown.flatMap((s) => s.items)[0];
                if (first?.children) intoList();      // can't "go" to a branch blind
                else if (first) { first.onSelect?.(); onClose(); }
                return;
              }
              // Escape clears a query before it closes the menu — one press to
              // undo the typing, a second to leave.
              if (e.key === "Escape" && q) { e.preventDefault(); e.stopPropagation(); setQ(""); return; }
              if (e.key === "Escape" || e.key === "Tab") return; // Radix closes / moves on
              e.stopPropagation();
            }}
          />
        </div>
      )}

      <div ref={listRef}>
        {empty ? (
          <EmptyLine className="px-2.5 py-2 text-caption">{q ? "No matches" : emptyLabel}</EmptyLine>
        ) : (
          shown.map((section, si) => (
            <React.Fragment key={section.label ?? si}>
              {si > 0 && <DropdownMenuSeparator />}
              {section.label && <DropdownMenuLabel>{section.label}</DropdownMenuLabel>}
              {section.items.slice(0, MAX_ROWS).map((item) => (
                <MenuRow key={item.id} item={item} onClose={onClose} />
              ))}
              {section.items.length > MAX_ROWS && (
                <p className="px-2.5 py-1.5 text-caption text-ink-500">
                  {section.items.length.toLocaleString()} items — type to narrow
                </p>
              )}
            </React.Fragment>
          ))
        )}
      </div>
    </>
  );
}

function MenuRow({ item, onClose }: { item: CrumbMenuItem; onClose: () => void }) {
  const go = () => { item.onSelect?.(); onClose(); };

  if (!item.children) {
    return (
      <DropdownMenuItem
        icon={item.icon}
        keys={item.keys}
        danger={item.danger}
        active={item.current}
        onSelect={() => item.onSelect?.()}
        className={item.current ? "bg-surface-hover" : undefined}
      >
        {item.label}
      </DropdownMenuItem>
    );
  }

  // A row with children answers two questions, so it takes two gestures —
  // exactly Finder's: click / Enter GOES there, hover / → LOOKS INSIDE.
  // Without the keydown intercept, Radix would open the submenu on Enter and
  // the row could only ever be looked into, never opened.
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        icon={item.icon}
        className={item.current ? "bg-surface-hover" : undefined}
        onClick={(e) => { e.preventDefault(); go(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(); }
        }}
      >
        {item.label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-[280px] max-w-[calc(100vw-24px)]">
        <MenuBody source={item.children} onClose={onClose} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// ── Touch: the same menu as a drill-down sheet ───────────────────────────────
// Hover does not exist on a touch screen and a 36px row is under the 44px
// target, so below the breakpoint a crumb opens a sheet you walk INTO instead
// of a menu you hover ACROSS (§2.3).

function CrumbSheet({
  open, onOpenChange, title, source, emptyLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  source?: CrumbMenuSource;
  emptyLabel?: string;
}) {
  const [stack, setStack] = React.useState<{ title: string; source?: CrumbMenuSource }[]>([{ title, source }]);
  // Reset the drill-down each time the sheet opens, adjusting state during
  // render rather than in an effect: `source` is a fresh closure on every
  // render of the host, so an effect watching it would send you back to the top
  // whenever anything above re-rendered.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStack([{ title, source }]);
  }
  const top = stack[stack.length - 1];

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={top?.title ?? title} detent="half">
      {stack.length > 1 && (
        <button
          type="button"
          onClick={() => setStack((s) => s.slice(0, -1))}
          className="focus-ring mb-1 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-ui text-ink-500"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {stack[stack.length - 2].title}
        </button>
      )}
      {top && (
        <SheetRows
          key={stack.length}
          source={top.source}
          emptyLabel={emptyLabel}
          onOpen={(item) => setStack((s) => [...s, { title: item.label, source: item.children }])}
          onPick={(item) => { item.onSelect?.(); onOpenChange(false); }}
        />
      )}
    </BottomSheet>
  );
}

function SheetRows({
  source, emptyLabel = "Nothing here yet", onOpen, onPick,
}: {
  source?: CrumbMenuSource;
  emptyLabel?: string;
  onOpen: (item: CrumbMenuItem) => void;
  onPick: (item: CrumbMenuItem) => void;
}) {
  const sections = useMenuSections(source);
  if (!sections) return <div aria-busy="true">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>;
  if (countItems(sections) === 0) return <EmptyLine className="py-2">{emptyLabel}</EmptyLine>;

  return (
    <div className="flex flex-col overflow-y-auto">
      {sections.map((s, si) => (
        <React.Fragment key={s.label ?? si}>
          {s.label && <p className="px-2 pb-1 pt-3 text-overline text-ink-500">{s.label}</p>}
          {s.items.map((item) => (
            <div key={item.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onPick(item)}
                className={cn(
                  "focus-ring flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-ui",
                  item.danger ? "text-danger-600" : "text-ink-800",
                  item.current && "bg-surface-hover",
                )}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
              {item.children && (
                <button
                  type="button"
                  aria-label={`Open ${item.label}`}
                  onClick={() => onOpen(item)}
                  className="focus-ring grid size-11 shrink-0 place-items-center rounded-md text-ink-500"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── The trail ────────────────────────────────────────────────────────────────

/** Hover timing for the whole trail — one controller, so the crumbs behave like
 *  one menubar rather than five independent menus. */
function useTrailHover() {
  const [openId, setOpenId] = React.useState<string | null>(null);
  // How the open menu came to be open. One that was only POINTED AT leaves focus
  // where it was — the caret in a document being written — so crossing the header
  // with the mouse no longer takes it; one ASKED for (a press, ↓, right-click)
  // takes focus the way any menu does, which is what the keyboard needs.
  const [byHover, setByHover] = React.useState(false);
  const timers = React.useRef<{ open?: number; close?: number }>({});

  const clear = React.useCallback(() => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  }, []);
  React.useEffect(() => clear, [clear]);

  // Nothing guards against Escape handing straight back to hover-to-open,
  // because nothing has to: `pointerenter` does not re-fire while the pointer
  // sits still, and the menu opens BELOW its crumb, so dismissing it never
  // uncovers the trigger. Re-opening costs a deliberate move out and back.
  const requestOpen = React.useCallback((id: string) => {
    clear();
    if (openId === id) return;
    // Once one menu is open the trail IS a menubar: moving along it switches
    // immediately, because the user has already declared they're browsing.
    if (openId) { setOpenId(id); return; }
    timers.current.open = window.setTimeout(() => { setByHover(true); setOpenId(id); }, OPEN_DELAY);
  }, [clear, openId]);

  const leave = React.useCallback(() => {
    clear();
    timers.current.close = window.setTimeout(() => setOpenId(null), CLOSE_DELAY);
  }, [clear]);

  const cancelClose = React.useCallback(() => {
    window.clearTimeout(timers.current.close);
  }, []);

  const setOpen = React.useCallback((id: string, open: boolean) => {
    clear();
    // Closing keeps the mode it was opened in: Radix reads it once more, as the
    // menu unmounts, to decide whether focus goes back to the crumb.
    if (open) setByHover(false);
    setOpenId(open ? id : null);
  }, [clear]);

  return { openId, byHover, requestOpen, cancelClose, leave, setOpen };
}

type Hover = ReturnType<typeof useTrailHover>;

/**
 * What pressing a crumb does.
 *   place — it leads somewhere, so pressing GOES there; its menu, if it has one,
 *           opens on hover, ↓, Space or right-click.
 *   menu  — it has nowhere to go (the page you are on; a picker such as
 *           Content's stage), so pressing opens its menu.
 *   text  — neither: words, not a control.
 */
export type CrumbRole = "place" | "menu" | "text";
export function crumbRole(crumb: Crumb, current: boolean): CrumbRole {
  if (!current && (crumb.href || crumb.onNavigate)) return "place";
  return crumb.menu ? "menu" : "text";
}

/**
 * How much of the path survives. Up to three ancestors stay whole; beyond that
 * the MIDDLE collapses into "…" — never the root, never the direct parent.
 * `collapse` (a narrow screen) moves every ancestor into the "…": one tap, and
 * the header gets its width back — at 375px the full path ran under the page's
 * own actions.
 */
export function trailParts<T>(ancestors: T[], collapse: boolean): { head: T[]; hidden: T[]; tail: T[] } {
  if (collapse) return { head: [], hidden: ancestors, tail: [] };
  if (ancestors.length > 3) {
    return { head: [ancestors[0]], hidden: ancestors.slice(1, -1), tail: [ancestors[ancestors.length - 1]] };
  }
  return { head: ancestors, hidden: [], tail: [] };
}

// The pill. 24px — the DS's densest control — with the vertical hit area Button
// gives a finger. Its one hover is a wash, held while its menu is open so you can
// see which crumb a menu belongs to.
const CRUMB =
  "focus-ring relative inline-flex h-6 min-w-0 max-w-48 items-center gap-1.5 rounded-sm px-1.5 text-ui " +
  "transition-colors duration-fast " +
  "[@media(pointer:coarse)]:after:content-[''] [@media(pointer:coarse)]:after:absolute " +
  "[@media(pointer:coarse)]:after:inset-x-0 [@media(pointer:coarse)]:after:top-1/2 " +
  "[@media(pointer:coarse)]:after:h-11 [@media(pointer:coarse)]:after:-translate-y-1/2";
const CRUMB_WASH = "cursor-pointer hover:bg-surface-hover data-[state=open]:bg-surface-hover";
/** Ancestors are quiet and come forward under the wash; the page you are on is
 *  full ink at regular weight — identifiable without making the trail heavy. */
const toneOf = (current: boolean) =>
  current ? "text-ink-900" : "text-ink-500 hover:text-ink-800 data-[state=open]:text-ink-800";

function CrumbBody({ crumb }: { crumb: Crumb }) {
  return (
    <>
      {crumb.icon && <span aria-hidden className="flex shrink-0 items-center">{crumb.icon}</span>}
      <span className="min-w-0 truncate">{crumb.label}</span>
      {crumb.caret && <ChevronDown className="size-3 shrink-0 text-ink-500" aria-hidden />}
    </>
  );
}

function CrumbNode({
  crumb, id, current = false, hover, sheets,
}: {
  crumb: Crumb;
  id: string;
  current?: boolean;
  hover: Hover;
  /** No hover here (a finger, or a narrow screen): a menu opens as a sheet. */
  sheets: boolean;
}) {
  const [sheet, setSheet] = React.useState(false);
  const role = crumbRole(crumb, current);
  const className = cn(CRUMB, toneOf(current), role !== "text" && CRUMB_WASH);
  const ariaCurrent = current ? ("page" as const) : undefined;
  const body = <CrumbBody crumb={crumb} />;

  if (role === "text") {
    return <span aria-current={ariaCurrent} className={className}>{body}</span>;
  }

  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!crumb.href) e.preventDefault();
    crumb.onNavigate?.();
  };

  // A place with nothing to open, or any place where menus cannot hover: a link.
  if (role === "place" && (!crumb.menu || sheets)) {
    return <a href={crumb.href ?? "#"} className={className} onClick={go}>{body}</a>;
  }

  if (sheets) {
    return (
      <>
        <button
          type="button"
          aria-current={ariaCurrent}
          aria-haspopup="menu"
          aria-expanded={sheet}
          aria-label={crumb.menuLabel}
          onClick={() => setSheet(true)}
          className={className}
        >
          {body}
        </button>
        <CrumbSheet open={sheet} onOpenChange={setSheet} title={crumb.label} source={crumb.menu} emptyLabel={crumb.emptyLabel} />
      </>
    );
  }

  const open = hover.openId === id;
  const shared = {
    "aria-current": ariaCurrent,
    className,
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") hover.requestOpen(id); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") hover.leave(); },
    // Right-click opens the same menu, so there is never a second list to keep in step.
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); hover.setOpen(id, true); },
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => hover.setOpen(id, o)} modal={false}>
      <DropdownMenuTrigger asChild>
        {role === "place" ? (
          <a
            href={crumb.href ?? "#"}
            {...shared}
            // A place is pressed to GO. Radix opens its menu on pointerdown and on
            // Enter; a handler that prevents the default is how Radix is told not
            // to, which leaves the menu to hover, ↓, Space and right-click.
            onPointerDown={(e) => e.preventDefault()}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.click(); } }}
            onClick={(e) => { hover.setOpen(id, false); go(e); }}
          >
            {body}
          </a>
        ) : (
          <button
            type="button"
            {...shared}
            aria-label={crumb.menuLabel}
            // Already open from hovering it: a press must not toggle it shut.
            onPointerDown={(e) => { if (open) e.preventDefault(); }}
          >
            {body}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[280px] max-w-[calc(100vw-24px)]"
        keepFocus={hover.byHover}
        onPointerEnter={hover.cancelClose}
        onPointerLeave={hover.leave}
      >
        <MenuBody
          source={crumb.menu}
          searchPlaceholder={crumb.searchPlaceholder}
          emptyLabel={crumb.emptyLabel}
          autoFocusFilter={!hover.byHover}
          onClose={() => hover.setOpen(id, false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Slash() {
  return (
    <span aria-hidden className="select-none text-ui text-ink-300">
      /
    </span>
  );
}

/** The "…" that stands in for the hidden part of the trail. Each hidden crumb
 *  keeps its own menu, as a submenu — collapsing the trail must not cost you
 *  the levels it hides. Controlled so a submenu row can close the whole thing. */
function CollapsedCrumbs({ items, keyOf, sheets }: { items: Crumb[]; keyOf: (c: Crumb) => string; sheets: boolean }) {
  const [open, setOpen] = React.useState(false);
  const rows: CrumbMenuSection[] = [{
    items: items.map((c) => ({
      id: keyOf(c), label: c.label, icon: c.icon, onSelect: c.onNavigate, children: c.menu,
    })),
  }];
  const className = cn(CRUMB, CRUMB_WASH, toneOf(false));

  // On touch the "…" carries the WHOLE path, so it has to be walkable — and a
  // hover-opened submenu is not. It gets the same drill-down sheet a crumb does.
  if (sheets) {
    return (
      <>
        <button
          type="button"
          aria-label={`${items.length} more levels`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={className}
        >
          <Ellipsis className="size-3.5" aria-hidden />
        </button>
        <CrumbSheet open={open} onOpenChange={setOpen} title="Go to" source={() => rows} />
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger aria-label={`${items.length} more levels`} className={className}>
        <Ellipsis className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] max-w-[calc(100vw-24px)]">
        {rows[0].items.map((item) => (
          <MenuRow key={item.id} item={item} onClose={() => setOpen(false)} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const hover = useTrailHover();
  // Narrow screens collapse the path; any screen without hover opens menus as
  // sheets. Both are `false` on the server and the first client render — the
  // wide, hovering layout is the safe default.
  const narrow = useNarrow(768);
  const coarse = useCoarsePointer();

  if (items.length === 0) return null;
  const current = items[items.length - 1];
  const { head, hidden, tail } = trailParts(items.slice(0, -1), narrow);
  const sheets = narrow || coarse;
  // Crumbs are addressed by position: two levels can legitimately share a label
  // ("Design / Design"), and a label collision must not open two menus at once.
  const keyOf = (c: Crumb) => `crumb-${items.indexOf(c)}`;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-0.5">
        {head.map((c) => (
          <li key={keyOf(c)} className="flex min-w-0 items-center gap-0.5">
            <CrumbNode crumb={c} id={keyOf(c)} hover={hover} sheets={sheets} />
            <Slash />
          </li>
        ))}
        {hidden.length > 0 && (
          <li className="flex items-center gap-0.5">
            <CollapsedCrumbs items={hidden} keyOf={keyOf} sheets={sheets} />
            <Slash />
          </li>
        )}
        {tail.map((c) => (
          <li key={keyOf(c)} className="flex min-w-0 items-center gap-0.5">
            <CrumbNode crumb={c} id={keyOf(c)} hover={hover} sheets={sheets} />
            <Slash />
          </li>
        ))}
        <li className="flex min-w-0 items-center">
          <CrumbNode crumb={current} id={keyOf(current)} current hover={hover} sheets={sheets} />
        </li>
      </ol>
    </nav>
  );
}
