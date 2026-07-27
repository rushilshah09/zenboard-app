# Zenboard — Master Product & Redesign Plan

**Status:** v1 · 2026-07-20
**Scope:** The whole product — vision, architecture, every feature area, and a phased roadmap. Supersedes and absorbs `PM_FEATURE_SPEC.md` (which remains the detailed PM-layer spec; where they conflict, this document wins).
**Companion docs:** `DESIGN_CONSTITUTION.md` (how it looks and feels) · `PROGRESS.md` (build state) · `supabase/migrations/` (data truth).

---

## 0. How to read this document

- **§1–2** — what Zenboard is and the principles every decision is tested against.
- **§3** — the unified object model: the single graph everything hangs on. This is the most important section.
- **§4** — competitive synthesis: what each reference product teaches, and what we deliberately refuse.
- **§5** — honest audit of the current build: strong / incomplete / inconsistent / remove.
- **§6** — the redesigned information architecture and navigation.
- **§7** — feature blueprints, A through W: every major area with problem, references, solution, flows, edge cases, connections, AI angle, and phase.
- **§8** — the never list.
- **§9** — the roadmap: Foundation → Core Productivity → Planning & Execution → Knowledge & Collaboration → Business & Client Management → Automation & AI → Advanced Intelligence.
- **§10** — how we know it's working: the "cancelled subscriptions" test.

---

## 1. Vision & positioning

### 1.1 The one-sentence product

**Zenboard is the operating system for a business of one** — the single calm place where an independent professional plans their day, runs their projects, writes their documents, serves their clients, and gets paid.

### 1.2 The ultimate question

> *What would Zenboard need to become so useful, connected, fast, and intelligent that a user could remove most of their other productivity and work-management applications and confidently run their entire work life from Zenboard?*

The answer is **not** feature parity with eight products. Every competitor already has more features than its users use. The answer is **connection quality**: the moments where work crosses layer boundaries are exactly the moments every point tool drops the ball, and exactly the moments Zenboard is structurally built to own:

| The crossing | What happens today (multi-tool life) | What happens in Zenboard |
|---|---|---|
| Client asks for something | Email → copy into Todoist → tag manually | Portal request → **Accept** → task in project, linked to client |
| Planning tomorrow | Look at Asana, Todoist, Google Calendar, memory | Shutdown ritual picks tomorrow's top 3; morning ritual confirms |
| A task needs real time | Duplicate it into the calendar by hand | Drag task → calendar; one object, two views |
| The work is done, now bill it | Open Harvest → export → open Bonsai → retype | Project Time tab: "3.5h unbilled → Create invoice" |
| Proposal accepted | Retype scope into a new Asana project | Proposal doc → project from template, milestones seeded |
| "How's the quarter going?" | Nobody knows; open five tabs | Monthly review doc: earned, outstanding, goal drift — generated |

Each crossing a user experiences in Zenboard is a subscription they can cancel. That is the growth engine and the roadmap's organizing test (§10).

### 1.3 Who it's for — and the team question, answered

**Primary:** independent professionals — freelancers, consultants, studio-of-one designers/developers, creators, coaches — people who *are* the business. Secondary: founders and 2–3 person studios who work like adjacent solos sharing clients.

The prompt behind this plan asks about teams, workspaces, assignees, cycles. Position, explicitly:

- **v1–v3 (Phases 1–6): one person, many hats.** No assignees, no seats, no workload charts. The client — through the portal — is the only second seat. This is what makes calm achievable: almost all "collaboration" complexity in team tools exists to manage *other people's* attention.
- **Phase 7 horizon: the second chair, not "teams."** If Zenboard ever adds another seat, it is a deliberately small model — a partner/VA/subcontractor who can be handed a project, not an org chart. We translate team concepts into solo-native equivalents rather than importing them (§7F): the **week is the cycle**, the **inbox is triage**, **goals are initiatives**.

### 1.4 Product identity (from the Design Constitution, restated as product behavior)

Premium, calm, intelligent, minimal, fast. In product terms: **no badges, no streaks, no velocity charts, no guilt mechanics, no feature that exists to make the app look powerful in a screenshot.** Zenboard's screenshot is a quiet Today list at 9am and an empty inbox at 6pm.

---

## 2. Core principles

Every feature in §7 was tested against these. New feature requests get tested against them too — that's their job.

