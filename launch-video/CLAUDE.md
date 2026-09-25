# Zenboard launch film — rules for every session

These rules come from CREATIVE_DIRECTION.md §9. They apply to everything under `launch-video/`
(the app's own CLAUDE.md at the repo root still governs the product code).

## Story
Chaos → too many apps → constant switching → one calm workspace → Zenboard.
The scene list and copy live in CREATIVE_DIRECTION.md, section 5. Never add scenes or copy that isn't there.

## Brand (never hard-code; import from src/brand)
- Font: Geist only. No serif, no italics, no second typeface.
- Background: Warm Cream #F7F1E8 on every frame. No black backgrounds, no dark mode scenes.
- Ink and linework: Deep Burgundy #280417. No pure black, no neutral grey.
- Zenboard Pink #C41C72 appears only from scene S09 onward, only on Zenboard things.
- Category colours come from CATEGORY in tokens.ts and only appear from S10 onward.
- One shadow, tinted burgundy. Radii: 20 windows, 12 cards, 999 pills.
- Icons: the product's own Phosphor family (src/brand/glyphs.generated.ts, from scripts/extract-glyphs.mjs).

## Motion
- Easing only via EASE.settle / snap / leave / breathe. No spring(), no bounce, no overshoot.
- Text only through <Headline>: words rise 24px, 45ms stagger. No typewriter, no letter scramble.
- No 3D tilt, no glow effects, no camera shake. Rotation only for the mark and its orbiting tiles (LogoReveal).
- Motion floor: something purposeful moves every second (the camera counts). Only holds: the silence
  at the start of S08 and the end of the end card. See MOTION_DIRECTION.md.
- The camera may punch in on the action (max 1.15× in the product act) and ease back out.
- Effects (ripple, spark burst, trails, aura, the pink sheen) only on Zenboard moments, S09 onward.
- Voiced text is word-synced: pass `wordAt={syncWords(text, clip, VO_AT[id])}` to <Headline>.
- Animate transform and opacity only. Always clamp interpolate.

## Layout
- Positions only via layout.ts helpers. 160px margins, 32px gutters, 8px spacing scale.
- One headline and one visual per frame, in separate zones. Max 8 elements on screen.
- Exit before enter. Nothing overlaps while moving. Place top-level elements with <Place> and check with
  the DebugZones overlay (on in Studio) — or run `python3 scripts/scan-collisions.py` — before finishing.

## Workflow
- Build one act per session. After each scene, open Remotion Studio and check it against these rules.
- Timeline is in beats (1 beat = 40 frames at 60fps): src/brand/timeline.ts.
- After re-timing, run `python3 scripts/make-audio.py` so the score follows.
