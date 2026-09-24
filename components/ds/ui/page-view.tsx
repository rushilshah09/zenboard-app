"use client";
// ─────────────────────────────────────────────────────────────────────────────
// <PageView> — THE way anything opens in Zenboard.
//
// Every openable record goes through this component: task, document, project,
// client, invoice, form, habit, goal, calendar event, database row, meeting,
// finance entry, contact. Only the CONTENT differs. The opening behaviour, the
// toolbar, the transitions, the keyboard shortcuts and the view modes are
// identical everywhere, which is the whole point — a new module inherits the
// interaction model instead of inventing one.
//
// RULE: never build a module-specific detail panel. If something is missing
// here, add it here.
//
// Three render modes plus one action:
//   side peek    a panel on the right; the view behind STAYS INTERACTIVE
//   center peek  a focused modal over a scrim
//   full page    a full-bleed surface; the workspace changes
//   new tab      not a mode — an action, needs `href`
//
// Two things this deliberately does NOT do:
//
// 1. It does not navigate. A primitive that pushed routes would make every host
//    responsible for a URL it did not ask for. Hosts own addressing (see
//    lib/hub-url.ts, which is how a hub puts its selection in the URL);
//    `href` here is the record's canonical link, used for "Open in new tab" and
//    for middle-click, and full page renders in place.
// 2. It does not fetch. Content is `children`, always already resolved by the
//    host, so switching from task A to task B REPLACES children without
//    unmounting the panel — the spec's "don't close the panel, replace the
//    content".
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";
import { PanelResizeHandle } from "./panel-resize";
import * as RDlg from "@radix-ui/react-dialog";
import {
  X, ArrowLeft, ArrowRight, ExternalLink, MoreHorizontal,
  ModeSidePeek, ModeCenterPeek, ModeFullPage,
} from "@/components/ds/icons";
import { cn } from "@/lib/cn";
import {
  usePageViewMode, usePeekWidth, resolveMode, wantedMode, MODE_LABEL, MIN_WIDTH, MAX_WIDTH,
  type PageViewMode, type ContentType,
} from "@/lib/page-view-mode";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
// The DS already owns breadcrumbs, including the >4-level collapse into a "…"
// menu — which `Projects / Balluji / Packaging / Task` will hit the moment a
// task sits two folders deep. Reused, not re-implemented.
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "./dropdown-menu";

export type { PageViewMode, ContentType, Crumb };

export interface PageViewHistory {
  onBack?: () => void;
  onForward?: () => void;
  canBack?: boolean;
  canForward?: boolean;
}

export interface PageViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Decides the default mode and which preference bucket the choice is saved in. */
  contentType: ContentType;
  title: string;
  /** Projects / Balluji / Packaging / Task. The last crumb is the record itself. */
  breadcrumbs?: Crumb[];
  /** The record's canonical URL. Enables "Open in new tab"; omit and it hides. */
  href?: string;
  /** Module-specific controls, placed left of the shared toolbar group. */
  actions?: React.ReactNode;
  /** <DropdownMenuItem>s for the ⋯ menu. Omit and ⋯ hides. */
  more?: React.ReactNode;
  /** Back/forward THROUGH RECORDS inside the panel, not browser history. */
  history?: PageViewHistory;
  /**
   * Pinned below the scroll area, never scrolling with it — a comment composer,
   * a commit bar. It belongs to the primitive rather than to `children` because
   * a footer that scrolls away is a different component in every module, which
   * is the fragmentation this whole file exists to end.
   */
  footer?: React.ReactNode;
  /** Force a mode, ignoring the saved preference (rare — a wizard, a preview). */
  mode?: PageViewMode;
  /**
   * A preference the CALLER owns in place of the per-type one — a database view's
   * "Open pages in". A pick for this opening still beats it and the viewport still
   * vetoes it; the menu's "Set as default" saves through `onSetDefault`.
   */
  preferredMode?: PageViewMode;
  /** Where "Set as default" saves when the caller owns the preference. */
  onSetDefault?: (m: PageViewMode) => void;
  /** What that default belongs to, for the menu: "this view". */
  defaultScope?: string;
  resizable?: boolean;
  children: React.ReactNode;
}

/** The glyph and one-line hint for each mode — shared by this menu and every
 *  other place that offers the choice (a database view's "Open pages in"). */
export const MODE_ICON: Record<PageViewMode, typeof ModeSidePeek> = {
  "side-peek": ModeSidePeek,
  "center-peek": ModeCenterPeek,
  "full-page": ModeFullPage,
};

