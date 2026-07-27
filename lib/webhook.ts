// Outbound form webhook — POSTs a completed response to a URL the owner set on
// the form. Best-effort: it NEVER throws and never blocks the respondent's submit
// (same contract as notifyOwner). Fire-and-forget with a short timeout so a slow
// or dead endpoint can't hold the request open.
//
// The URL is owner-controlled, but we still refuse obvious SSRF targets — plain
// http, localhost, and literal private/link-local IPs — so a webhook can only
// reach the public internet, never the app's own network. (DNS-rebinding is out
// of scope for v1; this blocks the copy-paste-an-internal-URL footgun.)
import { answerToText, type AnswerValue, type FormBlock } from '@/lib/form-schema';

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i;

/** True only for an https URL whose host isn't a loopback/private/link-local address. */
export function isSafeWebhookUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (PRIVATE_HOST.test(u.hostname)) return false;
  return true;
}

export type WebhookPayload = {
  form: { id: string; title: string };
  response: { id: string; submittedAt: string };
  answers: Record<string, unknown>;      // keyed by field LABEL, human-readable
  respondent: { name?: string; email?: string } | null;
};

/** Build the labeled payload from raw answers keyed by block id. */
export function buildWebhookAnswers(blocks: FormBlock[], answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const b of blocks) {
    if (!(b.id in answers)) continue;
    // A file answer is a private storage path — send the readable filename, not
    // the internal path (which isn't fetchable and leaks the bucket layout).
    out[b.label?.trim() || b.id] = b.type === 'file'
      ? answerToText(b, answers[b.id] as AnswerValue)
      : answers[b.id];
  }
  return out;
}

export async function postFormWebhook(url: string, payload: WebhookPayload): Promise<void> {
  if (!isSafeWebhookUrl(url)) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Zenboard-Forms/1' },
      body: JSON.stringify({ event: 'form.response', ...payload }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    /* a dead or slow endpoint is the owner's problem, never the respondent's */
  }
}
