'use client';
// Real-time sync — subscribes to the signed-in user's row changes (RLS scopes
// what Realtime delivers) and refreshes server data so every device/session
// reflects edits live, no manual refresh. Views reconcile incoming props.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const TABLES = ['tasks', 'goals', 'milestones', 'projects', 'task_comments', 'rituals', 'clients', 'client_notes', 'leads', 'invoices', 'invoice_items', 'payments', 'time_entries', 'project_activity', 'habits', 'habit_logs', 'calendar_events', 'client_requests', 'request_messages', 'approvals'];

export function RealtimeSync() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase.channel('zb-realtime');
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
