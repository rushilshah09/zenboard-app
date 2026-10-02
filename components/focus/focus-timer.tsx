'use client';
// Focus timer — a persistent, draggable floating widget (Figma "Tracker").
//
// It lives once in the app shell so it survives every client-side navigation,
// and rehydrates from localStorage so a running session continues across a full
// refresh (timing is anchored to an absolute epoch, never a running counter).
//
// The centrepiece is the numbered tick-dial from the Figma: a ring of 120 fine
// ticks that light up clockwise from 12 o'clock as the session progresses, a
// twelve-value minute face (1·3·5·10·15·20·25·30·35·45·60·90), the time in the
// well, and a play/pause control. Below sits a collapsible "Today" task list
// (the Figma "Task ⌄" bar). The whole thing drags anywhere, snaps to edges,
// resizes, minimises to a pill, and honours Space / Esc / double-click / right-
// click. Everything is monochrome DS tokens — the only "accent" is the ink-white
// progress arc, per the one-accent rule.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { toggleTask, addTask, deleteTask, rescheduleTask } from '@/lib/actions/tasks';
import { signalTaskToggle, playFocusChime, playFocusResume, playFocusTick, initTaskSound } from '@/lib/sound';
import { useLatest } from '@/lib/use-latest';
import { useResync } from '@/lib/use-resync';
import {
  Icon, IconSwap, IconButton, Checkbox, PriorityBars, SegmentedControl, Switch, toastReverted,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ds/ui';
import {
  Play, Pause, RotateCcw, SkipForward, Minus, Maximize2, Minimize2, ExternalLink, X, Settings,
  ChevronUp, ChevronDown, Plus, Ellipsis, Trash, Inbox, Volume2, VolumeX, Folder,
} from '@/components/ds/icons';
import { scopeFill } from '@/lib/entity-color';

// ── Model ─────────────────────────────────────────────────────────────────────
type Mode = 'pomodoro' | 'countdown' | 'stopwatch';
type Phase = 'focus' | 'break';
type Size = 'sm' | 'md' | 'lg';

type Persist = {
  open: boolean;
  collapsed: boolean;         // minimised to the pill
  size: Size;
  pos: { x: number; y: number } | null; // top-left in px; null = default bottom-right
  taskOpen: boolean;
  mode: Mode;
  phase: Phase;               // pomodoro only
  focusMin: number;
  breakMin: number;
  countdownMin: number;
  running: boolean;
  anchor: number | null;      // epoch ms the current running segment started
  baseElapsed: number;        // seconds elapsed in this phase before `anchor`
  sessions: number;           // completed focus sessions
  sessionsDate: string;       // ISO date `sessions`/`focusSec` belong to
  focusSec: number;           // accumulated focus seconds today
  autostart: boolean;
  silent: boolean;
  activeTaskId: string | null;
};

const KEY = 'zb:focus:v1';
const NUMS = [1, 3, 5, 10, 15, 20, 25, 30, 35, 45, 60, 90];
const TICKS = 120;

const SIZES: Record<Size, { w: number; dial: number; time: number; play: number }> = {
  sm: { w: 320, dial: 258, time: 26, play: 34 },
  md: { w: 400, dial: 336, time: 33, play: 40 },
  lg: { w: 480, dial: 412, time: 41, play: 46 },
};
const MODES: { value: Mode; label: string }[] = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'stopwatch', label: 'Stopwatch' },
];
const LENGTHS = [5, 15, 25, 45, 60];
const BREAKS = [5, 10, 15];
const MARGIN = 16;   // viewport gutter for clamping + snapping
const SNAP = 22;     // snap-to-edge threshold

const DEFAULTS: Persist = {
  open: false, collapsed: false, size: 'md', pos: null, taskOpen: true,
  mode: 'pomodoro', phase: 'focus', focusMin: 25, breakMin: 5, countdownMin: 25,
  running: false, anchor: null, baseElapsed: 0,
  sessions: 0, sessionsDate: '', focusSec: 0,
  autostart: false, silent: false, activeTaskId: null,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
function localDateISO(d = new Date()): string {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pad = (n: number) => String(n).padStart(2, '0');

function targetOf(s: Persist): number {
  if (s.mode === 'stopwatch') return Infinity;
  if (s.mode === 'countdown') return s.countdownMin * 60;
  return (s.phase === 'focus' ? s.focusMin : s.breakMin) * 60;
}
function elapsedOf(s: Persist, now: number): number {
  return s.baseElapsed + (s.running && s.anchor ? (now - s.anchor) / 1000 : 0);
}
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
function humanDur(sec: number): string {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}
// The printed face is non-linear: the twelve NUMS sit at even 30° steps but their
// VALUES jump (1·3·5·10·…·90). Drag-to-set maps the pointer angle onto that same
// face so the handle lands on the number you're pointing at, and the running arc
// depletes along it — a physical kitchen-timer feel rather than a linear clock.
function angleForMinutes(m: number): number {
  if (m <= NUMS[0]) return 0;
  if (m >= NUMS[NUMS.length - 1]) return (NUMS.length - 1) * 30; // 330°, the "90" mark
  for (let i = 0; i < NUMS.length - 1; i++) {
    if (m <= NUMS[i + 1]) return i * 30 + 30 * ((m - NUMS[i]) / (NUMS[i + 1] - NUMS[i]));
  }
  return (NUMS.length - 1) * 30;
}
function minutesForAngle(deg: number): number {
  const max = (NUMS.length - 1) * 30; // 330°
  if (deg >= max) return NUMS[NUMS.length - 1]; // the wedge past "90" clamps to 90
  const i = Math.min(NUMS.length - 2, Math.floor(deg / 30));
  const frac = (deg - i * 30) / 30;
  const m = NUMS[i] + frac * (NUMS[i + 1] - NUMS[i]);
  return Math.max(1, Math.min(90, Math.round(m)));   // snap to whole minutes
}

function load(): Persist {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persist>) };
  } catch { return DEFAULTS; }
}

