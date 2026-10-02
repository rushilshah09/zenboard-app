'use client';
// Auth — sign in and create account, one screen with a mode toggle.
// Email/password only. Signup goes through the server route (auto-confirmed, no
// email), then we sign in to establish the session.
//
// ── REBUILT ON THE DESIGN SYSTEM (2026-09-08) ──────────────────────────────
// This screen was 170 lines of inline styles that re-implemented things the DS
// already owns, and each re-implementation was slightly worse than the original:
// a raw <button> painting `var(--primary)` by hand (no focus ring, no press,
// `opacity: 0.5` for disabled), a hand-built eye toggle where `TextInput` ships
// `reveal`, and hand-built <label> + <span> pairs where `Field` ships the
// helper/error wiring those pairs never had. It is the first screen anyone
// sees, so it is the last place to hand-roll.
//
// ── IT SHOWED NOTHING (2026-09-23) ─────────────────────────────────────────
// "This also looks so boring" — a 400px box in the middle of a 1440px dark
// page. The fix was not ornament: the page became a split, with the PRODUCT at
// rest beside the form, drawn with the app's own components so it cannot drift
// from what it is a picture of.
//
// ── THE SHEET, AND THE PRODUCT (2026-09-25) ────────────────────────────────
// The user sent eight screens of the direction they want ("This is the style I
// like … mainly the visual direction"), and then, looking at this screen:
// "i want show product not just components there".
//
// Both notes land here:
//
//   · THE SHEET. The page is no longer a flat field with a hairline down the
//     middle. There is a DESK (`bg-surface-desk`, one rung below the canvas)
//     and two SHEETS lying on it with a gutter of desk showing all round —
//     measured off the reference, where the ground reads 1.17:1 against the
//     sheet. Two surfaces that are 1.04:1 apart, which is what a canvas and a
//     card measure in light, cannot do this; the desk is why the layout is
//     suddenly an object rather than a background.
//   · THE PRODUCT, NOT ITS PARTS. The still was two panels floating in the
//     middle of a column, which reads as a component gallery. It is a PAGE
//     now — Home's own header (the mark, the greeting, what the day holds),
//     then the highlight, then the plan, then the schedule — at the width the
//     app really uses, running off the right edge of its sheet the way a real
//     screen does when you look at part of one.
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-url';
import { SIGNUPS_OPEN } from '@/lib/waitlist';
import { Mail, Star, Sun, Flame, Play, Check, ChevronRight, Folder, Calendar as CalendarIcon } from '@/components/ds/icons';
import { createClient } from '@/lib/supabase/client';
import { Mark, Icon, Button, TextInput, Field, Checkbox, Panel, PanelHeader, PanelBody, Wordmark, button } from '@/components/ds/ui';

/** The one rule a password here has to meet — stated once, checked once. */
const MIN_PASSWORD = 8;

