// AI provider adapter (PRD §12). One interface so Gemini → Claude → OpenAI is a
// one-file/env change (AI_PROVIDER). Default: Google Gemini, model
// `gemini-2.5-flash`, via the `@google/genai` SDK — called ONLY from server
// routes so GEMINI_API_KEY never reaches the browser.
//
// Implemented in Phase 4. This file just locks the contract that the AI
// Companion server route and the per-provider adapters will satisfy.

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AIChatRequest {
  messages: AIMessage[];
  /** Serialized, RLS-scoped user data (tasks/goals/notes/rituals) assembled server-side. */
  context?: string;
  signal?: AbortSignal;
}

export interface AIProvider {
  /** Streams assistant tokens as they arrive. */
  chat(req: AIChatRequest): AsyncIterable<string>;
}

export type AIProviderName = 'gemini' | 'anthropic' | 'openai';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
