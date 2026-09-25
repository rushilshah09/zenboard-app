# Launch film — v4 feedback log

Running notes from review of the delivered v3 film (commit 921f50c). Collecting all directions first;
work starts one direction at a time only after the go-ahead.

## References

| Ref | What we take |
| --- | --- |
| **Flike / "juggling" film** (user in centre, app icons orbiting on soft blue rings) | Scene structure for the opening: one person at the centre, apps orbiting on concentric rings, notification badges counting up (15, 19, 20), message cards and "Pending follow-ups" / "Client Chats" labels spawning around them until it is overwhelming. Then the chaos resolves: rings turn into the brand mark, mark slides left, wordmark types in. |
| **Superhuman brand announcement** (`internal_brand_announcement_1080p.mp4`) | Transitions and storytelling: icons pop in one by one with spring overshoot, merge into one "?" tile, then text-only beats ("Introducing" → "our new identity"). Words blur-in / blur-out per word, a cursor selects a word and it scales/re-styles in place, one element morphs into the next scene (tile → full-frame colour wipe → next stage), shape-matched cuts. Sound design is tight: a soft click/pop on every appearance, whooshes on wipes. |
| Flike stills (6–10) | Ring of apps + chat cards, colour ring resolve into logo, app cables merging into one node. |
| Card refs (Flike UI, Valley ring collage, Fiverr berry banner) | Feature-card styling (D5). |
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

### D4 — Flike look, in Zenboard branding (brand source: guidelines artifact MvbDxDM8WPbd9aJFCpqcjt)
Same effects and staging as the Flike film, re-skinned to the Zenboard brand guidelines:
- **Background:** Flike's soft, airy stage with a diffuse glow behind the centre → Paper `#FBFAF6` /
  Page `#F7F7F5` with a soft Berry wash `#FAEDF4` / Petal `#EAB9CB` glow where Flike uses blue.
  (Guidelines say "no gradients": the glow stays a very soft, blurred light, never a visible gradient fill.)
- **Rings:** thin paper-white concentric rings with a dashed inner orbit around the user.
- **Tiles:** white rounded app tiles, soft shadow, depth blur on far tiles (Flike's focus pull).
- **Chat cards / labels:** white message cards with name + line of text; label chips
  ("Pending follow-ups", "Client Chats", "Email") in **Berry `#C41C72`** instead of Flike blue.
- **Resolve:** Flike's coloured ring segments spin, swipe off on a big arc stroke and settle into the logo
  → our version: segments in the field colours (Petal, Apricot, Butter, Sage, Sky, Periwinkle) sweep
  and collapse into the **Zenboard mark in Berry**, then the wordmark types in letter by letter.
- **Funnel beat:** all app tiles on the left send soft white "cable" lines that merge into one line and
  flow into a single circle on the right = *all in one app* (Zenboard). The merged line then runs
  horizontally through a Zenboard node (Flike AI beat) into a product card that wipes in.
- Ink `#191919` for type/lines, Berry used for one thing per frame only.

### D5 — Feature cards styling
References: Flike product UI card (big rounded white app window floating on the soft stage),
Valley collage (ring of mixed cards — photo, quote, stat, UI crop — around one centred headline),
Fiverr banner (flat Berry field, thin paper-white grid lines, large outline circles, simple line diagrams,
white type + outline button).
- Feature scenes use this card language: flat field-colour or Berry cards with fine white grid lines and
  outline shapes, mixed with real Zenboard UI cards and photo/quote/stat cards.
- A "ring of cards around a headline" layout for the all-in-one statement.
- Product shots = one large floating Zenboard window on the soft Paper stage, Flike-style.

### D6+ — (more directions to come)

## Brand note
The Zenboard brand guidelines (Paper / Ink / single Berry accent, eight flat field colours, no gradients)
differ from the v3 film look (burgundy Ink stage, energy gradient). v4 follows the brand guidelines;
DIRECTION_V3 / CLAUDE.md stage and gradient rules get updated when work starts.

## Status
Collecting directions. No build work yet — waiting for the go-ahead and which direction to start with.
