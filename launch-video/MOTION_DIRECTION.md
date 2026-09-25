# Motion direction — "Everything comes together"

A second pass on the 1:15 film. The story, copy, brand and One Surface rule stay. What changes is
**how things move**: the film keeps moving, and every movement says the product's one idea —
many things become one calm thing.

References studied: Marketo (logo built from its own geometry), Airbank (one shape as the
protagonist, morphing through the story), Jurni (camera pushes into the product, text with
inline visuals), ElevenLabs Agents (lines that draw, branch and carry the eye).

## 1 · Diagnosis

Measured frame-to-frame motion across the current master and three of the references:

| | Average motion | Near-still seconds |
|---|---|---|
| **Zenboard (current)** | 0.54 | **26 of 74 (35%)** |
| Airbank | 2.10 | 10% |
| ElevenLabs | 2.32 | 8% |
| Jurni | 4.81 | 0% |

We move 4–9× less than the references. The pattern is always the same: **one burst when a scene
opens, then 2–3 dead seconds.** Worst spots:

- **S11–S15 (product):** every module lands in its first second, then holds still until the thread.
- **S04 (0:13–0:16):** the tile row sits frozen while the three lines land.
- **S08–S09 (0:30–0:38):** the question and the logo barely move, and the logo reveal is plain.
- **S18 (1:10–1:15):** four static seconds on the end card.

## 2 · Theme: Converge → Turn → Flow

Three signature gestures, used everywhere, so the film feels like one piece:

1. **Converge.** Many things gather into one: apps → tiles → the mark; a task → a calendar slot;
   hours → an invoice; eight rows → one lit sidebar. This is the product promise, animated.
2. **Turn.** Round, orbiting motion for the brand moments: tiles orbit on a ring, spiral in, and
   the mark lands out of a turn. Rotation is reserved for the mark and its tiles only.
3. **Flow.** The pink thread (after the reveal) draws, branches and leads the camera to the
   next thing. Before the reveal the same role is played by an ink hairline.

## 3 · Motion rules (additions to CLAUDE.md)

- **Motion floor.** Something purposeful moves in every second (the camera counts). Only two
  holds are allowed: the 16-frame silence at 0:30, and the last 1.5s of the end card.
  Target: average motion ≥ 1.5, near-still seconds ≤ 10%.
- **A new beat every beat.** In the product act something new happens on every beat (0.67s): a
  click, a count, a chip, a camera push.
- **Punch-in camera.** Still a 2D camera, but it now pushes in on the action (up to 1.35×) and
  eases back out: into the task being dragged, the chip being updated, the Paid pill.
- **Overlap in time, never in space.** The next action may start before the last one ends, as
  long as they never share pixels while moving.
- **Effects are Zenboard-only.** Ripple rings, the spark burst, motion trails, the aura and the
  one pink sheen appear only on Zenboard moments (from S09 onward), never in the chaos.
- **Rotation** is allowed for the mark and the orbiting tiles; still no 3D tilt, no shake.

## 4 · The new logo reveal (built — `LogoConcept` composition)

Replaces the current S08 ending and S09. 6 seconds at 60fps:

| Time | What happens | Sound |
|---|---|---|
| 0.3–1.2s | The eight app tiles lift off their row onto a ring | Soft lift |
| 0.6–3.7s | The ring turns 540°; tiles spiral inward with motion trails | Thread whoosh |
| 2.1–3.3s | Tiles pair up (8 → 4) and fill with ink, becoming the mark's four lobes | Four tuned ticks |
| 3.2–3.5s | The lobes fuse; the mark appears, still finishing its turn | — |
| 3.4–3.9s | Pink sweeps out from the centre; ripple rings, a spark burst, the aura blooms | Zenboard chime |
| 3.9–4.8s | The mark glides left; the real wordmark (from the app's `<Logo>`) slides out from behind it, letter by letter | Soft whoosh |
| 5.0–5.7s | One pink light sweep across the wordmark; tagline rises | — |

The end card (S18) reprises it in a faster 2-second version, so the film opens and closes on the
same gesture.

## 5 · Scene-by-scene energy plan

| Scene | Now | Change |
|---|---|---|
| S01–S02 | Static plate + headline | IMG-01 builds in layers (desk, figure, window) with slow parallax; the note card slides in and lifts with a camera push |
| S03 | Good | Keep; add a soft camera ease between arrivals |
| S04 | Frozen row 0:13–0:16 | Each phrase sends a wave through the row: keys stamp in, then receipts stack and a monthly total counts up |
| S05–S07 | Good tempo | Add a 0.985 "kick" on every switch; the tab indicator glides |
| S08 | Still question | The eight outlines drift on a slow orbit while the question lands, then hand straight into the reveal |
| S09 | Plain reveal | The new logo reveal (§4) |
| S10 | Window pops in | Camera starts tight on the mark in the sidebar header and pulls back as the rows unfold, each row lighting with its colour |
| S11 | Drag, then still | Camera punches into the calendar slot on the drop; the event pulses; the thread leaves on the next beat |
| S12 | Doc, then still | Punch into the task chip; the new line writes in; the chip status flips with an icon swap |
| S13 | Progress bar, then still | Rows count up (tasks, hours, amount) one per beat; the progress bar fills in steps |
| S14 | Invoice, then still | Hours rows converge into the invoice; the amount counts; punch into Send → Paid with a ripple |
| S15 | Cards, then still | Cards arrive in a staggered wave with parallax on the illustrations; slow push across the week |
| S16 | Thread down sidebar | Keep; add the pull-back to the whole window as the rows light |
| S17 | Static plate | IMG-07 in layers with the same parallax as S01 (morning → evening) |
| S18 | 4 still seconds | Fast logo reprise (§4), CTA pill, then a 1.5s hold |

## 6 · Visuals in the animation

- The eight app glyphs are the visual thread of the logo reveal: the audience sees the apps become the mark.
- Illustrations (IMG-01, 06a–d, 07) move in layers with gentle parallax instead of a flat wipe,
  once the SVGs are in (their layers separate cleanly when vectorised).
- Product UI gets close-ups: the camera travels into the element being used, like Jurni.

## 7 · What happens next

1. Sign off the logo reveal (`out/logo-concept.mp4`), or tell me what to change.
2. I apply §3–§5 across the film and re-measure it against the §1 targets.
3. The illustrations are still needed for S01, S02, S15 and S17.
