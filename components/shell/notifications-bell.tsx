'use client';
// The shell notification bell, wired to real data. Reads the signed-in owner's
// notifications through RLS (owner-only), shows an unread count in the one berry
// badge chrome carries, and marks a row read on click before navigating to the
// linked surface. Subscribes to realtime INSERTs so a client's portal/form action
// lights the bell live — once 0021 adds `notifications` to the publication. Until
// then it still refreshes every time the panel is opened, so nothing is lost; it
// just isn't instant. Visual chrome is copied 1:1 from the shell's inline bell so
// it stays a sibling of its Search/Power/Focus neighbours (Figma 1:764).
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon, MenuPanel, MenuLabel } from '@/components/ds/ui';
import { Bell } from '@/components/ds/icons';

type NotifRow = {
  id: string; kind: string; title: string; body: string | null;
  link: { href?: string } | null; read: boolean; created_at: string;
};

// Quiet relative time — same voice as the rest of the app (no seconds precision).
function relTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationsBell({ demo }: { demo?: NotifRow[] } = {}) {
  const router = useRouter();
  const isDemo = !!demo;
  const [supabase] = useState(() => createClient());
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotifRow[]>(demo ?? []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setRows(data as NotifRow[]);
  }, [supabase]);

  // Initial load + live inserts. RLS scopes both to the signed-in owner, so this
  // can only ever surface the current user's own notifications. The dev-preview
  // harness passes `demo` rows and skips the network entirely.
  useEffect(() => {
    if (isDemo) return;
    load();
    const channel = supabase
      .channel('zb-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDemo, supabase, load]);

  const unread = rows.filter((r) => !r.read).length;

  const markRead = useCallback(async (id: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)));
    if (!isDemo) await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, [isDemo, supabase]);

  const markAll = useCallback(async () => {
    setRows((rs) => rs.map((r) => ({ ...r, read: true })));
    if (!isDemo) await supabase.from('notifications').update({ read: true }).eq('read', false);
  }, [isDemo, supabase]);

  const openRow = useCallback((r: NotifRow) => {
    if (!r.read) markRead(r.id);
    setOpen(false);
    const href = r.link?.href;
    if (href && !isDemo) router.push(href);
  }, [isDemo, markRead, router]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => { const next = !v; if (next && !isDemo) load(); return next; })}
        aria-label="Notifications" title="Notifications" className="zb-nav-item zb-press"
        style={{ position: 'relative', width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--color-icon-default)', flexShrink: 0 }}>
        <Icon icon={Bell} size={16} />
        {/* The ONE true-berry element in chrome (Figma 1:764). */}
        {unread > 0 && (
          <span aria-label={`${unread} unread`} style={{ position: 'absolute', top: 2, right: 1, minWidth: 10, height: 10, padding: 2, borderRadius: 120, background: 'var(--color-berry-500)', border: '1px solid var(--paper)', color: '#FDFEFB', fontSize: 8, fontWeight: 500, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <MenuPanel aria-label="Notifications" onMouseLeave={() => setOpen(false)} className="absolute right-0 top-full z-[60] mt-1.5 w-[300px]">
          <div className="flex items-center justify-between pr-1">
            <MenuLabel>Notifications</MenuLabel>
            {unread > 0 && (
              <button onClick={markAll} className="zb-press rounded-sm px-1.5 py-1 text-caption text-ink-500 transition-colors duration-fast hover:text-ink-800">Mark all read</button>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="px-2.5 py-2 text-ui text-ink-500">You&rsquo;re all caught up.</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {rows.map((r) => (
                <button key={r.id} onClick={() => openRow(r)}
                  className="zb-press flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-fast hover:bg-surface-hover">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: r.read ? 'transparent' : 'var(--color-berry-500)' }} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-ui ${r.read ? 'text-ink-600' : 'text-ink-800'}`}>{r.title}</span>
                    {r.body && <span className="block truncate text-caption text-ink-500">{r.body}</span>}
                    <span className="block text-caption text-ink-400">{relTime(r.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </MenuPanel>
      )}
    </div>
  );
}
