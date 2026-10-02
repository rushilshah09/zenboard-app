// Dev-only harness for the navigation skeleton — the thing every /(app) route
// shows while its data is in flight. It is otherwise unviewable without timing a
// real navigation against a slow connection, which is not a way to check spacing.
import { AppLoading } from '@/components/shell/app-loading';

export default function LoadingHarness() {
  return (
    <div className="min-h-screen bg-paper">
      <AppLoading />
    </div>
  );
}