export const MODE_HINT: Record<PageViewMode, string> = {
  "side-peek": "Open on the side. Keeps the current page visible.",
  "center-peek": "Open in a focused, centered modal.",
  "full-page": "Open in full page.",
};

/** The viewport width, remeasured on resize. 0 until the first client measure. */
function useViewportWidth(): number {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/**
 * The content pane's own surface. The shell draws its panel with this, and a
 * page opened INSIDE the pane takes the same one — so opening a record changes
 * what the panel shows, not what the panel is.
 */
export const CONTENT_PANE_SURFACE: React.CSSProperties = {
  background: "var(--paper)",
  border: "1px solid var(--color-border-panel)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-xs)",
};

/**
 * Escape belongs to the innermost thing that answers it. A name typed into a board
 * column, an option being renamed — each cancels on Escape, and Radix's own Escape
 * listener runs first (capture, on the document), so without this the same key
 * closed the whole page and the half-typed name with it. An element that handles
 * Escape itself says so with `data-owns-escape`.
 */
const keepEscapeInside = (e: KeyboardEvent) => {
  if ((e.target as Element | null)?.closest?.("[data-owns-escape]")) e.preventDefault();
};

/**
 * A toast is not "outside" a page — it is the app talking ABOUT it. Radix read a press on one as a click away and
 * closed the page it was about: pressing Undo on "Your change was undone" shut the task it concerned (found
 * 2026-09-21, proving task editing). Everything else outside still closes a peek, as the spec asks.
 */
const keepToastsInside = (e: Event) => {
  if ((e.target as Element | null)?.closest?.("[data-toaster]")) e.preventDefault();
};

export function PageView({
  open,
  onOpenChange,
  contentType,
  title,
  breadcrumbs,
  href,
  actions,
  more,
  history,
  mode: forcedMode,
  preferredMode: ownedMode,
  onSetDefault,
  defaultScope,
  footer,
  resizable = true,
  children,
}: PageViewProps) {
  const [preferred, setForType, setForEverything] = usePageViewMode(contentType);
  const [width, setWidth] = usePeekWidth();
  const viewport = useViewportWidth();

  // A mode chosen for THIS opening only — the ⌘⏎ / menu pick that the user did
  // not ask to make permanent. Cleared on close so the next record opens the way
  // the preference says it should.
  //
  // Adjusted during render rather than in an effect: this is React's documented
  // way to reset state when a prop changes, and it costs no extra commit. An
  // effect here would render the panel once in the stale mode before correcting
  // itself — a visible flash of the wrong layout on every reopen.
  const [session, setSession] = React.useState<PageViewMode | null>(null);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open && session !== null) setSession(null);
  }

  // The standing preference: the caller's own when it has one (a database view),
  // else the per-type one. What a pick for this opening falls back to.
  const standing = ownedMode ?? preferred;
  const wanted = wantedMode({ forced: forcedMode, session, owned: ownedMode, preferred });
  const mode = resolveMode(wanted, viewport);

  const pick = (m: PageViewMode) => setSession(m);
  const openInNewTab = React.useCallback(() => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }, [href]);

  // ── Keyboard grammar (identical in every mode) ────────────────────────────
  // Esc is Radix's. The rest live here so a task and an invoice answer the same
  // keys. Everything is guarded against text entry: ← / → move through records
  // only when you are not inside a field, or typing in the description would
  // navigate away mid-sentence.
  React.useEffect(() => {
    if (!open) return;
    const editable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return el.isContentEditable
        || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Enter" && mod && e.shiftKey) { e.preventDefault(); openInNewTab(); return; }
      if (e.key === "Enter" && mod) { e.preventDefault(); pick("full-page"); return; }
      if (e.key === "Enter" && e.altKey) { e.preventDefault(); pick("side-peek"); return; }
      // Ctrl+\ flips between the peek you were in and the whole page, so you can
      // go big to read and come back without touching the menu.
      if (e.key === "\\" && e.ctrlKey) {
        e.preventDefault();
        pick(mode === "full-page" ? (standing === "full-page" ? "side-peek" : standing) : "full-page");
        return;
      }
      if (editable(e.target)) return;
      if (e.key === "ArrowLeft" && history?.canBack) { e.preventDefault(); history.onBack?.(); }
      if (e.key === "ArrowRight" && history?.canForward) { e.preventDefault(); history.onForward?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, standing, history, openInNewTab]);

  // WHERE A FULL PAGE LIVES. Inside the app's content pane when there is one —
  // the way a Docs page opens, and the way Notion's full page opens: the sidebar
  // and the top bar stay, and stay usable. It used to be `fixed inset-0` over
  // the whole window, sidebar and all, so a content piece opened as a takeover
  // while a document one click away opened in place ("I don't want it open full
  // window, same way document opens", 2026-09-14). Only where no shell exists —
  // the dev harnesses, public pages — does it still take the window.
  //
  // Read during render, not in an effect: an effect would paint the full-window
  // version for one frame on every open. Safe on the server, where the Portal
  // renders nothing anyway.
  const pane = mode === "full-page" && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-view-shell]")
    : null;

  const toolbar = (
    <PageViewToolbar
      showClose={!pane}
      mode={mode}
      href={href}
      history={history}
      actions={actions}
      more={more}
      onPick={pick}
      onSetTypeDefault={(m) => { setForType(m); setSession(m); }}
      onSetGlobalDefault={(m) => { setForEverything(m); setSession(m); }}
      onSetOwnedDefault={onSetDefault ? (m) => { onSetDefault(m); setSession(m); } : undefined}
      defaultScope={defaultScope}
      onNewTab={openInNewTab}
      contentType={contentType}
    />
  );

  const head = (
    <header className="flex shrink-0 flex-col gap-1 border-b border-line-soft px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        {/* A page in the pane leaves the way a Docs page does: back, not close. */}
        {pane && (
          <RDlg.Close asChild>
            <IconButton size="sm" variant="ghost" label="Back" tooltip="Back · Esc" icon={<Icon icon={ArrowLeft} size={16} />} />
          </RDlg.Close>
        )}
        <div className="min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0
            ? <Breadcrumbs items={breadcrumbs} />
            : <RDlg.Title className="truncate text-ui font-medium text-ink-900">{title}</RDlg.Title>}
        </div>
        {toolbar}
      </div>
      {/* With breadcrumbs the title is the last crumb, so it is already named —
          but Radix needs a Title for the dialog's accessible name regardless. */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <RDlg.Title className="sr-only">{title}</RDlg.Title>
      )}
    </header>
  );

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-line-soft bg-paper-2 px-4 py-3">{footer}</div>
      )}
    </>
  );

  // ── Full page ─────────────────────────────────────────────────────────────
  // A real surface, not a route push: eleven of the thirteen content types have
  // no per-record route to push TO, and a primitive that invented one would be
  // lying about where you are. Hosts that do own a route can link to it from the
  // breadcrumbs. No scrim — nothing shows through, the workspace has changed.
  if (mode === "full-page" && pane) {
    return (
      // NON-modal: a modal dialog makes everything outside it inert, and the
      // point of opening in the pane is that the sidebar is still the app.
      <RDlg.Root open={open} onOpenChange={onOpenChange} modal={false}>
        <RDlg.Portal container={pane}>
          <RDlg.Content
            aria-describedby={undefined}
            // A click on the sidebar or top bar is not "outside a dialog" — it is
            // the rest of the app. Navigating away unmounts the host; Esc and the
            // back arrow close.
            onInteractOutside={(e) => e.preventDefault()}
            // Focus the PAGE, not its first control. Radix focuses the first
            // tabbable element, which here is the back arrow — so its "Back · Esc"
            // tooltip popped up on every single open. Keyboard users still land
            // inside the page, and Tab reaches the back arrow next.
            onOpenAutoFocus={focusPage}
            onEscapeKeyDown={keepEscapeInside}
            tabIndex={-1}
            className="absolute inset-0 z-page flex flex-col overflow-hidden outline-none zb-enter data-[state=open]:animate-fadein"
            style={CONTENT_PANE_SURFACE}
          >
            {head}
            {body}
          </RDlg.Content>
        </RDlg.Portal>
      </RDlg.Root>
    );
  }

  if (mode === "full-page") {
    return (
      <RDlg.Root open={open} onOpenChange={onOpenChange} modal>
        <RDlg.Portal>
          <RDlg.Content
            aria-describedby={undefined}
            onOpenAutoFocus={focusPage}
            onEscapeKeyDown={keepEscapeInside}
            onInteractOutside={keepToastsInside}
            tabIndex={-1}
            className={cn(
              "fixed inset-0 z-modal flex flex-col bg-paper outline-none",
              "zb-enter data-[state=open]:animate-fadein",
            )}
          >
            {head}
            {body}
          </RDlg.Content>
        </RDlg.Portal>
      </RDlg.Root>
    );
  }

  // ── Center peek ───────────────────────────────────────────────────────────
  if (mode === "center-peek") {
    return (
      <RDlg.Root open={open} onOpenChange={onOpenChange} modal>
        <RDlg.Portal>
          <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] zb-enter data-[state=open]:animate-fadein data-[state=closed]:animate-fadeout" />
          <RDlg.Content
            aria-describedby={undefined}
            onOpenAutoFocus={focusPage}
            onEscapeKeyDown={keepEscapeInside}
            onInteractOutside={keepToastsInside}
            tabIndex={-1}
            className={cn(
              "fixed left-1/2 top-1/2 z-modal flex w-[min(920px,calc(100vw-64px))] -translate-x-1/2 -translate-y-1/2 flex-col outline-none",
              "max-h-[min(840px,calc(100dvh-96px))] overflow-hidden rounded-lg border border-line bg-paper shadow-lift-3",
              "zb-enter data-[state=open]:animate-rise data-[state=closed]:animate-exit",
            )}
          >
            {head}
            {body}
          </RDlg.Content>
        </RDlg.Portal>
      </RDlg.Root>
    );
  }

  // ── Side peek (default) ───────────────────────────────────────────────────
  // Non-modal and no scrim: the page behind stays visible and scrollable, which
  // is the whole reason to peek instead of opening. Clicking it closes the peek
  // (spec: "ESC closes · click outside closes") — so `modal={false}` is about the
  // scrim and the focus trap, NOT about swallowing outside clicks.
  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDlg.Portal>
        <RDlg.Content
          aria-describedby={undefined}
          onOpenAutoFocus={focusPage}
          onEscapeKeyDown={keepEscapeInside}
          onInteractOutside={keepToastsInside}
          tabIndex={-1}
          className={cn(
            "fixed bottom-1 end-1 top-1 z-modal flex flex-col overflow-hidden outline-none",
            "rounded-lg border border-line bg-paper shadow-lift-3",
            "zb-enter data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
          )}
          style={{ width: `min(${width}px, calc(100vw - 64px))` }}
        >
          <PeekInset width={width} />
          {resizable && <PanelResizeHandle width={width} min={MIN_WIDTH} max={MAX_WIDTH} onWidth={setWidth} />}
          {head}
          {body}
        </RDlg.Content>
      </RDlg.Portal>
    </RDlg.Root>
  );
}

