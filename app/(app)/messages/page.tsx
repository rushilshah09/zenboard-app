// Messages — a Slack-style conversation per project, shared with the client through its portal.
// See CHAT_PLAN.md.
//
// GATED on migration 0043: before it is applied the page says so plainly instead of failing, and
// the moment it is applied the page works — no deploy in between (SPRINT_RULES, rule 2).
import { MessagesView } from '@/components/chat/messages-view';
import { PageStamp } from '@/components/shell/page-stamp';
import { EmptyState, Icon } from '@/components/ds/ui';
import { MessageCircle } from '@/components/ds/icons';
import { pageScope } from '@/lib/page-scope';
import { chatSupported } from '@/lib/actions/chat';
import { loadChannels } from '@/lib/chat-channels';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, sid } = await pageScope();
  const [{ c }, ready] = await Promise.all([searchParams, chatSupported(supabase)]);

  if (!ready) {
    return (
      <>
        <PageStamp />
        <div className="grid min-h-[60vh] place-items-center p-6">
          <EmptyState
            illustration={<Icon icon={MessageCircle} size={20} />}
            title="Messages are almost ready"
            description="Each client project gets its own conversation here."
          />
        </div>
      </>
    );
  }

  const res = await loadChannels(supabase, sid);
  const channels = 'error' in res ? [] : res.channels;
  // Only open the channel the URL names if it is really one of this person's.
  const initial = c && channels.some((ch) => ch.projectId === c) ? c : null;

  return (
    <>
      <PageStamp />
      <MessagesView initialChannels={channels} initialChannelId={initial} />
    </>
  );
}
