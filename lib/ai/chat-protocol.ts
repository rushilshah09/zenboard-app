// Zenboard AI chat — the wire protocol between POST /api/chat and the chat UI.
// Client-safe (types + tiny helpers only; no SDK, no secrets). The route streams
// newline-delimited JSON: one ChatEvent per line.

export type TaskPriority = 'low' | 'med' | 'high';

/** A task the assistant suggests. Never written by the AI — the user adds it with a tap. */
export type ProposedTask = {
  title: string;
  notes?: string | null;
  priority?: TaskPriority | null;
  scheduledDate?: string | null; // ISO date → lands on that day
  dueDate?: string | null;       // ISO date
  projectId?: string | null;
};

/** Structured extras stored on an assistant reply (ai_messages.meta). */
export type ChatMeta = { proposals?: ProposedTask[] };

export type ChatEvent =
  | { type: 'conversation'; id: string; title: string }
  | { type: 'user_saved'; id: string }
  | { type: 'status'; label: string }
  | { type: 'text'; delta: string }
  | { type: 'proposal'; tasks: ProposedTask[] }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };

export type ChatRequest = {
  conversationId?: string | null;
  message: string;
  /** Context the user pinned from the composer's "+" menu. */
  context?: ChatContextKey[];
  /** The user's local calendar date + zone, so "today" means their today. */
  today: string;
  timeZone?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  rating?: -1 | 1 | null;
  meta?: ChatMeta | null;
};

export type ChatConversation = {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
};

// Context the composer's "+" menu can attach. Each one tells the assistant
// which part of the workspace the question is about.
export const CHAT_CONTEXTS = {
  today: 'Today',
  inbox: 'Inbox',
  calendar: 'This week’s calendar',
  projects: 'Projects',
  finance: 'Finance',
} as const;
export type ChatContextKey = keyof typeof CHAT_CONTEXTS;

export const NEW_CHAT_TITLE = 'New chat';

/** First line of the opening message, trimmed to a rail-friendly length. */
export function titleFrom(message: string): string {
  const line = message.trim().split('\n')[0].replace(/\s+/g, ' ');
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || NEW_CHAT_TITLE;
}
