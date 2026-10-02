// ── CHAT: THE PURE LAYER ────────────────────────────────────────────────────
//
// Everything that makes a conversation READ like Slack lives here, in plain functions with no I/O,
// so it can be tested exactly and shared by both sides of the conversation — the owner's Messages
// page and the client's portal draw the same list from the same layout. See CHAT_PLAN.md.
//
// A conversation belongs to a PROJECT (the portal token is a project token), and it has exactly
// two sides: the `team` (the owner) and the `client`.

import { addDaysISO, formatDay, isoDateIn } from '@/lib/date';

export type ChatAuthor = 'team' | 'client';

export type ChatMessage = {
  id: string;
  projectId: string;
  author: ChatAuthor;
  /** The name shown on the run. Stored on the row, so history survives a rename. */
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  /** Optimistic: shown at once, not yet confirmed by the server. */
  pending?: boolean;
  /** The send failed. The row stays, and offers a retry, rather than vanishing. */
  failed?: boolean;
  /** The pills under the message. ABSENT (not empty) when the read did not ask for reactions:
   *  before 0044 is applied, and on a realtime row, there is no answer rather than "none". */
  reactions?: Reaction[];
};

/** The database bound (0043's check constraint), repeated so the composer can say so first. */
export const CHAT_BODY_MAX = 8000;

/**
 * Consecutive messages by the same person within this window read as ONE run: the name is shown
 * once, and each later line only reveals its time on hover. Slack's window, measured by use: five
 * minutes is long enough to cover a train of thought and short enough that a reply after a coffee
 * reads as a new turn.
 */
export const RUN_WINDOW_MS = 5 * 60 * 1000;

export type BodyCheck = { ok: true; body: string } | { ok: false; error: string };

/**
 * What the composer is allowed to send. Trims the ENDS only — inner newlines are the author's
 * formatting and stay. Enforced again on the server; this copy exists so the person is told before
 * a round trip, not after one.
 */
export function normalizeBody(raw: string): BodyCheck {
  const body = raw.replace(/^\s+|\s+$/g, '');
  if (!body) return { ok: false, error: 'Write a message first.' };
  if (body.length > CHAT_BODY_MAX) {
    return { ok: false, error: `That is ${body.length.toLocaleString()} characters, and the limit is ${CHAT_BODY_MAX.toLocaleString()}.` };
  }
  return { ok: true, body };
}

type Row = {
  id: string; project_id: string; author: string; author_name: string | null; body: string;
  created_at: string; edited_at: string | null; deleted_at: string | null;
  /** Embedded by the reactions read (0044). Absent on every other read. */
  project_message_reactions?: ReactionRow[] | null;
};

// ── REACTIONS ──────────────────────────────────────────────────────────────
//
// A closed set, because a reaction is not a message: anything a person can type belongs in the
// composer, where it is edited, deleted and read like everything else they said. Eight, so the
// picker is one row and the first three can sit in the hover bar the way Slack's do.

/** The reactions on offer. The first three are the one-click ones (`QUICK_REACTIONS`). */
export const REACTIONS = ['👍', '✅', '🎉', '👀', '🔥', '❤️', '😄', '🙏'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

/** What each one is called, for the screen reader and the tooltip. */
export const REACTION_NAMES: Record<string, string> = {
  '👍': 'thumbs up', '✅': 'done', '🎉': 'celebrate', '👀': 'looking',
  '🔥': 'fire', '❤️': 'love', '😄': 'smile', '🙏': 'thank you',
};

/** Only the ones on offer, and only as themselves: a client cannot post text as a reaction. */
export const isReaction = (v: unknown): v is ReactionEmoji =>
  typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);

/** A stored reaction (0044). Taking one back sets `removed_at`; the row stays. */
export type ReactionRow = {
  emoji: string;
  /** Normalized at READ time, like `author`: anything that is not the team is the client. */
  reactor: string;
  created_at: string;
  removed_at?: string | null;
};

/** What is drawn: one pill per emoji, and which side is on it. */
export type Reaction = { emoji: string; team: boolean; client: boolean };

/**
 * Rows → pills, in the order each emoji was FIRST used, so a pill does not jump when the other
 * side joins it. A reaction that was taken back is not a pill; its row is still there, because
 * "removed" is a fact about when, not a hole in the history.
 */
export function groupReactions(rows: readonly ReactionRow[]): Reaction[] {
  const pills = new Map<string, Reaction>();
  const firstUsed = new Map<string, string>();
  for (const r of rows) {
    if (r.removed_at) continue;
    const pill = pills.get(r.emoji) ?? { emoji: r.emoji, team: false, client: false };
    if (r.reactor === 'team') pill.team = true; else pill.client = true;
    pills.set(r.emoji, pill);
    const first = firstUsed.get(r.emoji);
    if (!first || r.created_at < first) firstUsed.set(r.emoji, r.created_at);
  }
  return [...pills.values()].sort((a, b) => (firstUsed.get(a.emoji)! < firstUsed.get(b.emoji)! ? -1 : 1));
}

/** Is this pill mine? */
export const reacted = (r: Reaction, me: ChatAuthor): boolean => (me === 'team' ? r.team : r.client);

/**
 * My side on one emoji, set to `on`. Idempotent, because the realtime stream sends our own writes
 * back and an echo must not double anything; a pill nobody is on stops existing.
 */
export function withReaction(list: readonly Reaction[], emoji: string, side: ChatAuthor, on: boolean): Reaction[] {
  const out: Reaction[] = [];
  let seen = false;
  for (const r of list) {
    if (r.emoji !== emoji) { out.push(r); continue; }
    seen = true;
    const next: Reaction = { ...r, [side]: on };
    if (next.team || next.client) out.push(next);
  }
  if (!seen && on) out.push({ emoji, team: side === 'team', client: side === 'client' });
  return out;
}

