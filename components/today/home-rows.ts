// The geometry every list on Home shares — the plan's task rows, Waiting, Content, Schedule and Habits.
//
// Every section on Home is a card (`Panel` with its header band — the user's call, 2026-09-22). Inside the cards the
// rows used to be four heights: tasks 36px, waiting and content 41px (`py-2.5` + a hand-drawn top border), habits
// 48px (`py-3`, 15px type), schedule entries ~100px (a title, a duration pill, a time line and a "Google Calendar"
// chip). They now share one surface — the same `rowSurface` the task row uses — so a row is a row in every card.
import { rowSurface } from '@/components/tasks/row-surface';

/** The space between two cards on Home — one number, where the cards had `mb-6` and `mb-8` by turns. */
export const HOME_SECTION = 'mt-6';

/** One Home list row: `--row-task` tall, the panel inset, a hairline between rows, the row wash. */
export function homeRow(last: boolean) {
  return rowSurface({ last, heightClass: 'h-[var(--row-task)]', padding: 'items-center gap-3 px-[var(--panel-px)]' });
}
