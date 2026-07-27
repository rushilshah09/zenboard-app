# Zenboard Form Builder — Master Plan

Status: **F1 + F2 BUILT** (2026-07-26) — gated on applying `0020_forms.sql`. Plan written
2026-07-26 after market research; §15 decisions resolved and implemented. F3 (fabric) and F4
(gated externals) remain. Sections below are the design intent; "AS BUILT" notes record where
implementation refined it.
Reads alongside `MASTER_PRODUCT_PLAN.md` (the five-layer model, the fabric, the clerk doctrine)
and `CLIENT_PORTAL_MASTER_PLAN.md` (the token/projection security spine this reuses).

---

## 1. Product thesis — one sentence

**Build like a doc. Fill like a conversation. Manage like Linear.**

Three findings from the research, one from each best-in-class product:

1. **Tally** proved the best *building* experience is a document, not a drag-and-drop canvas —
   "just start typing", slash commands, blocks. It out-rates Typeform on G2 (4.9 vs 4.5) largely
   on this. Zenboard already has the block model (`lib/blocks.ts`) and the paperwork-as-docs
   doctrine (§7M) — this is our native idiom, not an import.
2. **Typeform** proved the best *filling* experience is conversational — one question at a time
   raises completion 2–2.5× vs classic multi-field pages (40–60% vs 15–20% for the same
   questions). Under 10 questions is optimal; ~6 is the sweet spot.
3. **Nobody** attaches forms to the *relationship*. Typeform/Tally/Jotform forms float in a
   workspace; connecting a response to a client, a project, a task, or an invoice is manual
   export-and-retype. Zenboard forms are born inside a client or project, deliver through the
   portal the client already has (no login), and every response lands in the fabric — one tap
   from response → task, automatic client activity, feedback-loop input.

That third point is the moat. We will not out-feature Jotform (35M users, 20 years of field
types). We win by making forms **a native organ of the client relationship**, with a builder
that feels like writing and a filling experience that feels like being listened to.

## 2. Research synthesis — what each product teaches, what we refuse

| Product | Take | Refuse |
| --- | --- | --- |
| **Typeform** | One-question-at-a-time mode; progress feedback; conditional logic presented as a readable whole (not per-field spaghetti); polished completion analytics | The heavyweight builder; video backgrounds; per-response pricing anxiety |
| **Tally** | Doc-style builder — type to build, `/` to insert; forms as pages not canvases; generous free behavior | Nothing major — closest philosophical cousin |
| **Fillout** | Best-of-both ambition (beautiful + powerful); answer piping; hidden fields; multi-page with per-page layout | Integration sprawl as the product |
| **Paperform** | Text and fields coexist in one flowing page ("a branded webpage, not a form"); calculations for scoring/pricing | Submission-retention limits; calc-first complexity |
| **Jotform** | Breadth as reassurance: templates, approval flows, enterprise trust | The 2006 aesthetic; 400 field types; PDF-form energy; approval-workflow builder |
| **Google Forms** | Zero-friction creation baseline — a form in 60 seconds | The ugliness tax (measurably halves completion) |
| **Formstack** | Enterprise workflow/routing patterns (know they exist) | Building any of it — wrong customer |

**The never-list (forms edition, extends §8):** no workflow/approval builder · no custom CSS/JS
injection · no per-response pricing or retention limits on your own data · no third-party
trackers in rendered forms · no CAPTCHA walls by default (quiet honeypot + time-trap instead) ·
no "400 field types" — every field earns its place · **no AI features** — nothing AI is wired in
the product today and the builder is designed to not need it (great templates + a great editor
instead of "chat to create"). If the product-wide clerk (§7Q) ever ships, drafting help can be
added then — suggestion-first — but it is out of this plan entirely.

**Reference, not template (how we use the Typeform screenshots):** they inform *patterns* only —
the forms-hub list with Responses / Completed / Updated columns, the grouped field picker
(Contact · Choice · Text · Rating), builder-with-logic-nearby. Zero visual language is imported:
no colored field-type chips, no upsell banners, no marketplace tabs, no chat bars. Every screen
is built 100% in the Zenboard design system — DS `Button`/`Badge`/`Input`/`Textarea`/
`Segmented`/`UnderlineTabs`/`EmptyState`, token colors only (never raw hex), monochrome B&G,
one filled-accent per view, 13px UI type, sentence case, square checkboxes, the standard 48px
single header row. The public filling page uses the portal's exact monochrome idiom (§6). If a
needed primitive doesn't exist, it's added to `components/ds/` first, then used — never forked
inline (Design Constitution: Design System before features).

