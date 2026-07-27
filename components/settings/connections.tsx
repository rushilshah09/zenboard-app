'use client';
// Settings → Connections. Connect Google Calendar (two-way) so events sync both
// ways. Connect runs Supabase's Google OAuth (the auth callback stores tokens +
// imports); Sync now pulls fresh changes via the stored token (no re-consent);
// Disconnect clears it. Status lives in profiles.preferences. Rendered as a DS
// provider row: icon well + name + live status line, actions on the trailing edge.
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, RefreshCw, Unlink } from "@/components/ds/icons";
import {
  Icon, Button, Alert,
  SettingsPaneHeader, SettingsSection, SettingsRow,
} from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';
import { GCAL_SCOPES } from '@/lib/google-calendar';
import { disconnectGoogleCalendar, syncGoogleCalendar } from '@/lib/actions/google-calendar';

const ago = (iso: string | null) => {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function Connections({ connected, lastSynced, eventCount }: { connected: boolean; lastSynced: string | null; eventCount: number | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Surface the result of a just-completed OAuth round-trip, then clean the URL.
  useEffect(() => {
    const sync = params.get('gcalsync');
    if (!sync) return;
    const surface = () => {
      if (sync === 'ok') setNote({ kind: 'ok', text: `Synced ${params.get('count') ?? ''} events from Google Calendar.` });
      else if (sync === 'error') setNote({ kind: 'error', text: params.get('msg') || 'Could not sync Google Calendar.' });
    };
    surface();
    router.replace('/settings');
    router.refresh();
  }, [params, router]);

  // Connect + Sync are the same OAuth round-trip; Google is silent after the first grant.
  async function connect() {
    setBusy(true);
    setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GCAL_SCOPES,
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/settings?gcal=1')}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) { setBusy(false); setNote({ kind: 'error', text: error.message }); }
    // otherwise the browser is navigating to Google
  }

  // Pull fresh Google changes using the stored token — no OAuth redirect.
  async function syncNow() {
    setBusy(true);
    setNote(null);
    const res = await syncGoogleCalendar();
    setBusy(false);
    if ('error' in res) setNote({ kind: 'error', text: res.error });
    else if ('ok' in res) { setNote({ kind: 'ok', text: `Synced ${res.count} events from Google.` }); router.refresh(); }
    else setNote({ kind: 'error', text: 'Not connected — connect first.' });
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectGoogleCalendar();
    setBusy(false);
    if ('error' in res) setNote({ kind: 'error', text: res.error });
    else { setNote({ kind: 'ok', text: 'Disconnected Google Calendar.' }); router.refresh(); }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsPaneHeader title="Connections" description="Sync Zenboard with the tools you already use." />

      <SettingsSection title="Calendar">
        <SettingsRow
          icon={<Icon icon={Calendar} size={16} />}
          title="Google Calendar"
          description={
            connected
              ? <>Connected{lastSynced ? ` · synced ${ago(lastSynced)}` : ''}{eventCount != null ? ` · ${eventCount} events` : ''}</>
              : 'Two-way — events sync between Zenboard and Google.'
          }
          control={
            connected ? (
              <>
                <Button size="sm" icon={<Icon icon={RefreshCw} size={14} />} loading={busy} onClick={syncNow}>
                  Sync now
                </Button>
                <Button variant="ghost" size="sm" icon={<Icon icon={Unlink} size={14} />} disabled={busy} onClick={disconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" loading={busy} onClick={connect}>
                Connect
              </Button>
            )
          }
        />
        {note && (
          <Alert variant={note.kind === 'ok' ? 'success' : 'danger'} live onDismiss={() => setNote(null)} className="my-2">
            {note.text}
          </Alert>
        )}
      </SettingsSection>

      <p className="text-meta text-ink-500">Use the Google account that matches your Zenboard email.</p>
    </div>
  );
}
