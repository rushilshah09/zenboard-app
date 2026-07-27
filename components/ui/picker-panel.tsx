'use client';
// PickerPanel + PickerTabs — the design-system popover shell shared by the
// icon picker and the cover picker (measured from the "emoji upload" /
// "change cover" HiFi frames):
//   panel · paper-3 · radius 16 (r-xl) · hairline ring + shadow-lg
//   tabs  · 40px row, pill tabs (4px 8px, r-md, 14/400) — active = hover wash
//           + ink-2, resting ink-4; quiet right-slot action (e.g. Remove)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function PickerPanel({ label, width, align = 'left', onClose, children }: {
  label: string; width: number; align?: 'left' | 'right'; onClose: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true); };
  }, [onClose]);
  // Keep the panel on-screen: anchored popovers near a viewport edge slide
  // back inside (16px gutter) instead of clipping.
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 16;
    let s = 0;
    if (r.right > window.innerWidth - pad) s = window.innerWidth - pad - r.right;
    if (r.left + s < pad) s = pad - r.left;
    if (s) setShift(s);
  }, []);
  return (
    <div ref={ref} role="dialog" aria-label={label}
      style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 60, width: `min(${width}px, calc(100vw - 32px))`, ...(shift ? (align === 'left' ? { marginLeft: shift } : { marginRight: -shift }) : {}), background: 'var(--paper-3)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-panel)', animation: 'fadein 140ms' }}>
      {children}
    </div>
  );
}

export function PickerTabs<T extends string>({ tabs, active, onTab, right }: {
  tabs: { id: T; label: string }[]; active: T; onTab: (t: T) => void; right?: React.ReactNode;
}) {
  return (
    <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 40, padding: '0 8px', flexShrink: 0 }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onTab(t.id)} className={on ? undefined : 'zb-press'}
            style={{ padding: '4px 8px', borderRadius: 'var(--r-md)', border: 'none', background: on ? 'var(--hover)' : 'transparent', color: on ? 'var(--ink-2)' : 'var(--text-secondary)', fontSize: 'var(--text-body-size)', fontWeight: 400, lineHeight: '20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// The quiet right-slot action for the tab row ("Remove", per the HiFi: ink-4,
// 14/400, 4px 10px — not red; removal here is a calm, reversible act).
export function PickerQuietAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="zb-press"
      style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)', lineHeight: '20px', cursor: 'pointer' }}>
      {label}
    </button>
  );
}
