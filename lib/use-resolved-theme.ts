'use client';
// The theme the reader is LOOKING at — 'light' | 'dark' — as the boot script and
// `applyAppearance` stamped it on <html>. Not the stored CHOICE: under 'system' the
// two differ, and a surface that has to match the page (the sidebar's appearance
// glyph, a third-party widget such as the Turnstile captcha) needs the answer, not
// the question. The one reader; do not re-read `data-theme` inline.
import { useSyncExternalStore } from 'react';
import { APPEARANCE_EVENT } from './theme';

type Resolved = 'light' | 'dark';

// APPEARANCE_EVENT fires for a user's commit AND for an OS flip while 'system' is in
// effect (`watchSystemTheme`) — both stamp <html> before they dispatch, so a read in
// the listener sees the new value.
const subscribe = (onChange: () => void) => {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
};

const read = (): Resolved =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

// The server cannot know it — the choice lives in localStorage and the OS — so it
// answers 'light', and React re-reads on the client once hydrated.
const readOnServer = (): Resolved => 'light';

export function useResolvedTheme(): Resolved {
  return useSyncExternalStore(subscribe, read, readOnServer);
}
