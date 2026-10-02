'use client';
// How a database's view tab is drawn — text and icon, text only, or icon only
// (Notion's "Display as", which says "Only applies to you"). A preference of the
// person, not a setting of the database: it is kept on this device, per view, and
// never written to the view that everyone else sees.
import { useSyncExternalStore } from 'react';

export type TabDisplay = 'icon-text' | 'text' | 'icon';
export const TAB_DISPLAYS: readonly TabDisplay[] = ['icon-text', 'text', 'icon'];
export const TAB_DISPLAY_LABEL: Record<TabDisplay, string> = { 'icon-text': 'Text and icon', text: 'Text only', icon: 'Icon only' };

const KEY = 'zb-view-tab-display';
const EVENT = 'zb:view-tab-display';
type Stored = Record<string, TabDisplay>;
const EMPTY: Stored = {};

/** The stored map, with anything this build does not recognise left out. */
export function parseTabDisplays(raw: string | null): Stored {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY;
    const out: Stored = {};
    for (const [id, d] of Object.entries(parsed)) {
      if (typeof d === 'string' && (TAB_DISPLAYS as readonly string[]).includes(d)) out[id] = d as TabDisplay;
    }
    return out;
  } catch {
    return EMPTY;
  }
}

// Parsed once, held until something writes: the snapshot is read on every render of
// every tab, and must be the same object each time or React renders forever.
let cache: Stored | null = null;
function read(): Stored {
  if (typeof window === 'undefined') return EMPTY;
  if (cache) return cache;
  try { cache = parseTabDisplays(window.localStorage.getItem(KEY)); } catch { cache = EMPTY; }
  return cache;
}

function subscribe(onChange: () => void): () => void {
  const cross = () => { cache = null; onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', cross);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', cross); };
}

/** Every view's tab display on this device, keyed by view id. Absent ⇒ text and icon. */
export function useTabDisplays(): Stored {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function setTabDisplay(viewId: string, display: TabDisplay) {
  const next = { ...read() };
  if (display === 'icon-text') delete next[viewId]; else next[viewId] = display;
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* a preference is never worth an error */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}
