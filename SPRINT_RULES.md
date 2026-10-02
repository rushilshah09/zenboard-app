# Sprint Execution Rules

**Status:** governing. Set by the user 2026-08-03, effective from that point forward,
without exception. Loaded every session via `CLAUDE.md`.

Where this file and another disagree: `DESIGN_CONSTITUTION.md` still governs *what good
looks like*; this file governs *how work is sequenced and when it is allowed to stop*.
They do not conflict — this one is stricter about finishing.

---

## The ten rules

1. **Single focus.** One feature or one problem at a time. No switching until the current
   sprint is fully complete.
2. **Complete before moving on.** End-to-end: research · UX · UI · engineering · edge
   cases · performance · accessibility · QA · documentation. No partially completed
   features.
3. **Quality over speed.** Every decision should improve long-term quality and
   consistency, not delivery date.
4. **Production-ready code.** Clean architecture, reusable components, consistent tokens.
   No technical debt, no hacks, no temporary fixes, no duplicate logic.
5. **Pixel-perfect design.** Perfect spacing, strong hierarchy, consistent typography,
   thoughtful motion, refined micro-interactions, consistent component behaviour.
6. **User experience first.** Simplicity, clarity, speed and delight outrank feature count.
7. **Benchmark against the best.** Compare every feature, interaction and visual detail
   against Notion and Linear. If ours is not at least comparable, keep going.
8. **No "good enough".** Working is not the stopping condition. Professional,
   production-quality is.
9. **Every sprint increases product quality** — measurably, across design, UX,
   performance, maintainability, consistency and reliability.
10. **The goal** is not to build software. It is to build one of the best-designed
    software products in the world.

---

## Operational definitions

Rules are only real if they can be checked. These make them checkable.

### A sprint is DONE when every line is true

- [ ] **Research** — the problem is stated, and the reference behaviour (Notion/Linear)
      is described specifically enough to be argued with, not just named.
- [ ] **UX** — the flow works for the empty, one, many, and error states.
- [ ] **UI** — DS tokens and components only; no raw hex, no invented spacing, no forked
      component. Where the DS lacked something, the DS was extended first.
- [ ] **Engineering** — one source of truth per concept; no duplicated logic; typed;
      `tsc` and `eslint` clean on every file touched.
- [ ] **Edge cases** — named explicitly and either handled or documented as out of scope
      with a reason.
- [ ] **Performance** — no new blocking work on a render path; lists that can grow are
      bounded; round trips counted, not guessed.
- [ ] **Accessibility** — keyboard path, visible focus, ARIA roles/names, 44px touch
      targets, honours reduced motion.
- [ ] **QA** — automated tests for the logic, and the interaction verified in the browser
      (or the reason it cannot be, stated).
- [ ] **Documentation** — `PROGRESS.md` entry, plus any governing doc the sprint changed.

### Rule 2 vs. dependencies outside our control

A sprint whose last step needs the user (pasting DDL, providing keys, authorising a
connector) is **not** an excuse for a partial feature. The standard is:

> Everything within our control is finished, the external step is stated in one line with
> exactly what is needed, and the code is **gated** so the product works correctly both
> before and after that step.

That is what "gated behind a capability probe" means here, and it is why it is the house
pattern rather than a workaround. A feature that breaks the app until someone runs a
migration is a partial feature and violates rule 2.

### What "benchmark against the best" requires (rule 7)

Naming Notion or Linear is not a benchmark. A benchmark states the specific behaviour —
timing, affordance, keyboard grammar, what happens on the edge — and then says whether
ours matches, exceeds, or deliberately differs *and why*. A deliberate difference is
fine; an unexamined one is not.

### Reporting

Every sprint update states, in this order: what shipped · the design decision that
mattered and why · what was verified and how · what is owed, if anything, with the reason.
Percent-complete is not a status. A checklist is.

---

## Standing consequences

- **No parallel work.** A second problem noticed mid-sprint gets written down, not
  started.
- **A found defect in the current sprint's area belongs to this sprint.** One outside it
  gets recorded and scheduled.
- **Stopping early requires a reason that is not "it works".** Rule 8.
- **If a sprint turns out to be two sprints,** say so and finish the first, rather than
  half-finishing both.
