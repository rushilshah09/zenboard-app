'use client';
// ── A FOCUS SESSION, BEFORE SIGNING IN ──────────────────────────────────────
//
// The user, 2026-09-26: right-click the logo for "a focus session without login … and make this
// count: they log in to Zenboard and their sessions count"; and of starting one, "in brand colours,
// they are entering focus mode".
//
// So anyone can run a real focus session from the website, the way the app runs one: what you are
// on, how long, start. Starting is the one moment on the site that earns a flourish (rare, and
// chosen): the page falls away down a tunnel of the brand's colours (warp.tsx) and comes out on the
// dark ground the session runs on, with the time, the thing being done, and nothing else. What is
// finished is kept on this device (lib/guest-focus.ts) and moves into the visitor's Zenboard the
// first time they open it signed in.
//
// A Radix dialog, so it is modal the way a focus session should be: focus stays inside it, the page
// under it is inert, and Escape ends it, keeping what was done. The clock reads the wall clock, so a
// tab left in the background is right when it is looked at again.

import Link from 'next/link';
import * as React from 'react';
import { Dialog as RD } from 'radix-ui';
import { Pause, Play } from '@/components/ds/icons';
import { Button, Field, Icon, Mark, SegmentedControl, TextInput, button, cardClass, toast } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import {
  FOCUS_LENGTHS, GUEST_FOCUS_KEY, GUEST_FOCUS_OPEN, GUEST_LIMITS, addGuestSession, clockText, pauseClock, readGuestSessions,
  remainingMs, resumeClock, sessionOf, sessionsOnDay, startClock, type FocusClock, type GuestSession,
} from '@/lib/guest-focus';
import { playFocusChime } from '@/lib/sound';
import { Halftone } from './halftone';
import { Warp } from './warp';

type Phase = 'setup' | 'warp' | 'focus' | 'done';

/** What this device has kept (never throws: storage may be blocked or edited). */
function kept(): GuestSession[] {
  try {
    return readGuestSessions(localStorage.getItem(GUEST_FOCUS_KEY), new Date());
  } catch {
    return [];
  }
}

/** Keeps a finished session. If storage is blocked the session still happened; it just cannot travel. */
function keep(session: GuestSession): GuestSession[] {
  const list = addGuestSession(kept(), session, new Date());
  try {
    localStorage.setItem(GUEST_FOCUS_KEY, JSON.stringify(list));
  } catch {
    // Nothing to tell: the done screen says what was focused either way.
  }
  return list;
}

