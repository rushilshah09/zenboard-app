// The morning digest — master plan §7O channel 2, the last of the three.
//
// ── THE WHOLE ARGUMENT ──────────────────────────────────────────────────────
// §7O opens by saying notifications are how calm products become anxious ones,
// and then concedes that zero signal fails too. The digest is the compromise it
// lands on: **one message, once, in the morning**, containing the things you
// would want to know before you decided what to do — and then silence for the
// rest of the day.
//
// Everything here follows from that one sentence:
//
//   OPT-IN, never opt-out. A product that starts emailing you daily because you
//   signed up is the thing this section exists to argue against. `enabled`
//   defaults to false and nothing turns it on but a person.
//
//   AT MOST ONE A DAY, and only near the hour you chose. A digest that arrives
//   at 18:00 because a worker was down all morning is not a digest; "due today"
//   read at six in the evening is an accusation. Past the window it is dropped,
//   not queued — see DIGEST_WINDOW_MINUTES.
//
//   NOTHING TO SAY MEANS NOTHING IS SENT. A daily email that reads "nothing
//   today" every Tuesday teaches you to stop opening it, and then the Tuesday
//   that matters is unread too. `digestEmail` returns null rather than padding.
//
//   VACATION SILENCES IT, without losing anything. §7C and §7O both name
//   vacation mode; this is its first implementation, and it is a date, not a
//   toggle, because a toggle is something you forget to switch back.
//
// ── BENCHMARK (rule 7) ──────────────────────────────────────────────────────
// Basecamp's Always On / Work Can Wait is the reference: a schedule you set
// once, honoured by the whole product. Ours is narrower (one message, not a
// delivery window over all notifications) because there is only one message to
// schedule. Linear's inbox aggregates but does not summarise a DAY. Sunsama
// emails a daily plan, which is closest — but it emails the plan you already
// made, whereas this arrives BEFORE the plan and is meant to inform it, which
// is why it carries the capacity line rather than a schedule.
import { formatMinutes } from '@/lib/date';
import { onVacation } from '@/lib/vacation';
import { capacityHeadline, type Capacity } from '@/lib/capacity';
import { contentTodaySummary, type CalendarEntry } from '@/lib/content';

/** Where the digest's settings live in `profiles.preferences`. */
export const DIGEST_KEY = 'digest';

/**
 * How late the digest may still be delivered, in minutes after the chosen time.
 *
 * The same idea as the reminder worker's `WORKER_MAX_LATE_MS`: a message whose
 * whole value is that it arrives at the start of the day has no value once the
 * day is underway. Three hours is generous enough to survive a slow cron and a
 * clock-change, and short enough that nobody gets a "good morning" at teatime.
 */
export const DIGEST_WINDOW_MINUTES = 180;

/** 08:00 — before the 9:00 default work start, so it lands before the day does. */
export const DEFAULT_DIGEST_MINUTES = 8 * 60;

export type DigestPrefs = {
  /** Opt-IN. Nothing turns this on but a person. */
  enabled: boolean;
  /** When to send, as minutes from local midnight. */
  atMinutes: number;
  /**
   * Silent through this calendar date, inclusive. A DATE rather than a boolean:
   * a vacation toggle is something you forget to switch back, and then the
   * product is quietly broken in a way that looks like it is working.
   */
  vacationUntil: string | null;
  /**
   * The day the last digest went out. This is the CLAIM — the worker's
   * conditional update is guarded on it, so two overlapping runs cannot both
   * send. Never rendered to anyone.
   */
  lastSent: string | null;
};

export const DEFAULT_DIGEST_PREFS: DigestPrefs = {
  enabled: false,
  atMinutes: DEFAULT_DIGEST_MINUTES,
  vacationUntil: null,
  lastSent: null,
};

/** Digest settings out of the preferences jsonb, per field, never trusting shape. */
export function readDigestPrefs(preferences: unknown): DigestPrefs {
  const root = (preferences ?? {}) as Record<string, unknown>;
  const d = (root[DIGEST_KEY] ?? {}) as Record<string, unknown>;
  const at = Number(d.atMinutes);
  return {
    enabled: d.enabled === true,
    atMinutes: Number.isFinite(at) && at >= 0 && at < 1440 ? Math.floor(at) : DEFAULT_DIGEST_MINUTES,
    vacationUntil: isDay(d.vacationUntil) ? (d.vacationUntil as string) : null,
    lastSent: isDay(d.lastSent) ? (d.lastSent as string) : null,
  };
}

