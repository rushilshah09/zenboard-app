// Calm placeholder for views not yet built out. Keeps navigation whole while we
// implement each surface phase by phase.
import { type IconType } from "@/components/ds/icons";
import { ViewContainer } from '@/components/ui/view-container';
import { Icon } from "@/components/ds/ui";
import { PageTitle } from '@/components/ui/page-header';

export function ViewPlaceholder({
  icon, title, subtitle, note,
}: { icon: IconType; title: string; subtitle: string; note: string }) {
  return (
    // The app's reading column, not a seventh hand-rolled width. A placeholder
    // that sits at its own inset teaches the wrong shape for the page that will
    // replace it.
    <ViewContainer className="page-rhythm">
      <div style={{ marginBottom: 28 }}>
        <PageTitle>{title}</PageTitle>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-small-size)', color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '56px 24px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)' }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--r-xl)', background: 'var(--paper-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={20} />
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 500, color: 'var(--ink-2)' }}>{note}</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Coming in an upcoming build pass.</div>
      </div>
    </ViewContainer>
  );
}