## 3. Where forms live — information architecture

Per the product decision: **forms belong to a client or a project** — not a floating global pool.

```
Clients → [client detail] → Forms        (client-scoped forms: intake, testimonial, check-in)
Projects → [project detail] → Forms      (project-scoped forms: brief, feedback round, sign-off)

/f/[token]                               public filling page (short URL, like /portal/[token])
Portal → Forms                           project forms surfaced inside the existing client portal
```

- **Client detail** gains a `Forms` section (alongside Projects / Invoices / Notes) in
  `components/clients/clients-view.tsx`.
- **Project detail** gains a `Forms` tab in the existing `UnderlineTabs` row in
  `components/projects/projects-workspace.tsx`.
- Both render the **same** `FormsPanel` component (list + create + open), scoped by
  `client_id` or `project_id` — one component, two homes, per the reuse rule.
- **No global /forms hub in v1.** ⌘K searches forms like everything else; a space-level
  template library ships inside the create flow (§11). A global index is a later, cheap add
  if real usage demands it (open decision §15.2).

**Glossary (enforced, one name per concept):** the entity is a **Form**. A filled-out form is a
**Response** (not "submission", "entry", or "result"). The person filling is the **respondent**.
Form states: **Draft → Live → Closed**. These words appear in nav, buttons, badges, and code.

## 4. Object model & schema (migration `0020_forms.sql`)

Follows the portal's proven security spine: owner-only RLS, public access via token +
service-role, one gated projection, no public insert policies.

```
forms
  id uuid pk · user_id (owner, RLS) · space_id
  client_id uuid null → clients      ── exactly ONE of client_id/project_id set (CHECK)
  project_id uuid null → projects
  title text · description text null
  status text CHECK draft|live|closed          (default draft)
  content jsonb                                 ── the block list (see below)
  version int default 1                         ── bumped on each publish
  settings jsonb                                ── mode: page|focus · thanks message ·
                                                   response limit · close date · collect_identity
  share_token text unique null                  ── minted on first publish; rotatable
  is_template bool default false
  view_count int default 0                      ── incremented service-role on public GET
  created_at · updated_at

form_versions
  form_id · version int · content jsonb · published_at
  pk (form_id, version)                         ── snapshot ON PUBLISH only, not per edit;
                                                   responses stay interpretable after edits

form_responses
  id uuid pk · form_id · form_version int
  status text CHECK partial|complete            ── partial = autosaved in-progress (analytics gold)
  answers jsonb                                 ── { [field block id]: value }
  respondent jsonb null                         ── { name?, email? } when identity collected
  meta jsonb                                    ── { source: 'link'|'portal', started_at,
                                                   completed_at, duration_s, last_field_id }
  created_at · updated_at
  RLS: owner SELECT/UPDATE/DELETE only. NO insert policy — inserts/upserts arrive through
  token-validated server actions using the service role (exactly like client_requests).
```

**Form content = blocks.** `content.blocks[]` reuses the app's block-list *pattern* (ids,
order, `computeDrop` reordering from `lib/blocks.ts`) with form-specific types:

```
Field blocks   short_text · long_text · email · phone · number · date ·
               select (single) · multi_select · dropdown · yes_no · rating(1–5) ·
               file (Phase F4, needs Storage)
Layout blocks  heading · text (statement) · divider · page_break (multi-page)
Field shape    { id, type, label, help?, placeholder?, required, options?[],
                 logic?: Rule[] }               ── id doubles as the answers key
Logic rule     { when: { fieldId, op: eq|neq|contains|gt|lt, value }, then: show|hide|skip_to }
```

**Deliberate architecture call:** the builder does **not** wait on the Documents ProseMirror
rebuild. Form blocks are structurally simple (label + options — no rich inline spans needed in
v1), so a dedicated lightweight `FormBlock` editor reuses the block-list interaction pattern
(slash menu, drag reorder, keyboard) without coupling to the PM track. The two converge later
if §7M accept-blocks and forms want shared machinery.

**Convergence note (§7M):** a future `accept` field (typed-name acceptance + timestamp) makes a
Form the engine behind proposal sign-offs — same spine, one renderer. Planned for, not built now.

## 5. Form creation experience — build like a doc

