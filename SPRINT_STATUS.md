# Sprint status — what is actually built

**Measured 2026-08-03**, against the code and against a live schema probe. Not against
`PROGRESS.md` and not against `MASTER_PRODUCT_PLAN.md`'s own claims — both of those have
now been caught asserting things the database contradicts.

**Method.** Route inventory from `app/`; feature state from reading the modules; schema
state from `GET /rest/v1/<table>?select=<col>&limit=0` per marker column, each paired
with a must-fail control so a `42703` means "missing" and not "the probe is broken".

---

## Part 1 — Corrections that changed planning

### 1.1 Migration 0028 — **APPLIED, verified 2026-08-03**

Was the headline correction of this document: 0028 had been claimed as live by both
`PROGRESS.md` and the master plan while the database said otherwise. **It is now genuinely
applied**, along with **0030** and **0031**, all verified by probe rather than taken on trust:

| marker column | result |
|---|---|
| `pages.database_id` · `pages.properties` · `pages.row_order` · `collection_rows.page_id` | all **present** (HTTP 200) |
| `tasks.event_id` · `calendar_events.task_id` (0030) | both **present** |
| `tasks.remind_at` · `tasks.reminded_at` (0031) | both **present** |
| control `pages.zz_must_fail` | **42703** — so a 200 means the column exists, not that the probe is broken |

**0028's backfill is intact**, which mattered because its `round(sort_index)::int` overflow
would have failed mid-run:

- 39 / 39 legacy `collection_rows` carry a `page_id` — no partial run, no orphans.
- 0 migrated rows have a null `row_order`.
- Manual ordering survived exactly: in every database, ascending `sort_index` maps onto
  ascending `row_order` (keys are per-collection and gap-spaced — 0x3e8, 0x7d0, 0xbb8 …).
- Bodies moved out of `data.__content` into `pages.content`, and `properties` carried.
- The backfill wrote `NULL` where legacy rows held `''` for a title; `toRow` already
  normalizes with `p.title ?? ''`, so nothing downstream sees the difference.

**Both gates are now live for the first time.** `rowsArePagesSupported()` is memoized for
the life of the server process, so a dev server started before the migration keeps serving
the legacy path until it is restarted — that is the one operational gotcha.

`types/database.ts` remains hand-authored, so it still describes intent rather than
reality. The capability probes, not the types, are what make that safe.

### 1.2 The plan's migration ledger was fiction from 0016 onward — **fixed 2026-08-03**

§9's ledger reserved numbers that other features then used. Actual vs claimed:

| # | ledger says | the file actually is |
|---|---|---|
| 0016 | attachments | `feedback` |
| 0017 | task↔event | `portal_requests_lifecycle` |
| 0018 | remind_at | `portal_invoices` |
| 0019 | mentions | `portal_approvals` (mentions shipped as **0027**) |
| 0020 | milestones repoint + task_links | `forms` |
| 0021 | project_templates | `notifications_realtime` |
| 0022 | proposals/accept | `form_uploads` |
| 0023 | stripe/webhook bookkeeping | `forms_f3_backfill` |

So every "gated on migration 00XX" line in the roadmap pointed at the wrong file. The
*work* is still unbuilt — probing for the tables confirms it — but the numbers have now
been reassigned, in `MASTER_PRODUCT_PLAN.md` §3.3 and §9 and at every inline reference:

| # | what | phase |
|---|---|---|
| `0029` | `memories` (§7X) | 4 |
| ~~`0030`~~ | ~~`task_events` — task ↔ calendar twin~~ | **applied 2026-08-03** |
| ~~`0031`~~ | ~~`reminders` — `remind_at` + `reminded_at`~~ | **applied 2026-08-03** |
| ~~`0032`~~ | ~~`task_links` (`blocked_by`)~~ | **applied 2026-08-04** |
| `0036` | milestones on projects + `due_date` | 3 — **written**, awaiting paste |
| ~~`0033`~~ | ~~`attachments` + storage bucket~~ | **applied 2026-08-03** |
| ~~`0034`~~ | ~~`acceptances` (NOT `proposals` — see below)~~ | **applied + probed 2026-08-04** |
| ~~`0035`~~ | ~~`acceptances.invoice_id` — the accept crossing (§7M)~~ | **applied + probed 2026-08-04** |
| `0036` | stripe/webhook bookkeeping | 5 — on hold |

Numbers are assigned in reservation order, not phase order; the only rules are uniqueness
and ascending application. `project_templates` left the ledger entirely — templates
shipped in Phase 3 as code over existing tables and need no migration.

`task_events` shipped as **0030** and reminders as **0031** — both as columns on existing
tables rather than new tables, which is why neither appears in a table list. **0028, 0030,
0031, 0032, 0033, 0034 and 0035 are all applied and verified by live probe.** No `proposals` or
`contracts` table exists or will: §7M's paperwork is Docs + blocks, and 0034 stores the one
thing that genuinely needed a table — the signature.

0034's guarantees were probed rather than assumed, each against a control: a second insert
on the same `(page_id, block_id)` returns **23505** (which is what makes accepting
idempotent), editing `signer_name` raises **P0001 "An acceptance cannot be edited after it
is signed."**, editing a NON-signature column still returns 204 (so the trigger is precise,
not a blanket UPDATE ban), and DELETE works — the owner can withdraw, never rewrite.

