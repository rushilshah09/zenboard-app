# Zenboard — Project management feature specification

**Status:** Draft v1 · 2026-07-17
**Author:** Product design / design engineering
**Scope:** The project-management core of Zenboard — capture, tasks, projects, planning, views, time, client collaboration. Documents, Finance, Habits, and Calendar are referenced only where they intersect PM.

---

## 1. Position

Zenboard is a **calm workspace for independent professionals** — one person running client work, not a team running sprints. That single fact drives every PM decision in this spec.

The PM landscape splits into four families, and Zenboard deliberately sits at their intersection:

| Family | Exemplars | What they get right | What we take |
|---|---|---|---|
| Team issue trackers | Linear, Asana | Triage inbox, keyboard-first speed, opinionated workflow, milestones | Speed, triage, restraint |
| Personal task managers | Things 3, Todoist, TickTick | Today/Upcoming model, "when vs deadline" split, natural-language capture, headings | The daily planning core |
| Calm/comms-first PM | Basecamp | "Less is more," per-project toolset, hill-chart honesty about progress | Anti-feature discipline, project health as narrative not metric |
| Daily-planner ritualists | Sunsama, Akiflow | Guided planning ritual, timeboxing tasks onto the calendar, shutdown + weekly review | Ritual layer on top of tasks |
| Freelancer suites | Bonsai, Moxie, HoneyBook | Client portal, projects tied to clients/money, time → invoice | The business spine |

**Positioning sentence:** *Things 3's daily calm + Linear's speed + Moxie's client spine, with Basecamp's discipline about what to leave out.*

### Principles (test every feature against these)

1. **One person, many hats.** No assignees, no seats, no workload charts. "Collaboration" means *the client*, through the portal, on your terms.
2. **When ≠ deadline.** `scheduled_date` (when I'll work on it) and `due_date` (when it's owed) stay separate concepts everywhere, as in Things. Planning views run on scheduled; urgency signals run on due.
3. **The plan is a ritual, not a backlog.** Today is curated each morning; nothing auto-floods it. Overdue items ask to be rescheduled, they don't scream.
4. **Calm by default.** No red badge counts, no streak-shaming, no velocity graphs. Progress is shown as quiet facts (3/8 done · next deadline Fri).
5. **Keyboard-first, drawer-first.** Every PM action reachable from ⌘K; task detail is a drawer, never a page navigation that loses list context.
6. **Schema before chrome.** Every feature below is annotated with its data status against `supabase/migrations/` so build order follows readiness.

---

## 2. Object model

```
Space
 └─ Project ──── Client (optional)         ← the freelancer spine
     ├─ Section (NEW)                      ← Things-style headings inside a project
     ├─ Milestone (MOVED: project-level)   ← currently goal-level only
     ├─ Task ─ Subtask (∞ nesting, exists)
     │   ├─ status: todo | doing | review | done   (exists, 0011)
     │   ├─ priority · highlight · estimate · recurrence (exist)
     │   ├─ scheduled_date + due_date (exist, 0009)
     │   ├─ Label (NEW, many-to-many, space-scoped)
     │   ├─ Blocked-by (NEW, task↔task, later)
     │   ├─ Comment · Activity · TimeEntry (exist)
     │   └─ Attachment (schema stubbed as Files tab; needs storage)
     ├─ Doc / Collection rows (exist, 0013)
     └─ Portal link → client requests/approvals (exist, 0006)
Goal (Horizon) ── linked projects/tasks → progress rollup (link exists; rollup is not wired)
```

Renames/invariants: entity names follow the glossary (Doc, Finance, Lists). "Milestone" becomes a **project** concept; goal checkpoints in Horizon get relabeled "steps" to avoid a double meaning.

---

## 3. Feature set

Tiers: **P0** = the calm core, beta-blocking · **P1** = fast follow · **P2** = later · **✗** = never (on purpose).

### 3.1 Capture & triage

