# Zenboard illustrations

One style, one illustration at a time. The palette and the style are published for the marketing
team at https://claude.ai/artifact/MvbDxDM8WPbd9aJFCpqcjt (private until shared).

## The style

`style.json` is the style block, and it is pasted **unchanged** into every prompt; only the
`illustration` part changes. In short:

- black brush-pen ink `#191919`, one weight per image
- paper-white shapes `#FBFAF6`
- one flat field colour behind it (Petal, Apricot, Butter, Sage, Sky, Periwinkle, Sand, Mist)
- the Zenboard mark in berry `#C41C72` **exactly once**, on the thing that matters. Illustrations
  follow the app's rule of one accent per view.

## How one is made

1. In ChatGPT, attach `zenboard-mark-berry.png` and paste the illustration's JSON (for example
   `zb-01-day-planned.json`).
2. From ZB-02 on, also attach the approved ZB-01 as the style reference.
3. Trace or export it as an SVG with a transparent background. The app paints the field.
4. Bring it in: colours are snapped to the palette, the generated mark is replaced by the exact
   vector (`MARK_PATH` in `components/ds/icons.ts`), and the traced source is kept here as
   `*.source.svg`.
5. `components/ds/ui/illustration.test.ts` holds the rules on every shipped file: only ink, paper
   and berry; one berry element; no bitmap or text.

## Where they go

| # | Where | Type | Field | Status |
|---|---|---|---|---|
| ZB-01 | Morning planning, last step "Your day is planned" | Semi | Butter | Shipped. The hand's knuckles are due one refinement pass |
| ZB-02 | Evening shutdown, after "Close the day"; beside ZB-01 on the website | Semi | Periwinkle | Prompt out (`zb-02-day-closed.json`) |
| ZB-03 | Weekly review, last step | Semi | Sage | |
| ZB-04 | Page not found (no 404 page exists yet) | Icon | Mist | |
| ZB-05 | Something went wrong (no error page exists yet) | Icon | Mist | |
| ZB-06 | A dead portal or form link, seen by clients | Icon | Mist | |
| ZB-07 | The thank-you screen after a form is sent | Icon | Apricot | |
| ZB-08 | Proposal signed, in the client portal | Icon | Petal | |

**Never:** an empty state (a 20px icon — CLAUDE.md rule 4), sign-in or onboarding (they show the
live product), or a working screen (tasks, documents, tables).
