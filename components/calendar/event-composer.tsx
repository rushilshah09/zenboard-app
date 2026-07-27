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
import {
  X, Trash2, Clock, Globe, RefreshCw, Users, Video, MapPin, AlignLeft, Bell, ChevronDown, Check, Eye } from "@/components/ds/icons";
import {
  Icon, Button, IconButton, Switch,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ds/ui";
import { cn } from "@/lib/cn";
import { TimePicker } from '@/components/calendar/time-picker';
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
const EROW = 'flex min-h-8 items-center gap-2.5 rounded-sm px-2';
function Row({ icon, children, onClick, muted }: { icon: React.ComponentProps<typeof Icon>['icon']; children: React.ReactNode; onClick?: () => void; muted?: boolean }) {
  return (
    <div onClick={onClick}
      className={cn(EROW, onClick && 'cursor-pointer transition-colors duration-fast hover:bg-surface-hover', muted ? 'text-ink-600' : 'text-ink-800')}>
      <Icon icon={icon} size={16} className="shrink-0 text-ink-500" />
      <div className="min-w-0 flex-1 text-ui">{children}</div>
    </div>
  );
}

export function EventComposer({
  mode, initial, readOnly, anchor, onSave, onDelete, onClose, onColorChange,
}: {
  mode: 'create' | 'edit';
  initial: EditorValues;
  readOnly?: boolean;
  anchor?: { x: number; y: number } | null;
  onSave: (v: EditorValues) => void;
  onDelete: () => void;
  onClose: () => void;
  onColorChange?: (color: string) => void;
}) {
  const [v, setV] = useState<EditorValues>(initial);
  const [type, setType] = useState(TYPES[0]);
  const [desc, setDesc] = useState('');
  const [reminder, setReminder] = useState(REMINDERS[3]);
  const [busy, setBusy] = useState(true);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
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
      left = Math.min(left, window.innerWidth - w - pad);
      top = Math.min(Math.max(pad, top), window.innerHeight - h - pad);
      setPos({ left: Math.max(pad, left), top });
    } else {
      setPos({ left: (window.innerWidth - w) / 2, top: Math.max(pad, (window.innerHeight - h) / 2) });
    }
  }, [anchor]);

  const set = (patch: Partial<EditorValues>) => setV((p) => ({ ...p, ...patch }));
  const canSave = v.title.trim().length > 0;
  const save = () => { if (canSave) onSave(v); };
  const curColor = (v.color as EventColorName) || DEFAULT_EVENT_COLOR;
  const pickColor = (c: EventColorName) => { set({ color: c }); onColorChange?.(c); }; // instant recolor

  return (
    <div onPointerDown={onClose} className="fixed inset-0 z-[120]">
      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'New event' : 'Event'}
        className="fixed max-h-[calc(100vh-24px)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-line-strong bg-paper-2 shadow-lift-2 animate-emerge"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
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
          <input ref={titleRef} value={v.title} disabled={readOnly}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) save(); }}
            placeholder="Title" autoComplete="off" data-1p-ignore data-lpignore="true"
            className="w-full border-0 bg-transparent px-2 pb-2.5 pt-1 text-title-4 text-ink-900 outline-none placeholder:text-ink-400" />

          {/* Time row */}
          <Row icon={Clock}>
            {v.allDay ? (
              <span className="text-ink-600">All-day</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <TimePicker value={v.start} disabled={readOnly} onChange={(t) => set({ start: t })} />
                <span className="text-ui text-ink-500">→</span>
                <TimePicker value={v.end} disabled={readOnly} onChange={(t) => set({ end: t })} durationFrom={v.start} />
                <span className="text-meta text-ink-500">{durationLabel(v.start, v.end)}</span>
              </div>
            )}
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

          <Row icon={Users} onClick={() => {}} muted>Participants</Row>
          <Row icon={Video} onClick={() => {}} muted>Conferencing</Row>
          <Row icon={MapPin} onClick={() => {}} muted>Location</Row>

          {/* Description */}
          <div className="flex gap-2.5 px-2 py-1">
            <Icon icon={AlignLeft} size={16} className="mt-1 shrink-0 text-ink-500" />
            <textarea value={desc} disabled={readOnly} onChange={(e) => setDesc(e.target.value)} placeholder="Description" rows={1}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
              className="min-h-6 flex-1 resize-none border-0 bg-transparent text-ui leading-normal text-ink-900 outline-none placeholder:text-ink-400" />
          </div>

          <div className="mx-2 my-1.5 h-px bg-line-soft" />

          {/* Calendar account */}
          <div className={cn(EROW, 'justify-between')}>
            <span aria-hidden className="ml-0.5 inline-block size-3 shrink-0 rounded-[3px] bg-ink-900" />
            <span className="flex-1 text-ui text-ink-800">Zenboard</span>
          </div>
          {/* Event color — Zenboard palette, Google-Calendar-style dots (user content) */}
          <div className="flex min-h-[34px] items-center gap-2.5 px-2">
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

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center gap-2 border-t border-line-soft px-3 py-2.5">
            {mode === 'edit' && <Button variant="danger" size="sm" icon={<Icon icon={Trash2} size={16} />} onClick={onDelete}>Delete</Button>}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!canSave} onClick={save}>Save</Button>
          </div>
        )}
      </div>
    </div>
  );
}
