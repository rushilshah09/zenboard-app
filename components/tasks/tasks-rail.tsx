'use client';
// THE Tasks rail — Inbox · Today, saved Views, Projects, Lists, and Completed
// pinned to the foot.
//
// It is rendered by BOTH the list layout and the board, and that is the whole
// point of it being its own file. Before, the list drew this rail and the board
// drew a 320px column where the rail should have been, so switching layout
// swapped the entire page. Only the centre should change.
//
// Selection lives in the URL, not in component state — clicking "Today" from
// the board has to be able to land you in the list, and a rail selection should
// be linkable. But the rail does not decide HOW the URL changes: it calls
// `onSelect`, and on Tasks that is a `pushState` rather than a navigation,
// because every row here filters tasks the browser already has. Row language
// matches the global sidebar: 34px, 8px gap, rounded-sm, ink-600 → ink-900 with
// the neutral selected wash (B&G — no edge bar).
//
// ── PROJECTS AND LISTS ARE TWO SECTIONS ────────────────────────────────────
// There used to be one, headed "List", and every row in it was a PROJECT. That
// was a lie told by a label, and it had a real cost: the only way to have a
// pile called "Priority" was to invent a project, which put it in the projects
// gallery, the Finance rollup and the client portal. 0038 gives lists their own
// table (lib/task-scopes.ts explains why they are not labels either). Both
// sections are drawn by ONE `ScopeSection` below, because two sections that
// look alike and drift apart is the failure this codebase keeps finding.
//
// ── THE CHECKBOX IS THE COLOUR SWATCH ──────────────────────────────────────
// Every project and list row leads with a checkbox tinted in that pile's own
// colour. It answers two questions with one control — "which pile is this?" and
// "is it showing?" — which is exactly what Google Calendar's calendar list does,
// and it is why the rail needs no separate dot beside the box. Unticking is a
// view control, never a delete: the tasks are still there and one click brings
// them back.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Inbox as Tray, SquareCheckBig as CheckSquare, CalendarCheck,
  Trash2 as Trash, Filter as FunnelSimple, ChevronDown as CaretDown,
  Ellipsis as DotsThree, Pencil,
} from '@/components/ds/icons';
import {
  Icon, IconButton, toastReverted,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ds/ui';
import { LayerToggle } from '@/components/ds/ui/layer-toggle';
import { createSavedView, deleteSavedView } from '@/lib/actions/saved-views';
import { cn } from '@/lib/cn';
import { scopeKey, SCOPE_COLORS, type Scope } from '@/lib/task-scopes';
import { scopeFill } from '@/lib/entity-color';
import type { View, SavedViewDef, RailFilter, RailCounts, RailActive, ScopeCounts } from './types';
import { tempId } from '@/lib/temp-id';
import { useServerState } from '@/lib/use-server-state';

export const railBtn = (on: boolean) => cn(
  'focus-ring group relative flex h-[var(--row-nav)] items-center gap-[var(--nav-gap,8px)] rounded-sm px-[var(--nav-px,8px)] text-left text-ui transition-colors duration-fast',
  on ? 'bg-surface-selected font-medium text-ink-900' : 'font-normal text-ink-600 hover:bg-surface-hover hover:text-ink-800',
);
// The section-label ROLE (CLAUDE.md), not a private 11px copy of it: seven files spelled their own.
const sectionLabel = 'text-overline text-ink-500';

// The WORKING views — the two places you actually stand: what came in, and what
// you said you'd do today.
const VIEWS: { id: View; label: string; icon: typeof Tray }[] = [
  { id: 'inbox', label: 'Inbox', icon: Tray },
  { id: 'today', label: 'Today', icon: CalendarCheck },
];
// Completed is the rail's FOOTER, not a third working view: it's where finished
// work rests, which is the role Trash plays in the Documents rail — so it takes
// the same position, pinned to the foot behind a hairline.
const DONE_VIEW: { id: View; label: string; icon: typeof Tray } = { id: 'completed', label: 'Completed', icon: CheckSquare };

function RailView({ def, on, count, narrow, onClick }: {
  def: { id: View; label: string; icon: typeof Tray }; on: boolean; count: number; narrow: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-current={on ? 'true' : undefined} className={cn(railBtn(on), 'shrink-0')}>
      <Icon icon={def.icon} size={16} className="shrink-0" />
      <span className={narrow ? undefined : 'flex-1 overflow-hidden text-ellipsis whitespace-nowrap'}>{def.label}</span>
      {!narrow && count > 0 && <span className="text-caption tabular-nums text-ink-500">{count}</span>}
    </button>
  );
}

/** A collapsible section header: caret · label · optional add button. */
function SectionHead({ label, open, onToggle, addLabel, onAdd }: {
  label: string; open: boolean; onToggle: () => void; addLabel?: string; onAdd?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="focus-ring flex flex-1 items-center gap-1.5 rounded-xs text-left">
        <Icon icon={CaretDown} size={12} aria-hidden className={cn('text-ink-500 transition-transform duration-fast ease-standard', !open && '-rotate-90')} />
        <span className={sectionLabel}>{label}</span>
      </button>
      {onAdd && addLabel && (
        <IconButton size="xs" variant="ghost" onClick={onAdd} label={addLabel} icon={<Icon icon={Plus} size={12} />} />
      )}
    </div>
  );
}

/**
 * ONE row for a project or a list.
 *
 * Drawn by the shared `LayerToggle`, which is also what the calendar rail uses:
 * "is this coloured pile showing?" is one question and must have one answer in
 * the UI. It used to be the task `Checkbox` with a `tint`, and for a project
 * with no colour that tint was null — so it rendered a BLACK TICKED BOX,
 * identical to the "Mark done" boxes in the list beside it. See the component
 * for why the colour is now never optional.
 */
function ScopeRow({ scope, on, shown, count, onPick, onToggleShown, actions }: {
  scope: Scope; on: boolean; shown: boolean; count: number;
  onPick: () => void; onToggleShown: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <LayerToggle
      id={scope.id}
      name={scope.name}
      color={scope.color}
      on={shown}
      onToggle={onToggleShown}
      count={count}
      onSelect={onPick}
      selected={on}
      actions={actions}
      className="group/row"
    />
  );
}

export function TasksRail({
  counts, scopeCounts = {}, projects, lists, listsSupported = false, savedViews, savedViewsSupported = false,
  active, current, saveSnapshot, narrow, onSelect, hidden, onToggleScope,
  onCreateList, onRenameList, onRecolourList, onDeleteList,
}: {
  counts: RailCounts;
  scopeCounts?: ScopeCounts;
  projects: Scope[];
  lists: Scope[];
  /** False until migration 0038 is applied — the Lists section stays hidden. */
  listsSupported?: boolean;
  savedViews: SavedViewDef[];
  savedViewsSupported?: boolean;
  active: RailActive;
  /** The host's full current combo, so the matching saved view can light up. */
  current?: RailFilter;
  /** Present only when the host has a filter combo worth saving. */
  saveSnapshot?: RailFilter;
  narrow: boolean;
  /**
   * Change the selection. The host decides HOW — and on Tasks that is a
   * `pushState`, not a navigation, because every row here filters tasks the
   * browser is already holding. Clicking "Today" used to re-fetch every task
   * you own to draw a subset of them.
   */
  onSelect: (f: RailFilter) => void;
  /** Scope keys that are switched off. Owned by the host so the list and the
   *  board apply the same set to the same tasks. */
  hidden: ReadonlySet<string>;
  onToggleScope: (key: string) => void;
  onCreateList?: (name: string) => void;
  onRenameList?: (id: string, name: string) => void;
  onRecolourList?: (id: string, color: string) => void;
  onDeleteList?: (id: string) => void;
}) {
  const router = useRouter();
  // `useServerState`, not `useState`: saved views are the SERVER's, so a refresh
  // — another device's edit, or the failure net correcting a save that did not
  // land — has to reach them. Seeded once with `useState`, this list ignored
  // every refresh it was ever sent. (Safe because both parents now default the
  // prop to the frozen `NO_SAVED_VIEWS` rather than a fresh `[]`.)
  const [views, setViews] = useServerState(savedViews);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  const [newList, setNewList] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // Sections collapse. Per-mount rather than persisted: a rail that reopens
  // with everything shut hides the thing you were working in.
  const [openSections, setOpenSections] = useState({ views: true, projects: true, lists: true });
  const toggleSection = (k: keyof typeof openSections) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  const go = (f: RailFilter) => onSelect(f);
  const pickView = (id: View) => go({ view: id });
  // Clicking the lit pile clears it, which is the only way back to Inbox from a
  // pile without reaching for another row.
  const pickScope = (key: string) => go(active.scope === key ? { view: 'inbox' } : { scope: key });

  const viewMatches = (v: SavedViewDef) => {
    if (!current) return false;
    const f = v.filter || {};
    const fScope = f.scope ?? (f.listId ? scopeKey('project', f.listId) : null);
    return (f.view ?? 'inbox') === (current.view ?? 'inbox')
      && (f.filter ?? 'all') === (current.filter ?? 'all')
      && (f.labelId ?? null) === (current.labelId ?? null)
      && fScope === (current.scope ?? null);
  };

  async function saveView() {
    const name = viewName.trim();
    if (!name || !saveSnapshot) return;
    setViewName(''); setSavingView(false);
    const tmp = { id: tempId(), name, filter: saveSnapshot };
    setViews((vs) => [...vs, tmp]);
    const res = await createSavedView(name, saveSnapshot);
    if ('error' in res) { setViews((vs) => vs.filter((v) => v.id !== tmp.id)); toastReverted(res.error); }
    else setViews((vs) => vs.map((v) => (v.id === tmp.id ? { ...v, id: res.id } : v)));
  }
  async function removeView(id: string) {
    setViews((vs) => vs.filter((v) => v.id !== id));
    await deleteSavedView(id);
  }

  const viewRows = VIEWS.map((v) => (
    <RailView key={v.id} def={v} on={active.view === v.id && !active.scope} count={counts[v.id]} narrow={narrow} onClick={() => pickView(v.id)} />
  ));

  // A small text field reused by "save this view", "new list" and "rename list"
  // — three places that were about to grow three slightly different inputs.
  const inlineInput = (props: {
    value: string; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void; placeholder: string; label: string;
  }) => (
    <div className="flex items-center gap-1.5 px-1 pb-1">
      <input autoFocus value={props.value} onChange={(e) => props.onChange(e.target.value)}
        aria-label={props.label}
        onBlur={props.onCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') props.onCommit(); if (e.key === 'Escape') props.onCancel(); }}
        placeholder={props.placeholder} autoComplete="off" data-1p-ignore data-lpignore="true"
        className="focus-ring min-w-0 flex-1 rounded-sm border border-line-strong bg-surface-raised px-2 py-1.5 text-caption text-ink-800 outline-none placeholder:text-ink-500" />
    </div>
  );

  const scopeSection = (opts: {
    key: 'projects' | 'lists'; label: string; scopes: Scope[];
    addLabel: string; onAdd: () => void; manage: boolean;
  }) => (
    <>
      <div aria-hidden className="-mx-2 mb-1 mt-2 h-px bg-line-soft" />
      <SectionHead label={opts.label} open={openSections[opts.key]} onToggle={() => toggleSection(opts.key)}
        addLabel={opts.addLabel} onAdd={opts.onAdd} />
      {openSections[opts.key] && (
        <>
          {opts.key === 'lists' && newList !== null &&
            inlineInput({
              value: newList, onChange: setNewList, placeholder: 'List name…', label: 'New list name',
              onCommit: () => { const n = newList.trim(); if (n) onCreateList?.(n); setNewList(null); },
              onCancel: () => setNewList(null),
            })}

          {opts.scopes.map((s) => {
            const key = scopeKey(s.kind, s.id);
            if (renaming?.id === s.id && opts.manage) {
              return (
                <div key={s.id}>
                  {inlineInput({
                    value: renaming.name, onChange: (v) => setRenaming({ id: s.id, name: v }), placeholder: s.name, label: `Rename ${s.name}`,
                    onCommit: () => { const n = renaming.name.trim(); if (n && n !== s.name) onRenameList?.(s.id, n); setRenaming(null); },
                    onCancel: () => setRenaming(null),
                  })}
                </div>
              );
            }
            return (
              <ScopeRow
                key={s.id} scope={s} on={active.scope === key} shown={!hidden.has(key)}
                count={scopeCounts[key] ?? 0}
                onPick={() => pickScope(key)} onToggleShown={() => onToggleScope(key)}
                actions={opts.manage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton size="xs" variant="ghost" label={`${s.name} actions`}
                        className="reveal-on-hover data-[state=open]:opacity-100"
                        icon={<Icon icon={DotsThree} size={14} />} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem icon={<Icon icon={Pencil} size={16} />} onSelect={() => setRenaming({ id: s.id, name: s.name })}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Colour</DropdownMenuLabel>
                      <div className="flex gap-1.5 px-2 pb-1.5 pt-0.5">
                        {SCOPE_COLORS.map((c) => (
                          <button key={c} type="button" onClick={() => onRecolourList?.(s.id, c)}
                            aria-label={`Colour ${s.name}`} aria-pressed={s.color === c}
                            className={cn('focus-ring size-4 rounded-full border transition-transform duration-fast ease-out-quiet',
                              s.color === c ? 'border-ink-900 scale-110' : 'border-transparent')}
                            /* The token, never the stored value. */
                            style={{ background: scopeFill(c) }} />
                        ))}
                      </div>
                      <DropdownMenuSeparator />
                      {/* Honest copy: 0038's FK is ON DELETE SET NULL, so the
                          work survives and reappears under "No list". */}
                      <DropdownMenuItem danger icon={<Icon icon={Trash} size={16} />} onSelect={() => onDeleteList?.(s.id)}>
                        Delete list
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : undefined}
              />
            );
          })}

          {opts.scopes.length === 0 && (
            <div className="px-2 pb-1 pt-0.5 text-caption text-ink-500">
              {opts.key === 'lists' ? 'Make a list to sort your own work.' : 'Projects you create show up here.'}
            </div>
          )}
        </>
      )}
    </>
  );

  // Horizontal strip: one row of pills, nothing to pin against, so Completed is
  // simply the last one. The visibility checkboxes are a desktop idea — a strip
  // you scroll sideways has no room for a second control per pill — but the
  // piles themselves are still reachable, which they were not before.
  if (narrow) {
    return (
      <aside className="flex gap-1 overflow-x-auto border-b border-line-soft px-2 py-2.5">
        {viewRows}
        {[...projects, ...lists].map((s) => {
          const key = scopeKey(s.kind, s.id);
          return (
            <button key={key} onClick={() => pickScope(key)} aria-current={active.scope === key ? 'true' : undefined}
              className={cn(railBtn(active.scope === key), 'shrink-0')}>
              <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: s.color ?? 'var(--color-ink-500)' }} />
              {s.name}
            </button>
          );
        })}
        <RailView def={DONE_VIEW} on={active.view === 'completed' && !active.scope} count={counts.completed} narrow onClick={() => pickView('completed')} />
      </aside>
    );
  }

  // No chrome of its own. The landmark, the `--rail-w` width, the border and the
  // scrolling all come from <HubLayout>, which is where every other rail in the
  // app gets them — this file used to restate them, with a comment naming the
  // Documents rail as the thing its 230px "matched". Naming a sibling instead of
  // a token is how that pair held while Clients and Projects drifted to 240.
  return (
    <>
      <div className="flex flex-col gap-1 px-2 pb-1 pt-3">
        {viewRows}

        {savedViewsSupported && (
          <>
            {/* -mx-2 cancels the wrapper's 8px so the rule spans the rail — the
                same trick NavDivider uses against the sidebar's own padding. */}
            <div aria-hidden className="-mx-2 mb-1 mt-2 h-px bg-line-soft" />
            <SectionHead label="Views" open={openSections.views} onToggle={() => toggleSection('views')}
              addLabel={saveSnapshot && !savingView ? 'Save this view' : undefined}
              onAdd={saveSnapshot && !savingView ? () => setSavingView(true) : undefined} />
            {openSections.views && (
              <>
                {savingView && inlineInput({
                  value: viewName, onChange: setViewName, placeholder: 'View name…', label: 'Saved view name',
                  onCommit: saveView, onCancel: () => { setViewName(''); setSavingView(false); },
                })}
                {views.map((v) => (
                  <button key={v.id} onClick={() => go(v.filter || {})} className={cn(railBtn(viewMatches(v)), 'group shrink-0')}>
                    <Icon icon={FunnelSimple} size={14} className="shrink-0 text-ink-500" />
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{v.name}</span>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeView(v.id); }} aria-label={`Delete ${v.name}`}
                      className="reveal-on-hover focus-ring grid size-[18px] place-items-center rounded-xs text-ink-500 hover:text-ink-800">
                      <Icon icon={Trash} size={12} />
                    </span>
                  </button>
                ))}
                {views.length === 0 && !savingView && (
                  <div className="px-2 pb-1 pt-0.5 text-caption text-ink-500">
                    {saveSnapshot ? 'Save the current filter with +' : 'Filter tasks, then save the view.'}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Projects — client work, owned by the Projects module. The rail can
            filter by one and switch it off; creating and deleting belongs where
            the budget, the client and the portal are, so + navigates there. */}
        {scopeSection({
          key: 'projects', label: 'Projects', scopes: projects,
          addLabel: 'New project', onAdd: () => router.push('/projects'), manage: false,
        })}

        {/* Lists — Tasks' own piles. Gated on 0038: until it is applied the
            section is simply absent and the module behaves as it did before. */}
        {listsSupported && scopeSection({
          key: 'lists', label: 'Lists', scopes: lists,
          addLabel: 'New list', onAdd: () => setNewList(''), manage: true,
        })}
      </div>

      {/* The foot — structurally identical to the Documents rail's Trash: a p-2
          box with a real border-top, pinned by `mt-auto`. `flex flex-col`
          because the rows above are stretched by the aside's column flex, and a
          plain block would let this one shrink to its own text. */}
      <div className="mt-auto flex shrink-0 flex-col border-t border-line p-2">
        <RailView def={DONE_VIEW} on={active.view === 'completed' && !active.scope} count={counts.completed} narrow={false} onClick={() => pickView('completed')} />
      </div>
    </>
  );
}

/** Re-exported so hosts can draw a pile's glyph without importing the palette. */
export function ScopeDot({ scope, size = 10 }: { scope: Scope | null; size?: number }) {
  return (
    <span aria-hidden className="inline-block shrink-0 rounded-[2px]"
      style={{ width: size, height: size, background: scope?.color ?? 'var(--color-ink-400)' }} />
  );
}