---

## Part 2 — Phase status

### Phase 1 — Foundation · **DONE**

| unit | state |
|---|---|
| IA/naming, DS consolidation, project tabs, responsive pass | done (earlier sessions) |
| #2 type-conversion confirm modal | **done** 2026-08-01 |
| #1 repoint database readers to `pages where database_id` | **DONE** 2026-08-03 — 0028 applied and the backfill verified (§1.1) |
| #4 @-mention write path | **done** 2026-08-03 — see Part 3 |
| #3 merge the two property systems | **done** 2026-08-03 — see Part 3 |

### Phase 1 is **COMPLETE** as of 2026-08-03.

All four units are built and 0028 is applied and verified. This was the oldest open
structural item in the product.

### Phase 2 — Core Productivity · **~75%**

Built: NL parser + chips, Inbox triage (now folded into the Tasks rail), recurrence,
keyboard grammar, labels, saved views (0015 applied), Spaces.
~~Missing: Todoist/Things CSV importers~~ — **wrong, corrected 2026-08-03: they are built.**
`lib/import-tasks.ts` (RFC-4180 reader + Todoist / TickTick / generic header-mapped
parsers, 132 lines of tests), `importTasks()` in `lib/actions/tasks.ts`, and an Import pane
in Settings with a parsed preview before the write. Still missing: onboarding-as-ritual is
partial.

### Phase 3 — Planning & Execution · **~60%**

Built: rituals, staged Home, shutdown, capacity, project sections, templates, close-out,
health line, goal rollup, weekly review v2, habits v2.
Missing:
- ~~**timebox twin** (`task_events`)~~ — **built 2026-08-03, gated on 0030.** See Part 3.
  The drag-to-calendar rail is a separate, unbuilt unit.
- ~~**reminders** (`remind_at`, **0031**)~~ — **built 2026-08-03, gated.** In-app delivery
  (toast + bell) is live and correct; the push/email worker is a later sprint and reuses
  the same claim, so it needs no schema change. See Part 4 item 6.
- Google Calendar: **audited + hardened 2026-08-04** (was 194 lines, zero tests → 20 tests).
  Fixed: multi-day all-day events collapsed to one day in BOTH directions, and a revoked
  grant lingered forever (found live — the stored refresh token answers `invalid_grant`).
  Still owed: one consent click in Settings → Connections; only the account owner can do it. ~~ICS-out absent~~ — **the
  subscribable feed shipped 2026-08-04**, no migration (token in `profiles.preferences`):
  `/api/feed/<token>/calendar.ics` merges calendar events with scheduled tasks, skipping
  timebox twins so nothing appears twice. A download already existed; a download is not a
  feed, and that difference was the whole feature.
- iOS Milestone 1 built but unverified (no Xcode on this machine).

### Phase 4 — Knowledge & Collaboration · **~50%**

Built: block editor through M10, version history, outline, covers/icons, comments,
databases with 7 view kinds, filter groups with nesting, search v2 over doc bodies,
interactive breadcrumbs (2026-08-02), **and now the mention write path**.
Missing:
- ~~**`attachments` / files** — no table, no storage wiring~~ — **spine built 2026-08-03,
  gated on 0033.** Table + private bucket + upload/sign/delete actions + Upload on the
  document file/pdf blocks. Owner is a real FK (`page_id`/`task_id`/`project_id`, exactly
  one) so a deleted parent reclaims its files — verified by probe: no owner and two owners
  are both rejected with 23514, exactly one is accepted. **0033 is applied.** Shipped
  surfaces: document file/pdf blocks, a **Files tab on projects** via the one
  owner-agnostic `<AttachmentsPanel>`, and **image blocks (picked AND pasted) now upload to
  storage** instead of base64-ing into `pages.content` — `b.src` still renders anything
  stored inline before this, so nothing needed migrating. **The task drawer's Files section
  landed 2026-08-04** — the same `<AttachmentsPanel>`, never a second copy, between Subtasks
  and Connected. **Covers moved off data-URLs the same day** (`attachment:<uuid>`, no
  migration, legacy inline covers still render). ICONS DELIBERATELY DID NOT: 180px in their
  own column and drawn dozens-at-a-time in the rail, so a signed URL per row would cost more
  than the ~10 KB it saves. §7H is closed.
- **Blocks as addressable rows** — `pages.content` is still one JSONB blob. The plan
  calls this "the largest remaining structural debt in the product"; it blocks block
  comments, block links and synced blocks. Untouched.
- ~~`/library` still exists as a separate route~~ — **wrong, corrected 2026-08-03: the
  merge is done.** `app/(app)/library/page.tsx` is a 22-line redirect that preserves the
  query string, so an old `/library?page=<id>` bookmark still opens that document. Keeping
  the shim is correct; there is nothing left to merge.

### Phase 5 — Business & Client Management · **~55%**

Built: clients, pipeline, feedback loop, portal (magic-link, requests→task lifecycle,
approvals, invoices tab), forms F1–F4, invoices, time entries.
Missing:
- **Stripe** — deliberately on hold (no Stripe in India; Razorpay under consideration).
  Schema dormant, `0004` metadata unapplied.