| Feature | Tier | Reference | Definition & data status |
|---|---|---|---|
| Global quick-add (⌘K → "new task") | **P0** | Todoist | One input, available from every screen via existing command palette (`components/shell/command-palette.tsx`). Schema-ready. |
| Natural-language chips in quick-add | **P0** | Todoist NLP | Parse `tomorrow`, `fri`, `!high`, `#project`, `~30m`, `every monday` into removable chips (never silently — the chip is the confirmation). Tasks composer already parses some of this; unify into one `lib/task-parse.ts` used by quick-add, Tasks, and Week composers. |
| Inbox as triage, not a list | **P0** | Linear Triage | Inbox (`is_inbox`, exists) gets a triage mode: one item at a time, single-key actions — `s`chedule, `p`roject, `d`elete, `⏎` keep. Empty inbox is the goal state and says so quietly. |
| Capture from portal requests | **P1** | Moxie | "Accept" on a client request creates a task pre-linked to project+client (requests table exists, 0006). |
| Email-in / share-sheet capture | **P2** | Todoist, Akiflow | Per-user capture address → Inbox. Needs an inbound-email worker. |
| AI auto-triage / auto-categorize | ✗→**P2 opt-in** | Linear 2026 agents | At most: *suggested* project/date chips in triage, one tap to accept, off by default. No autonomous filing — capture trust is the product. |

### 3.2 Task anatomy

| Feature | Tier | Reference | Definition & data status |
|---|---|---|---|
| Statuses (To do / Doing / Review / Done) | **P0 (shipped)** | Linear | Fixed set, no custom workflow builder. `done` stays the authoritative bit (0011). |
| Subtasks with drill-in | **P0 (shipped)** | Things checklists, Asana | Drawer already walks nested subtasks with breadcrumb. Keep nesting *display* to 2 levels in lists even though schema allows ∞. |
| Labels | **P0** | Todoist, Linear | Space-scoped, flat (no label groups), ≤ a dozen encouraged. **Needs migration:** `labels` + `task_labels`. Filterable everywhere; rendered as quiet text chips, not colored pills-per-row. |
| Waiting-on flag | **P1** | GTD, Things | A label with behavior: `@waiting` + optional "on whom/since" note surfaces a "Waiting" group in project Overview — critical for client work. Build on labels, not a fifth status. |
| Task dependencies (blocked-by) | **P2** | Asana, Linear | Solo users rarely need graphs; ship as a simple "blocked by →" link on the drawer that greys the task in Today until the blocker completes. **Needs migration:** `task_links`. |
| Attachments | **P1** | Basecamp to-dos | Files tab is a stub in `projects-workspace.tsx`. Supabase Storage bucket + `attachments` table (task_id / project_id / doc_id). Drag-drop onto drawer. |
| Reminders (time-of-day) | **P1** | TickTick | `remind_at` on task + push/email worker. Distinct from due date; one reminder per task is enough. |
| Recurrence engine | **P0 (harden)** | Todoist | `recurrence` jsonb exists; guarantee the contract: completing a recurring task spawns the next occurrence with clean `scheduled_date`; "every" vs "every!" (fixed vs after-completion) semantics documented and tested. |
| Priority | shipped | — | Keep 3 levels + highlight star. No P0–P4 sprawl. |

### 3.3 Planning & time (the ritual layer)

| Feature | Tier | Reference | Definition |
|---|---|---|---|
| Today as curated plan | **P0 (shipped, refine)** | Things Today | Morning state: yesterday's leftovers presented as "reschedule / today / drop" — a 3-choice sweep, not an auto-rollover (Sunsama's key insight). |
| Week view with drag-to-day | **P0 (shipped)** | Things Upcoming | Exists; ensure due-date chips render distinctly from scheduled placement. |
| Timebox: drag task → calendar | **P1** | Sunsama, Akiflow | Dragging a task onto Calendar creates a linked event (event ↔ task id); completing either reflects on the other. Calendar + gcal sync exist; needs the link column. |
| Daily shutdown | **P0 (shipped)** | Sunsama shutdown | Exists as Rituals/Shutdown; add "tomorrow's top 3" picker so shutdown feeds the next morning. |
| Weekly review ritual | **P1** | Sunsama, GTD | Guided pass: inbox → zero, each active project answers "next action?", goals glance, pick week's highlights. A checklist flow over existing data — no new tables. |
| Focus timer on a task | **P0 (shipped)** | TickTick pomodoro | Focus view + `time_entries` exist; surface estimate-vs-elapsed on the task row when a timer ran. |
| Auto-scheduling / AI planning | ✗ | Motion, Sunsama "Timeboxing 2.0" | Automatic calendar stuffing contradicts the ritual. The human places work; we make placing effortless. |

