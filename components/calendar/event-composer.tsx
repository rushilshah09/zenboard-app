'use client';
// Event composer — the rich Notion-style event popover. A floating card anchored
// near the clicked slot with: type, title, start/end + duration, all-day, timezone,
// repeat, participants, conferencing, location, description, calendar account,
// busy/visibility, and reminder. Title / start / end / all-day persist through the
// calendar's save path; the remaining fields are captured locally (Zenboard's
// calendar_events has no column for them yet) and match the design 1:1.
// Chrome is DS: DropdownMenu (type · reminder), Switch (all-day), Button (footer),
// IconButton (close). Event-colour dots are user content (the sanctioned inline case).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import {
  X, Trash2, Clock, Globe, RefreshCw, Users, Video, MapPin, AlignLeft, Bell, ChevronDown, Check, Eye, Notebook } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, Switch, Mark,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  TimePicker, OVERLAY_CLASS,
} from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { localTimezone } from '@/lib/calendar';
import { EVENT_COLORS, DEFAULT_EVENT_COLOR, swatch, type EventColorName } from '@/lib/event-color';

export type EditorValues = { title: string; date: string; start: string; end: string; allDay: boolean; color?: string };

const REMINDERS = ['At start of event', '5 min before', '10 min before', '30 min before', '1 hour before'];
const TYPES = ['Event', 'Birthday'];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
function durationLabel(start: string, end: string): string {
  let d = toMin(end) - toMin(start);
  if (d <= 0) d += 1440;
  const h = Math.floor(d / 60), m = d % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m} min`;
}

// One property row: leading icon + content, quiet until hovered.
//
// A row that DOES something renders a real <button>. It used to be a <div
// onClick> in every case, which meant "Participants", "Conferencing",
// "Location", "Description" and "Take notes" — the composer's whole action
// column — could not be reached by keyboard, took no focus ring, and announced
// as plain text to a screen reader. CLAUDE.md requires a visible
// focus-visible ring on every interactive element; a div can never satisfy it.
//
// Fixed here rather than at the eight call sites, so every row inherits it.
const EROW = 'flex min-h-8 items-center gap-2.5 rounded-sm px-2';
function Row({ icon, children, onClick, muted }: { icon: React.ComponentProps<typeof Icon>['icon']; children: React.ReactNode; onClick?: () => void; muted?: boolean }) {
  const inner = (
    <>
      <Icon icon={icon} size={16} className="shrink-0 text-ink-500" />
      <div className="min-w-0 flex-1 text-left text-ui">{children}</div>
    </>
  );
  const tone = muted ? 'text-ink-600' : 'text-ink-800';
  if (!onClick) {
    return <div className={cn(EROW, tone)}>{inner}</div>;
  }
  return (
    <button type="button" onClick={onClick}
      className={cn(EROW, tone, 'focus-ring w-full cursor-pointer transition-colors duration-fast hover:bg-surface-hover')}>
      {inner}
    </button>
  );
}

export function EventComposer({
  mode, initial, readOnly, anchor, onSave, onDelete, onClose, onColorChange, onTakeNotes,
}: {
  mode: 'create' | 'edit';
  initial: EditorValues;
  readOnly?: boolean;
  anchor?: { x: number; y: number } | null;
  onSave: (v: EditorValues) => void;
  onDelete: () => void;
  /**
   * PRODUCT_CONTEXT §14's first arrow — `calendar event → meeting`. Absent for
   * a new event: there is nothing to take notes ON until it exists.
   */
  onTakeNotes?: () => void;
  onClose: () => void;
  onColorChange?: (color: string) => void;
}) {
  // Mounted only while the composer is open; its close hands focus back to the
  // grid cell or chip that opened it.
  useFocusReturn();
  const [v, setV] = useState<EditorValues>(initial);
  const [type, setType] = useState(TYPES[0]);
  const [desc, setDesc] = useState('');
  const [reminder, setReminder] = useState(REMINDERS[3]);
  const [busy, setBusy] = useState(true);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // `origin`: the point it grows from — where it was opened, inside its own box (Emil: an anchored surface scales
  // from its trigger; only an unanchored one, a modal in all but name, grows from its centre).
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const tz = localTimezone();

  useEffect(() => { if (!readOnly) titleRef.current?.focus(); }, [readOnly]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Position near the anchor, clamped to the viewport; fall back to centered.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 12;
    if (anchor) {
      let left = anchor.x + 8, top = anchor.y;
      left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
      top = Math.min(Math.max(pad, top), window.innerHeight - h - pad);
      const ox = Math.min(Math.max(anchor.x - left, 0), w), oy = Math.min(Math.max(anchor.y - top, 0), h);
      setPos({ left, top, origin: `${Math.round(ox)}px ${Math.round(oy)}px` });
    } else {
      setPos({ left: (window.innerWidth - w) / 2, top: Math.max(pad, (window.innerHeight - h) / 2), origin: 'center' });
    }
  }, [anchor]);

  const set = (patch: Partial<EditorValues>) => setV((p) => ({ ...p, ...patch }));
  const canSave = v.title.trim().length > 0;
  const save = () => { if (canSave) onSave(v); };
  const curColor = (v.color as EventColorName) || DEFAULT_EVENT_COLOR;
  const pickColor = (c: EventColorName) => { set({ color: c }); onColorChange?.(c); }; // instant recolor

  return (
    <div onPointerDown={onClose} className="fixed inset-0 z-modal">
      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'New event' : 'Event'}
        className={cn(OVERLAY_CLASS, 'fixed max-h-[calc(100vh-24px)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto zb-enter animate-emerge')}
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden', transformOrigin: pos?.origin }}
      >
        {/* Header — type selector + close */}
        <div className="flex items-center gap-2 pb-2 pl-3 pr-2.5 pt-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus-ring inline-flex h-[26px] items-center gap-1.5 rounded-sm px-2 text-ui font-medium text-ink-800 transition-colors duration-fast hover:bg-surface-hover">
              {type} <Icon icon={ChevronDown} size={12} className="text-ink-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={type} onValueChange={setType}>
                {TYPES.map((t) => <DropdownMenuRadioItem key={t} value={t}>{t}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="flex-1" />
          <IconButton size="sm" variant="ghost" onClick={onClose} label="Close" icon={<Icon icon={X} size={16} />} />
        </div>

        <div className="px-3 pb-2">
          {/* Title */}
          <input data-chromeless ref={titleRef} value={v.title} disabled={readOnly}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save(); }}
            placeholder="Title" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="w-full border-0 bg-transparent px-2 pb-2.5 pt-1 text-title-4 text-ink-900 outline-none placeholder:text-ink-500" />

          {/* Time row */}
          {/* All-day DIMS the times, it does not replace them with the word
              "All-day". Swapping the row out moved everything below it and threw
              away the times you had already chosen, so un-ticking the box left
              you re-entering them — and Home's composer had made the opposite
              choice (it deleted the fields), which meant the same tick did two
              different things on two screens. Dimmed-and-inert is the one
              answer; the value survives the round trip. */}
          <Row icon={Clock}>
            <div className="flex flex-wrap items-center gap-2">
              <TimePicker aria-label="Start time" className="w-[104px]" value={v.start} disabled={readOnly || v.allDay} onValueChange={(t) => set({ start: t })} />
              <span className={cn('text-ui', v.allDay ? 'text-ink-500' : 'text-ink-500')}>→</span>
              <TimePicker aria-label="End time" className="w-[104px]" value={v.end} disabled={readOnly || v.allDay} onValueChange={(t) => set({ end: t })} durationFrom={v.start} />
              <span className={cn('text-meta', v.allDay ? 'text-ink-500' : 'text-ink-500')}>
                {v.allDay ? 'All-day' : durationLabel(v.start, v.end)}
              </span>
            </div>
          </Row>

          {/* All-day */}
          <div className={cn(EROW, 'justify-between')}>
            <span className="w-[15px] shrink-0" />
            <span className="flex-1 text-ui text-ink-800">All-day</span>
            <Switch checked={v.allDay} disabled={readOnly} aria-label="All-day" onCheckedChange={() => set({ allDay: !v.allDay })} />
          </div>
        </div>

        <div className="px-3 pb-1.5 pt-0.5">
          <Row icon={Globe} muted><span>{tz.gmt}{tz.city ? <> <b className="font-medium text-ink-800">{tz.city}</b></> : ''}</span></Row>
          <Row icon={RefreshCw} onClick={() => {}} muted>Repeat</Row>

          <div className="mx-2 my-1.5 h-px bg-line-soft" />

          {/* The meeting is where the conversation gets written down, and writing
              it down is what eventually produces tasks. Offering it from the
              event is the whole point: the alternative is opening Clients and
              retyping a title the calendar already knows. */}
          {mode === 'edit' && onTakeNotes && (
            <Row icon={Notebook} onClick={onTakeNotes}>Take notes</Row>
          )}
          <Row icon={Users} onClick={() => {}} muted>Participants</Row>
          <Row icon={Video} onClick={() => {}} muted>Conferencing</Row>
          <Row icon={MapPin} onClick={() => {}} muted>Location</Row>

          {/* Description */}
          <div className="flex gap-2.5 px-2 py-1">
            <Icon icon={AlignLeft} size={16} className="mt-1 shrink-0 text-ink-500" />
            <textarea data-chromeless value={desc} disabled={readOnly} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={1}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
              className="min-h-6 flex-1 resize-none border-0 bg-transparent text-ui leading-normal text-ink-900 outline-none placeholder:text-ink-500" />
          </div>

          <div className="mx-2 my-1.5 h-px bg-line-soft" />

          {/* Calendar account */}
          <div className={cn(EROW, 'justify-between')}>
            {/* The brand MARK, not an anonymous black square. This row names the
                calendar the event is saved to, and every other calendar in the
                app is identified by its own colour dot — so a plain ink square
                read as "a calendar whose colour happens to be black" rather
                than "this is Zenboard". */}
            <Mark size={14} className="ml-0.5 shrink-0" />
            <span className="flex-1 text-ui text-ink-800">Zenboard</span>
          </div>
          {/* Event color — Zenboard palette, Google-Calendar-style dots (user content) */}
          <div className="flex min-h-[var(--row-nav)] items-center gap-2.5 px-2">
            <span className="grid w-[15px] shrink-0 place-items-center">
              <span className="size-[13px] rounded-full" style={{ background: swatch(curColor) }} />
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_COLORS.map((c) => {
                const on = c === curColor;
                return (
                  <button key={c} type="button" disabled={readOnly} onClick={() => pickColor(c)} aria-label={`${c} color`} aria-pressed={on} title={c}
                    className="focus-ring grid size-[18px] place-items-center rounded-full transition-shadow duration-fast disabled:cursor-default"
                    style={{ background: swatch(c), boxShadow: on ? `0 0 0 2px var(--color-paper-2), 0 0 0 3.5px ${swatch(c)}` : 'none' }}>
                    {on && <Icon icon={Check} size={12} weight="bold" className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Busy / visibility */}
          <Row icon={Eye}>
            <button type="button" onClick={() => setBusy((b) => !b)} className="focus-ring rounded-xs text-ui text-ink-800">
              {busy ? 'Busy' : 'Free'} <span className="text-ink-500">· Default visibility</span>
            </button>
          </Row>
          {/* Reminder */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(EROW, 'focus-ring w-full cursor-pointer text-left transition-colors duration-fast hover:bg-surface-hover')}>
              <Icon icon={Bell} size={16} className="shrink-0 text-ink-500" />
              <span className="flex-1 text-ui text-ink-800">{reminder}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuRadioGroup value={reminder} onValueChange={setReminder}>
                {REMINDERS.map((r) => <DropdownMenuRadioItem key={r} value={r}>{r}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Footer — the DIALOG's verbs and nothing else: destroy on the left,
            dismiss and commit on the right. "Take notes" was added here and
            pushed Save 14px past the panel's 340px edge, where it was clipped
            (measured, not guessed). It was never a form verb anyway — it
            navigates away to a meeting — so it now sits with Participants and
            Conferencing in the body, which is the row language this composer
            already uses for "go somewhere else with this event". */}
        {!readOnly && (
          <div className="flex items-center gap-2 border-t border-line-soft px-3 py-2.5">
            {/* The DS default destructive: ghost, danger ink. Solid red is kept for confirm dialogs, and Save is the one
                filled button in view. */}
            {mode === 'edit' && <Button variant="dangerGhost" size="sm" icon={<Icon icon={Trash2} size={16} />} onClick={onDelete}>Delete</Button>}
            <div className="min-w-0 flex-1" />
            <Button variant="secondary" size="sm" className="shrink-0" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" className="shrink-0" disabled={!canSave} onClick={save}>Save</Button>
          </div>
        )}
      </div>
    </div>
  );
}
