// Week is now a view inside Tasks (List ⇄ Week). Redirect old links in, keeping
// any week offset (?w=).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const w = sp.w ? `&w=${encodeURIComponent(sp.w)}` : '';
  redirect(`/tasks?view=week${w}`);
}
