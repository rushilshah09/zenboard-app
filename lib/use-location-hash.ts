'use client';
// The page's `#fragment`, as a value a component renders from — a link to one view
// of a database (`#view-<id>`, lib/view-list.ts) is read here. An external store,
// so no effect copies it into state; the server has no fragment, and says ''.
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}
