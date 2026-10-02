'use client';
// ── THE DOOR ────────────────────────────────────────────────────────────────
//
// What someone sees at /admin/waitlist without a valid cookie. A password, and nothing else: the
// waitlist is not in anybody's workspace, so the person who runs the platform should not need a
// Supabase account open to read it.
//
// It says NOTHING about what is behind it and nothing about why an attempt failed — not whether a
// password is configured, not how close a guess was. The one thing it does say is when the
// deployment has no password set at all, because that is a configuration mistake the owner needs
// to see rather than a secret worth keeping from them.

import * as React from 'react';
import { Field, TextInput, Button } from '@/components/ds/ui';
import { signInAdmin } from '@/lib/actions/admin';

export function AdminGate() {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await signInAdmin(password);
      if ('error' in r) { setError(r.error); setPassword(''); return; }
      // The cookie is set; the page re-renders behind this one.
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[380px] flex-col justify-center px-6">
      <h1 className="text-title font-editorial text-ink-900">Waitlist</h1>
      <p className="mt-1 text-body text-ink-600">Enter the admin password to see the list.</p>
      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3">
        <Field label="Password" error={error ?? undefined}>
          <TextInput
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="current-password"
            autoFocus
            reveal
            size="lg"
          />
        </Field>
        <Button type="submit" variant="brand" size="lg" fullWidth loading={pending}>Open</Button>
      </form>
    </main>
  );
}
