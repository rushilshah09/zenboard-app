# Voice-over script

The film is written to work text-only; voice-over is optional (CREATIVE_DIRECTION.md §6). Each
line is the same copy that is on screen. There is **no voice in act 3** (0:16–0:30), so the
switching noise carries it, and none at the silence cut.

## Voice direction

Calm, close-mic, unhurried: a founder talking to one person, not an announcer. Leave space
between phrases. Warmer and slower from "Zenboard" onward.

**ElevenLabs:** Multilingual v2 (or Turbo v2.5) · Stability 55 · Similarity 75 · Style 10 ·
Speaker boost on · Speed 0.95. `<break>` tags work on v2 / Turbo / Flash; on Eleven v3 delete
them and let the punctuation carry the pauses.

## Current voice

Recorded in ElevenLabs (voice: Cassidy, "Crisp, Direct and Clear") as one take,
`audio-src/voiceover-take.mp3`. `python3 scripts/cut-voiceover.py` cuts it into the 13 clips
below and levels them; re-run it after replacing the take (and update its cut points).

## How to add it

Render **one clip per line** and save it as `public/vo/<File>` (MP3). The film plays each clip at
its cue on a separate voice track, and the music drops 3 dB automatically once any clip exists.
Keep every clip under its **Max** length so it ends before the next line starts.

| File | Starts at | Max | On screen | Line to paste into ElevenLabs |
|---|---|---|---|---|
| `S01.mp3` | 0:00.3 | 2.4s | Founder at the desk | Every business starts with one person. |
| `S02.mp3` | 0:02.7 | 9.3s | The note card | And one big idea. |
| `S04.mp3` | 0:12.0 | 4.7s | App tiles, logins, bills | Eight apps. `<break time="0.4s" />` Eight logins. `<break time="0.4s" />` Eight bills. |
| — | 0:16–0:30 | — | Act 3, switching | *(no voice)* |
| `S08.mp3` | 0:30.7 | 6.3s | The question, on empty paper | What if it all lived… `<break time="0.4s" />` in one place? |
| `S09.mp3` | 0:37.0 | 8.5s | Zenboard mark | Zenboard. `<break time="0.7s" />` The single platform to manage work, life, and business. |
| `S11.mp3` | 0:45.5 | 4.0s | Today view | Plan your day in seconds. |
| `S12.mp3` | 0:49.5 | 4.0s | Acme proposal doc | Write right next to the work. |
| `S13.mp3` | 0:53.5 | 4.0s | Acme client page | Every client in one view. |
| `S14.mp3` | 0:57.5 | 4.0s | Invoice → Paid | Invoice in one click. |
| `S15.mp3` | 1:01.5 | 3.9s | Life week | And room for the rest of your life. |
| `S16.mp3` | 1:05.5 | 2.8s | Thread through the sidebar | All connected. `<break time="0.3s" />` Nothing to switch. |
| `S17.mp3` | 1:08.3 | 6.3s | Same desk, evening | One workspace. `<break time="0.5s" />` One subscription. `<break time="0.5s" />` One focus. |
| `S18.mp3` | 1:14.5 | 2.8s | End card | Zenboard. `<break time="0.6s" />` Available today. |

Cue times live in `VO_AT` / `VO_CUES` in `src/brand/timeline.ts`; if the timeline is re-timed, this table
moves with it.

## Word sync

On-screen words appear exactly as they are spoken. `python3 scripts/vo-words.py` transcribes each
clip with word timestamps (faster-whisper) into `src/brand/vo-words.generated.ts`;
`syncWords()` in `src/brand/sync.ts` aligns every on-screen line to those words and each
`<Headline wordAt>` rises its words on them (5 frames ahead, so a word is readable as it is
heard). Re-run `vo-words.py` whenever a clip is replaced or re-cut; the text follows by itself.

## The full read (for a single scratch take)

> Every business starts with one person.
> And one big idea.
>
> Eight apps. Eight logins. Eight bills.
>
> *(switching — no voice)*
>
> What if it all lived… in one place?
>
> Zenboard. The single platform to manage work, life, and business.
>
> Plan your day in seconds.
> Write right next to the work.
> Every client in one view.
> Invoice in one click.
> And room for the rest of your life.
>
> All connected. Nothing to switch.
>
> One workspace. One subscription. One focus.
>
> Zenboard. Available today.
