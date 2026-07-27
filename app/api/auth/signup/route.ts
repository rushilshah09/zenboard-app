// Server-side signup. Creates an already-confirmed user with the service key, so
// no confirmation email is sent (avoids Supabase's email rate limit entirely).
// The client then signs in to establish the session.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { credentialsSchema } from '@/lib/validation/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid details.' },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // mark confirmed; no email sent
  });

  if (error) {
    const friendly = /already|registered|exists/i.test(error.message)
      ? 'An account with this email already exists — sign in instead.'
      : error.message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  return NextResponse.json({ data: { ok: true } });
}
