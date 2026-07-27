// Unified natural-language task parser — the single grammar behind Quick
// Capture (C), the command palette (⌘K), and the Tasks composer. Parsing is
// never silent: every recognized token becomes a chip the UI must render, and
// any chip can be dismissed (its kind goes into `ignore`), which keeps the
// word as literal title text. One chip per kind; first match wins.
//
// Grammar:
//   when      today · tonight · tomorrow · tmr · weekday names (fri, friday)
//             · next week (→ next Monday)
//   due       by/due/before + (today | tomorrow | weekday | next week)
//   priority  !!! / !high / !urgent → high · !! / !med → med · !low → low
//   estimate  30m · ~30m · 45min · 2h · 1.5h
//   project   #name or @name (matched against the caller's project list)
//   repeat    every[!] [other|N] day/week/month/year/weekday/<weekday name>
//             · daily · everyday · weekdays · weekly · monthly · yearly
//             `every!` restarts the cadence from the completion day —
//             semantics live in lib/recurrence.ts (the recurrence contract)
//   inbox     inbox · someday (explicitly file to Inbox)

import { describeRecurrence, type Recurrence } from './recurrence';

export type ChipKind = 'when' | 'due' | 'priority' | 'estimate' | 'project' | 'repeat' | 'inbox';

export type ParsedChip = { kind: ChipKind; label: string };

export type ParsedTask = {
  title: string;
  chips: ParsedChip[];
  scheduledDate: string | null; // ISO — when I'll work on it
  dueDate: string | null;       // ISO — when it's owed
  priority: 'low' | 'med' | 'high' | null;
  estimateMinutes: number | null;
  projectId: string | null;
  projectName: string | null;
  isInbox: boolean;
  recurrence: Recurrence | null;
};

type ProjectRef = { id: string; name: string };

const isoOf = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const addDays = (n: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return d; };

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// Strictly future: on a Friday, "friday" means next Friday.
const nextDow = (idx: number) => { const today = new Date().getDay(); return addDays(((idx - today + 6) % 7) + 1); };

