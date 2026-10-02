'use client';
// The peek a page is open in — so a page opened from INSIDE it (a Page block, a
// card of a database on that page) steps deeper into the same peek instead of
// opening a second one on top. Its own module so the editor and every database
// can reach it without importing the peek.
import { createContext, useContext } from 'react';

export type PeekEntry =
  /** A database row — a page with properties. `fresh`: just made, its name takes the caret. */
  | { kind: 'row'; colId: string; rowId: string; fresh?: boolean }
  /** A page inside a page. */
  | { kind: 'page'; pageId: string };

export type PeekApi = {
  /** Step into a page, one level deeper than the one showing. */
  open: (entry: PeekEntry) => void;
};

export const PeekContext = createContext<PeekApi | null>(null);

/** The peek this component is inside, or null on a page of its own. */
export const usePeek = () => useContext(PeekContext);
