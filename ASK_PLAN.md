# Ask — the natural-language command spine

**Status:** governing plan for Ask. Set 2026-09-29 by user brief (Mail · Chat · Meetings), whose
Chat section reads: *"The existing Chat should become the natural-language command center for
Zenboard … Do not make users navigate through multiple screens for simple actions that can be
completed through Chat."* Sprint rules apply: one stage at a time, each finished end to end.

**A1 shipped 2026-09-29.** A2–A5 below are the remaining stages.

---

## 1. What this is, and what it is not

Ask is **one sentence becoming one performed act in Zenboard**. It is not a chatbot with access to
a database, and the difference is structural rather than a matter of tone:

- **A model chooses from a fixed list. It never writes.** It picks one of `ASK_COMMANDS` and fills
  in arguments; the executing code is the same server action the buttons already call. There is no
  path from a model's words to a row.
- **A model never names a record.** It hands back the PHRASE the person used ("the buildojo logo"),
  never an id — an id is the one thing it cannot know and the one thing it will happily invent. The
  server resolves the phrase against real rows, and an ambiguous match is a QUESTION, never a guess.
- **A model never does date arithmetic.** It repeats the person's own time words ("friday",
  "tomorrow at 12") and chrono-node reads them against a known instant in the person's zone. Asking
  a model what date next Friday is buys a confident wrong answer.

These are `lib/draft.ts`'s rules generalised from prose to action, and they are what make the whole
feature testable with no model in the room (`lib/ask.test.ts`, 29 cases).

## 2. What runs, and what is offered

Not "is it a write" — almost everything is. The line is **whether the command touches a record that
already exists**, because that is where this goes wrong:

| | Commands | Behaviour |
|---|---|---|
| **Creations** | `create_task` · `schedule_event` · `create_project` | Run, and say what they did, with a link to it |
| **Touch an existing record** | `complete_task` · `reschedule_task` · `create_reminder` | OFFERED with the resolved record's real title, and one click |
| **Reads** | `show_tasks` · `show_agenda` · `find` · `none` | Run, and answer |

Creating a task from a misheard sentence costs one glance and an undo. *Completing the wrong task*
is the model reaching into work already done, and the part it got wrong is WHICH ONE — which a
person can check at a glance if they are shown the title. `TOUCHES_EXISTING` is that rule, and
`lib/ask.test.ts` proves no command escapes the classification.

## 3. The surfaces

Two, and they are **one conversation** off one module store (`lib/ask-store.ts`), for the same
reason the recorder's store exists: the thing that must survive a navigation cannot live in a
component.

- **Home's Ask mode** (`components/ask/ask-home.tsx`) — the roomy one. A `<SegmentedControl>` under
  the greeting swaps the dashboard for the conversation (user wireframe, 2026-09-29). It is a view
  toggle, which is what a segmented control means everywhere else in this product, and NOT a nav
  item: Ask is a way of using Home, not a different place.
- **The side panel** (`components/ask/ask-panel.tsx`) — the quick one, mounted once in the shell,
  reachable from anywhere by `A`, the top bar, or ⌘K's fall-through row. Non-modal, so the page
  stays visible: *"move this task to Friday"* has no referent on a page that is not showing the task.

⌘K stays the fast path for a command you already know — a list, keyboard-driven, no model, no
latency — and hands over to Ask, carrying your words, when nothing matches. Nobody learns two boxes.

The composer wears **Zenboard's own composer anatomy**, not a chat widget's: the card, the
chromeless field, and the full-bleed sunken footer band that the task composer already uses (user
direction, 2026-09-29). Its left end says what Ask can SEE — the open record — which is this
product's honest answer to a chat app's model picker.

## 4. Stages

| # | Stage | Ships |
|---|---|---|
| **A1** ✓ | **The spine** — shipped 2026-09-29 | the registry, the three rules, resolution + ambiguity, 10 commands over tasks/events/projects/reminders/search, both surfaces, ⌘K hand-off, `A` |
| **AH** ✓ | **The chat experience** — shipped 2026-09-30 | the history rail, the chain-of-thought disclosure, the conversation header, the answer tools — see §7 |
| **A2** | **Meetings' verbs** | `ask_meeting` ✓ shipped 2026-09-29 with MEETINGS_PLAN M3a (a READ; "this" = the open meeting; `resolveMeetingPhrase`; `choose` can carry a question). Still owed: `prepare_meeting` (M4) and `meeting_actions` |
| A3 | **Mail's verbs** | `find_email`, `draft_reply`, `email_to_task` — gated on the Mail module |
| A4 | **Multi-step** | "two tasks today and a meeting tomorrow at 12" is currently ONE command; a sentence carrying several becomes several offers in one turn |
| A5 | **Memory of the conversation** | today each turn is independent; follow-ups ("and move it to Monday") need the last turn's resolved record |

## 5. Where it lives

