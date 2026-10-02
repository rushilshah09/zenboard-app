# Design references — what we learn, not what we copy

A running log. For each reference we record **why it works**, **what transplants**, and
**what we refuse**. The refusals matter as much as the takes: Zenboard must stay
unmistakably itself (`DESIGN_CONSTITUTION.md` → "Zenboard must never become a clone").

Method for each entry:
1. **Structure** — what is on the page and where.
2. **Why it works** — the mechanism, not the aesthetic.
3. **Transplant** — the specific Zenboard change it justifies.
4. **Refuse** — what we deliberately leave behind.

---

## R1 — Cloudflare Workers dashboard (Worker detail → Settings)
*Shared 2026-07-28. Applied to: Forms.*

### Structure

Two header rows, then a two-column body.

- **Row 1 (breadcrumb):** `Workers & Pages › zenboard-web` left · `Ask AI · Support · avatar` right.
- **Row 2 (tabs + actions):** `Overview · Metrics · Deployments · Bindings · Observability · Domains · Settings` left · `Edit code` (secondary) + `Visit ↗` (primary) right. One hairline under.
- **Body:** a main column of titled sections, and a right-hand **anchor nav** listing those sections.
- **Section = title + one-line description + one right-aligned `+ Add`**, then a bordered card.
- **Row grammar = `label | value | ✏️`**, identical in every card. Values are human ("Disabled", "Default", "Dec 30, 2024"); code identifiers get mono chips (`nodejs_compat`).
- **Empty sections** are a bordered box with one instructive sentence — "Configure API tokens and other runtime variables" — not an illustration.

### Why it works

1. **The two rows have genuinely different jobs.** Row 1 answers *where am I in the account*; row 2 answers *which part of this record, and what can I do to it*. Neither repeats the other. (We settled the same split for Zenboard's app header vs page header.)
2. **Tabs and actions share one line.** Destinations left, verbs right. No wasted row, and the eye learns one axis.
3. **Actions are ranked, and there are only two.** One primary, one secondary. Restraint is what makes the primary readable as primary.
4. **Tabs are places, not modes.** Each is a URL you can send someone. Nothing important hides behind a toggle.
5. **The row grammar is the real win.** Because every row is `label | value | edit`, you can read the *entire current state* of a Worker by scanning one column. A stack of expanded form controls cannot do that — it shows you inputs, not answers.
6. **Descriptions explain why a section exists**, so a setting you've never touched is still legible.
7. **Empty states are inline and instructive** — compact enough that an untouched section costs almost no vertical space.

### Transplant → Forms

Our form builder has **three surfaces reached three different ways**: Build (the page), Settings (a rail toggled by a button), Responses (a separate route). That is the exact inconsistency `INTERACTION_STANDARDS.md` §2.4 names — sections of one record must be `<Tabs>`.

| Change | Rationale from the reference |
|---|---|
| **Build · Settings · Responses become underline tabs**, each a real URL | "Tabs are places, not modes." Settings stops being a rail you toggle; Responses stops being a route you navigate away to. |
| **Header drops to two actions: `Preview` (secondary) + `Publish`/`Share` (primary)** | Today the row carries back · title · badge · saving · Settings · Preview · Publish — seven things. Moving Settings into a tab leaves exactly Cloudflare's shape. |
| **Settings becomes grouped sections**, not a flat stack of switches | The rail is currently an ungrouped list of Switches and Fields. Group into: **Filling · Access · Notifications · Responses · Portal.** |
| **Adopt the `label | value | edit` row** for settings | Lets someone see what a form *is currently set to* at a glance. Reuse for Project settings and Settings panes afterwards — this is a DS row, not a Forms row. |
| **Section headers get a one-line description** | Makes "Turnstile" or "Collect identity" legible to someone who has never enabled them. |
| **Empty sections get the bordered one-line box** | Cheaper than `<EmptyState>` inside a settings section, and it reads as configurable rather than broken. |

### Refuse

- **The blue primary.** Zenboard's accent is berry/ink; the primary stays ours.
- **The density and grey.** Cloudflare is an operator console; we are a calm workspace. Same structure, our spacing and our dark surfaces.
- **The right-hand anchor nav — for now.** It earns its place at Cloudflare's page length. Our settings won't exceed ~1.5 screens once grouped; add it only if it does.
- **Pencil-per-row as the only edit affordance.** A row whose value is a switch should toggle in place; the pencil is for values that need a picker or a text field.
