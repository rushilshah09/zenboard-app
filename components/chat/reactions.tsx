'use client';
// ── REACTIONS (chat C3) ────────────────────────────────────────────────────
//
// Slack's reactions, in the house's chrome. What each detail answers to:
//   · one pill per emoji under the message, in the order each was first used, with who is on it in
//     the tooltip ("You and Acme reacted with thumbs up");
//   · YOUR pills are the pressed ones — an edge and the selected wash. The house's pressed state is
//     ink, never the accent (the DS toggle rule), so a busy conversation is not sprinkled with berry;
//   · pressing ANY pill toggles your side on it: it adds you beside the other side, or takes yours
//     back — Slack's grammar, so there is nothing to learn;
//   · the three quick reactions ride in the message toolbar for one click (Slack's toolbar does the
//     same); the rest are one more click away, in a picker that grows from where you clicked;
//   · nothing moves beyond the house's wash and press. Reacting is a dozens-a-day act (Emil's
//     frequency rule), and the picker is the popover every other menu is, entrance included.

import * as React from 'react';
import { Smile } from '@/components/ds/icons';
import { Icon, IconButton, Popover, PopoverContent, PopoverTrigger, ToggleGroup, ToggleGroupItem, Tooltip } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { REACTIONS, REACTION_NAMES, reacted, reactionLabel, type ChatAuthor, type Reaction } from '@/lib/chat';

/** The one-click set in the message toolbar — the head of the allowlist, so the two can never drift. */
export const QUICK_REACTIONS = REACTIONS.slice(0, 3);

export type ReactionNames = { team: string; client: string };

/** The emojis MY side is on — the picker marks them pressed, as Slack's does. */
export function mineOf(reactions: Reaction[] | undefined, me: ChatAuthor): string[] {
  return (reactions ?? []).filter((r) => reacted(r, me)).map((r) => r.emoji);
}

/**
 * The picker: every reaction on offer, in a row. Arrow keys move between them (the group's roving
 * focus), Enter or a click picks, Escape closes — and closing hands focus back to whatever opened it.
 */
export function ReactionPicker({
  open, onOpenChange, mine, onPick, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mine: string[];
  onPick: (emoji: string) => void;
  /** The control that opens it. */
  children: React.ReactElement;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" className="min-w-0 p-1" aria-label="Add reaction">
        <ToggleGroup type="multiple" value={mine} loop aria-label="Reactions" className="gap-0.5">
          {REACTIONS.map((emoji) => (
            <ToggleGroupItem
              key={emoji}
              value={emoji}
              aria-label={REACTION_NAMES[emoji]}
              onClick={() => {
                onPick(emoji);
                onOpenChange(false);
              }}
              className="size-8 min-w-8 px-0 text-h3 leading-none"
            >
              {emoji}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}

/** The pills under a message, and the quiet "add" beside them. Renders nothing when there are none. */
export function ReactionPills({
  reactions, me, names, onToggle, pickerOpen, onPickerOpenChange,
}: {
  reactions: Reaction[];
  me: ChatAuthor;
  names: ReactionNames;
  onToggle: (emoji: string) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = reacted(r, me);
        const count = Number(r.team) + Number(r.client);
        const label = reactionLabel(r, me, names);
        return (
          <Tooltip key={r.emoji} content={label}>
            <button
              type="button"
              aria-pressed={mine}
              aria-label={`${label}. ${mine ? 'Press to take yours back' : 'Press to add yours'}`}
              onClick={() => onToggle(r.emoji)}
              className={cn(
                'focus-ring inline-flex h-6 items-center gap-1 rounded-full border px-2',
                mine
                  ? 'border-line-strong bg-surface-selected text-ink-900'
                  // A wash is a new ground: text on it steps up to ink-800 (CLAUDE.md).
                  : 'border-transparent bg-surface-fill text-ink-800 hover:border-line',
              )}
            >
              <span aria-hidden className="text-ui leading-none">{r.emoji}</span>
              <span aria-hidden className="text-meta font-medium tabular-nums">{count}</span>
            </button>
          </Tooltip>
        );
      })}
      <ReactionPicker open={pickerOpen} onOpenChange={onPickerOpenChange} mine={mineOf(reactions, me)} onPick={onToggle}>
        <IconButton
          label="Add reaction"
          size="xs"
          icon={<Icon icon={Smile} size={14} />}
          // Beside existing pills it is a second way in, so it stays quiet until the message is
          // hovered or focused — and stays put while its own picker is open.
          className={cn('rounded-full', !pickerOpen && 'reveal-on-hover')}
        />
      </ReactionPicker>
    </div>
  );
}
