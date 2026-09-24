'use client';
// Auth — sign in and create account, one screen with a mode toggle.
// Email/password only. Signup goes through the server route (auto-confirmed, no
// email), then we sign in to establish the session.
//
// ── REBUILT ON THE DESIGN SYSTEM (2026-09-08) ──────────────────────────────
// This screen was 170 lines of inline styles that re-implemented things the DS
// already owns, and each re-implementation was slightly worse than the original:
//
//   · The submit button was a raw <button> painting `var(--primary)` by hand —
//     so it had no focus ring, no press motion, and signalled "disabled" with
//     `opacity: 0.5`, which the constitution forbids and which makes a control
//     look broken rather than unavailable.
//   · The password reveal was a hand-built eye toggle. `TextInput` ships
//     `reveal` — the same control, already labelled and already keyboard-safe.
//   · The labels were hand-built <label> + <span> pairs. `Field` ships that,
//     with the helper/error wiring (aria-describedby) those pairs never had.
//
// It is the first screen anyone sees, so it is the last place to hand-roll.
//
// ── IT SHOWED NOTHING (2026-09-23) ─────────────────────────────────────────
// "This also looks so boring" — a 400px box in the middle of a 1440px dark
// page, and nothing else on the screen. Two problems, one cause:
//
//   · The screen said nothing about the product. Every sign-up form on earth
//     has an email field and a password field; if that is ALL a screen has,
//     the screen is the form, and a form is not interesting.
//   · What copy there was, was slogans — "Two minutes from here to a calmer
//     day.", "Sign in to your quiet workspace." — which the house forbids
//     ("no slogans, no poetry in UI copy") and which say nothing true.
//
// So the page is a split: the form on the left, and on the right the PRODUCT
// AT REST — today's plan, drawn with the app's own Panel, rows and checkbox.
// Not an illustration, not a gradient, not a tilted screenshot: the same
// components the app ships, holding sample content, inert. It shows what
// Zenboard is in the one place a person has no other way to find out, and it
// cannot drift from the product because it IS the product's parts.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-url';
import { Mail, Star, Sun, Calendar as CalendarIcon } from '@/components/ds/icons';
import { createClient } from '@/lib/supabase/client';
import { Mark, Icon, Button, TextInput, Field, Checkbox, Panel, PanelHeader, PanelBody } from '@/components/ds/ui';

function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = email.includes('@') && pw.length >= 8;
  const isSignup = mode === 'signup';

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
    // Two columns from `lg` — the form, and the product beside it. Below that the
    // still drops away entirely rather than stacking: on a phone the only thing
    // worth showing is the form, and a picture above it would push it off screen.
    <div className="absolute inset-0 grid grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-2 px-7 py-[18px]">
          <Mark size={20} />
          <span className="font-display text-h2 font-semibold tracking-[-0.01em]">Zenboard</span>
          <div className="flex-1" />
          <span className="text-caption text-ink-600">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Button
              variant="link"
              size="sm"
              onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}
            >
              {isSignup ? 'Sign in' : 'Create account'}
            </Button>
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-15">
          {/* No card. The form IS the page here — a 400px box centred in a dark
              field is what made the screen read as a dialog with nothing behind it. */}
          <div className="w-[360px] max-w-full [animation:blurin_var(--duration-slow)_var(--ease-out-quiet)]">
            <h1 className="font-display text-h1 font-medium tracking-[-0.02em] text-ink-900">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>

          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="flex flex-col gap-4 pt-6">
              <Field label="Email">
                <TextInput
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
                helper={isSignup ? 'At least 8 characters' : undefined}
                error={isSignup && pw.length > 0 && pw.length < 8 ? 'At least 8 characters' : undefined}
              >
                <TextInput
                  reveal
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  placeholder="8+ characters"
                />
              </Field>

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
                type="submit" variant="primary" size="lg" fullWidth
                disabled={!ready} loading={busy}
              >
                {isSignup ? 'Create account' : 'Sign in'}
              </Button>

              {isSignup && (
                <p className="text-label leading-relaxed text-ink-600">
                  By continuing you agree to the Terms and Privacy Policy.
                </p>
              )}
            </div>
          </form>
          </div>
        </div>
      </div>

      <ProductStill />
    </div>
  );
}

/**
 * The product at rest, beside the form: one day's plan in the app's own Panel, with the
 * app's rows, checkbox and star. Inert and `aria-hidden` — it is a picture, and a screen
 * reader should hear the form, not a list of someone else's tasks.
 */
function ProductStill() {
  const plan: { title: string; where: string; done?: boolean; star?: boolean }[] = [
    { title: 'Send the Balluji invoice', where: 'Finance · today', star: true },
    { title: 'Finish the logo presentation', where: 'Balluji rebrand' },
    { title: 'Reply to TechSpark about scope', where: 'Waiting since Monday' },
    { title: 'Weekly review', where: 'Done 9:40', done: true },
  ];
  // The day's second half: the same card, holding time instead of tasks. Two cards, because one
  // card alone in a half-page column is the emptiness this screen is fixing — and because the plan
  // and the day's shape sitting on one page is the actual idea of Home.
  const day = [
    { when: '09:00', what: 'Studio time — logo presentation' },
    { when: '14:00', what: 'Balluji call', now: true },
    { when: '16:30', what: 'Invoices and admin' },
  ];
  return (
    <aside aria-hidden className="relative hidden min-w-0 select-none items-center justify-center overflow-hidden border-s border-line bg-background px-10 lg:flex">
      <div className="pointer-events-none flex w-full max-w-[460px] flex-col gap-4">
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

        <Panel frame="shadow">
          <PanelHeader icon={<Icon icon={CalendarIcon} size={20} />} title="Schedule" summary="Next at 14:00" />
          <PanelBody>
            {day.map((e, i) => (
              <div key={e.when}
                className={`flex h-[var(--row-task)] items-center gap-3 px-[var(--panel-px)] ${i < day.length - 1 ? 'border-b border-line-soft' : ''}`}>
                <span className="w-12 shrink-0 text-caption tabular-nums text-ink-500">{e.when}</span>
                <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{e.what}</span>
                {/* The one accent on the screen after the submit button: where the day is now. */}
                {e.now && <span className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-caption text-[var(--on-accent)]">Now</span>}
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  return <AuthScreen />;
}
