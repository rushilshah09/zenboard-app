'use client';
// ── THE CHAT HISTORY RAIL ───────────────────────────────────────────────────
//
// USER DIRECTION 2026-09-29: "left side of history chat collessable … i want claude like claude
// chat expirence", with Claude's and Notion AI's sidebars beside a screenshot of Ask.
//
// ── WHAT THIS IS NOT ALLOWED TO BE ──────────────────────────────────────────
// It is not a second sidebar. Zenboard already has the archetype for "a rail beside a detail"
// (`components/ui/hub-layout.tsx`), and that archetype already owns the two-pane geometry, the
// responsive stack below `md`, both scroll regions, the rail's landmark — and the COLLAPSE, which
// is the thing the user asked for by name. Writing a collapsible column here would have been the
// exact failure HubLayout's own header describes: two hubs that look alike until one is touched.
// So this file draws ROWS, and nothing else. Where it sits and how it hides is the layout's.
//
// The row recipe is `railBtn`, exported by the Tasks rail, so a conversation row is the same
// object as a project row — same height (`--row-nav`), same insets, same selected wash. A third
// spelling of a nav row is how the sidebar and the rail drifted 10px apart the first time
// (components/shell/nav-rhythm.test.ts).
//
// ── SELECTION LIVES IN THE URL ──────────────────────────────────────────────
// `?chat=<id>`, like every other rail in this product: a conversation is linkable, and coming back
// to Home lands you in the one you were reading. This file does not decide HOW the URL changes — it
// calls `onSelect`. `use-ask-history.ts` writes it, with `replaceState`, because choosing a
// conversation is choosing a RECORD ([[zenboard-hub-url-rule]]) — and it writes it off the STORE
// rather than off this click, so the address bar is right when the side panel changes the
// conversation with Home behind it.
//
// ── SEARCH IS TITLES ONLY, AND SAYS SO BY BEING INSTANT ─────────────────────
// `filterConversations` runs on the rows already in the browser. Message bodies are Search v2's
// job (`lib/search.ts`) and a rail filter that quietly became a server query would be slow in the
// one moment it has to feel instant: while you are typing.
import * as React from 'react';

import { Bookmark, Ellipsis, MessageSquare, Pencil, Plus, Search, Trash2 } from '@/components/ds/icons';
import {
  Button, Icon, IconButton, TextInput,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  EmptyLine,
} from '@/components/ds/ui';
import { railBtn } from '@/components/tasks/tasks-rail';
import { filterConversations, groupConversations, type AskConversation } from '@/lib/ask-history';
import { cn } from '@/lib/cn';