const dayLabel = (iso: string) => {
  const today = isoOf(new Date());
  if (iso === today) return 'Today';
  if (iso === isoOf(addDays(1))) return 'Tomorrow';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// A date phrase inside `due …` or standing alone as a "when".
const DATE_WORD = /(today|tonight|tomorrow|tmr|next\s+week|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)/i;

function resolveDateWord(w: string): string | null {
  const s = w.toLowerCase().replace(/\s+/g, ' ');
  if (s === 'today' || s === 'tonight') return isoOf(new Date());
  if (s === 'tomorrow' || s === 'tmr') return isoOf(addDays(1));
  if (s === 'next week') return isoOf(nextDow(1)); // next Monday
  const idx = DOW.findIndex((d) => d.startsWith(s.slice(0, 3)));
  return idx >= 0 ? isoOf(nextDow(idx)) : null;
}

export function parseTask(raw: string, projects: ProjectRef[] = [], ignore?: Set<ChipKind>): ParsedTask {
  let title = raw;
  const chips: ParsedChip[] = [];
  const skip = (k: ChipKind) => ignore?.has(k) ?? false;
  const out: ParsedTask = {
    title: raw.trim(), chips, scheduledDate: null, dueDate: null, priority: null,
    estimateMinutes: null, projectId: null, projectName: null, isInbox: false, recurrence: null,
  };
  const take = (m: RegExpMatchArray) => { title = title.slice(0, m.index!) + ' ' + title.slice(m.index! + m[0].length); };

  // due — must run before bare "when" so "by friday" isn't read as scheduling
  if (!skip('due')) {
    const m = title.match(new RegExp(`\\b(?:due|by|before)\\s+${DATE_WORD.source}\\b`, 'i'));
    if (m) { const iso = resolveDateWord(m[1]); if (iso) { out.dueDate = iso; chips.push({ kind: 'due', label: `Due ${dayLabel(iso)}` }); take(m); } }
  }

  // repeat — before "when" so "every friday" isn't consumed as a date.
  // `every!` = after-completion cadence; `other`/N = interval; a weekday name
  // anchors a weekly recurrence to that day (the anchor survives reschedules).
  if (!skip('repeat')) {
    let rec: Recurrence | null = null;
    let matched: RegExpMatchArray | null = null;
    const UNIT = 'days?|weekdays?|weeks?|months?|years?|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?';
    const m = title.match(new RegExp(`\\b(every!?)\\s+(?:(other)\\s+|(\\d+)\\s+)?(${UNIT})\\b`, 'i'));
    if (m) {
      const unit = m[4].toLowerCase();
      if (/^day/.test(unit)) rec = { freq: 'daily' };
      else if (/^weekday/.test(unit)) rec = { freq: 'weekdays' };
      else if (/^week/.test(unit)) rec = { freq: 'weekly' };
      else if (/^month/.test(unit)) rec = { freq: 'monthly' };
      else if (/^year/.test(unit)) rec = { freq: 'yearly' };
      else {
        const idx = DOW.findIndex((d) => d.startsWith(unit.slice(0, 3)));
        if (idx >= 0) rec = { freq: 'weekly', byday: idx };
      }
      if (rec) {
        const interval = m[2] ? 2 : m[3] ? parseInt(m[3], 10) : 1;
        if (interval >= 2 && rec.freq !== 'weekdays') rec.interval = interval;
        if (m[1].endsWith('!')) rec.afterCompletion = true;
        matched = m;
      }
    }
    if (!rec) {
      const W: [RegExp, Recurrence][] = [
        [/\b(daily|everyday)\b/i, { freq: 'daily' }],
        [/\bweekdays\b/i, { freq: 'weekdays' }],
        [/\bweekly\b/i, { freq: 'weekly' }],
        [/\bmonthly\b/i, { freq: 'monthly' }],
        [/\b(yearly|annually)\b/i, { freq: 'yearly' }],
      ];
      for (const [re, r] of W) { const w = title.match(re); if (w) { rec = { ...r }; matched = w; break; } }
    }
    if (rec && matched) { out.recurrence = rec; chips.push({ kind: 'repeat', label: describeRecurrence(rec) }); take(matched); }
  }

  // when
  if (!skip('when')) {
    const m = title.match(new RegExp(`\\b${DATE_WORD.source}\\b`, 'i'));
    if (m) { const iso = resolveDateWord(m[1]); if (iso) { out.scheduledDate = iso; chips.push({ kind: 'when', label: dayLabel(iso) }); take(m); } }
    // "every friday" names a day, so the first occurrence gets scheduled on it
    // (today counts). The chip keeps it visible; dismissing it reverts to Inbox.
    if (!out.scheduledDate && out.recurrence?.byday != null) {
      const d = addDays((out.recurrence.byday - new Date().getDay() + 7) % 7);
      out.scheduledDate = isoOf(d);
      chips.push({ kind: 'when', label: dayLabel(out.scheduledDate) });
    }
  }

  // explicit inbox
  if (!skip('inbox') && !out.scheduledDate) {
    const m = title.match(/\b(inbox|someday)\b/i);
    if (m) { out.isInbox = true; chips.push({ kind: 'inbox', label: 'Inbox' }); take(m); }
  }

  // priority
  if (!skip('priority')) {
    let m = title.match(/!!!|!high|!urgent/i);
    if (m) { out.priority = 'high'; chips.push({ kind: 'priority', label: 'High' }); take(m); }
    else if ((m = title.match(/!!|!med(?:ium)?/i))) { out.priority = 'med'; chips.push({ kind: 'priority', label: 'Medium' }); take(m); }
    else if ((m = title.match(/!low/i))) { out.priority = 'low'; chips.push({ kind: 'priority', label: 'Low' }); take(m); }
  }

  // estimate
  if (!skip('estimate')) {
    const m = title.match(/~?(\d+(?:\.\d+)?)\s?(h|hr|hrs|hours?|m|min|mins)\b/i);
    if (m) {
      const n = parseFloat(m[1]);
      out.estimateMinutes = /^h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
      chips.push({ kind: 'estimate', label: out.estimateMinutes >= 60 ? `${+(out.estimateMinutes / 60).toFixed(1)}h` : `${out.estimateMinutes}m` });
      take(m);
    }
  }

  // project — #name / @name, prefix or substring match against real projects
  if (!skip('project')) {
    const m = title.match(/[@#]([\w-]+)/);
    if (m) {
      const q = m[1].toLowerCase();
      const p = projects.find((x) => x.name.toLowerCase().startsWith(q)) ?? projects.find((x) => x.name.toLowerCase().includes(q));
      if (p) { out.projectId = p.id; out.projectName = p.name; chips.push({ kind: 'project', label: p.name }); take(m); }
    }
  }

  out.title = title.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  out.chips = chips;
  return out;
}

// One-line summary for compact surfaces (command palette row).
export const chipSummary = (p: ParsedTask) => p.chips.map((c) => c.label).join(' · ');
