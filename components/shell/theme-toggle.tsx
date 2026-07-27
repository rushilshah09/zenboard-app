'use client';
// One-tap light/dark flip for the sidebar user menu. Reads the resolved theme
// off <html> after mount (avoids SSR mismatch) and re-syncs whenever any surface
// changes the appearance, so its label always matches the live theme.
import { useEffect, useState } from 'react';
import { Sun, Moon, ChevronRight } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { APPEARANCE_EVENT, commitAppearance } from '@/lib/theme';

export function ThemeToggleItem() {
  const [dark, setDark] = useState<boolean | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    sync();
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  // commitAppearance broadcasts; our own listener flips `dark` from the DOM.
  const toggle = () => commitAppearance({ theme: dark ? 'light' : 'dark' });

  // Before mount we don't know the theme; show a neutral, stable label.
  const toDark = dark !== true;
  const label = dark === null ? 'Toggle theme' : toDark ? 'Dark mode' : 'Light mode';

  return (
    <button onClick={toggle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', background: hover ? 'var(--paper-3)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--ink-2)', transition: 'background 120ms' }}>
      <Icon icon={toDark ? Moon : Sun} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 'var(--text-caption-size)', fontWeight: 500 }}>{label}</span>
      <Icon icon={ChevronRight} size={12} style={{ color: 'var(--text-secondary)', opacity: hover ? 1 : 0.4 }} />
    </button>
  );
}
