# Zenboard launch film

A 1:48, 1920×1080 story-driven launch video built in [Remotion](https://www.remotion.dev),
using Zenboard's own design tokens (colors, Geist / Geist Mono / Source Serif 4,
radii, easing) mirrored in `src/theme.ts`.

**[STORY.md](STORY.md)** has the storyboard, the ElevenLabs voice-over script and the
illustration prompts. `src/timeline.ts` is the single source of timing.

- Drop voice-over clips in `public/vo/<scene-id>.mp3`: each scene plays its own, and the music ducks.
- Drop illustrations in `public/illustrations/<name>.png`: they replace the line-drawn stand-ins.

## Commands

```console
npm i
npm run dev                                   # Remotion Studio preview
npx remotion render ZenboardLaunch out/zenboard-launch.mp4 --crf=18
python3 scripts/make-audio.py                 # regenerate score + SFX (needs numpy)
```

In sandboxes without Remotion's browser download, pass
`--browser-executable=<path to chrome-headless-shell>`.

## Assets

- `public/music.wav`, `public/sfx/*.wav` — original score and SFX, synthesised by `scripts/make-audio.py`.
- `public/fonts/` — Geist, Geist Mono, Source Serif 4 (SIL Open Font License).

The Remotion agent skill used to build this lives in `.agents/skills/remotion-best-practices`.
Remotion is free for teams of up to 3; larger companies need a
[company license](https://www.remotion.pro/license).
