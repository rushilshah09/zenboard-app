'use client';
// Owner Requests inbox — the internal half of the Client Request → Task lifecycle
// (CLIENT_PORTAL_MASTER_PLAN.md §6). Each request carries a decision state
// (pending · needs_info · approved · declined). The owner can Approve → task
// (two-way linked), Decline with a reason the client reads, or Request more info
// (opens a client-facing thread). Delivery state ("In progress"/"Completed") is
// derived from the linked task, so the badge shows exactly what the client sees.
//
// DS-built: §4.7 Badge, §5.1 Button, §4.14 Textarea, §4.18 Switch, §4.45
// EmptyState. Reads from RLS-scoped tables; portal inserts come from the server.
import { useEffect, useState } from 'react';
import { Inbox, Check, X, MessageSquare, RotateCcw, ArrowUpRight, ChevronDown, ChevronRight, Send } from "@/components/ds/icons";
import { Icon, Button, Badge, EmptyState, Textarea, Switch, type BadgeStatus } from '@/components/ds/ui';
import {
  approveRequest, declineRequest, requestMoreInfo, reopenRequest, postRequestMessage,
} from '@/lib/actions/portal';
import { clientRequestLabel, CLIENT_LABEL_TONE } from '@/lib/request-status';
import { RequestThread, type ThreadMessage } from '@/components/portal/request-thread';
import { cn } from '@/lib/cn';
import type { PRequest, PRequestMessage } from '@/components/projects/projects-workspace';

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type Mode = null | 'decline' | 'info';

export function RequestsTab({
  requests: initial, messages: initMessages, taskDone, portalSupported, onAccepted,
}: {
  requests: PRequest[];
  messages: PRequestMessage[];
  taskDone: Record<string, boolean>;
  portalSupported: boolean;
  onAccepted?: (taskId: string) => void;
}) {
  const [requests, setRequests] = useState(initial);
  const [messages, setMessages] = useState(initMessages);
  useEffect(() => { setRequests(initial); }, [initial]);
  useEffect(() => { setMessages(initMessages); }, [initMessages]);

  const patch = (id: string, p: Partial<PRequest>) =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  if (!portalSupported) {
    return <Empty title="Requests" line="Apply migration 0006_portal.sql to receive client requests." />;
  }
  if (requests.length === 0) {
    return <Empty title="No requests yet" line="When your client sends a request from the portal, it lands here to approve, decline, or ask about." />;
  }

  return (
    <div className="grid gap-2.5">
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          req={r}
          messages={messages.filter((m) => m.request_id === r.id)}
          taskDone={r.task_id ? (taskDone[r.task_id] ?? false) : null}
          onPatch={(p) => patch(r.id, p)}
          onAppendMessage={(m) => setMessages((ms) => [...ms, m])}
          onAccepted={onAccepted}
        />
      ))}
    </div>
  );
}

