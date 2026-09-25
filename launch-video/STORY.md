# Zenboard launch film — story, voice-over and illustrations

**Length:** 1:48 · 1920×1080 · 30 fps
**Arc:** one person and an idea → the work piles up → nothing connects → the switching loop → silence → everything pulls into one point → Zenboard → the product, shown in one app shell → life → the connected chain → calm.

Timing lives in `src/timeline.ts`. Change a scene's `frames` there and the scenes, the music (`scripts/make-audio.py`) and the VO slots all follow.

---

## 1 · Storyboard

| # | Scene | Time | What you see | Sound |
|---|---|---|---|---|
| 01 | origin | 0:00 | A lone `/` caret; code glyphs burst out around **"one person."**; they gather, and a paper plane is drawn on a sand card: **"…and a big idea."** | Sparse, hopeful plucks |
| 02 | work-arrives | 0:05 | The founder illustration; work items pop into orbit around them one by one, then the orbit speeds up and blurs | Pops, one per item |
| 03 | tool-pile | 0:11 | One window per app lands on the table, each on its VO line (tasks, notes, invoice from off-screen…), camera creeps in, a sticky note slaps on top | Pops, a thud, a ticking pulse starts |
| 04 | disconnected | 0:20 | On black: Calendar, Projects and Clients get wired together, then each wire **snaps** and a red **?** appears | Two snaps |
| 05 | switching | 0:28 | Key caps slam **⌘C** → **⌘V** → **⌘⇥**; an app switcher cycles faster and faster while "again" floods the frame, then everything collapses to a point | Thuds, accelerating ticks, a glitch |
| 06 | friday | 0:36 | Mon→Fri tick past; **"…more time managing your work… than doing it."** A tangled knot is drawn | Clock ticks, riser |
| 07 | pause | 0:42 | Silence. Black. A caret types **"What if it all lived in one place?"**; a single pink dot remains | Music drops out, only keystrokes |
| 08 | reveal | 0:47 | Every window from act one flies into the dot → flash, shockwave rings → the mark spins open into **Zenboard** | Impact, shimmer; the warm theme enters |
| 09–12 | tour | 0:57 | One Zenboard app shell stays on screen; the cursor clicks down the sidebar: **Today** (tasks ticked) → **Docs** (`/task` inserts a task inside a proposal) → **Money** (12.5h → invoice, $1,875 counts up) → **Clients** (portal request accepted) | Clicks, typing, shimmer, chime |
| 13 | life | 1:17 | An editorial wall of illustrated cards (habits, goals, focus, rituals); **Habits. Goals. Focus.** pop in centre | Pops |
| 14 | flow | 1:24 | Puzzle hands: **"Because everything is connected."** The camera rides one request down a chain: Request → Task → Time → Invoice → **Paid**, then pulls back | Pop per node, chime on Paid |
| 15 | calm | 1:35 | A tidy desk on a sand card: **"No more switching." → "Just your work, in flow."** | Pad resolves |
| 16 | outro | 1:40 | Glyphs gather into the mark → **Zenboard** · "Everything you run, in one place." · **Available today** | Shimmer + soft impact, ring-out |

Colour washes (a soft Base44-style gradient sweep) cover the cuts into 04, 09, 13, 14 and 15.

---

## 2 · Voice-over script

### Voice direction

Warm, unhurried, a little intimate — a founder talking to another founder, not an announcer. Smile slightly on the reveal. Let the problem section tighten and speed up a touch through "again, and again, and again", then drop to almost a whisper for "What if it all lived… in one place?"

**Suggested ElevenLabs settings:** Multilingual v2 (or Turbo v2.5), Stability 50–60, Similarity 75, Style 0–15, Speaker boost on, Speed 0.95. Choose a calm, mid-low, conversational voice.

### How to render it (recommended: one file per line)

Generate each line below **as its own clip** and save it as `public/vo/<file>.mp3`. Every scene plays its own clip automatically, so the sync holds whatever the voice's pace. Keep each clip under its **max length**; anything longer is cut off at the scene change. If a clip is too long, raise that scene's `frames` in `src/timeline.ts` and re-run `python3 scripts/make-audio.py`.

Once any clip is in `public/vo/`, the music automatically ducks under the voice.

| File | Max | Line (paste into ElevenLabs as is) |
|---|---|---|
| `origin.mp3` | 5.1s | Every business starts with one person… <break time="0.5s" /> and a big idea. |
| `work-arrives.mp3` | 5.2s | Then… <break time="0.4s" /> the work shows up. |
| `tool-pile.mp3` | 8.8s | Tasks live in one app. <break time="0.3s" /> Notes, in another. <break time="0.3s" /> Invoices… somewhere else. <break time="0.3s" /> Your calendar. Your clients. <break time="0.3s" /> That one sticky note. |
| `disconnected.mp3` | 7.7s | And none of it talks to each other. <break time="0.5s" /> Your calendar doesn't know your projects. <break time="0.3s" /> Your projects don't know your clients. |
| `switching.mp3` | 7.9s | So you copy. <break time="0.6s" /> You paste. <break time="0.6s" /> You switch… <break time="0.3s" /> again, and again, and again. |
| `friday.mp3` | 5.8s | By Friday, you've spent more time managing your work… <break time="0.4s" /> than doing it. |
| `pause.mp3` | 4.0s | What if it all lived… <break time="0.5s" /> in one place? |
| `reveal.mp3` | 7.7s | Meet Zenboard. <break time="0.7s" /> One calm workspace for your work, your business, and your life. |
| `tour-today.mp3` | 4.6s | Plan your day in seconds. |
| `tour-docs.mp3` | 4.7s | Write proposals right next to the work. |
| `tour-money.mp3` | 4.7s | Turn tracked hours into an invoice, in one click. |
| `tour-portal.mp3` | 4.7s | And give every client a portal of their own. |
| `life.mp3` | 6.8s | It makes room for the rest of your life, too. <break time="0.5s" /> Habits. <break time="0.4s" /> Goals. <break time="0.4s" /> Focus. |
| `flow.mp3` | 10.8s | Because everything is connected. <break time="0.5s" /> A request becomes a task. <break time="0.2s" /> The task becomes time. <break time="0.2s" /> The time becomes an invoice… <break time="0.4s" /> and the invoice gets paid. |
| `calm.mp3` | 4.8s | No more switching. <break time="0.5s" /> Just your work, in flow. |
| `outro.mp3` | 7.3s | Zenboard. <break time="0.6s" /> Everything you run, in one place. <break time="0.5s" /> Available today. |

