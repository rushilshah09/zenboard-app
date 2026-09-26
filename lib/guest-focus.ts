// ── FOCUS BEFORE SIGNING IN ─────────────────────────────────────────────────
//
// The user, 2026-09-26: a focus session "without login", and "make this count: they log in to
// Zenboard and their sessions count". So the website lets anyone start a focus session, keeps what
// they finish on this device, and the first time they open Zenboard signed in, those sessions move
// into their account as focus time (a `time_entries` row each, source `timer`, not billable), and
// leave the device.
//
// The same rules are read on both sides: the site trims what it keeps, and the server re-checks
// everything it is handed, because anything in a browser's storage can be edited. What is accepted:
// at most 50 sessions, each 1 to 180 minutes, started in the last 30 days and not in the future,
// with a note of at most 120 characters.

export const GUEST_FOCUS_KEY = 'zb-guest-focus';

export type GuestSession = {
  /** When the session started (ISO). Also what makes an import idempotent: no two are the same. */
  startedAt: string;
  /** Minutes actually focused. */
  minutes: number;
  /** What the visitor said they were focusing on, if anything. */
  what: string;
};

export const GUEST_LIMITS = { sessions: 50, minMinutes: 1, maxMinutes: 180, what: 120, days: 30 } as const;

/** Only what the rules accept, clamped and de-duplicated, oldest first. */
export function sanitizeGuestSessions(input: unknown, now: Date): GuestSession[] {
  if (!Array.isArray(input)) return [];
  const oldest = now.getTime() - GUEST_LIMITS.days * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const out: GuestSession[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const at = typeof r.startedAt === 'string' ? Date.parse(r.startedAt) : NaN;
    const minutes = typeof r.minutes === 'number' ? Math.round(r.minutes) : NaN;
    if (!Number.isFinite(at) || at < oldest || at > now.getTime()) continue;
    if (!Number.isFinite(minutes) || minutes < GUEST_LIMITS.minMinutes || minutes > GUEST_LIMITS.maxMinutes) continue;
    const startedAt = new Date(at).toISOString();
    if (seen.has(startedAt)) continue;
    seen.add(startedAt);
    const what = typeof r.what === 'string' ? r.what.replace(/\s+/g, ' ').trim().slice(0, GUEST_LIMITS.what) : '';
    out.push({ startedAt, minutes, what });
  }
  out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return out.slice(-GUEST_LIMITS.sessions);
}

/** Reads what this device kept (never throws: storage may be blocked or edited). */
export function readGuestSessions(raw: string | null, now: Date): GuestSession[] {
  if (!raw) return [];
  try {
    return sanitizeGuestSessions(JSON.parse(raw), now);
  } catch {
    return [];
  }
}

/** Adds a finished session, keeping within the rules. */
export function addGuestSession(list: GuestSession[], session: GuestSession, now: Date): GuestSession[] {
  return sanitizeGuestSessions([...list, session], now);
}

/** How many sessions were finished on the same calendar day as `now`, in the visitor's own time. */
export function sessionsOnDay(list: GuestSession[], now: Date): number {
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = day(now);
  return list.filter((s) => day(new Date(s.startedAt)) === today).length;
}

/** The note a session is filed under in the account's focus time. */
export function focusNote(what: string): string {
  return what ? `Focus session · ${what}` : 'Focus session';
}

// ── THE CLOCK ────────────────────────────────────────────────────────────────
// Anchored to the wall clock rather than counted in ticks: a tab in the background runs its timers
// late or not at all, and a session read from `now` is right whenever it is looked at.

export type FocusClock = {
  /** When the session started (ms since the epoch). */
  startedAt: number;
  /** How long it was set for. */
  minutes: number;
  /** When it was paused, while it is; `null` while it runs. */
  pausedAt: number | null;
  /** Everything spent paused before now. */
  paused: number;
};

/** The lengths offered: a short one, the classic, and a long one. */
export const FOCUS_LENGTHS = [15, 25, 50] as const;

export const startClock = (now: number, minutes: number): FocusClock => ({ startedAt: now, minutes, pausedAt: null, paused: 0 });
export const pauseClock = (c: FocusClock, now: number): FocusClock => (c.pausedAt == null ? { ...c, pausedAt: now } : c);
export const resumeClock = (c: FocusClock, now: number): FocusClock =>
  c.pausedAt == null ? c : { ...c, paused: c.paused + Math.max(0, now - c.pausedAt), pausedAt: null };

/** Time actually spent focusing so far, never more than the session was set for. */
export function focusedMs(c: FocusClock, now: number): number {
  const spent = (c.pausedAt ?? now) - c.startedAt - c.paused;
  return Math.min(c.minutes * 60_000, Math.max(0, spent));
}

export const remainingMs = (c: FocusClock, now: number): number => c.minutes * 60_000 - focusedMs(c, now);

/** A countdown as it is read: minutes and seconds, the seconds rounded up so "0:00" means done. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The session a clock becomes when it ends: whole minutes focused, or nothing under a minute. */
export function sessionOf(c: FocusClock, now: number, what: string): GuestSession | null {
  const minutes = Math.round(focusedMs(c, now) / 60_000);
  return minutes >= GUEST_LIMITS.minMinutes ? { startedAt: new Date(c.startedAt).toISOString(), minutes, what } : null;
}

// ── OPENING IT ───────────────────────────────────────────────────────────────
// From anywhere on the site (the logo's menu today), without the opener knowing where the session
// lives: one window event, heard by the one `<GuestFocus />` each page mounts. The same shape as
// the cookie settings (lib/consent.ts `openCookieSettings`).

export const GUEST_FOCUS_OPEN = 'zb:guest-focus-open';
/** Opens the session; `what` fills in what it is about (the product preview's "Start focus" passes the
    highlight it was pressed on). */
export function openGuestFocus(what?: string): void {
  window.dispatchEvent(new CustomEvent(GUEST_FOCUS_OPEN, { detail: { what } }));
}
