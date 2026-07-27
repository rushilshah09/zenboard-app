import 'server-only';
// Transactional email via Resend's REST API. sendEmail is best-effort and NEVER
// throws — a failed send must not break the action that triggered it (a form
// submit is not going to fail because an alert email bounced).
//
// From address: RESEND_FROM when set, else Resend's shared `onboarding@resend.dev`
// sender. NOTE: until a domain is verified in Resend, that shared sender only
// delivers to the Resend account's own address — which is fine for the one use we
// have today (alerting the studio owner about their own form), and the alert is a
// courtesy regardless. Set RESEND_FROM to a verified-domain address for the rest.
const FROM = process.env.RESEND_FROM || 'Zenboard <onboarding@resend.dev>';

export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !msg.to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: msg.to, subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Absolute origin for links that travel in emails (no request context there). */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://zenboard-web.designdotrushil.workers.dev';
}
