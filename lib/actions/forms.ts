'use server';
// Form mutations. Owner actions run through the authenticated client (RLS scopes
// them to their own forms). The three PUBLIC actions — start / save / submit —
// run through the service role but are strictly token-scoped: they resolve the
// form from the token, re-check that it is live and still accepting, and only
// ever touch a response row belonging to THAT form. There is no anon insert
// policy anywhere; this file is the only path in.
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notifyOwner } from '@/lib/notify';
import { postFormWebhook, buildWebhookAnswers } from '@/lib/webhook';
import { sendEmail, siteOrigin } from '@/lib/email';
import { verifyTurnstile } from '@/lib/turnstile';
import { isAccepting } from '@/lib/forms';
import { instantiate, templateByKey } from '@/lib/form-templates';
import {
  starterBlocks, toFormContent, toFormSettings, validateAll, visibleFieldIds,
  type Answers, type FormBlock, type FormSettings,
} from '@/lib/form-schema';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type DB = SupabaseClient<Database>;
type Result<T = unknown> = { error: string } | ({ ok: true } & T);

async function requireUser() {
  const supabase = (await createClient()) as unknown as DB;
  const { data: { user } } = await (supabase as unknown as { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } }).auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

function newToken() {
  return randomBytes(18).toString('base64url'); // 24 url-safe chars, same as the portal
}

// ── File uploads (F4) ──────────────────────────────────────────────────────
// The private bucket from migration 0022. Answers store a path into it, never
// the bytes. The bucket carries its own size cap so even a signed upload URL
// can't be used to push something huge.
const FORM_UPLOAD_BUCKET = 'form-uploads';
/** Longest original filename we keep (the rest is trimmed, extension preserved). */
const MAX_FILENAME = 120;

/** Make an arbitrary client filename safe for a storage key: no slashes, no dashes
 *  (a dash is our token/name delimiter), collapsed whitespace, length-capped. */
function safeFilename(raw: string): string {
  const name = (raw || 'file').split(/[\\/]/).pop() || 'file';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : '';
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9 ._]+/g, ' ')   // drop dashes and anything exotic
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME) || 'file';
  return ext ? `${stem}.${ext}` : stem;
}

// ── OWNER ─────────────────────────────────────────────────────────────────

export async function createForm(scope: { clientId?: string; projectId?: string; title?: string; template?: string }): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireUser();

  // A home is OPTIONAL now: a form with no client/project starts in Drafts and can
  // be attached later (setFormHome). Inherit the space from the home when there is
  // one — otherwise fall back to the user's first space so the form still belongs to
  // their workspace (responses can become tasks, notifications route, studio name
  // shows). No space at all is tolerated; it just disables those niceties.
  let spaceId: string | null = null;
  if (scope.projectId) {
    const { data } = await supabase.from('projects').select('space_id').eq('id', scope.projectId).maybeSingle();
    spaceId = (data as { space_id: string } | null)?.space_id ?? null;
  } else if (scope.clientId) {
    const { data } = await supabase.from('clients').select('space_id').eq('id', scope.clientId).maybeSingle();
    spaceId = (data as { space_id: string } | null)?.space_id ?? null;
  }
  if (!spaceId) {
    const { data } = await supabase.from('spaces').select('id').order('sort_order').limit(1).maybeSingle();
    spaceId = (data as { id: string } | null)?.id ?? null;
  }

  // A template seeds the questions, copy and settings; blank gets three starters.
  const tpl = templateByKey(scope.template);
  const { data: row, error } = await supabase.from('forms').insert({
    user_id: user.id,
    space_id: spaceId,
    client_id: scope.clientId ?? null,
    project_id: scope.projectId ?? null,
    title: scope.title?.trim() || tpl?.title || 'Untitled form',
    description: tpl?.description ?? null,
    content: { blocks: tpl ? instantiate(tpl) : starterBlocks() },
    settings: tpl?.settings ?? { mode: 'page' },
  }).select('id').single();

  if (error || !row) return { error: error?.message ?? 'Could not create the form.' };
  return { ok: true, id: (row as { id: string }).id };
}

