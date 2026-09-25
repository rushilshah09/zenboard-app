import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageList } from '@/components/chat/message-list';
import type { ChatMessage } from './chat';

// ── WHAT THE CONVERSATION ACTUALLY RENDERS ─────────────────────────────────
//
// The silent-failure guard (design-system.test.ts) accepts `failed: true` as a way of telling
// someone a send failed. That is only true if the list really turns a failed message into an
// alert — this file is the proof, so the guard's exemption can never become a loophole.

const base: ChatMessage = {
  id: 'm1', projectId: 'p1', author: 'team', authorName: 'Rushil Shah', body: 'Draft is up',
  createdAt: '2026-09-24T09:00:00Z', editedAt: null, deleted: false,
};
const html = (messages: ChatMessage[], onRetry?: () => void) =>
  renderToStaticMarkup(React.createElement(MessageList, { messages, me: 'team', lastReadAt: '2099-01-01T00:00:00Z', tz: 'UTC', onRetry }));

describe('a message that failed to send', () => {
  it('says so, as an alert, on the message itself', () => {
    const out = html([{ ...base, failed: true }], () => {});
    expect(out).toMatch(/role="alert"[^>]*>Not sent\./);
    expect(out).toContain('Retry');
  });

  it('offers no alert when nothing failed (control)', () => {
    expect(html([base])).not.toContain('role="alert"');
  });
});

describe('what a message is drawn as', () => {
  it('renders text as TEXT — markup in a message is never interpreted', () => {
    // A client can type anything into a portal. It must reach the owner as characters, not HTML.
    const out = html([{ ...base, body: '<img src=x onerror=alert(1)>' }]);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('keeps a deleted message’s place and says what happened to it', () => {
    const out = html([{ ...base, deleted: true, body: '' }]);
    expect(out).toContain('This message was deleted.');
  });

  it('draws an unsent message a solid step down the ink ramp, never faded with opacity', () => {
    const out = html([{ ...base, pending: true }]);
    expect(out).toMatch(/whitespace-pre-wrap[^"]*text-ink-500/);
    expect(out).not.toMatch(/opacity-\d/);
  });

  it('is a live log, so a screen reader hears new messages arrive', () => {
    const out = html([base]);
    expect(out).toMatch(/role="log"/);
    expect(out).toMatch(/aria-live="polite"/);
  });
});
