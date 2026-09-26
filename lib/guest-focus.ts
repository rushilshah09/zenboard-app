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
