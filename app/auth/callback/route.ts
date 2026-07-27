// OAuth / email-confirmation callback: exchange the code for a session cookie,
// then continue to `next`. When `next` is a Google Calendar connect (contains
// gcal=1), the exchange also yields a Google provider_token — use it to import
// the calendar right here (the one place the token is reliably available). PRD §10.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { importGoogleEvents, storeConnection } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/today';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Calendar connect: import using the freshly-minted Google token.
      if (/[?&]gcal=1/.test(next) && data.session?.provider_token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Persist tokens server-side (service-role) for refresh + write-back.
          await storeConnection(createServiceClient(), user.id, {
            accessToken: data.session.provider_token,
            refreshToken: data.session.provider_refresh_token ?? null,
            expiresInSec: 3600,
            email: user.email ?? null,
          });
          const result = await importGoogleEvents(supabase, user.id, data.session.provider_token);
          const sep = next.includes('?') ? '&' : '?';
          const status = 'error' in result ? `error&msg=${encodeURIComponent(result.error)}` : `ok&count=${result.count}`;
          return NextResponse.redirect(`${origin}${next}${sep}gcalsync=${status}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
