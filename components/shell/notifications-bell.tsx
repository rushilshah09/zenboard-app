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
import { Icon, MenuLabel, Popover, PopoverTrigger, PopoverContent } from '@/components/ds/ui';
import { Bell } from '@/components/ds/icons';
import { formatAgo } from '@/lib/date';
import { TOOLBAR_ICON_BUTTON } from '@/components/shell/shell-parts';

type NotifRow = {
  id: string; kind: string; title: string; body: string | null;
  link: { href?: string } | null; read: boolean; created_at: string;
};

// Quiet relative time. This said "same voice as the rest of the app" while being
// a hand-rolled copy — which is exactly why it wasn't: its fallback rendered a
// month-first date next to the day-first ones everywhere else.
const relTime = (iso: string): string => formatAgo(iso, { precise: true }) ?? '';

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
    // PORTALLED. This panel was an `absolute` MenuPanel inside the header, which
    // the shell clips (`overflow: hidden` on its panels) — the same latent bug
    // as the document card menu the user screenshotted. A Popover rather than a
    // DropdownMenu because these rows are notification CARDS, not menu items:
    // they carry a title, a body and a timestamp, and forcing `menuitem`
    // semantics onto them would announce them wrongly and impose type-ahead.
    // `onMouseLeave` to close is gone with it — a panel you have to keep the
    // pointer inside is unusable by keyboard, and Radix handles outside-click
    // and Escape properly.
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next && !isDemo) load(); }}>
      <PopoverTrigger asChild>
      <button
        aria-label="Notifications" title="Notifications" className="zb-nav-item zb-press"
        style={{ ...TOOLBAR_ICON_BUTTON, position: 'relative' }}>
        <Icon icon={Bell} size={16} />
        {/* The ONE true-berry element in chrome (Figma 1:764). */}
        {unread > 0 && (
          <span aria-label={`${unread} unread`} style={{ position: 'absolute', top: 2, right: 1, minWidth: 10, height: 10, padding: 2, borderRadius: 'var(--r-full)', background: 'var(--accent)', border: '1px solid var(--paper)', color: 'var(--on-accent)', fontSize: 8, fontWeight: 500, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      </PopoverTrigger>
      <PopoverContent align="end" flush aria-label="Notifications" className="w-[300px] p-1">
        <div>
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
                  className="group/note zb-press flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left transition-colors duration-fast">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: r.read ? 'transparent' : 'var(--color-berry-500)' }} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-ui ${r.read ? 'text-ink-600 group-hover/note:text-ink-700' : 'text-ink-800'}`}>{r.title}</span>
                    {r.body && <span className="block truncate text-caption text-ink-500 group-hover/note:text-ink-700">{r.body}</span>}
                    <span className="block text-caption text-ink-500 group-hover/note:text-ink-700">{relTime(r.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
