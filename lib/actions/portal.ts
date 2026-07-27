'use server';
// Portal mutations. Owner controls run through the authenticated client (RLS
// owner-only). The public request submission runs through the service role but
// is strictly token-scoped: it only ever writes a client_requests row for the
// project that owns the token, and only if that project allows requests.
import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { loadPortalPreview } from '@/lib/portal';
import type { PortalView } from '@/lib/portal';
import { clientRequestLabel, deriveTitle, type PortalRequestStatus, type RequestDecision } from '@/lib/request-status';
import { notifyOwner } from '@/lib/notify';

// Owner-only "Preview as client": returns the exact projection the client sees.
// RLS scopes loadPortalPreview to the signed-in owner's project.
export async function getPortalPreview(projectId: string): Promise<PortalView | null> {
  await requireUser();
  return loadPortalPreview(projectId);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

function newToken() {
  return randomBytes(18).toString('base64url'); // 24 url-safe chars
}

// Enable/disable the portal. Enabling generates a token if there isn't one.
export async function setPortalEnabled(projectId: string, enabled: boolean): Promise<{ error: string } | { ok: true; token: string | null }> {
  const { supabase } = await requireUser();
  const { data: cur } = await supabase.from('projects').select('portal_token').eq('id', projectId).maybeSingle();
  const token = enabled ? (cur?.portal_token ?? newToken()) : (cur?.portal_token ?? null);
  const { error } = await supabase.from('projects').update({ portal_enabled: enabled, portal_token: token }).eq('id', projectId);
  return error ? { error: error.message } : { ok: true, token };
}

// Rotate the token — the old link immediately stops working.
export async function rotatePortalToken(projectId: string): Promise<{ error: string } | { ok: true; token: string }> {
  const { supabase } = await requireUser();
  const token = newToken();
  const { error } = await supabase.from('projects').update({ portal_token: token }).eq('id', projectId);
  return error ? { error: error.message } : { ok: true, token };
}

export type ShareFlags = {
  share_progress?: boolean; share_completed_tasks?: boolean; share_open_tasks?: boolean;
  share_timeline?: boolean; share_files?: boolean; share_invoices?: boolean; allow_requests?: boolean; portal_intro?: string | null;
};

export async function updateShareFlags(projectId: string, flags: ShareFlags): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('projects').update(flags).eq('id', projectId);
  return error ? { error: error.message } : { ok: true };
}

export async function setTaskClientVisible(taskId: string, visible: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('tasks').update({ client_visible: visible }).eq('id', taskId);
  return error ? { error: error.message } : { ok: true };
}

export async function setDocClientVisible(pageId: string, visible: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('pages').update({ client_visible: visible }).eq('id', pageId);
  return error ? { error: error.message } : { ok: true };
}

// ── Request → task lifecycle (owner side) ────────────────────────────────────
// The decision states are pending | needs_info | approved | declined. Delivery
// state is derived from the linked task, so once approved we never touch status
// again — the task's `done` flag drives "In progress" vs "Completed".

// Approve → create a linked task, wire the two-way reference, mark approved.
// Replaces the old fire-and-forget accept: the request and task now know each
// other, so the client sees live task progress and the task shows its origin.
export async function approveRequest(requestId: string): Promise<{ error: string } | { taskId: string }> {
  const { supabase, user } = await requireUser();
  const { data: req } = await supabase
    .from('client_requests').select('project_id, name, title, body, task_id').eq('id', requestId).maybeSingle();
  if (!req) return { error: 'Request not found.' };
  if (req.task_id) return { taskId: req.task_id }; // already linked — idempotent

  const { data: proj } = await supabase.from('projects').select('space_id').eq('id', req.project_id).maybeSingle();
  if (!proj) return { error: 'Project not found.' };

  const title = req.title?.trim() || deriveTitle(req.body);
  const who = req.name?.trim() ? ` (${req.name.trim()})` : '';
  const notes = `From client request${who}:\n\n${req.body.trim()}`;

  const { data: task, error } = await supabase.from('tasks')
    .insert({ user_id: user.id, space_id: proj.space_id, project_id: req.project_id, title, notes, priority: 'low', request_id: requestId })
    .select('id').single();
  if (error || !task) return { error: error?.message ?? 'Could not create task.' };

  await supabase.from('client_requests').update({ status: 'approved', task_id: task.id, resolution_note: null }).eq('id', requestId);
  return { taskId: task.id };
}

// Decline with a reason the client will read.
export async function declineRequest(requestId: string, reason: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const note = (reason ?? '').trim();
  if (note.length < 2) return { error: 'Please add a short reason.' };
  const { error } = await supabase.from('client_requests')
    .update({ status: 'declined', resolution_note: note.slice(0, 500) }).eq('id', requestId);
  return error ? { error: error.message } : { ok: true };
}

// Ask the client for more information — posts a client-facing message and flips
// the request to needs_info. The client's reply flips it back to pending.
export async function requestMoreInfo(requestId: string, message: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const body = (message ?? '').trim();
  if (body.length < 2) return { error: 'Please write a short question.' };
  const { error: mErr } = await supabase.from('request_messages')
    .insert({ request_id: requestId, author: 'team', body: body.slice(0, 4000), client_facing: true });
  if (mErr) return { error: mErr.message };
  const { error } = await supabase.from('client_requests').update({ status: 'needs_info' }).eq('id', requestId);
  return error ? { error: error.message } : { ok: true };
}

