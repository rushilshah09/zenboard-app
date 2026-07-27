'use client';
// Notion-style page width preference. A "•••" page menu toggles "Full width";
// hub pages read useViewWidth() to drop their centered max-width cap. Persisted
// to localStorage (per browser) so it sticks across navigation + reloads.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Ellipsis, MoveHorizontal } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { SwitchTrack } from '@/components/ui/primitives';

const KEY = 'zb:fullWidth';
const Ctx = createContext<{ full: boolean; toggle: () => void }>({ full: false, toggle: () => {} });
export const useViewWidth = () => useContext(Ctx);

export function ViewWidthProvider({ children }: { children: React.ReactNode }) {
  const [full, setFull] = useState(false);
  // read after mount (avoids SSR/hydration mismatch)
  useEffect(() => { try { setFull(localStorage.getItem(KEY) === '1'); } catch { /* ignore */ } }, []);
  const toggle = () => setFull((f) => { const n = !f; try { localStorage.setItem(KEY, n ? '1' : '0'); } catch { /* ignore */ } return n; });
  return <Ctx.Provider value={{ full, toggle }}>{children}</Ctx.Provider>;
}

// The "•••" menu button + popover (lives in the top bar).
export function PageOptionsMenu() {
  const { full, toggle } = useViewWidth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Page options" title="Page options"
        style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: open ? 'var(--hover)' : 'transparent', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
        <Icon icon={Ellipsis} size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 80, width: 230, background: 'var(--paper-2)', border: '1px solid var(--line-pop)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', padding: 8, animation: 'zb-pop-in var(--dur-base) var(--ease-out)' }}>
          <button onClick={toggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <Icon icon={MoveHorizontal} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--ink-2)' }}>Full width</span>
            <SwitchTrack on={full} />
          </button>
        </div>
      )}
    </div>
  );
}
