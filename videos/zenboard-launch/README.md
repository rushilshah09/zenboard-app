# Zenboard launch film — one continuous animation

Hand-built: one HTML stage and one GSAP timeline (`window.film`), no video framework. The approved v4 UI
(dashboard, feature cards, automation cards) is rendered from `launch-video/src/v4` into static HTML, so the
product looks exactly as signed off in the storyboard.

| File | What |
| --- | --- |
| `STORYBOARD.md` | the continuous plan: eight movements, voice-over times, motion language |
| `src/film.js` | the whole film's motion — one timeline |
| `src/film.css` | stage layout (UI styles come from `launch-video/src/v4/v4.css`) |
| `tools/fragments.tsx` | renders the approved React UI to `build/fragments.json` |
| `tools/build.mjs` | assembles `film.html` and the audio cue list `build/audio-cues.json` |
| `tools/render.cjs` | seeks the timeline frame by frame in headless Chromium → ffmpeg, mixes VO + score + SFX |

```bash
# after changing launch-video/src/v4 UI:
cd launch-video && ./node_modules/.bin/esbuild ../videos/zenboard-launch/tools/fragments.tsx --bundle --platform=node \
  --format=cjs --outfile=../videos/zenboard-launch/build/fragments.cjs \
  --alias:remotion=../videos/zenboard-launch/tools/remotion-shim.ts --loader:.css=empty --jsx=automatic \
  && node ../videos/zenboard-launch/build/fragments.cjs ../videos/zenboard-launch/build/fragments.json
cd ../videos/zenboard-launch
node tools/build.mjs                          # → film.html (open it in a browser: window.film.seek(t))
node tools/render.cjs stills 3,12,20,40       # → out/contact.jpg
node tools/render.cjs video 30                # → out/film.mp4 (1080p, with sound)
```