> `<break time="…" />` works on Multilingual v2, Turbo and Flash. On **Eleven v3**, delete the tags and let the ellipses and full stops carry the pauses.

### The full read (for a single take or a scratch track)

> Every business starts with one person… and a big idea.
>
> Then… the work shows up.
>
> Tasks live in one app. Notes, in another. Invoices… somewhere else. Your calendar. Your clients. That one sticky note.
>
> And none of it talks to each other. Your calendar doesn't know your projects. Your projects don't know your clients.
>
> So you copy. You paste. You switch… again, and again, and again.
>
> By Friday, you've spent more time managing your work… than doing it.
>
> *(silence)*
>
> What if it all lived… in one place?
>
> Meet Zenboard. One calm workspace for your work, your business, and your life.
>
> Plan your day in seconds. Write proposals right next to the work. Turn tracked hours into an invoice, in one click. And give every client a portal of their own.
>
> It makes room for the rest of your life, too. Habits. Goals. Focus.
>
> Because everything is connected. A request becomes a task. The task becomes time. The time becomes an invoice… and the invoice gets paid.
>
> No more switching. Just your work, in flow.
>
> Zenboard. Everything you run, in one place. Available today.

---

## 3 · Illustrations

The film already runs on line-drawn stand-ins. Each one is replaced automatically when a PNG with the matching name lands in `public/illustrations/`. It is multiplied onto its coloured card, so **generate on a pure white background**; the white disappears and only the ink remains.

**Output:** PNG, square, 2048×2048 (1:1), pure white `#FFFFFF` background, subject centred with about 20% empty margin on every side.

### Shared style — paste this at the end of every prompt

> Hand-drawn black ink illustration, loose expressive brush-pen line work with slightly uneven stroke weight, like a modern editorial illustration for a calm tech brand. Minimal detail, confident single lines, occasional small flat off-white or light-grey paper-texture fills. Pure white background, no colour, no gradients, no shadows, no text, no letters, no logos, no frame. Centred subject with generous empty space around it. Square composition.

**Negative prompt (if your tool supports one):** colour, colourful, gradient, 3D, photo, realistic shading, text, watermark, signature, border, frame, busy background, cartoon mascot, clip art.

### The nine images

| # | File name | Used in | Prompt (then add the shared style) |
|---|---|---|---|
| 1 | `founder-idea.png` | 01 origin | A single open hand seen from the side, gently releasing a small folded paper plane into the air; a short dotted trail curves up behind the plane. Hopeful, the start of something. |
| 2 | `juggling.png` | 02 work-arrives | A person shown from the chest up, both arms raised, juggling an arc of work objects above their head: a laptop, a calendar page, a speech bubble, a receipt, a coffee cup and a sticky note. Calm face, but clearly stretched thin. |
| 3 | `tangled-thread.png` | 06 friday | A large ball of thread tangled into dense, chaotic scribbled loops, with one loose end trailing out to the right. Overwhelm, a week that got knotted. |
| 4 | `connected-puzzle.png` | 14 flow, 13 life | Two hands entering from opposite corners, fitting two jigsaw puzzle pieces together in the centre; one piece has a light-grey paper-texture fill. |
| 5 | `calm-desk.png` | 15 calm, 13 life | A tidy desk seen from the front: one open laptop, a small potted plant, a steaming cup of tea, and a person leaning back in a chair with hands behind their head, relaxed and content. |
| 6 | `habit-plant.png` | 13 life | A hand holding a small watering can, pouring water onto a young sprout in a simple clay pot, with a few droplets in mid-air. |
| 7 | `goal-path.png` | 13 life | Two hands framing a straight road that narrows to a vanishing point on the horizon, with a half sun rising behind it. |
| 8 | `focus-hourglass.png` | 13 life | A single upright hourglass with sand falling, and a hand resting lightly beside it. Stillness, lots of empty space. |
| 9 | `rituals-sun.png` | 13 life | An open notebook and a cup of coffee on a table in the foreground, with a sun rising over a flat horizon line behind them and simple radiating rays. |

**Consistency tip:** generate #1 first, then feed it back as a style reference (or reuse its seed) for the other eight, so all nine share one hand.

---

## 4 · Rebuild

```console
npm i
npm run dev                                  # preview in Remotion Studio
python3 scripts/make-audio.py                # regenerate music + SFX after re-timing
npx remotion render ZenboardLaunch out/zenboard-launch.mp4 --crf=18
```
