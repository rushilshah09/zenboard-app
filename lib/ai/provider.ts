// ── THE PROVIDER CONTRACT ───────────────────────────────────────────────────
//
// Zenboard never calls a model directly. A feature asks the GATEWAY (lib/ai/gateway.ts) for a
// validated result; the gateway picks a provider; a provider only knows how to turn one request
// into text. That split is the AI plan's §18 and §35: the host can change — Workers AI today, Groq
// when the free pool runs dry, something else next year — without a feature noticing.
//
// The contract is deliberately small: ONE completion, not a chat session and not a stream. Every
// AI moment Zenboard has is a clerk's single act (read this, propose that) whose answer must be
// VALIDATED before anyone sees it, and a stream cannot be validated until it has ended.
//
// GEMINI WAS EXCLUDED HERE AND IS NOW INCLUDED (user directive 2026-09-29, reaffirmed after the
// objection was put to them). The objection stands as a FACT and is why lib/ai/gemini.ts carries a
// switch rather than a free hand: Google's unpaid tier may use what it is sent to improve their
// products, with human review, and what reaches a provider is a client's meeting and a person's
// working notes. Workers AI and Groq do not train on it. So Gemini is a provider, and the features
// carrying a CLIENT'S OWN WORDS are gated (lib/ai/gateway.ts `providersFor`) — off unless the
// account holder opts in. NVIDIA's free catalog (lib/ai/nvidia.ts) trains too, and is gated the same way.

export type AIProviderId = 'workers-ai' | 'groq' | 'gemini' | 'nvidia';

export type AIRequest = {
  /** The instructions. Fixed per feature, and never the user's words. */
  system: string;
  /** The material to work on — the user's own words, wrapped by the feature. */
  input: string;
  /** 'json' asks the host for a JSON object; the gateway validates it either way. */
  format: 'json' | 'text';
  /**
   * The output ceiling. On gpt-oss REASONING TOKENS COUNT AGAINST IT: at the model's default
   * effort one measured call spent 1,500 tokens thinking and returned nothing at all, which is why
   * every provider here asks for low effort and the gateway treats an empty answer as a failure.
   */
  maxTokens: number;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Workers AI reports its own bill in Neurons; hosts that do not are null. */
  neurons: number | null;
};

export type AICompletion = {
  /** Null when the model produced no answer at all. */
  text: string | null;
  /** 'length' = cut off at `maxTokens`, and the text (if any) cannot be trusted to be whole. */
  finish: 'stop' | 'length' | 'other';
  usage: AIUsage;
};

export interface AIProvider {
  id: AIProviderId;
  /** The model this provider runs, kept on every usage row. */
  model: string;
  /** False when the provider cannot be reached from here at all: no binding, no key. */
  available(): boolean;
  complete(req: AIRequest): Promise<AICompletion>;
}

type ChatCompletion = {
  choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; neurons?: unknown };
  /** The older Workers AI shape, still returned by some models. In JSON mode it may be an OBJECT. */
  response?: unknown;
};

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/**
 * Both hosts answer gpt-oss in OpenAI's chat-completion shape (Workers AI measured 2026-09-28), so
 * one reader serves both. It never throws: a shape it does not recognise is an empty answer, which
 * the gateway already handles as a failed attempt.
 */
export function readChatCompletion(raw: unknown): AICompletion {
  const out = (raw && typeof raw === 'object' ? raw : {}) as ChatCompletion;
  const choice = Array.isArray(out.choices) ? out.choices[0] : undefined;
  const reason = choice?.finish_reason;
  const finish: AICompletion['finish'] = reason === 'stop' ? 'stop' : reason === 'length' ? 'length' : 'other';

  let text: string | null = null;
  const content = choice?.message?.content;
  if (typeof content === 'string') text = content;
  else if (typeof out.response === 'string') text = out.response;
  else if (out.response && typeof out.response === 'object') text = JSON.stringify(out.response);
  if (text !== null && !text.trim()) text = null;

  return {
    text,
    // A legacy `response` carries no finish reason. Text that arrived is treated as whole; the
    // validator is what decides whether it is usable.
    finish: choice ? finish : text !== null ? 'stop' : 'other',
    usage: {
      inputTokens: count(out.usage?.prompt_tokens),
      outputTokens: count(out.usage?.completion_tokens),
      neurons: typeof out.usage?.neurons === 'number' && Number.isFinite(out.usage.neurons) ? out.usage.neurons : null,
    },
  };
}