// ── Document Picture-in-Picture ───────────────────────────────────────────────
// The one way a sandboxed web page can float a panel ABOVE other native apps
// (Figma, VS Code, …): the browser-provided always-on-top PiP window (Chromium
// 116+). We portal the live widget into it and mirror the app's stylesheets +
// theme so every DS token still resolves inside the separate document.
type DocumentPiP = { requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window> };
function getPiP(): DocumentPiP | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}
function mirrorInto(win: Window) {
  const doc = win.document;
  const root = document.documentElement;
  doc.documentElement.className = root.className;
  const rootStyle = root.getAttribute('style');
  if (rootStyle) doc.documentElement.setAttribute('style', rootStyle);
  const theme = root.getAttribute('data-theme');
  if (theme) doc.documentElement.setAttribute('data-theme', theme);
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      const style = doc.createElement('style');
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      const href = (sheet as CSSStyleSheet).href;
      if (href) { const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = href; doc.head.appendChild(link); }
    }
  }
  doc.body.style.margin = '0';
  doc.body.style.background = 'var(--canvas)';
  doc.body.style.color = 'var(--color-ink-900)';
  doc.body.style.fontFamily = getComputedStyle(document.body).fontFamily;
  (doc.body.style as CSSStyleDeclaration).colorScheme = 'dark';
}

// ── Task data ─────────────────────────────────────────────────────────────────
type TaskRow = { id: string; title: string; done: boolean; priority: 'low' | 'med' | 'high'; project_id: string | null };
type ProjMap = Record<string, { name: string; color: string | null }>;

// Completed tasks sink to the bottom; open tasks keep their board order.
const orderTasks = (rows: TaskRow[]) =>
  [...rows].sort((a, b) => Number(a.done) - Number(b.done));

// ── Dial ──────────────────────────────────────────────────────────────────────
// SVG (viewBox 200) scaled to the current dial px. Ticks + numbers are drawn in
// SVG; the time + controls sit as real DOM in a centred overlay so they stay
// keyboard-accessible.
function Dial({ px, progress, showKnob, knobActive, accent = 'var(--color-ink-900)' }: {
  px: number; progress: number; showKnob?: boolean; knobActive?: boolean;
  /** Colour of the LIT part of the face — the filled ticks and the handle. Comes
   *  from `runAccent` so the dial says at a glance whether time is moving. */
  accent?: string;
}) {
  const C = 100, numR = 90, tOut = 79, tIn = 67;
  const ka = (progress * 360 - 90) * (Math.PI / 180);
  const kr = (tOut + tIn) / 2;
  const kx = C + kr * Math.cos(ka), ky = C + kr * Math.sin(ka);
  const ticks = useMemo(() => Array.from({ length: TICKS }, (_, i) => {
    const frac = i / TICKS;
    const a = (frac * 360 - 90) * (Math.PI / 180);
    const cos = Math.cos(a), sin = Math.sin(a);
    return {
      x1: C + tIn * cos, y1: C + tIn * sin, x2: C + tOut * cos, y2: C + tOut * sin,
      on: frac <= progress + 1e-6,
    };
  }), [progress]);
  return (
    <svg width={px} height={px} viewBox="0 0 200 200" aria-hidden style={{ display: 'block' }}>
      <circle cx={C} cy={C} r={62} fill="none" stroke="var(--line)" strokeWidth={0.75} opacity={0.6} />
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.on ? accent : 'var(--line)'}
          strokeWidth={t.on ? 1.7 : 1.15} strokeLinecap="round"
          style={{ transition: 'stroke var(--duration-base) var(--ease-hover)' }} />
      ))}
      {NUMS.map((n, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        return (
          <text key={n} x={C + numR * Math.cos(a)} y={C + numR * Math.sin(a)}
            textAnchor="middle" dominantBaseline="central"
            fontSize={7.4} fill="var(--color-ink-500)"
            style={{ fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            {n}
          </text>
        );
      })}
      {/* Draggable handle — the tip of the filled arc (Apple-Clock style). */}
      {showKnob && (
        <>
          {knobActive && <circle cx={kx} cy={ky} r={13} fill={accent} opacity={0.16} />}
          <circle cx={kx} cy={ky} r={knobActive ? 7 : 5.5} fill={accent} stroke="var(--canvas)" strokeWidth={1.5}
            style={{ transition: 'fill var(--duration-base) var(--ease-hover)' }} />
        </>
      )}
    </svg>
  );
}

