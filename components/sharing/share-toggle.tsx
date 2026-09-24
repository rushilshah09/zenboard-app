'use client';
// THE control for "can the client see this?".
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// The rule lived in `lib/visibility.ts` and the UI did not. Four kinds of thing
// can reach a client and each was marked differently, or not at all:
//
//     tasks   a Switch row inside a share DRAWER you open on purpose
//     docs    a bespoke pill saying "Shared" / "Private"
//     files   nothing
//     streams nothing
//
// So marking work client-facing was a SECOND PASS: finish the task here, then
// go over there and remember to tick it. The friction was never the click, it
// was the context switch — intent has to be expressible at the moment you have
// it, on the row you are already looking at.
//
// One control, one wording, four surfaces. If a fifth shareable thing appears,
// it uses this and inherits every state below for free.
//
// ── THE THREE STATES, AND WHY THERE ARE THREE ───────────────────────────────
// `lib/visibility.ts` has TWO gates: the project shares this kind of thing at
// all, and this row was marked. That means "not visible" has two different
// causes and they need different fixes, so a two-state on/off control would be
// lying half the time:
//
//   shared      both gates open. The client sees this. Always rendered — a
//               thing being client-facing is a fact you need at a glance, not
//               on hover.
//   marked-off  you marked it, but the project's channel is switched off, so
//               the client sees nothing. ALSO always rendered: a silent
//               discrepancy between what you said and what happens is the
//               worst state this feature can be in, and the tooltip names the
//               switch to go and find.
//   internal    not marked. Quiet until you hover the row, like the highlight
//               star — an unmarked thing is the default and should not shout.
//
// ── SAFETY ─────────────────────────────────────────────────────────────────
// The label always reads from `lib/visibility.ts`. It never re-derives whether
// something is visible from a local boolean, because a control that disagrees
// with the projection is how you show a client something you thought was
// private.
import { Eye, EyeOff } from '@/components/ds/icons';
import { Icon, Tooltip } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { hiddenLabel, hiddenReason, isClientVisible, type ShareKind, type ShareChannels, type ShareableItem } from '@/lib/visibility';

export type ShareToggleState = 'shared' | 'marked-off' | 'internal';

/** The state of one row, from the one rule. Exported so lists can count. */
export function shareState(kind: ShareKind, item: ShareableItem, channels: ShareChannels): ShareToggleState {
  if (isClientVisible(kind, item, channels)) return 'shared';
  return hiddenReason(kind, item, channels) === 'channel-off' ? 'marked-off' : 'internal';
}

/** What each kind is called in a sentence, for the accessible name. */
const NOUN: Record<ShareKind, string> = { task: 'task', doc: 'document', file: 'file', update: 'update' };

export function ShareToggle({
  kind, item, channels, name, onToggle, disabled = false, className,
}: {
  kind: ShareKind;
  item: ShareableItem;
  channels: ShareChannels;
  /** The thing's own name, so the accessible label says which row this is. */
  name?: string;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const state = shareState(kind, item, channels);
  const on = item.client_visible === true;
  const what = name?.trim() ? `“${name.trim()}”` : `this ${NOUN[kind]}`;

  // The accessible name is the ACTION, not the state — `aria-pressed` carries
  // the state, and a button named "Client" tells a screen-reader user nothing
  // about what pressing it does.
  const label = on ? `Stop sharing ${what} with the client` : `Share ${what} with the client`;
  const tooltip =
    state === 'marked-off'
      ? hiddenLabel('channel-off', kind)
      : state === 'shared'
        ? 'The client can see this'
        : 'Only your team can see this';

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(!on); }}
        aria-label={label}
        aria-pressed={on}
        disabled={disabled}
        className={cn(
          // One width for every state so toggling never moves the row, and the
          // column of chips down a list stays a column.
          'focus-ring touch-min inline-flex h-6 min-w-[74px] shrink-0 items-center justify-center gap-1 rounded-sm border px-1.5',
          // In a NARROW CONTAINER the word goes and the eye stays: a square
          // 24px chip. At 375px the worded pill was ~a quarter of a task row and
          // left the title six characters. The eye / eye-slash and the filled
          // "shared" ground still say which state this is; the accessible name
          // was always the action, so nothing is lost to a screen reader.
          // Container-scoped, so a pill with no narrow ancestor is unchanged.
          '@max-md:min-w-6 @max-md:px-0',
          'text-meta font-medium transition-colors duration-fast',
          state === 'shared' && 'border-line-strong bg-surface-selected text-ink-900',
          // Dashed: the mark is real but not in effect. Reads as provisional
          // rather than as a third colour nobody has a name for.
          state === 'marked-off' && 'border-dashed border-line-strong text-ink-500',
          state === 'internal' && 'reveal-on-hover border-line-soft text-ink-500 hover:border-line-strong hover:bg-surface-hover hover:text-ink-800',
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
      >
        <Icon icon={on ? Eye : EyeOff} size={12} />
        <span className="@max-md:sr-only">{on ? 'Client' : 'Internal'}</span>
      </button>
    </Tooltip>
  );
}
