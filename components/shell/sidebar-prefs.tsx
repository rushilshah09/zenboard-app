'use client';
// ONE SOURCE OF TRUTH FOR HOW THE SIDEBAR IS SET UP.
//
// Three surfaces change the same two settings — the rail itself, the "Sidebar
// control" popover at its foot, and Settings → Sidebar — and a fourth reads
// them (the rail's rows). If each held its own copy, ticking Finance off in
// Settings would leave it in the rail until a reload, which is exactly the
// "two parts of the app disagree" failure CONSISTENCY_PRINCIPLE.md exists to
// prevent. So the state lives here, the shell provides it once, and every
// surface is a view of it.
//
// It owns MODULE VISIBILITY outright (optimistic write to `profiles.preferences`,
// revert on failure, Undo for bulk changes). The sidebar MODE (expanded /
// collapsed / on hover) it only passes through: that already has a careful owner
// in AppShell — a cookie so the server can paint it, sessionStorage for a
// per-tab override, localStorage for older installs — and moving it would mean
// re-proving all three.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useChanged } from '@/lib/use-changed';
import { updatePreferences } from '@/lib/actions/profile';
import { toast, toastReverted } from '@/components/ds/ui';
import {
  NAV_MODULES, PRESETS, toggleModule, presetModules, type PresetId,
} from '@/lib/nav-modules';
import type { SidebarMode } from '@/lib/sidebar-mode';

export type SidebarPrefs = {
  /** Enabled module ids, or null for an account that never configured them —
   *  which renders ALL modules (lib/nav-modules.ts explains why null ≠ none). */
  modules: string[] | null;
  /** Is this module in the rail right now? Handles the null case. */
  isOn: (id: string) => boolean;
  toggle: (id: string, on: boolean) => void;
  /** Replace the whole set with a preset. Offers Undo instead of asking first. */
  applyPreset: (id: PresetId) => void;
  mode: SidebarMode;
  setMode: (m: SidebarMode) => void;
};

const Ctx = createContext<SidebarPrefs | null>(null);

const ALL_IDS = NAV_MODULES.map((m) => m.id) as string[];
const same = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

export function SidebarPrefsProvider({ initialModules, mode, onModeChange, children }: {
  initialModules: string[] | null;
  mode: SidebarMode;
  onModeChange: (m: SidebarMode) => void;
  children: React.ReactNode;
}) {
  const [modules, setModules] = useState<string[] | null>(initialModules);

  // Reconcile with the server DURING RENDER, not in an effect
  // (lib/use-server-state). Compared by VALUE: the layout builds a fresh array
  // every render, so `useChanged` on the array would fire every time and stamp
  // on an optimistic toggle a frame after the person made it.
  const serverKey = initialModules === null ? '\u0000unset' : initialModules.join(',');
  if (useChanged(serverKey)) setModules(initialModules);

  /**
   * Persist a new set, optimistically.
   *
   * The write is NOT inside a setState updater. It was, once, and React calls
   * updaters twice under StrictMode because they must be pure — every tick sent
   * two requests. The harness caught it: "Your change was undone. x2".
   *
   * On failure the revert is CONDITIONAL: it only puts `prev` back if the rail
   * still shows what this write set. Two quick ticks where the first fails must
   * not wipe out the second, which succeeded.
   */
  const commit = useCallback((prev: string[] | null, next: string[]) => {
    setModules(next);
    void updatePreferences({ navModules: next }).then((r) => {
      if (r && 'error' in r) {
        setModules((cur) => (same(cur, next) ? prev : cur));
        toastReverted(r.error);
      }
    });
  }, []);

  const toggle = useCallback((id: string, on: boolean) => {
    // Seed from what is RENDERED. An unconfigured account shows all twelve, so
    // its first un-tick must persist "all twelve minus this one" — seeding from
    // null and adding one id would hide ten things the person never touched.
    const base = modules ?? ALL_IDS;
    commit(modules, toggleModule(base, id, on));
  }, [modules, commit]);

  const applyPreset = useCallback((id: PresetId) => {
    const prev = modules;
    const next = presetModules(id);
    if (same(prev ?? ALL_IDS, next)) return;
    commit(prev, next);
    // UNDO, NOT A CONFIRM DIALOG. Applying a set can hide several modules at
    // once, which sounds like it wants an "Are you sure?" — but nothing is lost
    // (hiding is nav-only; every record stays where it was) and a dialog in
    // front of a reversible action is friction spent on nothing. Say what
    // happened, and put the way back one click away.
    const label = PRESETS.find((p) => p.id === id)?.label ?? 'that';
    toast({
      message: `Sidebar set to ${label}.`,
      action: { label: 'Undo', onAction: () => commit(next, prev ?? [...ALL_IDS]) },
    });
  }, [modules, commit]);

  const value = useMemo<SidebarPrefs>(() => ({
    modules,
    isOn: (id: string) => (modules ? modules.includes(id) : true),
    toggle,
    applyPreset,
    mode,
    setMode: onModeChange,
  }), [modules, toggle, applyPreset, mode, onModeChange]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shell's sidebar settings. Null outside the shell (a harness that renders
 *  a pane on its own), so a caller decides what "no shell" means for it. */
export function useSidebarPrefs(): SidebarPrefs | null {
  return useContext(Ctx);
}