// ── The room a side peek takes ──────────────────────────────────────────────
// Toasts rise bottom-right, which is exactly where an open side peek keeps its own controls — a task's message
// box and Send button sat under "Your change was undone" for its eight seconds. While a peek is open it publishes
// how much of the window's right edge it covers (`--peek-inset`, the peek's own width plus its 4px inset); the
// toaster reads it and rises beside the peek instead of on it (components/ds/ui/toast.tsx). Rendered inside the
// peek, so it exists exactly as long as the peek does.
function PeekInset({ width }: { width: number }) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--peek-inset", `calc(min(${width}px, 100vw - 64px) + 4px)`);
    return () => { root.style.removeProperty("--peek-inset"); };
  }, [width]);
  return null;
}

// ── Where focus lands when a page opens ─────────────────────────────────────
// On the PAGE itself, in every mode — never on its first control. Radix's default
// focuses the first focusable element, which is the toolbar's "View mode" button,
// so its tooltip popped open on every single open. The in-pane mode learned this
// first (2026-09-14); the modal, peek and side modes kept the old behaviour until
// Content's saved and capture views showed the tooltip over their own header.
// Keyboard users still land inside the page, and Tab reaches the toolbar next.
function focusPage(e: Event) {
  e.preventDefault();
  (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
}

// ── The universal toolbar ───────────────────────────────────────────────────
// Identical in every mode and every module: history, then the shared group
// (expand · view mode · new tab · more), then close.
function PageViewToolbar({
  mode, href, history, actions, more, contentType,
  onPick, onSetTypeDefault, onSetGlobalDefault, onSetOwnedDefault, defaultScope, onNewTab, showClose = true,
}: {
  mode: PageViewMode;
  href?: string;
  history?: PageViewHistory;
  actions?: React.ReactNode;
  more?: React.ReactNode;
  contentType: ContentType;
  onPick: (m: PageViewMode) => void;
  onSetTypeDefault: (m: PageViewMode) => void;
  onSetGlobalDefault: (m: PageViewMode) => void;
  onSetOwnedDefault?: (m: PageViewMode) => void;
  defaultScope?: string;
  onNewTab: () => void;
  /** False for a page inside the content pane, which leaves by its back arrow. */
  showClose?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {history && (
        <>
          <IconButton
            size="sm" variant="ghost" label="Back" tooltip="Back · ←"
            disabled={!history.canBack} onClick={history.onBack}
            icon={<Icon icon={ArrowLeft} size={16} />}
          />
          <IconButton
            size="sm" variant="ghost" label="Forward" tooltip="Forward · →"
            disabled={!history.canForward} onClick={history.onForward}
            icon={<Icon icon={ArrowRight} size={16} />}
          />
          <span aria-hidden className="mx-1 h-4 w-px bg-line-soft" />
        </>
      )}

      {actions}

      {mode !== "full-page" && (
        <IconButton
          size="sm" variant="ghost" label="Open in full page" tooltip="Open in full page · ⌘↵"
          onClick={() => onPick("full-page")}
          icon={<Icon icon={ModeFullPage} size={16} />}
        />
      )}

      <ViewModeMenu
        mode={mode}
        hasHref={!!href}
        contentType={contentType}
        onPick={onPick}
        onSetTypeDefault={onSetTypeDefault}
        onSetGlobalDefault={onSetGlobalDefault}
        onSetOwnedDefault={onSetOwnedDefault}
        defaultScope={defaultScope}
        onNewTab={onNewTab}
      />

      {href && (
        <IconButton
          size="sm" variant="ghost" label="Open in new tab" tooltip="Open in new tab · ⌘⇧↵"
          onClick={onNewTab}
          icon={<Icon icon={ExternalLink} size={16} />}
        />
      )}

      {more && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" variant="ghost" label="More" tooltip="More" icon={<Icon icon={MoreHorizontal} size={16} />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{more}</DropdownMenuContent>
        </DropdownMenu>
      )}

      {showClose && (
        <RDlg.Close asChild>
          <IconButton size="sm" variant="ghost" label="Close" tooltip="Close · Esc" icon={<Icon icon={X} size={16} />} />
        </RDlg.Close>
      )}
    </div>
  );
}