### 3.4 Project structure & health

| Feature | Tier | Reference | Definition & data status |
|---|---|---|---|
| Sections inside a project | **P0** | Things headings, Asana sections | Named dividers in the project task list; board columns stay status-based. **Needs migration:** `sections` table + `tasks.section_id`. |
| Project milestones | **P1** | Asana milestones | Dated checkpoints on the project ("Design approved · Jul 24"); render on Overview and Timeline tab. **Needs migration:** repoint or add `milestones.project_id`. |
| Project templates | **P1** | Moxie, Asana | "Brand identity project" → sections, task list with relative dates (day 0, day+7), default docs. Freelancers rerun the same engagement constantly — this is the retention feature. **Needs migration:** `project_templates` (jsonb body, like 0007's `page_templates`). |
| Project health, stated not scored | **P1** | Basecamp hill charts | No percent-complete theater. Overview shows: next milestone, open/done counts, days to deadline, and a one-line owner-written status ("Waiting on client copy") pinned from Activity. The sentence *is* the hill chart. |
| Project lifecycle | **P0 (shipped)** | — | active / paused / done / archived exists; add a light "close-out" moment on done → prompts unbilled time + a 2-line retro note into Activity. |
| Client link on project | shipped | Bonsai/Moxie | Exists; keep as the join point for portal + Finance. |

### 3.5 Views & navigation

| Feature | Tier | Reference | Definition |
|---|---|---|---|
| List / Board / Calendar per project | **P0 (shipped)** | Notion views | Exists behind `<Segmented>`. |
| Filters (project, label, priority, due) | **P0** | Todoist filters | Extend the existing Tasks filter popover with labels + due-window once labels land. Composable but flat — no query language. |
| Saved views | **P1** | Notion, Todoist | Name a filter combo ("Client work due this week") → appears under Lists in Tasks sidebar. **Needs migration:** `saved_views` (jsonb filter). |
| Timeline tab → real mini-gantt | **P2** | Asana timeline | Current Timeline tab derives from task dates; upgrade to milestone + task-span rendering. Read-only first; no dependency arrows. |
| Global search | **P1** | Notion ⌘P | Command palette gains full-text across tasks/docs/clients (Postgres FTS). |
| Workload / velocity / insights dashboards | ✗ | Linear Insights, ClickUp | One person doesn't need to be told how fast they are. Ever. |

### 3.6 Client collaboration (the portal edge)

This is Zenboard's structural advantage — team tools have none of it, freelancer suites have clumsy UX.

| Feature | Tier | Reference | Definition |
|---|---|---|---|
| Share read-only project view | **P0 (shipped, verify)** | Moxie portal | Portal links + preview-as-client exist (0006, `share-panel.tsx`). |
| Client requests → tasks | **P1** | Basecamp message board, Moxie | Requests tab exists; add the accept-to-task flow (3.1). |
| Client-visible task flag | **P1** | — | Per-task `portal_visible` boolean; default off. The portal shows a curated plan, never the raw board. |
| Client approvals | **P2** | HoneyBook | "Approve / request changes" on a shared milestone or doc; writes to project Activity. |
| Client comments on shared items | **P2** | Basecamp | Threaded on portal-visible tasks/docs only. |

### 3.7 Time → money bridge

| Feature | Tier | Reference | Definition |
|---|---|---|---|
| Timer + manual entries, billable flag | **P0 (shipped)** | Bonsai | `time_entries.billed` exists. |
| Unbilled time → invoice draft | **P1** | Bonsai, Moxie | From project Time tab: "3.5h unbilled → Create invoice" pre-fills invoice_items and marks entries billed. Tables all exist (0004) — this is pure wiring, and it's the moment Zenboard beats every point tool. |
| Budgets (hours or fixed fee) per project | **P2** | Harvest | `projects.budget_minutes / budget_amount`; quiet progress line on Overview. |

### 3.8 Goals rollup (Horizon)

| Feature | Tier | Definition |
|---|---|---|
| Goal ← project/task progress | **P1** | `tasks.goal_id` and `goals.progress` exist but aren't reconciled. Derive progress from linked done-counts weekly (at review time, not live — goals shouldn't twitch). |
| Goal glance in weekly review | **P1** | One screen: each goal, its trend since last review, "still true?" prompt. |