1. **One graph, not many tools.** Every entity connects to the spine (§3). A feature that can't state its connections isn't designed yet.
2. **One person, many hats.** The user switches between maker, planner, account manager, and bookkeeper. Navigation mirrors the hats, not the database.
3. **When ≠ deadline.** `scheduled_date` (when I'll work on it) and `due_date` (when it's owed) are separate everywhere. Planning views run on scheduled; urgency signals run on due. (Things 3's deepest idea.)
4. **The plan is a ritual, not a backlog.** Today is curated each morning and closed each evening. Nothing auto-floods it; overdue items ask to be rescheduled, they don't scream. (Sunsama's deepest idea.)
5. **Calm by default.** Progress is quiet facts (`3/8 done · next deadline Fri`). No red counts. The only budgeted moment of delight: the empty inbox.
6. **Keyboard-first, drawer-first.** Everything reachable from ⌘K. Detail views are drawers that never destroy list context. Speed is a feature of calm. (Linear's deepest idea.)
7. **Opinionated defaults, escape hatches, no builders.** Four task statuses forever. No workflow builder, no automation builder, no formula language. Flexibility lives in one contained place: Lists (§7I). (Basecamp's deepest idea, applied to Notion's temptation.)
8. **Structured data has one home.** Tasks stay light — no custom fields ever. Structured/tabular needs go to Lists. Paperwork is Docs + money blocks (§7M). One concept per job, per the glossary.
9. **The business spine is load-bearing.** Client → project → time → invoice → payment is a first-class chain, not an integration. This is the moat; team tools can't follow without breaking their model, freelancer suites can't follow without rebuilding their PM. (Moxie's idea, done with craft.)
10. **AI is a clerk, not a boss.** It parses, files, drafts, recalls, and watches — always suggesting, never silently acting, never auto-scheduling your day. Trust in capture and in the plan is the product; AI must never spend it. (The lesson of Linear's suggestion-first Triage Intelligence, and of Notion's credit-anxiety backlash.)
11. **Every object has an exit.** Export everything (Markdown, CSV, ICS, PDF). Archive, don't trap. Confidence to move in comes from freedom to move out.
12. **Schema before chrome.** Features ship in the build order their migrations allow. The migration list is the roadmap's skeleton.

---

## 3. The unified object model

### 3.1 The five layers + one fabric

Everything in Zenboard lives on one of five layers. Every layer answers a different question about the same work:

```
INTENT     why am I doing this?        Goals · Habits
PLAN       when will I do it?          Today · Week · Calendar · Rituals
WORK       what is the thing?          Tasks · Projects · Docs · Lists
RELATIONS  who is it for?              Clients · Leads · Portal
VALUE      what is it worth?           Time entries · Invoices · Payments
───────────────────────────────────────────────────────────────────────
FABRIC     cross-cutting               Links & mentions · Search · ⌘K ·
                                       Notifications · AI clerk · Files
```

The product's job is to make travel *between* layers effortless. Point tools each own one layer; Zenboard's differentiation is the vertical edges.

### 3.2 The graph (target state)

```
Space (context: "Work", "Personal", second business)
 ├─ Goal ──────────────── links → Projects, Tasks (progress rolls up at review time)
 ├─ Habit ── HabitLog     (checked inside morning ritual)
 ├─ Client ─┬─ Lead (pipeline stage; converts → Client)
 │          ├─ ClientNote (touch log)
 │          └─ PortalLink ── ClientRequest (accept → Task) · Approval · PortalComment
 ├─ Project ── Client?    (the freelancer spine join)
 │   ├─ Section           (Things-style headings)
 │   ├─ Milestone         (project-level, dated; goal checkpoints are renamed "steps")
 │   ├─ Task ── Subtask (parent_task_id, ∞ schema / 2-level display)
 │   │    ├─ status (todo|doing|review|done) · priority (3) · highlight
 │   │    ├─ scheduled_date + due_date · recurrence · estimate · remind_at*
 │   │    ├─ Label (m:n, space-scoped) · blocked_by* (task↔task, P2)
 │   │    ├─ TimeEntry (billable → invoice line) · Comment · Activity
 │   │    └─ event_id* ←──── CalendarEvent (timeboxed twin; 2-way completion)
 │   ├─ Doc               (block editor; also: Proposal = Doc + money blocks)
 │   ├─ List              (0013 collections: custom fields live HERE only)
 │   └─ Attachment*       (one files table: task|project|doc|client|invoice)
 ├─ Invoice ── InvoiceItem (← time_entry_id) ── Payment
 ├─ CalendarEvent ── CalendarConnection (Google 2-way)
 ├─ Ritual (daily_plan | daily_shutdown | weekly_review — one row per day)
 ├─ SavedView* (named filter, appears in nav)
 └─ Notification (digest items, portal events)

Mention* (fabric): any doc block or comment can @-mention any entity → backlinks
```
`*` = table/column does not exist yet; every one is scheduled in §9.

### 3.3 Schema truth (28 tables live) and the six missing pieces

Migrations 0001–0014 are applied. The existing schema already covers ~85% of the target graph — the plan's data work is **six additions**, not a rebuild:

| # | Missing piece | Migration | Unlocks (blueprint) |
|---|---|---|---|
| 1 | `saved_views` | 0015 (drafted, unapplied) | Saved filters in nav (§7I), portal-curated views |
| 2 | `attachments` + storage bucket | 0016 | Files everywhere (§7H); portal deliverables (§7L) |
| 3 | `tasks.event_id` ↔ `calendar_events.task_id` | 0017 | Timeboxing (§7C/D) |
| 4 | `tasks.remind_at` + push worker | 0018 | Reminders (§7B) |
| 5 | `mentions` (entity↔entity, typed) | 0019 | Backlinks, "Connected" panel, Ask-AI grounding (§3.4) |
| 6 | `milestones.project_id` repoint + `blocked_by` links | 0020 | Project milestones (§7E), dependencies-lite (§7B) |

House rules stand: idempotent SQL, owner-only RLS, user pastes DDL, `types/database.ts` synced by hand.

### 3.4 The fabric: links, mentions, and the Connected panel

The single highest-leverage *new* mechanic in this plan. One `mentions` table (`source_type/id`, `target_type/id`, `context`) written by three producers:

1. **@-mention** in any doc block, comment, or note (`@Acme rebrand`, `@INV-012`, `@Sarah Chen`).
2. **Structural links** already in FKs (task→project, invoice→client) — mirrored automatically.
3. **AI clerk suggestions** ("this doc mentions the Acme deadline — link it?") — accepted with one tap, never auto-written.

Every drawer and detail view gains one quiet **Connected** section: the entity's edges, grouped by type. This is what makes Zenboard feel like one system instead of tabs — a client's page shows the proposal, the project, the unpaid invoice, and last Tuesday's meeting note without anyone filing anything twice. It is also the retrieval substrate for Ask (§7Q): AI answers cite graph edges, not embeddings guesswork.

---

## 4. Competitive synthesis — what each product teaches, and what we refuse

Method: for each reference, *why the signature feature exists*, *where its workflow succeeds*, *where it creates friction*, and *the transplant decision*. (Sources in Appendix.)

### 4.1 Notion — flexibility as product

- **Why it wins:** one block model underneath everything; databases-with-views turn structure into a user decision; it genuinely replaces 4–5 tools for solos. 3.0/3.3 (2025–26) added autonomous and custom agents that run on triggers with scoped permissions and write back into databases.
- **Where it fails:** flexibility is homework — every user must be their own product designer; performance degrades with scale; "everything is a page" means *nothing has behavior* (a Notion task doesn't know it's a task); agent pricing (credits, ~$10/1k, no rollover) created cost anxiety that burned trust.
- **Take:** the block editor for Docs (§7H); databases *contained* as Lists (§7I); the lesson that custom agents need scoped permissions; backlinks/mentions as fabric.
- **Refuse:** user-built structure as the core model; formula language; per-run metered AI pricing; templates-as-economy.

### 4.2 Linear — speed and opinion as product

- **Why it wins:** opinionated workflow (triage, cycles, projects→initiatives) that teams adopt *because* they can't configure it; sub-100ms interactions; keyboard grammar; 2026's Triage Intelligence suggests assignees/labels/projects from historical patterns and only auto-applies once confidence is earned; Agent takes bugs from triage to reviewed fix; Asks turns requests into structured triage items.
- **Where it fails:** engineering-team-shaped — meaningless for one person's client work; cycles/velocity create pressure by design; its calm is aesthetic, not structural.
- **Take:** triage as a *mode* (one item at a time, single-key actions — §7A); keyboard grammar everywhere; suggestion-first AI that learns from your own filing history (§7Q); "Asks" reborn as the client portal request form (§7L).
- **Refuse:** cycles as objects, velocity/insights, assignees, custom workflows.

### 4.3 Asana — coordination as product

- **Why it wins:** dependencies, milestones, portfolios, timeline; rules-automation and (2026) AI Studio + prebuilt "AI teammates" for intake/routing/status reporting.
- **Where it fails:** everything exists to coordinate *many people* — for a solo it's pure ceremony; 21 prebuilt agents is bloat theater; its automation builder is a second product to learn.
- **Take:** milestones as dated project checkpoints (§7E); sections; the *idea* of a timeline read-only mini-gantt (P2); dependency alerts translated to a humble "blocked by" link.
- **Refuse:** portfolios, workload, approval chains, rules builder, agent zoo.

### 4.4 Things 3 / Todoist / TickTick — the personal task core

- **Why they win:** Things: Today/Upcoming/Anytime/Someday model, when≠deadline, headings, silence-as-design. Todoist: natural-language capture, filters, cross-platform ubiquity. TickTick: pomodoro+habits+calendar bundled cheaply.
- **Where they fail:** Things: Apple-only, no collaboration, no business layer, frozen. Todoist: karma/streak gamification against calm; projects are just lists. TickTick: kitchen-sink UI noise. All three: tasks are *terminal* — they connect to nothing (no client, no invoice, no doc).
- **Take:** the entire daily-planning core (already Zenboard doctrine): curated Today, scheduled vs due, NL capture with confirming chips, headings→Sections, checklists→subtasks; TickTick's insight that focus timer + habits belong *near* tasks (Zenboard has both).
- **Refuse:** karma, streaks, shared projects, priority sprawl (P1–P4 + flags).

### 4.5 Basecamp — restraint as product

- **Why it wins:** per-project toolset, message-board-not-chat, Hill Charts (progress = narrative honesty about uncertainty, not %), the never-list as positioning, calm as company philosophy.
- **Where it fails:** to-dos are toys (no scheduling model at all); no client/money layer; opinionation without personal-planning depth.
- **Take:** the anti-feature discipline (§8); project health as an owner-written sentence, not a score (§7E); Hill-Chart *honesty* translated to "stated, not scored."
- **Refuse:** nothing to steal technically; the philosophy is the import.

### 4.6 Sunsama / Akiflow — the ritual layer

- **Why they win:** Sunsama: the guided morning ritual (pick, estimate, fit to your day, declare a stop time) and evening shutdown — planning as a non-skippable discipline. Akiflow: universal capture into one inbox, keyboard triage, drag-to-calendar timeboxing, slots.
- **Where they fail:** both are $20–34/month *overlays* on your real tools — consolidators that add a tool to reduce tools; Sunsama's ritual can feel like homework on chaotic days; Akiflow has no opinion at all about *whether* you plan.
- **Take:** ritual as first-class object (Zenboard already has `rituals` rows — ahead of everyone here); shutdown feeds tomorrow; timebox = task↔event twin link (§7C/D); "does the plan fit the day" capacity line.
- **Refuse:** being an overlay (Zenboard *is* the source of truth); auto-scheduling (see Motion); per-ritual paywalls.

### 4.7 Moxie / Bonsai / HoneyBook — the business spine

- **Why they win:** they understand that for a freelancer the unit of work is *the client engagement*: proposal → contract → project → time → invoice → payment, plus a portal. Moxie: genuinely good PM for solos + white-label portal. Bonsai: contracts/tax depth. HoneyBook: the polished client-facing flow (proposal+contract+invoice as one signable, payable document).
- **Where they fail:** all three have weak-to-absent *daily work* layers (no real planning, primitive tasks, no docs/knowledge); their UX is form-heavy, 2015-SaaS; HoneyBook stops at booking (no delivery PM); you still need Todoist/Notion beside them — which is the whole disease.
- **Take:** the engagement lifecycle as a chain of Zenboard-native objects (§7K–N); HoneyBook's one-document accept-and-pay flow rebuilt as Docs+money blocks (§7M); portal-as-curated-view; Moxie's "project templates are the retention feature."
- **Refuse:** form-wizard UX; feature checklists (bookkeeping, taxes — integrate, don't build); white-label vanity before the core earns it.

### 4.8 Synthesis: the four families, and the empty seat

Personal task managers own the *day*. Team trackers own the *project*. Docs tools own the *knowledge*. Freelancer suites own the *money*. **Nobody owns the graph.** Every "all-in-one" attempt (ClickUp, Notion-with-templates) wins breadth and loses calm. The seat Zenboard takes: *all five layers, one person, calm enforced by opinion, connected by the fabric.*

---

## 5. Current-state audit

Grounded in the live app (16 routes, 28 tables, deployed on Cloudflare Workers + Supabase), `PROGRESS.md`, and the design-audit history.

### 5.1 What Zenboard already does well (protect these)

| Strength | Evidence |
|---|---|
| **The five layers already exist in schema** | goals/habits · rituals/calendar · tasks/projects/pages/collections · clients/leads/portal · time/invoices/payments — no competitor's v1 had this spine |
| **The money loop closes end-to-end** | unbilled time × rate → invoice draft → sent → payment → paid; verified live |
| **Ritual layer is real, not a blog post** | daily plan / shutdown / weekly review write durable rows; time-aware entry points |
| **Portal exists** | token links, preview-as-client, client requests table — the second seat is built |
| **Task model is right** | scheduled+due split, statuses, ∞ subtasks, recurrence jsonb, labels+sections tables landed (0014) |
| **Speed & calm foundations** | optimistic writes, realtime sync, drawer-first detail, ⌘K with live cross-entity search, completion sound, no badges anywhere |
| **Design system discipline** | tokens-only color, enforced components, glossary, self-check ritual — rare at this stage |

### 5.2 What is incomplete (built, but not finished)

1. **Documents is mid-rebuild** — M0 block-editor spike passed; `/library` (old two-pane textarea pages) and `/documents` (new) coexist. Two doc systems violate the glossary.
2. **Project workspace tabs are stubs** — Docs / Timeline / Requests / Time / Files render honest empty states but do nothing.
3. **Labels & sections have tables (0014) but thin UI** — no filter integration, no label management surface.
4. **Goal rollup isn't wired** — `tasks.goal_id` and `goals.progress` exist, never reconciled.
5. **Milestones live at goal level** — spec (and this plan) put them on projects.
6. **Notifications table exists with no product** — no digest, no surface.
7. **`saved_views` (0015) drafted, unapplied.**
8. **Google Calendar sync wired, pending OAuth config** — never live-tested.
9. **iOS app Milestone 1 built, unverified** (no local Xcode).
10. **Recurrence contract unhardened** — jsonb exists; spawn-next semantics undocumented/untested.
11. **Onboarding route exists** but is not the designed first-run (§7U).
12. **Design-system consolidation mid-flight** — three component layers; P0 slice 1 done; legacy `primitives.tsx` still has ~31 importers.

### 5.3 What is inconsistent or confusing (fix in Foundation)

- **Naming drift:** nav says Home/Goals/Finance; routes say `/today`/`/horizon`/`/money`; glossary says Documents but `/library` survives. One name per concept — align labels, routes stay (redirects are cheap, renames aren't).
- **Two task composers/parsers** (Tasks page vs quick-add) — unify into `lib/task-parse.ts` as the single NL grammar.
- **Week view is orphaned** — a route without a home in nav; fold into the planning continuum (§7C).
- **Habits vs Rituals unclear** — two adjacent cadence systems with no connection; habits should surface *inside* the morning ritual (§7G).
- **`milestones` double meaning** — goal checkpoints vs project milestones; rename goal-level to "steps."
- **8-tab project bar** exceeds what a solo project needs; consolidate to 5 (§7E).

### 5.4 What should be removed or simplified

| Item | Action |
|---|---|
| `/library` route + old pages UI | Merge content into Documents; redirect; delete after migration |
| Project Timeline tab | Fold into Overview (next milestone + date spans); real gantt is P2-maybe |
| Project Files tab | Files become attachments inside Docs/Tasks; no separate tab |
| Duplicate composers | One parser, one composer component |
| `kibo-ui` parked directory | Delete (0 importers) when DS consolidation completes |
| `/design` internal route | Keep, but exclude from prod nav (dev-only flag) |
| Leads-vs-Clients as separate mental models | One Clients hub; Pipeline is a tab (already the design — finish it) |

### 5.5 The ten questions, answered in one screen

1. **Well:** the spine exists, money loop closes, rituals are real, portal exists, calm is enforced by a design system.
2. **Incomplete:** docs rebuild, project tabs, labels UI, goal rollup, notifications, calendar sync, recurrence contract (§5.2).
3. **Redesign:** IA/nav (§6), Home (§7V), project workspace (§7E), Documents (§7H), onboarding (§7U).
4. **Remove:** §5.4 — mostly duplication, not features.
5. **Missing:** the fabric (mentions/Connected), attachments, timebox link, reminders, saved views, proposals/contracts, payments rails, digest, Ask.
6. **Learn from:** §4 — triage mode, block editor, ritual discipline, engagement lifecycle, restraint.
7. **Better than competitors:** every layer-crossing in §1.2; calm as structure; one price replacing a $75–100/mo stack.
8. **Unify:** library+documents · milestones · week+today+calendar grammar · habits→rituals · files · paperwork-as-docs · one parser · one TaskRow/drawer.
9. **AI:** five clerk capabilities (Parse, File, Draft, Recall, Watch), suggestion-first, flat-priced (§7Q).
10. **Evolve together:** the phased roadmap sequences by dependency on the graph, not by feature hype (§9).

---

## 6. Information architecture & navigation

### 6.1 The IA rule

Navigation mirrors the **hats** (principle 2), not the tables. Three groups, ≤10 items total, everything else reached through context or ⌘K.

```
MY DAY                          ← the maker/planner hat (personal rhythm)
  Home        /today            greeting · today's plan · capacity · ritual entry
  Inbox       /inbox            capture landing + triage mode        (count shown quietly, never red)
  Tasks       /tasks            all tasks: filters · saved views · Upcoming (absorbs /week)
  Calendar    /calendar         events + timeboxed tasks · gcal

WORK                            ← the account-manager/maker hat
  Projects    /projects         rail + workspace (5 tabs, §7E)
  Clients     /clients          clients + pipeline + portal management
  Docs        /documents        block editor · wiki · proposals live here
  Finance     /money            invoices · payments · unbilled

HORIZON                         ← the founder hat
  Goals       /horizon          goals ← project/task rollup
  Habits      /habits           tracked inside rituals, reviewed here
```

Not in nav, reached in context: **Focus** (toggle from Home / any task), **Rituals** (time-aware buttons on Home + top bar), **Settings** (user menu), **Portal** (client-side only), **Week** (becomes Tasks → Upcoming + Calendar week lens; route redirects).

### 6.2 Naming (glossary, enforced)

One name per concept, nav label = spoken name: **Home · Inbox · Tasks · Calendar · Projects · Clients · Docs · Finance · Goals · Habits.** Retire from UI: Library, Horizon (label), Money (label), Note (entity), Milestone-on-goals (→ "steps"). Routes keep their slugs; labels and page titles align.

### 6.3 Global grammar (the fabric UI)

- **⌘K** — one palette: navigate, create, search, act, Ask (§7J).
- **One keyboard grammar everywhere** a list of tasks exists: `⏎` open · `e` done · `s` schedule · `p` project · `l` label · `1/2/3` priority · `t` today.
- **One drawer** — task detail is the same drawer on Home, Tasks, project tabs, Calendar, portal-admin. Docs open as pages; everything else opens as drawer or two-pane detail.
- **Connected panel** — every drawer/detail gets the backlinks section (§3.4).
- **Undo everywhere** — every destructive or bulk action returns a toast with undo; triage and rituals are fully reversible.

---

## 7. Feature blueprints

Format per area: **Problem → References → Solution → Flow → States & edges → Connected → Mobile → AI → Deps/Phase.** Priorities: P0 (beta-blocking), P1 (fast follow), P2 (later), H (horizon/Phase 7).

---

### 7A. Capture & Inbox (quick capture, triage)

**Problem.** Capture friction is the root productivity failure: if recording a thought costs >3 seconds or demands decisions (which project? when?), people fall back to their heads. And a captured pile without a processing ritual becomes a guilt list.
**References.** Todoist (NL capture — best in class; but capture and organize are collapsed into one anxious moment) · Akiflow (universal inbox from other tools; but it's an overlay) · Linear Triage (queue with single-key decisions and, in 2026, learned suggestions; but team-shaped) · GTD (capture ≠ clarify).
**Solution.** Two strictly separated moments. **Capture:** ⌘K → type → enter → gone (to Inbox, zero decisions, from any screen; also: portal requests, email-in later, iOS share sheet later). NL chips (`tomorrow`, `!high`, `#acme`, `~30m`, `every monday`) parse visibly as removable chips — the chip is the confirmation, nothing is silently interpreted. **Triage:** Inbox offers a one-item-at-a-time mode; keyboard grammar decides each item (`s`chedule / `p`roject / `d`elete / `⏎` keep in inbox); empty inbox is the reward state.
**Flow.** Capture: any screen → ⌘K or `c` → text → ⏎ → toast "Added to Inbox (undo)". Triage: Inbox → "Triage" (or `⇧T`) → card stack UI, one item, big type → keys → next → "Inbox is clear." moment.
**States & edges.** Empty inbox (goal state, quiet celebration) · 100+ item backlog (show "oldest first / newest first" toggle; never shame) · captured duplicates (AI may whisper "similar task exists — merge?") · undo restores both item and position.
**Connected.** Accepting a portal request creates a pre-linked task (client+project). Triage `p` assigns project; `g` links goal. Every capture records source (manual / portal / email / share).
**Mobile.** Capture is *the* mobile job: app opens to Home with a thumb-reachable capture field; share sheet capture P1 (iOS).
**AI.** *File* capability: in triage, suggested chips (project, date, label) from historical filing patterns — Linear's model, one tap to accept, off by default, never auto-applied.
**Deps/Phase.** Parser unification (no migration) → **P0, Phase 2**. Email-in worker → P2. AI chips → Phase 6.

---

### 7B. Tasks & subtasks (anatomy)

**Problem.** Task systems die of either anemia (a string and a checkbox — reality doesn't fit) or obesity (custom fields, five priority levels, workflow builders — entering a task becomes data entry).
**References.** Things (perfect minimal anatomy; but no labels-as-filters, no business links) · Todoist (labels/filters; priority sprawl) · Linear (statuses with meaning; team fields) · TickTick (reminders done right; cluttered) · Asana (dependencies; ceremony).
**Solution.** The anatomy is frozen: title · notes · project/section · subtasks (∞ schema, 2-level display) · status (todo/doing/review/done — `done` stays the authoritative bit) · priority (3) · highlight ★ · scheduled_date · due_date · estimate · recurrence · labels (flat, space-scoped, ≤12 encouraged) · remind_at (one) · blocked_by (P2, greys the task in Today until blocker completes) · time entries · comments · attachments. **No custom fields, ever** (Lists exist for that). Recurrence contract hardened and documented: completing a recurring task spawns the next occurrence; `every` (fixed cadence) vs `every!` (after completion) semantics tested.
**Flow.** Row click → drawer (list context preserved). Drawer: title/notes inline-edit, meta as chips, subtask tree with drill-in breadcrumb, comments as log. All fields keyboard-reachable.
**States & edges.** Done-with-open-subtasks → confirm cascade or keep · recurring + overdue → next occurrence never stacks (one live instance max) · task completed from calendar twin or portal view reflects everywhere (one source of truth) · deleting a parent offers re-parent or cascade · timezone: dates are dates (no TZ math on scheduled/due); reminders are timestamps.
**Connected.** project/section · goal · client (via project) · doc mentions · calendar twin · invoice line (via time entries) · blocking links. All visible in Connected panel.
**Mobile.** Row check-off, drawer read/edit, capture; reordering and bulk ops stay desktop-first.
**AI.** *Parse* (NL fields) and *Recall* ("what did I say about X?" over comments/notes).
**Deps/Phase.** Labels UI + filters (tables exist) → **P0, Phase 2**. Reminders (0018 + worker) → P1, Phase 3. Blocked-by (0020) → P2, Phase 5+.

---

### 7C. Daily planning, rituals & timeboxing

**Problem.** The gap between "my tasks" and "my day" is where work-life balance dies: either no plan (reactive day), or a fantasy plan (20 tasks, 8 hours), with no end-of-day boundary. Sunsama proved people pay $240/yr just for this layer.
**References.** Sunsama (guided ritual, stop-time-first, shutdown; but a $20/mo overlay with homework-feel) · Akiflow (fast drag-planning, slots; no opinion) · Things Today (curation; no time-fit check) · Motion (auto-scheduling — the cautionary tale: the machine owns your day).
**Solution.** The **planning continuum**: Shutdown (evening) → Morning plan → Today → Focus. Shutdown reviews done, sweeps unfinished (reschedule/tomorrow/drop — never auto-rollover), picks tomorrow's top 3, closes with a one-line reflection. Morning plan confirms the 3, adds from Inbox/Upcoming, shows the **capacity line** (Σ estimates vs. work hours — "your plan is 9.5h; your day is 7h") and offers timeboxing: drag any Today task onto the day column → creates the linked calendar event twin. Rituals are skippable (we're calm, not Sunsama-strict) but Home visibly reflects an unplanned day with one quiet prompt, not a nag.
**Flow.** Top-bar time-aware button (Plan day ↔ Shutdown) → full-screen calm flow (exists) → writes `rituals` row. Weekly review (§7G) on the same rail.
**States & edges.** Skipped ritual (Home shows "No plan yet — plan your day?" once) · overloaded capacity (line turns warning; suggests moving lowest-priority — never auto-moves) · vacation mode (pause rituals + habit streaks without loss) · timezone travel (day boundary = local).
**Connected.** Shutdown picks feed morning plan · highlight ★ feeds Focus default · plan/reflection text feeds weekly review · timeboxes are calendar events (§7D).
**Mobile.** Shutdown and morning plan are *great* phone moments — full mobile parity for rituals; timeboxing drag is desktop-first (mobile: "schedule at…" sheet).
**AI.** *Draft*: shutdown pre-drafts the summary ("Shipped 6, moved 2"); morning plan can suggest the top 3 from due dates + goal links — suggestions in chips, one tap.
**Deps/Phase.** Shutdown→tomorrow picker + capacity line → **P0, Phase 3**. Timebox link (0017) → P1, Phase 3.

---

### 7D. Calendar & scheduling

**Problem.** The calendar is the only place where time is real. If tasks and events live in different apps, every plan is a guess, and double-entry (task + blocking event) is the tax.
**References.** Akiflow/Sunsama (task-on-calendar; overlays) · Notion Calendar (pretty, shallow task link) · Morgen (scheduling links + tasks) · Google Calendar (the system of record — fight it and lose).
**Solution.** Zenboard Calendar is a *lens*, not a silo: Google 2-way sync (wiring exists; finish OAuth config) renders external events; Zenboard events (colored calendars model, exists) add rituals, focus blocks, and **task twins**. A timeboxed task is one object with two projections — completing either side completes both; moving the event moves the task's scheduled time; deleting the event un-timeboxes (never deletes) the task.
**Flow.** Month/Week/Day via `<Segmented>`. Drag task from the rail (Today list docked right) onto a slot → twin created with estimate as duration. Event click → composer popover (exists) or task drawer if twin.
**States & edges.** gcal edit conflicts (last-write-wins + activity note) · recurring events vs recurring tasks (never auto-twin recurrence; twin per occurrence) · all-day events don't consume capacity · offline/expired token (banner in Settings, sync paused not broken) · declined events ghost out.
**Connected.** Events ↔ tasks (twin) · meetings can @-mention a client → the client's page shows upcoming meetings · "meeting → note" one-tap creates a Doc pre-linked to event + client (P1 — the consultant's dream).
**Mobile.** Read + check-off + day view; creating twins is desktop-first.
**AI.** *Watch*: "Your Thursday has 5h of meetings and 6h planned work" surfaces in the morning ritual, not as a push.
**Deps/Phase.** OAuth config + sync verify → **P0, Phase 3**. Twin link (0017) → P1, Phase 3. Meeting-note → P1, Phase 4.

---

### 7E. Projects (structure, health, templates, lifecycle)

**Problem.** A solo's project isn't a coordination surface — it's a *memory* surface: what's the shape of this engagement, what's next, what's stuck, what did we agree. Team tools answer "who's doing what"; solos need "where does this stand and what's the next action."
**References.** Asana (sections/milestones) · Basecamp (health as narrative; per-project toolset) · Linear (project as unit of focus) · Moxie (client join + templates as retention) · Things (headings).
**Solution.** Project = client? + sections + tasks + milestones + docs + lists + time + portal. Workspace consolidates 8 tabs → **5: Overview · Tasks (List/Board/Calendar) · Docs (incl. files) · Money (time + invoices for this project) · Portal (share, requests, approvals, activity).** Overview = the memory surface: one-line owner-written status ("Waiting on client copy — since Tue", pinned from Activity — the sentence *is* the hill chart) · next milestone · quiet counts (`5 open · 12 done · due Jul 28`) · key tasks · recent activity. **Milestones** move to project level: dated checkpoints rendering on Overview + Calendar. **Templates:** "New project from template" seeds sections, tasks with relative dates (day 0 / +7 / +14), milestones, default docs — freelancers rerun the same engagement; this is the retention feature. **Lifecycle:** active/paused/done/archived; marking done triggers the close-out moment: unbilled time prompt ("2.5h unbilled on this project — invoice now?") + 2-line retro into Activity.
**Flow.** Rail (projects list, open-count) → workspace. New project: name → client? → template? → done (3 fields max).
**States & edges.** Paused projects leave Today suggestions · archived = read-only + excluded from search-by-default · template with relative dates landing on weekends → next workday · client deleted → project keeps a tombstone reference · portal open while archiving → confirm revoke.
**Connected.** client (spine) · goal (rollup) · portal · invoices via time · docs/lists · milestones on calendar.
**Mobile.** Overview + task check-off; template creation desktop-first.
**AI.** *Draft*: close-out retro pre-draft from activity; status-line suggestion when the project's been quiet 7 days ("Still waiting on client copy?").
**Deps/Phase.** Tab consolidation + sections UI → **P0, Phase 3**. Milestones repoint (0020) → P1, Phase 3. Templates (`project_templates` jsonb) → **P1, Phase 3** (high retention value). Close-out → P0, Phase 3.

---

### 7F. Cycles, sprints, backlogs, initiatives — translated for one

**Problem.** These exist to synchronize many people's attention (cycles), manage infinite demand (backlog/triage), and connect execution to strategy (initiatives). A solo has the same *needs* with none of the coordination — importing the objects imports the ceremony.
**References.** Linear cycles/initiatives (rhythm + strategy link; team-shaped) · Shape Up (appetite, betting — the useful mental model) · Todoist "someday" labels.
**Solution.** Translate, don't transplant. **The week is the cycle:** weekly review = retro + planning ("what moves this week?"); "This week" is a planning bucket (scheduled range), not an object. **The backlog is Anytime/Someday:** tasks with no scheduled date, grouped per project ("Later" section collapse); the weekly review resurfaces them ("3 someday items in Acme — still true?"). **Initiatives are Goals:** projects/tasks link to goals; the rollup (§7G) is the initiative view. **Appetite** (Shape Up) appears as one optional project field: "budget: 20h or $3k" — the quiet line on Overview (P2, with budgets §7N).
**Deps/Phase.** No new objects — this blueprint is *restraint* plus weekly-review polish → Phase 3.

---

### 7G. Goals & habits (Horizon)

**Problem.** Goals fail two ways: shrine goals (written in January, seen in December) or dashboard goals (metrics twitching daily, creating noise). Habits fail by shame (streak-guilt) or isolation (a tracker app disconnected from the day).
**References.** Linear initiatives (execution-linked; corporate) · Notion goal templates (shrines) · TickTick/Streaks habits (gamified guilt) · Sunsama weekly review (the right cadence).
**Solution.** Goals live at quarter/year altitude with linked projects/tasks. **Progress reconciles at review time, not live** — goals shouldn't twitch. Weekly review shows each goal: trend since last review, linked-work done-counts, and the one question — "still true?" (edit/pause/drop without ceremony). Goal checkpoints rename to **steps** (milestone name freed for projects). **Habits:** check-ins happen *inside* the morning ritual (one row of quiet dots); `/habits` is the review surface (calendar heat, gentle streaks — no fire emoji, no loss-shaming; a missed day is a gray dot, not a broken chain). Vacation pause exists.
**States & edges.** Goal with zero linked work → review asks "link something or park it" · completed goal → archive with retro line · habit created mid-week → no retroactive misses.
**Connected.** goal ← projects/tasks (rollup) · goals glance is a weekly-review step · habits feed morning ritual.
**AI.** *Watch*: "Website-rebuild goal has had no linked activity for 3 weeks" — said once, in the weekly review only.
**Deps/Phase.** Rollup wiring (columns exist) → **P1, Phase 3**. Steps rename → Phase 1 (glossary). Ritual-embedded habit row → P1, Phase 3.

---

### 7H. Documents, notes & files (knowledge)

**Problem.** Work generates prose — meeting notes, briefs, scope docs, ideas — and it either scatters (Apple Notes + Google Docs + email) or gets trapped in a docs tool that doesn't know about the work. The killer failure: the note about the Acme kickoff has no idea the Acme project exists.
**References.** Notion (block editor is the correct model; but structure-homework and everything-is-a-page anemia) · Basecamp docs (simple, project-scoped; primitive editor) · Obsidian (backlinks as fabric; developer-hostile) · Craft (polish; island).
**Solution.** One Docs system on the block editor (M0 spike passed; RichSpan + single-active-block architecture locked). Blocks: text/headings/lists/todo/quote/divider/image/callout + **entity blocks** (@-mention any Zenboard object → live chip) + **List embed** (§7I) + later money blocks (§7M). Docs organize by project (primary), folder (library-style), or standalone; `/library` content migrates in and the route dies. Covers/icons/comments already built. **Files:** one `attachments` table + storage bucket; files attach to tasks/docs/projects/clients/invoices; a project's Docs tab shows its docs *and* files (no separate Files tab).
**Flow.** `⌘K → "New doc"` or project → Docs → New. Slash menu for blocks. @-mention → Connected edges both ways. Doc templates (meeting note, brief, retro) as starting bodies.
**States & edges.** Doc autosave conflict (single-user: last-write + local undo history) · huge docs (virtualized blocks — architecture already chose this) · deleting a mentioned doc → mentions become tombstones · export any doc as Markdown/PDF (principle 11) · paste from Google Docs/Notion cleans to blocks.
**Connected.** doc ↔ project/client/task/event mentions · meeting-note from calendar (§7D) · proposal docs feed money (§7M) · portal can share individual docs read-only.
**Mobile.** Read + comment + light edit; heavy authoring desktop.
**AI.** *Draft* (meeting-note skeleton from event context; client-update draft from project activity) · *Recall* ("what did we agree about revisions?" — answers cite the doc).
**Deps/Phase.** Editor M1–M10 → **P0, Phase 4** (the phase's centerpiece). Attachments (0016) → P0, Phase 4. Library merge → Phase 4, then delete route.

---

### 7I. Lists (databases, saved views, custom structure)

**Problem.** Some work is genuinely tabular — content calendars, asset trackers, feedback logs, job applications. Without a home, this pressure deforms tasks ("can we add custom fields?") or leaks to spreadsheets. Notion solved it and then let the solution eat the product.
**References.** Notion databases (right idea; formula-language rabbit hole, structure homework) · Airtable (power; a second career) · Todoist filters (saved queries done simply).
**Solution.** **Lists** (0013 `collections` — glossary name Lists) are contained structured tables: typed fields (text/number/select/date/checkbox/url/relation-to-client-or-project), table + board views, sort/filter. **Deliberately absent: formulas, rollups, automations, cross-list relations.** A List lives in a project or stands alone; docs can embed a List view. **Saved views** (0015): any filter combo on Tasks ("Client work due this week") saved and pinned to Tasks nav — the query-language-free version of Todoist filters.
**States & edges.** Field type change → safe coercion with preview · select option deleted → values orphan visibly · List rows are *not* tasks (no checkbox confusion; a row can link a task).
**Connected.** List ↔ project/doc embed · relation fields → client/project pages show referencing rows in Connected.
**Mobile.** Read + inline cell edit; schema editing desktop.
**AI.** *File*: "paste CSV → propose fields" import assist.
**Deps/Phase.** Apply 0015 → **P1, Phase 2** (saved views). Lists UI polish → P1, Phase 4 (with doc embeds).

---

### 7J. Search & command palette

**Problem.** The graph is only as good as its retrieval. If finding something takes longer than asking the client to resend it, the system has failed. Search must span every entity or users keep a mental map of "which tab is it under."
**References.** Notion ⌘P (good coverage, mushy ranking) · Linear ⌘K (actions + entities in one grammar — the model) · Raycast (extensible palette done right).
**Solution.** One ⌘K, three behaviors by input shape: **navigate/act** (verbs and destinations — exists), **search** (Postgres FTS across tasks/docs/clients/projects/goals/invoices/comments, grouped, deep-linking into drawers/pages — live search exists; upgrade to FTS + deep links), **Ask** (natural-language question → §7Q Recall; prefix `?` or fallback when no matches). Recency + type weighting; archived excluded by default with one-key include.
**States & edges.** Empty query → recents + time-aware suggestions ("Plan day") · no results → offer create ("New task 'x'") · portal users get *no* search over non-shared content (RLS enforced).
**Deps/Phase.** FTS migration + deep links → **P1, Phase 4** (with docs, when the corpus gets big). Ask wiring → Phase 6.

---

### 7K. Clients & CRM (pipeline, relationships)

**Problem.** For a solo, "CRM" is not a sales machine — it's *relationship memory* (who, what's live, what's owed, when did we last talk) plus a *lightweight pipeline* (leads → won). Real CRMs (HubSpot) are absurd overkill; spreadsheets rot.
**References.** Moxie/Bonsai CRM (right scope; dated UX) · HoneyBook (inquiry→booking flow; stops at delivery) · Attio (relationship-first elegance; team-priced) · Notion CRM templates (structure homework again).
**Solution.** The Clients hub (two-pane, rebuilt, live) is already the right shape: client detail = header + health dot + stat tiles (billed YTD, outstanding, projects, last touch) + **Next step** card (inline note + "make it a task") + projects/invoices columns + touch-log notes. **Pipeline tab:** 4-stage lead board (exists) — lead → won → "create project" conversion. Complete it with: client detail **Connected** panel (docs, meetings, requests) · quiet reminders surfaced in rituals ("No touch on Meridian in 30 days") · lead source tracking (already a field).
**States & edges.** Client with no project (retainer-less contact — fine) · archive client → projects prompt · duplicate detection on create (name/email) · a lead lost → keep with reason (one select, no post-mortem ceremony).
**Connected.** client ← projects/invoices/portal/docs/meetings/notes — the richest node in the graph; the client page *is* the Connected panel writ large.
**Mobile.** Full read + touch-log + next-step edit (the "walking out of a meeting" moment).
**AI.** *Draft*: client-update email from recent project activity ("Here's where things stand…") — the single most-wanted freelancer draft · *Watch*: stale-touch nudges in weekly review.
**Deps/Phase.** Shipped core → polish + Connected → **P1, Phase 5**. Stale-touch watch → Phase 6.

---

### 7L. Client portal & collaboration

**Problem.** The client is the second seat, but giving clients logins to your work tool exposes the mess and trains them to micromanage. Email is where deliverables and approvals go to die. The portal must be a *curated projection*, not a login.
**References.** Moxie portal (white-label, decent scope) · Basecamp client access ("clientside" — the curation insight) · HoneyBook (clients pay/sign in-flow — the money insight) · Linear Asks (structured request intake).
**Solution.** Token-link portal (0006, live) grows into the client's single URL: **Plan** (portal-visible tasks only — per-task `portal_visible`, default off; a curated plan, never the raw board) · **Milestones** (with approve/request-changes — writes to project activity) · **Docs & deliverables** (shared docs/files; approvals on deliverables) · **Requests** (structured form → your Inbox as triage items → Accept creates the linked task — Linear Asks, reborn for clients) · **Money** (their invoices, payable §7M-N) · comments threaded on shared items only. No client accounts; magic-link token + optional PIN. Preview-as-client stays first-class.
**States & edges.** Token revoke/rotate (one click; archiving a project prompts it) · client forwards the link (PIN option; activity log shows views) · request spam (rate-limit + "portal paused" switch) · approval on a superseded milestone → marked stale.
**Connected.** request→task→project→invoice — the full crossing chain; approvals land in activity; portal views logged quietly ("Client viewed the proposal · 2h ago" — shown once in activity, never as a notification stream).
**Mobile.** The portal itself is mobile-first (clients live on phones); your admin of it is desktop.
**AI.** *Draft*: weekly client-facing progress summary from activity, one click to post to portal (§7K's email draft, structural).
**Deps/Phase.** Requests→task accept flow → **P1, Phase 5**. Approvals + comments → P1/P2, Phase 5. Portal-visible flags → P1, Phase 5.

---

### 7M. Proposals, contracts & paperwork

**Problem.** The engagement's front door — proposal, contract, sign-off — is where freelancers bleed hours and credibility: Word docs, PDF exports, DocuSign fees, retyping scope into the PM tool after acceptance. HoneyBook's core insight: proposal+contract+payment as *one interactive artifact* converts dramatically better.
**References.** HoneyBook (one signable, payable doc — the model; but their delivery PM is absent) · Bonsai (contract library depth; form-wizard UX) · Moxie (proposal→project link exists; clunky) · PandaDoc (e-sign done seriously; separate tool).
**Solution.** Paperwork = **Docs + special blocks** (principle 8 — one document system): a Proposal is a Doc containing **scope blocks** (rendered sections), a **line-items block** (services & prices — same shape as invoice items), an **accept block** (typed-name acceptance + timestamp + IP — "click-wrap" level), optionally a **deposit block** (pay X% now → §7N rails). Shared through the portal. **On accept:** the crossing fires — project created from linked template, line items become the invoice draft (or deposit invoice issues immediately), client notified, activity logged. Contracts v1 = the same accept block on a terms doc (templates provided, clearly labeled not-legal-advice); qualified e-sign (audit-trail PDF) is P2 — integrate before we build.
**States & edges.** Proposal versioning (edits after send create v2; client sees latest, activity keeps history) · expiry date on proposals · declined → lead marked lost with reason · partial acceptance (client asks changes → comment thread on the doc).
**Connected.** proposal → lead/client → project(template) → invoice → payment: the entire engagement chain born from one doc.
**Mobile.** Client side fully mobile; authoring desktop.
**AI.** *Draft*: proposal from a project template + client context ("draft the scope section for a brand-identity engagement") — assisted authoring, your voice, your rates.
**Deps/Phase.** Money blocks + accept flow → **P1, Phase 5** (after Docs Phase 4 lands the editor). E-sign integration → P2.

---

### 7N. Time → money (tracking, invoicing, payments, budgets)

**Problem.** Getting paid is the workflow with the highest stakes and the worst tooling: time lives in Harvest/Toggl, invoices in Bonsai/Wave, payments in Stripe emails, and the freelancer reconciles by hand — or worse, forgets billable hours entirely (the average freelancer under-bills materially).
**References.** Harvest (timer→invoice; separate tool) · Bonsai (invoice depth: reminders, late fees; PM-weak) · Moxie (rate cards) · Stripe invoicing (rails without context) · HoneyBook (in-doc payment).
**Solution.** The loop is **already live** (timer/manual entries with billable flag → unbilled × hourly rate → invoice draft with time-entry-linked line items → sent → record payment → paid; verified end-to-end). Complete it: **(1) Payments rails** — Stripe Connect: invoices get a hosted pay link; webhook records the payment automatically; the portal Money tab uses the same link. This converts "invoice sent" from a PDF into a checkout. **(2) Nudges as designed automation** (§7P): optional auto-reminder schedule per invoice (gentle default: +3 days before due, +1/+7 after), each rendered from a template you approved. **(3) Budgets (P2):** `budget_minutes/amount` per project → the quiet Overview line ("14h of 20h budget"). **(4) Recurring invoices (P2)** for retainers — same recurrence engine as tasks. Tax/accounting: **export, don't build** — CSV/API to accounting tools; we are not a bookkeeping product (§8).
**Flow.** Project Money tab: time split (total/unbilled/billed) + "3.5h unbilled → Create invoice" + this project's invoices. Finance hub: KPIs (unbilled/outstanding/paid-this-month/overdue) + invoice table + payments (all live today).
**States & edges.** Apply 0004 (void status + billable metadata — drafted, pending) · partial payments (exists) · currency: single currency per space v1, multi-currency P2 · overpayment → credit note line · deleting a time entry on a billed line → blocked with explanation · Stripe webhook retry/idempotency.
**Connected.** time ← task/project · invoice ← client/project/proposal · payment ← portal · close-out prompt (§7E) catches unbilled time.
**Mobile.** Timer start/stop + "who owes me" glance; invoicing desktop.
**AI.** *Watch*: "INV-014 is 12 days overdue; Meridian usually pays in 5" — weekly review, not push · *Draft*: invoice cover note.
**Deps/Phase.** Stripe Connect + webhooks → **P0 of Phase 5** (the phase's crossing). Reminders → P1, Phase 6 (needs automation rendering). Budgets/recurring → P2.

---

### 7O. Notifications

**Problem.** Notifications are how calm products become anxious products. But *zero* signal fails too: an overdue invoice or a client request genuinely deserves attention.
**References.** Basecamp (Always On/Work Can Wait schedules) · Linear inbox (aggregation not interruption) · every to-do app's red badge (the anti-pattern).
**Solution.** Three channels, strict diet: **(1) In-app activity** — portal events (request, approval, payment, view) land in the Inbox as quiet items, aggregated, no badge counts anywhere, ever. **(2) Morning digest (opt-in email/push):** one message — due today, overdue, waiting-on older than N days, portal activity overnight. **(3) Time reminders** — the one `remind_at` per task, and invoice nudges *to the client* (§7N). That's the entire notification surface. Everything else waits for a ritual.
**States & edges.** Quiet hours by default (digest at your chosen morning time) · vacation mode silences all · unsubscribes honored instantly.
**Deps/Phase.** Digest worker → **P1, Phase 6**. Portal events → Phase 5.

---

### 7P. Automations — designed behaviors, not a builder

**Problem.** Automation builders (Zapier-in-app, Asana rules, Notion buttons) hand users a programming job and create haunted houses — rules someone wrote in March firing mysteriously in November. Yet repetitive glue work is real and worth killing.
**References.** Asana rules / ClickUp automations (power, haunted houses) · Linear (opinionated built-ins: auto-archive, auto-close — the model) · IFTTT (the graveyard of user programming).
**Solution.** Zenboard ships **named, designed behaviors** — each one built, documented, toggleable, with visible provenance ("created by: Recurrence"): recurrence spawning · request→task accept · proposal-accept→project+invoice · close-out unbilled prompt · invoice reminder schedule · timebox twin-sync · overdue re-ask at morning plan · goal rollup at review. Every behavior states what it did in the object's activity line. **No user-defined triggers, no rule builder** — when a real pattern emerges from support, we *design* the behavior and ship it to everyone.
**Deps/Phase.** Each behavior ships with its home feature; the *doctrine* is Phase 1 (documentation page: "What Zenboard does automatically").

---

### 7Q. AI & agents — the clerk doctrine

**Problem.** Every competitor bolted on a chat panel; the result is AI that adds a *surface* instead of removing *work*. Meanwhile the true costs surfaced in 2026: Notion's metered credits created bill anxiety; Asana shipped 21 prebuilt "teammates" as bloat theater; Linear alone got it right — AI as suggestions inside existing workflows, earning autonomy gradually.
**References.** Linear Triage/Product Intelligence (suggestion-first, learns from your history, auto-apply only after demonstrated confidence — the gold standard) · Notion 3.3 custom agents (scoped permissions + triggers = right architecture; credit pricing = trust burned) · Asana AI Studio (no-code agent zoo).
**Solution.** **Five named capabilities, embedded where work happens — no chat tab in v1:**
1. **Parse** — NL capture → confirmed chips (dates, project, labels, estimate, recurrence). Ships with §7A.
2. **File** — triage/inbox suggestions (project, date, label, "similar task exists") learned from *your* filing history. One tap to accept; off by default; never auto-applies.
3. **Draft** — pre-written starting points at defined moments: shutdown summary · weekly review · client update · proposal scope · invoice cover note · close-out retro. Always editable, clearly marked, in your saved voice/tone.
4. **Recall (Ask)** — `?` in ⌘K: questions answered over the graph with citations ("What's unbilled for Acme?" → $350, linking the 3 entries; "When did we agree the deadline moved?" → the doc + comment). Grounded in Connected edges (§3.4), not vibes.
5. **Watch** — quiet pattern flags surfaced *only inside rituals and digests*: overdue invoice vs client's payment habit · stale waiting-on · goal drift · capacity overload. Never a push notification.

**Pricing doctrine:** flat, included, capped-fair — no credits, no meters, no anxiety. **Autonomy doctrine:** Zenboard AI never creates, schedules, sends, or files anything without a tap. Phase 7 may add **scoped routines** (Notion 3.3's architecture, Linear's confidence gating): e.g. "every Friday, draft the client updates for active projects" — trigger + scope + always-draft-never-send, each routine a designed template, not a free-form agent builder.
**Deps/Phase.** Parse → Phase 2 (rule-based first; LLM assist later). File/Draft/Recall/Watch → **Phase 6**. Routines → Phase 7.

---

### 7R. Reporting & analytics — the review, not the dashboard

**Problem.** Solo users don't need to be told how fast they are (velocity theater), but they genuinely can't answer "how is the business doing?" — revenue concentration, unbilled leakage, time-vs-price truth per client.
**References.** Linear Insights (velocity theater — refuse) · Bonsai reports (accountant-shaped) · Basecamp's "reports are questions" stance.
**Solution.** **Reviews are documents, not dashboards.** The **Monthly review** generates a Doc: earned · outstanding · unbilled leakage · time by client · effective hourly rate per project (fixed-fee truth serum) · goals moved · one AI-drafted narrative paragraph you edit. It's yours to keep, annotate, and compare — a business journal, not a chart wall. Weekly review keeps its lighter glance. The Finance hub keeps its 4 live KPIs; nothing else gets a chart.
**Deps/Phase.** Monthly review doc → **P1, Phase 6** (needs Docs + money data mature). Effective-rate math → same.

---

### 7S. Integrations

**Problem.** "Super app" fails if it means "walled garden." The test: integrate where the world is the system of record; replace where fragmentation is the disease.
**Solution — deliberately short list:**
| Integration | Why | Phase |
|---|---|---|
| Google Calendar 2-way | Time's system of record (wiring exists — finish OAuth) | 3 |
| Stripe Connect | Payment rails (§7N) | 5 |
| **Importers**: Todoist/Things CSV, Notion export, Trello | Switching cost is the real competitor | 2→5 |
| Email-in capture address | Inbox from anywhere | 6 |
| ICS feed out (read-only) | Your plan in any calendar app | 3 |
| Accounting export (CSV; QuickBooks/Xero later) | We don't do bookkeeping | 5 |
| Zapier/webhook out (P2) | Long-tail escape valve without building a directory | 7 |
Refuse: an integrations *marketplace*, Slack-style app directory, 80-connector checklists.

---

### 7T. Mobile & desktop

**Problem.** Porting the whole desktop app to mobile produces a bad clone of both. Each context has jobs.
**Solution.** **Job split:** Mobile (iOS SwiftUI app — Milestone 1 built, needs verification; responsive web already <820px) = capture · Today check-off · rituals (shutdown/morning are phone moments) · timer · client glance · portal (client side is mobile-*first*). Desktop = planning, docs authoring, money, templates, structure. **Rules:** offline capture queues locally and syncs (mobile P1) · widgets/share-sheet (iOS P1) · nothing ships on mobile that isn't excellent there.
**Deps/Phase.** Web responsive is table stakes now (Phase 1 QA pass). iOS: verify M1 → capture/Today/rituals → Phase 3–5 alongside web.

---

### 7U. Onboarding

**Problem.** Empty-workspace-with-a-template-gallery (Notion) outsources product design to minute one; 14-step tours teach nothing. Activation = reaching the first *crossing* (§1.2) fast.
**References.** Things (opinionated empty states teach the model) · Sunsama (onboarding *is* the first ritual — the insight to steal) · Linear (sample data done tastefully).
**Solution.** First run = **the first planning ritual**: three questions (what do you do → seeds glossary/rate; what's live right now → creates 1 project + 3 real tasks; when does your day end → shutdown time). Land on Home with *their* plan already real. Teach exactly three keys in context (⌘K · ⏎ · e), nothing else. Empty states carry the curriculum thereafter (each hub's empty state explains the concept in one sentence + one action, ≤180px per the constitution). Importers offered on the Tasks empty state, not the first run. **Aha targets:** first capture <60s · first completed plan day 1 · first portal share week 1 · first invoice week 2.
**Deps/Phase.** Rebuild `/onboarding` as ritual → **P0, Phase 2**.

---

### 7V. Home — the command center

**Problem.** Home either becomes a dashboard (widgets nobody reads) or a duplicate task list. Its actual job: answer "what does today look like, and what deserves attention?" in five seconds, then get out of the way.
**Solution.** Home = **Today, staged by time of day.** Morning (no ritual done): greeting + "Plan your day" + yesterday's leftovers count. Day: the plan — highlight ★ first, timeboxed items with times, capacity line, quiet Watch line if something's flagged (one line, dismissible). Evening: "Shutdown" affordance + done-count. Right rail (desktop): today's calendar column + habit dots. **Not on Home:** stats, charts, feeds, recently-visited grids. Home is the ritual's landing page and the day's mirror — nothing else.
**Deps/Phase.** Staged states + capacity + Watch line → **P0–P1, Phase 3** (with rituals).

---

### 7W. Workspaces (Spaces)

**Problem.** One person, multiple contexts (client work / personal / a second venture). Full workspace separation (Notion) fragments search and defeats the one-graph promise; no separation pollutes Today with everything.
**Solution.** **Spaces** (exist: switcher + default space) = hard contexts: separate clients, projects, finance; Today/rituals/⌘K operate *within* the active space; Calendar can overlay both (time is shared). Personal space hides business hubs (no Clients/Finance noise for groceries). Cross-space linking: refuse — if it needs linking, it's one space. Phase 7's "second chair" would be a per-space grant, keeping the model clean.
**Deps/Phase.** Shipped; polish (per-space hub visibility, onboarding default) → P1, Phase 2.

---

## 8. The never list (expanded)

Positioning statements, not gaps. Each conflict this plan resolves in favor of the never list:

1. **No multi-user workspaces, assignees, or seats** (Phase 7 may add one scoped "second chair" — never an org).
2. **No custom statuses, workflows, or task custom fields.** Four statuses; structure lives in Lists.
3. **No automation builder.** Designed behaviors only (§7P).
4. **No velocity, workload, or productivity analytics.** Reviews are documents (§7R).
5. **No auto-scheduling AI.** The human places work; AI makes placing effortless (§7Q).
6. **No red badges, streak fires, karma, or gamification.**
7. **No chat.** The portal has threaded comments on shared items; Zenboard is not a messenger.
8. **No formula language, rollup engine, or database relations web.**
9. **No integrations marketplace.** A short, owned list (§7S).
10. **No bookkeeping/tax engine.** Export to the accountant's tools.
11. **No metered AI credits.**
12. **No template economy/gallery as onboarding.**

---

## 9. Roadmap

Phases are dependency-ordered: each unlocks the next layer's crossings. Within phases, waves are schema-gated (migrations listed). Timeboxes are indicative, not promises.

### Phase 1 — Foundation *(the app becomes one product · ~3–4 wks)*
> Goal: zero inconsistencies; the graph's fabric in place; design system singular.
- IA/naming alignment (§6): nav groups, labels, `/library`→Docs redirect plan, milestone→steps rename, Week folds away.
- Design-system consolidation completes (single component layer; kibo deleted; primitives migrated).
- Project workspace 8→5 tabs (stubs removed or made honest).
- Automations doctrine page; export (Markdown/CSV) for tasks+projects (principle 11 floor).
- Responsive QA pass. Migrations: none required (renames are label-level).

### Phase 2 — Core Productivity *(cancel Todoist/Things · ~4–6 wks)*
> Goal: the best solo task manager, full stop.
- **Wave 1 (no migration):** unified NL parser + chips · Inbox triage mode · recurrence contract hardened + tested · keyboard grammar everywhere · onboarding-as-ritual (§7U).
- **Wave 2 (migrations):** apply 0015 `saved_views` · labels UI + filters everywhere (tables exist) · Spaces polish.
- Importers: Todoist/Things CSV.

### Phase 3 — Planning & Execution *(cancel Sunsama/Akiflow; replace light Asana/Linear · ~6–8 wks)*
> Goal: the day and the project both feel governed.
- Shutdown→tomorrow picker · capacity line · Home staged states (§7V) · habits row in morning ritual.
- Calendar: finish gcal OAuth + verify sync · ICS out · **0017 timebox twin** + drag-to-calendar.
- Projects: sections UI · **0020 milestones repoint** · templates · close-out moment · health line.
- Goals rollup at review time · weekly review v2 (someday resurfacing, goal glance).
- **0018 reminders** + push worker. iOS: verify M1, ship capture/Today/rituals.

### Phase 4 — Knowledge & Collaboration *(cancel Notion, solo use · ~8–10 wks)*
> Goal: prose and structure join the graph.
- Docs M1–M10 block editor · entity mentions + **0019 `mentions`** + Connected panel everywhere · doc templates · library content migration, route deleted.
- **0016 attachments** + storage · files on tasks/docs/projects.
- Lists UI (views, doc embeds) · meeting-note from calendar event.
- Search v2: Postgres FTS + deep links (§7J).

### Phase 5 — Business & Client Management *(cancel Moxie/Bonsai/HoneyBook · ~8–10 wks)*
> Goal: the engagement lifecycle end-to-end; money moves.
- **Stripe Connect** + hosted pay links + webhooks (apply 0004 first).
- Portal v2: requests→task accept · portal_visible plans · approvals · comments · money tab.
- Proposals: money blocks + accept flow → project-from-template + invoice (§7M).
- Clients polish: Connected panel · conversion flows. Accounting CSV export. Notion importer.

### Phase 6 — Automation & AI *(the clerk arrives · ~6–8 wks)*
> Goal: manual glue disappears; nothing surprises anyone.
- File (triage suggestions) · Draft (six defined moments) · Recall/Ask in ⌘K · Watch (rituals + digest only).
- Morning digest worker · invoice reminder schedules · email-in capture.
- Monthly review doc (§7R).

### Phase 7 — Advanced Intelligence *(the horizon · ongoing)*
> Explored only if 1–6 earn it, in this order:
- Scoped routines (trigger + scope + draft-only, flat-priced) · deeper Recall (cross-doc synthesis).
- The second chair (one scoped collaborator seat per space).
- Webhooks/Zapier out · QuickBooks/Xero · qualified e-sign · budgets/recurring invoices/multi-currency · read-only mini-gantt.

### Migration ledger (the skeleton in one place)
`0004` money metadata (drafted→apply, Ph5) · `0015` saved_views (drafted→apply, Ph2) · `0016` attachments (Ph4) · `0017` task↔event (Ph3) · `0018` remind_at (Ph3) · `0019` mentions (Ph4) · `0020` milestones repoint + task_links (Ph3/5) · `0021` project_templates (Ph3) · `0022` proposals/accept metadata (Ph5) · `0023` stripe/webhook bookkeeping (Ph5).

---

## 10. How we know it's working

**The cancelled-subscription test** — each phase ends when a real user can truthfully cancel the corresponding tool:

| After phase | Canceled | The proving flow |
|---|---|---|
| 2 | Todoist / Things / TickTick | capture→triage→plan→recur→filter, 7 straight days |
| 3 | Sunsama / Akiflow (+ light Linear/Asana) | ritual streak feels *wanted*; a project runs template→close-out |
| 4 | Notion (solo) | a week's notes, briefs & lists live in Docs; search finds everything |
| 5 | Moxie / Bonsai / HoneyBook (+ Harvest) | proposal→accept→project→time→invoice→paid, one client, zero retyping |
| 6 | (no tool — the glue itself) | the six drafts get used; digest replaces morning tab-sweep |

**Calm metrics (the only analytics we keep on ourselves):** time-to-captured-thought (<3s) · % days with a completed plan · inbox-zero frequency · unbilled leakage trend (should fall) · notification sends per user per day (target ≈1) · features *removed* per quarter.

**The one-sentence check** before shipping anything, from the constitution: *does this make Zenboard feel more like one calm system built by one obsessive team — or like another tool bolted on?*

---

## Appendix — research sources

- **Linear:** [Introducing Linear Agent](https://linear.app/changelog/2026-03-24-introducing-linear-agent) · [How we built Triage Intelligence](https://linear.app/now/how-we-built-triage-intelligence) · [Product Intelligence preview](https://linear.app/changelog/2025-08-14-product-intelligence-technology-preview) · [Auto-apply triage suggestions](https://linear.app/changelog/2025-09-19-auto-apply-triage-suggestions) · [Linear Intake](https://linear.app/intake) · [AI workflows](https://linear.app/ai)
- **Notion:** [Notion 3.3 Custom Agents release](https://www.notion.com/releases/2026-02-24) · [Custom Agents help](https://www.notion.com/help/custom-agents) · [Custom agents tutorial & pricing analysis (Matthias Frank)](https://matthiasfrank.de/en/notion-custom-agents-full-tutorial-use-cases-pricing-changes/) · [Notion AI review (eesel)](https://www.eesel.ai/blog/notion-ai-review)
- **Asana:** [Winter 2026 release](https://asana.com/inside-asana/winter-release-2026) · [AI Teammates overview](https://asana.com/resources/ai-teammates-overview) · [AI Teammates product](https://asana.com/product/ai/ai-teammates)
- **Personal task managers:** [Todoist vs Things vs TickTick (Rivva)](https://blog.rivva.app/p/todoist-vs-things-vs-ticktick) · [5 to-do apps ranked 2026 (Unstar)](https://unstar.app/blog/todoist-ticktick-things-3-microsoft-todo-apple-reminders-todo-apps-ranked-2026) · [Best task apps 2026 (ToolRadar)](https://toolradar.com/guides/best-task-management-apps)
- **Basecamp:** [Hill Charts](https://basecamp.com/hill-charts) · [Basecamp review 2026 (Tool Directory)](https://tooldirectory.ai/tools/basecamp) · [Minimalist PM review (Nova)](https://www.novamediagroup.com/blog/basecamp-minimalist-project-management-review)
- **Daily planners:** [Sunsama vs Akiflow (Morgen)](https://www.morgen.so/blog-posts/sunsama-vs-akiflow) · [Akiflow vs Sunsama (Toolfinder)](https://toolfinder.com/comparisons/akiflow-vs-sunsama) · [Akiflow vs Sunsama (Dhruvir Zala)](https://dhruvirzala.com/akiflow-vs-sunsama/) · [Sunsama vs Akiflow (Ellie)](https://ellieplanner.com/comparisons/sunsama-vs-akiflow)
- **Freelancer suites:** [Moxie vs Bonsai (Moxie)](https://www.withmoxie.com/moxie-vs/bonsai) · [Moxie vs HoneyBook (Plutio)](https://www.plutio.com/compare/moxie-vs-honeybook) · [HoneyBook vs Moxie (HoneyBook)](https://www.honeybook.com/blog/honeybook-vs-moxie) · [Bonsai alternatives (FileCurrent)](https://www.filecurrent.com/blog/hello-bonsai-alternatives)
- **Consolidation trend:** [Solopreneur tools 2026 (Toolfinder)](https://toolfinder.com/best/productivity-tools-for-solopreneurs) · [All-in-one tools for solopreneurs (Coherence)](https://getcoherence.io/blog/best-all-in-one-tools-solopreneurs)