// ── The one view-mode menu in the entire application ────────────────────────
function ViewModeMenu({
  mode, hasHref, contentType, onPick, onSetTypeDefault, onSetGlobalDefault, onSetOwnedDefault, defaultScope, onNewTab,
}: {
  mode: PageViewMode;
  hasHref: boolean;
  contentType: ContentType;
  onPick: (m: PageViewMode) => void;
  onSetTypeDefault: (m: PageViewMode) => void;
  onSetGlobalDefault: (m: PageViewMode) => void;
  /** Present when the caller owns the preference (a database view). */
  onSetOwnedDefault?: (m: PageViewMode) => void;
  defaultScope?: string;
  onNewTab: () => void;
}) {
  const modes: PageViewMode[] = ["side-peek", "center-peek", "full-page"];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          size="sm" variant="ghost" label="View mode" tooltip="View mode"
          icon={<Icon icon={MODE_ICON[mode]} size={16} />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Open page as</DropdownMenuLabel>
        {modes.map((m) => (
          <DropdownMenuItem
            key={m}
            onSelect={() => onPick(m)}
            icon={<Icon icon={MODE_ICON[m]} size={16} />}
            active={m === mode}
            description={MODE_HINT[m]}
          >
            {MODE_LABEL[m]}
          </DropdownMenuItem>
        ))}
        {hasHref && (
          <DropdownMenuItem onSelect={onNewTab} icon={<Icon icon={ExternalLink} size={16} />}>
            New tab
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {onSetOwnedDefault ? (
          // The caller owns this preference (a database view). Its default is the
          // only one that changes how the next page here opens, so it is the only
          // one offered — a per-type or global default would sit underneath it.
          <DropdownMenuItem onSelect={() => onSetOwnedDefault(mode)}>
            Set as default for {defaultScope ?? PLURAL[contentType]}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => onSetTypeDefault(mode)}>
              Set as default for {PLURAL[contentType]}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSetGlobalDefault(mode)}>
              Set as default for everything
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Sentence case, plural — "Set as default for tasks". Kept beside the menu that
// is its only caller rather than in the glossary, because these are grammatical
// forms of the type names, not new vocabulary.
const PLURAL: Record<ContentType, string> = {
  task: "tasks",
  document: "documents",
  project: "projects",
  client: "clients",
  invoice: "invoices",
  form: "forms",
  "form-response": "responses",
  habit: "habits",
  goal: "goals",
  calendar: "events",
  "database-row": "rows",
  meeting: "meetings",
  finance: "finance entries",
  contact: "contacts",
  "collection-item": "collection items",
};

// ── Resize ──────────────────────────────────────────────────────────────────