/** Slack's press: the same emoji again takes mine back, and a pill the other side is on adds me beside them. */
export const toggleReaction = (list: readonly Reaction[], emoji: string, side: ChatAuthor): Reaction[] =>
  withReaction(list, emoji, side, !list.some((r) => r.emoji === emoji && reacted(r, side)));

/** Who reacted, from where I am sitting: I am always "You", and the other side has its name. */
export function reactionLabel(r: Reaction, me: ChatAuthor, names: { team: string; client: string }): string {
  const who = [
    r.team ? (me === 'team' ? 'You' : names.team) : null,
    r.client ? (me === 'client' ? 'You' : names.client) : null,
  ].filter(Boolean);
  return `${who.join(' and ')} reacted with ${REACTION_NAMES[r.emoji] ?? r.emoji}`;
}

/**
 * One row → one message. Normalizes at READ time (the property-vocabulary rule): an author outside
 * the two sides is treated as the client, which is the side with the least authority, never the
 * most. A deleted message keeps its place but loses its body.
 */
export function toMessage(r: Row, fallbackName: { team: string; client: string }): ChatMessage {
  const author: ChatAuthor = r.author === 'team' ? 'team' : 'client';
  const deleted = !!r.deleted_at;
  return {
    id: r.id,
    projectId: r.project_id,
    author,
    authorName: (r.author_name ?? '').trim() || fallbackName[author],
    body: deleted ? '' : r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deleted,
    // Only when the read asked for them: `undefined` means "not read", `[]` means "none".
    ...(Array.isArray(r.project_message_reactions)
      ? { reactions: groupReactions(r.project_message_reactions) }
      : null),
  };
}

/** "Today", "Yesterday", else "Monday 22 September" — in the house date vocabulary. */
export function dayLabel(dayISO: string, today: string): string {
  if (dayISO === today) return 'Today';
  if (dayISO === addDaysISO(today, -1)) return 'Yesterday';
  return formatDay(dayISO, { weekday: 'long', long: true }) ?? dayISO;
}

export type ChatItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'new'; key: string }
  | { kind: 'message'; key: string; message: ChatMessage; startsRun: boolean };

/** Oldest first, and optimistic messages after every confirmed one (they are the newest). */
function chronological(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      if (!!a.m.pending !== !!b.m.pending) return a.m.pending ? 1 : -1;
      const t = a.m.createdAt.localeCompare(b.m.createdAt);
      return t !== 0 ? t : a.i - b.i;
    })
    .map((x) => x.m);
}

/** Is this message unread by `me`? Only the OTHER side's messages can be; your own never are. */
function isUnread(m: ChatMessage, me: ChatAuthor, lastReadAt: string | null): boolean {
  if (m.author === me || m.pending || m.deleted) return false;
  return lastReadAt === null || m.createdAt > lastReadAt;
}

/**
 * The conversation as it is DRAWN: day dividers, the "New" line above the first unread message,
 * and each message marked with whether it starts a run.
 *
 * A run breaks on a new author, a new day, a gap longer than `RUN_WINDOW_MS`, and at the "New"
 * line — the line has to sit ABOVE a name, or the reader cannot tell who the new messages are from.
 */
export function layoutMessages(
  messages: ChatMessage[],
  opts: { me: ChatAuthor; lastReadAt: string | null; tz?: string; today?: string },
): ChatItem[] {
  const today = opts.today ?? isoDateIn(new Date(), opts.tz)!;
  const items: ChatItem[] = [];
  let prev: ChatMessage | null = null;
  let prevDay: string | null = null;
  let newPlaced = false;

  for (const m of chronological(messages)) {
    const day = isoDateIn(m.createdAt, opts.tz) ?? today;
    let broke = false;
    if (day !== prevDay) {
      items.push({ kind: 'day', key: `day:${day}`, label: dayLabel(day, today) });
      prevDay = day;
      broke = true;
    }
    if (!newPlaced && isUnread(m, opts.me, opts.lastReadAt)) {
      items.push({ kind: 'new', key: 'new' });
      newPlaced = true;
      broke = true;
    }
    const continues =
      !broke &&
      prev !== null &&
      prev.author === m.author &&
      prev.authorName === m.authorName &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <= RUN_WINDOW_MS;
    items.push({ kind: 'message', key: m.id, message: m, startsRun: !continues });
    prev = m;
  }
  return items;
}

/** How many of the other side's messages `me` has not read. Drives the sidebar count. */
export function unreadCount(messages: ChatMessage[], me: ChatAuthor, lastReadAt: string | null): number {
  return messages.filter((m) => isUnread(m, me, lastReadAt)).length;
}

// ── EDITING AND DELETING (C2) ──────────────────────────────────────────────

/**
 * What a deleted message's body is OVERWRITTEN with. Deleting is not hiding: the words are replaced
 * in the database, so the client's copy, a backup and a realtime payload all lose them too. The
 * constraint on the column (1..8000 characters) is why it is a placeholder and not an empty string.
 */
export const DELETED_BODY = '(deleted)';

/** You may edit or delete your own messages — once they exist, and while they still have words. */
export function canEdit(m: ChatMessage, me: ChatAuthor): boolean {
  return m.author === me && !m.deleted && !m.pending && !m.failed;
}

/** Slack's ↑: the newest message you could still edit, or null. */
export function lastEditable(messages: ChatMessage[], me: ChatAuthor): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) if (canEdit(messages[i], me)) return messages[i];
  return null;
}
