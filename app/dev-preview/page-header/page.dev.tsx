// Dev-only harness for THE page header. Mounts the real AppShell so the whole
// two-header composition is under test, not the row in isolation:
//
//   GLOBAL app header  — names the CURRENT PAGE, plus the actions that work
//                        everywhere (search · plan · bell · focus · + New).
//   PAGE header        — that page's own actions, ending with its primary. It does
//                        NOT repeat the page name; it carries a scope label only
//                        where the page genuinely has one ("July 2026", "Today").
//
// `?v=` switches the variant:
//   plain (default — actions only, the common case) · lead (‹ › stepper + scope)
//   · scope (scope + inline subtitle) · many (crowded row) · bare (no hairline)
//
// A SERVER page so the variant can be read from `searchParams` and passed down.
// Using `useSearchParams` in the client harness would need a <Suspense> wrapper,
// and that parked the whole subtree in React's hidden streaming container.
// 404s in prod.
import { notFound } from 'next/navigation';
import { PageHeaderHarness } from './harness';

export const dynamic = 'force-dynamic';

export default async function PageHeaderPreview({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { v } = await searchParams;
  return <PageHeaderHarness v={v} />;
}
