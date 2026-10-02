'use client';
// ── THE WAITLIST FORM ───────────────────────────────────────────────────────
//
// One ask (an email) and two optional extras: the handle they want held for them, and a name.
// The handle is claimed AS they join (user, 2026-09-30) rather than afterwards — one insert, so
// joining and claiming cannot half-happen and no capability token has to reach the browser.
//
// WHAT THIS FILE IS CAREFUL ABOUT
//
// IT NEVER LOSES WHAT SOMEBODY TYPED. The action returns `{ error }` rather than throwing, so a
// failure leaves everything in the fields and says what happened — a rejected promise is a page
// with no message on it, which is the failure mode this product has a rule against.
//
// THE HANDLE'S SHAPE IS CHECKED HERE, its availability on the server. Asking whether `ab` is free
// when the rule says three characters is a round trip to be told what we already knew, and it makes
// the field feel slow exactly when someone is deciding. Either answer is ADVICE: two people can be
// told "free" in the same second, and the unique index settles it on submit.
//
// THE GUARDS ARE INVISIBLE TO A PERSON. A honeypot field no human can reach, and the moment the
// form was opened. Both are re-checked on the server; neither ever shows anyone an error.

import * as React from 'react';
import { ArrowRight, Check, X } from '@/components/ds/icons';
import { Field, Icon, TextInput, button } from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { joinWaitlist, usernameAvailable } from '@/lib/actions/waitlist';
import { emailLooksValid, normaliseUsername, usernameProblem, type WaitlistSource } from '@/lib/waitlist';
import { WaitlistSuccess } from './waitlist-success';

/** How long a person stops typing before the handle is checked. */
const SETTLE_MS = 350;

type Handle = { kind: 'idle' | 'checking' | 'free' | 'taken' } | { kind: 'bad'; why: string };

export function WaitlistForm({ source = 'site', className }: {
  source?: WaitlistSource;
  className?: string;
}) {
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [name, setName] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');
  const [handle, setHandle] = React.useState<Handle>({ kind: 'idle' });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<
    { id: string; number: number; name: string | null; username: string | null; already: boolean } | null
  >(null);

  // Stamped once, on the client, so it is the moment THIS person opened the form.
  const startedAt = React.useRef<string>('');
  React.useEffect(() => { startedAt.current = new Date().toISOString(); }, []);

  // The latest request wins: a slow answer for an earlier handle must not overwrite a newer one.
  const seq = React.useRef(0);
  React.useEffect(() => {
    const v = normaliseUsername(username);
    if (!v) { setHandle({ kind: 'idle' }); return; }
    const why = usernameProblem(v);
    if (why) { setHandle({ kind: 'bad', why }); return; }
    setHandle({ kind: 'checking' });
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      const r = await usernameAvailable(v);
      if (mine !== seq.current) return;
      if ('error' in r) { setHandle({ kind: 'bad', why: r.error }); return; }
      setHandle(r.free ? { kind: 'free' } : { kind: 'taken' });
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [username]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!emailLooksValid(email)) { setError('That doesn’t look like an email address.'); return; }
    if (username && handle.kind === 'bad') { setError(handle.why); return; }
    startTransition(async () => {
      const r = await joinWaitlist({ email, name, username, source, honeypot, startedAt: startedAt.current });
      if ('error' in r) { setError(r.error); return; }
      setResult({ id: r.id, number: r.number, name: r.name, username: r.username, already: r.already });
    });
  };

  // THE SUCCESS IS A TAKEOVER, NOT A SWAP IN PLACE. Joining ends the task, so the white page gives
  // way to a black screen with the ticket on it rather than the form quietly turning into a receipt
  // with the rest of the page still around it.
  if (result) {
    return (
      <WaitlistSuccess
        number={result.number}
        name={result.name}
        username={result.username}
        already={result.already}
        onClose={() => setResult(null)}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn('w-full max-w-[420px]', className)}>
      <div className="flex flex-col gap-3 text-start">
        {/* The Field owns the invalid state: it puts `aria-invalid` on the input through context and
            the input paints its own error border from that. Passing a tone here would be a second
            source for one fact. */}
        <Field label="Email" error={error ?? undefined}>
          <TextInput
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="you@yourstudio.com"
            autoComplete="email"
            required
            size="lg"
          />
        </Field>

        <Field label="Username" optional error={handle.kind === 'bad' ? handle.why : undefined}>
          <TextInput
            name="username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            prefix="@"
            placeholder="yourname"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            size="lg"
          />
        </Field>
        {/* The answer sits under the field, where a person is already looking while they type. */}
        <p aria-live="polite" className="-mt-2 min-h-5 text-caption">
          {handle.kind === 'checking' && <span className="text-ink-500">Checking…</span>}
          {handle.kind === 'free' && (
            <span className="inline-flex items-center gap-1 text-success-600">
              <Icon icon={Check} size={14} />@{normaliseUsername(username)} is yours
            </span>
          )}
          {handle.kind === 'taken' && (
            <span className="inline-flex items-center gap-1 text-danger-600">
              <Icon icon={X} size={14} />Already taken
            </span>
          )}
          {handle.kind === 'idle' && <span className="text-ink-500">Held for you until launch.</span>}
        </p>

        <Field label="Name" optional>
          <TextInput
            name="name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Jane Doe"
            autoComplete="name"
            maxLength={80}
            size="lg"
          />
        </Field>

        {/* The honeypot. Off screen, out of the tab order, hidden from assistive tech: only something
            reading the markup can find it, and anything typed here is discarded server-side. */}
        <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="zb-company">Company</label>
          <input
            id="zb-company" name="company" type="text" tabIndex={-1} autoComplete="off"
            value={honeypot} onChange={(e) => setHoneypot(e.currentTarget.value)}
          />
        </div>

        <button type="submit" data-loading={pending ? '' : undefined} className={cn(button({ variant: 'brand', size: 'lg' }), 'w-full')}>
          {pending ? 'Joining…' : 'Join the waitlist'}
          {!pending && <Icon icon={ArrowRight} size={16} className="ml-1.5" />}
        </button>
        <p className="text-center text-caption text-ink-500">
          No spam. One email when your place comes up.
        </p>
      </div>
    </form>
  );
}