function AuthScreen() {
  const router = useRouter();

  // Sign-in is the default and, while the waitlist is the front door, the only mode. `SIGNUPS_OPEN`
  // flips both this screen and the route behind it (lib/waitlist.ts); nothing here is a gate on its own.
  const [mode, setMode] = useState<'signup' | 'signin'>(SIGNUPS_OPEN ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const longEnough = pw.length >= MIN_PASSWORD;
  const ready = email.includes('@') && longEnough;
  const isSignup = SIGNUPS_OPEN && mode === 'signup';

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (isSignup) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password: pw }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not create your account.');
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      // `?next=` is read HERE, at the moment it is used, rather than through
      // `useSearchParams()`. That hook, in a statically built page, bails the
      // whole screen out to client rendering: production served an empty
      // canvas and the form appeared only once the JavaScript arrived — on the
      // first screen anyone sees. Nothing ABOUT the form depends on `next`;
      // only where it goes afterwards does.
      //
      // And it is checked: an unchecked `next` is an open redirect, sending a
      // person who has just signed in to wherever the link's author chose.
      const raw = new URLSearchParams(window.location.search).get('next');
      // New accounts go through first-run onboarding (unless a specific next was set).
      const dest = isSignup && !raw ? '/onboarding' : safeNextPath(raw);
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    // ONE page, with one thing raised on it (user, 2026-09-25: "left side of ui on background,
    // no uplifted"). The form is the page — no card, no gutter, no edge — and the only object
    // that lifts is the product beside it, which is the thing worth looking at.
    <div className="absolute inset-0 grid grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Four hairlines with the brand's light running along them (`.zb-beam`, globals.css). They
          cross the WHOLE window and pass behind the raised product — a line that stopped at the
          column's edge left a seam at exactly the place this page is trying not to have one
          (user: "i don't want this gap, i want to touch from both sides"). It is the one moving
          thing on a screen that is otherwise a form: decoration, so `aria-hidden`, and it holds
          still under reduced motion. It is first in the DOM, so the product paints over it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[100px] flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="zb-beam" style={{ '--zb-beam-delay': `${i * 0.7}s` } as CSSProperties} />
        ))}
      </div>

      <div className="relative flex min-w-0 flex-col overflow-hidden">
          <header className="flex items-center gap-2 px-7 py-5">
            <Wordmark />
            <div className="flex-1" />
            {/* The brand as an EDGE, so the filled accent stays unique to the
                one thing this page is for. */}
{/* ONE edge control renders, whatever it is for: the page allows one filled accent and one
                edge. While sign-up is closed there is no second mode to offer, so it offers the thing
                that DOES exist — an inert "Create account" that fails on submit is worse than none.
                The link is an <a> wearing the button's class rather than `<Button asChild>`, which
                cannot work: Button renders a loading slot beside its label, so Slot gets two children. */}
            {SIGNUPS_OPEN ? (
              <Button
                variant="brandOutline"
                size="sm"
                iconRight={<Icon icon={ChevronRight} size={14} />}
                onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}
              >
                {isSignup ? 'Log in' : 'Create account'}
              </Button>
            ) : (
              <a href="/waitlist" className={button({ variant: 'brandOutline', size: 'sm' })}>
                Join the waitlist
                <Icon icon={ChevronRight} size={14} className="ml-1" />
              </a>
            )}
          </header>

          <div className="flex flex-1 items-center justify-center overflow-y-auto px-6">
            {/* No card. The form IS the sheet here — a 400px box centred inside
                a sheet would be a dialog on a page with nothing behind it. */}
            <div className="w-[360px] max-w-full py-10 [animation:blurin_var(--duration-slow)_var(--ease-out-quiet)]">
              <h1 className="text-center font-display text-h1 font-medium tracking-[-0.02em] text-balance text-ink-900">
                {isSignup ? <>Create your <span className="text-accent-text">Zenboard</span> account</> : <>Welcome back to <span className="text-accent-text">Zenboard</span></>}
              </h1>

              <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <div className="flex flex-col gap-4 pt-7">
                  <Field label="Email">
                    <TextInput
                      size="lg"
                      type="email" autoComplete="email" inputMode="email"
                      icon={<Icon icon={Mail} size={16} />}
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@studio.com"
                    />
                  </Field>

                  {/* `reveal` is the DS password toggle — the eye button, its label
                      and its state, already built and already tested. */}
                  <Field
                    label="Password"
                    error={isSignup && pw.length > 0 && !longEnough && !pwFocused ? `At least ${MIN_PASSWORD} characters` : undefined}
                  >
                    <TextInput
                      size="lg"
                      reveal
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={pw} onChange={(e) => setPw(e.target.value)}
                      onFocus={() => setPwFocused(true)}
                      onBlur={() => setPwFocused(false)}
                      placeholder={`${MIN_PASSWORD}+ characters`}
                    />
                  </Field>

                  {/* The rule, while you are typing it — and it TICKS when met,
                      so the answer arrives before the submit does. Only on
                      sign-up: on sign-in the password already exists and the
                      rules are not yours to satisfy. Not a popover: an anchored
                      surface that opens on focus would fight the keyboard it is
                      being typed into. */}
                  {isSignup && (pwFocused || pw.length > 0) && (
                    <p className="-mt-2 flex items-center gap-2 text-caption text-ink-600 zb-enter">
                      <Icon
                        icon={Check}
                        size={14}
                        className={longEnough ? 'text-success-600' : 'text-ink-500'}
                      />
                      <span className={longEnough ? 'text-ink-700' : undefined}>At least {MIN_PASSWORD} characters</span>
                    </p>
                  )}

                  {/* `role="alert"` so a failed sign-in is ANNOUNCED, not just
                      painted — the old version rendered a bare <p>. */}
                  {error && <p role="alert" className="text-caption text-danger-600">{error}</p>}
                </div>

                <div className="flex flex-col items-stretch gap-3 pt-6">
                  {/* `loading` is not `disabled`: the label and width survive, so
                      the button does not shrink and change name mid-submit.
                      The trailing arrow is gone — a submit button that says what it
                      does does not also need to point at itself. */}
                  <Button
                    type="submit" variant="brand" size="lg" fullWidth
                    disabled={!ready} loading={busy}
                  >
                    {isSignup ? 'Create account' : 'Sign in'}
                  </Button>

                  {isSignup && (
                    <p className="text-center text-label leading-relaxed text-ink-600">
                      By continuing you agree to the Terms and Privacy Policy.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* The foot of the page: what this is, and whose it is. */}
          <footer className="flex items-end justify-between gap-6 px-7 py-5 text-label text-ink-500">
            <span className="max-w-[24ch]">A quiet operating system for your work and life.</span>
            <span>© 2026 Zenboard</span>
          </footer>
      </div>

      <ProductStill />
    </div>
  );
}

