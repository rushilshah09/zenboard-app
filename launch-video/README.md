# Zenboard launch film

A 40-second, 1920×1080 launch video built in [Remotion](https://www.remotion.dev),
using Zenboard's own design tokens (colors, Geist / Geist Mono / Source Serif 4,
radii, easing) mirrored in `src/theme.ts`.

## Storyboard

| # | Scene | Beat |
|---|---|---|
| 1 | `Scatter` | Tool windows pile up — "Tasks in one app. Notes in another…" |
| 2 | `WordWall` | A wall of "switch"; one word becomes "focus." |
| 3 | `LogoReveal` | Mark + wordmark — "The calm workspace for a business of one." |
| 4 | `Today` | Today list; the cursor checks off the top 3 |
| 5 | `Command` | ⌘K → "Invoice Acme for this week" → invoice ready |
| 6 | `Collage` | Product cards collage under "Work, made calm." |
| 7 | `Spine` | Request → Project → Time → Invoice → Paid |
| 8 | `Kinetic` | "The more you use it / the calmer it gets." |
| 9 | `Outro` | End card — "Available today" |

## Commands

```console
npm i
npm run dev                                   # Remotion Studio preview
npx remotion render ZenboardLaunch out/zenboard-launch.mp4 --crf=18
python3 scripts/make-music.py                 # regenerate the score (needs numpy)
```

In sandboxes without Remotion's browser download, pass
`--browser-executable=<path to chrome-headless-shell>`.

## Assets

- `public/music.wav` — original score synthesised by `scripts/make-music.py`.
- `public/*.wav` sound effects from Remotion's SFX library (remotion.media).
- `public/fonts/` — Geist, Geist Mono, Source Serif 4 (SIL Open Font License).

The Remotion agent skill used to build this lives in `.agents/skills/remotion-best-practices`.
Remotion is free for teams of up to 3; larger companies need a
[company license](https://www.remotion.pro/license).