const isDay = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The jsonb fragment to merge back. `lastSent` is the worker's, not the UI's. */
export function writeDigestPrefs(p: Omit<DigestPrefs, 'lastSent'> & { lastSent?: string | null }): Record<string, unknown> {
  return {
    enabled: p.enabled,
    atMinutes: p.atMinutes,
    vacationUntil: p.vacationUntil,
    ...(p.lastSent !== undefined ? { lastSent: p.lastSent } : {}),
  };
}

/** Why a digest is not going out — so the worker can report without guessing. */
export type SkipReason = 'off' | 'vacation' | 'early' | 'late' | 'already-sent';

/**
 * Is this the moment to send this person's digest?
 *
 * Order matters: `off` and `vacation` are checked before the clock, because a
 * person who has turned it off should never be described as merely "early".
 */
export function digestDue(
  prefs: DigestPrefs,
  { today, nowMinutes }: { today: string; nowMinutes: number },
): { due: true } | { due: false; reason: SkipReason } {
  if (!prefs.enabled) return { due: false, reason: 'off' };
  if (onVacation(today, prefs.vacationUntil)) return { due: false, reason: 'vacation' };
  if (prefs.lastSent === today) return { due: false, reason: 'already-sent' };
  if (nowMinutes < prefs.atMinutes) return { due: false, reason: 'early' };
  if (nowMinutes > prefs.atMinutes + DIGEST_WINDOW_MINUTES) return { due: false, reason: 'late' };
  return { due: true };
}

// `vacationThrough` moved to lib/vacation.ts when the habits half landed — it
// was never digest-specific, and §7C's promise spans three surfaces. Re-exported
// so existing importers keep working.
export { vacationThrough } from '@/lib/vacation';

// ── The message ─────────────────────────────────────────────────────────────

export type DigestTask = { id: string; title: string; dueDate?: string | null };
export type DigestRequest = { id: string; title: string; projectId: string };
/** A meeting. `when` is already in the reader's zone — "09:30 – 10:15", or "All day". */
export type DigestMeeting = { title: string; when: string };

export type DigestInput = {
  /** Today's plan — scheduled today, or an undated ★ (lib/todays-plan.ts, the
   *  rule Home uses). The reason the message is worth opening. */
  today: DigestTask[];
  /** Past their due date and still open. */
  overdue: DigestTask[];
  /** Blocked by something unfinished (§7B, 0032). Empty when the migration is absent. */
  waitingOn: DigestTask[];
  /** Client requests that arrived while you were not working. */
  overnight: DigestRequest[];
  /** §7C's one sentence. Null when there is no plan to measure. */
  capacity: Capacity | null;
  /** What content today holds — shoots before publishes — from `contentToday`,
   *  the rule Home and the content calendar already share. A shoot day is the
   *  most immovable thing in a creator's week, and the digest used to be silent
   *  about it. */
  content: CalendarEntry[];
  /** Today's meetings, timebox twins excluded (they are tasks already listed). */
  meetings: DigestMeeting[];
};

/** Longest list first would bury the point; this is the reading order. */
const MAX_PER_SECTION = 7;

/**
 * The day as blocks of plain text — the one renderer for both surfaces that
 * describe a day in words: the morning email and the MCP `today` tool.
 *
 * ORDER IS DELIBERATE AND DIFFERS FROM §7O'S OWN LISTING. The plan lists "due
 * today, overdue, waiting-on, portal activity"; it reads as an inventory. Here
 * today comes first and carries the capacity line, then what is being made,
 * then what is late, then what is stuck, then what arrived. That is a plan for
 * a morning rather than a list of problems — and leading with overdue work is
 * precisely the anxious framing §7O spends its first sentence rejecting.
 *
 * MEETINGS ARE OPT-IN, and the email does not opt in. The digest arrives
 * before the plan and informs it, which is why it carries the capacity line
 * rather than a schedule — the calendar already IS the schedule. A model
 * answering "what am I doing today" has no calendar open, so for it the
 * meetings are the answer's spine.
 */
