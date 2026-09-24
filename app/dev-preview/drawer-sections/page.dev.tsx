'use client';
// Dev-only harness for the task drawer's SECTION STACK. 404s in prod.
//
// The drawer itself (`TaskDetailDrawer`) takes no props — it reads the task id
// from the URL and everything else through the browser Supabase client — so it
// cannot be staged without threading a demo flag through every network path in
// a 600-line file. What CAN be staged, and what actually breaks when a section
// is added, is the stack's geometry: every section's label and content must
// share one left edge, or the drawer reads as several panels bolted together.
//
// So this renders the sections at the drawer's own width with the drawer's own
// wrappers. `AttachmentsPanel` here is the real component with no session, which
// is exactly the empty state a task without files shows.
import { notFound } from 'next/navigation';
import { Icon, EmptyLine } from '@/components/ds/ui';
import { Plus, Paperclip, MessageCircle } from '@/components/ds/icons';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';

const label: React.CSSProperties = {
  fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--ink-2)',
};

export default function DrawerSectionsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper)', padding: 32 }}>
      {/* The drawer's real width, so the columns wrap the way they will in situ. */}
      <div data-h="drawer" style={{ width: 'min(420px, 100%)', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px 4px' }}>
          <div style={{ fontSize: 'var(--text-body-size)', fontWeight: 600, color: 'var(--ink)' }}>Chase the contract signature</div>
        </div>

        {/* subtasks — copied verbatim from the drawer, as the alignment control */}
        <div data-h="subtasks" style={{ padding: '4px 14px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 8px' }}>
            <span style={label}>Subtasks</span>
          </div>
          <EmptyLine className="px-2.5 py-1.5">No subtasks yet — break this down below.</EmptyLine>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 4px 26px' }}>
            <Icon icon={Plus} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input placeholder="Add a subtask…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-small-size)', padding: '6px 0', minWidth: 0, color: 'var(--ink)' }} />
          </div>
        </div>

        {/* files (§7H) — the section under test */}
        <div data-h="files" style={{ padding: '4px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 8px' }}>
            <Icon icon={Paperclip} size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={label}>Files</span>
          </div>
          <AttachmentsPanel owner={{ task_id: '00000000-0000-4000-8000-000000000001' }} />
        </div>

        {/* comments — the other neighbour, for the same reason as subtasks */}
        <div data-h="comments" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px 6px', borderTop: '1px solid var(--line-2)', marginTop: 6 }}>
          <Icon icon={MessageCircle} size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={label}>Comments &amp; activity</span>
        </div>
        <div style={{ padding: '4px 22px 18px' }}>
          <EmptyLine className="py-6">No comments yet. Start the thread below.</EmptyLine>
        </div>
      </div>
    </div>
  );
}