// Reopen a declined request back to pending (clears the resolution note).
export async function reopenRequest(requestId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('client_requests')
    .update({ status: 'pending', resolution_note: null }).eq('id', requestId);
  return error ? { error: error.message } : { ok: true };
}

// Post a message to the thread. client_facing=false is a private team note that
// is NEVER projected to the portal.
export async function postRequestMessage(requestId: string, body: string, clientFacing: boolean): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const text = (body ?? '').trim();
  if (text.length < 1) return { error: 'Write a message first.' };
  const { error } = await supabase.from('request_messages')
    .insert({ request_id: requestId, author: 'team', body: text.slice(0, 4000), client_facing: clientFacing });
  return error ? { error: error.message } : { ok: true };
}

// ── Portal (public) ──────────────────────────────────────────────────────────

// PUBLIC: submit a request from the portal. Token-scoped via service role; never
// trusts a project id from the client. Returns the new request id so the browser
// can remember it (localStorage) and show its status later — the anonymous portal
// has no login, so the id is the client's capability to track their own request.
export async function submitClientRequest(
  token: string,
  body: string,
  name?: string,
): Promise<{ error: string } | { ok: true; id: string }> {
  const text = (body ?? '').trim();
  if (!token || token.length < 8) return { error: 'Invalid link.' };
  if (text.length < 2) return { error: 'Please write a short message.' };
  if (text.length > 4000) return { error: 'Message is too long.' };

  const svc = createServiceClient();
  const { data: project } = await svc
    .from('projects')
    .select('id, user_id, name, client_id, portal_enabled, allow_requests')
    .eq('portal_token', token)
    .maybeSingle();
  if (!project || !project.portal_enabled || !project.allow_requests) return { error: 'This portal isn’t accepting messages.' };

  const title = deriveTitle(text);
  const { data: row, error } = await svc.from('client_requests').insert({
    project_id: project.id,
    client_token: token,
    client_id: project.client_id ?? null,
    name: (name ?? '').trim().slice(0, 120) || null,
    title,
    body: text,
    status: 'pending',
  }).select('id').single();
  if (error || !row) return { error: 'Could not send. Please try again.' };

  const who = (name ?? '').trim();
  await notifyOwner(svc, {
    userId: project.user_id,
    kind: 'portal.request',
    title: who ? `New request from ${who}` : 'New client request',
    body: `${title} · ${project.name}`,
    link: { href: `/projects/${project.id}?tab=portal` },
  });
  return { ok: true, id: row.id };
}

// PUBLIC: the client replies in the thread (only meaningful while needs_info).
// Token-scoped; the request must belong to the token's project. A reply flips a
// needs_info request back to pending so it re-enters the owner's decision queue.
export async function submitClientReply(
  token: string,
  requestId: string,
  body: string,
): Promise<{ error: string } | { ok: true }> {
  const text = (body ?? '').trim();
  if (!token || token.length < 8) return { error: 'Invalid link.' };
  if (text.length < 1) return { error: 'Write a message first.' };
  if (text.length > 4000) return { error: 'Message is too long.' };

  const svc = createServiceClient();
  const { data: project } = await svc.from('projects')
    .select('id, user_id, name, portal_enabled, allow_requests').eq('portal_token', token).maybeSingle();
  if (!project || !project.portal_enabled || !project.allow_requests) return { error: 'This portal isn’t accepting messages.' };

  const { data: req } = await svc.from('client_requests')
    .select('id, status, title, name, project_id').eq('id', requestId).maybeSingle();
  if (!req || req.project_id !== project.id) return { error: 'Request not found.' };

  const { error } = await svc.from('request_messages')
    .insert({ request_id: requestId, author: 'client', body: text, client_facing: true });
  if (error) return { error: 'Could not send. Please try again.' };
  if (req.status === 'needs_info') await svc.from('client_requests').update({ status: 'pending' }).eq('id', requestId);

  const who = req.name?.trim();
  await notifyOwner(svc, {
    userId: project.user_id,
    kind: 'portal.reply',
    title: who ? `${who} replied` : 'Client replied',
    body: `${req.title?.trim() || 'Request'} · ${project.name}`,
    link: { href: `/projects/${project.id}?tab=portal` },
  });
  return { ok: true };
}

