# Memory — module blueprint

**Status:** **M1–M4 + decay built 2026-08-06**, on an **applied** migration 0029. Only M5
(the clerk, Phase 6) remains. Subordinate to `DESIGN_CONSTITUTION.md`, `MASTER_PRODUCT_PLAN.md` (this is its §7X)
and `INTERACTION_STANDARDS.md`. Where this document and the code disagree, the code is what
shipped — see §11 for the two deliberate divergences and `SPRINT_STATUS.md` Part 5.

**One sentence.** Memory is the layer that remembers what you would otherwise have to
re-derive — the durable facts about your clients, your projects and yourself — and puts
them in front of you at the moment they matter, without you filing anything.

---

## 1. The decision this whole document rests on

> **A memory is a FACT with a time validity. It is not a saved thing.**

"Acme wants invoices on the 1st" is a memory. A saved article is a bookmark. A meeting
write-up is a Doc. If we blur that line, Memory becomes a second Documents module with a
worse editor, and the product gets less coherent, not more — exactly the failure the
constitution's §8 exists to prevent.

Two consequences, and they are the reason this is worth building at all:

**Facts are superseded, never overwritten.** Acme moves from net-30 to net-15. The old
fact does not get edited — it gets an `invalid_from` and a pointer to the one that
replaced it. You can still ask what was true in March, which is what makes a memory
system trustworthy rather than merely present. (This is Zep's temporal-graph insight, and
it is the single most valuable idea in the four reference products.)

**Facts are extracted, not collected.** A memory is short, atomic and re-readable in one
line. Ten paragraphs of meeting notes produce three memories, not one blob. (Mem0's
lesson.)

---

## 2. What each reference product teaches — and what we refuse from it

| Product | The lesson we take | What we deliberately do not copy |
|---|---|---|
| **mymind** | Zero organisation. No folders, no tags to maintain, one search. Saving costs one gesture and no decisions. | Its scope — a visual scrapbook of the internet. Zenboard's corpus is your work, not your browsing. |
| **Supermemory** | Universal capture, and a graph rather than a list. | The browser extension / web clipper as the centrepiece. That is Supermemory's product; ours is the workspace. |
| **Mem0** | Memory is *extracted facts* with dedupe and update, scoped and decaying — not a transcript store. | Its agent-session framing. Zenboard's scope is the human, not a conversation. |
| **Zep** | Temporal validity. Contradictions resolve by time, not by last-write-wins. | Its raw graph as a user-facing surface. Users get facts and backlinks; the graph stays internal. |

**The angle none of them have:** they must be *told* things. Zenboard already holds the
invoices, the calendar, the tasks, the portal threads. The most valuable memories in this
product are the ones nobody has to type — *this client has paid late three quarters
running*, *this project always slips in week three*, *you have moved this task nine
times*. **The workspace is the corpus.** That is the whole differentiator, and it is why
this module belongs in Zenboard rather than beside it.

---

## 3. Object model

Memory is a **sixth layer** over the five in §3.1, and it produces a fourth kind of edge
in the fabric (§3.4) alongside structural links, @-mentions and clerk suggestions.

### 3.1 `memories` (migration **0029** — the next genuinely free number, see §6)

| column | why |
|---|---|
| `id`, `user_id`, `space_id` | RLS scope, as everywhere. |
| `body` text | The fact, in one line. Long bodies are a smell — that is a Doc. |
| `kind` | `preference` · `fact` · `decision` · `pattern` · `person` · `snippet`. Six, fixed. Not user-extensible: a taxonomy the user maintains is filing by another name. |
| `subject_type` / `subject_id` | What the fact is ABOUT (a client, a project, `self`). Polymorphic, no FK — same reasoning as 0027. |
| `origin` | `derived` (Zenboard noticed) · `marked` (you selected it) · `told` (you typed it) · `suggested` (clerk proposed, you accepted). |
| `source_type` / `source_id` / `anchor` | Where it came from, so every memory can show its receipt. A memory you cannot trace is a rumour. |
| `valid_from` / `invalid_from` | The temporal spine. `invalid_from is null` = currently true. |
| `superseded_by` | The fact that replaced this one. Gives an audit trail instead of a hole. |
| `confidence` | 0–1. Derived facts start below 1 and rise when confirmed. Never shown as a number — it orders, it does not decorate. |
| `recall_count`, `last_recalled_at` | Feeds decay (§5.4). |
| `pinned`, `archived_at` | User overrides everything. |

**Edges reuse `mentions` (0027).** A memory that names a record is `source_type =
'memory'` in the table that already exists and now has a writer. No second edge table —
the fabric is one mechanism or it is not a fabric.

### 3.2 What Memory is NOT allowed to become

- Not a store of documents. It references them.
- Not a second search index. `lib/search.ts` gains a `memory` kind; it does not gain a sibling.
- Not a graph UI. The graph is how retrieval works, not a screen.

---

## 4. Capture — three sources, in order of value

