// Library was renamed to Documents — keep old links working.
//
// The redirect used to be unconditional, which quietly threw away the query
// string: `/library?page=<id>` landed on the Documents hub with no idea which
// doc you meant. Now that `?page=` is a real deep link (§7J) the id is worth
// carrying across, so any old bookmark still opens the document it named.
import { redirect } from 'next/navigation';

export default async function LibraryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const query = qs.toString();
  redirect(query ? `/documents?${query}` : '/documents');
}
