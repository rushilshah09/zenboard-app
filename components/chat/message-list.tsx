'use client';
// ── THE CONVERSATION, AS IT IS DRAWN ───────────────────────────────────────
//
// One component for both sides: the owner's Messages page and the client's portal draw the same
// list from the same layout (`lib/chat.ts`), so the two can never disagree about what a
// conversation looks like. See CHAT_PLAN.md for the Slack benchmark each detail answers to.
//
// ── SCROLL ─────────────────────────────────────────────────────────────────
// Slack's rules, and the reason for each:
//   · a conversation OPENS at the first unread message (centred), or at the bottom — you land where
//     you left off, not at the top of history;
//   · a new message only pulls the view down if you were already at the bottom. Yanking someone
//     away from the message they are reading is the one thing a chat must never do.
//
// ── MOTION ─────────────────────────────────────────────────────────────────
// None. A message arriving is not an event to perform; it is text appearing where text goes. This
// is the house rule for anything seen dozens of times a day, and it is Slack's behaviour too.

import * as React from 'react';
import { Avatar, Button } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { formatClock, formatDayTime } from '@/lib/date';
import { layoutMessages, type ChatAuthor, type ChatItem, type ChatMessage } from '@/lib/chat';

/** How close to the bottom still counts as "at the bottom" — one short message's worth. */
const AT_BOTTOM_PX = 80;

export function MessageList({
  messages,
  me,
  lastReadAt,
  tz,
  onRetry,
  empty,
  className,
}: {
  messages: ChatMessage[];
  /** Which side is reading — decides what counts as unread and whose runs are "yours". */
  me: ChatAuthor;
  lastReadAt: string | null;
  tz?: string;
  onRetry?: (m: ChatMessage) => void;
  /** Drawn in place of the list when there are no messages at all. */
  empty?: React.ReactNode;
  className?: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const opened = React.useRef(false);

  // The unread line is decided by where you had read to WHEN THE CONVERSATION OPENED, and it stays
  // put while you read. Recomputing it from a lastReadAt that moves the moment you mark the channel
  // read would make the line vanish under your eyes.
  const [openedReadAt] = React.useState(lastReadAt);
  const items = React.useMemo(
    () => layoutMessages(messages, { me, lastReadAt: openedReadAt, tz }),
    [messages, me, openedReadAt, tz],
  );

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_PX;
  };

  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!opened.current) {
      opened.current = true;
      const line = el.querySelector<HTMLElement>('[data-chat-new]');
      if (line) {
        // Land on the first unread, with a little of what came before it for context.
        el.scrollTop = Math.max(0, line.offsetTop - el.clientHeight / 3);
        onScroll();
        return;
      }
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  if (messages.length === 0 && empty) {
    return <div className={cn('grid flex-1 place-items-center p-6', className)}>{empty}</div>;
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      // A live region, so a screen reader hears a new message without having to go looking.
      role="log"
      aria-live="polite"
      aria-label="Messages"
      className={cn('scroll-region min-h-0 flex-1 pb-3', className)}
    >
      {items.map((item) => (
        <Item key={item.key} item={item} me={me} tz={tz} onRetry={onRetry} />
      ))}
    </div>
  );
}

function Item({ item, me, tz, onRetry }: { item: ChatItem; me: ChatAuthor; tz?: string; onRetry?: (m: ChatMessage) => void }) {
  if (item.kind === 'day') {
    return (
      <div className="relative my-3 flex items-center px-5" role="separator" aria-label={item.label}>
        <span className="h-px flex-1 bg-line-soft" />
        <span className="mx-3 text-caption font-medium text-ink-500">{item.label}</span>
        <span className="h-px flex-1 bg-line-soft" />
      </div>
    );
  }
  if (item.kind === 'new') {
    return (
      // The one red line in a conversation, and the only thing on it that is loud: it marks where
      // you stopped reading.
      <div data-chat-new className="my-2 flex items-center gap-2 px-5" role="separator" aria-label="New messages">
        <span className="h-px flex-1 bg-danger-500" />
        <span className="text-caption font-medium text-danger-600">New</span>
      </div>
    );
  }
  return <Message message={item.message} startsRun={item.startsRun} mine={item.message.author === me} tz={tz} onRetry={onRetry} />;
}

function Message({ message: m, startsRun, mine, tz, onRetry }: {
  message: ChatMessage; startsRun: boolean; mine: boolean; tz?: string; onRetry?: (m: ChatMessage) => void;
}) {
  const time = formatClock(m.createdAt, tz);
  const full = formatDayTime(m.createdAt);
  return (
    <article
      aria-label={`${m.authorName}, ${full ?? ''}`}
      className={cn('group relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 px-5', startsRun ? 'mt-3 pt-0.5' : 'mt-0.5')}
    >
      <div className="pt-0.5">
        {startsRun ? (
          // A person, so a circle; the name sits right beside it, so the avatar is decorative.
          <Avatar name={m.authorName} size="md" decorative />
        ) : (
          // A continued line shows its time in the gutter only on hover — Slack's quiet timestamp.
          <time
            dateTime={m.createdAt}
            title={full}
            className="reveal-on-hover block pt-0.5 text-end text-caption tabular-nums text-ink-500"
          >
            {time}
          </time>
        )}
      </div>
      <div className="min-w-0">
        {startsRun && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-ui font-medium text-ink-900">{m.authorName}</span>
            <time dateTime={m.createdAt} title={full} className="shrink-0 text-caption tabular-nums text-ink-500">
              {time}
            </time>
          </div>
        )}
        {m.deleted ? (
          <p className="text-body text-ink-500">This message was deleted.</p>
        ) : (
          // TEXT, never HTML: a message is rendered exactly as typed, line breaks included.
          <p
            className={cn(
              'whitespace-pre-wrap break-words text-body',
              // Unsent is a solid step down the ink ramp — never an opacity fade (house rule).
              m.pending ? 'text-ink-500' : 'text-ink-900',
            )}
          >
            {m.body}
            {m.editedAt && <span className="ms-1 text-caption text-ink-500">(edited)</span>}
          </p>
        )}
        {m.failed && (
          <div className="mt-1 flex items-center gap-2 text-caption text-danger-600" role="alert">
            Not sent.
            {onRetry && (
              <Button size="xs" variant="ghost" onClick={() => onRetry(m)}>
                Retry
              </Button>
            )}
          </div>
        )}
        {mine && m.pending && !m.failed && <span className="sr-only">Sending</span>}
      </div>
    </article>
  );
}
