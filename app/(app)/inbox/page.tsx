// The Inbox is a view inside Tasks, not a page of its own — there were two of
// them, this one and the Tasks rail's, listing the same rows from the same query.
// This one owned Triage; that flow moved into the Tasks view with the merge, so
// nothing was lost along with the page.
//
// The route stays, as a redirect rather than a 404: bookmarks, the "g i" chord,
// and any link written before the merge all still point here.
import { redirect } from 'next/navigation';

export default function InboxPage() {
  redirect('/tasks?view=inbox');
}