const minutes = (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'}`;
/** The one filled button on the dark ground: the page's light, turned over (as the footer's is). */
const ON_DARK = cn(button({ variant: 'secondary', size: 'lg' }), 'border-transparent bg-site-ink-fg text-site-ink hover:bg-site-ink-fg/90 active:bg-site-ink-fg/90');
/** A quieter action on the dark ground: words, lit on hover. */
const QUIET_ON_DARK = 'site-link focus-ring rounded-xs text-ui text-site-ink-muted transition-colors duration-fast ease-hover hover:text-site-ink-fg';

const ABOUT = 'One thing, one timer, nothing else. No account needed: what you finish is kept on this device, and counts in Zenboard when you sign up.';

/** What the session is about and how long it runs: the card a session starts from. The same card
    rushes toward the visitor as the warp opens (`site-dive`), so it is one component in two places. */
function SetupCard({ what, setWhat, length, setLength, today, onStart, diving = false }: {
  /** The copy that dives into the warp: a picture of the card, so it names nothing to assistive
      technology (the dialog's title is the live one) and does not arrive again as it leaves. */
  diving?: boolean;
  what: string;
  setWhat: (v: string) => void;
  length: number;
  setLength: (v: number) => void;
  today: number;
  onStart: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onStart} className={cardClass(cn('w-full max-w-[26rem] rounded-xl p-6 shadow-panel', !diving && 'zb-enter animate-rise'))}>
      <div className="flex items-center gap-2.5">
        <Mark size={20} tone="brand" />
        {diving
          ? <p className="font-editorial text-title-2 text-ink-900">Focus session</p>
          : <RD.Title className="font-editorial text-title-2 text-ink-900">Focus session</RD.Title>}
      </div>
      {diving
        ? <p className="mt-2 text-ui text-ink-600">{ABOUT}</p>
        : <RD.Description id="guest-focus-about" className="mt-2 text-ui text-ink-600">{ABOUT}</RD.Description>}
      <div className="mt-6 flex flex-col gap-5">
        <Field label="What are you focusing on?" optional>
          <TextInput value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Finish the logo presentation" maxLength={GUEST_LIMITS.what} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-body font-medium text-ink-800">How long</p>
          <SegmentedControl
            aria-label="How long"
            value={String(length)}
            onValueChange={(v) => setLength(Number(v))}
            options={FOCUS_LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
          />
        </div>
      </div>
      {today > 0 && <p className="mt-4 text-caption text-ink-500">{today === 1 ? 'One session' : `${today} sessions`} today on this device.</p>}
      <div className="mt-6 flex items-center justify-end gap-2">
        <RD.Close asChild><Button variant="ghost">Cancel</Button></RD.Close>
        <Button variant="primary" type="submit"><Icon icon={Play} size={16} weight="fill" />Start</Button>
      </div>
    </form>
  );
}

export function GuestFocus() {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('setup');
  const [what, setWhat] = React.useState('');
  const [length, setLength] = React.useState<number>(25);
  const [clock, setClock] = React.useState<FocusClock | null>(null);
  const [now, setNow] = React.useState(0);
  const [today, setToday] = React.useState(0);
  const [result, setResult] = React.useState<{ session: GuestSession | null; today: number } | null>(null);
  const pauseRef = React.useRef<HTMLButtonElement>(null);

  // Opened from anywhere on the site (the logo's menu), by one window event.
  React.useEffect(() => {
    const show = (e: Event) => {
      const asked = (e as CustomEvent<{ what?: string } | null>).detail?.what;
      if (typeof asked === 'string' && asked) setWhat(asked.slice(0, GUEST_LIMITS.what));
      setToday(sessionsOnDay(kept(), new Date()));
      setPhase('setup');
      setOpen(true);
    };
    window.addEventListener(GUEST_FOCUS_OPEN, show);
    return () => window.removeEventListener(GUEST_FOCUS_OPEN, show);
  }, []);

  const finish = React.useCallback((c: FocusClock, at: number, early: boolean) => {
    const session = sessionOf(c, at, what.trim().slice(0, GUEST_LIMITS.what));
    const list = session ? keep(session) : kept();
    if (session && !early) playFocusChime();
    setResult({ session, today: sessionsOnDay(list, new Date(at)) });
    setClock(null);
    setPhase('done');
    return session;
  }, [what]);

  // The clock, while it runs: read four times a second, and done when it reaches nothing.
  React.useEffect(() => {
    if (phase !== 'focus' || !clock || clock.pausedAt != null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (remainingMs(clock, t) <= 0) finish(clock, t, false);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, clock, finish]);

  // The tab says the time while a session runs, and goes back to itself after.
  React.useEffect(() => {
    if (phase !== 'focus' || !clock) return;
    const title = document.title;
    return () => { document.title = title; };
  }, [phase, clock?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps -- once per session, not per tick
  React.useEffect(() => {
    if (phase === 'focus' && clock) document.title = `${clockText(remainingMs(clock, now || clock.startedAt))} · Focus session`;
  }, [phase, clock, now]);

  // Arriving on the session puts the keyboard on its one control.
  React.useEffect(() => {
    if (phase === 'focus') pauseRef.current?.focus();
  }, [phase]);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('warp');
  };
  const arrive = React.useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock(startClock(t, length));
    setPhase('focus');
  }, [length]);
  const togglePause = () => {
    if (!clock) return;
    const t = Date.now();
    setNow(t);
    setClock(clock.pausedAt == null ? pauseClock(clock, t) : resumeClock(clock, t));
  };
  const end = () => {
    if (clock) finish(clock, Date.now(), true);
  };
  const close = () => {
    // Leaving mid-session keeps what was done, and says so.
    if (phase === 'focus' && clock) {
      const session = finish(clock, Date.now(), true);
      if (session) toast({ message: `Kept ${minutes(session.minutes)} of focus on this device` });
    }
    setOpen(false);
    setPhase('setup');
  };

  const dark = phase !== 'setup';
  const left = clock ? remainingMs(clock, now || clock.startedAt) : 0;
  const progress = clock ? 1 - left / (clock.minutes * 60_000) : 0;

  return (
    <RD.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <RD.Portal>
        <RD.Overlay
          className={cn(
            'zb-enter fixed inset-0 z-fullscreen transition-colors duration-slow ease-hover',
            dark ? 'bg-site-ink' : 'bg-scrim animate-fadein',
          )}
        />
        <RD.Content
          aria-describedby="guest-focus-about"
          className="fixed inset-0 z-fullscreen grid place-items-center overflow-y-auto p-4 outline-none"
        >
          {phase === 'setup' ? (
            <SetupCard what={what} setWhat={setWhat} length={length} setLength={setLength} today={today} onStart={start} />
          ) : (
            <div className="site-ink absolute inset-0 grid place-items-center overflow-hidden text-site-ink-fg">
              <RD.Title className="sr-only">Focus session</RD.Title>
              {phase !== 'warp' && <Halftone mark={{ x: 0.5, y: 0.5, size: 1.5 }} />}
              {phase === 'warp' && <Warp onDone={arrive} />}
              {/* The card the visitor pressed Start on rushes toward them and dissolves as the way opens. */}
              {phase === 'warp' && (
                <div aria-hidden inert className="site-dive pointer-events-none relative w-full max-w-[26rem]">
                  <SetupCard diving what={what} setWhat={setWhat} length={length} setLength={setLength} today={today} onStart={start} />
                </div>
              )}

              {phase === 'focus' && clock && (
                <div className="zb-enter relative flex flex-col items-center px-6 text-center animate-fadein">
                  <p className="max-w-[40ch] text-body-lg text-site-ink-muted">{what.trim() || 'Focus'}</p>
                  <p className="site-clock mt-4" role="timer" aria-live="off">{clockText(left)}</p>
                  <span aria-hidden className="relative mt-8 block h-0.5 w-[min(20rem,70vw)] overflow-hidden rounded-full bg-site-ink-line">
                    <span className="absolute inset-0 origin-left bg-accent transition-transform duration-slow ease-out-quiet" style={{ transform: `scaleX(${progress})` }} />
                  </span>
                  <div className="mt-10 flex items-center gap-6">
                    <button ref={pauseRef} type="button" onClick={togglePause} className={ON_DARK}>
                      <Icon icon={clock.pausedAt == null ? Pause : Play} size={16} weight="fill" />
                      {clock.pausedAt == null ? 'Pause' : 'Resume'}
                    </button>
                    <button type="button" onClick={end} className={QUIET_ON_DARK}>End session</button>
                  </div>
                  <p className="mt-6 text-caption text-site-ink-muted">{clock.pausedAt == null ? 'Escape ends the session and keeps what you did.' : 'Paused. The time you are away does not count.'}</p>
                </div>
              )}

              {phase === 'done' && result && (
                <div className="zb-enter relative flex max-w-[30rem] flex-col items-center px-6 text-center animate-rise">
                  <Mark size={28} tone="brand" />
                  <p className="mt-6 font-editorial text-headline text-site-ink-fg">{result.session ? 'Session done.' : 'Session ended.'}</p>
                  <p className="mt-3 text-body-lg text-site-ink-muted">
                    {result.session
                      ? `${minutes(result.session.minutes)}${result.session.what ? ` on ${result.session.what}` : ''}. That’s ${result.today} today.`
                      : 'It was under a minute, so there was nothing to keep.'}
                  </p>
                  <p className="mt-6 max-w-[36ch] text-ui text-site-ink-muted">Kept on this device. Start free, and your sessions count in Zenboard from the day you began.</p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
                    <Link href="/login" className={ON_DARK}>Start free</Link>
                    <button type="button" onClick={() => setPhase('setup')} className={QUIET_ON_DARK}>Another session</button>
                  </div>
                  <RD.Close className={cn(QUIET_ON_DARK, 'mt-8')}>Back to the site</RD.Close>
                </div>
              )}
            </div>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
