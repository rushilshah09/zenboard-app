# UI motion — how the references present product, and what we take

A third pass, focused on the product UI. The references are Jurni, Airbank and ElevenLabs Agents,
studied frame by frame. The motion principles from the `product-launch-video` skill
(`.agents/skills/product-launch-video/references/motion-language.md`, `cut-catalog.md`) are
folded in here.

## 1 · What the references do that we don't

| Technique | Where | What it looks like |
|---|---|---|
| **UI is built, not placed** | Airbank 0:14–0:18 | Blank surface blocks (sidebar, header, panel) slide in from different sides on a long decel curve. Only once the skeleton has landed does the real content fade in inside it. The window assembles in front of you. |
| **The hero component lifts out** | Jurni 0:25–0:31, Airbank 0:31–0:37 | The app shrinks to context, and the one component the voice is about (prompt box, payment form) is shown alone and large beside the words. Everything else steps back. |
| **Depth of field** | Jurni 0:06–0:12, ElevenLabs 0:26–0:30 | Several layers at once: the focused layer is sharp and near, everything behind is smaller, softer, dimmer. That is what makes it feel 3D and premium, not a flat frame. |
| **Macro ↔ micro** | Jurni 0:19–0:22 | A hard switch between the tiny full app and an extreme close-up of one element (a sidebar row with its hover pill and cursor), then back. Close-ups crop off the edges of the frame. |
| **Velocity-matched cuts** | Airbank 0:32 (form → access rights), ElevenLabs tabs | One UI state leaves by accelerating in one direction while blurring and fading; the next arrives from the same direction, already moving, and decelerates. The eye rides one motion across the cut, so there is never a dissolve. |
| **Motion blur on speed** | Jurni card field, ElevenLabs line sweeps | Fast things smear in the direction they travel, then sharpen as they settle. |
| **Reveals on the voice** | all three | Each row, card or chip appears when the voice names it, spread across the scene, never all at the start. |
| **Stillness over lazy motion** | skill doctrine | A resolved frame holds. No breathing, no slow drift in the back half: motion comes from the next reveal, not from wobbling what is already there. |

**Logo:** all three build the mark from parts (Jurni pixel dots, Airbank letters scattering and
reassembling, ElevenLabs light strokes that turn solid), and the mark **becomes UI** (the
ElevenLabs bars become the app card; the Jurni mark becomes the engine at the centre of the
cards). Our reveal already builds the mark from the eight app tiles; what it lacked is speed
blur on the spin, and the mark handing off into the product.

## 2 · What was basic in ours

1. The product window arrives whole: one card rising 48px with a fade.
2. Every module is the same flat frame, with everything at one depth, all the time.
3. Switching modules is a soft blur crossfade: nothing carries the eye from one view to the next.
4. Holds were kept alive by camera creep, which the skill calls out as the cheap tell.
5. Rows and cards appear on a fixed stagger, not on the voice.

## 3 · What changes (Zenboard's version, not a copy)

- **The window assembles (S10).** As the mark flies into the header, the window is built from
  blank Paper blocks: the frame, the sidebar from the left, and content blocks placed exactly
  where Today's list and calendar will be. Sidebar rows populate and take their colours. In
  S11 those blocks resolve into the real Today view.
- **Swipe cut between modules (S12–S15).** The outgoing view accelerates upward, blurring and
  fading. The incoming one arrives from below, already moving, and settles, while the sidebar
  selection glides down in the same beat. It's one continuous vertical motion that follows the
  sidebar.
- **Lift-out with depth of field (S12–S15).** At each module's key moment the hero component
  lifts off the page toward camera: the status chip as it flips to *Ready for review*, the
  project progress as it fills, the invoice as Send → Paid, a life card. The window behind
  softens, dims and recedes a step; then the component sets back down.
- **Motion blur** on the spinning tiles and the mark's flight into the sidebar.
- **Reveals on the voice:** client rows land on "client / one / view", and life cards on
  "room / rest / your / life".
- **Stillness:** the camera creep is gone from the product act; each module keeps one purposeful
  push (S11 into the drop) and the lift-out does the rest.
- **Chaos windows (S03)** arrive as blank cards first and fill with their content a beat later,
  the same build grammar as Zenboard's window, so act 2 and act 5 rhyme.

## 4 · Tokens

No new easing curves: entries use `EASE.settle` (long-tail decel), exits at speed use
`EASE.leave` (accelerating), exactly the mirrored pair the cut catalog asks for. Blur peaks:
10px for text-size things, 14–18px for surfaces.

## 5 · The motion blueprint (Life Design Studio) — applied

| Blueprint item | Status |
|---|---|
| Expo curve `cubic-bezier(0.16, 1, 0.3, 1)` for every entrance and move | **Done**: `EASE.settle` is now this curve, film-wide |
| 0:00–0:15 cards at varying Z-depths, asynchronous sine float | **Done** in S03: each window floats out of phase at its own depth, settling to rest before S04 |
| 0:16–0:33 whip-pans with X-axis motion blur; counter reacts on each tick | **Done**: each switch whips the next app in from the right with directional blur; the tab dot glides; the counter jumps a size and darkens, then settles (no bounce, see below) |
| 0:34–0:42 icons spiral inward, shockwave at impact, dots → logo, kinetic tracking type | **Done** (already built, plus): speed blur on the spin, ripple and spark burst at impact, and the wordmark now opens out from tight tracking |
| Plan: UI unfolds, not scaled from 0; lifted drag at 1.05 with shadow | **Done**: window assembles from blocks (S10), resolves into Today; the dragged task lifts to 1.05 |
| Write: tracking zoom into the doc past a blurred sidebar; hard-cut caret; status pill parts slide in 0.03s apart | **Done** |
| Clients: staircase cascade from above, 0.05s per row; liquid progress fill | **Done** |
| Invoice: macro zoom, magnetic Send, radial ring on click, Paid badge | **Done**, except the spring bounce and 3° rotation on Paid (see below) |
| Life: cards enter on diagonal trajectories and snap into the grid; wide pull-back | **Done** (pull-back is S16) |
| Final lockup: sidebar icons detach and converge into the logo | **Open**: needs S16–S18 restructured (see below) |
| Darker atmospheric void, chiaroscuro, UI as light source; glow; glassmorphism; elastic overshoot; Y-axis 3D swing; chromatic aberration | **Held**: these contradict the film's brand rules (CLAUDE.md, CREATIVE_DIRECTION.md). Waiting on a decision. |
