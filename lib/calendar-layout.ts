// Where each timed event sits in its day column — the one rule the Day and Week grids draw from.
//
// Overlapping events used to split the column into equal lanes whatever their times: a 15-minute standup half an
// hour into a meeting took half the column, and the meeting's title — clear of the standup the whole time — was cut
// to "Des…", its time wrapped onto three lines (2026-09-21). Notion Calendar and Google Calendar STACK a later event
// on an earlier one instead, stepped in, whenever the earlier one's title row is already above it; only events that
// start close together need columns of their own. That is this rule, stated once and tested.
import { localISODate, minutesOfDay, type CalEvent } from '@/lib/calendar';

/** A later event this far past an earlier one's start leaves that one's title and time readable above it. */
export const CASCADE_MIN = 30;
/** How many levels a stack steps in before it stops stepping — past this, a card is as deep as it goes. */
export const MAX_DEPTH = 3;

/** An event's end, in minutes from its own day's midnight: an hour after an open start, midnight when it runs over. */
export function endMinutes(e: CalEvent): number {
  const start = minutesOfDay(e.starts_at);
  if (!e.ends_at) return Math.min(1440, start + 60);
  const end = new Date(e.ends_at);
  const sameLocalDay = localISODate(end) === localISODate(new Date(e.starts_at));
  return sameLocalDay ? end.getHours() * 60 + end.getMinutes() : 1440;
}

/**
 * `col` of `cols` columns, `span` columns wide (it widens into columns to its right that are free for its whole
 * time), and `depth` levels stacked over the events still running beneath it in its column.
 */
export type Placed = { e: CalEvent; col: number; cols: number; span: number; depth: number };

type Slot = { s: number; end: number; depth: number };

export function layoutDay(events: CalEvent[]): Placed[] {
  // By start, and the longer first on a tie — the long block is the one a short one should sit on.
  const sorted = [...events].sort((a, b) => minutesOfDay(a.starts_at) - minutesOfDay(b.starts_at) || endMinutes(b) - endMinutes(a));
  const out: Placed[] = [];
  let group: CalEvent[] = [];
  let groupEnd = -1;

  // One group at a time: events linked by overlap share a column count; a gap starts afresh at full width.
  const flush = () => {
    const columns: Slot[][] = [];
    const where = new Map<string, { col: number; slot: Slot }>();
    for (const e of group) {
      const s = minutesOfDay(e.starts_at);
      const end = endMinutes(e);
      // A column can take this event if everything still running in it started long enough ago to stay readable
      // above it. Of those, the shallowest wins (a free column before a stack), then the leftmost.
      let best: { col: number; depth: number } | null = null;
      for (let c = 0; c < columns.length; c++) {
        const running = columns[c].filter((x) => x.end > s);
        if (!running.every((x) => s - x.s >= CASCADE_MIN)) continue;
        const depth = running.length ? Math.min(MAX_DEPTH, Math.max(...running.map((x) => x.depth)) + 1) : 0;
        if (!best || depth < best.depth) best = { col: c, depth };
      }
      const col = best ? best.col : columns.push([]) - 1;
      const slot: Slot = { s, end, depth: best ? best.depth : 0 };
      columns[col].push(slot);
      where.set(e.id, { col, slot });
    }
    for (const e of group) {
      const { col, slot } = where.get(e.id)!;
      let span = 1;
      while (col + span < columns.length && !columns[col + span].some((x) => x.s < slot.end && x.end > slot.s)) span++;
      out.push({ e, col, cols: columns.length, span, depth: slot.depth });
    }
    group = [];
  };

  for (const e of sorted) {
    if (group.length && minutesOfDay(e.starts_at) >= groupEnd) { flush(); groupEnd = -1; }
    group.push(e);
    groupEnd = Math.max(groupEnd, endMinutes(e));
  }
  if (group.length) flush();
  return out;
}