- `lib/ask.ts` — the rules. Commands, schema, prompt, phrase→record scoring, time reading. Pure.
- `lib/ask-store.ts` — the one conversation, shared by both surfaces.
- `lib/actions/ask.ts` — the only part that touches the database, through the same actions the
  buttons call. `ask()` reads the sentence; `runProposal()` / `chooseAndRun()` perform an accepted one.
- `components/ask/` — `ask-conversation.tsx` (shared transcript + composer), `ask-answer.tsx` (one
  answer, drawn), `ask-home.tsx`, `ask-panel.tsx`.
- `lib/ai/ask.live.test.ts` — the brief's own sentences against a real model. Opt-in:
  `ZB_LIVE_AI=1 npx vitest run lib/ai/ask.live.test.ts`.
- `app/dev-preview/ask/page.dev.tsx` — the real panel and the real Home mode, answered from a
  script, so every answer kind can be driven without a session or a model call.

## 5a. A companion, not an overlay

Ask is asked ABOUT the page beneath it, so its drawer is a declared **companion**
(`<Drawer companion>`, components/ds/ui/drawer.tsx): a modal page beneath it (a full-page meeting) must
not read a press inside Ask as "outside" and close itself (PageView exempts `[data-companion]`, as it
does toasts), and must not freeze Ask's scrolling with its scroll lock. Found 2026-09-29: asking a
meeting from its own page closed the meeting.

## 6. What the live test already caught

*"Find my emails from Alex"* came back as `find`, which would have searched Zenboard and reported
"nothing" — telling somebody their inbox is empty on the strength of a table that has never seen an
email. The prompt now states what `find` searches and that this app does not hold email, chat
messages, local files or the web. **A model bending a request into the nearest available verb is
the failure mode to test for**, not whether it picks the right one when the verb exists.

---

## 7. The chat experience (AH, shipped 2026-09-30)

USER DIRECTION 2026-09-29/30, with Claude's and Notion AI's transcripts and sidebars beside
screenshots of ours: *"left side of history chat collessable"* · *"i want claude like claude chat
expirence"* · *"use my logo thinking and loading whol chting"* · *"i want like this full chat
xpirence"* · *"exatlu same to same like calude and notion"*.

**A conversation is a record.** `ask_conversations` + `ask_messages` (migration **0049**, gated by
`askHistorySupported()`), the title is the person's own first sentence trimmed — a model never names a
record here either — and `payload` keeps the whole `AskAnswer` with its trace, so a reopened chat shows
the receipts it showed live.

**Where each piece lives, and what owns what:**

| | |
|---|---|
| `lib/ask-history.ts` | ALL the arithmetic — grouping (Pinned → dated → Older at 30 days), `titleFor`, the title filter, `withLive`, `conversationWhen`. No clock, no zone, no Supabase; the caller resolves all three |
| `lib/actions/ask-history.ts` | the only part that touches the database. Gated: before 0049 every function returns a clean empty result and Ask behaves exactly as it did |
| `components/ask/use-ask-history.ts` | the rail's state — the one read, the optimistic writes, `?chat=` in the URL, and the reconciliation that folds the live conversation into the list |
| `components/ask/ask-history-rail.tsx` | rows, and nothing else. `HubLayout` owns the two panes, the responsive stack and the COLLAPSE the user asked for by name; `railBtn` from the Tasks rail owns the row |

**The rail is reconciled, never pushed to.** It is read ONCE on first entry to Ask (Home's loader is one
wave of queries and a conversation list nobody asked for does not belong in front of the page everybody
opens), and everything after that happens in the browser. `withLive` is the single place the two are
put together. An imperative `bump()` was the first answer and it was never called — see PROGRESS
2026-09-30.

**What is in the URL.** `?view=ask` is a MODE (pushState — Back returns to the dashboard);
`?chat=<id>` is a RECORD (replaceState — flicking through six chats must not bury the page you arrived
from). `lib/hub-url.ts` is the rule, and Home now obeys it like every other hub. The chat param is
written off the STORE, so it is right whichever surface changed the conversation.

**The thinking block is a receipt, not a token stream**, and that is the point rather than a shortcut:
the model's entire output is one validated `AskCommand`. What folds open is the three places Ask can
misread you — the command it heard, the words it took as the subject, and what a time phrase resolved
to. Each is checkable at a glance, which is why it is worth opening and why it is closed by default.

**What is deliberately NOT here.**
- **Thumbs.** A rating needs somewhere to go and Zenboard has no store for one; a control that only
  lights up is a lie about being listened to (SPRINT_RULES rule 8).
- **Approval modes** (Notion's "Always ask" / "Review for me" / "Skip all approvals"). Zenboard is in
  "Always ask" PERMANENTLY, by architecture: §1's rules mean a model never writes, so every mutation
  comes back as an offer. The other two modes would mean letting Ask execute without the offer step,
  which contradicts the founding rule of the spine. A product decision, not a UI job.
- **A Stop button.** `ask()` is a server action and there is no abort path through one. A Stop that
  does not stop is worse than a disabled composer.

**Searching message BODIES** is Search v2's job (`lib/search.ts`). The rail's filter is titles only,
in the browser, because it has to be instant while you type.
