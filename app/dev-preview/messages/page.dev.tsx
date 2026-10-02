'use client';
// Dev-only harness for Messages — staged conversations so the Slack-style layout, author runs, day
// dividers, the unread line, optimistic send and the keyboard can be verified without a session.
// `demo` gates every network path in the view. 404s in prod (see ../layout.tsx).
import { MessagesView } from '@/components/chat/messages-view';
import { Toaster } from '@/components/ds/ui';
import type { Channel } from '@/lib/chat-channels';
import type { ChannelView } from '@/lib/actions/chat';
import type { ChatMessage } from '@/lib/chat';

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

let n = 0;
const m = (min: number, author: 'team' | 'client', body: string): ChatMessage => ({
  id: `d${++n}`, projectId: '', author, authorName: author === 'team' ? 'Rushil Shah' : 'Meridian Studio',
  body, createdAt: ago(min), editedAt: null, deleted: false,
});

const brand: ChatMessage[] = [
  m(26 * 60 + 18, 'client', 'Hi! We reviewed the three logo routes with the team this morning.'),
  m(26 * 60 + 17, 'client', 'Route B is the clear favourite — could we see it in the darker palette?'),
  m(24 * 60 + 40, 'team', 'Great news. I’ll send the darker palette tomorrow, with a couple of lockup options.'),
  m(95, 'team', 'Darker palette is up in the portal under Documents.\n\nTwo lockups: stacked, and horizontal for the site header.'),
  m(40, 'client', 'These look fantastic.'),
  m(39, 'client', 'Could the wordmark be a touch heavier? It feels thin next to the mark.'),
].map((x) => ({ ...x, projectId: 'p1' }));

const site: ChatMessage[] = [
  m(6 * 24 * 60, 'team', 'Sitemap v2 is in — I folded Services into one page.'),
  m(6 * 24 * 60 - 30, 'client', 'Perfect, thank you.'),
].map((x) => ({ ...x, projectId: 'p2' }));

const CHANNELS: Channel[] = [
  { projectId: 'p1', projectName: 'Brand identity', clientId: 'c1', clientName: 'Meridian Studio', last: { body: brand[5].body, at: brand[5].createdAt, author: 'client' }, unread: 2 },
  { projectId: 'p2', projectName: 'Website rebuild', clientId: 'c1', clientName: 'Meridian Studio', last: { body: site[1].body, at: site[1].createdAt, author: 'client' }, unread: 0 },
  { projectId: 'p3', projectName: 'Packaging refresh', clientId: 'c2', clientName: 'Atlas Coffee', last: null, unread: 0 },
];

// A page of OLDER history for #Brand identity, returned when the reader scrolls to the top.
const olderBrand: ChatMessage[] = [
  m(9 * 24 * 60, 'team', 'Kickoff notes are in the project doc — shout if anything reads wrong.'),
  m(9 * 24 * 60 - 12, 'client', 'Read them — all good. Excited to see the first routes!'),
  m(8 * 24 * 60, 'team', 'Moodboards are up. Three directions, one page each.'),
].map((x) => ({ ...x, projectId: 'p1' }));

const names = { team: 'Rushil Shah', client: 'Meridian Studio' };
const VIEWS: Record<string, ChannelView> = {
  // Read up to just before the client's last two messages, so the "New" line sits above them.
  // hasMore on the busiest channel, so scrolling to the top exercises loading older history.
  p1: { messages: brand, lastReadAt: ago(60), names, hasMore: true, reactions: true },
  p2: { messages: site, lastReadAt: ago(0), names, hasMore: false, reactions: true },
  p3: { messages: [], lastReadAt: null, names: { team: 'Rushil Shah', client: 'Atlas Coffee' }, hasMore: false, reactions: true },
};

export default function MessagesHarness() {
  return (
    <>
      <MessagesView initialChannels={CHANNELS} initialChannelId="p2" demo={{ views: VIEWS, older: { p1: olderBrand } }} />
      <Toaster />
    </>
  );
}
