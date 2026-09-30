// POST /api/chat — Zenboard AI. Streams newline-delimited JSON ChatEvents
// (lib/ai/chat-protocol.ts) while Claude answers, calling read-only workspace
// tools as needed (lib/ai/tools.ts). Persists the user message up front and the
// reply at the end, including when the client stops the stream early.
//
// The Anthropic key never leaves the server. RLS scopes every read to the caller.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { activeSpaceId } from '@/lib/active-space';
import { CHAT_TOOLS, runTool, toolStatus } from '@/lib/ai/tools';
import { STABLE_PROMPT, dayContext } from '@/lib/ai/system-prompt';
import { CHAT_CONTEXTS, titleFrom, type ChatEvent, type ChatMeta, type ChatRequest, type ProposedTask } from '@/lib/ai/chat-protocol';

export const dynamic = 'force-dynamic';

const MODEL = process.env.ZENBOARD_AI_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.ZENBOARD_AI_EFFORT || 'medium') as 'low' | 'medium' | 'high';
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 40;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function parseRequest(raw: unknown): ChatRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const message = typeof r.message === 'string' ? r.message.trim() : '';
  const today = typeof r.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.today) ? r.today : null;
  if (!message || message.length > 8000 || !today) return null;
  const context = Array.isArray(r.context)
    ? r.context.filter((c): c is keyof typeof CHAT_CONTEXTS => typeof c === 'string' && c in CHAT_CONTEXTS)
    : [];
  return {
    conversationId: typeof r.conversationId === 'string' ? r.conversationId : null,
    message,
    context,
    today,
    timeZone: typeof r.timeZone === 'string' ? r.timeZone.slice(0, 64) : undefined,
  };
}

/** Rebuild prior turns as plain text. No thinking blocks are replayed, so earlier
 *  turns can be trimmed from the front freely. Proposals are summarized so the
 *  model remembers what it suggested. */
function toHistory(rows: { role: 'user' | 'assistant'; content: string; meta: Record<string, unknown> | null }[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const row of rows) {
    let text = row.content;
    const proposals = (row.meta as ChatMeta | null)?.proposals;
    if (proposals?.length) text += `\n\n[Suggested tasks shown as cards: ${proposals.map((p) => p.title).join('; ')}]`;
    if (!text.trim()) continue;
    if (!out.length && row.role !== 'user') continue; // history must open with the user
    out.push({ role: row.role, content: text });
  }
  return out;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not signed in.' }, 401);

  const body = parseRequest(await req.json().catch(() => null));
  if (!body) return json({ error: 'Invalid request.' }, 400);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return json({ error: 'Zenboard AI isn’t configured yet. Add ANTHROPIC_API_KEY to the server environment.' }, 503);
  }

  // Resolve (or start) the conversation.
  let conversationId = body.conversationId;
  let title = titleFrom(body.message);
  if (conversationId) {
    const { data: conv } = await supabase.from('ai_conversations').select('id, title').eq('id', conversationId).maybeSingle();
    if (!conv) return json({ error: 'Chat not found.' }, 404);
    title = conv.title || title;
  } else {
    const { data: conv, error } = await supabase.from('ai_conversations').insert({ user_id: user.id, title }).select('id').single();
    if (error || !conv) return json({ error: 'Could not start a chat.' }, 500);
    conversationId = conv.id;
  }

  const { data: prior } = await supabase
    .from('ai_messages')
    .select('role, content, meta, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const { data: userRow, error: userErr } = await supabase
    .from('ai_messages')
    .insert({ conversation_id: conversationId, role: 'user', content: body.message })
    .select('id').single();
  if (userErr || !userRow) return json({ error: 'Could not save your message.' }, 500);

  const spaceId = await activeSpaceId(supabase, user.id);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...toHistory([...(prior ?? [])].reverse()),
    { role: 'user', content: body.message },
  ];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: STABLE_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dayContext(body.today, body.timeZone, body.context) },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')); } catch { /* client gone */ }
      };
      let reply = '';
      const proposals: ProposedTask[] = [];

      send({ type: 'conversation', id: conversationId!, title });
      send({ type: 'user_saved', id: userRow.id });

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const turn = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 64000,
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
              output_config: { effort: EFFORT },
              system,
              tools: CHAT_TOOLS,
              messages,
            },
            { signal: abort.signal },
          );

          let message: Anthropic.Beta.BetaMessage;
          try {
            for await (const event of turn) {
              if (event.type === 'content_block_start' && event.content_block.type === 'thinking') {
                send({ type: 'status', label: 'Thinking' });
              } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                reply += event.delta.text;
                send({ type: 'text', delta: event.delta.text });
              }
            }
            message = await turn.finalMessage();
          } catch (err) {
            // A tool input that isn't parseable JSON rejects the stream; re-issue
            // the turn once. API errors (auth, rate limits, …) propagate.
            if (err instanceof Anthropic.APIError || abort.signal.aborted || round === MAX_TOOL_ROUNDS) throw err;
            continue;
          }

          if (message.stop_reason === 'refusal') {
            if (!reply.trim()) {
              reply = 'I can’t help with that one.';
              send({ type: 'text', delta: reply });
            }
            break;
          }
          if (message.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: message.content });
            continue;
          }

          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
          if (!toolUses.length) break;
          if (message.stop_reason === 'max_tokens') break; // never run tools on a truncated input

          messages.push({ role: 'assistant', content: message.content });
          send({ type: 'status', label: toolStatus(toolUses[0].name) });
          const outcomes = await Promise.all(
            toolUses.map((t) => runTool(t.name, t.input, { supabase, spaceId, today: body.today })),
          );
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = outcomes.map((o, i) => {
            if (o.proposals?.length) {
              proposals.push(...o.proposals);
              send({ type: 'proposal', tasks: o.proposals });
            }
            return { type: 'tool_result', tool_use_id: toolUses[i].id, content: o.result, is_error: o.isError || undefined };
          });
          messages.push({ role: 'user', content: results });
          if (reply && !reply.endsWith('\n')) { reply += '\n\n'; send({ type: 'text', delta: '\n\n' }); }
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          const message =
            err instanceof Anthropic.RateLimitError ? 'Zenboard AI is busy right now. Try again in a moment.'
            : err instanceof Anthropic.AuthenticationError ? 'Zenboard AI isn’t configured correctly (invalid API key).'
            : err instanceof Anthropic.APIError ? 'Zenboard AI hit a problem. Try again.'
            : 'Something went wrong. Try again.';
          console.error('[chat]', err);
          send({ type: 'error', message });
        }
      }

      // Save whatever was produced, even when the user pressed Stop.
      const content = reply.trim();
      if (content || proposals.length) {
        const meta: ChatMeta | null = proposals.length ? { proposals } : null;
        const { data: saved } = await supabase
          .from('ai_messages')
          .insert({ conversation_id: conversationId!, role: 'assistant', content, meta })
          .select('id').single();
        if (saved) send({ type: 'done', messageId: saved.id });
      }
      await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId!);
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
