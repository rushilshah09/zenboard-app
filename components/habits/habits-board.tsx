'use client';
// The redesigned Habits page — a Habitify-inspired daily JOURNAL, built entirely
// in the Zenboard DS (no Fitbit/Strava, no AI). Habits group by TIME OF DAY;
// each day can be Completed or Skipped; a date navigator walks days; a richer
// "New habit" form sets time-of-day + goal. Progress analytics + Areas are
// phased follow-ups. Degrades gracefully before migration 0025 (all habits show
// under "Any time"; skip falls back to a plain uncheck).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Clock, Flame, Plus, ChevronLeft, ChevronRight, type IconType } from '@/components/ds/icons';
import { Icon, Button, Checkbox, Badge, EmptyState, Modal, Field, TextInput, SegmentedControl, toast } from '@/components/ds/ui';
import { ViewContainer } from '@/components/ui/view-container';
import { addHabit, setHabitStatus } from '@/lib/actions/habits';
import type { HabitsBoard, BoardHabit, TimeOfDay, HabitStatus } from '@/lib/habits-data';
import { cn } from '@/lib/cn';

const GROUPS: { key: TimeOfDay; label: string; icon: IconType }[] = [
  { key: 'morning', label: 'Morning', icon: Sun },
  { key: 'afternoon', label: 'Afternoon', icon: Sun },
  { key: 'evening', label: 'Evening', icon: Moon },
  { key: 'any', label: 'Any time', icon: Clock },
];
const TOD_OPTIONS = [
  { value: 'any', label: 'Any time' }, { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' },
];
const PERIOD_OPTIONS = [{ value: 'day', label: 'per day' }, { value: 'week', label: 'per week' }];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
function fmtDate(day: string): string {
  const today = iso(new Date());
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function goalLabel(h: BoardHabit): string | null {
  if (h.goalTarget <= 1 && h.goalPeriod === 'day') return null;
  return `${h.goalTarget}×/${h.goalPeriod === 'week' ? 'week' : 'day'}`;
}

export function HabitsJournal({ board }: { board: HabitsBoard }) {
  const router = useRouter();
  const [habits, setHabits] = useState<BoardHabit[]>(board.habits);
  useEffect(() => { setHabits(board.habits); }, [board.habits]);
  const [addOpen, setAddOpen] = useState(false);

  const today = iso(new Date());
  const isToday = board.date === today;
  const isFuture = board.date > today;
  const doneCount = habits.filter((h) => h.status === 'done').length;

  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: habits.filter((h) => h.timeOfDay === g.key) })).filter((g) => g.items.length > 0),
    [habits],
  );

  function goto(day: string) { router.push(day === today ? '/habits' : `/habits?date=${day}`); }

  function setStatus(id: string, next: HabitStatus) {
    if (isFuture) return; // can't log a day that hasn't happened
    const prev = habits.find((h) => h.id === id);
    if (!prev) return;
    const streak = next === 'done' && prev.status !== 'done' ? prev.streak + 1
      : next !== 'done' && prev.status === 'done' ? Math.max(0, prev.streak - 1)
      : prev.streak;
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, status: next, streak } : h)));
    setHabitStatus(id, next, board.date).then((r) => {
      if ('error' in r) { setHabits((hs) => hs.map((h) => (h.id === id ? prev : h))); toast({ message: r.error, variant: 'error' }); }
    });
  }

  return (
    <ViewContainer className="pt-[var(--view-pt)] pb-[var(--view-pb)]">
      {/* Header: date navigator · summary · new habit */}
      <div className="mb-[var(--view-gap)] flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button aria-label="Previous day" onClick={() => goto(addDays(board.date, -1))}
            className="focus-ring grid size-8 place-items-center rounded-md text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900">
            <Icon icon={ChevronLeft} size={16} />
          </button>
          <button onClick={() => goto(today)} className="focus-ring min-w-[92px] rounded-md px-2 py-1 text-center text-h4 text-ink-900 transition-colors hover:bg-surface-hover">
            {fmtDate(board.date)}
          </button>
          <button aria-label="Next day" disabled={isToday} onClick={() => goto(addDays(board.date, 1))}
            className="focus-ring grid size-8 place-items-center rounded-md text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900 disabled:opacity-30">
            <Icon icon={ChevronRight} size={16} />
          </button>
        </div>
        <span className="flex-1" />
        {habits.length > 0 && <span className="text-caption tabular-nums text-ink-500">{doneCount}/{habits.length} done</span>}
        <Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>New habit</Button>
      </div>

      {board.error ? (
        <div className="py-2 text-ui text-danger-600">Couldn’t load your habits. Try refreshing.</div>
      ) : habits.length === 0 ? (
        <EmptyState
          illustration={<Icon icon={Flame} size={20} />}
          title="No habits yet"
          description="Build a rhythm — small things, done daily. Group them by time of day and keep the streak going."
          primary={<Button variant="primary" icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>New habit</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-caption font-medium uppercase tracking-[0.04em] text-ink-500">
                <Icon icon={g.icon} size={13} /> {g.label}
                <span className="tabular-nums text-ink-400">{g.items.filter((h) => h.status === 'done').length}/{g.items.length}</span>
              </div>
              <div className={cn('overflow-hidden rounded-lg border border-line-soft bg-surface-raised')}>
                {g.items.map((h, i) => {
                  const gl = goalLabel(h);
                  return (
                    <div key={h.id} className={cn('group/hb flex items-center gap-3 px-3.5 py-2.5', i < g.items.length - 1 && 'border-b border-line-soft')}>
                      <Checkbox size="md" checked={h.status === 'done'} disabled={isFuture}
                        onCheckedChange={() => setStatus(h.id, h.status === 'done' ? 'none' : 'done')}
                        aria-label={h.status === 'done' ? `Uncheck ${h.title}` : `Complete ${h.title}`} />
                      <span className={cn('min-w-0 flex-1 truncate text-ui', h.status === 'done' ? 'text-ink-500 line-through' : h.status === 'skipped' ? 'text-ink-500' : 'text-ink-900')}>{h.title}</span>
                      {gl && <span className="shrink-0 text-caption tabular-nums text-ink-500">{gl}</span>}
                      {h.status === 'skipped' ? (
                        <button onClick={() => setStatus(h.id, 'none')} className="focus-ring rounded-sm" aria-label={`Clear skip on ${h.title}`}>
                          <Badge status="neutral">Skipped</Badge>
                        </button>
                      ) : (
                        !isFuture && h.status !== 'done' && (
                          <button onClick={() => setStatus(h.id, 'skipped')}
                            className="focus-ring shrink-0 rounded-sm px-1.5 py-0.5 text-caption text-ink-500 opacity-0 transition-opacity hover:text-ink-900 focus-visible:opacity-100 group-hover/hb:opacity-100">
                            Skip
                          </button>
                        )
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 text-meta text-ink-500" title={`${h.streak}-day streak`}>
                        <Icon icon={Flame} size={14} /><span className="tabular-nums">{h.streak}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!board.supported && (
            <p className="text-caption text-ink-500">Apply migration 0025 to group habits by time of day and skip days.</p>
          )}
        </div>
      )}

      <NewHabitModal open={addOpen} onOpenChange={setAddOpen} onCreate={(h) => {
        const tmp = 'tmp-' + Date.now();
        setHabits((hs) => [...hs, { id: tmp, title: h.title, timeOfDay: h.timeOfDay, goalTarget: h.goalTarget, goalPeriod: h.goalPeriod, color: null, status: 'none', streak: 0 }]);
        addHabit(h.title, { timeOfDay: h.timeOfDay, goalTarget: h.goalTarget, goalPeriod: h.goalPeriod }).then((res) => {
          if ('id' in res) setHabits((hs) => hs.map((x) => (x.id === tmp ? { ...x, id: res.id } : x)));
          else { setHabits((hs) => hs.filter((x) => x.id !== tmp)); toast({ message: res.error, variant: 'error' }); }
        });
      }} />
    </ViewContainer>
  );
}

function NewHabitModal({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onCreate: (h: { title: string; timeOfDay: TimeOfDay; goalTarget: number; goalPeriod: 'day' | 'week' }) => void;
}) {
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const [goalTarget, setGoalTarget] = useState(1);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week'>('day');
  useEffect(() => { if (open) { setTitle(''); setTimeOfDay('any'); setGoalTarget(1); setGoalPeriod('day'); } }, [open]);

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onCreate({ title: t, timeOfDay, goalTarget: Math.max(1, goalTarget), goalPeriod });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title="New habit" dirty={!!title.trim()}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!title.trim()} onClick={submit}>Create habit</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Morning walk" autoComplete="off" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field label="Time of day">
          <SegmentedControl aria-label="Time of day" value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as TimeOfDay)} options={TOD_OPTIONS} />
        </Field>
        <Field label="Goal">
          <div className="flex items-center gap-2">
            <TextInput type="number" min={1} value={String(goalTarget)} onChange={(e) => setGoalTarget(parseInt(e.target.value, 10) || 1)} className="w-20" aria-label="Goal times" />
            <span className="text-ui text-ink-500">times</span>
            <div className="min-w-0 flex-1"><SegmentedControl aria-label="Goal period" value={goalPeriod} onValueChange={(v) => setGoalPeriod(v as 'day' | 'week')} options={PERIOD_OPTIONS} /></div>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
