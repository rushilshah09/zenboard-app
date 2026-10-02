'use client';
// THE BLOCK PICKER — how a question is added, and how one becomes another kind.
//
// Tally's insert is a search: you press "/", type "sca", press Enter, and the
// linear scale is there — hands never leave the keys. It was a plain list here,
// twenty rows tall with no search and no keyboard of its own, which is fine at
// eight kinds of question and a chore at twenty-two.
//
// So it is the DS command list in the house popover: typing filters, arrows
// move, Enter picks, Escape closes — the grammar of every other searchable list
// in the product. Each row wears its kind's glyph (block-icons.ts) so the eye can
// find "the one with the stars" before the hand has typed anything.
//
// "Change to" offers only kinds of the same family: a question can become any
// other question, a heading can become text. Turning a question into a divider
// would throw its words away, and nobody means that.
import { Check } from '@/components/ds/icons';
import { Icon, Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ds/ui';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ds/ui/command';
import { BLOCK_ICON } from '@/components/forms/block-icons';
import { BLOCK_META, FIELD_GROUPS, isField, type FormBlockType } from '@/lib/form-schema';

const ALL = Object.keys(BLOCK_META) as FormBlockType[];

/** What can stand in for a block of this type without losing what was written in it. */
function compatible(current: FormBlockType | undefined): FormBlockType[] {
  if (!current) return ALL;
  if (isField(current)) return ALL.filter((t) => isField(t));
  return ALL.filter((t) => t === 'heading' || t === 'statement');
}

export function BlockPicker({
  open, onOpenChange, onPick, current, children, anchorOnly = false, align = 'start',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: FormBlockType) => void;
  /** Set when CHANGING a block's type: marks it, and narrows the list to its family. */
  current?: FormBlockType;
  /** What the picker opens from. */
  children: React.ReactNode;
  /**
   * The child is only where the picker HANGS, not what opens it — a question's label, which
   * opens the picker on "/" while the caret stays in it. A trigger there would open on every click.
   */
  anchorOnly?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  const offered = compatible(current);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchorOnly ? <PopoverAnchor asChild>{children}</PopoverAnchor> : <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent flush align={align} className="w-[288px] overflow-hidden">
        <Command loop className="rounded-none bg-transparent">
          <CommandInput placeholder={current ? 'Change to…' : 'Search question types…'} aria-label="Search question types" />
          <CommandList className="max-h-[min(380px,60dvh)] p-1">
            <CommandEmpty className="py-6 text-center text-ui text-ink-500">No kind of question matches.</CommandEmpty>
            {FIELD_GROUPS.map((group) => {
              const types = offered.filter((t) => BLOCK_META[t].group === group);
              if (types.length === 0) return null;
              return (
                <CommandGroup key={group} heading={group}>
                  {types.map((t) => (
                    <CommandItem
                      key={t}
                      // The words cmdk searches: the name, its hint, and the group, so "date" finds Time too.
                      value={`${BLOCK_META[t].label} ${BLOCK_META[t].hint ?? ''} ${group}`}
                      onSelect={() => { onPick(t); onOpenChange(false); }}
                      className="h-8 gap-2.5 text-ui text-ink-800"
                    >
                      <Icon icon={BLOCK_ICON[t]} size={16} className="text-ink-600" />
                      <span className="min-w-0 flex-1 truncate">{BLOCK_META[t].label}</span>
                      {current === t
                        ? <Icon icon={Check} size={14} className="text-ink-700" />
                        : BLOCK_META[t].hint && <span className="truncate text-meta text-ink-500">{BLOCK_META[t].hint}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
