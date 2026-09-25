/**
 * The film's single source of timing truth. Every scene's length, its
 * voice-over line and its optional VO clip live here; scenes, music cues
 * (scripts/make-audio.py) and STORY.md all follow this table.
 *
 * VO clips: drop `public/vo/<id>.mp3` (one ElevenLabs render per line) and
 * the scene plays it automatically, `voAt` frames after the scene starts.
 */

export type Act = "Problem" | "Turn" | "Reveal" | "Product" | "Close";

export type SceneSpec = {
  id: string;
  act: Act;
  frames: number;
  voAt: number;
  vo: string;
};

export const TIMELINE = [
  { id: "origin", act: "Problem", frames: 165, voAt: 12, vo: "Every business starts with one person… and a big idea." },
  { id: "work-arrives", act: "Problem", frames: 165, voAt: 8, vo: "Then… the work shows up." },
  { id: "tool-pile", act: "Problem", frames: 270, voAt: 6, vo: "Tasks live in one app. Notes, in another. Invoices… somewhere else. Your calendar. Your clients. That one sticky note." },
  { id: "disconnected", act: "Problem", frames: 240, voAt: 8, vo: "And none of it talks to each other. Your calendar doesn't know your projects. Your projects don't know your clients." },
  { id: "switching", act: "Problem", frames: 240, voAt: 4, vo: "So you copy. You paste. You switch… again, and again, and again." },
  { id: "friday", act: "Problem", frames: 180, voAt: 6, vo: "By Friday, you've spent more time managing your work… than doing it." },
  { id: "pause", act: "Turn", frames: 150, voAt: 30, vo: "What if it all lived… in one place?" },
  { id: "reveal", act: "Reveal", frames: 300, voAt: 70, vo: "Meet Zenboard. One calm workspace for your work, your business, and your life." },
  { id: "tour-today", act: "Product", frames: 150, voAt: 12, vo: "Plan your day in seconds." },
  { id: "tour-docs", act: "Product", frames: 150, voAt: 8, vo: "Write proposals right next to the work." },
  { id: "tour-money", act: "Product", frames: 150, voAt: 8, vo: "Turn tracked hours into an invoice, in one click." },
  { id: "tour-portal", act: "Product", frames: 150, voAt: 8, vo: "And give every client a portal of their own." },
  { id: "life", act: "Product", frames: 210, voAt: 6, vo: "It makes room for the rest of your life, too. Habits. Goals. Focus." },
  { id: "flow", act: "Product", frames: 330, voAt: 6, vo: "Because everything is connected. A request becomes a task. The task becomes time. The time becomes an invoice… and the invoice gets paid." },
  { id: "calm", act: "Close", frames: 150, voAt: 6, vo: "No more switching. Just your work, in flow." },
  { id: "outro", act: "Close", frames: 240, voAt: 20, vo: "Zenboard. Everything you run, in one place. Available today." },
] as const satisfies readonly SceneSpec[];

export type SceneId = (typeof TIMELINE)[number]["id"];

export const sceneSpec = (id: SceneId): SceneSpec => TIMELINE.find((s) => s.id === id)!;

export const sceneStart = (id: SceneId) => {
  let at = 0;
  for (const s of TIMELINE) {
    if (s.id === id) return at;
    at += s.frames;
  }
  throw new Error(`Unknown scene ${id}`);
};

export const TOTAL_FRAMES = TIMELINE.reduce((a, s) => a + s.frames, 0);
