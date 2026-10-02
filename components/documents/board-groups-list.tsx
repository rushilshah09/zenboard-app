'use client';
// A board's columns, listed in its settings — Notion's Group page: a handle to move
// a column, its chip, and an eye to take it off the board or put it back. The list
// is every column the board CAN have (`boardGroupList`), so a column that holds
// nothing yet can still be placed and hidden.
//
// Moving a column here writes the view's `groupOrder`, the order the board and a
// grouped table both draw. The handle, the keyboard and the spoken names are the
// one re-orderable list's (sortable-list.tsx).
import { Eye, EyeOff } from '@/components/ds/icons';
import { Button, Icon, IconButton } from '@/components/ds/ui';
import type { BoardGroup } from '@/lib/board';
import { OptionChip } from './option-chip';
import { SortableList } from './sortable-list';

export function BoardGroupsList({ groups, hidden, status, onReorder, onHidden }: {
  groups: BoardGroup[];
  /** Keys of the columns taken off the board. */
  hidden: string[];
  /** Grouped by a status — its chips are pills with a dot. */
  status: boolean;
  onReorder: (keys: string[]) => void;
  onHidden: (keys: string[]) => void;
}) {
  const keys = groups.map((g) => g.key);
  const allHidden = groups.length > 0 && groups.every((g) => hidden.includes(g.key));
  return (
    <div>
      <div className="flex h-8 items-center justify-between px-2">
        <span className="text-overline text-ink-500">Groups</span>
        <Button variant="ghost" size="xs" onClick={() => onHidden(allHidden ? [] : keys)}>{allHidden ? 'Show all' : 'Hide all'}</Button>
      </div>
      <SortableList
        items={groups.map((g) => ({ ...g, id: g.key, name: g.label }))}
        noun="group"
        onReorder={onReorder}
        rowClassName="flex h-8 items-center gap-1 rounded-sm px-1"
        renderRow={(g, handle) => {
          const off = hidden.includes(g.key);
          return (
            <>
              {handle}
              <span className="flex min-w-0 flex-1 items-center">
                {g.option ? <OptionChip opt={g.option} status={status} /> : <span className="truncate text-ui text-ink-700">{g.label}</span>}
              </span>
              {/* The eye says it: open while the column is on the board, shut while it is off. */}
              <IconButton size="xs" label={off ? `Show ${g.label}` : `Hide ${g.label}`}
                className={off ? 'text-ink-500' : 'text-ink-800'}
                icon={<Icon icon={off ? EyeOff : Eye} size={16} />}
                onClick={() => onHidden(off ? hidden.filter((k) => k !== g.key) : [...hidden, g.key])} />
            </>
          );
        }}
      />
    </div>
  );
}
