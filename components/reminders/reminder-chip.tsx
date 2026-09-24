'use client';
// The Remind chip — master plan §7B ("remind_at (one)"). Set, change or clear a
// task's one reminder. The rules are in lib/reminders.ts; the write is
// lib/actions/reminders.ts; this is the surface.
//
// BENCHMARK (rule 7). Linear's "Remind me" is a flat preset list plus a custom
// field, opened from the issue and closed by choosing. Notion attaches the
// reminder to a date property, so its menu is relative offsets ("1 day before")
// and needs a date to exist first. Todoist gives a task several reminders and
// therefore needs a modal to hold them.
//
// Ours matches Linear's speed (one keystroke path, closes on choose) and adds
// what Linear cannot offer: when the task already has an hour — a timebox block
// (0030) or a scheduled day — those anchors come FIRST, because "ten minutes
// before the thing" is the reminder people actually want and every other
// product makes you compute it yourself.
//
// It DELIBERATELY differs from all three on count: one reminder per task, never
// a list. That is §7B's frozen anatomy, and it is why this is a chip rather
// than a section.
import * as React from 'react';
import { Bell, Check, X } from '@/components/ds/icons';
import { Icon, MenuField } from '@/components/ds/ui';
import { Pop, chipClass, popRow, popLabel, POP_ROW_CLASS } from '@/components/task-detail/chip-ui';
import { reminderPresets, reminderLabel, reminderStatus, type ReminderContext } from '@/lib/reminders';
import { formatDayTime } from '@/lib/date';
import { loadNaturalDate, naturalDateParser, parseNaturalDate } from '@/lib/natural-date';

export type ReminderChipProps = {
  remindAt: string | null;
  remindedAt?: string | null;
  /** What the task brings to the presets — its block, its scheduled day. */
  context?: ReminderContext;
  onSet: (iso: string) => void;
  onClear: () => void;
};

export function ReminderChip({ remindAt, remindedAt, context, onSet, onClear }: ReminderChipProps) {
  const status = reminderStatus({ remind_at: remindAt, reminded_at: remindedAt });
  const label = reminderLabel(remindAt) ?? 'Remind';

  return (
    <Pop
      width={252}
      label="Reminder"
      trigger={(_open, props) => (
        <button
          {...props}
          className={chipClass(status !== 'none')}
          // The chip's own text is the time, which does not say what it IS. A
          // screen reader gets the whole sentence.
          aria-label={status === 'none' ? 'Add a reminder' : `Reminder ${label}${status === 'delivered' ? ', delivered' : ''}`}
        >
          <Icon icon={Bell} size={14} />
          {label}
          {/* Delivered reminders keep their time but stop looking pending —
              a tick, not a colour, so it reads the same in either theme. */}
          {status === 'delivered' && <Icon icon={Check} size={12} style={{ color: 'var(--text-secondary)' }} />}
        </button>
      )}
    >
      {(close) => (
        <ReminderMenu
          remindAt={remindAt}
          context={context}
          onPick={(iso) => { onSet(iso); close(); }}
          onClear={() => { onClear(); close(); }}
        />
      )}
    </Pop>
  );
}

function ReminderMenu({
  remindAt, context, onPick, onClear,
}: {
  remindAt: string | null;
  context?: ReminderContext;
  onPick: (iso: string) => void;
  onClear: () => void;
}) {
  // Fixed at open. The panel is a decision that takes seconds, and a `now` that
  // ticked underneath it would let "In 30 minutes" mean something different
  // from what it said when it was read.
  const now = React.useMemo(() => new Date(), []);
  const presets = React.useMemo(() => reminderPresets(now, context ?? {}), [now, context]);
  const anchored = presets.filter((p) => p.group === 'task');
  const soon = presets.filter((p) => p.group === 'soon');

  const [draft, setDraft] = React.useState('');
  // Natural language, the same bet the DS date-picker makes ("the input ACCEPTS
  // TYPING") and the same parser. `forwardDate` is what makes "8am" typed at
  // 9am mean tomorrow morning rather than an hour that has already gone.
  //
  // Parsed in the handler, not in a memo: the reference clock must be the
  // moment you typed, not the moment the panel opened, or a panel left open
  // over lunch reads "in 10 minutes" as an hour ago. Render stays pure.
  const [parsed, setParsed] = React.useState<{ at: string; future: boolean } | null>(null);
  // The parser loads as this panel opens (lib/natural-date.ts), so it is almost
  // always here before the first keystroke. If not, the text is read once it
  // arrives, unless a later keystroke has replaced it.
  const typed = React.useRef('');
  React.useEffect(() => { void loadNaturalDate(); }, []);
  const onDraft = (value: string) => {
    setDraft(value);
    typed.current = value;
    const s = value.trim();
    if (!s) { setParsed(null); return; }
    const typedAt = new Date();
    const read = (at: Date | null) => setParsed(at ? { at: at.toISOString(), future: at.getTime() > Date.now() } : null);
    const chrono = naturalDateParser();
    if (chrono) { read(chrono.parseDate(s, typedAt, { forwardDate: true })); return; }
    void parseNaturalDate(s, typedAt, { forwardDate: true }).then((at) => { if (typed.current === value) read(at); });
  };

  const commitDraft = () => { if (parsed?.future) onPick(parsed.at); };

  const row = (id: string, label: string, detail: string, at: string) => (
    <button
      key={id}
      className={POP_ROW_CLASS}
      style={{ ...popRow, gap: 10 }}
      onClick={() => onPick(at)}
      // Named explicitly rather than left to name-from-content: the row is two
      // separate spans, and "Tomorrow" without "9:00 AM" is half a choice.
      aria-label={`${label}, ${detail}`}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flexShrink: 0, fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }} className="num">{detail}</span>
    </button>
  );

  return (
    <div>
      {/* Headings appear only when there are two groups to tell apart — a
          single list of five does not need to be told it is a list. */}
      {anchored.length > 0 && (
        <>
          <span style={popLabel}>This task</span>
          {anchored.map((p) => row(p.id, p.label, p.detail, p.at))}
          <span style={{ ...popLabel, paddingTop: 6 }}>From now</span>
        </>
      )}
      {soon.map((p) => row(p.id, p.label, p.detail, p.at))}

      <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 6, paddingTop: 6 }}>
        {/* A field inside a panel is the DS `MenuField` (the overlay-chrome directive): the wash as its ground, the house placeholder ink, the caret as its focus. */}
        <MenuField
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } }}
          placeholder="or type: friday 9am"
          aria-label="Reminder time"
        />
        {draft.trim() && (
          <div style={{ padding: '0 8px 4px', fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)' }}>
            {!parsed
              ? 'Not a time we can read.'
              : !parsed.future
                ? 'That time has already passed.'
                : (
                  <button
                    className={POP_ROW_CLASS}
                    style={{ ...popRow, padding: '4px 0', color: 'var(--ink)' }}
                    onClick={commitDraft}
                  >
                    <Icon icon={Check} size={12} />
                    {formatDayTime(parsed.at)}
                  </button>
                )}
          </div>
        )}
      </div>

      {remindAt && (
        <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 4, paddingTop: 4 }}>
          <button className={POP_ROW_CLASS} style={popRow} onClick={onClear}>
            <Icon icon={X} size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            Remove reminder
          </button>
        </div>
      )}
    </div>
  );
}
