'use client';
// A database's views, held the way Notion's view bar holds them (the user,
// 2026-09-15, with screenshots):
//
//   · Up to three named tabs, the one you are on always among them; the rest fold
//     under "N more…" (`visibleTabs`, lib/view-list.ts).
//   · "N more…" lists every view: search them, drag one to re-order, open any
//     view's menu from its ⋯, or make a new one.
//   · Right-click a tab — or click the tab you are already on — for its menu:
//     Rename · Display as · Edit view · Copy link to view · Open as full page ·
//     Show database title · Duplicate view · Delete view.
//
// What this bar changes is the database's `views`, which everyone sees and ⌘Z
// takes back. How a tab is DRAWN — text, icon or both — is the one exception: it is
// yours alone ("Only applies to you"), kept on this device (lib/view-tab-display.ts).
//
// Naming: Notion's item reads "Show data source titles". Zenboard has no data
// sources; the thing it shows is the database's title, and the glossary gives one
// name per concept.
import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Copy, Eye, EyeOff, Link as LinkIcon, Maximize2, MoreHorizontal, Paintbrush, Pencil, Plus, Search, SlidersHorizontal, Trash2,
} from '@/components/ds/icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Icon, IconButton, MenuField, Popover, PopoverAnchor,
  PopoverContent, PopoverTrigger, MENU_SEPARATOR_CLASS, SegmentedControl,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import type { ViewDef, ViewKind } from '@/lib/collections';
import { matchViews, visibleTabs } from '@/lib/view-list';
import { setTabDisplay, TAB_DISPLAYS, TAB_DISPLAY_LABEL, useTabDisplays, type TabDisplay } from '@/lib/view-tab-display';
import { SortableList } from './sortable-list';
import { VIEW_CHOICES, VIEW_ICON } from './view-icons';

/** What a view's menu can do. The two optional ones belong to a database inside a document. */
export interface ViewActions {
  onRename: (id: string, name: string) => void;
  /** Open this view's settings. */
  onEdit: (id: string) => void;
  onCopyLink: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Open the database as its own page, on this view. */
  onOpenFull?: (id: string) => void;
  /** Show or hide the database's name above the bar. */
  onToggleTitle?: () => void;
  titleShown?: boolean;
}

type Anchored = { id: string; el: HTMLElement };

