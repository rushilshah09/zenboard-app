'use client';
// Auth — matches the design's account-flow (centered on canvas, no card chrome).
// Email/password only. Signup goes through the server route (auto-confirmed, no
// email), then we sign in to establish the session.
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Eye, EyeOff, ArrowRight } from "@/components/ds/icons";
import { createClient } from '@/lib/supabase/client';
import { Mark, Icon } from "@/components/ds/ui";

function AuthInput({
  icon,
  right,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: typeof Mail; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--paper-2)', border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-lg)', padding: '0 12px', height: 46,
      }}
    >
      {icon && <Icon icon={icon} size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
      <input
        {...props}
        style={{
          flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
          background: 'transparent', fontSize: 'var(--text-body-size)', color: 'var(--ink)', fontFamily: 'inherit',
        }}
      />
      {right}
    </div>
  );
}

function AuthScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/today';

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
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
      // New accounts go through first-run onboarding (unless a specific next was set).
      const dest = isSignup && !params.get('next') ? '/onboarding' : next;
      router.push(dest);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--canvas)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mark size={20} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2-size)', fontWeight: 600, letterSpacing: '-0.01em' }}>Zenboard</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <button
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--accent-text)', fontWeight: 500 }}
          >
            {isSignup ? 'Sign in' : 'Create account'}
          </button>
        </span>
      </div>

      {/* Centered content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px 60px' }}>
        <div style={{ width: 380, animation: 'blurin 360ms ease-out' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-size)', fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 10px', textAlign: 'center', lineHeight: 1.15 }}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 'var(--text-body-lg-size)', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.55 }}>
            {isSignup ? 'Two minutes from here to a calmer day.' : 'Sign in to your quiet workspace.'}
          </p>

          <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--ink-2)' }}>Email</span>
              <AuthInput icon={Mail} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--ink-2)' }}>Password</span>
              <AuthInput
                type={showPw ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="8+ characters"
                right={
                  <button type="button" onClick={() => setShowPw((s) => !s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)', display: 'flex' }} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    <Icon icon={showPw ? EyeOff : Eye} size={16} />
                  </button>
                }
              />
              {isSignup && pw.length > 0 && pw.length < 8 && (
                <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>At least 8 characters</span>
              )}
            </label>

            {error && <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)', margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={!ready || busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', height: 46, marginTop: 4,
                background: 'var(--primary)', color: 'var(--on-primary)',
                border: 'none', borderRadius: 'var(--r-lg)', cursor: ready && !busy ? 'pointer' : 'not-allowed',
                fontSize: 'var(--text-body-size)', fontWeight: 600, fontFamily: 'inherit',
                opacity: ready && !busy ? 1 : 0.5, transition: 'opacity 140ms, background 140ms',
              }}
            >
              {busy ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'}
              {!busy && <Icon icon={ArrowRight} size={16} />}
            </button>
          </form>

          {isSignup && (
            <p style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-secondary)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
              By continuing you agree to the Terms and Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: 'var(--canvas)' }} />}>
      <AuthScreen />
    </Suspense>
  );
}