/**
 * THE PRODUCT, RUNNING OFF THE EDGE.
 *
 * Three notes from the user got this to what it is (2026-09-25):
 *
 *   1. "i want show product not just components there" — a column of panels floating in the
 *      middle of a column is a component gallery, not an application.
 *   2. "remove left side of uplist and right side of screen make overflow and it should be half
 *      visible and continue like this reference" — the way a screen says "there is more of me"
 *      is by CONTINUING past the edge. So the still is Home at its real measure, anchored to the
 *      left of its sheet, and the sheet itself runs off the right of the window. No nav rail:
 *      the reference has none either, and a rail inside a half-width picture is the part you can
 *      read least and learn least from.
 *   3. "dont use my client name" — the sample week is a generic US studio's. It names no real
 *      client, here or anywhere the first screens can show.
 *
 * Every part is the app's own: `Panel`, `PanelHeader`, `PanelBody`, `Checkbox`, the star, the
 * accent chip. Inert (`aria-hidden`, no pointer events, no tab stop) and gone below `lg`, where
 * the form is the only thing worth the screen.
 */
function ProductStill() {
  const plan: { title: string; where: string; done?: boolean; star?: boolean }[] = [
    { title: 'Send the Ridgeline invoice', where: 'Finance · today', star: true },
    { title: 'Finish the logo presentation', where: 'Ridgeline rebrand' },
    { title: 'Reply to Beacon about scope', where: 'Waiting since Monday' },
    { title: 'Weekly review', where: 'Done 9:40', done: true },
  ];
  const day = [
    { when: '09:00', what: 'Deep work: logo presentation' },
    { when: '14:00', what: 'Ridgeline call', now: true },
    { when: '16:30', what: 'Invoices and admin' },
  ];
  const projects = [
    { name: 'Ridgeline rebrand', meta: 'Due Friday', bar: 0.72 },
    { name: 'Beacon Health site', meta: '3 tasks waiting', bar: 0.4 },
    { name: 'Copper Row launch', meta: 'Starts next week', bar: 0.15 },
  ];

  return (
    // The sheet keeps its left corners and runs past the right edge of the window: the negative
    // margin eats the desk's own gutter, so there is no seam where it leaves.
    <aside aria-hidden className="relative hidden min-w-0 select-none ps-2 pt-10 lg:block">
      {/* THE UPLIFT STAYS ON THE RIGHT, and only on the right (user, 2026-09-25: "keep uplift in
          right as it is, only remove from left"). The form is the page; the product is an object
          lying on the desk beside it, and it runs off the right and the bottom of the window.
          What is INSIDE is deliberately oversized: about 1180px of app against a ~715px column,
          so a little under two thirds is visible and the rest carries on past the edge. Nothing
          is scaled down — a shrunken app is a picture of an app, and the point is that this is
          the real one, seen in part. */}
      <div className="sheet relative h-full overflow-hidden rounded-e-none rounded-b-none">
        {/* OVERSIZED, NOT SHRUNK. Measured off the reference: its interface renders about a third
            larger than life, which is what makes it read as "a big product, seen in part" rather
            than a thumbnail. So the page is laid out at its real measure and the whole thing is
            scaled from the top-left corner — every proportion, weight and hairline stays exactly
            as the app draws it, and about half of it lands past the right edge of the window. */}
        <div
          className="pointer-events-none absolute inset-y-0 start-0 w-[1100px] origin-top-left px-9 pt-8"
          style={{ transform: 'scale(1.3)' }}
          tabIndex={-1}
        >
          <header>
            <div className="mb-2 flex items-center gap-1.5">
              <Mark size={24} />
              <h2 className="font-editorial text-title-2 leading-none font-medium text-ink-800">Good evening, Alex.</h2>
            </div>
            <p className="text-ui text-ink-500">
              You’ve committed to <b className="font-medium text-ink-800">3 tasks</b>. Highlight:{' '}
              <span className="font-medium text-ink-800">Send the Ridgeline invoice.</span>
            </p>
          </header>

          <section className="mt-6">
            <Panel frame="shadow">
              <PanelHeader
                icon={<Icon icon={Flame} size={20} className="text-[var(--accent)]" />}
                title="Today’s highlight"
                summary="Do this first"
              />
              <PanelBody>
                <div className="flex w-full flex-col gap-2 px-[var(--panel-px)] py-4">
                  <span className="text-title-3 font-medium text-ink-900">Send the Ridgeline invoice</span>
                  <span className="flex items-center gap-3 text-caption text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-[var(--accent)]" />Finance
                    </span>
                    <span>15m</span>
                    <span>High</span>
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 border-t border-line-soft px-[var(--panel-px)] py-3">
                  <Button variant="secondary" size="sm" tabIndex={-1} icon={<Icon icon={Play} size={16} />}>Start focus</Button>
                  <Button variant="ghost" size="sm" tabIndex={-1} icon={<Icon icon={Check} size={16} />}>Mark done</Button>
                  <Button variant="ghost" size="sm" tabIndex={-1} iconRight={<Icon icon={ChevronRight} size={16} />}>Details</Button>
                </div>
              </PanelBody>
            </Panel>
          </section>

          <section className="mt-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={Sun} size={20} />} title="Today" summary="3 to do · 1 done" />
              <PanelBody>
                {plan.map((t, i) => (
                  <div key={t.title}
                    className={`flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)] ${i < plan.length - 1 ? 'border-b border-line-soft' : ''}`}>
                    <Checkbox checked={!!t.done} tabIndex={-1} />
                    <span className={`min-w-0 flex-1 truncate text-ui ${t.done ? 'text-ink-500 line-through' : 'text-ink-900'}`}>{t.title}</span>
                    <span className="shrink-0 text-caption text-ink-500">{t.where}</span>
                    {t.star && <Icon icon={Star} size={14} weight="fill" className="shrink-0 text-ink-700" />}
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </section>

          <section className="mt-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={CalendarIcon} size={20} />} title="Schedule" summary="Next at 14:00" />
              <PanelBody>
                {day.map((e, i) => (
                  <div key={e.when}
                    className={`flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)] ${i < day.length - 1 ? 'border-b border-line-soft' : ''}`}>
                    <span className="w-12 shrink-0 text-caption tabular-nums text-ink-500">{e.when}</span>
                    <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{e.what}</span>
                    {/* Where the day is now: the accent, on the one thing that means "here". */}
                    {e.now && <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-caption text-[var(--on-accent)]">Now</span>}
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </section>

          <section className="mt-5">
            <Panel frame="shadow">
              <PanelHeader icon={<Icon icon={Folder} size={20} />} title="Projects" summary="3 active" />
              <PanelBody>
                {projects.map((p, i) => (
                  <div key={p.name}
                    className={`flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)] ${i < projects.length - 1 ? 'border-b border-line-soft' : ''}`}>
                    <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{p.name}</span>
                    <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
                      <span className="block h-full rounded-full bg-ink-700" style={{ width: `${p.bar * 100}%` }} />
                    </span>
                    <span className="w-28 shrink-0 text-end text-caption text-ink-500">{p.meta}</span>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </section>
        </div>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  return <AuthScreen />;
}