The builder opens as a full page (like a doc), not a modal. Three regions:

1. **The page (center).** Title (big, display type) → description → blocks. **Typing creates a
   field**: `Enter` adds the next block, `/` opens the insert menu (grouped the way the field
   picker research suggests — Contact · Choice · Text · Date & number · Layout — rendered as the
   DS command-menu, not a colored-chip grid), `⌘D` duplicates, drag or `⌥↑/↓` reorders. Field
   label *is* the block's text — editing feels like writing a doc, exactly the Tally lesson.
   Click a field to expand its quiet inline settings (required · placeholder · help text ·
   options list · logic).
2. **Settings rail (right, collapsible).** Form-level: filling mode (Page / Focus) · collect
   identity (name/email) · thanks message · response limit · close date · after F2: notify me.
3. **Header row (single, 48px).** Title-in-place · status badge · `Preview` (renders the real
   filling page in an overlay, exactly what respondents see — same preview==live guarantee as
   the portal) · one primary action: **Publish** (mints/keeps `share_token`, snapshots a
   version, flips Live, shows the share sheet).

Craft details that make it feel reference-grade: options editable as plain lines (type,
`Enter`, type — no per-option modals) · `required` as a single quiet toggle, never a red
asterisk farm · every destructive act undoable · autosave with the same Saved indicator idiom
as Library · empty form = three starter blocks already placed (name field, email field, one
long-text) so the page is never blank.

**Creating a form** from a client/project Forms panel: `New form` → choose **Blank** or a
**template** (§11) → lands in the builder with the client/project already bound.

## 6. Filling experience — the respondent side

Rendered at `/f/[token]` (public, force-dynamic, no index) with the **portal's exact visual
idiom**: monochrome B&G, studio monogram + name up top, calm type hierarchy, semantic badges
only, ONE ink-solid primary button per view. The respondent should feel they're in the same
branded room as the portal — because they are.

Two modes (per-form setting; **Page is the default**, per open decision §15.3):

- **Page mode** — the whole form as one calm scrolling document (Paperform's lesson: text and
  fields flowing together). Best for short forms and briefs.
