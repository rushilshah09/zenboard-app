// ICS (RFC 5545) serializer — principle 11: every object has an exit. Pure +
// tested (lib/ics.test.ts). The /api/export/calendar route fetches RLS-scoped
// calendar_events and streams the result as a .ics file any calendar app
// (Apple, Google, Outlook) can import — the calendar's half of "own your data",
// mirroring the CSV export in lib/export.ts.

export type IcsEvent = {
  id: string;
  title: string | null;
  starts_at: string;        // ISO timestamp
  ends_at: string | null;   // ISO timestamp; defaults to +1h (timed) / +1 day (all-day)
  all_day: boolean;
};

// RFC 5545 §3.3.11 — escape backslash, semicolon, comma, and newlines in TEXT
// values (SUMMARY etc.). Order matters: backslash first.
export function icsText(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.1 — fold content lines longer than 75 chars: CRLF then a single
// leading space on each continuation (the space counts toward the next 75).
// Folds on characters; typical calendar content is ASCII so this stays within
// the octet limit, and parsers unfold by stripping the CRLF+space regardless.
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const size = i === 0 ? 75 : 74;
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + size));
    i += size;
  }
  return parts.join('\r\n');
}

const p2 = (n: number) => String(n).padStart(2, '0');

// Timed events → UTC timestamp (YYYYMMDDTHHMMSSZ).
function utcStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

// All-day events → floating DATE (YYYYMMDD), no time or zone.
function dateStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
}

const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
function addDaysUTC(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function eventsToIcs(events: IcsEvent[], calendarName = 'Zenboard', now = new Date()): string {
  const stamp = utcStamp(now.toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zenboard//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(calendarName)}`,
  ];
  for (const e of events) {
    if (!e.starts_at) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@zenboard.app`); // RFC 5545 requires a globally-unique UID
    lines.push(`DTSTAMP:${stamp}`);
    if (e.all_day) {
      const start = dateStamp(e.starts_at);
      // DTEND is exclusive; default a one-day span, and never emit end <= start.
      let end = e.ends_at ? dateStamp(e.ends_at) : '';
      if (!end || end <= start) end = dateStamp(addDaysUTC(e.starts_at, 1));
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${utcStamp(e.starts_at)}`);
      lines.push(`DTEND:${utcStamp(e.ends_at ?? addHours(e.starts_at, 1))}`);
    }
    lines.push(`SUMMARY:${icsText(e.title || 'Untitled')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
