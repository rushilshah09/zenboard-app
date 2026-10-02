# The agency workflow — diagnosis and plan

**Status:** plan. Written 2026-08-16 against the code as it stands, not from
imagination. Supersedes `CLIENT_PORTAL_MASTER_PLAN.md` where they disagree; that
document described how to *build* the portal, this one describes how the portal
and the internal workspace should relate.

---

## 0. The thing to hold onto

> One powerful internal workspace for the agency, and one simple curated
> workspace for the client — where the second is a **projection** of the first,
> never a copy of it.

Everything below is downstream of that sentence. Every gap is a place where the
product currently makes you *maintain* the client's view instead of *deriving*
it.

---

## 1. What already exists (so we evolve, not rebuild)

It is more than it feels like:

- A per-project magic-link portal at `/portal/[token]`, drawn as a real
  dashboard app-shell, monochrome, responsive.
- `lib/portal.ts` — ONE gated projection used by both the live portal and the
  owner's "Preview as client", so preview cannot drift from live.
- Six project-level share flags: progress · completed tasks · open tasks ·
  timeline · files · invoices.
- Per-item `client_visible` on **tasks** and **pages** (docs).
- A full client-request lifecycle: pending → needs info → approved → declined,
  with threaded messages and a request↔task link.
- Deliverable approvals on documents, with approve / request-changes + note.
- Read-only invoices, and forms surfaced via `show_in_portal`.

**So the brief is not "build a portal".** It is "fix five structural things that
make the existing portal feel like an export of our project manager".

---

## 2. The five real gaps

Each one is evidenced in the code, not asserted.

### Gap 1 — The portal is per PROJECT, not per CLIENT

`projects.portal_token`. A client with three projects gets three magic links and
three separate places to look. Nothing anywhere answers "show me everything
about this client".

This is the single biggest structural miss against *"clients should have one
dedicated portal where they can see everything relevant to them"*.

### Gap 2 — Visibility is set somewhere other than where the work happens

Per-task `client_visible` is edited inside `components/projects/share-panel.tsx`
— a separate surface you open on purpose. So sharing is a **second pass** over
work you have already done: finish the task here, then go there and remember to
tick it.

That is the friction. Not the number of clicks — the *context switch*. Intent
has to be expressible at the moment you have it.

### Gap 3 — The four shareable things obey four different rules

| thing | how it is shared today |
|---|---|
| tasks | per-item `client_visible` ✔ |
| docs | per-item `client_visible` ✔ |
| files | project-level `share_files` flag only — **all or nothing** |
| updates | **not shareable at all** — see gap 5 |

You cannot share one file. You share the folder or you share nothing. A person
learns the task rule and it does not transfer.

### Gap 4 — The owner cannot see what the client has seen

`grep` for `last_seen | viewed_at | seen_at | portal_view` across the codebase
returns **zero results**. There is no read state of any kind.

So of the five things the brief says the owner should always know, the product
can answer two (*what has been approved*, *what is overdue*) and cannot answer
three (*what the client has seen*, *what is waiting for them*, *what needs
follow-up*). You send a link and then you are blind.

### Gap 5 — "Updates" are inferred, not authored

`lib/portal.ts` says it plainly: *"notes / activity are never read, so they
cannot leak"*. The portal's Recent updates are derived from **completed task
titles**.

That is safe and it is also why the portal reads like a project manager: the
client sees a changelog of your internal to-do list rather than a sentence from
you. There is no object in the system whose purpose is "something I want to tell
the client".

---

## 3. How an agency actually works, and where we break it

| the real moment | what the agency wants | what happens today |
|---|---|---|
| **Onboarding** | one link, client fills a brief, everything lands on the project | forms exist but are wired per-form, not as a first step of a project |
| **Setup** | decide once what this client sees | six flags in a panel, then per-task ticking forever |
| **Doing the work** | mark a thing client-facing *as you finish it* | leave the task list, open Share, find the task, tick |
| **Review** | "here is the thing, tell me what you think" | approvals exist, and are good |
| **Approval** | a decision on the record | acceptances exist, and are good |
| **Delivery** | hand over files | all-or-nothing folder |
| **Completion** | close it out, keep the record | project close-out exists internally, invisible to the client |