export type FormPatch = {
  title?: string;
  description?: string | null;
  blocks?: FormBlock[];
  settings?: FormSettings;
};

/** Autosave from the builder. Never changes status or token. */
export async function updateForm(id: string, patch: FormPatch): Promise<Result> {
  const { supabase } = await requireUser();
  const update: Database['public']['Tables']['forms']['Update'] = {};
  if (patch.title !== undefined) update.title = patch.title.trim().slice(0, 200) || 'Untitled form';
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.blocks !== undefined) update.content = toFormContent({ blocks: patch.blocks });
  if (patch.settings !== undefined) update.settings = toFormSettings(patch.settings);
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('forms').update(update).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Publish: mint a token on first publish, snapshot the version, go live.
 * Re-publishing an already-live form bumps the version and re-snapshots so
 * existing responses stay attached to the questions they actually answered.
 */
export async function publishForm(id: string): Promise<Result<{ token: string }>> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from('forms').select('content, settings, version, share_token, status').eq('id', id).maybeSingle();
  if (!data) return { error: 'Form not found.' };
  const cur = data as unknown as { content: unknown; settings: unknown; version: number; share_token: string | null; status: string };

  const blocks = toFormContent(cur.content).blocks;
  if (blocks.filter((b) => b.type !== 'divider' && b.type !== 'page_break').length === 0) {
    return { error: 'Add at least one question before publishing.' };
  }

  const token = cur.share_token ?? newToken();

  // Version rule: the FIRST publish claims v1; every later publish increments.
  // Keyed on whether a snapshot already exists — not on status — because an
  // unpublish → edit → republish must not overwrite the snapshot that already
  // collected responses (those rows store the version they answered).
  const { data: snap } = await supabase
    .from('form_versions').select('version').eq('form_id', id).eq('version', cur.version).maybeSingle();
  const version = snap ? cur.version + 1 : cur.version;

  const { error } = await supabase.from('forms')
    .update({ status: 'live', share_token: token, version })
    .eq('id', id);
  if (error) return { error: error.message };

  await supabase.from('form_versions')
    .upsert({ form_id: id, version, content: { blocks }, settings: cur.settings ?? {} });

  revalidatePath(`/forms/${id}`);
  return { ok: true, token };
}