- **Proposals and contracts** — §7M says paperwork is **Docs + special blocks**, so there
  is no `proposals` table to build: the artifact is a Doc. That splits into three sprints.
  **(1) the line-items block — BUILT 2026-08-03, no migration** (`lib/line-items.ts` +
  `components/documents/line-items-block.tsx`; field names match `invoice_items` because
  the accept crossing turns these rows into the invoice draft).
  **(2) the accept block + the acceptance record — BUILT 2026-08-03, gated on `0034`.**
  The ledger said 0034 was `proposals`/`contracts`; it is neither. A proposal is a Doc, so
  the only thing needing storage is the SIGNATURE — `acceptances`, one row per signed
  accept block. It cannot live in the block payload: `pages.content` is rewritten by the
  owner's autosave, so a signature stored there is a field the party who benefits from it
  can edit and an autosave race can erase. Files: `lib/acceptance.ts` (terms, name
  validation, `canonicalizeForSignature`), `lib/actions/acceptance.ts` (owner read +
  token-scoped public write), `components/documents/accept-block.tsx`,
  `supabase/migrations/0034_acceptances.sql`. The portal projects the two paperwork blocks
  structurally (`PortalDoc.items` / `.accepts`) rather than flattening them into text.
  **(3) the crossing — BUILT + LIVE 2026-08-04 (`0035` applied).** Accept drafts an invoice on the
  project from the accepted line items, logs `accepted` + `invoiced` activity, and names the
  invoice in the owner's notification. A DRAFT, not a sent invoice: zero retyping is the
  win, but dates and deposit splits are the owner's call. `0035` is one column
  (`acceptances.invoice_id`) and exists for idempotency — the signature is already
  unique-indexed, but a signature that lands while the invoice insert fails needs a retry
  that cannot double-invoice. §7M's "project created from linked template" does NOT apply
  here: a proposal is shared through a project's portal, so the project already exists by
  the time anyone can sign. That step needs proposal-to-a-lead, which is its own sprint.
- ~~Accounting CSV export~~ — **built 2026-08-03** (§7N): `/api/export/finance` serves
  three sheets (invoices · line items · payments) with derived totals and spreadsheet-safe
  decimals, offered as a Finance row in Settings → Export.
- ~~Notion importer~~ — **built 2026-08-03** (§7S): `lib/import-docs.ts` parses a Notion
  Markdown export (hash-suffixed filenames, the duplicate H1, the `Name: value` property
  block) and reuses `textToBlocks` for the body; `importDocs` writes them unfiled.

### Phase 6 — Automation & AI · **~5%**

An automations doctrine page exists. The clerk itself — File / Draft / Recall / Watch,
morning digest, invoice reminders, email-in — is unbuilt. Note §v2.2 reversed the
no-AI rule, so this is now in scope rather than excluded.

### Phase 7 — Advanced Intelligence · **0%**, correctly.

---

## Part 3 — Shipped this session