export function DatabaseViewsBar({ views, currentId, onSelect, onAdd, onReorder, actions }: {
  views: ViewDef[];
  currentId: string;
  onSelect: (id: string) => void;
  onAdd: (kind: ViewKind) => void;
  onReorder: (ids: string[]) => void;
  actions: ViewActions;
}) {
  const displays = useTabDisplays();
  const { tabs, more } = visibleTabs(views, currentId);
  const barRef = useRef<HTMLDivElement>(null);
  // The tab menu, and where it hangs: under the tab it was opened on.
  const [menu, setMenu] = useState<(Anchored & { box: { left: number; top: number; width: number; height: number } }) | null>(null);
  const [renaming, setRenaming] = useState<Anchored | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  // A menu item that opens another panel (Rename, Edit view) hands focus to it: the
  // menu must not pull focus back to the tab as it closes, or the new panel reads
  // that as a click away and shuts at once.
  const handoff = useRef(false);

  const tabAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[role="radio"][data-value]') : null;
  const openMenu = (tab: HTMLElement) => {
    const bar = barRef.current;
    if (!bar) return;
    const t = tab.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    setMenu({ id: tab.dataset.value!, el: tab, box: { left: t.left - b.left, top: t.top - b.top, width: t.width, height: t.height } });
  };

  const menuView = menu ? views.find((v) => v.id === menu.id) : undefined;
  const renameView = renaming ? views.find((v) => v.id === renaming.id) : undefined;
  const matched = matchViews(views, query);
  const rename = (anchor: Anchored) => { handoff.current = true; setRenaming(anchor); };
  const edit = (id: string) => { handoff.current = true; actions.onEdit(id); };

  return (
    <div className="flex min-w-0 flex-auto items-center gap-0.5">
      <div
        ref={barRef}
        className="relative flex min-w-0 items-center"
        onContextMenu={(e) => {
          const tab = tabAt(e.target);
          if (!tab) return;
          e.preventDefault();
          if (tab.dataset.value !== currentId) onSelect(tab.dataset.value!);
          openMenu(tab);
        }}
        // A click on the view you are already on opens its menu (Notion) — the one
        // way to it on a phone, where there is no right-click. A click on another tab
        // has chosen it by now, and `currentId` is still the view it left.
        onClick={(e) => {
          const tab = tabAt(e.target);
          if (tab && tab.dataset.value === currentId) openMenu(tab);
        }}
      >
        <SegmentedControl
          variant="tabs"
          aria-label="Database views"
          options={tabs.map((v) => ({ value: v.id, label: <TabLabel view={v} display={displays[v.id] ?? 'icon-text'} /> }))}
          value={currentId}
          onValueChange={onSelect}
        />
        {menu && menuView && (
          <DropdownMenu open onOpenChange={(open) => { if (!open) setMenu(null); }}>
            <DropdownMenuTrigger asChild>
              <span aria-hidden tabIndex={-1} className="pointer-events-none absolute" style={menu.box} />
            </DropdownMenuTrigger>
            <ViewMenu
              view={menuView} views={views} actions={actions} display={displays[menuView.id] ?? 'icon-text'}
              onRename={() => rename(menu)} onEdit={() => edit(menuView.id)}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                if (!handoff.current) menu.el.focus();
                handoff.current = false;
              }}
            />
          </DropdownMenu>
        )}
      </div>

      {more > 0 ? (
        <Popover open={moreOpen} onOpenChange={(open) => { setMoreOpen(open); if (!open) setQuery(''); }}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${more} more ${more === 1 ? 'view' : 'views'}`}
              className="focus-ring h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-ui text-ink-600 transition-colors duration-fast hover:bg-surface-hover hover:text-ink-800 data-[state=open]:bg-surface-hover data-[state=open]:text-ink-800">
              {more} more…
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" flush className="w-72 p-1">
            <MenuField autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a view…" aria-label="Search for a view"
              icon={<Icon icon={Search} size={16} />} />
            <div className="mt-1 max-h-80 overflow-y-auto">
              <SortableList
                items={matched}
                noun="view"
                // A filtered list has no order of its own to change.
                disabled={query.trim() !== ''}
                onReorder={onReorder}
                // The whole row washes, handle to ⋯, and the view you are on stays washed.
                rowClassName={(v) => cn('group flex min-h-8 items-center gap-0.5 rounded-md px-1 transition-colors duration-fast',
                  v.id === currentId ? 'bg-surface-active' : 'hover:bg-surface-hover')}
                renderRow={(v, handle) => (
                  <MoreRow view={v} views={views} actions={actions} display={displays[v.id] ?? 'icon-text'}
                    handle={handle} current={v.id === currentId}
                    onPick={() => { onSelect(v.id); setMoreOpen(false); }}
                    onRename={(el) => rename({ id: v.id, el })}
                    onEdit={() => { setMoreOpen(false); edit(v.id); }}
                    onMenuClosed={(e) => { if (handoff.current) { e.preventDefault(); handoff.current = false; } }}
                  />
                )}
              />
              {matched.length === 0 && <p className="px-2 py-1.5 text-ui text-ink-500">No views match.</p>}
            </div>
            <div aria-hidden className={MENU_SEPARATOR_CLASS} />
            <AddViewMenu align="start" onAdd={(kind) => { onAdd(kind); setMoreOpen(false); }}>
              <button type="button"
                className="focus-ring flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-ui text-ink-700 transition-colors duration-fast hover:bg-surface-hover data-[state=open]:bg-surface-hover">
                <Icon icon={Plus} size={16} className="text-ink-600" /> New view
              </button>
            </AddViewMenu>
          </PopoverContent>
        </Popover>
      ) : (
        <AddViewMenu align="start" onAdd={onAdd}>
          <IconButton size="sm" label="Add view" icon={<Icon icon={Plus} size={16} />} />
        </AddViewMenu>
      )}

      {renaming && renameView && (
        <RenamePopover
          anchor={renaming.el}
          initial={renameView.name}
          onDone={(name) => {
            setRenaming(null);
            if (name && name !== renameView.name) actions.onRename(renameView.id, name);
          }}
        />
      )}
    </div>
  );
}

/** A tab's face: the layout's glyph and the view's name, or one of them ("Display as"). */
function TabLabel({ view, display }: { view: ViewDef; display: TabDisplay }) {
  const name = view.name || 'Untitled';
  if (display === 'text') return <span>{name}</span>;
  if (display === 'icon') {
    return (
      <span className="inline-flex items-center" title={name}>
        <Icon icon={VIEW_ICON[view.kind]} size={16} />
        <span className="sr-only">{name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon icon={VIEW_ICON[view.kind]} size={16} className="shrink-0" />{name}
    </span>
  );
}

/** One view in the "more" list: its handle, its name to switch to it, and its ⋯. */
function MoreRow({ view, views, actions, display, handle, current, onPick, onRename, onEdit, onMenuClosed }: {
  view: ViewDef; views: ViewDef[]; actions: ViewActions; display: TabDisplay;
  handle: ReactNode; current: boolean;
  onPick: () => void;
  /** Rename hangs under this row's name. */
  onRename: (el: HTMLElement) => void;
  onEdit: () => void;
  onMenuClosed: (e: Event) => void;
}) {
  const nameRef = useRef<HTMLButtonElement>(null);
  const renameHere = () => { if (nameRef.current) onRename(nameRef.current); };
  return (
    <>
      {handle}
      <button ref={nameRef} type="button" onClick={onPick} aria-current={current ? 'true' : undefined}
        className={cn('focus-ring flex h-7 min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 text-left text-ui', current ? 'text-ink-900' : 'text-ink-700')}>
        <Icon icon={VIEW_ICON[view.kind]} size={16} className="shrink-0 text-ink-600" />
        <span className="truncate">{view.name || 'Untitled'}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton size="xs" label={`${view.name || 'Untitled'} options`} icon={<Icon icon={MoreHorizontal} size={16} />} />
        </DropdownMenuTrigger>
        <ViewMenu view={view} views={views} actions={actions} display={display} align="end"
          onRename={renameHere} onEdit={onEdit} onCloseAutoFocus={onMenuClosed} />
      </DropdownMenu>
    </>
  );
}

/** A view's menu — the same eight things from a tab and from the "more" list. */
function ViewMenu({ view, views, actions, display, onRename, onEdit, onCloseAutoFocus, align = 'start' }: {
  view: ViewDef; views: ViewDef[]; actions: ViewActions; display: TabDisplay;
  onRename: () => void; onEdit: () => void;
  onCloseAutoFocus?: (e: Event) => void;
  align?: 'start' | 'end';
}) {
  return (
    <DropdownMenuContent align={align} className="w-60" onCloseAutoFocus={onCloseAutoFocus}>
      <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={onRename}>Rename</DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<Icon icon={Paintbrush} size={16} />}>Display as</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          {TAB_DISPLAYS.map((d) => (
            <DropdownMenuItem key={d} active={display === d} onSelect={() => setTabDisplay(view.id, d)}>{TAB_DISPLAY_LABEL[d]}</DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-caption font-normal text-ink-500">Only applies to you</DropdownMenuLabel>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem icon={<Icon icon={SlidersHorizontal} size={16} />} onSelect={onEdit}>Edit view</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={<Icon icon={LinkIcon} size={16} />} onSelect={() => actions.onCopyLink(view.id)}>Copy link to view</DropdownMenuItem>
      {actions.onOpenFull && (
        <DropdownMenuItem icon={<Icon icon={Maximize2} size={16} />} onSelect={() => actions.onOpenFull!(view.id)}>Open as full page</DropdownMenuItem>
      )}
      {actions.onToggleTitle && (
        <DropdownMenuItem icon={<Icon icon={actions.titleShown ? EyeOff : Eye} size={16} />} onSelect={actions.onToggleTitle}>
          {actions.titleShown ? 'Hide database title' : 'Show database title'}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={<Icon icon={Copy} size={16} />} onSelect={() => actions.onDuplicate(view.id)}>Duplicate view</DropdownMenuItem>
      {/* A database keeps one view: the last cannot be deleted, and says so by being disabled. */}
      <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} disabled={views.length <= 1} onSelect={() => actions.onDelete(view.id)}>
        Delete view
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

/** The layouts a new view can take — from the + beside the tabs, or "New view" in the list. */
function AddViewMenu({ onAdd, align, children }: { onAdd: (kind: ViewKind) => void; align: 'start' | 'end'; children: ReactElement }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {VIEW_CHOICES.map((m) => (
          <DropdownMenuItem key={m.kind} icon={<Icon icon={m.icon} size={16} />} onSelect={() => onAdd(m.kind)}>{m.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A view's name, edited under the tab or row it belongs to. Enter, or clicking away,
 * keeps what was typed; Escape keeps the old name. Clicking away is caught on the
 * panel itself: the field is gone before it could hear its own blur.
 */
function RenamePopover({ anchor, initial, onDone }: { anchor: HTMLElement; initial: string; onDone: (name: string) => void }) {
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (name: string) => { if (done.current) return; done.current = true; onDone(name.trim()); };
  return (
    <Popover open onOpenChange={(open) => { if (!open) finish(field.current?.value ?? initial); }}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent align="start" flush className="w-64 p-1"
        onEscapeKeyDown={() => finish(initial)}
        onCloseAutoFocus={(e) => { e.preventDefault(); anchor.focus(); }}>
        <MenuField ref={field} autoFocus defaultValue={initial} aria-label="View name" placeholder="View name"
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); finish(e.currentTarget.value); }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
