'use client';
// Messages: the product's own Messages, in its demo mode (`demo` gates every network path in the view):
// a conversation per project, shared with that client through their portal.
import * as React from 'react';
import { MessagesView } from '@/components/chat/messages-view';
import type { ChannelView } from '@/lib/actions/chat';
import type { ChatMessage } from '@/lib/chat';
import type { Channel } from '@/lib/chat-channels';
import { PERSON } from '../fixtures';

function data() {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  let n = 0;
  const m = (projectId: string, client: string, min: number, author: 'team' | 'client', body: string): ChatMessage => ({
    id: `msg-${++n}`, projectId, author, authorName: author === 'team' ? PERSON.name : client, body, createdAt: ago(min), editedAt: null, deleted: false,
  });
  const ridgeline = [
    m('p-ridgeline', 'Priya Nair', 26 * 60 + 18, 'client', 'Hi! We reviewed the three logo routes with the team this morning.'),
    m('p-ridgeline', 'Priya Nair', 26 * 60 + 17, 'client', 'Route B is the clear favorite. Could we see it in the darker palette?'),
    m('p-ridgeline', 'Priya Nair', 24 * 60 + 40, 'team', 'Great news. I’ll send the darker palette tomorrow, with a couple of lockups.'),
    m('p-ridgeline', 'Priya Nair', 95, 'team', 'The darker palette is up in your portal, under Documents.\n\nTwo lockups: stacked, and horizontal for the site header.'),
    m('p-ridgeline', 'Priya Nair', 40, 'client', 'These look fantastic.'),
    m('p-ridgeline', 'Priya Nair', 39, 'client', 'Could the wordmark be a touch heavier? It feels thin next to the mark.'),
  ];
  const beacon = [
    m('p-beacon', 'Daniel Okafor', 6 * 24 * 60, 'team', 'Sitemap v2 is in. I folded Services into one page.'),
    m('p-beacon', 'Daniel Okafor', 6 * 24 * 60 - 30, 'client', 'Perfect, thank you. Could we add a careers page?'),
  ];
  const channels: Channel[] = [
    { projectId: 'p-ridgeline', projectName: 'Ridgeline rebrand', clientId: 'c-ridgeline', clientName: 'Ridgeline', last: { body: ridgeline[5].body, at: ridgeline[5].createdAt, author: 'client' }, unread: 2 },
    { projectId: 'p-beacon', projectName: 'Beacon Health site', clientId: 'c-beacon', clientName: 'Beacon Health', last: { body: beacon[1].body, at: beacon[1].createdAt, author: 'client' }, unread: 0 },
    { projectId: 'p-copper', projectName: 'Copper Row menus', clientId: 'c-copper', clientName: 'Copper Row', last: null, unread: 0 },
  ];
  const views: Record<string, ChannelView> = {
    'p-ridgeline': { messages: ridgeline, lastReadAt: ago(60), names: { team: PERSON.name, client: 'Priya Nair' }, hasMore: false, reactions: true },
    'p-beacon': { messages: beacon, lastReadAt: ago(0), names: { team: PERSON.name, client: 'Daniel Okafor' }, hasMore: false, reactions: true },
    'p-copper': { messages: [], lastReadAt: null, names: { team: PERSON.name, client: 'Maya Chen' }, hasMore: false, reactions: true },
  };
  return { channels, views };
}

export default function MessagesDemo() {
  const d = React.useMemo(() => data(), []);
  return <MessagesView initialChannels={d.channels} initialChannelId="p-ridgeline" demo={{ views: d.views, older: {} }} />;
}
