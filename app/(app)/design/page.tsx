// Design system — the DS portal. A living reference of every component the app
// ships: the side rail lists them (with real usage counts); the preview column
// renders live variants and the files each component is used in.
//
// ── IT IS AN INTERNAL TOOL, AND IT IS GATED (2026-09-30) ────────────────────
// This used to say "this page reads nothing user-scoped, so it needs no check of
// its own", and that reasoning confuses PRIVACY with AUDIENCE. Nothing here
// leaks anyone's data — and every paying customer could still type /design and
// land in our component catalogue, complete with usage counts and file paths.
// That is our workbench, shipped inside the product, on a route nothing links to
// and nobody outside the team was ever meant to find.
//
// The gate is the FIRST STATEMENT IN THE PAGE, not a layout above it, because a
// layout is not a gate — a route rendered under one can still be reached, which
// is the bug lib/auth.ts exists because of.
//
// It 404s rather than redirecting or showing a password door. The (app) layout
// has already established that the visitor is signed in, so the only question
// left is whether this address is any of their business; answering "it exists,
// but not for you" tells a stranger more than "there is nothing here". The
// password door in <AdminGate> is right for /admin/*, which someone on the team
// may need to open without a Supabase account — nobody reaches THIS page except
// from inside a signed-in session.
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { DsPortal } from '@/components/design-system/ds-portal';
import { PageStamp } from '@/components/shell/page-stamp';

export const metadata = { title: 'Design system, Zenboard', robots: { index: false, follow: false } };

export default async function DesignSystemPage() {
  const user = await currentUser();
  if (!isAdminEmail(user?.email)) notFound();
  return (
    <>
      <PageStamp />
      <DsPortal />
    </>
  );
}