### 3.9 Notifications

| Feature | Tier | Definition |
|---|---|---|
| Morning digest, not badges | **P1** | One optional daily summary (due today, overdue, waiting-on older than N days). In-app `notifications` table exists (0001). |
| Real-time nags, unread counts | ✗ | Contradicts calm. The ritual surfaces what matters. |

---

## 4. The never list (Basecamp discipline)

Committed anti-features — each is a positioning statement, not a gap:

- **No multi-user workspaces / assignees.** The portal is the only second seat.
- **No custom statuses or workflow builder.** Four statuses, forever.
- **No automations builder.** Behaviors ship as designed features (recurrence, accept-to-task), not user-programmed rules.
- **No velocity, workload, or productivity analytics.**
- **No auto-scheduling AI.** Assistive parsing yes; autonomous planning no.
- **No custom fields on tasks.** Structured data belongs in Collections (0013); tasks stay light.
- **No red badge counts anywhere.**

---

## 5. Build order (schema-gated)

**Wave 1 — P0 gaps (no or tiny migrations):** unified NL parser in quick-add · Inbox triage mode · recurrence contract hardening · project close-out moment · filter popover groundwork.
**Wave 2 — P0 migrations:** `labels` + `task_labels` · `sections` + `tasks.section_id` → then label filters everywhere.
**Wave 3 — P1 wiring on existing tables:** unbilled-time → invoice · request → task · goal rollup · weekly review flow · saved views · milestones repoint.
**Wave 4 — P1 infra:** attachments (storage bucket) · reminders (push worker) · timebox task↔event link · global FTS · morning digest.
**Wave 5 — P2:** dependencies, mini-gantt, client approvals/comments, budgets, email-in capture, opt-in AI suggestions.

All migrations follow house rules: idempotent, owner-only RLS, user pastes SQL (no DDL from the app).

---

## 6. Design notes (enforced by CLAUDE.md, restated for PM surfaces)

- Task rows 36px everywhere via `<TaskRow>`; square `<TaskCheckbox>`; completion sound stays.
- Drawer for task detail on every surface; board cards open the same drawer.
- Triage/list keyboard grammar is global: `⏎` open · `e` done · `s` schedule · `p` project · `l` label · `1/2/3` priority.
- One filled-accent action per view (New task); filters/views are ghost buttons.
- Progress is text first (`3/8 · due Fri`), bars only in Overview stat tiles, always `tabular-nums`.
- Empty states ≤180px; triage empty state is the reward screen ("Inbox is clear.") — the only place a moment of delight is budgeted.

---

## Appendix — research sources

- Linear: cycles/triage/initiatives, 2026 agents & triage intelligence — [linear.app](https://linear.app/), [Morgen Linear guide](https://www.morgen.so/blog-posts/linear-project-management), [Efficient App review](https://efficient.app/apps/linear)
- Things 3 / Todoist / TickTick comparison — [rivva](https://blog.rivva.app/p/todoist-vs-things-vs-ticktick), [unstar.app 2026 ranking](https://unstar.app/blog/todoist-ticktick-things-3-microsoft-todo-apple-reminders-todo-apps-ranked-2026)
- Basecamp philosophy & hill charts — [basecamp.com/features](https://basecamp.com/features), [basecamp.com/hill-charts](https://basecamp.com/hill-charts), [tooldirectory calm PM review](https://tooldirectory.ai/tools/basecamp)
- Sunsama/Akiflow rituals & timeboxing — [morgen.so comparison](https://www.morgen.so/blog-posts/sunsama-vs-akiflow), [toolfinder](https://toolfinder.com/comparisons/akiflow-vs-sunsama), [Sunsama review](https://dhruvirzala.com/sunsama-review/)
- Asana/Notion views, dependencies, milestones — [notion.com comparison](https://www.notion.com/compare-against/comparison-notion-vs-asana), [cloudwards](https://www.cloudwards.net/notion-vs-asana/)
- Freelancer suites & portals — [Moxie vs Bonsai](https://www.plutio.com/compare/moxie-vs-bonsai), [Moxie vs HoneyBook](https://www.withmoxie.com/moxie-vs/honeybook), [hellobonsai.com](https://www.hellobonsai.com/)
