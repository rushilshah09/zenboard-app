# Zenboard — "Everything connects"
### Treatment, motion system and shot plan for the launch film

**One idea:** Zenboard turns everything you do into one connected flow.
**What the viewer should feel:** curiosity → tension → discovery → understanding → excitement → desire.
**What they should think at the end:** "I want to use this", not "nice animation".

The voice-over is fixed (13 lines, word-timed), so it directs the visual timeline: every important
phrase triggers a visual action on the same frame (`src/brand/sync.ts`).

---

## 1 · The world

One continuous space, lit three ways. The light *is* the story:

| Light | Where | What it means |
|---|---|---|
| **Warm daylight**: white canvas, soft aurora at the edges | the founder, the product | clarity, calm |
| **The void**: deep plum, UI turns to glass with glowing edges | the scattered apps and the switching | noise, friction, fatigue |
| **The flood**: full-bleed Zenboard gradient, white identity | the reveal, the last frame | the shift |

The background is a single GPU shader (domain-warped flow noise) that runs under the whole film and
never cuts: it breathes in daylight, sinks into the void, and floods with the brand gradient.

## 2 · Motion system

The physical rules everything follows (tokens in `src/brand/motion.ts`):

| Property | Rule |
|---|---|
| **Acceleration** | Fast start. Entrances use `settle` = `cubic-bezier(0.16, 1, 0.3, 1)`, most of the travel in the first third. |
| **Deceleration** | Long and silky; nothing stops abruptly. |
| **Exits** | Leave at speed on `leave` (accelerating). A cut happens at peak velocity, and the next shot picks up that velocity. |
| **Overshoot** | Used once, when the mark forms (`POP`). Also the frantic counter in the chaos. Never on product UI. |
| **Hierarchy** | The primary object moves first; secondary elements follow 4–6 frames later; the background stays restrained. Never everything at once. |
| **Scale** | UI never scales from 0. Min 0.7 with blur when arriving from depth. |
| **Depth** | Foreground (cursor, interaction) → primary UI → secondary UI (smaller, softer) → background → atmosphere. Depth = scale + blur + dim. |
| **Blur** | Speed blur on anything fast (directional in the chaos). Depth blur on what's not in focus. Rack-focus on hand-offs. |
| **Opacity** | Rides the first 40–60% of a move. Nothing fades as its only motion. |
| **Camera** | Moves only to explain: push into the action, pull back to reveal a relationship. Still when the product is doing the talking. |
| **Type** | Words rise out of a 10px blur on their spoken frame, arriving coral → pink → final colour. Type sometimes comes from UI and returns to it. |
| **Cursor** | Accelerates like a hand (ease-in-out), overshoots targets by a few px and corrects, compresses on click. |
| **UI response** | Hover leans (magnetic), click compresses and rings, create acknowledges, complete resolves (check draws + row settles). |

## 3 · Effects hierarchy

- **Level 1: product motion.** Everywhere: interactions, state changes, layout changes, the cursor.
- **Level 2: cinematic.** Everywhere, restrained: the living background, depth of field, shadows, speed blur, camera.
- **Level 3: hero moments.** Only three:
  1. **The reveal (S09).** The eight apps spiral into the mark, with a shockwave and the gradient flood.
  2. **Everything connects (S16).** The workspace opens into 3D space: every module floats on its own plane. Threads of light join them and a GPU particle flow travels along the threads. The fastest, most spectacular moment.
  3. **The identity (S18).** The sidebar icons lift out of the calm workspace and converge into the mark.

## 4 · Continuity: the same object carries you

The product act follows **one piece of work** through the system, and each transition is the
relationship itself:

1. The **task** "Draft Acme proposal" is dragged into 10:00 and **becomes an event**.
2. The event card **expands into the document** it belongs to (Docs), where the task lives as a chip.
3. The chip flips to *Ready for review* and **flies to the client**: it lands as a row on Acme Studio.
4. The client's **tracked hours row expands into the invoice**. Send → Paid.
5. Paid **settles into the week**, and the week opens to the rest of your life.
6. Pull back: **everything connects** (S16 hero).

## 5 · Pacing

| Act | Film | Scenes | Tempo |
|---|---|---|---|
| 01 · The problem | 0:00–0:30 | S01–S07 | calm → **fast**, escalating to frantic |
| — silence | 0:30 | S08 open | sound drops out |
| 02 · The shift | 0:30–0:43 | S08–S10 | **slow**: chaos reorganises, the reveal, the workspace builds |
| 03 · The product | 0:43–0:53 | S11–S13 | **medium**: discovery, one object through the system |
| 04 · The flow | 0:53–1:05 | S14–S15 | **fast**: send, paid, the week |
| 05 · The hero | 1:05–1:10 | S16 | **very fast**: everything connects |
| 06 · The end | 1:10–1:20 | S17–S18 | **slow**: calm workspace, one interaction, the identity |

## 6 · Shot plan

**S01–S02 · One person.** Warm daylight. The founder at the desk; the line lands word by word.
The idea card slides onto the desk, lifts toward camera and becomes the first app window.

**S03 · Apps multiply.** Each new app arrives out of depth (small, blurred, far) and snaps into the
grid. Every arrival dims the light a little: the room darkens into the void. Outlines draw on as
glass. It all feels busier.

**S04 · Eight apps, eight logins, eight bills.** The windows compress into a row of glass tiles; a
wave passes through the row on each spoken noun.

**S05–S07 · Switching.** Whip-pans with horizontal motion blur, faster and faster. The counter
springs on every tick. The camera is locked: the chaos is inside the frame.

**S08 · The question.** Silence, then "What if it all lived in one place?" The row breathes, and
on "one place" it gathers toward the centre.

**S09 · Zenboard.** The tiles lift onto a ring, spin with chromatic trails, pair into four dots and
fuse. The shockwave hits, the mark pops, and the gradient rises in stepped columns and floods the
frame. The white wordmark opens out, and the tagline follows the voice.

**S10 · The workspace unfolds.** The mark flies into the sidebar header. The sidebar drops in on Y
with a hard deceleration, and the main canvas swings in from −15° to face camera. Rows light up with
their colours.

**S11–S15** follow the continuity in §4, with the camera pushing into each action and the rest of
the page stepping back (depth of field).

**S16 · Everything connects (hero).** The window's modules detach into 3D planes (Today, Docs, Acme,
Invoice, Life) and the camera orbits the constellation. Threads of light connect them and particles
flow along them.

**S17 · Calm.** Back to one clean workspace in evening light: all of today's tasks done. One
interaction: the last task is checked. "One workspace. One subscription. One focus."

**S18 · Identity.** The sidebar icons lift off, converge into the mark, the gradient floods, and
"Available today" rises in a glass pill with a soft glow. Hold.

## 7 · Sound

Tactile UI clicks, ticks and snaps (existing kit). Low whooshes for large transitions. A true drop to
silence before the question. A riser into the hero, and the brand chime on the reveal and at the end.