// PUBLIC: given the ids the browser submitted (from localStorage), return the
// live status + client-facing thread for those that belong to this token's
// project. Ids are random uuids, so holding one is the capability to see it —
// a client can never enumerate other people's requests.
export async function getClientRequestStatuses(token: string, ids: string[]): Promise<PortalRequestStatus[]> {
  if (!token || token.length < 8 || !Array.isArray(ids) || ids.length === 0) return [];
  const wanted = ids.filter((x) => typeof x === 'string').slice(0, 100);
  if (wanted.length === 0) return [];

  const svc = createServiceClient();
  const { data: project } = await svc.from('projects')
    .select('id, portal_enabled').eq('portal_token', token).maybeSingle();
  if (!project || !project.portal_enabled) return [];

  const { data: reqs } = await svc.from('client_requests')
    .select('id, title, body, status, resolution_note, task_id, created_at')
    .eq('project_id', project.id).in('id', wanted);
  if (!reqs || reqs.length === 0) return [];

  // Resolve linked-task done flags in one query to derive delivery state.
  const taskIds = reqs.map((r) => r.task_id).filter((x): x is string => !!x);
  const doneById = new Map<string, boolean>();
  if (taskIds.length) {
    const { data: tasks } = await svc.from('tasks').select('id, done').in('id', taskIds);
    for (const t of tasks ?? []) doneById.set(t.id, t.done);
  }

  // Client-facing thread for these requests, oldest first.
  const msgsByReq = new Map<string, PortalRequestStatus['messages']>();
  const { data: msgs } = await svc.from('request_messages')
    .select('request_id, author, body, client_facing, created_at')
    .in('request_id', reqs.map((r) => r.id))
    .eq('client_facing', true)
    .order('created_at', { ascending: true });
  for (const m of msgs ?? []) {
    const arr = msgsByReq.get(m.request_id) ?? [];
    arr.push({ author: m.author as 'team' | 'client', body: m.body, createdAt: m.created_at });
    msgsByReq.set(m.request_id, arr);
  }

  // Preserve the order the browser asked for (most-recent submissions first there).
  const byId = new Map(reqs.map((r) => [r.id, r]));
  return wanted
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => {
      const done = r.task_id ? doneById.get(r.task_id) ?? null : null;
      return {
        id: r.id,
        title: r.title?.trim() || deriveTitle(r.body),
        label: clientRequestLabel(r.status as RequestDecision, done),
        resolutionNote: r.status === 'declined' ? r.resolution_note ?? null : null,
        createdAt: r.created_at,
        canReply: r.status === 'needs_info',
        messages: msgsByReq.get(r.id) ?? [],
      };
    });
}

// ── Deliverable approvals ────────────────────────────────────────────────────

// Owner asks the client to sign off on a document. Makes the doc client-visible
// (so it appears in the portal) and opens an awaiting approval. Idempotent: if an
// approval is already awaiting for this doc, it's reused rather than duplicated.
export async function requestApproval(pageId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { data: page } = await supabase.from('pages').select('id, project_id, title').eq('id', pageId).maybeSingle();
  if (!page || !page.project_id) return { error: 'Only project documents can be sent for approval.' };

  // Reuse an existing open request rather than stacking duplicates.
  const { data: existing } = await supabase.from('approvals')
    .select('id').eq('page_id', pageId).eq('status', 'awaiting').maybeSingle();

  await supabase.from('pages').update({ client_visible: true }).eq('id', pageId);
  if (existing) return { ok: true };

  const { error } = await supabase.from('approvals').insert({
    project_id: page.project_id, page_id: pageId, title: page.title?.trim() || 'Deliverable', status: 'awaiting',
  });
  return error ? { error: error.message } : { ok: true };
}

// Owner withdraws an approval request.
export async function cancelApproval(approvalId: string): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('approvals').delete().eq('id', approvalId);
  return error ? { error: error.message } : { ok: true };
}

// PUBLIC: the client approves or requests changes. Token-scoped; the approval must
// belong to the token's project. A change request carries the client's note.
export async function submitApprovalDecision(
  token: string,
  approvalId: string,
  decision: 'approved' | 'changes_requested',
  note?: string,
): Promise<{ error: string } | { ok: true }> {
  if (!token || token.length < 8) return { error: 'Invalid link.' };
  if (decision !== 'approved' && decision !== 'changes_requested') return { error: 'Invalid choice.' };
  const text = (note ?? '').trim();
  if (decision === 'changes_requested' && text.length < 2) return { error: 'Please say what needs changing.' };

  const svc = createServiceClient();
  const { data: project } = await svc.from('projects')
    .select('id, user_id, name, portal_enabled').eq('portal_token', token).maybeSingle();
  if (!project || !project.portal_enabled) return { error: 'This portal isn’t available.' };

  const { data: appr } = await svc.from('approvals')
    .select('id, project_id, title').eq('id', approvalId).maybeSingle();
  if (!appr || appr.project_id !== project.id) return { error: 'Not found.' };

  const { error } = await svc.from('approvals').update({
    status: decision,
    note: decision === 'changes_requested' ? text.slice(0, 1000) : null,
    decided_at: new Date().toISOString(),
  }).eq('id', approvalId);
  if (error) return { error: 'Could not submit. Please try again.' };

  const what = appr.title?.trim() || 'Deliverable';
  await notifyOwner(svc, {
    userId: project.user_id,
    kind: 'portal.approval',
    title: decision === 'approved' ? `${what} approved` : `Changes requested on ${what}`,
    body: decision === 'changes_requested' ? text.slice(0, 500) : project.name,
    link: { href: `/projects/${project.id}?tab=portal` },
  });
  return { ok: true };
}
