// Habits — the dedicated tracker: a daily journal and a review surface. Auth via
// `requireUser()` in its loader. `?date=YYYY-MM-DD` walks days; the default is
// today in the USER's timezone, resolved by the loader.
import { loadHabitsBoard } from '@/lib/habits-data';
import { HabitsJournal } from '@/components/habits/habits-board';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date : undefined;
  const board = await loadHabitsBoard(date);
  // Keyed on the viewed day: walking the date navigator is a navigation to the
  // same route, so without this the mounted component keeps the previous day's
  // statuses in state and ignores the day the server just loaded.
  return (
    <>
      <PageStamp />
      <HabitsJournal key={board.date} board={board} />
    </>
  );
}