function RequestCard({
  req, messages, taskDone, onPatch, onAppendMessage, onAccepted,
}: {
  req: PRequest;
  messages: PRequestMessage[];
  taskDone: boolean | null;
  onPatch: (p: Partial<PRequest>) => void;
  onAppendMessage: (m: PRequestMessage) => void;
  onAccepted?: (taskId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);           // thread expanded
  const [note, setNote] = useState('');
  const [noteToClient, setNoteToClient] = useState(false);

  const label = clientRequestLabel(req.status, taskDone);
  const closed = req.status === 'declined';
  const approved = req.status === 'approved';

  const thread: ThreadMessage[] = messages
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((m) => ({ author: m.author, body: m.body, createdAt: m.created_at, internal: !m.client_facing }));

  async function approve() {
    setBusy(true);
    const res = await approveRequest(req.id);
    setBusy(false);
    if ('error' in res) return;
    onPatch({ status: 'approved', task_id: res.taskId });
    onAccepted?.(res.taskId);
  }

  async function confirmDecline() {
    const reason = draft.trim();
    if (reason.length < 2) return;
    setBusy(true);
    const res = await declineRequest(req.id, reason);
    setBusy(false);
    if ('error' in res) return;
    onPatch({ status: 'declined', resolution_note: reason });
    setMode(null); setDraft('');
  }

  async function confirmInfo() {
    const msg = draft.trim();
    if (msg.length < 2) return;
    setBusy(true);
    const res = await requestMoreInfo(req.id, msg);
    setBusy(false);
    if ('error' in res) return;
    onPatch({ status: 'needs_info' });
    onAppendMessage({ id: `tmp-${Date.now()}`, request_id: req.id, author: 'team', body: msg, client_facing: true, created_at: new Date().toISOString() });
    setMode(null); setDraft(''); setOpen(true);
  }

  async function reopen() {
    setBusy(true);
    const res = await reopenRequest(req.id);
    setBusy(false);
    if ('error' in res) return;
    onPatch({ status: 'pending', resolution_note: null });
  }

  async function sendNote() {
    const body = note.trim();
    if (body.length < 1) return;
    setBusy(true);
    const res = await postRequestMessage(req.id, body, noteToClient);
    setBusy(false);
    if ('error' in res) return;
    onAppendMessage({ id: `tmp-${Date.now()}`, request_id: req.id, author: 'team', body, client_facing: noteToClient, created_at: new Date().toISOString() });
    setNote('');
  }

  return (
    <div className={cn('rounded-lg border bg-surface-raised px-4 py-3.5', closed ? 'border-line-soft' : 'border-line-strong')}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn('text-ui font-medium', closed ? 'text-ink-600' : 'text-ink-900')}>{req.name?.trim() || 'Client'}</span>
        <Badge status={CLIENT_LABEL_TONE[label] as BadgeStatus}>{label}</Badge>
        <span className="flex-1" />
        <span className="text-caption tabular-nums text-ink-500">{relTime(req.created_at)}</span>
      </div>

      <p className={cn('whitespace-pre-wrap text-body leading-relaxed', closed ? 'text-ink-500' : 'text-ink-800')}>{req.body}</p>

      {/* Decline reason — the client reads this exact text. */}
      {closed && req.resolution_note && (
        <div className="mt-2.5 rounded-md border border-line-soft bg-surface-sunken px-3 py-2">
          <span className="text-overline uppercase text-ink-500">Reason sent to client</span>
          <p className="mt-0.5 whitespace-pre-wrap text-ui text-ink-700">{req.resolution_note}</p>
        </div>
      )}

      {/* Linked task chip — the return path. */}
      {approved && req.task_id && (
        <button
          onClick={() => onAccepted?.(req.task_id!)}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-surface px-2.5 py-1.5 text-caption text-ink-700 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Icon icon={ArrowUpRight} size={13} />
          <span>Linked task · {taskDone ? 'Completed' : 'In progress'}</span>
        </button>
      )}

      {/* Thread toggle */}
      {thread.length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2.5 inline-flex items-center gap-1 text-caption text-ink-500 transition-colors hover:text-ink-800"
        >
          <Icon icon={open ? ChevronDown : ChevronRight} size={13} />
          {thread.length} {thread.length === 1 ? 'message' : 'messages'}
        </button>
      )}
      {open && thread.length > 0 && <RequestThread messages={thread} className="mt-2" />}

      {/* Inline reason / question form */}
      {mode && (
        <div className="mt-2.5 grid gap-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={mode === 'decline' ? 'A short reason the client will see…' : 'What do you need from the client?'}
          />
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'decline' ? 'danger' : 'secondary'} loading={busy} onClick={mode === 'decline' ? confirmDecline : confirmInfo}>
              {mode === 'decline' ? 'Decline request' : 'Send to client'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode(null); setDraft(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Primary actions by decision state */}
      {!mode && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {(req.status === 'pending' || req.status === 'needs_info') && (
            <>
              <Button size="sm" variant="secondary" icon={<Icon icon={Check} size={14} />} loading={busy} onClick={approve}>Approve as task</Button>
              <Button size="sm" variant="ghost" icon={<Icon icon={MessageSquare} size={14} />} onClick={() => { setMode('info'); setDraft(''); }}>Request info</Button>
              <Button size="sm" variant="ghost" icon={<Icon icon={X} size={14} />} onClick={() => { setMode('decline'); setDraft(''); }}>Decline</Button>
            </>
          )}
          {closed && (
            <Button size="sm" variant="ghost" icon={<Icon icon={RotateCcw} size={14} />} loading={busy} onClick={reopen}>Reopen</Button>
          )}
          {(approved || open) && (
            <button onClick={() => setOpen((o) => !o)} className="text-caption text-ink-500 transition-colors hover:text-ink-800">
              {open ? 'Hide notes' : 'Add note'}
            </button>
          )}
        </div>
      )}

      {/* Note composer — internal by default, or push a message to the client. */}
      {open && (
        <div className="mt-2.5 grid gap-2 border-t border-line-soft pt-2.5">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note or message…" />
          <div className="flex items-center justify-between">
            <Switch checked={noteToClient} onCheckedChange={setNoteToClient} label={<span className="text-caption text-ink-600">Visible to client</span>} />
            <Button size="sm" variant="secondary" icon={<Icon icon={Send} size={13} />} loading={busy} onClick={sendNote}>{noteToClient ? 'Send' : 'Save note'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong">
      <EmptyState size="inline" illustration={<Icon icon={Inbox} size={20} />} title={title} description={line} />
    </div>
  );
}
