// Calm placeholder for views not yet built out. Keeps navigation whole while we
// implement each surface phase by phase.
import { type IconType } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { PageHeader } from '@/components/ui/page-header';

export function ViewPlaceholder({
  icon, title, subtitle, note,
}: { icon: IconType; title: string; subtitle: string; note: string }) {
  return (
    <div style={{ padding: 'var(--view-pt) var(--view-px) var(--view-pb)', maxWidth: 760, margin: '0 auto' }}>
      <PageHeader icon={icon} title={title} subtitle={subtitle} style={{ marginBottom: 28 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '56px 24px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)' }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--r-xl)', background: 'var(--paper-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={20} />
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 500, color: 'var(--ink-2)' }}>{note}</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Coming in an upcoming build pass.</div>
      </div>
    </div>
  );
}
