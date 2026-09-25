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
| Card look refs (green Project Status card; Morphosis, Lovable, rust WELCOME UI) | UI card look & background (D6). |
| Animation refs (Equator split screen, 3D terminal icon, Semantical carousel) | Animation patterns (D7). |
| `refs/app-ui/*.png` | Real Zenboard app screens — the source for every UI element in the film. |
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

### D6 — UI card look & feel (reference: green "Project Status" card)
The product UI in the film should look like the green "Project Status" reference:
- **Background:** one brand colour going **dark → light** (deep at one corner, lighter at the opposite),
  with large soft overlapping circles in slightly lighter tones = our **Zenboard mark (four-lobed shape)
  blended in, very subtle** (low-opacity / soft-light blend mode), cropped large behind the UI.
- **Cards:** a frosted, slightly translucent card tinted to the background (headline in the dark brand tone,
  status bars/progress in tints of the same hue), with a crisp white card floating **above** it,
  overlapping its corner (avatars + search in the ref → a real Zenboard element in ours).
- **Logo above:** the Zenboard logo sits above the composition.
- Other refs in this batch (Morphosis, Lovable brand board, rust "WELCOME" UI with connector lines and
  code chips) are mood only: grain texture, UI panels joined by thin lines with dot nodes, floating chips.
- **Our aesthetic = the real Zenboard app.** It was screenshotted from the running app
  (`dev-preview` routes) into `refs/app-ui/` (home, tasks, calendar, documents, clients, money, habits, inbox):
  dark neutral UI, Geist, dense rows, small coloured tags, Berry accents. UI inside the film cards is
  rebuilt from these screens, not invented.

### D7 — How we animate (refs: Equator split screen, 3D terminal icon, Semantical icon carousel)
- **Split-screen scroll-and-sync (Equator):** left half = a flat brand-colour panel with a vertical list of
  big pills (icon + label, mono caps) scrolling continuously; the pill passing the centre line turns solid
  white = "active". Right half = a stack of feature cards on a light Paper stage that swaps to the matching
  card each time a new pill becomes active (front card slides/scales in, previous ones peek behind,
  slightly offset and tinted). Brand mark small in the corner. → use for the Zenboard modules
  (Tasks, Projects, Docs, Calendar, Clients, Money, Habits…) with real app cards on the right.
- **3D app icons (terminal icon):** Zenboard module icons as soft, chunky 3D tiles — rounded square,
  bevelled rim with a thin highlight, inset pill "screen", matte surface, lit from the top-left.
- **Icon carousel (Semantical):** a horizontal row of those 3D tiles on a dark stage sliding sideways,
  the centre tile scaling up and coming forward, sides smaller and cropping off the frame edges; a label
  chip under the centre tile changes with each step (spring snap, not linear scroll); a soft warm glow
  rising from the bottom edge. Tiles use brand field colours + paper white, with the Zenboard star
  cut-out as the glyph motif (like Semantical's sparkle).
- Motion rule for all three: step → spring settle → short hold → next step, on the beat.

### D8 — Icons and card language
- Icons: **Phosphor** only (duotone for app tiles, fill/bold for buttons), read from `@phosphor-icons/react`.
- Cards: warm cream surfaces, soft tinted squircle tiles, small mono meta labels, dark mono count badges,
  avatars and the hero portrait masked in the Zenboard lobe shape, a faint dot grid on the stage
  (refs: PXDX "UI Style" sheet, muted real-estate card collage, cream revenue cards).

### D9 — Connector lines (never the same straight fan of equal white lines)
- Many → one: each app sends a fan of fine hairlines in its own colour; all fans converge on one bright
  point, then three dots lead into Zenboard (ref: "Bringing together").
- One line: soft colour waves ripple along a line and settle into a single Berry line (ref: layered waves).

### D10 — Camera movement (ref: Fostr AI / beliv8 product film)
- Product UI floats as a 3D window: tilted back 12–18° with some yaw, slow dolly-in and rise, shallow depth
  of field (far edge soft). Macro push along rows, then rotate flat to camera whenever it must be read.
- Light-flash whip between shots: the frame overexposes to a white bloom for ~10 frames and resolves
  into the next shot. Used for scene 3 → 4.
- Every storyboard frame now carries a Camera note.

### D11 — Outro: blueprint lockup (refs: Superhuman logo construction, Fiverr grid banner, blueprint sheets, Reformr grid)
- Zenboard lockup large in the centre (SUPERHUMAN-style), crisp white, framed by hairline rails with corner handles.
- Background: our Berry field (dark to light) with fine grain.
- Behind it, subtle blueprint drawing in white hairlines and dotted lines: construction of the mark (32-unit box,
  lobe circles, diagonals, star angle, dimension labels), Geist type specimen, outline component cards
  (card, checkbox rows, Start focus button, pill), grid blocks, mono notes. Never harsh; Zenboard stays the hero.
- 8.2 draws the blueprint on; 8.3 dims it to ~50% for the tagline and Available today.

### D12 — Type rule
- Never full caps, anywhere: labels, pills, mono notes and chips use sentence or title case.

### D13+ — (more directions to come)

## Brand note
The Zenboard brand guidelines (Paper / Ink / single Berry accent, eight flat field colours, no gradients)
differ from the v3 film look (burgundy Ink stage, energy gradient). v4 follows the brand guidelines;
DIRECTION_V3 / CLAUDE.md stage and gradient rules get updated when work starts.

## Status
Storyboard v4 drafted (`storyboard/`, built by `storyboard/build.py`): 8 scenes, 18 keyframes, awaiting frame-by-frame approval before any animation.