/** Back to draft — the live link stops working immediately (token is kept). */
export async function unpublishForm(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forms').update({ status: 'draft' }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Show this project's form inside the client portal (opt-in, one switch). */
export async function setFormInPortal(id: string, show: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forms').update({ show_in_portal: show }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Attach a form to a client or a project, or detach it back to Drafts (home = null).
 * A form has at most one home (the 0024 CHECK), so this always clears the other side.
 * The space is realigned to the new home so responses can still become tasks there.
 */
export async function setFormHome(
  id: string,
  home: { clientId: string } | { projectId: string } | null,
): Promise<Result> {
  const { supabase } = await requireUser();
  const patch: Database['public']['Tables']['forms']['Update'] = { client_id: null, project_id: null };

  if (home && 'projectId' in home) {
    patch.project_id = home.projectId;
    const { data } = await supabase.from('projects').select('space_id').eq('id', home.projectId).maybeSingle();
    const sid = (data as { space_id: string } | null)?.space_id;
    if (sid) patch.space_id = sid;
  } else if (home && 'clientId' in home) {
    patch.client_id = home.clientId;
    const { data } = await supabase.from('clients').select('space_id').eq('id', home.clientId).maybeSingle();
    const sid = (data as { space_id: string } | null)?.space_id;
    if (sid) patch.space_id = sid;
  }

  const { error } = await supabase.from('forms').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/forms');
  revalidatePath(`/forms/${id}`);
  return { ok: true };
}

/** Closed = link resolves but politely refuses new answers. */
export async function setFormStatus(id: string, status: 'draft' | 'live' | 'closed'): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forms').update({ status }).eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Rotate the share link — every previously shared URL dies at once. */
export async function rotateFormToken(id: string): Promise<Result<{ token: string }>> {
  const { supabase } = await requireUser();
  const token = newToken();
  const { error } = await supabase.from('forms').update({ share_token: token }).eq('id', id);
  return error ? { error: error.message } : { ok: true, token };
}

/** Copy a form's questions and settings into a new draft. Responses never come along. */
export async function duplicateForm(id: string): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('forms')
    .select('title, description, content, settings, client_id, project_id, space_id')
    .eq('id', id).maybeSingle();
  if (!data) return { error: 'Form not found.' };
  const src = data as unknown as {
    title: string; description: string | null; content: unknown; settings: unknown;
    client_id: string | null; project_id: string | null; space_id: string | null;
  };

  const { data: row, error } = await supabase.from('forms').insert({
    user_id: user.id,
    space_id: src.space_id,
    client_id: src.client_id,
    project_id: src.project_id,
    title: `${src.title} (copy)`.slice(0, 200),
    description: src.description,
    content: toFormContent(src.content),
    settings: toFormSettings(src.settings),
    status: 'draft',       // a copy is never live, and never inherits the token
  }).select('id').single();

  return error || !row ? { error: error?.message ?? 'Could not duplicate.' } : { ok: true, id: (row as { id: string }).id };
}

export async function deleteForm(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('forms').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Turn a response into a task, once. The link is stored on the response so the
 * drawer can show "this became a task" forever after — the persistent pointer
 * the original request→task flow forgot to keep (0017).
 */
export async function makeTaskFromResponse(responseId: string, title: string): Promise<Result<{ taskId: string }>> {
  const { supabase, user } = await requireUser();

  const { data: respData } = await supabase
    .from('form_responses').select('id, form_id, task_id').eq('id', responseId).maybeSingle();
  const resp = respData as { id: string; form_id: string; task_id: string | null } | null;
  if (!resp) return { error: 'Response not found.' };
  if (resp.task_id) return { ok: true, taskId: resp.task_id };   // idempotent — never make two

  const { data: formData } = await supabase
    .from('forms').select('space_id, project_id, title').eq('id', resp.form_id).maybeSingle();
  const form = formData as { space_id: string | null; project_id: string | null; title: string } | null;
  if (!form?.space_id) return { error: 'This form has no workspace to file a task in.' };

  const clean = title.trim().slice(0, 200) || `Follow up on “${form.title}”`;
  const { data: taskRow, error } = await supabase.from('tasks').insert({
    user_id: user.id,
    space_id: form.space_id,
    project_id: form.project_id,
    title: clean,
    is_inbox: !form.project_id,   // no project to file under → it lands in Inbox
  }).select('id').single();
  if (error || !taskRow) return { error: error?.message ?? 'Could not create the task.' };

  const taskId = (taskRow as { id: string }).id;
  await supabase.from('form_responses').update({ task_id: taskId }).eq('id', responseId);
  return { ok: true, taskId };
}

export async function deleteResponse(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('form_responses').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Mint a short-lived signed URL so the owner can open a file answer. The path is
 * `<formId>/…`; ownership is proven by selecting that form through the
 * authenticated client (RLS returns nothing for a form you don't own), and only
 * then does the service role sign the private object. F4.
 */
export async function signFormUpload(path: string): Promise<Result<{ url: string }>> {
  const { supabase } = await requireUser();
  const formId = String(path).split('/')[0];
  if (!formId) return { error: 'Not found.' };

  const { data } = await supabase.from('forms').select('id').eq('id', formId).maybeSingle();
  if (!data) return { error: 'Not found.' };   // not the owner, or no such form

  const svc = createServiceClient() as unknown as DB;
  const { data: signed, error } = await svc.storage.from(FORM_UPLOAD_BUCKET).createSignedUrl(path, 60);
  if (error || !signed?.signedUrl) return { error: 'Could not open that file.' };
  return { ok: true, url: signed.signedUrl };
}

// ── PUBLIC (token-scoped, service role) ───────────────────────────────────

/** Everything a completed response fans out to, computed in submitResponse. */
type CompletionContext = {
  formId: string;
  blocks: FormBlock[];
  settings: FormSettings;
  answers: Answers;
  responseId: string;
  submittedAt: string;
  respondent: { name?: string; email?: string } | null;
};

/**
 * The fabric side-effects of a completed response, in one place:
 *   • the owner gets a bell notification (always);
 *   • a client-bound form logs a touch on the client record;
 *   • an outbound webhook fires if the form has one (F4).
 * All best-effort — none may ever fail the respondent's submit.
 */
async function onResponseComplete(svc: DB, ctx: CompletionContext) {
  try {
    const { data } = await svc.from('forms').select('user_id, client_id, title').eq('id', ctx.formId).maybeSingle();
    const form = data as { user_id: string; client_id: string | null; title: string } | null;
    if (!form) return;
    const who = ctx.respondent?.name?.trim();
    const title = form.title?.trim() || 'a form';

    await notifyOwner(svc, {
      userId: form.user_id,
      kind: 'form.response',
      title: who ? `${who} completed a form` : 'New form response',
      body: title,
      link: { href: `/forms/${ctx.formId}/responses` },
    });

    if (form.client_id) {
      await svc.from('client_notes').insert({
        user_id: form.user_id,
        client_id: form.client_id,
        body: who ? `${who} completed “${title}”.` : `New response to “${title}”.`,
      });
    }

    if (ctx.settings.webhookUrl) {
      await postFormWebhook(ctx.settings.webhookUrl, {
        form: { id: ctx.formId, title },
        response: { id: ctx.responseId, submittedAt: ctx.submittedAt },
        answers: buildWebhookAnswers(ctx.blocks, ctx.answers),
        respondent: ctx.respondent,
      });
    }

    if (ctx.settings.notifyByEmail) {
      // The owner's address lives on the auth user, not profiles — read it with
      // the service role (this whole function already runs service-side).
      const { data: authUser } = await svc.auth.admin.getUserById(form.user_id);
      const to = authUser?.user?.email;
      if (to) {
        await sendEmail({
          to,
          subject: `New response · ${title}`,
          text: `${who ? `${who} completed` : 'Someone completed'} “${title}”.\n\nView responses:\n${siteOrigin()}/forms/${ctx.formId}/responses`,
        });
      }
    }
  } catch { /* every side effect here is a nicety, never a gate */ }
}

// ── Spam defences (plan §13) — quiet by default, no CAPTCHA wall ──────────
//
// Three cheap checks, none of which a real person can ever fail:
//   1. HONEYPOT  — a field humans can't see. Anything in it came from a bot.
//   2. TIME TRAP — nobody reads and answers a form in under 3 seconds. Measured
//      from the SERVER's own `started_at`, never a client-supplied duration.
//   3. BURST CAP — one form can only open so many new responses per minute.
//
// A caught bot gets `{ ok: true }` with a discarded payload, NOT an error:
// telling a bot precisely how it failed is how it learns to pass next time.

/** Minimum plausible time between opening a form and submitting it. */
const MIN_FILL_MS = 3000;
/** New responses one form may open in a minute before we stop opening more. */
const BURST_PER_MINUTE = 30;

function trippedHoneypot(honeypot?: string): boolean {
  return typeof honeypot === 'string' && honeypot.trim().length > 0;
}

function tooFast(startedAt?: unknown): boolean {
  if (typeof startedAt !== 'string') return false; // unknown start ⇒ give benefit of the doubt
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return false;
  return Date.now() - started < MIN_FILL_MS;
}

/** Resolve a token to a live, still-accepting form. The gate every public write shares. */
async function resolveLiveForm(token: string) {
  if (!token || token.length < 8) return null;
  const svc = createServiceClient() as unknown as DB;
  const { data } = await svc
    .from('forms').select('id, content, settings, status, version').eq('share_token', token).maybeSingle();
  if (!data) return null;
  const row = data as unknown as { id: string; content: unknown; settings: unknown; status: string; version: number };
  if (row.status !== 'live') return null;
  const settings = toFormSettings(row.settings);
  if (!(await isAccepting(svc, row.id, settings))) return null;
  return { svc, id: row.id, version: row.version, blocks: toFormContent(row.content).blocks, settings };
}

/**
 * First interaction: open a `partial` row and hand its id back. The id lives in
 * the respondent's localStorage and acts as their capability to keep writing to
 * this one row — the same anonymous-capability model as portal requests.
 */
export async function startResponse(token: string, source: 'link' | 'portal' = 'link'): Promise<Result<{ id: string }>> {
  const form = await resolveLiveForm(token);
  if (!form) return { error: 'This form isn’t accepting responses.' };

  // Burst cap: a flood of opened responses is a script, not an audience.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await form.svc
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', form.id)
    .gte('created_at', since);
  if ((count ?? 0) >= BURST_PER_MINUTE) return { error: 'Too many people are filling this in right now. Please try again in a moment.' };

  const { data, error } = await form.svc.from('form_responses').insert({
    form_id: form.id,
    form_version: form.version,
    status: 'partial',
    answers: {},
    meta: { source, started_at: new Date().toISOString() },
  }).select('id').single();

  return error || !data ? { error: 'Could not start. Please try again.' } : { ok: true, id: (data as { id: string }).id };
}

/** Autosave in progress. Silent by design — never interrupts someone typing. */
export async function saveProgress(token: string, responseId: string, answers: Answers, lastFieldId?: string): Promise<Result> {
  const form = await resolveLiveForm(token);
  if (!form) return { error: 'unavailable' };

  const { data: existing } = await form.svc
    .from('form_responses').select('id, status, meta').eq('id', responseId).eq('form_id', form.id).maybeSingle();
  const row = existing as { id: string; status: string; meta: Record<string, unknown> } | null;
  if (!row) return { error: 'unknown response' };
  if (row.status === 'complete') return { ok: true }; // already submitted — ignore late saves

  const { error } = await form.svc.from('form_responses').update({
    answers: pruneAnswers(answers, form.blocks),
    meta: { ...(row.meta ?? {}), ...(lastFieldId ? { last_field_id: lastFieldId } : {}) },
  }).eq('id', responseId).eq('form_id', form.id);

  return error ? { error: error.message } : { ok: true };
}

/**
 * F4: hand a public respondent a one-shot signed URL to upload a file answer's
 * bytes DIRECTLY to storage — the bytes never pass through this server (so the
 * server-action body limit never applies) and the bucket's own size cap is the
 * ceiling. Token-scoped like every other public write; the fieldId must be a
 * real `file` question on THIS form. The answer stored later is just `path`.
 */
export async function createFormUploadUrl(
  token: string, fieldId: string, filename: string,
): Promise<Result<{ path: string; uploadToken: string }>> {
  const form = await resolveLiveForm(token);
  if (!form) return { error: 'This form isn’t accepting responses.' };

  const block = form.blocks.find((b) => b.id === fieldId);
  if (!block || block.type !== 'file') return { error: 'That field can’t take a file.' };

  const path = `${form.id}/${randomBytes(9).toString('hex')}-${safeFilename(filename)}`;
  const { data, error } = await form.svc.storage.from(FORM_UPLOAD_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: 'Could not start the upload. Please try again.' };
  return { ok: true, path: data.path ?? path, uploadToken: data.token };
}

/**
 * Submit. Re-runs the SAME validation the browser ran (a crafted request must
 * not be able to skip a required question) and flips the row to complete.
 */
export async function submitResponse(
  token: string,
  responseId: string | null,
  answers: Answers,
  respondent?: { name?: string; email?: string },
  honeypot?: string,
  turnstileToken?: string,
): Promise<Result<{ id: string }>> {
  const form = await resolveLiveForm(token);
  if (!form) return { error: 'This form isn’t accepting responses.' };

  // Caught bots get a convincing success and nothing is written.
  if (trippedHoneypot(honeypot)) return { ok: true, id: responseId ?? 'discarded' };

  // Turnstile: enforced only when the owner asked for it AND the secret is deployed
  // (verifyTurnstile returns true when unconfigured, so the toggle degrades to a
  // no-op rather than an unpassable wall). Unlike the invisible checks, a failed
  // challenge gets a real message so a genuine person can retry.
  if (form.settings.turnstile && !(await verifyTurnstile(turnstileToken))) {
    return { error: 'Please complete the spam check and try again.' };
  }

  const clean = pruneAnswers(answers, form.blocks);
  const errors = validateAll(form.blocks, clean);
  if (Object.keys(errors).length > 0) return { error: 'Please check the highlighted answers.' };

  // Drop answers to questions the respondent's own path never showed — if they
  // answered, then changed an earlier answer and branched away, that stale value
  // must not land in the record (or the CSV) as if they'd meant it.
  const shown = visibleFieldIds(form.blocks, clean);
  for (const key of Object.keys(clean)) if (!shown.has(key)) delete clean[key];

  const now = new Date().toISOString();
  const identity = form.settings.collectIdentity && respondent
    ? { name: respondent.name?.trim().slice(0, 120) || undefined, email: respondent.email?.trim().slice(0, 200) || undefined }
    : null;

  // Normal path: complete the partial row this respondent already owns.
  if (responseId) {
    const { data: existing } = await form.svc
      .from('form_responses').select('id, status, meta').eq('id', responseId).eq('form_id', form.id).maybeSingle();
    const row = existing as { id: string; status: string; meta: Record<string, unknown> } | null;
    if (row && row.status !== 'complete') {
      // The server's own clock, so a forged client duration can't beat it.
      if (tooFast(row.meta?.started_at)) return { ok: true, id: responseId };
      const startedAt = typeof row.meta?.started_at === 'string' ? row.meta.started_at : null;
      const { error } = await form.svc.from('form_responses').update({
        status: 'complete',
        answers: clean,
        respondent: identity,
        meta: {
          ...(row.meta ?? {}),
          completed_at: now,
          ...(startedAt ? { duration_s: Math.max(0, Math.round((Date.parse(now) - Date.parse(startedAt)) / 1000)) } : {}),
        },
      }).eq('id', responseId).eq('form_id', form.id);
      if (error) return { error: 'Could not send. Please try again.' };
      await onResponseComplete(form.svc, {
        formId: form.id, blocks: form.blocks, settings: form.settings, answers: clean,
        responseId, submittedAt: now, respondent: identity,
      });
      return { ok: true, id: responseId };
    }
    if (row?.status === 'complete') return { ok: true, id: responseId }; // idempotent double-submit
  }

  // Fallback (no partial — e.g. storage blocked): insert a complete row directly.
  const { data, error } = await form.svc.from('form_responses').insert({
    form_id: form.id,
    form_version: form.version,
    status: 'complete',
    answers: clean,
    respondent: identity,
    meta: { source: 'link', started_at: now, completed_at: now },
  }).select('id').single();

  if (error || !data) return { error: 'Could not send. Please try again.' };
  await onResponseComplete(form.svc, {
    formId: form.id, blocks: form.blocks, settings: form.settings, answers: clean,
    responseId: (data as { id: string }).id, submittedAt: now, respondent: identity,
  });
  return { ok: true, id: (data as { id: string }).id };
}

/** Drop anything that isn't a current field — never store stray keys from a client. */
function pruneAnswers(answers: Answers, blocks: FormBlock[]): Answers {
  const allowed = new Set(blocks.map((b) => b.id));
  const out: Answers = {};
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (!allowed.has(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 10000);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string').slice(0, 100);
    else out[k] = v;
  }
  return out;
}