The two rows that are broken are **Setup** and **Doing the work** — and they are
the two that happen every day.

---

## 4. The design position

**One rule: everything the client can see is a projection of something the
agency owns, marked at the moment of intent.**

Three consequences worth stating, because they rule things out:

1. **No duplicate objects.** There is no "client version" of a task or a file.
   There is one object with a visibility, and the portal reads the visible ones.
   The moment we allow a second copy, the two drift and the owner maintains both.
2. **Visibility is set where the work is**, never only in a settings panel. The
   panel remains — for the bulk pass and for the defaults — but it stops being
   the only way.
3. **The portal never renders anything it was not explicitly given.** The safe
   default is hidden. `lib/portal.ts`'s "select only safe columns" discipline is
   right and stays.

---

## 5. Sprints, in dependency order

Each is a sprint by the house definition — finishable, verifiable, gated.

### S1 — One visibility rule ✅ *done 2026-08-17*
`lib/visibility.ts` is the single vocabulary for "is this client-facing?", and
`components/sharing/share-toggle.tsx` is the single control for it — the same
three states and the same two words on task rows, workstream headers, doc rows
and file rows. Files obey the per-item rule (0039) and now reach the portal at
all, which they never did. Closes gaps 2 and 3.

Two rules that came out of building it, worth keeping:
- **A workstream is a third gate.** A task inside one is governed by that
  stream, not merely filtered against the visible ones — filtering the other way
  let every task in an internal stream fall through into the flat list.
- **Failure may only go one way.** A thrown server action reverts the optimistic
  mark exactly like a returned error (`components/sharing/apply-share.ts`),
  because a chip left reading "Client" for an unmarked row is the app telling
  you a client can see something they cannot.

**Why it was first:** gaps 2 and 3 are the daily friction, and gaps 1, 4 and 5
all needed a settled answer to "what does shared mean?" before being built on it.

### S2 — Updates become a real object ✅ *done 2026-08-17*
A client-facing update is a thing you write, not a thing inferred from task
titles. Closes gap 5.

**It needed no table and no new composer.** The object already existed: the
project Overview's "Update" box has always written a `project_activity` row of
`type = 'note'`. A client update is the same row with `type = 'client_update'` —
one object, two audiences, exactly this document's own no-duplicates rule. See
`lib/updates.ts` for why the type carries the intent rather than a new column,
and why updates ride the **Timeline** switch instead of a channel of their own.

The interaction decision that matters: **two buttons, not one button and a
mode.** Post / Post to client. A sticky "post to client" toggle would eventually
send a private note to a client because it was still on from last time.

### S3 — One portal per client
A client-level token that aggregates every project that client can see. The
per-project link keeps working (it is in emails already) but the client-level
one becomes the thing you send. Solves gap 1.

**Why not first:** aggregating projections is only worth doing once the thing
being aggregated is right.

### S4 — Read state, both directions
`portal_views` (what was opened, and when). Gives the owner the three answers
they cannot get today, and gives the client an honest "new since you last
looked". Solves gap 4.

### S5 — The lifecycle seams
Onboarding form → project setup as one flow; close-out visible to the client;
notification curation so the client gets *what needs you* rather than every
change.

---

## 6. Performance, since it was raised again

Three fixes shipped on 2026-08-15/16 and are documented in `PROGRESS.md`:
navigation round trips collapsed (one wave per route), the double render removed,
the client cache turned on with revalidate-behind, Tasks' rail made shallow, and
a durable mutation queue.

What this plan adds to that list: `lib/portal.ts` is currently ~3 waves (project
lookup → the parallel block → acceptances). It should be 2. That rides along
with S3, which touches those loaders anyway.

**Note:** the biggest numbers in the dev log (`next.js: 4.5s`) are Turbopack
compiling in development and do not exist in production. Compare second hits.

---

## 7. What is NOT in this plan, and why

- **Client login / identity.** The decision on 2026-07-25 was anonymous-link
  only. S3's client-level token stays a capability URL. Revisit only if the
  client needs to see something a link cannot safely carry.
- **Team roles.** Everything is single-owner (`user_id`, owner-only RLS). A
  second seat is a separate track and touches every policy.
- **A client mobile app.** The portal is responsive; that is the answer.
