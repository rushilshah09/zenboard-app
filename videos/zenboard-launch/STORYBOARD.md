---
title: Zenboard — one continuous launch film
duration: 70
message: "Everything you juggle, in one calm workspace: Zenboard."
audience: freelancers, founders and small studios
music: calm, 120 BPM, warm piano and soft pulse (temp: assets/audio/score.wav)
---

# One continuous animation

Not scenes. One stage, one camera, one motion system. Every moment is made from the element that ended
the moment before it. The time codes below are movements inside one timeline (`film.html`, one paused GSAP
timeline, `window.film`), not clips.

Rhythm: build → accelerate → reveal → breathe → build → hero → resolve.

| Movement | Time | Rhythm | Voice-over |
| --- | --- | --- | --- |
| A · Orbit | 0.0–9.4 | build → accelerate | 2.3 "Your work lives in eight apps." · 6.2 "And you live in all of them." |
| B · One | 9.4–15.6 | reveal → breathe | 11.2 "Meet, Zenboard." · 13.0 "Everything you juggle." · 14.6 "In one place." |
| C · Product | 15.6–21.5 | breathe → build | 17.2 "Your whole day. One view." |
| D · Features | 21.5–34.0 | build (clock ticks) | 22.2 … 32.7 "Tasks. Projects. Docs. Calendar. Clients. Money. Habits. Focus." |
| E · Automation | 34.0–41.5 | build → hero | 34.6 "Effortless automation." · 36.6 "Describe it once. Zenboard does the work." |
| F · Everything | 41.5–48.0 | accelerate | 42.3 "Everything you need." |
| G · Made | 48.0–54.0 | hero | 49.3 "Beautifully made." |
| H · Resolve | 54.0–70.0 | resolve | 54.6 "Work, life, and business. One workspace." · 59.8 "Zenboard." · 61.0 tagline · 66.6 "Available today." |

## A · Orbit (0.0–9.4)

- 0.0–1.6: Paper. A hairline draws from the top-right corner diagonally towards the centre (anticipation: it
  eases back a hair before it shoots). A Berry bead rides its tip.
- 1.6–2.4: The bead lands at the centre and opens into the portrait circle (smooth settle, ≈2% overshoot).
- 2.3–4.6: As the voice says "eight apps", eight app tiles are thrown into orbit one by one on two rings. The rings start flat and tilt into 3D depth as they fill. Spin builds from rest.
- 4.6–6.2: Unread badges climb. The diagonal line crosses the rings; where it meets them a ring ripples.
- 6.2–9.4: "And you live in all of them." The two rings counter-rotate faster and faster (integrated angular
  velocity, never a speed switch), the camera pushes in and rolls a few degrees. Tension peaks at 9.2.
- handoff_out: the tiles are on their rings around the portrait (centre 960,540).

## B · One (9.4–15.6)

- handoff_in: A's rings, still spinning.
- 9.4–10.6: The spin coasts, then every tile spirals inward, accelerating into the portrait.
- 10.4–11.2: The portrait squeezes (anticipation), fills with Berry and swells into one Berry circle,
  settling with a small overshoot. The camera drifts back to rest.
- 11.2: "Meet, Zenboard." set below the circle, per-word reveal.
- 12.8–14.4: "Everything you juggle." The same eight apps re-emerge from the circle and settle on ONE flat,
  calm, evenly spaced orbit — order out of chaos. Continuous slow rotation.
- 14.4–15.6: "In one place." The Berry circle stretches into the product window (circle → rounded rect,
  and the eight orbiting apps fly into the window's sidebar rows.
- handoff_out: the dashboard window, centred, scale 1.2, tilted 12° back.

## C · Product (15.6–21.5)

- 15.6–17.0: The window rights itself (tilt 12° → 0°) and breathes; Berry drains out of it and the UI surfaces.
- 17.0–19.0: "Your whole day. One view." The dashboard builds itself: greeting, highlight, plan rows, widgets
  in reading order.
- 19.0–21.2: Camera zooms to the plan, the cursor glides in on an arc, presses
  the first row's checkbox, the task is done.
- handoff_out: the camera, zoomed on the window's left half.

## D · Features (21.5–34.0)

- 21.5–22.2: The window slides right and becomes the feature panel (its rect is the panel's clip), while the
  feature list slides in from the sidebar's edge.
- 22.2–34.0: Eight features, 1.5 s each. The list steps like a clock tick (fast snap, tiny overshoot, still hold);
  the active pill takes the feature's colour; its panel card slides through vertically and the white card
  lands on its corner. Each tick lands on its voice-over word.
- handoff_out: the Focus panel.

## E · Automation (34.0–41.5)

- 34.0–35.0: The Focus panel opens to full frame and deepens into the Berry field; the list leaves left.
- 34.6: "Effortless automation." headline builds; the prompt card rises and types the request.
- 36.6–38.4: "Describe it once. Zenboard does the work." The cursor presses Create (press + ring), the steps
  card slides out beside it and each step checks off in rhythm.
- 38.4–41.5: The mail draft appears, then the toast "Reminder sent to Fernwood Hotels" lands centre.
- handoff_out: the toast, centre.

## F · Everything (41.5–48.0)

- The toast becomes the Automations pill in the centre row of the pill wall; the other rows slide in around it
  from both sides and scroll in alternating directions, accelerating. "Everything you need."
- 46.6–48.0: The rows converge on the centre while the field sinks to ink.
- handoff_out: eight pills gathered at the centre.

## G · Made (48.0–54.0)

- The pills become eight chunky 3D module tiles on a carousel ring (rotateY), which spins with inertia —
  accelerates, coasts, settles on each module. "Beautifully made."
- handoff_out: the ring, still turning.

## H · Resolve (54.0–70.0)

- 54.0–56.5: "Work, life, and business. One workspace." The ring tips over to face the camera — the same
  circular motion, now seen head-on — while the ink blooms back to Paper.
- 56.5–58.0: Tiles shed their icons and become circles; pairs merge: eight circles → four.
- 57.6–58.6: The diagonal line returns from the top right; as it sweeps through, the four circles snap into
  alignment (segments align).
- 58.6–59.6: The mark forms from the four circles (lobes join, the centre opens), settling with a small
  overshoot.
- 59.8: "Zenboard." The mark glides left and the wordmark writes itself letter by letter.
- 61.0–64.3: the tagline sets under the lockup. Breathe.
- 65.0–70.0: the wordmark and tagline depart, the stage sinks to ink and the mark becomes the Berry app
  icon; "Available today." Final fade to black in the last 0.6 s.

## Video direction

- Palette: Paper #FBFAF6 stage, Ink #191919, Berry #C41C72 as the only accent; field colours only inside UI.
- Type: Geist (display 600, -0.035em), Geist Mono only for data. Never full caps.
- Motion: one system for the whole film — `M.inOut` for travel, critically damped settles for arrivals,
  `springEase` ζ≈0.8 (≈1.5% overshoot) only for the hero landings (portrait, Berry circle, mark), clock-tick
  spring for the feature list, integrated angular velocity for every spin. No `back`/`elastic`/`bounce`.
- Camera: one virtual camera (`#cam`) carries A, B and C; D–H run in screen space with their own depth.
- Sound: a cue on every appearance (ticks for list steps, whoosh on travel, click on presses, chime on the mark).