**@-mention write path (Phase 1 unit #4).** 0027 shipped the `mentions` table and
`lib/connected.ts` has read it ever since; nothing wrote a row, so every backlink
section in the app rendered an empty list against a table that could never fill.

The design decision worth recording: **a mention is an internal link.** Zenboard already
has one canonical address per record (`recordHref`), so a span whose href resolves to a
record *is* a reference to it. That meant no new inline node type, no ProseMirror schema
change, and no migration — and it means links already sitting in documents become real
edges the next time those documents save.

- `parseRecordHref` — the inverse of `recordHref`, kept beside it so the pair cannot
  drift (a route changed in one and not the other would silently stop producing
  backlinks: no error, no symptom).
- `lib/mentions.ts` — extract + diff. A save writes only what changed; editing the
  sentence around a link deliberately does not count as a change, or every keystroke
  would rewrite the row.
- `lib/actions/mentions.ts` — reconcile, gated on `mentionsSupported`, best-effort. A
  missing backlink is a nuisance; a document that will not save is not.
- Deleting a doc forgets what it pointed at, and keeps what pointed at it — §7H wants a
  deleted target to leave a **tombstone**, not a list that silently shrinks.

22 new tests (376 total), tsc and lint clean.

**The `@` typeahead — unit #4 is now closed.** A mention no longer requires having the
record's URL on the clipboard.

The decision worth recording is not the picker, it is what it forced: **record search is
now one function.** The ⌘K palette already had "find things by name" written out longhand;
a second copy inside the editor is how a new entity type ends up findable in one place and
invisible in the other. `searchRecords` (lib/search.ts) is the one projection and both
callers use it. Presentation stays at each call site.

- `lib/editor-trigger.ts` — one trigger rule for `/` AND `@`. Word-anchored, so
  `sarah@example.com` and `and/or` stay out of both menus with no special case. `@` allows
  spaces, capped at 32; only the last occurrence counts, so typing an address inside an
  open query closes the menu rather than re-targeting an older `@`.
- `insertMention` sits in `lib/mentions.ts` beside the reader, with a round-trip test:
  what the picker writes is what `mentionsInBlocks` reads back as an edge.
- The panel anchors to the **caret**, portalled and fixed — an absolute popover is clipped
  by the first scrolling ancestor and every host of this editor scrolls. Flips above near
  the bottom, follows scroll, dismisses when its caret leaves the viewport.
- Deliberate differences from Notion: a mention is a normal linked span, not an atomic
  chip (survives export, paste and ⌘F; needed no PM schema change), and the picker matches
  names only — it writes the name into your sentence, so matching bodies would make the
  inserted text unpredictable. Body search stays in ⌘K.
- Enter with no results is **not** swallowed. A name may simply not exist yet, and a menu
  that eats your Enter until you notice is a trap.

404 tests (+28), tsc clean, zero new lint findings. Browser-verified at
`/dev-preview/editor` (trigger, caret anchoring, flip at a 300px viewport, scroll-follow,
every dismissal rule) and `/dev-preview/mention` (the panel's four states, measured against
the DS: 36px rows, #262626, 12/8px radii, 14/12px type).

**Owed:** the populated list can't be browser-verified — the dev-preview harnesses have no
session, so RLS returns nothing and the live editor reaches only the empty state. Ranking,
insertion and the round-trip are covered by unit tests instead.

### The timebox twin (Phase 3 · migration 0030, gated)

§7D's contract: *"a timeboxed task is one object with two projections — completing either
side completes both; moving the event moves the task's scheduled time; deleting the event
un-timeboxes (never deletes) the task."*

**The decision: the event has no `done` column.** A completion flag on `calendar_events`
kept in step with the task's would be two mirrors of one fact, and two mirrors eventually
disagree. Instead a twin block renders the TASK's `done` and its checkbox calls the same
`toggleTask` a list row calls — so "completing either side completes both" is not a sync
rule that could drift; there is one flag with two views, and no reconciliation code to get
wrong.

- `0030` links `tasks.event_id` ⇄ `calendar_events.task_id`, both `ON DELETE SET NULL` —
  §7D's "never deletes the task" in the schema rather than trusted to the app — with two
  partial unique indexes making the 1:1 real.
- `lib/timebox.ts` holds the rules, pure. `timeboxDay` is the seam where an absolute
  instant becomes a calendar `scheduled_date`; it goes through `isoDateIn`, never
  `toISOString().slice(0,10)`, which would schedule an evening block in Kolkata for the
  day before. Default block 30 min, deliberately not an hour — an hour-shaped default
  makes five small tasks look like a full day and the capacity line then lies.
- **Twins never reach Google.** A timebox is private planning; pushing "Write the brief ·
  30m" to a shared work calendar broadcasts your to-do list to colleagues.
- `timeboxTask` is idempotent (an already-timeboxed task gets its block *moved*) and
  orders its writes so the only reachable failure is a plain calendar event, never a task
  pointing at a row that was never created. `untimeboxTask` keeps `scheduled_date` —
  removing a block retracts the time, not the day.
- The calendar's hardcoded two-step column fallback became a loop over the optional
  columns (`color`, `task_id`); it could not have survived a second one.

**Gated:** `taskEventsSupported()` probes the COLUMN, not the table — both tables already
exist, so a table probe would report the feature available on an unmigrated database.

438 tests (+13), tsc clean, no new lint findings. Browser-verified at
`/dev-preview/calendar` with staged twins in both states: correct ARIA and `aria-checked`,
the done block `line-through` at 0.6 opacity, and clicking the checkbox flips the state
without opening the event composer.

**This was two sprints; the first is done.** §7D's flow is "drag a task from the rail onto
a slot", but the calendar has no task rail — building one (docked list, drag-to-slot,
keyboard equivalent) is its own sprint, listed in Part 4. What shipped is the twin plus one
creation path: a Timebox chip in the task drawer.

### The property systems are one vocabulary (Phase 1 unit #3)

The decision: they stay two **shapes**, and become one **vocabulary**. A single `Property`
type would be wrong — a page has one value per property, so definition and value live
together; a database property is a column whose values live on the rows. That difference is
real. Two type lists, two option models, two icon maps and three copies of "is this type
computed" were not.

`lib/properties.ts` is the vocabulary, deliberately pure (no icons, no React) so it stays
server-importable; `components/documents/property-icons.ts` holds the glyphs as
`Record<PropType, IconType>`, so a new type without a glyph is a type error.

What one union exposed, none of it previously written down anywhere:

- `updated_time` (database) and `last_edited_time` (page) were the same concept spelled
  two ways. Canonical is Notion's `last_edited_time`.
- Options were `{ label }` on a page and `{ name }` in a database. Canonical is `name`.
- **Four** copies of the nine-colour palette. `prop-convert`'s was eight long and in a
  different order, so options a text→select conversion *invented* were coloured from a
  different sequence than ones you added by hand — in the same column.
- Icons disagreed for text, multi-select, status and email; and the page registry gave
  `created_time` and `last_edited_time` the *same* clock, so its own Advanced list had two
  indistinguishable rows.
- `prop-convert`'s computed list omitted every page-only computed type, so converting to
  one wasn't treated as discarding data.

Types and options live in JSON, so retiring a spelling needs a read-time migration, not a
union edit: `normalizePropType` / `normalizeOption` / `normalizeProps` run at every read
boundary and the next save writes the canonical form back — each page and collection
migrates itself once, the `liftText` pattern from lib/blocks.ts.

425 tests (+21), tsc clean, no new lint findings. Browser-verified: the database picker
lists 12 types and now reads "Last edited time"; the page picker lists 22; **the SVG path
data for text, multi-select, status, email and date is byte-identical across the two
surfaces**, which is the merge actually landing rather than being asserted. A deliberately
legacy-shaped fixture in the documents harness (option as `{ label }`, type
`updated_time`) renders correctly on both counts.

---

## Part 4 — What to do next, in order

1. ~~**Renumber the §9 migration ledger**~~ — **done 2026-08-03**, see §1.2.
2. ~~**`@` typeahead**~~ — **done 2026-08-03**, see Part 3.
3. ~~**Merge the two property systems**~~ — **done 2026-08-03**, see Part 3.
4. ~~**`task_events` (0030)**~~ — **built 2026-08-03, gated.** See Part 3.
5. ~~**Apply 0028 and 0030**~~ — **done by you 2026-08-03**, verified by column probe.
   Phase 1 is closed and the timebox twin is live.
6. ~~**`reminders` (0031)**~~ — **built 2026-08-03, gated.** One `remind_at` per task
   (§7B), presets anchored to the timebox block when there is one, delivery claimed
   exactly once by a conditional UPDATE so tabs and devices cannot double-fire, toast +
   bell. *Yours:* paste `supabase/migrations/0031_reminders.sql`. The push/email worker is
   a later sprint — it reuses the same claim and needs no schema change.

   Found and fixed inside that sprint's area: every task-drawer popover overflowed the
   viewport at 375px (and scrolled the whole document sideways), none of them had any
   keyboard grammar, and **three** hand-rolled copies of "format a clock time" were
   hardcoded to `en-US` — so an `en-GB` calendar drew a 24-hour grid with a 12-hour now-chip.
7. ~~**The drag-to-calendar rail**~~ — **built 2026-08-03, no migration.** Open
   un-timeboxed tasks docked right of the grid (Scheduled + Inbox), drag onto a slot →
   twin at the task's own estimate; the grid owns the drop because the grid owns the
   geometry. Every row also carries a slot menu — that is the keyboard path AND §7C's
   mobile "schedule at…" affordance, not a fallback. Hidden in Month view (a cell is a
   day, not a time) and below `xl`.

7b. ~~**The capacity line (§7C)**~~ — **built 2026-08-05, no migration.** The other half of
   §7C's P0 line (the shutdown→tomorrow picker was already live). The finding was not a
   missing feature but **three shipped capacity rules that disagreed** — Home's
   `DAY_BUDGET = 8h`, the Week board's `DAY_CAP = 6h`, and the ritual's sum against nothing
   — while onboarding asked "when does your day end?" and stored an answer **nothing read**
   and nobody could change afterwards. `lib/capacity.ts` is now that one rule; Home, Week and
   a new "does it fit?" step in the morning plan all read it, and Settings → Account can edit
   the hours. Meetings merge, clip to the working window, and **exclude timebox twins** (Home
   had been charging a timeboxed task twice, since 0030). Unestimated tasks are counted and
   reported, never given a default.

   Found and fixed inside that sprint's area: **seven** hand-rolled copies of "format a
   minutes duration", three of which rendered a negative estimate as "-30m" —
   `formatMinutes` joined the date vocabulary and `date-vocabulary.test.ts` now fails on any
   component doing hour arithmetic (it found the seventh copy itself).

7c. ~~**The morning digest (§7O channel 2)**~~ — **built 2026-08-06, no migration.**
   The last of §7O's three channels; that section is now closed. Opt-in, at most one a day
   in the reader's own timezone, dropped rather than queued once three hours late, and
   **not sent at all when nothing is asking for you**. Carries §7C's capacity line beside
   today's list. Vacation mode ships with it, as a date rather than a toggle.

   **Two silent jsonb-path defects, both caught only by probing the live database:** a
   deliberately bogus path answered `200 []` exactly like a correct one (so a typo in the
   candidate filter would have meant nobody ever got mail while the endpoint reported
   healthy — fixed by removing the filter in favour of the tested pure function), and a
   bare `.neq` on the absent `lastSent` key matched **no row**, which would have blocked
   the *first* digest for every account forever.

8. **Next.** With Phase 3's schema items closed, the largest remaining gaps are the ones
   §3.3 still lists: `attachments` (0033) and `proposals`/`contracts` (0034) — the two
   places the product is furthest from the plan's own description of itself. Smaller,
   written down, not started: an internal link needs ⌘-click to navigate (Notion solves
   it with a hover preview card — its own sprint), `staticItems(pathname)` ignores its
   parameter, `lib/db-engine.ts` contains three literal NUL bytes that make `grep`
   silently return nothing for that file, and the database view still has no cell renderer
   for `person`/`files`/`formula`/`relation`/`rollup`/`button`/`place`/`id`.

9. ~~**The duplicate `EmptyState`**~~ — **done 2026-08-05.** `components/ui/states.tsx`
   deleted (last two importers migrated), closing `DESIGN_AUDIT.md` item 11's duplicate
   half. The surviving DS component was **270px against a 180px design cap**; it is now
   exactly 180.000px, its three states share one `CenteredState` shell instead of three
   copies of the same class string, and five over-length descriptions were cut to one
   sentence. `lib/empty-state-copy.test.ts` enforces the rule on every call site — the
   height is CSS, but the copy that decides it is statically checkable.

**Found while verifying, not started, in priority order:**

- ~~**Horizon goal cards fail hydration**~~ — **fixed 2026-08-05.** It was not one page:
  `lib/date.ts`'s locale rule assumed a `'use client'` component only runs in the browser,
  but it is server-rendered first — so **23** client components shipped `en-US` HTML and
  re-rendered as the user's locale. The format is pinned now (`4 Sep` / `18:05`), `locale`
  is deleted from `DateOpts`, and **19 call sites that had drifted back out of the
  vocabulary** were returned to it (five hand-rolled `just now` ladders, two copies of
  `formatDay`, Finance rendering "Sep 4" beside Tasks' "17 Jun").
  `lib/date-vocabulary.test.ts` enforces it.
- ~~**`app/(app)/today/page.tsx:16` throws on a session-less request**~~ — **fixed
  2026-08-05.** Not one page: **17** call sites wrote `user!.id` on the comment "auth is
  enforced by the (app) layout", but a layout renders *concurrently* with its page and so
  cannot gate it. `lib/auth.ts` now owns both shapes — `requireUser()` (redirects, for
  pages) and `requireSession()` (throws, for actions) — which also absorbed **22 private
  copies** of the latter. All 17 routes now answer 307 → /login with no session and no
  server error.
- **Source lint: 96 → 19** (2026-08-05). Chasing the tail found a real defect: the saved
  **sidebar mode lived only in `localStorage`**, invisible to a server render, so every page
  load painted the expanded sidebar and reflowed one frame later (`hover` renders a
  different tree; `collapsed` changes the width). Now a cookie — `lib/sidebar-mode.ts` +
  the `(app)` layout — the app's own pattern, per `SPACE_COOKIE`. **Owed: the first paint
  itself is unverified**, because the layout only runs for a signed-in user.
- **(earlier) 96 → 20**, and the remainder is a different kind of thing:
  **17 of the 20 are effects that are CORRECT** — data fetching, and client-only reads
  (`localStorage`, `URLSearchParams`) that cannot run on the server. Contorting those to
  satisfy the rule makes them worse; the honest options are `useSyncExternalStore` for the
  storage reads and leaving the fetches alone. Everything mechanical is done.
- **(earlier) 96 → 32.** `react-hooks/refs` 24 → 1; `purity`, `use-memo`
  and `no-unescaped-entities` at zero. Three hooks now hold what the app had been writing
  by hand: `useServerState` (21 copies), `useLatest` (7) and `useChanged` (7 dialog resets
  that flashed the previous state for a frame). `triage.tsx` — 15 errors, the worst file —
  kept its queue and undo history in **refs read during render**, with a `bump` counter to
  force re-renders; both are state now. 29 of the remaining 32 are `set-state-in-effect`,
  spread thin (mount-only init 8, one-offs 21).
- **(earlier) 96 → 62.** `purity`, `use-memo` and
  `no-unescaped-entities` are at **zero**. Chasing them surfaced two conventions the app
  had never agreed on: the optimistic placeholder id (24 hand-minted copies + 12 string
  comparisons → `lib/temp-id.ts`; `Date.now()` alone collided within a millisecond and
  these are React keys) and **the week start, which had SIX different answers** — Tasks →
  Week began Monday while Calendar → Week began Sunday. `WEEK_STARTS_ON` / `startOfWeek()`
  in lib/date.ts is the one answer now. Also: the DS date-picker held four
  `Intl.DateTimeFormat(undefined, …)` formatters that hid from the vocabulary guard
  because it only looked for `toLocaleDateString`.
- **(earlier the same day) 96 → 75.** The single biggest class is gone: **21** copies of
  `useEffect(() => setX(initX), [initX])` — the optimistic-update contract — now go through
  `useServerState`, which compares during render instead of after paint. **75 remain and are
  their own sprint**: 35 `set-state-in-effect` (mount-only init 8 · dialog-open resets 7 ·
  one-offs 20), 24 `react-hooks/refs`, 10 `purity`. `triage.tsx` alone holds 15. These are
  React Compiler correctness rules, so the count is the distance to enabling the compiler.
  (`eslint.config.mjs` was linting `.open-next/**`, hiding this behind 1134 build-output
  errors; fixed 2026-08-05.)

**Written down, not started** (noticed during the `@` sprint, outside its scope):

- ~~**An internal link doesn't navigate on a plain click**~~ — **fixed 2026-08-06.** A
  plain click now follows the link: internal goes in-app via `recordHref`, external opens a
  new tab, and a record type with no page yet does nothing. `lib/use-follow-link.ts` owns
  the decision (`resolveLink` is pure and tested); `StaticRich` skips activation when a
  mouseup lands on a link with a collapsed selection, so dragging across a mention still
  selects it. **The hover preview card was NOT the fix** — it would have layered a fetch
  and a hover delay over a link that still didn't work when clicked. Still worth building,
  now on top of one that does.
- ~~`staticItems(pathname)` ignores its parameter~~ — **removed 2026-08-05.** Using it (hiding the current page's row) was rejected on purpose: a keyboard palette runs on muscle memory, and a list that reorders by location moves every command.
- ~~**`lib/db-engine.ts` contains three literal NUL bytes**~~ — **fixed 2026-08-05.** Now
  the escape `'\0'` behind a named `SEP`. `file` reports UTF-8 again and grep finds
  `RETYPEABLE` on line 140, which it previously could not see at all. The separator's
  reason (an option named "To do" must not match `is: "do"`) now has six tests.
- ~~The database view still has no cell renderer for `person`, `files`, `formula`,
  `relation`, `rollup`, `button`, `place` or `id`~~ — **the PAGE half closed 2026-08-04.**
  `place`, `files`, `relation` and `formula` now render properly; `rollup`/`button` are
  withdrawn from the picker via `surfaces: []` (still resolved, so saved values render).
  **The formula engine existed all along** (`evalFormula`, lib/db-engine) — untested, and
  with no way to author an expression anywhere in the product. It now has 40 tests, two
  fixed defects (`1 +` answered 1; `(1 + 2` answered 3) and a real editor with a live
  result. **The database can author one too as of the same day** — one shared
  `FormulaEditor` whose only dependency is an `evaluate` function, plus `formula` moved to
  `surfaces: BOTH` (it was PAGE, so the database's add-property list never offered it).
  A relation points at a RECORD rather than a nominated database's rows, and is collected
  into `mentions` on save — so it appears in Connected like any other reference.
  `formula` had been printing the CURRENT USER'S NAME as its value. The database half is
  untouched — its 12 types all render, and the four withheld ones were never offered there.

~~Proposals/contracts and attachments are larger and later~~ — **STALE, corrected
2026-08-06. Both shipped.** Attachments are migration `0033` + `lib/attachments.ts`;
proposals are the `lineitems` and `accept` block types with `0034_acceptances` and
`0035_acceptance_invoice`, all three migrations present and probed applied. This line was
written before those sprints and would have sent the next session to build them twice —
the exact failure this document exists to catch, now on its third occurrence. **Check the
code before trusting any "next" in here.**

**What is actually left, in order:**


1. ~~**A record summary projection + the hover preview card.**~~ — **BOTH DONE.**
   `resolveSummaries` is the per-type descriptor (table · label · extra columns · how to
   build `meta`), and `resolveRefs` is now a thin projection over it. The **hover preview
   card** shipped 2026-08-06: `components/connected/record-preview.tsx` over a new DS
   `HoverCard`, wired into `staticSpans` so every mention in every document has it.
   It answers identity + state ("Project · Active"), NOT content, because most of the
   eleven mentionable types have no body — a deliberate difference from Notion, matching
   Linear. External links are returned untouched; the query fires on OPEN, not on render.
2. ~~**Blocks as addressable rows**~~ — **SPLIT, and the addressable half is DONE
   2026-08-06, with no migration.** This was carried here as "the largest remaining
   structural item" from the plan's v2.3 §2, which blamed block-level comments, block
   links and synced blocks on the JSONB `pages.content` blob. **Only the last of those
   was true.** A block has carried a stable id since the editor was written
   (`Block.id`, persisted in the blob, round-tripped by `normalize()`, re-minted on
   duplicate), every row already rendered `data-block-id`, and the outline already
   scrolled to one — so block links shipped today: `lib/block-link.ts` (the address),
   `lib/use-block-anchor.ts` (the request), "Copy link to block" in the block menu, and
   an arrival that opens the toggles a block is folded inside before scrolling to it.

   Found and fixed inside that sprint's area: `resolveLink` normalises an internal link
   back through `recordHref`, which knows nothing about fragments — so **every block
   link would have opened the right document at the top and looked like it worked**;
   `documents-view`'s `share()` was the app's second hand-written copy of "what a
   document's URL is"; and the DS's `--animate-flash-highlight` had **zero users** and
   was tinted with a token that resolves to paper-on-paper, i.e. invisible.

   **What is actually left of this item** is the *rows* half, and it is Phase 4: a block
   with an **owner other than its page** — i.e. **synced blocks**, and only those. Block
   comments turned out not to need it either (item 3 below).

3. ~~**Block comments**~~ — **built 2026-08-06, gated on `0037_comments.sql` (yours to
   paste).** The second of v2.6's three named Notion blockers. Anchored to
   `(page_id, block_id)` with `block_id` as TEXT and no foreign key — the same reason
   `mentions.target_id` has none, and the reason this needed no decomposition of
   `pages.content`. A thread is a `thread_id`, not an anchor, so two questions about one
   paragraph are two conversations. Inline under the block rather than Notion's right-hand
   rail, deliberately: the reading layout has no spare column below `xl`.

   **It was a data-loss fix as much as a feature.** Comments lived in `pages.content`, and
   `restoreVersion` overwrites `content` wholesale — so restoring any old version silently
   reverted or deleted every comment on the page. Pre-0037 comments are still read after
   the migration, so nothing is lost in either direction.

   Found by the browser, not by the tests: the resolved disclosure counted orphans, so it
   read "Show 3 resolved" while one of the three was an unanswered question whose block had
   been deleted. An orphan now falls back to the page as an OPEN thread.

**Next, in order:**

1. **Synced blocks** — all that is left of "blocks as addressable rows", and the only part
   that genuinely needs a block to have an owner other than its page. Phase 4.
2. **Memory M5 (the clerk)** — Phase 6 by design; the module has to be worth using before a
   model touches it.
3. ~~**Memory (§7X)** — planned, not started, and blocked on four open questions.~~
   **M1–M4 + decay SHIPPED 2026-08-06** on an applied 0029 — see Part 5. The four questions
   were answered as documented defaults rather than left blocking. **Only M5 (the clerk) is
   left, and it is Phase 6 by design.**

---

## Part 5 — Memory (§7X): planned 2026-08-03, **M1–M4 + decay built 2026-08-06**

**Migration 0029 is APPLIED** — verified against the live app on 2026-08-06 (the `/memory`
page renders real rows and the working-hours detector fired on real completions), not taken
from a document that claimed it.

Blueprinted in `MEMORY_MODULE_PLAN.md` and wired into the roadmap. A sixth layer over §3.1.

- **Migration 0029** — **WRITTEN, NOT APPLIED.** Probe before building anything on it:
  `GET /rest/v1/memories?select=id&limit=0` (a `42P01` means absent). Everything M1 ships is
  gated on `memoriesSupported()` in `lib/actions/memory.ts`, so the app is correct either way.
- **M1–M2** ship with Phase 4, **M3** with Phase 5, **M4–M5** with Phase 6.
- **M1–M4 contain no AI.** The module has to be worth using before a model touches it.

### What M1 shipped

The `memories` table, `lib/memory.ts` (the rules, tested), `lib/actions/memory.ts` (the
writes, gated), `components/memory/memory-panel.tsx` on the client and document surfaces,
and "Remember this" in the document selection toolbar.

**It is a SIBLING of the Connected panel, not a group inside it.** Connected renders
references; a fact is a sentence, and one row component cannot be both without truncating
facts or growing a second typography. `memory` is therefore **deliberately absent from
`GROUP_ORDER`** in lib/connected.ts — which is also that panel's filter, so a fact never
renders as a Connected row.

### What M2 shipped

`/memory` (the home + the Horizon nav row + `g r`), ⌘K **Recall**, memories in
`lib/search.ts`, and quick capture's Memory type. `components/memory/memory-row.tsx` was
extracted so the home and the panel render the identical row.

**`EntityType` gained `'memory'` at M2**, and the criterion was the one already written in
lib/search.ts: *a type joins the moment it gets a record route.* M1 kept it out because
`recordHref` could only have returned undefined. Adding the route made TypeScript demand the
three total-map entries, which is why those maps are exhaustive rather than partial.

**Quick capture has NO Task/Memory toggle.** The choice is made at commit time — Enter saves
a task, ⌥Enter remembers — because a mode toggle taxes every ordinary capture to serve the
rare one. A fact captured there is about **you**; there is no record context in a global box.

### The four open questions — answered as defaults, overturnable

1. **Derivation scope** — M3; clients and projects first, self-facts opt-in.
2. **Space scoping** — `space_id` set = that space, **null = everywhere**; self-facts are null.
3. **Retention** — the system never hard-deletes; `forgetMemory` is user-initiated only.
4. **Razorpay** — unaffected (the detector reads invoice history, not the processor).

### What M3 shipped

`lib/detectors.ts` — **payment rhythm** (client), **estimate accuracy** (project) and
**working hours** (self), pure and tested, no AI. `lib/memory-suggest.ts` runs them and
**suppresses** anything already answered: accepted keys live in the memory's `anchor`,
dismissed ones in `profiles.preferences`. Neither needed a table.

The **Noticed band** on `/memory` is the only path from a proposal to a row — §8's "never
write a memory silently", made structural. Every row shows its **evidence**, which is the
deliberate difference from Gmail's smart suggestions and Linear's similar-issues.

**The project overview now hosts `<MemoryPanel>`**, which is what makes `project` a legal
subject — the rule being that a fact is never recorded somewhere it cannot be read.

Two §4.1 detectors were NOT built, for the same reason: **no data behind them.** Deferral
patterns need a change log for `scheduled_date` that no table keeps, and reply latency needs
a channel the app does not record. Both are schema work, not detector work.

### What M4 shipped

`historyOf` + the **"What this replaced"** disclosure on every fact · **`?on=YYYY-MM-DD`**
("what was true in March", finally calling the `asOf` predicate tested since M1) ·
**`confirmMemory`** and the **"Are these still true?"** step in the weekly review.

**Confidence could only ever fall before this.** §3.1 promised derived facts rise when
confirmed and nothing raised one in three milestones. `confirmedConfidence` is a step, not
a jump — three separate weeks of "still true" is what carries a detector's guess to the top.

The as-of view switches OFF the Noticed band, capture, and the synthesised self group: you
cannot answer a question about now from a screen showing then.

### Decay shipped too (§5.4)

`fadedConfidence` — 90 days of grace, then half every 120, pinned facts exempt. **Computed,
never stored** (no cron, no migration) and **nothing archives itself**: fading drops a fact
in `sortMemories`, which stops it reaching the ambient three, and the "About to fade" band
ASKS. Both departures from the plan's wording come from §9 — zero surprise outranks
tidiness. ⌘K Recall now stamps `last_recalled_at` via `Item.onSelect`, a new palette hook
for side effects that accompany navigation rather than replacing it.

### What is left in this module

**M5 — the clerk (Phase 6), and nothing else.** Also unbuilt on purpose: the "What
contradicts" band, because supersession means the app cannot currently hold two live facts
that disagree. It becomes real when the clerk can propose one that conflicts.

Also written down, not started:
- ~~A project has no memory panel~~ — **done in M3.** A project is now a legal subject.
- **Quick capture cannot pick a record subject.** A fact typed there is about you.
- **Memory bodies carry no links yet**, so nothing writes a `mentions` row with
  `source_type = 'memory'`. The plan's "edges reuse `mentions`" arrives with that.
