'use client';
// ── THE CONVERSATION, AS IT IS DRAWN ───────────────────────────────────────
//
// One component for both sides: the owner's Messages page and the client's portal draw the same
// list from the same layout (`lib/chat.ts`), so the two can never disagree about what a
// conversation looks like. See CHAT_PLAN.md for the Slack benchmark each detail answers to.
//
// ── SCROLL ─────────────────────────────────────────────────────────────────
// Slack's rules, and the reason for each:
//   · a conversation OPENS at the first unread message, or at the bottom — you land where you left
//     off, not at the top of history;
//   · a new message only pulls the view down if you were already at the bottom. Yanking someone
//     away from what they are reading is the one thing a chat must never do — so instead a quiet
//     "New messages" pill appears, and one click takes them down;
//   · your OWN send always takes you to the bottom: you just said it, you want to see it land;
//   · older history loads at the TOP without moving what you are looking at by a pixel.
//
// ── MOTION ─────────────────────────────────────────────────────────────────
// None. A message arriving is text appearing where text goes, and this list is seen dozens of
// times a day (Emil's frequency rule). The only transitions are the house's colour washes.

import * as React from 'react';
import { ArrowDown, Copy, Pencil, Trash } from '@/components/ds/icons';
import { Avatar, Button, Icon, IconButton, Textarea } from '@/components/ds/ui';
import { OVERLAY_CLASS } from '@/components/ds/ui/menu';
import { ROW_TRANSITION, rowWash } from '@/components/ds/ui/row-state';
import { cn } from '@/lib/cn';
import { useFocusReturn } from '@/lib/use-focus-return';
import { formatClock, formatDayTime } from '@/lib/date';
import { canEdit, layoutMessages, normalizeBody, type ChatAuthor, type ChatItem, type ChatMessage } from '@/lib/chat';

/** How close to the bottom still counts as "at the bottom" — one short message's worth. */
const AT_BOTTOM_PX = 80;
/** How close to the top starts loading older history — before you hit the wall, not after. */
const NEAR_TOP_PX = 120;

export type MessageListProps = {
  messages: ChatMessage[];
  /** Which side is reading — decides what counts as unread and which messages are yours. */
  me: ChatAuthor;
  lastReadAt: string | null;
  tz?: string;
  onRetry?: (m: ChatMessage) => void;
  /** Drawn in place of the list when there are no messages at all. */
  empty?: React.ReactNode;
  className?: string;
  // ── C2 ──
  editingId?: string | null;
  onEditStart?: (m: ChatMessage) => void;
  onEditSave?: (m: ChatMessage, body: string) => void;
  onEditCancel?: () => void;
  onDelete?: (m: ChatMessage) => void;
  onCopy?: (m: ChatMessage) => void;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
};

