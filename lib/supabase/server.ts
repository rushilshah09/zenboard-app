// Server Supabase client for Server Components, Server Actions and route handlers.
// Reads the session from cookies (Next 16: cookies() is async).
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// `cache()` makes this ONE client per request, shared by the layout, the page and
// every loader beneath them — which is what lets the getUser memo below work.
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — safe to ignore; the
            // middleware refreshes the session cookie on the next request.
          }
        },
      },
    },
  );

  // `auth.getUser()` is a NETWORK CALL to /auth/v1/user — it asks the Auth server
  // to verify the JWT rather than decoding the cookie locally. Measured at
  // ~220ms from here, and this app called it THREE times to render Home: once in
  // the (app) layout, once in the page's loader, once inside userTimezone().
  // That is two thirds of a second spent asking the same question three times.
  //
  // So the first caller in a request does the round trip and everyone else gets
  // that same promise. Safe because the client is per-request (see cache above),
  // and because nothing on the server mutates auth — sign-in runs in the browser
  // client (app/login/page.tsx is 'use client'), so there is no in-request moment
  // where the answer legitimately changes.
  const verify = client.auth.getUser.bind(client.auth);
  let pending: ReturnType<typeof verify> | null = null;
  client.auth.getUser = ((jwt?: string) => {
    // An explicit token is a different question — never serve it from the memo.
    if (jwt !== undefined) return verify(jwt);
    return (pending ??= verify());
  }) as typeof client.auth.getUser;

  return client;
});

// Privileged client (service role) — server-only, bypasses RLS. Use sparingly:
// portal token validation, admin tasks. Never import into client code.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
