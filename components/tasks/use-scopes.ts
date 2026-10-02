'use client';
// The scope state both Tasks layouts share: which piles exist, which are
// switched off, and the optimistic list CRUD the rail's menu drives.
//
// It is a hook rather than props because the list layout and the board are two
// routes rendering the same rail. If each owned its own copy of "which lists
// are hidden", switching layout would silently un-hide them — the exact class
// of bug that made the rail its own component in the first place.
//
// Visibility is persisted to `profiles.preferences`, not localStorage:
//   · it follows you between machines, the way Google Tasks' checkboxes do;
//   · the route reads it server-side, so the FIRST PAINT is already correct
//     rather than flashing every task and then hiding some;
//   · reading localStorage during render is the precise shape of hydration
//     mismatch this codebase has been bitten by before.
import { useCallback, useMemo } from 'react';
import { updatePreferences } from '@/lib/actions/profile';
import { createTaskList, renameTaskList, setTaskListColor, deleteTaskList } from '@/lib/actions/task-lists';
import { HIDDEN_SCOPES_KEY, scopeKey, type Scope } from '@/lib/task-scopes';
import { useServerState } from '@/lib/use-server-state';
import { tempId } from '@/lib/temp-id';

export type ScopeState = {
  /** Every project, in rail order. */
  projects: Scope[];
  /** Every list, in rail order. Empty when 0038 hasn't been applied. */
  lists: Scope[];
  /** Both, in the order the rail draws them — projects first. Board columns. */
  all: Scope[];
  /** Only the piles that are switched ON, for the board's columns. */
  visible: Scope[];
  hidden: ReadonlySet<string>;
  toggle: (key: string) => void;
  createList: (name: string) => void;
  renameList: (id: string, name: string) => void;
  recolourList: (id: string, color: string) => void;
  deleteList: (id: string) => void;
};

export function useScopes({ projects, initialLists, initialHidden }: {
  projects: Scope[];
  initialLists: Scope[];
  initialHidden: string[];
}): ScopeState {
  const [lists, setLists] = useServerState(initialLists);
  const [hidden, setHidden] = useServerState(initialHidden);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const toggle = useCallback((key: string) => {
    // Optimistic and immediate: a visibility switch that waits on a round trip
    // reads as a broken checkbox. The write is fire-and-forget because the
    // worst failure is a preference that didn't stick, and re-ticking fixes it
    // — rolling back under the user's finger would be worse than the miss.
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      void updatePreferences({ [HIDDEN_SCOPES_KEY]: next });
      return next;
    });
  }, [setHidden]);

  const createList = useCallback((name: string) => {
    const tmp = tempId();
    setLists((ls) => [...ls, { kind: 'list', id: tmp, name, color: null }]);
    void createTaskList(name).then((res) => {
      if ('error' in res) setLists((ls) => ls.filter((l) => l.id !== tmp));
      else setLists((ls) => ls.map((l) => (l.id === tmp ? { ...l, id: res.id } : l)));
    });
  }, [setLists]);

  const renameList = useCallback((id: string, name: string) => {
    let prev = '';
    setLists((ls) => ls.map((l) => (l.id === id ? ((prev = l.name), { ...l, name }) : l)));
    void renameTaskList(id, name).then((res) => {
      if ('error' in res) setLists((ls) => ls.map((l) => (l.id === id ? { ...l, name: prev } : l)));
    });
  }, [setLists]);

  const recolourList = useCallback((id: string, color: string) => {
    let prev: string | null = null;
    setLists((ls) => ls.map((l) => (l.id === id ? ((prev = l.color), { ...l, color }) : l)));
    void setTaskListColor(id, color).then((res) => {
      if ('error' in res) setLists((ls) => ls.map((l) => (l.id === id ? { ...l, color: prev } : l)));
    });
  }, [setLists]);

  const deleteList = useCallback((id: string) => {
    // The tasks inside survive (0038's FK is ON DELETE SET NULL) and reappear
    // under "No list", so there is nothing here to restore but the row itself.
    let prev: Scope | undefined;
    setLists((ls) => { prev = ls.find((l) => l.id === id); return ls.filter((l) => l.id !== id); });
    void deleteTaskList(id).then((res) => {
      if ('error' in res && prev) setLists((ls) => [...ls, prev!]);
    });
  }, [setLists]);

  const all = useMemo(() => [...projects, ...lists], [projects, lists]);
  const visible = useMemo(() => all.filter((s) => !hiddenSet.has(scopeKey(s.kind, s.id))), [all, hiddenSet]);

  return { projects, lists, all, visible, hidden: hiddenSet, toggle, createList, renameList, recolourList, deleteList };
}
