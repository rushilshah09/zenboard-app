// Week helpers. Everything is computed in UTC so day ids line up exactly with
// how tasks store `scheduled_date` (also UTC date strings).

export type WeekDay = {
  id: string;      // ISO date, e.g. "2026-06-17"
  label: string;   // "Mon"
  date: string;    // "Jun 17"
  today: boolean;
  past: boolean;
  weekend: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function getWeekDays(ref = new Date()): WeekDay[] {
  const todayStr = iso(ref);
  const utcDay = ref.getUTCDay(); // 0 = Sun … 6 = Sat
  const diffToMon = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + diffToMon));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
    const id = iso(d);
    const dow = d.getUTCDay();
    return {
      id,
      label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      today: id === todayStr,
      past: id < todayStr,
      weekend: dow === 0 || dow === 6,
    };
  });
}

export function weekRangeLabel(days: WeekDay[]): string {
  return `${days[0].date} – ${days[6].date}`;
}
