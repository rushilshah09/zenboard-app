# Zenboard launch film v2 — rules for every session

**Governing direction: DIRECTION_V2.md** (the "Direction v2 — Cinematic" doc). It replaces
CREATIVE_DIRECTION.md §9, MOTION_DIRECTION.md, UI_MOTION.md and TREATMENT.md wherever they differ.
These rules apply to everything under `launch-video/` (the repo-root CLAUDE.md still governs the
product code).

> **Build status.** The current code is the "v3" build: the pre-v2 story and voice-over on the
> Aurora look. v2 is being built on top of it, following DIRECTION_V2.md §9's session plan. Reusable
> parts: word sync (`src/brand/sync.ts`), WebGL layers (`src/gl/`), SeamCut continuity, the S16 3D
> constellation, the evening ending. Until v2 replaces a scene, keep it working.

## Idea
Zenboard turns everything you do into one connected flow. The Thread (a filament of Zenboard Pink
light) connects every object. We follow one job, "Acme Studio: rebrand proposal", through the
product. Script, shots and timings: DIRECTION_V2.md §5. Don't invent scenes or copy.

## Brand
- Geist and Geist Mono only. No serif, no italics.
- Deep Burgundy #280417 instead of black everywhere. Never pure black, never neutral grey.
- Warm Cream #F7F1E8 is the Day world. The Night world is lit burgundy with haze, never flat.
- Zenboard Pink #C41C72 is light: the Thread, the mark, key states. Not before shot 2.1.
- Category pairings from tokens.ts only.

## UI
- Real data from src/data/acme.ts. No skeleton bars, no lorem, no placeholders.
- Product fills 70–90% of frame width in product shots. Macro shots at 2–3×.
- Panels: 20px radius, 1px inner highlight, burgundy hairline, three-layer burgundy shadow.

## Motion
- Only the presets in brand/physics.ts. Overshoot ≤2%, UI objects only.
- Hierarchy: lead at 0, response +4f, consequence +8f, environment +16f. Max three tiers moving.
- UI never fades in from nothing in the Day world; it arrives from a source.
- The camera moves only with a reason. At least 20% of product shots are locked.
- L3 effects (shaders, particles, 3D) only in shots 1.5, 2.1–2.2 and 5.1–5.3.

## Tech
- All animation from useCurrentFrame(). No useFrame, no Math.random, seeded noise only.
- VO-synced actions use at('word') from timeline/.
- DOM ↔ WebGL handoffs happen flat to camera at identical position and scale.
- Render with `--gl=angle` (`scripts/master.sh <chromium>`); check layout with
  `python3 scripts/scan-collisions.py <chromium>`.
