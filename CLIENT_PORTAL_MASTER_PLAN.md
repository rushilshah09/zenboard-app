# Client Portal — Master Plan

> Status: **Planning deliverable** (no code yet). Once this is approved we build it step by step.
> Author role: Senior PM · UX Director · Software Architect (per `DESIGN_CONSTITUTION.md`).
> Companion docs: `MASTER_PRODUCT_PLAN.md`, `PM_FEATURE_SPEC.md`, `DESIGN_CONSTITUTION.md`.

---

## 0. TL;DR (read this first)

Zenboard **already has a real client portal** — a security-first, per-project magic-link
at `/portal/[token]`, with a single gated projection (`lib/portal.ts`), granular share
flags, per-item `client_visible` overrides, and a `client_requests` inbox with a partial
"Accept as task" flow. **We do not rewrite it. We evolve it.**

The plan has three moves, in priority order:

1. **Request lifecycle (the headline feature).** Turn the fire-and-forget message box into a
   real **Client Request → Internal Task** workflow: approve / reject-with-reason /
   request-more-info, a persistent request↔task link, and a **status the client can always
   see** (Pending → Needs your input → Approved → In progress → Completed / Declined).
   Ships on the *existing* anonymous magic-link — no new auth required.
2. **Client identity (optional, passwordless).** Add email-OTP identity so a returning client
   gets a **client home** across all their projects, cross-device request history, and
   attributed requests. No passwords, no account creation friction.
3. **Full collaboration surface.** Approvals & revisions, client file uploads, read-only
   invoices, activity feed, email notifications, and team roles/permissions.

Everything preserves the **one-projection security doctrine** already in `lib/portal.ts`:
*there is exactly one place that decides what a client may ever see, and preview == live.*

---

## 1. Competitive research — what the best portals actually do

Synthesis of the leading client-portal / client-collaboration products, filtered to what a
calm, agency/freelancer-shaped tool like Zenboard should adopt.

| Product | The idea worth stealing | What to avoid |
|---|---|---|
| **Copilot (copilott.com)** | Passwordless email login; one branded client home; modules toggle per client; "everything the client needs in one link". | Heavy per-seat pricing model; over-broad module sprawl. |
| **SuiteDash / Moxo** | Deep workflow automation, approvals, e-sign, file rooms. | Enterprise UI density — the opposite of "calm". |
| **HoneyBook / Dubsado / Bonsai** | The *journey*: invite → proposal → contract → project → invoice, all in one thread. Money is first-class. | Rigid pipelines; template lock-in. |
| **Notion (shared pages)** | Frictionless read-only share; the *same* doc the team edits is what the client sees. | No status/approval semantics; no request intake. |
| **Linear (customer requests)** | **Requests are first-class objects that link to internal issues**; status flows back; requests aggregate demand. This is the model for our request↔task link. | B2B-dev framing; not client-facing UI. |
| **Basecamp (client-side / "clientside")** | The single best pattern: **team can mark any message/comment "visible to client" or keep it internal**, inline, with a clear on/off. Clients never see the internal chatter. | Dated visual language. |
| **Asana / Frame.io proofing** | **Approval as a state machine**: submitted → in review → approved / changes requested, with the comment thread attached. | Proofing-specific; too narrow alone. |
| **Slack Connect / Front** | Shared thread where both sides converse; internal notes hidden. | Chat-first; loses structured status. |

**The five patterns we commit to:**
1. **Passwordless entry** (magic link now; email-OTP identity later). Never make a client
   create a password.
2. **One projection, explicitly gated.** The client sees a curated view, never the raw record.
   (We already do this — keep it absolute.)