export function digestBlocks(
  input: DigestInput,
  origin: string,
  opts: { meetings?: boolean } = {},
): string[] {
  const { today, overdue, waitingOn, overnight, capacity, content, meetings } = input;
  const task = (t: DigestTask) => `• ${t.title}\n  ${origin}/tasks?task=${t.id}`;
  const request = (r: DigestRequest) => `• ${r.title}\n  ${origin}/projects/${r.projectId}`;
  const piece = (e: CalendarEntry) =>
    `• ${e.piece.title?.trim() || 'Untitled'} — ${e.kind === 'shoot' ? 'filming' : 'going out'}\n  ${origin}/content?piece=${e.piece.id}`;
  const meeting = (m: DigestMeeting) => `• ${m.when}  ${m.title}`;

  const blocks: string[] = [];

  if (today.length) {
    const head = `Today — ${today.length} ${today.length === 1 ? 'task' : 'tasks'}`;
    // The capacity line rides here and nowhere else: it is a claim about
    // today's list, so it belongs beside today's list.
    const line = capacity ? `\n${capacityHeadline(capacity)}.` : '';
    blocks.push(`${head}${line}\n\n${section(today, task)}`);
  }
  if (opts.meetings && meetings.length) {
    blocks.push(`Meetings — ${meetings.length}\n\n${section(meetings, meeting)}`);
  }
  if (content.length) {
    // The same one-line summary Home puts above its content section.
    blocks.push(`Content today — ${contentTodaySummary(content)}\n\n${section(content, piece)}`);
  }
  if (overdue.length) {
    blocks.push(`Overdue — ${overdue.length}\n\n${section(overdue, task)}`);
  }
  if (waitingOn.length) {
    blocks.push(`Waiting on something else — ${waitingOn.length}\n\n${section(waitingOn, task)}`);
  }
  if (overnight.length) {
    blocks.push(`From your clients — ${overnight.length} new\n\n${section(overnight, request)}`);
  }
  return blocks;
}

/**
 * The digest, or null when there is nothing worth an email.
 *
 * THE NULL IS THE FEATURE. A digest is only sent when something is actually
 * asking for the reader: work today, something being filmed or going out, work
 * late, or a client waiting. A capacity line alone, or three blocked tasks and
 * nothing else, is not a morning worth interrupting — and an email that arrives
 * every day regardless is one nobody reads by the second week.
 */
export function digestEmail(input: DigestInput, origin: string): { subject: string; text: string } | null {
  const { today, overdue, overnight, content } = input;
  const actionable = today.length + content.length + overdue.length + overnight.length;
  if (actionable === 0) return null;
  const blocks = digestBlocks(input, origin);
  return { subject: digestSubject(input), text: `${blocks.join('\n\n')}\n\n${origin}/today\n` };
}

/**
 * A subject line that is worth reading WITHOUT opening the mail — the whole
 * message in one clause, because most mornings that is all anyone reads.
 */
export function digestSubject({ today, overdue, overnight, capacity, content }: DigestInput): string {
  const parts: string[] = [];
  if (today.length) {
    parts.push(capacity && capacity.plannedMinutes > 0
      ? `${today.length} today (${formatMinutes(capacity.plannedMinutes)})`
      : `${today.length} today`);
  }
  const made = contentTodaySummary(content);
  if (made) parts.push(made);
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  if (overnight.length) parts.push(`${overnight.length} from clients`);
  return parts.join(' · ') || 'Your day';
}

/**
 * At most seven, then a count. A digest that lists forty overdue tasks is a
 * backlog report, and nobody acts on a backlog report before breakfast.
 */
function section<T>(items: T[], render: (item: T) => string): string {
  const shown = items.slice(0, MAX_PER_SECTION).map(render).join('\n');
  const rest = items.length - MAX_PER_SECTION;
  return rest > 0 ? `${shown}\n… and ${rest} more` : shown;
}