export function AskHistoryRail({
  conversations, selectedId, today, dayOf, onSelect, onNew, onRename, onPin, onDelete, busy,
}: {
  conversations: readonly AskConversation[];
  selectedId: string | null;
  /** The person's own today, as a day id. Passed in — this component never reads a clock. */
  today: string;
  /** An instant → the day it falls on in the person's zone. Passed in for the same reason. */
  dayOf: (iso: string) => string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  /** An answer is in flight, so nothing that would abandon it can be pressed. */
  busy?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  // The row being renamed in place. A modal for a title is a dialog to change one word — the
  // doc title, the form heading and the project name are all edited in place for the same reason.
  const [editing, setEditing] = React.useState<string | null>(null);
  // Set by the Rename item, read by the menu as it closes — see the note at `onCloseAutoFocus`.
  const renaming = React.useRef(false);

  const matches = React.useMemo(() => filterConversations(conversations, query), [conversations, query]);
  const groups = React.useMemo(() => groupConversations(matches, { today, dayOf }), [matches, today, dayOf]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      {/* New chat sits ABOVE search, as it does in both references: starting something is the
          more common act, and a control you reach for constantly should not be below one you
          reach for occasionally. `secondary`, never the filled accent — CLAUDE.md allows the
          page one filled-accent element and Ask's Send is it. */}
      <Button variant="secondary" size="sm" className="w-full justify-start" icon={<Icon icon={Plus} size={16} />} onClick={onNew} disabled={busy}>
        New chat
      </Button>

      {/* The search field appears only once there is enough history to need it. A filter over
          three rows is furniture that asks to be used and then does nothing. */}
      {conversations.length > 6 && (
        <TextInput
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={query ? () => setQuery('') : undefined}
          icon={<Icon icon={Search} size={14} />}
          placeholder="Search chats"
          aria-label="Search chats"
        />
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {groups.length === 0 ? (
          // `EmptyLine`, not `EmptyState`: something IS on the screen (the rail, its button) and
          // only this part of it is empty — the DS says which in states.tsx, and a page-sized
          // 180px state inside a 230px column is a billboard in a corridor.
          <EmptyLine>{query ? 'No chats match that.' : 'Your chats will appear here.'}</EmptyLine>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-3 last:mb-0">
              <h3 className="px-[var(--nav-px,8px)] pb-1 text-overline text-ink-500">{group.label}</h3>
              <ul className="flex flex-col gap-[var(--nav-row-gap,6px)]">
                {group.items.map((c) => (
                  <li key={c.id} className="group/row relative">
                    {editing === c.id ? (
                      <RenameRow
                        title={c.title}
                        onDone={(next) => { setEditing(null); if (next && next !== c.title) onRename(c.id, next); }}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelect(c.id)}
                          aria-current={selectedId === c.id ? 'true' : undefined}
                          className={cn(railBtn(selectedId === c.id), 'w-full pe-8')}
                        >
                          <Icon icon={MessageSquare} size={16} className="shrink-0 text-ink-500" />
                          <span className="min-w-0 flex-1 truncate">{c.title}</span>
                        </button>
                        {/* The kebab REVEALS on hover and stays for focus — the star/flag rule:
                            a glyph renders when it means something. It is a sibling of the row,
                            not a child: a button inside a button is not a legal thing to build,
                            and it is why the row above reserves `pe-8` for it. */}
                        <div className="absolute end-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-fast ease-hover focus-within:opacity-100 group-hover/row:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <IconButton size="sm" label={`Chat options for ${c.title}`} icon={<Icon icon={Ellipsis} size={16} />} />
                            </DropdownMenuTrigger>
                            {/* RENAME OPENS A FIELD, AND FOCUS BELONGS IN IT. A closing Radix menu
                                hands focus back to its trigger, which yanked the caret straight out
                                of the field that had just mounted — and the field COMMITS ON BLUR,
                                so the rename ended the instant it began, with the old name, and
                                nothing on screen said anything had happened. Found in the browser,
                                2026-09-30; the identical two lines are in
                                components/projects/workstream-controls.tsx, which met it first. The
                                flag is why Pin and Delete still hand focus back the way a keyboard
                                expects. */}
                            <DropdownMenuContent
                              align="end"
                              onCloseAutoFocus={(e) => { if (renaming.current) { e.preventDefault(); renaming.current = false; } }}
                            >
                              {/* `icon` and `danger` are the DS item's own props — a hand-placed
                                  glyph child and a `variant` string are two ways of saying what
                                  this component already says once. */}
                              <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={() => { renaming.current = true; setEditing(c.id); }}>
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem icon={<Icon icon={Bookmark} size={16} />} onSelect={() => onPin(c.id, !c.pinned)}>
                                {c.pinned ? 'Unpin' : 'Pin'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem danger icon={<Icon icon={Trash2} size={16} />} onSelect={() => onDelete(c.id)}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Renaming, in the row itself.
 *
 * Enter commits, Escape abandons, blur commits — the app's one editing grammar (the doc title and
 * the task title already behave this way, and a person who learns it once should not have to learn
 * a second). Escape must call `onDone(null)` BEFORE the blur fires, which is why it stops
 * propagation: otherwise the blur commits the edit Escape just cancelled.
 */
function RenameRow({ title, onDone }: { title: string; onDone: (next: string | null) => void }) {
  const [value, setValue] = React.useState(title);
  const done = React.useRef(false);
  const finish = (next: string | null) => { if (done.current) return; done.current = true; onDone(next); };

  return (
    <TextInput
      size="sm"
      autoFocus
      value={value}
      aria-label="Chat name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(value.trim() || null); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
      }}
    />
  );
}
