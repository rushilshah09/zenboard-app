# Consistency without rigidity

**Status:** governing. Set by the user 2026-08-17. Sits beside
`DESIGN_CONSTITUTION.md` (what good looks like) and `SPRINT_RULES.md` (how work
is sequenced). Where this and the constitution overlap, they agree; this file is
the sharper statement of *how far* consistency is supposed to go.

> **Same principles, not necessarily the same screens.**

---

## The three things this asks for

1. **Nobody should have to relearn the product.** If Projects establish a
   pattern for navigation, editing, actions or information hierarchy, then
   Clients, Tasks and Forms follow it *where the use case is the same*. Buttons,
   spacing, typography, cards, panels, forms, filters and menus behave
   identically everywhere.

2. **It should feel like one system.** Projects, Tasks, Clients, Forms, Docs and
   Finance are parts of one product. Reuse the component and the interaction;
   never invent a second solution for a problem the app has already solved.

3. **Do not copy layouts blindly.** A project overview, a task detail and a
   client profile have different purposes and may look different. The *rules*
   underneath stay the same.

---

## What this rules IN and OUT

Consistency is required at the level of **behaviour and vocabulary**:

- one component per concept, extended rather than forked
- one word per concept (the glossary), one place a given control lives
- the same gesture producing the same result on every screen
- the same keyboard grammar, focus order, empty/loading/error treatment
- the same answer to "where do actions live", "how does a list select",
  "how does a detail open"

Consistency is **not** required at the level of **composition**:

- how many columns a screen has
- whether a hub is a rail-and-detail, a board, a gallery or a table
- what leads a page, and how dense it is

The test to apply, screen by screen:

> *Would somebody who learned this gesture on another screen be right here?*

If yes and we differ — that is drift, and it gets fixed.
If no, because the purpose genuinely differs — that is design, and it gets a
written reason next to it.

---

## How a divergence is allowed to happen

A screen may depart from a shared pattern when the departure is:

1. **named** — say which pattern is being departed from,
2. **caused by the use case** — not by the order the screens were built in, and
3. **written down where the code is**, so the next person extends the reasoning
   instead of re-deriving it or "fixing" it back.

An unexamined difference is a defect. An examined one is a decision. The only
thing that is never acceptable is the same problem solved twice, differently,
for no reason.
