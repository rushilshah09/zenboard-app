# Launch film — v4 feedback log

Running notes from review of the delivered v3 film (commit 921f50c). Collecting all directions first;
work starts one direction at a time only after the go-ahead.

## References

| Ref | What we take |
| --- | --- |
| **Flike / "juggling" film** (user in centre, app icons orbiting on soft blue rings) | Scene structure for the opening: one person at the centre, apps orbiting on concentric rings, notification badges counting up (15, 19, 20), message cards and "Pending follow-ups" / "Client Chats" labels spawning around them until it is overwhelming. Then the chaos resolves: rings turn into the brand mark, mark slides left, wordmark types in. |
| **Superhuman brand announcement** (`internal_brand_announcement_1080p.mp4`) | Transitions and storytelling: icons pop in one by one with spring overshoot, merge into one "?" tile, then text-only beats ("Introducing" → "our new identity"). Words blur-in / blur-out per word, a cursor selects a word and it scales/re-styles in place, one element morphs into the next scene (tile → full-frame colour wipe → next stage), shape-matched cuts. Sound design is tight: a soft click/pop on every appearance, whooshes on wipes. |
| Pill wall frame (`1.webp`) | The pill wall itself stays; the look behind it changes (see D2). |

## Directions

### D1 — Motion quality (applies to the whole film)
Current motion reads basic: easing and smoothness are not at professional-film level.
- Replace linear / generic ease curves with proper spring physics and strong ease-in-out
  (fast start, long soft settle), with small overshoot on pop-ins, as in the Superhuman film.
- Add motion blur on fast moves, per-word blur-in text reveals, and staggered (not simultaneous) entrances.
- Scene changes must be *transitions*, not cuts or crossfades: morph one element into the next scene
  (shape match, a tile growing into a full-frame colour wipe, a zoom-through), à la Superhuman.
- Every appearance gets its own SFX (pop, click, whoosh, riser), timed to the frame.

### D2 — Pill wall background
When the module pills appear, the background behind them must be a **plain, brand-coloured
background** — no blurred UI cards / screenshots behind the pills.

### D3 — New opening scene: juggling between apps
Scene 1 becomes: **a user at the centre**, surrounded by the multiple apps they use today
(our competitors), orbiting on rings like the Flike reference. Story beat = *juggling between apps*:
badges climb, messages and cards pile up, the user looks overwhelmed, until everything resolves
into Zenboard.
- Open points to confirm before building: which user image (the provided portrait `3.webp` or another),
  and which competitor apps / whether to use real third-party logos or generic app tiles.

### D4+ — (more directions to come)

## Status
Collecting directions. No build work yet — waiting for the go-ahead and which direction to start with.