**1. Derived (the differentiator, and it needs no user at all).**
Zenboard already knows things it never says out loud. Candidate detectors, each cheap and
each a pure function over data we already query:

- payment rhythm per client (late/early, by how much, trending)
- reply latency and preferred channel per client
- estimate accuracy per project (planned vs actual, from time entries)
- task deferral patterns (what you keep moving, and to when) — **NOT BUILT: no data.**
  Counting moves needs a change log for `scheduled_date`, and no table keeps one. This is
  schema work, not detector work, and pretending otherwise would ship a detector that
  silently never fires.
- the hours you actually complete work in, versus when you plan it — **built** (the
  completion half; "versus when you plan it" waits on the same change log)
- scope-change frequency per engagement — **NOT BUILT**, same reason

These are the memories with no competitor: no external tool has this data.

**2. Marked — "Remember this".**
Select text in a doc, a task, a portal message, a database row → one action. Same gesture
everywhere, via the DS selection toolbar. This is mymind's "saving costs one gesture and
no decisions", applied to work.

**3. Told.**
Quick capture (`C`) gains a Memory type. Later: email-in, per §7S.

**In all three cases the memory carries its source.** Every memory row can answer "why do
you think this?" with a link.

---

## 5. Retrieval — where memory shows up

**There is no chat window.** §7Q's test is explicit: *if a feature needs a chat window to
be useful, it is the wrong feature.* Memory is useful in four places you already are.

**5.1 ⌘K → Recall.** The command palette gains a Recall section: natural-language-ish
query, memories ranked by relevance × recency × confidence. `lib/search.ts` already
searches doc bodies and task notes; memories join that one index.

**5.2 The Connected panel.** A client, project or doc shows the memories about it, beside
its structural links and mentions. This costs almost nothing — `lib/connected.ts` is
already the one projection, and `recordHref`/`parseRecordHref` already address records.

**5.3 Ambient — the three facts you'd otherwise re-derive.** Opening a client shows what
you'd have gone digging for: how they pay, how they reply, what you agreed. Quiet, small,
dismissible, and never more than three.

**5.4 The weekly review.** Memory's natural curation moment, and where §7G already puts
"is this still true?" for goals. Same question, same place: confirm, supersede, or let go.

**Decay.** ✅ **built 2026-08-06.** A memory never recalled and never confirmed loses
confidence. It is never *deleted* by the system — archived is reversible, deleted is not,
and a memory system that quietly loses things is worse than none.

**Two departures from that paragraph, both from §9's "zero surprise":** decay is
**computed, never stored** (a pure function of silence — no cron, no migration, so the
stored number can never drift from the rule), and **nothing archives itself**. Fading drops
a fact in `sortMemories`, which is what stops it reaching the ambient three; the "About to
fade" band then asks. Same outcome, one confirmation later. 90 days grace, half every 120,
pinned facts exempt.

---

## 6. Schema and sequencing

**Migration numbers.** Memory takes **0029**, the first genuinely free number. The §9
ledger was renumbered the same day (0030–0035) after it was caught reserving numbers
other features had already taken — see `SPRINT_STATUS.md` §1.2. Anything later in this
module takes the next free number *after* that ledger, not 0030.

| Milestone | Ships | Migration | Depends on |
|---|---|---|---|
| **M1 — the spine** ✅ **built 2026-08-06** | `memories` table, "Remember this" from a document selection, facts on the record they are about (a sibling of Connected — see §11) | **0029** (written, not applied) | the fabric (done 2026-08-03) |
| **M2 — recall** ✅ **built 2026-08-06** | ⌘K Recall; memory results in search; the memory home at `/memory` (+ the Horizon nav row and `g r`); Memory in quick capture (moved from M1, §11) | — | M1, search v2 (exists) |
| **M3 — derived** ✅ **built 2026-08-06** | `lib/detectors.ts`: payment rhythm · estimate accuracy · working hours, each pure and tested. No AI. Proposals accepted or refused in the **Noticed** band; nothing is written silently. Deferral + reply latency deferred — no data behind them (see below). | — | M1; time entries, invoices (exist) |
| **M4 — temporal** ✅ **built 2026-08-06** | `historyOf` + the "What this replaced" disclosure; `?on=YYYY-MM-DD` for "what was true in March"; `confirmMemory` + the "Are these still true?" step in the weekly review (5 steps only when there is something to ask). Decay itself still waits on a recall signal. | — | M1, §7G's review |
| **M5 — the clerk** | AI *proposes* memories from docs and portal threads; each is a one-tap accept and lands with `origin: 'suggested'` — a value 0027 already anticipated | — | Phase 6 clerk infrastructure |

**M1–M4 contain no AI at all.** That is deliberate: the module has to be worth using
before a model touches it, or we will not be able to tell whether the model is helping.

**Roadmap placement.** M1–M2 sit with Phase 4 (Knowledge) — they are the same substrate.
M3 sits with Phase 5 (the business data it reads lives there). M5 is Phase 6, under the
clerk doctrine, and not before.

