// Server Supabase client for Server Components, Server Actions and route handlers.
// Reads the session from cookies (Next 16: cookies() is async).
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
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
}

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
