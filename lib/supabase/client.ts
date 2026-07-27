// Browser Supabase client (uses the logged-in user's session; RLS-protected).
// Use this only in Client Components for reads/realtime. All writes and
// third-party calls go through server actions / route handlers.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
