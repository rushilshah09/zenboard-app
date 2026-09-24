import 'server-only';
import { cache } from 'react';
import { currentProfile } from '@/lib/profile';
import { readTimeZone } from '@/lib/date';

// The user's IANA timezone, for turning "now" into a CALENDAR DATE on the server.
//
// Why this exists: day ids (`scheduled_date`, `log_date`, `ritual_date`) are
// calendar dates, and the server cannot derive one on its own — on Cloudflare it
// runs in UTC, so for an IST user it is still on yesterday's date until 05:30
// local. Every server loader that asked `new Date()` what day it was got the
// wrong answer for part of every night.
//
// The zone is written by <TimezoneSync> from the browser (the one place that
// actually knows) into `profiles.preferences.timezone`, and read back through
// `readTimeZone` (lib/date.ts) — the one reader, shared with the two callers
// that have no session to ask with: the digest worker and the MCP route.
// `cache()`d because a single render asks for the zone repeatedly — the page's
// loader, then each helper that needs to name a day — and every ask was a
// `profiles` round trip. It cannot change mid-request.
export const userTimezone = cache(async (): Promise<string> => {
  try {
    const profile = await currentProfile();
    return readTimeZone(profile?.preferences);
  } catch {
    return 'UTC';
  }
});
