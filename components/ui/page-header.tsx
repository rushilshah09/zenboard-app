'use client';
// The one page header — used at the top of every screen. An accent icon · the
// display-500 title · an optional count · right-aligned actions, with an
// optional subtitle aligned under the title. This replaces a dozen hand-copied
// <h1> blocks that had drifted between 24/26/28px and mismatched icon/count
// treatments. Matches the HiFi-built Inbox header, which is the reference.
import { type IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";

// The canonical page title. Standalone use is rare — prefer <PageHeader> — but
// exported for screens with a bespoke header row (e.g. a back button beside it).
export function PageTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'var(--text-h1-size)', margin: 0, letterSpacing: '-0.015em', lineHeight: 1.15, color: 'var(--ink)', ...style }}>
      {children}
    </h1>
  );
}

export function PageHeader({ icon, title, count, actions, subtitle, style, hideTitle }: {
  icon?: IconType;
  title: string;
  count?: number;
  actions?: React.ReactNode;
  subtitle?: React.ReactNode;
  style?: React.CSSProperties;
  /** For routes the top bar already names (Goals, Habits, Finance, Inbox…):
      drop the duplicated in-page title and render only the actions row, so
      every page shows exactly one clear title (the approved Home/Calendar/
      Documents layout standard). */
  hideTitle?: boolean;
}) {
  if (hideTitle) {
    if (!actions) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 32, ...style }}>
        {actions}
      </div>
    );
  }
  const indent = icon ? 32 : 0; // 22px icon + 10px gap → subtitle aligns to title
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <Icon icon={icon} size={24} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />}
        <PageTitle>{title}</PageTitle>
        {count != null && count > 0 && (
          <span className="num" style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{count}</span>
        )}
        {actions && (
          <>
            <span style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</span>
          </>
        )}
      </div>
      {subtitle && (
        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)', margin: `4px 0 0 ${indent}px`, lineHeight: 1.5 }}>{subtitle}</p>
      )}
    </div>
  );
}
