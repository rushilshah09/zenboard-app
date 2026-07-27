'use client';
// The canonical dashboard/section panel from the HiFi reference: a grey r-xl
// wrap with a hairline ring, a 44px header row (icon · display-500 title ·
// count · right slot), and a white r-lg card body with a crisp lip. This is
// the ONE section-card language — previously implemented separately (and
// drifting) in today-view's highlight, schedule-section, and habits-section.
import { type IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";

export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--paper-3)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

export function PanelHeader({ icon, title, count, right }: {
  icon?: IconType; title: string; count?: number; right?: React.ReactNode;
}) {
  // Home/Documents redesign: panel titles are quiet — 16/500 muted, icon muted.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 8px 0 16px' }}>
      {icon && <Icon icon={icon} size={16} style={{ color: 'var(--text-muted)' }} />}
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>{title}</span>
      {count != null && count > 0 && <span className="num" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-faint)' }}>{count}</span>}
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// White body card inside the panel. `flush` drops the default 12px padding
// for full-bleed content (e.g. row lists that manage their own padding).
export function PanelCard({ children, flush, style }: { children: React.ReactNode; flush?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--paper-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-crisp)', padding: flush ? 0 : 12, overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

// The small ghost action that lives in a panel header ("+ Add", "Cancel"…).
// Redesign spec: plain ghost, 14/400 ink, 16px icon.
export function PanelAction({ icon, children, onClick, title }: {
  icon?: IconType; children?: React.ReactNode; onClick?: () => void; title?: string;
}) {
  return (
    <button onClick={onClick} title={title} className="zb-press"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 'var(--text-body-size)', fontWeight: 400, cursor: 'pointer' }}>
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </button>
  );
}
