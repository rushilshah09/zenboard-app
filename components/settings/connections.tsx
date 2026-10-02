'use client';
// Settings → Connections. Connect Google Calendar (two-way) so events sync both
// ways. Connect runs Supabase's Google OAuth (the auth callback stores tokens +
// imports); Sync now pulls fresh changes via the stored token (no re-consent);
// Disconnect clears it. Status lives in profiles.preferences. Rendered as a DS
// provider row: icon well + name + live status line, actions on the trailing edge.
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, RefreshCw, Unlink, Sparkles, Copy, Key, Ellipsis } from "@/components/ds/icons";
import {
  Icon, Button, Alert, useConfirm,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  SettingsPaneHeader, SettingsSection, SettingsRow,
} from "@/components/ds/ui";
import { createClient } from '@/lib/supabase/client';
import { GCAL_SCOPES } from '@/lib/google-calendar';
import { disconnectGoogleCalendar, syncGoogleCalendar } from '@/lib/actions/google-calendar';
import { formatAgo } from '@/lib/date';
import { getMcpToken, createMcpToken, revokeMcpToken } from '@/lib/actions/mcp';

const ago = (iso: string | null) => formatAgo(iso, { precise: true }) ?? '';

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
    else setNote({ kind: 'error', text: 'Not connected. Connect first.' });
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
              : 'Two-way: events sync between Zenboard and Google.'
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

      <SettingsSection title="AI tools">
        <AiToolsRow />
      </SettingsSection>

      <p className="text-meta text-ink-500">Use the Google account that matches your Zenboard email.</p>
    </div>
  );
}

// ── Zenboard as a tool your AI can reach (MCP) ──────────────────────────────
//
// User: *"full access to my ai tools — i just have to say my raw thought and it
// holds all things."* Connect this and you can tell Claude "film the studio
// tour Tuesday" and it lands in Zenboard, without opening Zenboard.
//
// ── WHY THE TOKEN IS NEVER MINTED FOR YOU ──────────────────────────────────
// The calendar feed's token is created the first time you look, because a
// read-only view of your own schedule behind an unguessable URL is close to
// harmless. This one reads AND WRITES the whole workspace, so it exists only
// because someone asked. An account that never connects an AI tool never has a
// credential to leak.
//
// It is shown in full, every time, on purpose. The industry habit of showing a
// secret once and hiding it forever is right when the secret is stored hashed —
// it CANNOT be shown again. Here it is stored in `profiles.preferences` and can
// be, so pretending otherwise would only force a needless rotation every time
// someone sets up a second machine. What the copy says instead is what is
// actually true: anyone holding it can read and change your workspace.
function AiToolsRow() {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, confirmUI] = useConfirm();

  useEffect(() => {
    let alive = true;
    getMcpToken().then((r) => {
      if (!alive) return;
      if ('token' in r) setToken(r.token);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  async function mint(rotating: boolean) {
    if (rotating) {
      const okToGo = await confirm({
        title: 'Replace the connection key?',
        body: 'Every tool using the current key stops working straight away. You will need to paste the new one into each of them.',
        actionLabel: 'Replace key',
      });
      if (!okToGo) return;
    }
    setBusy(true); setErr(null);
    const r = await createMcpToken();
    setBusy(false);
    if ('error' in r) { setErr(r.error); return; }
    setToken(r.token);
  }

  async function revoke() {
    const okToGo = await confirm({
      title: 'Disconnect AI tools?',
      body: 'Anything using this key loses access to Zenboard immediately.',
      actionLabel: 'Disconnect',
    });
    if (!okToGo) return;
    setBusy(true); setErr(null);
    const r = await revokeMcpToken();
    setBusy(false);
    if ('error' in r) { setErr(r.error); return; }
    setToken(null);
  }

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setErr('Could not copy. Select the key and copy it by hand.'); }
  };

  return (
    <>
      <SettingsRow
        icon={<Icon icon={Sparkles} size={16} />}
        title="Claude and other AI tools"
        description={
          token
            ? 'Connected: your AI tools can capture thoughts and read what is on.'
            : 'Say a thought to your AI and have it land here. Reads and writes your workspace.'
        }
        control={
          !loaded ? null : token ? (
            <>
              <Button size="sm" icon={<Icon icon={Copy} size={14} />} disabled={busy} onClick={copy}>
                {copied ? 'Copied' : 'Copy key'}
              </Button>
              {/* Replace and Disconnect are both destructive and both rare, so
                  they sit behind the kebab rather than crowding the one control
                  anyone actually reaches for. */}
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Connection key options"
                  className="focus-ring grid size-7 place-items-center rounded-sm text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-900">
                  <Icon icon={Ellipsis} size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem icon={<Icon icon={RefreshCw} size={14} />} onSelect={() => mint(true)}>
                    Replace key
                  </DropdownMenuItem>
                  <DropdownMenuItem danger icon={<Icon icon={Unlink} size={14} />} onSelect={revoke}>
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="primary" size="sm" loading={busy} icon={<Icon icon={Key} size={14} />} onClick={() => mint(false)}>
              Connect
            </Button>
          )
        }
      />

      {token && (
        <div className="mt-2 flex flex-col gap-2">
          <code className="block overflow-x-auto rounded-md border border-line-strong bg-surface-sunken px-3 py-2 font-mono text-caption text-ink-800">
            {token}
          </code>
          <p className="text-meta text-ink-500">
            Anyone with this key can read and change your workspace. Add it to Claude Code with{' '}
            <code className="font-mono text-ink-700">claude mcp add --transport http zenboard {origin()}/api/mcp --header &quot;Authorization: Bearer &lt;key&gt;&quot;</code>
          </p>
        </div>
      )}

      {err && (
        <Alert variant="danger" live onDismiss={() => setErr(null)} className="my-2">{err}</Alert>
      )}
      {confirmUI}
    </>
  );
}

/** The deployment's own address, so the instruction is copy-pasteable as-is. */
function origin() {
  return typeof window === 'undefined' ? 'https://your-zenboard-url' : window.location.origin;
}