export function MessageList({
  messages, me, lastReadAt, tz, onRetry, empty, className,
  editingId = null, onEditStart, onEditSave, onEditCancel, onDelete, onCopy,
  hasMore = false, loadingOlder = false, onLoadOlder,
}: MessageListProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const opened = React.useRef(false);
  /**
   * The message the reader was looking at when older history was requested, and how far it sat
   * from the top of the viewport. While history loads, every render puts that message back at
   * exactly that distance — so neither the "Loading…" line nor the messages arriving above can
   * move it.
   *
   * (The first version did this with scroll-height arithmetic and MEASURED a 233px jump: the
   * loading line changed the height between the two readings. Anchoring to the element itself
   * cannot drift, whatever else is inserted above it.)
   */
  const anchor = React.useRef<{ id: string; offset: number } | null>(null);

  // The unread line is decided by where you had read to WHEN THE CONVERSATION OPENED, and it stays
  // put while you read. Recomputing it from a lastReadAt that moves the moment you mark the channel
  // read would make the line vanish under your eyes.
  const [openedReadAt] = React.useState(lastReadAt);
  const items = React.useMemo(
    () => layoutMessages(messages, { me, lastReadAt: openedReadAt, tz }),
    [messages, me, openedReadAt, tz],
  );

  // ── "New messages": something arrived below while you were reading above ──
  // Reconciled DURING RENDER (the house rule), from the newest message's id: history loading at
  // the top changes the count but not the newest id, so it can never raise the pill.
  const newest = messages.at(-1);
  const [bottomState, setBottomState] = React.useState(true);
  const [seenNewest, setSeenNewest] = React.useState(newest?.id);
  const [prevNewest, setPrevNewest] = React.useState(newest?.id);
  if (newest?.id !== prevNewest) {
    setPrevNewest(newest?.id);
    // Arrived while you were at the bottom, or is your own words: already seen.
    if (bottomState || newest?.author === me) setSeenNewest(newest?.id);
  }
  const showPill = !bottomState && newest?.id !== seenNewest;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_PX;
    atBottom.current = bottom;
    if (bottom !== bottomState) setBottomState(bottom);
    if (bottom && newest?.id !== seenNewest) setSeenNewest(newest?.id);
    if (el.scrollTop < NEAR_TOP_PX && hasMore && !loadingOlder && onLoadOlder) {
      // Remember the first message still in view before anything is added above it.
      const top = el.getBoundingClientRect().top;
      const first = [...el.querySelectorAll<HTMLElement>('[data-message-id]')].find((a) => a.getBoundingClientRect().bottom > top);
      if (first) anchor.current = { id: first.dataset.messageId!, offset: first.getBoundingClientRect().top - top };
      onLoadOlder();
    }
  };

  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const held = anchor.current;
    const target = held ? el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(held.id)}"]`) : null;
    if (!opened.current) {
      opened.current = true;
      const line = el.querySelector<HTMLElement>('[data-chat-new]');
      // Land on the first unread, with a little of what came before it for context.
      el.scrollTop = line ? Math.max(0, line.offsetTop - el.clientHeight / 3) : el.scrollHeight;
    } else if (held && target) {
      // History is loading or has just landed ABOVE: put the message you were reading back exactly
      // where it was on screen.
      el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - held.offset;
      if (!loadingOlder) anchor.current = null; // the load finished; stop holding
    } else if (atBottom.current || (newest?.author === me && newest.pending)) {
      el.scrollTop = el.scrollHeight;
    }
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_PX;
  }, [items, messages, me, newest, loadingOlder]);

  const jumpToLatest = () => {
    const el = scroller.current;
    if (!el) return;
    // Instant: a jump the person asked for is not an event to perform.
    el.scrollTop = el.scrollHeight;
    onScroll();
  };

  if (messages.length === 0 && empty) {
    return <div className={cn('grid flex-1 place-items-center p-6', className)}>{empty}</div>;
  }

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <div
        ref={scroller}
        onScroll={onScroll}
        // A live region, so a screen reader hears a new message without having to go looking.
        role="log"
        aria-live="polite"
        aria-label="Messages"
        aria-busy={loadingOlder || undefined}
        // The browser's own scroll anchoring would ALSO adjust when history lands above, and two
        // hands on one scroll position is how it drifts. This list anchors itself (see `anchor`).
        className="scroll-region min-h-0 flex-1 pb-3 [overflow-anchor:none]"
      >
        {/* A conversation grows UPWARD from the composer, as every chat does: when it does not fill
            the pane, it sits at the bottom, nearest where you type, and new history arrives above
            without moving the newest line. A document starts at the top; a conversation does not. */}
        <div className="flex min-h-full flex-col justify-end">
        {loadingOlder && <p className="py-3 text-center text-caption text-ink-500">Loading earlier messages…</p>}
        {items.map((item) => (
          <Item
            key={item.key}
            item={item}
            me={me}
            tz={tz}
            onRetry={onRetry}
            editing={item.kind === 'message' && item.message.id === editingId}
            onEditStart={onEditStart}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
            onDelete={onDelete}
            onCopy={onCopy}
          />
        ))}
        </div>
      </div>
      {showPill && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="xs"
            variant="secondary"
            icon={<Icon icon={ArrowDown} size={14} />}
            onClick={jumpToLatest}
            className="pointer-events-auto shadow-md"
          >
            New messages
          </Button>
        </div>
      )}
    </div>
  );
}

type ItemProps = {
  item: ChatItem; me: ChatAuthor; tz?: string; editing: boolean;
  onRetry?: (m: ChatMessage) => void;
  onEditStart?: (m: ChatMessage) => void;
  onEditSave?: (m: ChatMessage, body: string) => void;
  onEditCancel?: () => void;
  onDelete?: (m: ChatMessage) => void;
  onCopy?: (m: ChatMessage) => void;
};

function Item({ item, ...rest }: ItemProps) {
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
      // The one red line in a conversation, and the only loud thing on it: where you stopped reading.
      <div data-chat-new className="my-2 flex items-center gap-2 px-5" role="separator" aria-label="New messages">
        <span className="h-px flex-1 bg-danger-500" />
        <span className="text-caption font-medium text-danger-600">New</span>
      </div>
    );
  }
  return <Message message={item.message} startsRun={item.startsRun} {...rest} />;
}

