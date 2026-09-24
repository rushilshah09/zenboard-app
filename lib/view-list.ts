// A database's views as its view bar holds them (the user, 2026-09-15, with Notion
// screenshots): up to three named tabs, the one you are on always among them, and
// the rest folded under "N more…" — a list to search, re-order by hand and open any
// view's menu from. Pure, so the rules are tested without a screen; the bar itself
// is components/documents/database-views-bar.tsx.
import { genId, type ViewDef } from '@/lib/collections';

/** Views shown as tabs before the rest fold into "N more…". */
export const MAX_TABS = 3;

/**
 * The views drawn as tabs, and how many wait under "N more…". The first `max` views,
 * except that the view you are on is never folded away: when it is one of the rest,
 * it takes the last tab's place — a bar that hid where you are would be lying.
 */
export function visibleTabs(views: ViewDef[], currentId: string | undefined, max = MAX_TABS): { tabs: ViewDef[]; more: number } {
  if (views.length <= max) return { tabs: views, more: 0 };
  const at = views.findIndex((v) => v.id === currentId);
  const head = views.slice(0, max);
  return { tabs: at >= max ? [...head.slice(0, max - 1), views[at]] : head, more: views.length - max };
}

/** The views whose names hold `query` — "Search for a view…". */
export function matchViews(views: ViewDef[], query: string): ViewDef[] {
  const q = query.trim().toLowerCase();
  return q ? views.filter((v) => v.name.toLowerCase().includes(q)) : views;
}

/**
 * A copy of a view, right after it: the same layout, filters, sorts, groups and
 * columns under an id of its own. It is called "<name> copy" — Notion keeps the
 * name, and four tabs all reading "Board" is exactly how you lose track of which is
 * which (a deliberate difference).
 */
export function duplicateView(views: ViewDef[], id: string, newId: string = genId()): { views: ViewDef[]; copy: ViewDef } | null {
  const at = views.findIndex((v) => v.id === id);
  if (at < 0) return null;
  const source = views[at];
  const copy: ViewDef = { ...structuredClone(source), id: newId, name: `${source.name.trim() || 'Untitled'} copy` };
  return { views: [...views.slice(0, at + 1), copy, ...views.slice(at + 1)], copy };
}

/**
 * A view taken out, and the one to show in its place: the view before it, or the
 * next one when it was first. A database always keeps one view, so the last cannot go.
 */
export function removeView(views: ViewDef[], id: string): { views: ViewDef[]; nextId: string } | null {
  if (views.length <= 1) return null;
  const at = views.findIndex((v) => v.id === id);
  if (at < 0) return null;
  const rest = views.filter((v) => v.id !== id);
  return { views: rest, nextId: rest[Math.max(0, at - 1)].id };
}

/**
 * The views in the order `ids` gives — a drag in the "more" list. A view the list
 * did not name (one added meanwhile) keeps its place at the end rather than vanishing.
 */
export function orderViews(views: ViewDef[], ids: string[]): ViewDef[] {
  const byId = new Map(views.map((v) => [v.id, v]));
  const named = ids.map((id) => byId.get(id)).filter((v): v is ViewDef => !!v);
  return [...named, ...views.filter((v) => !ids.includes(v.id))];
}

/** The view a link names — `#view-<id>`, as "Copy link to view" writes it — if it is one of these. */
export function viewFromHash(hash: string, views: ViewDef[]): string | undefined {
  if (!hash.startsWith('#view-')) return undefined;
  const id = decodeURIComponent(hash.slice('#view-'.length));
  return views.some((v) => v.id === id) ? id : undefined;
}

/** The link "Copy link to view" puts on the clipboard. */
export function viewLink(href: string, viewId: string): string {
  const base = href.split('#')[0];
  return `${base}#view-${encodeURIComponent(viewId)}`;
}
