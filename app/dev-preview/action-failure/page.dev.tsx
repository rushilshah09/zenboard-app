// Dev-only harness for the action-failure net — a SERVER component on purpose.
//
// Every other harness is a client page with hard-coded data, which cannot test
// this: the net's remedy for a server failure is `router.refresh()`, and a
// refresh only changes anything when the rows come from a server render. Here
// they do, so the round trip is the real one — the throwing action leaves the
// server's rows untouched, the refresh re-renders this page, `useServerState`
// sees new props, and the optimistic tick has to disappear.
import { readRows } from './actions.dev';
import { ActionFailureHarness } from './harness.dev';

export const dynamic = 'force-dynamic';

export default async function ActionFailurePreviewPage() {
  return <ActionFailureHarness initial={await readRows()} />;
}
