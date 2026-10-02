# Zenboard — master product context

**Status: governing.** Set by the user 2026-09-06. It sits *above*
`PRODUCT_THINKING.md`, which stays true and becomes its "what matters today"
chapter. Where the two disagree, this wins.

> The goal is not to put everything in one application.
> The goal is to make everything **behave like one system**.
> **The intersection is the product.**

## The problem

The user runs a studio across Calendar, Notion, a PM tool, a CRM, Drive, Gmail,
Slack, Figma, a content planner, a finance tool and a personal task app. The
problem is not that those tools are bad. It is that **the same information is
recreated in each of them**, and the cost is constant context switching.

A client exists in the CRM, their project in the PM tool, their meeting in the
calendar, their notes in Notion, their files in Drive, their invoice somewhere
else. Zenboard exists to end that.

## The one rule

**Never build a feature in isolation.** Before building, answer all ten:

1. What objects does this connect to?
2. What information does it consume?
3. What information does it create?
4. Where else should that information appear?
5. What actions can it trigger?
6. Can another feature use this information?
7. Does it reduce context switching?
8. Does it create duplicate data?
9. Does it make the next action easier?
10. Does it fit the existing ecosystem?

A feature that cannot answer these is an architecture problem, not a feature.

## The object graph

Objects, not modules. One object exists **once** and is referenced everywhere.

```
CLIENT                          PROJECT
 ├── Contacts                    ├── Client
 ├── Projects                    ├── Tasks
 ├── Meetings                    ├── Calendar events
 ├── Tasks                       ├── Meetings
 ├── Notes                       ├── Notes
 ├── Files                       ├── Files
 ├── Content                     ├── Content
 └── Finance                     ├── Milestones
                                 └── Finance
```

`Task → Project · Client · Calendar · Goal`
`Meeting → Client · Project · Notes · Tasks · Calendar`
`Completed project → Case study → Content → Campaign → Calendar`

## One object, many views

A task is the **same task** in the list, on a board, in a project, on the
calendar, under a goal, and on Home. Views differ; the object does not. This is
what stops duplicate data at the root.

## The tests that decide

- **Data duplication.** "Acme" is created once. If any surface stores its own
  copy of a client name rather than a reference, that is a bug.
- **UX leak.** Any copy → paste → search → re-enter → duplicate is a defect.
  The system should already know the context.
- **Context switching.** Measured against the old workflow: apps opened,
  searches, duplicate entries, copy/pastes, time to finish.
- **Overload.** Zenboard must not become an overwhelming everything-app.
  Progressive disclosure, contextual nav, smart defaults, search, palette.
- **3 interactions.** A frequent action costs three interactions or fewer.
- **The master question.** *Does this make the user's life easier, or does it
  create another place they have to manage?* If the latter — redesign.

## Workflow scenarios (the real QA)

Test whole workflows, not buttons. Each must survive without context loss,
duplicate data, or manual re-entry.

- **A — New lead:** lead → contact → proposal → client → project → tasks →
  calendar → invoice
- **B — Client meeting:** calendar → meeting → notes → decisions → tasks
- **C — Project execution:** client → project → tasks → calendar → files →
  notes → deliverables
- **D — Project → content:** project complete → content idea → draft → publish →
  calendar
- **E — Goal → execution:** goal → project → task → calendar
- **F — Personal:** personal goal → personal project → task → calendar

## Phasing

1. Home · Inbox · Tasks · Projects · Clients · Notes · Calendar · Search ·
   **Relationships** · Command center
2. CRM · Time · Content · Files · Portal · Proposals · Invoices
3. Goals · Habits · Personal · Finance · Analytics
4. AI · Automations · Smart planning · Proactive recommendations

## Working method

Understand the scenario → find the underlying problem → check existing Zenboard
patterns → check related objects → simplest solution → preserve consistency →
edge cases → responsive → engineering implications → QA the whole workflow →
next highest-priority problem.

Identify UX problems, missing relationships, architecture problems, duplicate
data, broken workflows, missing states, accessibility and responsive issues
**proactively** — without expanding scope. Highest impact first.