function Message({ message: m, startsRun, me, tz, editing, onRetry, onEditStart, onEditSave, onEditCancel, onDelete, onCopy }:
  Omit<ItemProps, 'item'> & { message: ChatMessage; startsRun: boolean }) {
  const time = formatClock(m.createdAt, tz);
  const full = formatDayTime(m.createdAt);
  const mine = canEdit(m, me);
  // A message you can ACT on washes under the pointer — the wash promises the toolbar. A deleted or
  // unsent one does nothing, so it does not light up (the row vocabulary's rule).
  const actionable = !m.deleted && !m.pending && !m.failed && !editing && (!!onCopy || mine);

  return (
    <article
      data-message-id={m.id}
      aria-label={`${m.authorName}, ${full ?? ''}`}
      className={cn(
        'group relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 px-5',
        startsRun ? 'mt-2 pb-0.5 pt-1.5' : 'py-0.5',
        ROW_TRANSITION,
        editing ? 'bg-surface-selected' : rowWash(false, actionable),
      )}
    >
      <div className="pt-0.5">
        {startsRun ? (
          // A person, so a circle; the name sits right beside it, so the avatar is decorative.
          <Avatar name={m.authorName} size="md" decorative />
        ) : (
          // A continued line shows its time in the gutter only on hover — Slack's quiet timestamp.
          <time dateTime={m.createdAt} title={full} className="reveal-on-hover block pt-0.5 text-end text-caption tabular-nums text-ink-500">
            {time}
          </time>
        )}
      </div>
      <div className="min-w-0">
        {startsRun && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-ui font-medium text-ink-900">{m.authorName}</span>
            <time dateTime={m.createdAt} title={full} className="shrink-0 text-caption tabular-nums text-ink-500">{time}</time>
          </div>
        )}
        {editing && onEditSave && onEditCancel ? (
          <InlineEditor initial={m.body} onSave={(body) => onEditSave(m, body)} onCancel={onEditCancel} />
        ) : m.deleted ? (
          <p className="text-body text-ink-500">This message was deleted.</p>
        ) : (
          // TEXT, never HTML: a message is rendered exactly as typed, line breaks included.
          <p className={cn('whitespace-pre-wrap break-words text-body', m.pending ? 'text-ink-500' : 'text-ink-900')}>
            {m.body}
            {m.editedAt && <span className="ms-1 text-caption text-ink-500">(edited)</span>}
          </p>
        )}
        {m.failed && (
          <div className="mt-1 flex items-center gap-2 text-caption text-danger-600" role="alert">
            Not sent.
            {onRetry && <Button size="xs" variant="ghost" onClick={() => onRetry(m)}>Retry</Button>}
          </div>
        )}
        {m.author === me && m.pending && !m.failed && <span className="sr-only">Sending</span>}
      </div>

      {actionable && (
        // Slack's floating toolbar. `reveal-on-hover` also shows it on :focus-within and always on a
        // touch screen, so the keyboard and a thumb reach every action the pointer does.
        <div className={cn(OVERLAY_CLASS, 'reveal-on-hover absolute -top-3 end-4 flex items-center gap-0.5 p-0.5')}>
          {onCopy && <IconButton label="Copy text" size="xs" icon={<Icon icon={Copy} size={14} />} onClick={() => onCopy(m)} />}
          {mine && onEditStart && <IconButton label="Edit message" tooltip="Edit message · ↑ edits your last" size="xs" icon={<Icon icon={Pencil} size={14} />} onClick={() => onEditStart(m)} />}
          {mine && onDelete && <IconButton label="Delete message" size="xs" icon={<Icon icon={Trash} size={14} />} onClick={() => onDelete(m)} />}
        </div>
      )}
    </article>
  );
}

/** Editing in place, with Slack's keys: Enter saves, Shift+Enter breaks, Escape cancels. */
function InlineEditor({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => void; onCancel: () => void }) {
  const [text, setText] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  // The house rule for a layer that owns Escape: if closing left focus nowhere, hand it back to
  // whatever opened the editor. (The conversation usually gets there first, by focusing the composer.)
  useFocusReturn();

  // Arrive with the caret at the END, where editing a sentence usually starts.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = () => {
    const checked = normalizeBody(text);
    if (!checked.ok) return setError(checked.error);
    onSave(checked.body);
  };

  return (
    <div className="mt-1">
      <Textarea
        ref={ref}
        compact
        value={text}
        aria-label="Edit message"
        aria-invalid={error ? true : undefined}
        onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
          if (e.key !== 'Enter' || e.shiftKey) return;
          if (e.nativeEvent.isComposing || e.keyCode === 229) return; // an IME is confirming a character
          e.preventDefault();
          save();
        }}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="xs" variant="primary" onClick={save}>Save</Button>
        {error ? (
          <span className="text-caption text-danger-600" role="alert">{error}</span>
        ) : (
          <span className="text-caption text-ink-500">Escape to cancel · Enter to save</span>
        )}
      </div>
    </div>
  );
}