---

## 7. IA

One route, `/memory`, in the **Horizon** nav group: Goals (where you are going), Habits
(what you repeat), Memory (what you have learned). The group is the long view; this
belongs to it.

But note the Inbox precedent in `app-shell.tsx` — a nav row for something that is really
a view of another thing made one list look like two places. So the nav row is added at
**M2**, when there is something to curate. Until then Memory is reached from ⌘K and from
the surfaces in §5, and it is a layer rather than a destination.

The `/memory` page is for **review**, not browsing: what's new, what's uncertain, what
contradicts, what's about to fade. A wall of cards to scroll is mymind's product, not
this one.

---

## 8. The never-list, extended (§8)

- **Never write a memory silently.** Derived and suggested memories are proposals until
  accepted. This is the clerk doctrine and it is not negotiable here of all places.
- **Never a chat window.**
- **Never in the client portal.** Memory is inference about clients; it is the single
  most damaging thing that could leak. Portal projections must not be able to reach it.
- **Never in an export by default,** and never silently in a backup.
- **No browser extension in v1.** The workspace is the corpus.
- **No memory score, streak or gamification.** Remembering is not a game.
- **No second search box.** ⌘K is the one search.
- **No shared memory** until team accounts exist, and then only by explicit grant.

---

## 9. How we will know it worked

The cancelled-subscription test does not apply — nobody pays for a second brain they
already own. The honest measures:

- **Re-derivation avoided.** Facts recalled from the ambient surface that would otherwise
  have meant opening three screens. If nobody ever recalls a memory, the module is dead
  weight and should be removed.
- **Acceptance rate of derived memories.** Below ~50% the detectors are noise and should
  be cut, not tuned.
- **Supersessions.** Facts changing over time is the system working. Zero supersessions
  after a few months means we built a note pile.
- **Zero surprise.** Not one memory a user did not expect us to have. This metric has a
  target of exactly zero and it outranks the other three.

---

## 10. The open questions — answered as defaults 2026-08-06

Answered rather than left blocking, so M1 could ship. Each is a default, not a verdict:
say the word and any of them changes.

1. **Scope of derivation.** *Clients and projects first; self-facts behind an explicit
   opt-in.* The self-facts are the most useful and the most uncomfortable, and a module
   whose first act is to tell you about your own deferral habits has to earn that. M3
   decides nothing until then — M1 stores `subject_type = 'self'` but no surface writes it.
2. **Space scoping.** *`space_id` set = scoped to that space; `null` = true everywhere, and
   self-facts are null.* A client fact belongs to the client's space. A fact about you that
   vanished when you switched spaces would be a bug wearing a design decision's clothes.
   Encoded in 0029 and in `spaceFor()`.
3. **Retention.** *The system never hard-deletes.* Decay archives, archiving is reversible,
   and `forgetMemory` runs only when a person asks — the one exception being Undo on a row
   that is seconds old, where leaving a tombstone would be the surprising behaviour.
4. **India/Razorpay note:** M3's payment-rhythm detector reads invoice history, which is
   independent of the payment processor — so it is unaffected by the Stripe hold.

---

## 11. Where the build diverged from this plan, and why

Both changes are in `SPRINT_STATUS.md` Part 5 too. Neither was a compromise for time.

**Memories are a SIBLING of the Connected panel, not a group inside it (§5.2).** Connected
renders references — label, status, chevron — and a fact is a sentence. One row component
cannot serve both without either truncating facts to four words or growing a second
typography. They share a heading rung, a hairline and the absence of fill, so they read as
one band in two registers. The consequence: **`EntityType` did not gain `'memory'`**, because
nothing at M1 can produce a memory→record mention edge (bodies are plain text), and the type
would have forced dead entries into two exhaustive maps. §3.1's "edges reuse `mentions`"
stands and arrives with the milestone that gives memory bodies links.

**Quick capture's Memory type moved from M1 to M2 (§4.3).** A fact typed into the global
capture box has no subject, and a subject-less fact has nowhere to live until `/memory`
exists. Shipping it at M1 would have written rows nobody could read — a partial feature.

**The rule underneath both:** *never record a fact somewhere it cannot be read.* It is also
why a **project** is not yet offered as a subject — the project overview hosts no memory
panel, so the document toolbar hides its action rather than guessing. That is what keeps
§9's "zero surprise" measure at zero.

**M2 resolved the first divergence and kept the second's shape.** `EntityType` gained
`'memory'` once `/memory` existed to give it a route — the criterion lib/search.ts already
stated — but `memory` stays out of `GROUP_ORDER`, so a fact still never renders as a
Connected row. Quick capture shipped without a Task/Memory toggle: the choice is made at
commit time (Enter vs ⌥Enter), and a fact captured globally is about **you**, because there
is no record context in a global box. A project still has no panel, so it is still not a
subject — that remains the first thing to revisit.