3. **Requests are first-class and linked**, not messages that vanish. Status is always visible
   to the client. (Linear's model, agency-flavored.)
4. **Internal vs. client visibility is a per-item toggle**, obvious and reversible. (Basecamp.)
5. **The money and the work live in the same place** the client already is. (HoneyBook.)

---

## 2. Current-state audit (precise — what exists in this repo today)

### 2.1 Data model (applied: migrations `0001`–`0014`)
- `projects` carries all portal state: `portal_enabled`, `portal_token` (unique, nullable),
  `share_progress`, `share_completed_tasks`, `share_open_tasks`, `share_timeline`,
  `share_files`, `allow_requests`, `portal_intro`. (`0006_portal.sql`)
- `tasks.client_visible` and `pages.client_visible` — per-item additive exposure.
- `client_requests` — `id, project_id, client_token, name, body, status('new'|'seen'|'done'), created_at`.
  RLS: **owner-only** select/update/delete; **no insert policy** (inserts only via service role
  after token validation). Realtime-published.
- CRM objects already exist: `clients` (`name, contact, role, email, status, health, since,
  next_step`), `client_notes`, `leads` (pipeline), `invoices` + `invoice_items` + `payments`,
  and (pending `0016`) `feedback`, `feedback_deals`, `meetings`.

### 2.2 The projection (`lib/portal.ts`) — the security spine
- **One `build()`** used by both the public token route (service role) and owner
  "Preview as client" (RLS). Preview is guaranteed identical to live.
- Selects **only safe columns** (titles + flags), never notes/estimates/time/money.
- Every section gated by its `share_*` flag; `client_visible` additively exposes single items.
- Timeline derived **only** from completed-task titles+dates — internal activity can't leak.
- Scoped to one project + its space name. No client list, no other project, no owner data.

### 2.3 Surfaces that exist
- **Public portal** `app/portal/[token]/page.tsx` → `PortalDocument`: branding, project
  name+status, intro, progress %, recent updates, completed, in-progress, documents, and a
  "Send a message" form. `noindex`, `force-dynamic`.
- **Owner controls** `components/projects/share-panel.tsx` (`SharePanel` drawer): enable/disable,
  copy/rotate link, six share switches, intro note, per-doc & per-task visibility toggles.
- **Requests inbox** `components/projects/requests-tab.tsx` (`RequestsTab`): new/seen/done,
  "Accept as task", "Mark seen/done", reopen. Realtime.
- **Actions** `lib/actions/portal.ts`: `setPortalEnabled`, `rotatePortalToken`,
  `updateShareFlags`, `setTaskClientVisible`, `setDocClientVisible`,
  `updateClientRequestStatus`, `acceptRequestAsTask`, `submitClientRequest`.
- **Preview overlay** `components/projects/preview-overlay.tsx` — in-app "Preview as client".

### 2.4 Gaps vs. the requested workflow (the reason for this plan)
| Requested | Today | Gap |
|---|---|---|
| Client submits request | ✅ `submitClientRequest` | — |
| Appears as pending internally | ✅ status `new` | Wording only (`new` vs `pending`). |
| **Approve → task** | ⚠️ `acceptRequestAsTask` creates a task | **No link kept**: task has no `request_id`, request has no `task_id`; request is just marked `done`. |
| **Reject with reason** | ❌ | Missing entirely. |
| **Request more info** | ❌ | No two-way thread. |
| **Client sees live status** (Pending/Approved/Rejected/In progress/Completed) | ❌ | Client form is fire-and-forget; statuses `new/seen/done` are internal-only and never shown back. |
| Full history/transparency after approval | ❌ | No thread, no back-reference, no task→client status propagation. |

Broader gaps for the "whole portal experience": no client identity, no cross-project client
home, no approvals/revisions, no client file upload, invoices not surfaced, no notifications/
email, single-owner only (no team roles).

---

## 3. Target architecture

### 3.1 Guiding principles (inherited, non-negotiable)
1. **One projection.** All new client-visible data flows through `lib/portal.ts`. Preview==live.
2. **Deny by default.** Nothing is client-visible unless a `share_*` flag or `client_visible`
   or an explicit lifecycle state says so.
3. **Public writes are token-scoped + validated server-side.** Never trust an id from the
   client. anon RLS stays closed; public mutations go through service role after validation.
4. **Design System first.** Every new surface is assembled from `components/ds/ui`. New need →
   extend the DS, then build (`DESIGN_CONSTITUTION.md`).
5. **Backward compatible.** Existing per-project links keep working at every phase.

### 3.2 Identity model — three tiers, additive
```
Tier 0  Anonymous link      /portal/[token]         (exists; keep forever)
Tier 1  Verified visitor    same link + email OTP   (Phase 2 — attributes requests, remembers you)
Tier 2  Client identity     /portal (client home)   (Phase 2 — all your projects in one place)
```
- **Tier 0** is the default and the fastest path — no login, ever. A client can always just
  open the link and see progress + send a request.
- **Tier 1** adds a *soft* identity: to see "your requests" across devices or to get email
  updates, the client verifies an email via one-time code (passwordless). This maps them to a
  `client_contact`. Purely opt-in; the anonymous experience never regresses.
- **Tier 2** is the branded **client home** at `/portal` (post-OTP): lists every project that
  contact can access, plus their requests, invoices, and shared docs.

> **Why passwordless.** Clients abandon password creation; magic-link/OTP is the industry
> norm (Copilot, Notion, Linear) and sidesteps credential storage entirely. It also respects
> the platform rule that we never ask anyone to create a password.

### 3.3 Information architecture
```
INTERNAL (app)                         CLIENT (portal)
─────────────────────────────         ─────────────────────────────
Clients ─ detail                       /portal            client home (Tier 2)
  └ Projects                             └ Project
      ├ Overview                              ├ Overview + progress
      ├ Tasks (client_visible)               ├ What's done / In progress
      ├ Docs (client_visible)                ├ Documents
      ├ Requests  ◄──────────┐               ├ Requests (submit + status)
      ├ Share (SharePanel)   │  the          ├ Files (upload)        [Phase 3]
      └ Money/Invoices       │  request      ├ Invoices (read + pay) [Phase 3]
                             │  ↔ task        └ Approvals             [Phase 3]
Tasks ── request_id ─────────┘  link
```

---

## 4. The complete client journey (invitation → completion)

1. **Invite.** Owner opens `SharePanel`, enables the portal, sends the link (Phase 2: "Invite
   by email" creates a `client_contact` + sends a branded email with the link).
2. **First open.** Client sees the branded overview: studio name, project, intro, progress.
   No login wall. (Phase 2: optional "Get email updates / see your requests" → OTP.)
3. **Orient.** Progress %, recent updates, what's done, what's in progress, shared documents.
4. **Ask.** Client submits a **request** (a feature ask, a change, a question, a file).
5. **Track.** The request shows **Pending**. Client can reopen the portal anytime and see it
   move through the lifecycle. (Tier 0: within their browser session; Tier 1+: anywhere.)
6. **Clarify (optional).** Team hits "Request more info"; client sees **Needs your input** and
   replies in the thread.
7. **Decision.** Team **Approves** (→ becomes a tracked task) or **Declines** (with a reason
   the client reads).
8. **Delivery.** As the linked task moves, the client's request shows **In progress** →
   **Completed** automatically. (Phase 3: on completion, team can attach a deliverable for
   **approval**; client approves or requests changes.)
9. **Money.** (Phase 3) Client sees invoices for the project — status, due date, pay link.
10. **Close.** Project marked complete → portal shows a calm completion state; history remains
    readable for transparency.

---

## 5. Visibility matrix — client-visible vs. internal (the contract)

The single source of truth for what may ever cross into the projection. Anything not listed as
"Client" is internal, forever.

| Object / field | Client sees | Gate |
|---|---|---|
| Project name, status, intro | ✅ | always (when portal enabled) |
| Progress % and X/Y done | ✅ | `share_progress` |
| Completed task **titles** | ✅ | `share_completed_tasks` or task `client_visible` |
| Open task **titles** | ✅ | `share_open_tasks` or task `client_visible` |
| Timeline (completed titles+dates) | ✅ | `share_timeline` |
| Documents (title + rendered text) | ✅ | `share_files` **and** doc `client_visible` |
| Task notes, estimates, time, `$` | ❌ | never selected |
| Internal comments / activity | ❌ | never selected |
| Other clients / projects / owner data | ❌ | query is single-project scoped |
| **Request status + resolution note** | ✅ | new — the request is theirs |
| **Request thread messages** (team↔client) | ✅ (only messages marked client-facing) | new — `author` + visibility |
| Invoice number, status, due, amount, pay link | ✅ | new — `share_invoices` (Phase 3) |
| Invoice internal notes, line-item costs breakdown | ❌ | never |
| Approval requests + client's own responses | ✅ | new (Phase 3) |
| Files the client uploaded | ✅ (their own) | new (Phase 3) |

**Rule:** a new client-facing field is added to `PortalView` **only** by editing `lib/portal.ts`
and this matrix in the same change. No client data reaches a component any other way.

---

## 6. ★ The Client Request → Internal Task workflow (headline feature)

### 6.1 State machine
```
                 ┌───────────────── team: request more info ──────────────┐
                 ▼                                                          │
   submit    ┌────────┐   team approves    ┌──────────┐  task in progress ┌──────────────┐
  ─────────► │ PENDING │ ─────────────────► │ APPROVED │ ────────────────► │ IN PROGRESS  │
             └────────┘                     └──────────┘                    └──────────────┘
                 │  ▲                          (task created,                      │
                 │  │ client replies           request.task_id set)         task done
   team declines │  │                                                              ▼
   (with reason) │  └── NEEDS INFO ◄── team asks                              ┌───────────┐
                 ▼                                                            │ COMPLETED │
             ┌──────────┐                                                     └───────────┘
             │ DECLINED │  (resolution_note shown to client)
             └──────────┘
```

- **Decision state** lives on the request: `pending | needs_info | approved | declined`.
- **Delivery state** (`in_progress`, `completed`) is **derived from the linked task**, not
  stored — so the client's view tracks real work with zero extra bookkeeping. If the task is
  reopened, the client honestly sees "In progress" again.
- **Client-facing label** is a pure function:

```ts
// illustrative — final home is lib/portal.ts
function clientRequestStatus(req, task) {
  if (req.status === 'declined')  return 'Declined';
  if (req.status === 'needs_info') return 'Needs your input';
  if (req.status === 'approved' && task) return task.done ? 'Completed' : 'In progress';
  if (req.status === 'approved')  return 'Approved';       // approved, task not yet created
  return 'Pending';
}
```

### 6.2 Internal actions (owner Requests tab, upgraded)
- **Approve → task.** Creates a task (existing `acceptRequestAsTask` logic) **and now sets
  `tasks.request_id` + `client_requests.task_id`, `status='approved'`.** The task detail drawer
  shows an "From client request" origin chip linking back; the request card shows the linked
  task + its live status.
- **Decline.** Sets `status='declined'` + `resolution_note` (required, ≤500 chars). Client reads
  the reason.
- **Request more info.** Sets `status='needs_info'` and posts a `request_message` (author=`team`,
  client-facing). Client gets a reply box; their reply flips it back to `pending`.
- **Comment (internal).** A `request_message` with `client_facing=false` — never projected.

### 6.3 Client actions (portal)
- Submit a request (title auto-derived from first line; optional body; Phase 3: attachments).
- See status live (§6.1 label).
- Reply when status is **Needs your input**.
- Read the resolution note on **Declined**.

### 6.4 Two-way link & transparency
- `tasks.request_id → client_requests.id` (return path) and `client_requests.task_id → tasks.id`
  (forward path). Either side opens the other. History (the thread) persists on the request even
  after completion, satisfying "full history and transparency".
- Deleting the task nulls `request_id` and drops the request to `approved` (no crash; client
  sees "Approved" until re-linked or re-decided).

### 6.5 Data changes (illustrative — `0017_portal_requests_lifecycle.sql`)
```sql
-- Evolve the decision state; keep old rows valid by mapping new→pending, seen→pending, done→approved.
alter table client_requests
  add column if not exists title           text,
  add column if not exists client_id       uuid references clients on delete set null,
  add column if not exists task_id          uuid references tasks   on delete set null,
  add column if not exists resolution_note  text,
  add column if not exists updated_at       timestamptz default now();
-- widen status: pending | needs_info | approved | declined  (data migration maps legacy values)

alter table tasks
  add column if not exists request_id uuid references client_requests on delete set null;

create table if not exists request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references client_requests on delete cascade not null,
  author text check (author in ('team','client')) not null,
  body text not null,
  client_facing boolean default true,     -- team-internal notes stay off the projection
  created_at timestamptz default now()
);
-- RLS: owner-only for team; public reads/writes go through token-scoped service-role actions.
-- Realtime: add request_messages so both inbox and portal update live.
```

---

## 7. Supporting workflows

### 7.1 Approvals & revisions (Phase 3)
- Any client-visible **doc or completed task** can be sent for approval → `approval_requests`
  (`target_type, target_id, status: awaiting|approved|changes_requested, note`).
- Client sees "Please review" with **Approve** / **Request changes** (+note). Mirrors §6 state
  machine; reuses the thread.

### 7.2 Files (Phase 3)
- Owner→client already covered by shared docs. Add **client→owner upload** via Supabase Storage
  bucket `portal-uploads/<project>/<request>`; a `client_uploads` row records metadata; files
  attach to a request. Size/type validated server-side; virus-scan hook is a future option.

### 7.3 Invoices (Phase 3)
- Surface existing `invoices` read-only in the portal behind `share_invoices`: number, status
  (draft hidden — only `sent|paid|overdue`), due date, total (sum of `invoice_items`), and an
  optional **pay link** (Stripe Checkout — external dependency, see §12). Internal notes and
  cost breakdowns never projected.

### 7.4 Comments, activity, notifications
- **Per-request thread** (§6) is the primary comms channel — structured, not free chat.
- **Activity feed** (client-facing) derives from safe events only (task completed, doc shared,
  request status changed) — same "derive from safe columns" discipline as the timeline.
- **Email** (Phase 2/3): owner notified on new request/reply; client notified on status change
  and (Tier 1) on new updates. Requires a transactional email provider (Resend recommended).

---

## 8. Roles & permissions

Zenboard is single-owner today (`user_id` everywhere, owner-only RLS). Multiplayer is a large,
separable effort — architect now, build last.

| Role | Scope | Can |
|---|---|---|
| **Owner / Admin** | Space | Everything; manage portal, share flags, roles, billing. |
| **Team member** | Space (Phase 4) | Work tasks, answer requests; cannot change billing/roles. |
| **Collaborator** | Project (Phase 4) | Contribute to assigned projects only. |
| **Client contact** | Their projects | View projection, submit/track requests, approve, pay. Never sees internal anything. |

- Client contacts are **not** `auth.users` app users — they're `client_contacts` verified by
  email OTP, with access scoped by a `portal_access(client_contact_id, project_id)` join.
- RLS stance is unchanged for internal tables; portal reads/writes stay in the service-role,
  token/OTP-scoped server actions. This keeps the anon attack surface at zero.

---

## 9. Component inventory (reuse first, per the Constitution)

**Reuse as-is:** `Button`, `Badge`/`StatusBadge`, `Drawer`, `Modal`, `Switch`, `Textarea`,
`Input`, `EmptyState`, `Icon`, `UnderlineTabs`, `Segmented`, `Progress`, `TaskRow`, `Card`.

**Extend:**
- `RequestsTab` → full lifecycle (approve/decline/needs-info + thread + linked-task chip).
- `PortalDocument` → "Your requests" section with status badges + reply box.
- `SharePanel` → add `share_invoices` row (Phase 3) and "Invite by email" (Phase 2).
- `StatusBadge` → add request-lifecycle tones (Pending=neutral, Needs input=warning,
  Approved=info, In progress=info, Completed=success, Declined=danger).

**New DS components (build in `components/ds/ui` first):**
- `RequestThread` — the team↔client message list + composer (client-facing/internal toggle).
- `LifecycleBadge` — request status pill (thin wrapper over `StatusBadge` + the label fn).
- `PortalShell` (Phase 2) — the branded client-home frame (header, project switcher, footer).
- `ApprovalCard` (Phase 3), `FileDrop` (Phase 3), `PayButton` (Phase 3).

All follow `DESIGN_CONSTITUTION.md`: tokens only, ≤1 filled-accent per view, no fill-on-fill,
focus rings intact, responsive, dark-mode native, keyboard accessible.

---

## 10. Edge cases & failure modes

- **Token rotated mid-conversation.** Old link dies; in-flight requests persist on the project
  and are re-viewable once the new link is opened (Tier 1 identity makes this seamless).
- **Portal disabled while a request is open.** Owner still sees/answers it internally; client
  simply can't load the portal until re-enabled. No data loss.
- **Task deleted after approval.** `request_id` nulls; request falls back to "Approved"
  (§6.4) — never a broken state.
- **Duplicate / spam submissions.** Rate-limit `submitClientRequest` per token (e.g. ≤5/min);
  min/max length already enforced (2–4000 chars). Phase 2 OTP raises the bar further.
- **Migration not applied.** Every surface degrades gracefully (queries return `data:null`,
  UI shows the existing "apply migration 0006/0017" empty state) — the established pattern.
- **Client emails to a shared inbox.** Attribution stays soft in Tier 0; Tier 1 OTP resolves it.
- **Long threads / many requests.** Paginate; index `request_messages(request_id, created_at)`
  and `client_requests(project_id, status, created_at desc)`.
- **PII / privacy.** No client data in URLs; OTP codes short-lived and single-use; `noindex`
  stays; projection remains the only read path.

---

## 11. Scalability & future expansion

- **Aggregate demand** (Linear-style): once requests link to tasks and tasks link to feedback
  ($ at stake, from `0016_feedback`), the portal feeds the existing **feedback fabric** — a
  request becomes a demand signal weighted by the client's deal value. Natural, high-value tie-in.
- **Templates & intake forms** — structured request types (bug / change / new work) with fields.
- **Multi-brand / white-label** — per-space branding on `PortalShell`, custom domain (later).
- **Contracts & e-sign** — proposal → contract → signature (DocuSign-class), extends §7.1.
- **Mobile** — the portal is already mobile-first; a client-focused PWA is a light lift later.
- **Team multiplayer** (§8 Phase 4) unlocks assignment, mentions, and per-member workloads.

---

## 12. External dependencies (owner action / credentials required)

| Capability | Dependency | Needed for |
|---|---|---|
| Apply new tables | **Owner pastes SQL** in Supabase (I can't run DDL) | every phase |
| Client email OTP + notifications | **Resend** (or Supabase email) API key | Phase 2 |
| Client file upload | **Supabase Storage** bucket + policies | Phase 3 |
| Pay-invoice link | **Stripe** account + Checkout | Phase 3 |
| Contracts / e-sign | e-sign provider | future |

---

## 13. Phased implementation roadmap

Each phase is independently shippable, backward compatible, and behind graceful degradation.

### Phase 1 — Request lifecycle (no new auth) ← *build first*
Delivers the exact requested workflow on the existing magic-link.
- `0017_portal_requests_lifecycle.sql` (status widen + `title/client_id/task_id/resolution_note`,
  `tasks.request_id`, `request_messages`, RLS, realtime, legacy data map).
- Actions: `approveRequest` (link task both ways), `declineRequest(reason)`,
  `requestMoreInfo(msg)`, `postRequestMessage`, `submitClientReply` (token-scoped),
  extend `lib/portal.ts` projection with "your requests" + thread.
- UI: `RequestsTab` v2 (`RequestThread`, `LifecycleBadge`, linked-task chip, decline/needs-info
  dialogs); `PortalDocument` "Your requests" section + reply box; task drawer origin chip.
- Verify on `/dev-preview/portal` + `/dev-preview/clients`; `tsc`, `vitest`.

### Phase 2 — Client identity & home
- `0018_portal_identity.sql` (`client_contacts`, `portal_access`, OTP sessions).
- Email OTP flow (Resend); `PortalShell` client home at `/portal`; "Invite by email" in
  `SharePanel`; cross-device request history; email notifications.

### Phase 3 — Collaboration surface
- `0019_portal_files.sql` (Storage + `client_uploads`), `0020_portal_invoices.sql`
  (`share_invoices` + read-only projection), approvals (`approval_requests`).
- UI: `FileDrop`, `ApprovalCard`, invoices section, `PayButton` (Stripe).

### Phase 4 — Team & permissions (multiplayer)
- Roles, membership, assignment, mentions; RLS generalized from owner-only to role-based.

---

## 14. Open decisions for you

1. **Scope of "build first".** Confirm Phase 1 (request lifecycle on the existing magic-link) is
   the right first slice. It's the feature you specified and needs no new credentials.
2. **Migration numbering.** `0015_saved_views` and `0016_feedback` are drafted-not-applied.
   Portal work starts at `0017`. OK to proceed on that ledger? (I still can't run DDL — you'll
   paste each file.)
3. **Identity appetite (Phase 2).** Passwordless **email OTP** for clients — confirmed direction?
   (Alternative: stay anonymous-link-only and skip cross-device history.)
4. **Money in the portal (Phase 3).** Read-only invoice status only, or also a Stripe pay link?
5. **Team roles (Phase 4).** Is multiplayer in scope this cycle, or single-owner for now?

> Recommendation: approve **Phase 1** and let me build it end-to-end next (it's self-contained
> and delivers the headline workflow), then sequence 2–4 by your appetite for the external
> dependencies in §12.