- **Focus mode** — one question at a time (Typeform's lesson): big question, one input, big
  `Next`/`Enter`, thin progress meter, `↑` to revisit. Selects/yes-no/rating advance on tap.
  Best for feedback and anything > ~6 questions.

Shared behavior in both modes:
- **Inline validation** on blur, never a submit-time error dump; errors in plain sentences.
- **Autosave partials.** First interaction creates a `partial` response (uuid in
  localStorage, keyed by token — same capability pattern as portal requests); every answer
  upserts it. Respondents resume after a dropped connection; we get honest drop-off analytics.
  Submitting flips it to `complete`.
- **Phone/email nudges**: builder marks phone optional by default (the research's single
  biggest field-level abandonment fix: −36.9pp).
- **After submit**: the form's thanks message + a quiet "Powered by Zenboard".
- Closed/limit-reached/rotated-token → the same calm "this link isn't available" page as the
  portal.

## 7. Sharing & permissions

- **Standalone link** — `/f/[token]`: the universal channel, works for client-less audiences
  too (a lead-intake form). Share sheet on publish: copy link, QR later.
- **Portal** — project-bound forms can additionally surface in the existing client portal.
  **AS BUILT:** ONE switch, not two — a per-form `show_in_portal` (opt-in, default false), no
  project-level `share_forms` flag. Two keys for one door was a concept the owner would have had
  to learn for no benefit. The portal links out to the same `/f/[token]` page everyone else uses,
  so there is one filling path and one security gate rather than a second renderer to keep in sync. The portal's dashboard nav
  (just rebuilt) gains a **Forms** item listing live forms; filling happens inline in the
  portal, `source: 'portal'` recorded. Client-bound forms reach clients via the standalone
  link in v1 (the portal is per-project today).
- **Permissions truth**: single-owner product (per master plan) — the owner authors, publishes,
  rotates tokens, closes. Respondents are anonymous-capability holders (the link), never
  accounts. Team roles remain the separate track it already is.
- Token rules copied from the portal: rotate invalidates old links instantly · unpublish
  (back to Draft) 404s the link · tokens never indexed (`robots: noindex`), never logged.

## 8. Response management

Inside the client/project **Forms** panel:

- **Forms list** — name · status badge (Draft/Live/Closed) · response count · completion % ·
  last response (relative). Row actions: open builder · copy link · duplicate · close.
- **Responses view** (per form) — a Linear-grade table: one row per complete response
  (respondent identity or "Anonymous" · started · duration · source), newest first, keyboard
  `↑↓ ⏎`. Partials live under a quiet segmented filter (All / Complete / Partial), never mixed
  in by default.
- **Response drawer** (the app's one-drawer pattern): question → answer pairs in reading
  order, meta footer, and the **fabric actions**: **Make a task** (one tap → task in the bound
  project, response linked via `tasks.request_id`-style column — reuses the request→task
  lifecycle shape) · **Log to client** (activity/note on the bound client, automatic when
  client-bound per §12) · delete (confirm).
- **Export CSV** — one click, streams all complete responses, columns = field labels in form
  order. Your data is never held hostage (the anti-Paperform position).
- **New-response notification** — in-app (the quiet count idiom, never red) in F3; email
  notification is gated on Resend (F4).

## 9. Analytics & reporting — the review, not the dashboard (§7R)

One calm strip above the responses table — five numbers, no chart wall:

**Views · Starts · Completed · Completion % · Median time**

(views = `view_count`; starts = responses incl. partial; the rest derived — no events table,
no third-party scripts, nothing stored about respondents beyond their answers and coarse meta.)

Plus the single most actionable artifact from the research — **the drop-off list**: for forms
with enough partials, a per-field list showing where people stop (`meta.last_field_id`
frequency). "30% quit at Phone" is a fix you can make today; that's the entire point of
analytics here.

## 10. Logic & conditional branching

Research consensus: logic wins forms, but per-field spaghetti kills builders. Zenboard v1:

- **Rules**: `when [field] [is / is not / contains / > / <] [value] → show / hide [field] ·
  skip to [field/page]`. Show/hide covers 90% of real use; skip-to covers focus-mode branching.
- **Authoring**: rules attach on the target field's inline settings, **and** a form-level
  **Logic summary** (settings rail) lists every rule as a plain sentence — the readable "whole
  map" Typeform gets praised for, without building a node-graph editor.
- **Guardrails**: hidden-by-default for dependent fields · a rule referencing a deleted field
  degrades to inert + flagged in the summary · cycles prevented at author time (skip targets
  must be later in order) · logic evaluated identically in page mode (show/hide) and focus
  mode (skip) from the same rule objects.
- **AS BUILT (F2):** ONE mechanism, not two — a block carries `showWhen: {fieldId, op, value}`.
  In page mode that shows/hides; in focus mode a hidden question is simply skipped, which *is*
  branching. No separate `skip_to` concept, no node-graph editor. Sources are restricted to
  questions ABOVE the block, so cycles are impossible by construction rather than by validation.
  Ops: is · is not · contains · more than · less than · answered · not answered. Hidden questions
  are never validated (a required question you never saw can't block your submit) and their
  answers are pruned server-side on submit (a stale value from an abandoned branch never lands
  in the record or the CSV).
- **Calculations/scoring** (Paperform's territory): explicitly **P2**. Real for pricing/quizzes,
  but not before the core loop earns it.

## 11. Templates & reusable components

- **Starter templates** (ship in code, seed on demand): Client intake · Project kickoff brief ·
  Design feedback round · Testimonial request · Change request · Post-project review. Six,
  each under 10 fields (the completion sweet spot), written in Zenboard voice.
- **Save as template** — any form → space-level template (`is_template`); create-flow shows
  Blank + starters + yours.
- **Duplicate** — copy content + settings, never responses.
- Reusable *components* beyond whole forms (shared field groups) are deliberately out —
  that's custom-fields energy (§2 principle 8). Templates are the reuse unit.

## 12. Automation & integrations — designed behaviors, not a builder (§7P)

Shipped as fixed, obvious behaviors — never a workflow canvas:

- **Response → task** (one tap in the drawer; F3) — the request→task lifecycle generalized.
- **Client-bound form response → client activity** logged automatically (F3) — the client
  record stays the source of truth for "what happened with this client".
- **New response → in-app notification** (F3); **email** via Resend (F4, gated).
- **Webhook per form** (F4): one URL, POST the response JSON — the 80% integration for 1% of
  the surface area. Zapier-style catalogs: refused.
- **Stripe payment field** (F4, gated on the user's Stripe): aligns with the §7N rails and the
  portal pay-link track — one payments integration, reused.

## 13. Security, privacy, spam & performance

**Security (the portal spine, reused):**
- Owner-only RLS on `forms` / `form_versions` / `form_responses`; **no public insert policies**
  — the public filling page talks only to token-validated server actions using the service
  role, which re-check `status='live'`, limits, and close dates on every call.
- One projection function (`lib/forms.ts` mirroring `lib/portal.ts`): the public page can only
  ever receive the safe shape (published version content + settings), never owner data.
  Preview == live by construction.
- Tokens: ≥ 24 chars, unique, rotatable, never in logs; response upsert authorized by
  (token + response uuid) pair — same capability model as portal requests.

**Privacy:** store answers + coarse meta only — no IP, no user-agent, no fingerprinting, no
third-party assets on `/f/*` (self-hosted fonts already). Respondent identity only when the
form explicitly asks. Data retention: forever, yours, exportable (§8).

**Spam (quiet by default):** honeypot field + minimum-time trap (< 3s = bot) + per-token rate
limit in the action. Optional **Cloudflare Turnstile** per form in F4 (free, fits the CF
host) for public lead-gen forms — never default (never-list: no CAPTCHA walls).

**Performance & scale:** filling page = one indexed token lookup + jsonb read (same
force-dynamic pattern as the portal; sub-100ms server work) · answers as one jsonb row per
response (no per-answer rows — nothing to join at read time) · responses table paginated 50/page
+ indexed `(form_id, status, created_at)` · version snapshots only on publish · builder
autosaves debounced (the Library idiom) · CSV export streams · form size capped (~60 blocks) so
one form can't degrade its own render. Realtime: `form_responses` joins the existing
realtime-sync channel so the responses table live-updates like everything else.

## 14. Build order — phases and gates

Mirrors the portal plan's shape: each phase self-contained, verified on dev-preview harnesses,
DDL handed to you as SQL (I can't run migrations).

- **F0 — this plan.** Confirm §15 decisions. *(you are here)*
- **F0 — plan.** ✅ done. **F1 — core loop.** ✅ **BUILT 2026-07-26** (gated on applying 0020).
  **F2 — craft layer.** ✅ **BUILT 2026-07-26.** **F3 — the fabric.** ✅ **BUILT 2026-07-26**
  (in-app notifications deferred — no app-wide notification system exists to hang them on;
  the Forms panel count + realtime already surface new responses). See PROGRESS.md.

- **F1 — the core loop** *(migration 0020)*: schema · Forms panel in client + project detail ·
  doc-style builder (fields, reorder, settings, preview, publish/share) · `/f/[token]` page-mode
  renderer with validation + partial autosave · responses table + drawer + CSV. **A form can be
  born, shared, filled, and read.**
- **F2 — the craft layer**: focus mode · logic (rules + summary) · analytics strip + drop-off
  list · templates + duplicate · close/limits/schedule. **It becomes the form builder we'd
  brag about.**
- **F3 — the fabric**: portal Forms section (project-bound) · response→task · client activity
  logging · in-app notifications · ⌘K. **It becomes unmistakably Zenboard.**
- **F4 — gated externals** *(each needs your setup)*: file upload (Supabase Storage bucket) ·
  email notifications (Resend) · Stripe payment field (Stripe account) · Turnstile toggle ·
  webhook. *(No AI anywhere in this roadmap — per the product decision above.)*

## 15. Open decisions (blocking F1)

1. **Naming** — "Form" + **"Response"** (recommended; matches the calm voice) vs "Submission".
2. **Home rule** — forms strictly client-XOR-project (recommended; matches your directive,
   relaxable later) vs also allow space-level forms now.
3. **Default filling mode** — **Page** default with Focus as a per-form toggle (recommended:
   calm default, conversational when it counts) vs Focus default (maximum Typeform energy).
4. **Identity** — anonymous by default, identity fields opt-in per form (recommended) vs
   always collect name/email on client-bound forms.
5. **F1 scope check** — anything in F2/F3 you want pulled forward (e.g. focus mode in F1)?

---

*Research inputs: Typeform's own completion data and design guides; Tally's doc-builder model
and G2 comparison; Fillout/Paperform/Jotform feature and positioning comparisons; conditional-
logic UX pattern guides; 2026 form-abandonment datasets (WPForms/ActiveCampaign 3.1M sessions;
multi-step drop-off studies; the Mailchimp/Twilio optional-phone experiment).*
