// The dev-preview harnesses exist so a screen can be verified without a session
// — every page under here is a client component with hard-coded demo data, and
// none of them touch Supabase. That makes them harmless, but not PUBLIC: they
// were shipping to the live worker as 34 reachable URLs of half-built UI and
// fake numbers, which is scaffolding left on the outside of the building.
//
// `next dev` runs with NODE_ENV=development, so the harnesses stay exactly as
// they are for verification; anything else — the production build, the deployed
// worker — gets a 404.
import { notFound } from 'next/navigation';

export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return children;
}
