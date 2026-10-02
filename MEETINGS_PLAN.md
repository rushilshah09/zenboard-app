# Meetings — the AI notetaker, planned against Granola, Otter, Fellow and MeetGeek

**Status:** governing plan for the meetings program. Set 2026-09-29 by user brief: *"meeting notes
tracker functionality exactly like or more advanced than granola.ai, fellow.ai, meetgeek.ai,
otter.ai"*. It is the AI plan's first system (zenboard-ai-master-plan §2 "AI Meetings & Voice") and
V1 items 6–8 (transcription, summary, meeting → tasks). Sprint rules apply: one stage at a time,
each finished end to end.

---

## 1. What the four do (checked on their own sites, 2026-09-29)

| | Granola | Otter | Fellow | MeetGeek |
|---|---|---|---|---|
| Capture | computer audio, **no bot**; phone for in-person | bot or desktop app, Chrome extension, file upload | bot-less desktop/mobile; pause/resume; **consent capture** | bot, desktop, extension, **file upload** |
| Transcript | during the meeting | **live**, speaker recognition, searchable, playback | AI transcript | 100+ languages, speaker ID, custom vocabulary |
| Notes | **your notes enhanced with the transcript**; action items; follow-up email | summary, decisions, action items | summary, action items | **30+ templates, meeting type detected**; highlights |
| After | **chat across meetings**; pre-meeting brief | AI chat across meetings, channels | "Ask Fellow", pre-meeting briefs, recaps | chat across meetings, analytics (talk ratio, sentiment) |
| Data | private by default; free = 30-day notes | — | zero-day retention, MNPI redaction | — |

The shared core: **record without a bot → live transcript with speakers → your notes plus AI notes
→ decisions and action items → a follow-up → ask across every meeting → a brief before the next one.**

## 2. Where Zenboard goes further

The four are notetakers bolted beside the work. Zenboard is where the work already lives, and a
meeting here is an edge in the object graph (PRODUCT_CONTEXT: *the intersection is the product*):

- **The brief knows the client**: open tasks, what you owe, what they owe you (Waiting on), unpaid
  invoices, and what was promised last time — not just "prior discussion".
- **Action items land as tasks in the right project** (`lib/meeting-actions.ts` rules), client asks
  land as Feedback tied to deal revenue, and what the client promised lands in Waiting on.
- **Vocabulary is free**: the client's name, their projects and people are handed to the recogniser,
  so names are spelled right without anyone configuring "custom vocabulary".
- **Me / Them without a bot or a model**: the microphone and the call are captured on separate
  channels, so who spoke is measured, not guessed — and the talk-listen ratio falls out for free.
- **Verified**: every proposal quotes the transcript, every draft is fact-checked
  (`lib/meeting-suggest.ts`, `lib/draft.ts`). A notetaker that invents a commitment is worse than none.

## 3. Architecture ($0, `lib/ai`)

- **Capture (browser)**: microphone + optionally the call's tab audio (`getDisplayMedia`), mixed for
  recording, measured per channel for speakers. Standalone WebM/Opus chunks cut at pauses (6–18 s),
  silent chunks never uploaded. The recorder lives ONCE in the app shell (like the focus timer) so
  navigating never stops a meeting.
- **Transcription (server)**: Whisper large-v3-turbo, **Groq first** (0.37 s for 13.8 s of speech,
  its own free quota of ~8 audio hours a day) and `@cf/openai/whisper-large-v3-turbo` on Workers AI
  as the fallback (measured 2026-09-29: WebM/Opus, WAV and MP3; word timestamps; language detection;
  ~2 s for 14 s; 46.6 Neurons a minute of the shared pool; a vocabulary prompt spelled "Meridian"
  right). The same open weights on both, and neither trains on what it is sent.
  *This reverses "transcription stays on the device" (2026-09-27): in-browser Whisper at browser
  size is the weakest option measured (whisper-base.en WER 10.32 vs large-v3 7.44), and the brief
  is quality.* Cost is contained by an audio allowance per person and the shared-pool guard.
- **Audio is not kept** (Granola's model, Fellow's zero-day retention): chunks are transcribed and
  dropped. Playback + retention is a later, opt-in stage.
- **Intelligence**: the existing gateway (`generateJSON`), verifiers, and `CLIENT_WORDS` rule — a
  client's speech never reaches a provider that trains on it unless the account holder opts in.

## 4. Stages

| # | Stage | Ships |
|---|---|---|
| **M1** ✓ | **Record + live transcript** — shipped 2026-09-29 (PROGRESS.md) | shell recorder, Me/Them, pause/resume, vocabulary, allowance, saved transcript, meeting opens in PageView |
| **M2** ✓ | **Enhanced notes** — shipped 2026-09-29 (PROGRESS.md) | summary · kind · per-kind details · decisions · mine · theirs (Follow up) · asks · open questions, each with the sentence it came from; kept on the meeting (0047) |
| **M3a** ✓ | **Ask the meeting** — shipped 2026-09-29 (PROGRESS.md) | one meeting's questions answered with whole-sentence receipts that open the meeting at their moment; ONE engine (`lib/meeting-ask.ts`) that Ask calls as its `ask_meeting` verb (ASK_PLAN A2), not a second assistant |
| **M3b** ← next | **Ask across meetings** | "what did Ridgeline say about the budget?" across a client's meetings; receipts name their meeting |
| M4 | **Before the meeting** | calendar → one-click record; the brief from the client graph |
| M5 | **Library** | every meeting by client/project, search across transcripts, upload a recording |
| M6 | **After** | follow-up draft (Draft's client-update), share a recap to the portal, talk-listen ratio |

## 5. Data

- `meeting_transcripts` (0046): one row per meeting — `segments jsonb` (start, end, speaker, text),
  `language`, `duration_seconds`, `source`. The AI plan's data model names this table; a column on
  `meetings` would drag a 60 KB transcript into every list query.
- `ai_usage.audio_seconds` (0046): transcription is metered in audio, not tokens.
