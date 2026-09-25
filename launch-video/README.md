# Zenboard launch film

A 1:15, 1920 × 1080, 60fps launch film built in [Remotion](https://www.remotion.dev), to the
brief in **[CREATIVE_DIRECTION.md](CREATIVE_DIRECTION.md)** (story, brand system, motion,
storyboard, sound). Session rules for Claude Code: **[CLAUDE.md](CLAUDE.md)**.

**One Surface.** Every frame sits on Warm Cream paper. Acts 1–3 are monochrome: one person,
eight apps, then switching that speeds up until it stops dead. Silence. The eight shapes merge
into one point, the point becomes the Zenboard mark (the first pink in the film), and one Acme
job travels through Today → Docs → Clients → Money → Life in a single product window.

## Structure

```
src/brand/       tokens, fonts, motion curves, 12-column layout + zones, beat timeline, glyphs
src/components/  Headline, AppWindow, Tile, Glyph, Product (window + module views), Thread,
                 Illustration, ZenMark, Camera, Cursor, DebugZones, Audio
src/scenes/      Act1 … Act6 (S01–S18), shared geometry
src/Film.tsx     <Series> of scenes driven by timeline.ts; Root.tsx registers Film16x9 + each scene
```

## Commands

```console
npm i
npm run dev        # Remotion Studio; the DebugZones overlay is on here
npm run master     # 1080p60 master, CRF 14, loudness to -14 LUFS / -1 dBTP → out/zenboard-1080p60.mp4
npm run audio      # re-synthesise score + SFX after re-timing (needs numpy)
npm run scan       # quarter-size render with the overlay; lists collisions / over-budget frames
npm run glyphs     # re-extract the Phosphor glyphs
```

In sandboxes without Remotion's browser download, pass the path to a chrome-headless-shell to
`scripts/master.sh` / `scripts/scan-collisions.py`.

## Assets

- **Illustrations:** see [ILLUSTRATIONS.md](ILLUSTRATIONS.md). Placeholders hold each frame until
  `public/img/IMG-xx.svg` lands.
- **Voice-over (optional):** script, cue times and ElevenLabs settings in
  [VOICEOVER.md](VOICEOVER.md). One clip per line at `public/vo/S01.mp3` …; none in act 3.
  The music drops 3 dB when any clip exists.
- **Sound:** `public/audio/` — original score and SFX synthesised by `scripts/make-audio.py`.
- **Fonts:** Geist (SIL OFL). **Icons:** Phosphor (MIT), the product's own icon family.

Remotion is free for teams of up to 3; larger companies need a
[company license](https://www.remotion.pro/license).
