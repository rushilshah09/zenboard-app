# Zenboard launch film v4 (current)

Source of truth: **FEEDBACK_V4.md** (directions D1–D16) and the approved storyboard in `storyboard/`
(build with `python3 storyboard/build.py`; published as the "Zenboard Launch Storyboard" artifact).
The film is the `FilmV4` composition, code in `src/v4/` (one file per scene, S1Juggling … S9One), 1:12 at 60fps, 120 BPM.

- Visual language is ported 1:1 from the storyboard CSS (`src/v4/v4.css`, units in cqw: 1cqw = 19.2px).
  Change the look in the storyboard first, then port.
- Brand: Paper #FBFAF6, Ink #191919, Berry #C41C72 accent, flat field colours (see FIELD in src/v4/kit.tsx).
  Geist for everything, Geist Mono only for data. Never full caps. Phosphor icons only (`scripts/extract-v4-icons.mjs`).
- Motion: all from useCurrentFrame(); springs (`pop`, `soft`) and eased curves in src/v4/kit.tsx; no Math.random (use `rnd`).
  Transitions are continuous (morphs, zoom-throughs, light flashes), never plain cuts or crossfades.
- Every appearance has a sound cue (src/v4/sound.ts).
- Preview a scene: `scripts/v4-contact.sh V4-<scene> <every-nth-frame>`.
- Renders here need `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.

The v3 notes below are history: the v3 banned list no longer applies to v4 where the storyboard says otherwise
(for example the person at the centre of scene 1).

---

# Zenboard launch film v3 — "Everything → One"

Source of truth: **DIRECTION_V3.md**. It replaces v1 and v2 completely (CREATIVE_DIRECTION.md,
DIRECTION_V2.md, TREATMENT.md, MOTION_DIRECTION.md and UI_MOTION.md are history). Seven scenes, 1:04,
120 BPM: 1 The Noise · 2 The Collapse · 3 The Reveal · 4 The Graph · 5 The Orbit · 6 The Flow · 7 The One.
One signature technique per scene (doc §5). Do not add scenes, copy or techniques.

## Banned (never reuse, restyle or reference)
- Founder / desk illustrations
- The 4×2 app grid, the tab strip, the ⌘+Tab pill
- Lines: "Every business starts with one person", "And one big idea", "Eight apps. Eight logins. Eight bills.",
  "So you switch", "And type it all again", "More time managing work than doing it",
  "What if it all lived in one place", "Plan your day in seconds", "Write right next to the work",
  "Every client in one view", "Invoice in one click", "And room for the rest of your life",
  "All connected. Nothing to switch.", "One workspace. One subscription. One focus."
- Eight tiles merging into the logo; sidebar rows unfolding one by one
- One-feature-per-screen layouts with a headline above the UI
- Full-frame pastel or rainbow gradient backgrounds
- Anything in `archive/`: never import from it.

## Brand
- Geist and Geist Mono only. No serif, no italics.
- Stages: Ink (#280417 → #120109 with dusty rose haze) and Ivory (#F7F1E8). Never pure black.
  Tokens: `stage`, `energy`, `colour` in src/brand/tokens.ts.
- Energy gradient (#C41C72 → #E8A8C5 → #E8B88A, lavender #AAA0D4 edge) is LIGHT only: orb, rims,
  pulses, glows.
- Real Acme dataset (src/data/acme.ts) and V3-04 photos in the UI. No skeleton bars, no placeholders.

## Motion and tech
- Physics presets, hierarchy timing and cursor rules from src/brand/physics.ts (v2 §3).
- All animation from useCurrentFrame() and seeded random. No useFrame, no Math.random.
- DOM for UI and type; WebGL for swarm, orb, network, orbit (src/gl/). Handoffs on flat, identical frames.
- Selective bloom only on emissive elements. Grain 3%, burgundy vignette 10%.
- Timeline: src/timeline/beats.ts (120 BPM, 1 beat = 30 frames at 60fps).
- Render with `--gl=angle`.

## Workflow
- Styleframes first: render 2–3 stills per scene and wait for approval before animating it
  (`Styleframes` folder in Root.tsx).
- Build one scene per session. Check every scene against the banned list before finishing.
