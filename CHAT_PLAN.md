# Chat — the plan

**Status:** ✅ C1 built and verified 2026-09-25 (session e71978cb) — **live once migration 0043 is applied**; C2 next.
**Source:** user, 2026-09-24, sent mid-turn, verbatim: *"now i want introducing the featcher from client to me
and other of the uders of the applicaiton chat featcher"* — then *"same to same like slack"*.
Subordinate to `DESIGN_CONSTITUTION.md` and `SPRINT_RULES.md`.

---

## What exists (researched before designing)

- **No multi-user model.** No members, no invites; every table is owned by one `user_id`. Zenboard is
  single-player today.
- **Clients are not users.** They reach the portal through a share link, `app/portal/[token]`, and the token
  belongs to a **project** (`projects.portal_token`, `portal_enabled`), not to a client.
- **Client messaging already has a security pattern**: `request_messages` (0017) — `author in ('team','client')`,
  the owner reads/writes through RLS on `projects.user_id`, and a client's writes go through a
  **token-scoped server action on the service role**. There is no RLS policy for clients at all.
- **The shared realtime subscription** (`components/shell/realtime-sync.tsx`, perf-owned — do not edit) calls
  `router.refresh()` on every change: a full server re-render, ~1.2s. Chat must NOT ride it.

## Two decisions, and why

**1. Client chat now; team chat is a separate project.** Chatting with other users of the app needs those users
to exist: invitations, workspace membership, and every RLS policy (~40 tables) rewritten from
`user_id = auth.uid()` to a membership check. That is making Zenboard multi-player — a security-critical
architecture change, not a chat feature. It needs the user's go-ahead. Nothing built here is wasted by it: team
chat reuses the same conversation, message and UI model.

**2. A conversation belongs to a PROJECT.** The portal token is a project token, so a project channel keeps the
security boundary exactly where the portal already draws it: a link can never read more than it can today.
Per-client chat would let a leaked link to project A read messages about the same client's project B. On the
owner's side it still reads like Slack — channels in a sidebar, grouped by client like Slack sections.

## The Slack benchmark (specific enough to argue with)

| Behaviour | Slack | Ours |
| --- | --- | --- |
| Author runs | consecutive messages by one author within ~5 min collapse: no repeated name/avatar, time on hover | same, 5 min |
| Day dividers | "Today", "Yesterday", "Monday, September 22" | same, via `lib/date` |
| Send | Enter sends, Shift+Enter newline | same |
| Optimistic | appears instantly, greyed until confirmed; failure offers retry | same (`lib/temp-id`) |
| Unread | a "New" line above the first unread; bold channel + count in the sidebar | same |
| Scroll | opens at the first unread / bottom; new messages only auto-scroll if you are at the bottom, else a "New messages" pill | same |
| Delivery | instant | owner: own realtime channel into state (no refresh); client: token-checked poll while visible |
| Motion | none on send; nothing a keyboard triggers animates | same (house rule) |

## Security model

- **Owner**: RLS on `projects.user_id = auth.uid()`, resolved through the message's project — the
  `request_messages` pattern, unchanged.
- **Client**: NO RLS policy. Every read and write goes through a server action that re-resolves the token
  (`loadPortalByToken` rules: unknown token or disabled portal ⇒ nothing) and uses the service role, scoped to that
  one project. A client can only ever author as `client`.
- Client realtime is deliberately a poll: `postgres_changes` for an anonymous reader would need an anon SELECT
  policy, which would expose every project's messages to anyone holding the public anon key.
- Bodies are length-bounded in the DB (`1..8000`) and rendered as TEXT — never as HTML.

## Phases

- **C1 — the vertical slice** ✅ 2026-09-25: migration `0043_project_messages.sql` + `chatSupported()` gate (the app works
  before and after it is applied); `lib/chat.ts`; owner Messages page (Slack layout: channel sidebar grouped by
  client, message list with author runs and day dividers, composer); portal chat for the client; owner realtime;
  client poll; optimistic send; unread line and counts.
- **C2 — conversation craft**: edit and delete own messages (↑ edits your last), hover actions, copy link,
  "New messages" pill.
- **C3 — threads and reactions.**
- **C4 — files** (reuse attachments, 0033) and notifications (the Bell).
- **Team chat** — needs multi-user workspaces first. Awaiting the user's decision.