// ── Row in the task list ────────────────────────────────────────────────────
function TaskItem({ t, proj, active, onToggle, onSelect, onDelete, onInbox }: {
  t: TaskRow; proj?: { name: string; color: string | null }; active: boolean;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onInbox: (id: string) => void;
}) {
  return (
    <div className="group/row" data-nodrag
      style={{
        display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 10, alignItems: 'flex-start',
        background: active ? 'var(--color-surface-selected)' : 'transparent',
        transition: 'background var(--duration-fast) var(--ease-hover)',
      }}>
      <div style={{ paddingTop: 1 }}>
        <Checkbox checked={t.done} onCheckedChange={(v) => onToggle(t.id, v === true)}
          aria-label={t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`} />
      </div>
      <button onClick={() => onSelect(t.id)} data-nodrag
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent',
          cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
        <span style={{
          fontSize: 13, lineHeight: 1.3, color: t.done ? 'var(--color-ink-500)' : 'var(--color-ink-900)',
          textDecoration: t.done ? 'line-through' : 'none', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>{t.title}</span>
        {(proj || t.priority !== 'low') && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {proj && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-ink-500)' }}>
                <Icon icon={Folder} size={12} style={{ color: scopeFill(proj.color, 'var(--color-ink-500)') }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{proj.name}</span>
              </span>
            )}
            {t.priority !== 'low' && <PriorityBars level={t.priority} size={11} />}
          </span>
        )}
      </button>
      <div className="opacity-0 group-hover/row:opacity-100 focus-within:opacity-100" style={{ transition: 'opacity var(--duration-fast) var(--ease-hover)' }} data-nodrag>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Task actions" className="zb-press"
              style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--color-ink-500)' }}>
              <Icon icon={Ellipsis} size={16} />
            </button>
          </DropdownMenuTrigger>
          {/* The panel floats at z-index 90; the DS menu defaults to z-dropdown
              (40), so without this it opens BEHIND the timer. Lift it above. */}
          <DropdownMenuContent align="end">
            <DropdownMenuItem icon={<Icon icon={Inbox} size={16} />} onSelect={() => onInbox(t.id)}>Move to inbox</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger icon={<Icon icon={Trash} size={16} />} onSelect={() => onDelete(t.id)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export function FocusTimer({ activeSpaceId, embedded = false, demoTasks }: { activeSpaceId?: string; embedded?: boolean; demoTasks?: TaskRow[] }) {
  const [mounted, setMounted] = useState(false);
  const [st, setStRaw] = useState<Persist>(DEFAULTS);
  const stRef = useLatest(st);
  // The 250ms tick while running. This used to be a dummy counter (`force`)
  // whose only job was to re-render, while the render body read `Date.now()`
  // directly — so the value the whole dial is derived from was an impure read
  // during render. Ticking the timestamp ITSELF makes it state: same re-render,
  // but every frame now renders from a value React owns.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const pipWinRef = useLatest(pipWin);
  const pipSupported = typeof window !== 'undefined' && !!getPiP();

  // Persisted setState.
  const setSt = useCallback((next: Persist | ((p: Persist) => Persist)) => {
    setStRaw((prev) => {
      const v = typeof next === 'function' ? (next as (p: Persist) => Persist)(prev) : next;
      try { window.localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage off */ }
      return v;
    });
  }, []);

  // Never earlier than the anchor. `elapsedOf` ignores `now` while the timer is
  // paused, so a stale tick is harmless there — but the instant `running` flips
  // true the anchor is fresh and the last tick is not, and `now - anchor` would
  // render NEGATIVE until the first interval fired 250ms later. Clamping says
  // that in one expression, without an effect to seed it.
  const now = Math.max(nowMs, st.anchor ?? 0);
  const target = targetOf(st);
  const elapsed = elapsedOf(st, now);
  const remaining = st.mode === 'stopwatch' ? elapsed : Math.max(0, target - elapsed);
  // The dial reads like a physical timer: the filled arc + handle sit at the
  // remaining time on the non-linear face, so it winds DOWN toward 12 o'clock as
  // it runs (and, when idle, shows the set duration you can drag to change).
  const progress = st.mode === 'stopwatch'
    ? Math.min(1, elapsed / 3600)
    : angleForMinutes(remaining / 60) / 360;
  const todaySessions = st.sessionsDate === localDateISO() ? st.sessions : 0;
  const todayFocus = st.sessionsDate === localDateISO() ? st.focusSec : 0;

  // Advance at the end of a phase (fires from the tick loop and on rehydrate).
  const complete = useCallback((chime = true) => {
    const d = localDateISO();
    setSt((prev) => {
      if (prev.mode === 'stopwatch') return prev;
      const curSessions = prev.sessionsDate === d ? prev.sessions : 0;
      const curFocus = prev.sessionsDate === d ? prev.focusSec : 0;
      if (prev.mode === 'countdown') {
        return { ...prev, running: false, anchor: null, baseElapsed: prev.countdownMin * 60,
          sessions: curSessions + 1, sessionsDate: d, focusSec: curFocus + prev.countdownMin * 60 };
      }
      const wasFocus = prev.phase === 'focus';
      const startNext = prev.autostart;
      return {
        ...prev,
        phase: wasFocus ? 'break' : 'focus',
        baseElapsed: 0,
        running: startNext,
        anchor: startNext ? Date.now() : null,
        sessions: curSessions + (wasFocus ? 1 : 0),
        sessionsDate: d,
        focusSec: curFocus + (wasFocus ? prev.focusMin * 60 : 0),
      };
    });
    if (chime && !stRef.current.silent) (stRef.current.phase === 'focus' ? playFocusChime : playFocusResume)();
  }, [setSt]);

  // Hydrate + reconcile a session that ended while the app was away.
  useEffect(() => {
    const loaded = load();
    setStRaw(loaded);
    setMounted(true);
    if (embedded) initTaskSound(); // shell isn't present in the overlay route
    if (loaded.running && loaded.mode !== 'stopwatch' && elapsedOf(loaded, Date.now()) >= targetOf(loaded)) {
      // resolve silently on return — the moment already passed
      setTimeout(() => complete(false), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick loop — advance the clock every 250ms while running, and fire completion.
  useEffect(() => {
    if (!st.running) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      const s = stRef.current;
      // Completion still reads the real clock: this runs in a callback, not in
      // render, and it must not be a frame behind the state it is checking.
      if (s.running && s.mode !== 'stopwatch' && elapsedOf(s, Date.now()) >= targetOf(s)) complete();
    }, 250);
    return () => window.clearInterval(id);
  }, [st.running, st.mode, st.phase, complete]);

  // Launcher (topbar timer button) toggles visibility.
  useEffect(() => {
    const openToggle = () => setSt((p) => {
      if (p.open && !p.collapsed) { try { pipWinRef.current?.close(); } catch { /* noop */ } return { ...p, open: false }; }
      return { ...p, open: true, collapsed: false };
    });
    window.addEventListener('zb:toggle-focus', openToggle);
    return () => window.removeEventListener('zb:toggle-focus', openToggle);
  }, [setSt]);

  // Close the PiP window if the whole widget unmounts (e.g. resize → mobile).
  useEffect(() => () => { try { pipWinRef.current?.close(); } catch { /* noop */ } }, []);

  // ── Controls ──
  const toggleRun = useCallback(() => setSt((p) => {
    if (p.running) return { ...p, running: false, anchor: null, baseElapsed: elapsedOf(p, Date.now()) };
    return { ...p, running: true, anchor: Date.now() };
  }), [setSt]);
  const reset = useCallback(() => setSt((p) => ({ ...p, running: false, anchor: null, baseElapsed: 0 })), [setSt]);

  // ── Run state → colour ──
  // ONE derivation, used by the lit ticks, the handle and the play button, so
  // the three can never disagree about what the timer is doing.
  //
  //   idle     the dial is showing a duration you haven't started  → neutral ink
  //   running  time is moving                                      → warning (yellow)
  //   paused   a session exists but is stopped                     → danger (red)
  //
  // "Cancelled" lands back on `idle` on purpose: reset clears `baseElapsed`, so
  // there is no half-finished session to warn about, and a red that never
  // cleared would just become part of the furniture.
  const runState: 'idle' | 'running' | 'paused' = st.running ? 'running' : (st.baseElapsed > 0 ? 'paused' : 'idle');
  // Semantic tokens only — never a literal hex (DESIGN_CONSTITUTION).
  const runAccent = runState === 'running' ? 'var(--color-warning-500)'
    : runState === 'paused' ? 'var(--color-danger-500)'
      : 'var(--color-ink-900)';
  const skip = useCallback(() => {
    if (stRef.current.mode === 'stopwatch') { reset(); return; }
    complete(false);
  }, [complete, reset]);
  const setMode = (mode: Mode) => setSt((p) => ({ ...p, mode, phase: 'focus', running: false, anchor: null, baseElapsed: 0 }));
  const setLength = (n: number) => setSt((p) => p.mode === 'countdown'
    ? { ...p, countdownMin: n, running: false, anchor: null, baseElapsed: 0 }
    : { ...p, focusMin: n, phase: 'focus', running: false, anchor: null, baseElapsed: 0 });
  const setBreak = (n: number) => setSt((p) => ({ ...p, breakMin: n }));
  const cycleSize = () => setSt((p) => ({ ...p, size: p.size === 'sm' ? 'md' : p.size === 'md' ? 'lg' : 'sm' }));
  const minimize = () => { setSettingsOpen(false); setSt((p) => ({ ...p, collapsed: true })); };
  const expand = () => setSt((p) => ({ ...p, collapsed: false }));
  const close = () => { setSettingsOpen(false); try { pipWinRef.current?.close(); } catch { /* noop */ } setSt((p) => ({ ...p, open: false })); };

  // Pop the widget OUT into an always-on-top OS window that floats over other
  // apps; pop it back IN by closing that window. Only offered on Chromium (feature
  // detected) — everywhere else the in-window float is the graceful fallback.
  const popOut = useCallback(async () => {
    const pip = getPiP();
    if (!pip) return;
    setSettingsOpen(false);
    const s = SIZES[stRef.current.size];
    const h = Math.round((s.w - s.dial) / 2 + s.dial + 4 + 40 + 44 + (stRef.current.taskOpen ? 214 : 0) + 12);
    try {
      const win = await pip.requestWindow({ width: s.w, height: h });
      mirrorInto(win);
      win.addEventListener('pagehide', () => setPipWin(null), { once: true });
      setPipWin(win);
    } catch { /* user dismissed the prompt or it's unavailable */ }
  }, []);
  const popIn = useCallback(() => { try { pipWinRef.current?.close(); } catch { /* noop */ } setPipWin(null); }, []);

  // ── Drag + snap ──
  const dragRef = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, a, [role="menu"], [data-nodrag]')) return;
    const el = rootRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const x = clamp(e.clientX - d.dx, MARGIN, window.innerWidth - d.w - MARGIN);
    const y = clamp(e.clientY - d.dy, MARGIN, window.innerHeight - d.h - MARGIN);
    setStRaw((p) => ({ ...p, pos: { x, y } })); // no persist per move (perf); saved on up
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    dragRef.current = null;
    try { rootRef.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    setSt((p) => {
      if (!p.pos) return p;
      let { x, y } = p.pos;
      if (x <= MARGIN + SNAP) x = MARGIN;
      if (y <= MARGIN + SNAP) y = MARGIN;
      if (x >= window.innerWidth - d.w - MARGIN - SNAP) x = window.innerWidth - d.w - MARGIN;
      if (y >= window.innerHeight - d.h - MARGIN - SNAP) y = window.innerHeight - d.h - MARGIN;
      return { ...p, pos: { x, y } };
    });
  };

  // ── Keyboard (scoped to the widget) ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleRun(); }
    else if (e.key === 'Escape') { e.preventDefault(); settingsOpen ? setSettingsOpen(false) : pipWinRef.current ? popIn() : minimize(); }
  };

  // ── Analog drag-to-set ── grab the handle (or anywhere on the ring) and turn
  // the dial like a real timer: minutes update live, snapping to each mark with a
  // tick + haptic. Only when stopped (you set before you start), never on stopwatch.
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const dialWrapRef = useRef<HTMLDivElement>(null);
  const lastScrubMin = useRef(-1);
  const scrubbable = !st.running && st.mode !== 'stopwatch';
  const applyScrubMinutes = (m: number) => setSt((p) => {
    const base = { running: false as const, anchor: null, baseElapsed: 0 };
    if (p.mode === 'countdown') return { ...p, ...base, countdownMin: m };
    if (p.mode === 'pomodoro') return p.phase === 'focus' ? { ...p, ...base, focusMin: m } : { ...p, ...base, breakMin: m };
    return p;
  });
  const angleFromEvent = (e: React.PointerEvent) => {
    const el = dialWrapRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 at top, clockwise
    if (deg < 0) deg += 360;
    return deg;
  };
  const scrubTo = (e: React.PointerEvent) => {
    const deg = angleFromEvent(e); if (deg == null) return;
    const m = minutesForAngle(deg);
    if (m !== lastScrubMin.current) {
      lastScrubMin.current = m;
      if (!stRef.current.silent) playFocusTick();
      try { navigator.vibrate?.(4); } catch { /* unsupported */ }
    }
    applyScrubMinutes(m);
  };
  const onDialDown = (e: React.PointerEvent) => {
    // The press must have landed on the RING, not on the centre controls. The
    // pointer-events fix means the play button is now a real target and this
    // guard finally does something; `[data-nodrag]` covers anything else the
    // centre overlay grows later without needing to be a <button>.
    if (!scrubbable) return;
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('[data-timer-controls]')) return;
    scrubbingRef.current = true; setScrubbing(true); lastScrubMin.current = -1;
    try { dialWrapRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    scrubTo(e);
  };
  const onDialMove = (e: React.PointerEvent) => { if (scrubbingRef.current) scrubTo(e); };
  const onDialUp = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false; setScrubbing(false);
    try { dialWrapRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  // ── Task list ──
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projs, setProjs] = useState<ProjMap>({});
  const [quick, setQuick] = useState('');
  const loadTasks = useCallback(async () => {
    if (demoTasks) { setTasks(orderTasks(demoTasks)); return; } // dev harness seam
    const supabase = createClient();
    const today = localDateISO();
    let q = supabase.from('tasks').select('id,title,done,priority,project_id').eq('scheduled_date', today).order('sort_order');
    if (activeSpaceId) q = q.eq('space_id', activeSpaceId);
    const [{ data: trows }, { data: prows }] = await Promise.all([
      q,
      activeSpaceId
        ? supabase.from('projects').select('id,name,color').eq('space_id', activeSpaceId)
        : supabase.from('projects').select('id,name,color'),
    ]);
    setTasks(orderTasks((trows as TaskRow[] | null) ?? []));
    const map: ProjMap = {};
    for (const p of (prows as { id: string; name: string; color: string | null }[] | null) ?? []) map[p.id] = { name: p.name, color: p.color };
    setProjs(map);
  }, [activeSpaceId, demoTasks]);

  // Loaded on the client, so a failed save is corrected by a resync rather than
  // the failure net's refresh — same condition as the focus reload below.
  useResync(loadTasks, st.open || embedded);

  useEffect(() => {
    if (!st.open && !embedded) return;
    loadTasks();
    // Reload when the surface regains focus so a task added elsewhere (Tasks,
    // Home, or the other overlay) shows up here — the list is the same account
    // data, not a private copy.
    const onFocus = () => loadTasks();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [st.open, embedded, loadTasks]);

  const onToggleTask = (id: string, done: boolean) => {
    setTasks((prev) => orderTasks(prev.map((t) => (t.id === id ? { ...t, done } : t))));
    signalTaskToggle(done);
    toggleTask(id, done, localDateISO()).then((r) => {
      if ('error' in r) { setTasks((prev) => orderTasks(prev.map((t) => (t.id === id ? { ...t, done: !done } : t)))); toastReverted(r.error); }
    });
  };
  const onDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (st.activeTaskId === id) setSt((p) => ({ ...p, activeTaskId: null }));
    deleteTask(id);
  };
  const onInboxTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    rescheduleTask(id, 'inbox');
  };
  const onSelectTask = (id: string) => setSt((p) => ({ ...p, activeTaskId: p.activeTaskId === id ? null : id }));
  const onQuickAdd = async () => {
    const title = quick.trim();
    if (!title) return;
    setQuick('');
    const r = await addTask({ title, scheduledDate: localDateISO(), sortOrder: tasks.length });
    if (!('error' in r)) loadTasks();
  };

  if (!mounted) return null;
  if (!embedded && !st.open) return null;
  const S = SIZES[st.size];

  // Default resting spot: bottom-right.
  const pos = st.pos ?? {
    x: (typeof window !== 'undefined' ? window.innerWidth : 1280) - S.w - MARGIN - 8,
    y: (typeof window !== 'undefined' ? window.innerHeight : 720) - (st.collapsed ? 64 : 560) - MARGIN,
  };

  const phaseLabel = st.mode === 'pomodoro' ? (st.phase === 'focus' ? 'Focus' : 'Break')
    : st.mode === 'countdown' ? 'Countdown' : 'Stopwatch';
  const openTasks = tasks.filter((t) => !t.done).length;

  const docked = !!pipWin;                                   // living in the PiP window
  const fill = docked || embedded;                           // panel fills its window
  const portalTarget = pipWin ? pipWin.document.body : document.body;

  // ── Minimised pill ── (never while filling a window — that window IS the float)
  if (st.collapsed && !fill) {
    return createPortal(
      <div ref={rootRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label="Focus timer"
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 'var(--z-widget)', cursor: 'grab', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 8px 0 12px',
          borderRadius: 24, border: '1px solid var(--line)', background: 'color-mix(in srgb, var(--color-paper) 78%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          boxShadow: 'var(--shadow-overlay)', outline: 'none',
        }}>
        <svg width={22} height={22} viewBox="0 0 36 36" aria-hidden style={{ flexShrink: 0 }}>
          <circle cx={18} cy={18} r={15} fill="none" stroke="var(--line)" strokeWidth={3} />
          {/* Same state colour as the full dial — this pill IS the timer when
              minimised, so it has to answer "is it running?" the same way. */}
          <circle cx={18} cy={18} r={15} fill="none" stroke={runAccent} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - progress)}
            transform="rotate(-90 18 18)" style={{ transition: 'stroke var(--duration-base) var(--ease-hover)' }} />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-ink-900)', fontVariantNumeric: 'tabular-nums', minWidth: 52 }}>
          {fmtTime(remaining)}
        </span>
        <IconButton label={st.running ? 'Pause' : 'Start'} icon={<IconSwap swapKey={st.running ? 'pause' : 'play'}><Icon icon={st.running ? Pause : Play} size={16} /></IconSwap>} size="sm" variant="ghost" onClick={toggleRun} data-nodrag
          style={runState === 'idle' ? undefined : { color: runAccent }} />
        <IconButton label="Expand" icon={<Icon icon={Maximize2} size={16} />} size="sm" variant="ghost" onClick={expand} data-nodrag />
      </div>,
      document.body,
    );
  }

  // ── Full panel ── (in-window float, or filling a PiP / native overlay window)
  const panel = (
    <div ref={rootRef} className="group/timer"
      onPointerDown={fill ? undefined : onPointerDown} onPointerMove={fill ? undefined : onPointerMove} onPointerUp={fill ? undefined : onPointerUp}
      onKeyDown={onKeyDown} onContextMenu={(e) => { e.preventDefault(); setSettingsOpen((v) => !v); }}
      tabIndex={0} role="dialog" aria-label="Focus timer"
      style={fill ? {
        position: 'relative', width: '100%', minHeight: '100vh', background: 'var(--canvas)',
        overflowY: 'auto', outline: 'none', userSelect: 'none',
      } : {
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 'var(--z-widget)', width: S.w, cursor: 'grab', userSelect: 'none',
        borderRadius: 24, border: '1px solid var(--line)', background: 'color-mix(in srgb, var(--color-paper) 80%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
        boxShadow: 'var(--shadow-overlay)', overflow: 'hidden', outline: 'none',
      }}>
      {/* Hover chrome — kept faint until the panel is hovered/focused so the
          resting widget stays as clean as the Figma. Docked (PiP) swaps resize/
          minimise for a single "pop in" control. */}
      <div className="opacity-0 transition-opacity duration-fast group-hover/timer:opacity-100 focus-within:opacity-100"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, display: 'flex', gap: 2 }} data-nodrag>
        <IconButton label="Timer settings" tooltip="Settings · right-click" icon={<Icon icon={Settings} size={16} />} size="sm" variant="ghost" selected={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} />
        {/* In the native overlay the OS window owns move/resize/close, so only
            settings is offered. In-window: pop-out · resize · minimise · close. */}
        {!embedded && (docked ? (
          <IconButton label="Dock back into window" tooltip="Pop back in · Esc" icon={<Icon icon={Minimize2} size={16} />} size="sm" variant="ghost" onClick={popIn} />
        ) : (
          <>
            {pipSupported && <IconButton label="Float over other apps" tooltip="Pop out, stays on top of everything" icon={<Icon icon={ExternalLink} size={16} />} size="sm" variant="ghost" onClick={popOut} />}
            <IconButton label={`Resize (${st.size})`} icon={<Icon icon={Maximize2} size={16} />} size="sm" variant="ghost" onClick={cycleSize} />
            <IconButton label="Minimize" tooltip="Minimize · Esc" icon={<Icon icon={Minus} size={16} />} size="sm" variant="ghost" onClick={minimize} />
          </>
        ))}
        {!embedded && <IconButton label="Close" icon={<Icon icon={X} size={16} />} size="sm" variant="ghost" onClick={close} />}
      </div>

      {/* Dial region */}
      <div style={{ padding: `${(S.w - S.dial) / 2}px ${(S.w - S.dial) / 2}px 4px`, display: 'grid', placeItems: 'center' }}>
        <div ref={dialWrapRef}
          style={{ position: 'relative', width: S.dial, height: S.dial, touchAction: 'none', cursor: scrubbable ? (scrubbing ? 'grabbing' : 'grab') : 'default' }}
          onPointerDown={onDialDown} onPointerMove={onDialMove} onPointerUp={onDialUp} onPointerCancel={onDialUp}
          onDoubleClick={reset} data-nodrag>
          <Dial px={S.dial} progress={progress} showKnob={st.mode !== 'stopwatch'} knobActive={scrubbing} accent={runAccent} />
          {/* Centre overlay — phase · time · play. Pointer-events are off here so
              the ring behind stays grabbable for scrubbing; the CONTROLS ROW
              re-enables them (it must, or the play button is unclickable — the
              hit-test falls straight through to the dial and starts a drag). */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
            {st.mode === 'pomodoro' && (
              <span style={{ fontSize: 11, color: 'var(--color-ink-500)', fontWeight: 500 }}>{phaseLabel}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: S.time, lineHeight: 1, fontWeight: 500, color: 'var(--color-ink-900)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(remaining)}</span>
              {st.mode !== 'stopwatch' && <span style={{ fontSize: 13, color: 'var(--color-ink-500)' }}>min</span>}
            </div>
            {/* The one part of the overlay that takes pointer events, and it sits
                above the dial. Without this the play button never sees a click:
                the parent's `pointer-events: none` let the press through to the
                ring, which read it as the start of a drag-to-set. */}
            <div className="group/ctl" data-nodrag data-timer-controls
              style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span className="opacity-0 group-hover/ctl:opacity-100" style={{ transition: 'opacity var(--duration-fast) var(--ease-hover)' }}>
                <IconButton label="Reset" tooltip="Reset · double-click" icon={<Icon icon={RotateCcw} size={16} />} size="sm" variant="ghost" onClick={reset} />
              </span>
              <button onClick={toggleRun} aria-label={st.running ? 'Pause' : 'Start'}
                className="zb-press" data-nodrag
                style={{
                  width: S.play, height: S.play, borderRadius: '50%',
                  // The primary action carries the same state colour as the ring.
                  border: `1px solid ${runState === 'idle' ? 'var(--line)' : runAccent}`,
                  background: 'transparent',
                  color: runState === 'idle' ? 'var(--color-ink-900)' : runAccent,
                  cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  transition: 'background var(--duration-fast) var(--ease-hover), border-color var(--duration-base) var(--ease-hover), color var(--duration-base) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)',
                }}>
                <IconSwap swapKey={st.running ? 'pause' : 'play'}><Icon icon={st.running ? Pause : Play} size={Math.round(S.play * 0.44)} style={{ marginLeft: st.running ? 0 : 2 }} /></IconSwap>
              </button>
              <span className="opacity-0 group-hover/ctl:opacity-100" style={{ transition: 'opacity var(--duration-fast) var(--ease-hover)' }}>
                <IconButton label="Skip" icon={<Icon icon={SkipForward} size={16} />} size="sm" variant="ghost" onClick={skip} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's focus summary — quiet stat row under the dial */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '2px 16px 12px', color: 'var(--color-ink-500)', fontSize: 12 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{humanDur(todayFocus)} focused</span>
        <span aria-hidden style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-ink-300)' }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{todaySessions} {todaySessions === 1 ? 'session' : 'sessions'}</span>
      </div>

      {/* Task section — the Figma "Task ⌄" bar */}
      <div style={{ borderTop: '1px solid var(--line)' }} data-nodrag>
        <button onClick={() => setSt((p) => ({ ...p, taskOpen: !p.taskOpen }))} data-nodrag
          style={{
            width: '100%', height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
            border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-ink-700)',
          }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Today</span>
          {openTasks > 0 && <span style={{ fontSize: 12, color: 'var(--color-ink-500)', fontVariantNumeric: 'tabular-nums' }}>{openTasks}</span>}
          <span style={{ flex: 1 }} />
          <Icon icon={st.taskOpen ? ChevronUp : ChevronDown} size={16} style={{ color: 'var(--color-ink-500)' }} />
        </button>

        {st.taskOpen && (
          <div style={{ padding: '0 8px 8px' }}>
            {/* Quick add */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px' }}>
              <Icon icon={Plus} size={16} style={{ color: 'var(--color-ink-500)', flexShrink: 0 }} />
              <input value={quick} onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onQuickAdd(); e.stopPropagation(); }}
                placeholder="Add a task for today" data-nodrag
                style={{
                  flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 13, color: 'var(--color-ink-900)',
                }} />
            </div>
            {/* List — first rows visible, the rest scroll (fixed panel height) */}
            <div style={{ maxHeight: 168, overflowY: 'auto' }} className="zb-scroll" data-nodrag>
              {tasks.length === 0 ? (
                <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--color-ink-500)', fontSize: 12 }}>
                  Nothing scheduled for today.
                </div>
              ) : tasks.map((t) => (
                <TaskItem key={t.id} t={t} proj={t.project_id ? projs[t.project_id] : undefined}
                  active={st.activeTaskId === t.id}
                  onToggle={onToggleTask} onSelect={onSelectTask} onDelete={onDeleteTask} onInbox={onInboxTask} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings overlay */}
      {settingsOpen && (
        <div data-nodrag style={{
          position: 'absolute', inset: 0, zIndex: 4, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
          background: 'color-mix(in srgb, var(--color-paper) 94%, transparent)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink-900)' }}>Timer settings</span>
            <span style={{ flex: 1 }} />
            <IconButton label="Done" icon={<Icon icon={X} size={16} />} size="sm" variant="ghost" onClick={() => setSettingsOpen(false)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-ink-500)', fontWeight: 500 }}>Mode</span>
            <SegmentedControl aria-label="Timer mode" options={MODES} value={st.mode} onValueChange={(v) => setMode(v as Mode)} />
          </div>

          {st.mode !== 'stopwatch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--color-ink-500)', fontWeight: 500 }}>
                {st.mode === 'countdown' ? 'Length' : 'Focus length'}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LENGTHS.map((n) => {
                  const on = (st.mode === 'countdown' ? st.countdownMin : st.focusMin) === n;
                  return <Chip key={n} on={on} onClick={() => setLength(n)}>{n}m</Chip>;
                })}
              </div>
            </div>
          )}

          {st.mode === 'pomodoro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--color-ink-500)', fontWeight: 500 }}>Break length</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BREAKS.map((n) => <Chip key={n} on={st.breakMin === n} onClick={() => setBreak(n)}>{n}m</Chip>)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Switch checked={st.autostart} onCheckedChange={(v) => setSt((p) => ({ ...p, autostart: v }))} />
              <span style={{ fontSize: 13, color: 'var(--color-ink-900)' }}>Auto-start next session</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Switch checked={!st.silent} onCheckedChange={(v) => setSt((p) => ({ ...p, silent: !v }))} />
              <span style={{ fontSize: 13, color: 'var(--color-ink-900)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon icon={st.silent ? VolumeX : Volume2} size={16} style={{ color: 'var(--color-ink-500)' }} />
                Sound
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
  // Embedded (native overlay route) renders inline and fills the window; the
  // floating widget portals to <body> (or the PiP document when popped out).
  return embedded ? panel : createPortal(panel, portalTarget);
}

// Small preset chip — a compact secondary toggle (DS neutral surfaces only).
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="zb-press"
      style={{
        height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        border: `1px solid ${on ? 'transparent' : 'var(--line)'}`,
        background: on ? 'var(--color-ink-900)' : 'transparent',
        color: on ? 'var(--color-canvas)' : 'var(--color-ink-700)',
        transition: 'background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)',
      }}>
      {children}
    </button>
  );
}
