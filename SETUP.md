# Zenboard — setup guide (first-timer friendly)

You provide credentials in two places:

- **`.env.local`** in this `zenboard-web/` folder — for keys the app reads. Open
  it in your editor, paste each value after the `=`, save. It's git-ignored, so
  it never leaves your machine.
- **The Supabase dashboard** — for the Google sign-in secret (Supabase brokers
  the Google login for us).

> Tip: the `NEXT_PUBLIC_…` values are safe to share. The `…SERVICE_ROLE_KEY`,
> `…CLIENT_SECRET`, and `GEMINI_API_KEY` are **secret** — keep them in
> `.env.local` only; don't paste them into chat or commit them.

---

## 1. Supabase (do this first — unblocks the most)

### 1a. Authenticate the MCP server (one-time, in a real terminal)
1. **Restart Claude Code** so it loads `.mcp.json`. Approve the project MCP
   server when prompted.
2. Run `/mcp` → pick **supabase** → **Authenticate** → finish in the browser.

### 1b. Create the database tables
1. Open <https://supabase.com/dashboard> → your project.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open `zenboard-web/supabase/migrations/0001_init.sql`, copy **everything**,
   paste it into the editor, click **Run**. You should see "Success".
   (This creates all 27 tables, security policies, and the signup trigger.)

### 1c. Copy the API keys into `.env.local`
1. Project → **Project Settings** (gear) → **API Keys** (and **Data API**/**API**).
2. Copy these into `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     (looks like `https://hctwmcqftwpefnisrhac.supabase.co`)
   - **anon / public** key (newer dashboards call it **Publishable**) →
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY`  *(secret!)*

That's enough to run the app and sign in with **email + password**.

---

## 2. Google sign-in (optional now — email/password already works)

You need a Google OAuth client, and you paste it into **Supabase** (for login)
and into `.env.local` (for Calendar sync later, Phase 3).

1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen**: User type **External**, fill app
   name + your email, save. Under **Audience**, add your own Google account as a
   **Test user** (lets you log in while the app is unverified).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URI** — paste exactly:
     `https://hctwmcqftwpefnisrhac.supabase.co/auth/v1/callback`
   - Create → copy the **Client ID** and **Client secret**.
4. Put the **Client ID + secret** in two places:
   - **Supabase Dashboard → Authentication → Providers → Google** → enable,
     paste both, save. *(This is what powers the "Sign in with Google" button.)*
   - `.env.local`: `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
     *(needed later for Calendar sync).*
5. **Supabase Dashboard → Authentication → URL Configuration**: set **Site URL**
   to `http://localhost:3000` and add your future live URL to **Redirect URLs**
   when we deploy.

---

## 3. Gemini AI key (Phase 4 only — skip for now)

1. <https://aistudio.google.com> → **Get API key** → create a key.
2. Paste into `.env.local` → `GEMINI_API_KEY`. (Model is already set to
   `gemini-2.5-flash`.)

---

## 4. Going live on Cloudflare (later)

When we deploy, the same `.env.local` values get re-entered as
**environment variables in the Cloudflare dashboard** (Workers → your project →
Settings → Variables). I'll walk you through it in the deploy step. The secret
ones get marked **Encrypted**.

---

### Quick reference — which key, where it comes from, where it goes

| Value | Get it from | Put it in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys (anon/publishable) | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Supabase → Settings → API Keys (service_role/secret) | `.env.local` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud → Credentials | Supabase provider **+** `.env.local` |
| `GOOGLE_OAUTH_CLIENT_SECRET` 🔒 | Google Cloud → Credentials | Supabase provider **+** `.env.local` |
| `GEMINI_API_KEY` 🔒 | Google AI Studio | `.env.local` (Phase 4) |

## Reminder delivery when the app is closed (optional)

`components/reminders/reminder-scheduler.tsx` delivers reminders while a tab is open.
`POST /api/cron/reminders` is the other channel — it emails you for reminders that came
due while Zenboard was closed, and runs the **same claim**, so the two can never both
speak about one reminder.

1. Set `REMINDER_CRON_SECRET` to a long random value. Locally it is already in
   `.env.local`; for the deploy, add it in the Cloudflare dashboard (and remember
   `wrangler deploy --keep-vars`, or a plain deploy deletes dashboard vars).
2. Point any scheduler at the endpoint every 5–15 minutes:

   ```
   curl -X POST https://<your-host>/api/cron/reminders \
     -H "Authorization: Bearer $REMINDER_CRON_SECRET"
   ```

   A Cloudflare Cron Trigger, a GitHub Actions schedule, or cron-job.org all work. The
   endpoint is a plain authenticated POST on purpose — nothing about it is tied to one
   scheduler.
3. Email goes out via Resend. Until a domain is verified there, the shared
   `onboarding@resend.dev` sender only delivers to the Resend account's own address; set
   `RESEND_FROM` to a verified-domain address for anything else.

**Without step 1 the endpoint refuses every request with 503** — it fails closed rather
than defaulting to open, since it reads across users and sends mail. Without step 2
nothing changes: reminders still arrive in-app and in the bell.

## Morning digest (optional)

`POST /api/cron/digest` sends at most one email a day: what's on today (with the capacity
line), what's overdue, what's blocked, and any client requests that arrived overnight.

It uses **the same secret and the same scheduler** as the reminder endpoint — they are one
set of machine credentials, and a second secret is a second thing to rotate and forget. Add
a second line to whatever you set up above:

```
curl -X POST https://<your-host>/api/cron/digest \
  -H "Authorization: Bearer $REMINDER_CRON_SECRET"
```

Every 15–30 minutes is right. The endpoint decides for itself whether it is anyone's
morning — it reads each person's own timezone and their chosen send time, so a single
schedule serves every zone.

**Nobody receives a digest until they switch it on** in Settings → Notifications; it is
opt-in, and the response tells you so plainly: `scanned` is how many accounts were read,
`considered` how many were evaluated, and `skipped.off` how many have not opted in. A run
that reports `scanned: 0` means the query itself is failing; `scanned: 6, off: 6` means it
is working and nobody has asked for it yet.
