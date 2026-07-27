// Habits — the dedicated tracker (the Habitify-inspired journal). Auth is
// enforced by the (app) layout. `?date=YYYY-MM-DD` walks days; default is today.
import { loadHabitsBoard } from '@/lib/habits-data';
import { HabitsJournal } from '@/components/habits/habits-board';

export const dynamic = 'force-dynamic';

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date : undefined;
  const board = await loadHabitsBoard(date);
  return <HabitsJournal board={board} />;
}
