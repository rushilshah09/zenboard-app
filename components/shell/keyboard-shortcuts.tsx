'use client';
// Global keyboard shortcuts. A Gmail-style "g then <key>" go-to system plus a
// couple of single-key actions. Ignores keystrokes while typing in fields and
// never swallows modifier combos (⌘K etc. stay with their own handlers). This is
// the single source of truth for what the command palette + Settings advertise.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// "g" then this key → route.
export const GOTO: Record<string, { href: string; label: string }> = {
  t: { href: '/today', label: 'Home' },
  i: { href: '/inbox', label: 'Inbox' },
  w: { href: '/tasks?view=week', label: 'Week' },
  h: { href: '/horizon', label: 'Goals' },
  b: { href: '/habits', label: 'Habits' },
  k: { href: '/tasks', label: 'Tasks' },
  p: { href: '/projects', label: 'Projects' },
  c: { href: '/clients', label: 'Clients' },
  m: { href: '/money', label: 'Finance' },
  d: { href: '/documents', label: 'Docs' },
};

// Reference list rendered in Settings → Keyboard. Kept here so it can't drift
// from what's actually wired below.
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['?'], label: 'Open command palette' },
      { keys: ['C'], label: 'Quick capture to Inbox' },
      { keys: ['⇧', 'T'], label: 'Triage inbox' },
      { keys: ['F'], label: 'Enter focus mode' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['G', 'T'], label: 'Home' },
      { keys: ['G', 'K'], label: 'Tasks' },
      { keys: ['G', 'W'], label: 'Week' },
      { keys: ['G', 'H'], label: 'Goals' },
      { keys: ['G', 'B'], label: 'Habits' },
      { keys: ['G', 'P'], label: 'Projects' },
      { keys: ['G', 'C'], label: 'Clients' },
      { keys: ['G', 'D'], label: 'Documents' },
      { keys: ['G', 'M'], label: 'Finance' },
      { keys: ['G', 'I'], label: 'Inbox' },
    ],
  },
  {
    title: 'In a task list',
    items: [
      { keys: ['J'], label: 'Focus next task' },
      { keys: ['K'], label: 'Focus previous task' },
      { keys: ['↵'], label: 'Open focused task' },
      { keys: ['E'], label: 'Complete' },
      { keys: ['T'], label: 'Schedule for today' },
      { keys: ['S'], label: 'Schedule…' },
      { keys: ['P'], label: 'Move to project' },
      { keys: ['L'], label: 'Add label' },
      { keys: ['1'], label: 'Priority low' },
      { keys: ['2'], label: 'Priority medium' },
      { keys: ['3'], label: 'Priority high' },
    ],
  },
  {
    title: 'In the command palette',
    items: [
      { keys: ['↑', '↓'], label: 'Move selection' },
      { keys: ['↵'], label: 'Open selected' },
      { keys: ['Esc'], label: 'Close' },
    ],
  },
];

// Shared with per-list keyboard grammar (e.g. Tasks): true for a short window
// after "g" is pressed, so a "g <key>" navigation chord suppresses single-key
// row actions bound to the same letter (g t, g p, g k …). Time-expiring so a
// stray "g" only mutes the grammar briefly.
let _lastG = 0;
export function goChordActive(): boolean {
  return Date.now() - _lastG < 1200;
}

function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable;
}

export function GlobalShortcuts() {
  const router = useRouter();
  const pendingG = useRef(0); // timestamp of a recent "g" press

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave ⌘K and friends alone
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      // second key of a "g _" sequence (within 1.2s)
      if (pendingG.current && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const dest = GOTO[key];
        if (dest) { e.preventDefault(); router.push(dest.href); return; }
      }

      if (key === 'g') { pendingG.current = Date.now(); _lastG = Date.now(); return; }
      if (key === 'c') { e.preventDefault(); window.dispatchEvent(new Event('zb:capture')); return; }
      if (key === 'f') { e.preventDefault(); router.push('/focus'); return; }
      if (e.key === '?') { e.preventDefault(); window.dispatchEvent(new Event('zb:open-command')); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
