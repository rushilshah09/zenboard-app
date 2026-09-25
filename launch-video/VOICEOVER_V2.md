# Voice-over v2 — record this first

DIRECTION_V2.md §7: "Record it first, then lock the edit to it." The whole v2 timeline hangs off
this recording, so it's the first thing needed.

## Voice direction
A calm, warm, close-mic voice: a founder talking to another founder. Confident, never salesy.
Slightly faster and tighter in Act 1 and on the "Create. Plan. Write. Send. Done." run; slower and
warmer from "Zenboard" onward.

**Female or male both work:** the edit is built from the recording's own word timings, so any
voice drops in. For a female read, pick a warm, mid-low, conversational voice rather than a bright
announcer. Cassidy (the v1 voice) is female and keeps continuity.

**ElevenLabs:** Multilingual v2 · Stability 50 ·
Similarity 75 · Style 15 · Speaker boost on · Speed 1.0. `<break>` tags work on v2/Turbo/Flash; on
Eleven v3, delete them and let the punctuation carry the pauses.

## Paste into ElevenLabs (one take)

```
You started a business to do the work you love. <break time="0.4s" /> Instead, you're running it across eight different apps. <break time="0.3s" /> Retyping the same client. <break time="0.2s" /> Chasing the same invoice. <break time="0.2s" /> Switching. <break time="0.3s" /> Again.
<break time="1.8s" />
What if it all connected? <break time="0.8s" /> Meet Zenboard. <break time="0.5s" /> One connected workspace for your work, your business, and your life.
<break time="0.6s" />
It starts with a task. <break time="1.0s" /> That becomes part of a project. <break time="1.0s" /> It finds its place on your calendar. <break time="1.0s" /> Your docs live right next to the work. <break time="1.0s" /> Your clients see progress. <break time="1.0s" /> And the hours become an invoice. <break time="0.3s" /> In one click.
<break time="0.6s" />
Create. <break time="1.2s" /> Plan. <break time="1.2s" /> Write. <break time="1.2s" /> Send. <break time="1.2s" /> Done.
<break time="0.8s" />
Everything you run, <break time="0.6s" /> connected. <break time="0.8s" /> In one place.
<break time="3.0s" />
Zenboard. <break time="0.6s" /> The single platform to manage work, life, and business.
```

The long breaks line up with v2's shot lengths (§5): the 1.8s silence is the freeze at 0:14–0:16;
the 1.0s gaps let each product beat land; the 1.2s gaps put each Act 4 word on its own bar at 120 BPM;
the 3.0s gap is the calm "All done for today" moment before the end card.

Save it as `audio-src/voiceover-v2.mp3` (or drop it in chat). I'll then:
1. cut and level it, and
2. transcribe every word to the frame (`vo-markers.json`, §7), so every bold word in §5 triggers its
   visual action automatically.
