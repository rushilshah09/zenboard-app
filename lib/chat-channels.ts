// ── THE CHANNEL LIST ───────────────────────────────────────────────────────
//
// Not in `lib/actions/chat.ts`, on purpose: a 'use server' file can only export actions, and the
// Messages PAGE needs this on the server through `pageScope()` — which already knows the user and
// the space — rather than through an action that would ask the Auth server a second time. Round
// trips are this app's main cost; a page should not pay for one it already made.
//
// Server-only in practice: the one client file that mentions it does `import type`, which is erased
// at compile time, so nothing here can reach the browser bundle.

import type { createClient } from '@/lib/supabase/server';
import { toMessage, unreadCount, type ChatAuthor, type ChatMessage } from '@/lib/chat';

type DB = Awaited<ReturnType<typeof createClient>>;

export type Channel = {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  last: { body: string; at: string; author: ChatAuthor } | null;
  unread: number;
};

const COLS = 'id,project_id,author,author_name,body,created_at,edited_at,deleted_at';

type Row = {
  id: string; project_id: string; author: string; author_name: string | null; body: string;
  created_at: string; edited_at: string | null; deleted_at: string | null;
};

/**
 * Every project in the space that HAS a client — a conversation needs someone on the other side —
 * scoped exactly as the Projects page scopes it (`space_id`), so Messages can never show a project
 * that Projects hides. Two round trips: the projects, then three reads in parallel.
 */
export async function loadChannels(supabase: DB, sid: string): Promise<{ error: string } | { channels: Channel[] }> {
  const { data: projects, error } = await supabase
    .from('projects').select('id,name,client_id').eq('space_id', sid).not('client_id', 'is', null).order('created_at');
  if (error) return { error: 'Could not load your conversations.' };
  const list = (projects ?? []) as { id: string; name: string; client_id: string }[];
  if (list.length === 0) return { channels: [] };

  const ids = list.map((p) => p.id);
  const [clients, recent, reads] = await Promise.all([
    supabase.from('clients').select('id,name').in('id', [...new Set(list.map((p) => p.client_id))]),
    // Newest first across every channel: enough to find each one's last message and count unread.
    supabase.from('project_messages').select(COLS).in('project_id', ids).order('created_at', { ascending: false }).limit(1000),
    supabase.from('project_message_reads').select('project_id,last_read_at').in('project_id', ids).eq('reader', 'team'),
  ]);
  if (clients.error || recent.error || reads.error) return { error: 'Could not load your conversations.' };

  const clientName = new Map((clients.data as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const projectClient = new Map(list.map((p) => [p.id, p.client_id]));
  const readAt = new Map((reads.data as { project_id: string; last_read_at: string }[]).map((r) => [r.project_id, r.last_read_at]));
  const byProject = new Map<string, ChatMessage[]>();
  for (const r of recent.data as Row[]) {
    const m = toMessage(r, { team: 'You', client: clientName.get(projectClient.get(r.project_id) ?? '') ?? 'Client' });
    byProject.set(r.project_id, [...(byProject.get(r.project_id) ?? []), m]);
  }

  return {
    channels: list.map((p) => {
      const msgs = byProject.get(p.id) ?? [];
      const last = msgs.find((m) => !m.deleted) ?? null; // newest first
      return {
        projectId: p.id,
        projectName: p.name,
        clientId: p.client_id,
        clientName: clientName.get(p.client_id) ?? 'Client',
        last: last ? { body: last.body, at: last.createdAt, author: last.author } : null,
        unread: unreadCount(msgs, 'team', readAt.get(p.id) ?? null),
      };
    }),
  };
}
